import { ShieldCheck, ShieldAlert, ShieldX, RefreshCw, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { FeedPayload, FeedSource } from "@/hooks/useMarketFeeds";
import { formatAgeLabel, formatCountdown, getAgeMinutes } from "@/hooks/useMarketFeeds";

interface DataFreshnessBarProps {
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

interface SourceRowProps {
  src: FeedSource;
}

function SourceRow({ src }: SourceRowProps) {
  const score = src.accuracy_score;
  const age = getAgeMinutes(src.fetch_time_gmt);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 cursor-default">
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{
              backgroundColor: src.success
                ? score >= 80 ? "#34d399" : score >= 50 ? "#fbbf24" : "#f97316"
                : "#f87171"
            }} />
            <span className="text-[10px] text-muted-foreground truncate min-w-0 flex-1">
              {src.source_name.replace(" RSS", "").replace("ExchangeRate.host ", "")}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-16 h-1 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", scoreBarColor(score))}
                  style={{ width: `${score}%` }}
                />
              </div>
              <span className={cn("text-[10px] font-mono w-7 text-right shrink-0", scoreColor(score))}>
                {score > 0 ? `${score}%` : "—"}
              </span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-[260px] text-xs space-y-1">
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

export default function DataFreshnessBar({
  feeds,
  loading,
  secondsSinceRefresh,
  nextRefreshIn,
  onRefresh,
}: DataFreshnessBarProps) {
  const overallScore = feeds?.overall_accuracy_score ?? 0;
  const sourcesOk = feeds?.sources_ok ?? 0;
  const sourcesTotal = feeds?.sources_total ?? 0;

  const ageSeconds = secondsSinceRefresh;
  const ageLabel = ageSeconds < 10
    ? "just now"
    : ageSeconds < 60
    ? `${ageSeconds}s ago`
    : formatAgeLabel(Math.floor(ageSeconds / 60));

  return (
    <Card className="bg-slate-900/60 border-slate-700/50 overflow-hidden">
      <CardContent className="px-4 py-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {scoreIcon(overallScore, 14)}
            <div>
              <p className="text-xs font-bold text-slate-200">
                Intelligence Accuracy
                <span className={cn("ml-2 font-mono", scoreColor(overallScore))}>
                  {overallScore > 0 ? `${overallScore}%` : "—"}
                </span>
                <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                  {overallScore > 0 ? overallLabel(overallScore) : "Fetching..."}
                </span>
              </p>
              <p className="text-[10px] text-muted-foreground">
                {sourcesOk}/{sourcesTotal} sources live
                {feeds && (
                  <span className="ml-2 text-muted-foreground/60">
                    · fetched {ageLabel}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!loading && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                <Clock size={10} />
                <span className="font-mono">{formatCountdown(Math.floor(nextRefreshIn))}</span>
              </div>
            )}
            <button
              onClick={onRefresh}
              disabled={loading}
              className="text-muted-foreground hover:text-slate-300 transition-colors disabled:opacity-40"
              title="Refresh all data sources now"
            >
              <RefreshCw size={13} className={cn(loading && "animate-spin")} />
            </button>
          </div>
        </div>

        {feeds && (
          <>
            <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", scoreBarColor(overallScore))}
                style={{ width: `${overallScore}%` }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
              {feeds.sources.map(src => (
                <SourceRow key={src.source_name} src={src} />
              ))}
            </div>

            <p className="text-[10px] text-muted-foreground/40 leading-relaxed pt-1 border-t border-border/30">
              Accuracy score = recency of data relative to each source's typical update cadence. 100% = fetched within 5 min. Auto-refreshes every 15 min.
            </p>
          </>
        )}

        {loading && !feeds && (
          <div className="flex items-center gap-2 py-1">
            <RefreshCw size={11} className="animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Fetching live intelligence sources...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
