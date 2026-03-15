import { ShieldCheck, ShieldAlert, ShieldX, RefreshCw, Clock, Globe, TrendingUp, AlertTriangle, Newspaper, Zap } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { FeedPayload, FeedSource } from "@/hooks/useMarketFeeds";
import { formatAgeLabel, formatCountdown, getAgeMinutes } from "@/hooks/useMarketFeeds";

interface IntelSidebarProps {
  feeds: FeedPayload | null;
  loading: boolean;
  secondsSinceRefresh: number;
  nextRefreshIn: number;
  onRefresh: () => void;
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  if (score > 0) return "text-orange-400";
  return "text-red-400";
}

function scoreBarColor(score: number): string {
  if (score >= 80) return "bg-emerald-400";
  if (score >= 50) return "bg-amber-400";
  if (score > 0) return "bg-orange-400";
  return "bg-red-500";
}

function scoreIcon(score: number, size = 12) {
  if (score >= 80) return <ShieldCheck size={size} className="text-emerald-400 shrink-0" />;
  if (score >= 50) return <ShieldAlert size={size} className="text-amber-400 shrink-0" />;
  return <ShieldX size={size} className="text-red-400 shrink-0" />;
}

function overallLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 50) return "Moderate";
  if (score > 0) return "Degraded";
  return "No Data";
}

const GEOPOLITICAL_SOURCES = ["Al Jazeera RSS", "BBC Business RSS", "Guardian Business RSS", "Financial Times RSS"];
const AG_SOURCES = ["AHDB RSS", "Farmers Weekly RSS", "USDA RSS"];
const MACRO_SOURCES = ["Bank of England RSS", "OBR RSS", "MarketWatch RSS"];

function getSourceGroup(src: FeedSource): "geo" | "ag" | "macro" | "price" | "other" {
  if (GEOPOLITICAL_SOURCES.includes(src.source_name)) return "geo";
  if (AG_SOURCES.includes(src.source_name)) return "ag";
  if (MACRO_SOURCES.includes(src.source_name)) return "macro";
  if (src.source_name === "EIA Brent Crude" || src.source_name.includes("FX")) return "price";
  return "other";
}

const GROUP_LABELS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  price: { label: "Price Feeds", color: "text-sky-400", icon: TrendingUp },
  geo: { label: "Geopolitical", color: "text-red-400", icon: Globe },
  ag: { label: "Agricultural", color: "text-amber-400", icon: Zap },
  macro: { label: "Macro / Policy", color: "text-teal-400", icon: Newspaper },
};

function SourceRow({ src }: { src: FeedSource }) {
  const score = src.accuracy_score;
  const age = getAgeMinutes(src.fetch_time_gmt);
  const shortName = src.source_name
    .replace(" RSS", "")
    .replace("ExchangeRate.host ", "FX ")
    .replace("EIA Brent Crude", "EIA Brent");

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 cursor-default group">
            <div
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                backgroundColor: src.success
                  ? score >= 80 ? "#34d399" : score >= 50 ? "#fbbf24" : "#f97316"
                  : "#f87171",
              }}
            />
            <span className="text-[10px] text-muted-foreground truncate flex-1 group-hover:text-slate-300 transition-colors">
              {shortName}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-12 h-1 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", scoreBarColor(score))}
                  style={{ width: `${score}%` }}
                />
              </div>
              <span className={cn("text-[10px] font-mono w-6 text-right shrink-0", scoreColor(score))}>
                {score > 0 ? `${score}` : "—"}
              </span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-[240px] text-xs space-y-1">
          <p className="font-semibold">{src.source_name}</p>
          {src.success ? (
            <>
              <p>Accuracy: <span className={scoreColor(score)}>{score}%</span></p>
              <p>Data age: {formatAgeLabel(age)}</p>
              {src.note && <p className="text-muted-foreground">{src.note}</p>}
            </>
          ) : (
            <p className="text-red-400">Failed: {src.error ?? "unknown error"}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const signalLegend = [
  {
    signal: "URGENT",
    color: "text-red-300",
    bg: "bg-red-500/10 border-red-500/30",
    dot: "bg-red-400",
    desc: "Immediate action required. Delay costs money. Act before stated deadline.",
  },
  {
    signal: "BUY",
    color: "text-emerald-300",
    bg: "bg-emerald-500/10 border-emerald-500/30",
    dot: "bg-emerald-400",
    desc: "Favourable entry. Evidence suggests prices rise within 24–72h.",
  },
  {
    signal: "WATCH",
    color: "text-amber-300",
    bg: "bg-amber-500/10 border-amber-500/30",
    dot: "bg-amber-400",
    desc: "Elevated volatility. Decision trigger likely within 48h.",
  },
  {
    signal: "HOLD",
    color: "text-slate-300",
    bg: "bg-slate-700/30 border-slate-600/30",
    dot: "bg-slate-400",
    desc: "No imminent driver. Maintain current strategy.",
  },
] as const;

export default function IntelSidebar({
  feeds,
  loading,
  secondsSinceRefresh,
  nextRefreshIn,
  onRefresh,
}: IntelSidebarProps) {
  const overallScore = feeds?.overall_accuracy_score ?? 0;
  const sourcesOk = feeds?.sources_ok ?? 0;
  const sourcesTotal = feeds?.sources_total ?? 0;

  const ageLabel =
    secondsSinceRefresh < 10
      ? "just now"
      : secondsSinceRefresh < 60
      ? `${secondsSinceRefresh}s ago`
      : formatAgeLabel(Math.floor(secondsSinceRefresh / 60));

  const grouped: Record<string, FeedSource[]> = { price: [], geo: [], ag: [], macro: [], other: [] };
  if (feeds) {
    for (const src of feeds.sources) {
      const g = getSourceGroup(src);
      grouped[g].push(src);
    }
  }

  const failedSources = feeds?.sources.filter(s => !s.success) ?? [];
  const criticalFailed = failedSources.filter(s =>
    ["EIA Brent Crude", "ExchangeRate.host FX", "Al Jazeera RSS", "BBC Business RSS"].includes(s.source_name)
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

      {/* ── Col 1: Intelligence Accuracy ── */}
      <Card className="bg-slate-900/60 border-slate-700/50 overflow-hidden">
        <CardHeader className="px-3 pt-3 pb-0 space-y-0">
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5 min-w-0">
              {scoreIcon(overallScore, 13)}
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-slate-200 leading-tight">
                  Intelligence Accuracy
                </p>
                <p className={cn("text-[10px] font-mono font-semibold", scoreColor(overallScore))}>
                  {overallScore > 0 ? `${overallScore}%` : "—"}
                  {overallScore > 0 && (
                    <span className="text-muted-foreground font-normal ml-1">
                      · {overallLabel(overallScore)}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {!loading && (
                <div className="flex items-center gap-0.5 text-[9px] text-muted-foreground/50">
                  <Clock size={9} />
                  <span className="font-mono">{formatCountdown(Math.floor(nextRefreshIn))}</span>
                </div>
              )}
              <button
                onClick={onRefresh}
                disabled={loading}
                className="text-muted-foreground hover:text-slate-300 transition-colors disabled:opacity-40"
                title="Refresh all data sources"
              >
                <RefreshCw size={12} className={cn(loading && "animate-spin")} />
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-3 py-3 space-y-2.5">
          {feeds && (
            <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", scoreBarColor(overallScore))}
                style={{ width: `${overallScore}%` }}
              />
            </div>
          )}

          {feeds && (
            <div className="space-y-2.5">
              {(Object.keys(GROUP_LABELS) as (keyof typeof GROUP_LABELS)[]).map(groupKey => {
                const sources = grouped[groupKey];
                if (!sources || sources.length === 0) return null;
                const { label, color, icon: Icon } = GROUP_LABELS[groupKey];
                return (
                  <div key={groupKey}>
                    <div className="flex items-center gap-1 mb-1">
                      <Icon size={9} className={color} />
                      <span className={cn("text-[9px] font-semibold tracking-wider uppercase", color)}>{label}</span>
                    </div>
                    <div className="space-y-0.5 pl-1.5">
                      {sources.map(src => (
                        <SourceRow key={src.source_name} src={src} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {criticalFailed.length > 0 && (
            <div className="bg-red-950/30 border border-red-500/20 rounded-md px-2 py-1.5">
              <div className="flex items-center gap-1 mb-0.5">
                <AlertTriangle size={9} className="text-red-400" />
                <span className="text-[9px] font-bold text-red-400 tracking-wider uppercase">Source Alert</span>
              </div>
              <p className="text-[9px] text-red-300/80 leading-relaxed">
                {criticalFailed.map(s => s.source_name.replace(" RSS", "")).join(", ")} — critical feed{criticalFailed.length > 1 ? "s" : ""} offline.
              </p>
            </div>
          )}

          {feeds && (
            <div className="text-[9px] text-muted-foreground/40 pt-1 border-t border-border/30">
              Fetched {ageLabel} · Auto-refreshes every 15 min
            </div>
          )}

          {loading && !feeds && (
            <div className="flex items-center gap-2 py-1">
              <RefreshCw size={10} className="animate-spin text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Fetching live sources...</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Col 2: Signal Guide ── */}
      <Card className="bg-card overflow-hidden">
        <CardContent className="px-3 py-3 space-y-1.5">
          <p className="text-[9px] font-bold text-muted-foreground tracking-wider uppercase mb-2">Signal Guide</p>
          {signalLegend.map(s => (
            <TooltipProvider key={s.signal} delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-start gap-1.5 cursor-default group">
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0 mt-[3px]", s.dot)} />
                    <div className="min-w-0">
                      <span className={cn("text-[10px] font-bold tracking-widest block", s.color)}>{s.signal}</span>
                      <p className="text-[9px] text-muted-foreground/60 leading-tight">{s.desc}</p>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-[220px] text-xs">
                  <p className={cn("font-bold mb-0.5", s.color)}>{s.signal}</p>
                  <p className="text-muted-foreground">{s.desc}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </CardContent>
      </Card>

      {/* ── Col 3: The 8-Hour Advantage ── */}
      <Card className="bg-card overflow-hidden">
        <CardContent className="px-3 py-3">
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-2.5">The 8-Hour Advantage</p>
          <div className="space-y-2">
            {[
              { time: "22:00", label: "Monitoring begins", desc: "Asia markets open. Overnight pipeline starts." },
              { time: "02–05:00", label: "Events detected", desc: "Geopolitical signals, price moves, carrier alerts captured." },
              { time: "Pre-mkt", label: "Brief generated", desc: "Signals translated into cited UK procurement actions." },
              { time: "Open", label: "Your analyst starts", desc: "The market has been moving for hours already." },
            ].map(step => (
              <div key={step.time} className="flex gap-2">
                <div className="text-[9px] font-mono text-muted-foreground/50 w-12 shrink-0 pt-0.5 leading-tight">{step.time}</div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-300 leading-tight">{step.label}</p>
                  <p className="text-[9px] text-muted-foreground/60 leading-tight">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <Separator className="my-2.5 bg-border" />

          <p className="text-[9px] text-muted-foreground/70 leading-relaxed">
            <span className="text-sky-400 font-semibold">ClearBid</span> bridges the gap between generic news and £20k/yr Bloomberg terminals — purpose-built for UK SME procurement teams who need cited confidence at 7am.
          </p>
        </CardContent>
      </Card>

    </div>
  );
}
