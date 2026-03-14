import { TrendingUp, TrendingDown, Activity, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatAgeLabel, getAgeMinutes } from "@/hooks/useMarketFeeds";
import type { FeedSource } from "@/hooks/useMarketFeeds";

interface LivePriceBannerProps {
  brentSrc: FeedSource | null;
  fxSrc: FeedSource | null;
  loading: boolean;
}

function PriceCell({
  label,
  value,
  change,
  positive,
  accuracyScore,
  ageMinutes,
  note,
  live,
}: {
  label: string;
  value: string;
  change?: string;
  positive?: boolean;
  accuracyScore: number;
  ageMinutes: number | null;
  note?: string;
  live: boolean;
}) {
  const scoreColor = accuracyScore >= 80
    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
    : accuracyScore >= 50
    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
    : "bg-slate-500/10 text-slate-500 border-slate-500/20";

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 cursor-default">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-sm font-bold font-mono text-foreground">{value}</span>
            {change !== undefined && (
              <span className={cn("flex items-center gap-0.5 text-xs font-semibold", positive ? "text-emerald-400" : "text-red-400")}>
                {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {change}
              </span>
            )}
            <Badge variant="outline" className={cn("text-[9px] px-1 py-0", scoreColor)}>
              {live ? `${accuracyScore}%` : "N/A"}
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[220px] text-xs space-y-1">
          <p className="font-semibold">{label}</p>
          {live ? (
            <>
              <p>Accuracy: <span className={accuracyScore >= 80 ? "text-emerald-400" : "text-amber-400"}>{accuracyScore}%</span></p>
              <p>Data age: {formatAgeLabel(ageMinutes)}</p>
              {note && <p className="text-muted-foreground">{note}</p>}
            </>
          ) : (
            <p className="text-red-400">No live data — API key required</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function LivePriceBanner({ brentSrc, fxSrc, loading }: LivePriceBannerProps) {
  const hasBrent = !!brentSrc;
  const hasFx = !!fxSrc;
  const anyLive = hasBrent || hasFx;
  const anyMissing = !hasBrent || !hasFx;

  if (loading && !anyLive) {
    return (
      <Card className="border-slate-700/40 bg-slate-900/40">
        <CardContent className="px-4 py-3">
          <div className="flex items-center gap-2">
            <Activity size={12} className="text-muted-foreground animate-pulse" />
            <span className="text-xs text-muted-foreground">Fetching live prices...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "overflow-hidden",
      anyLive ? "border-sky-500/20 bg-slate-900/60" : "border-slate-700/40 bg-slate-900/30"
    )}>
      <CardContent className="px-4 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 shrink-0">
            <Activity size={12} className={anyLive ? "text-sky-400" : "text-muted-foreground"} />
            <span className={cn("text-xs font-bold tracking-wider uppercase", anyLive ? "text-sky-400" : "text-muted-foreground")}>
              {anyLive ? "Live Data" : "Awaiting Live Data"}
            </span>
          </div>

          {anyLive && <Separator orientation="vertical" className="h-4 bg-border hidden sm:block" />}

          <div className="flex items-center gap-4 flex-wrap">
            {hasBrent && brentSrc.current_price && (
              <PriceCell
                label="Brent Crude"
                value={`$${brentSrc.current_price.toFixed(2)}/bbl`}
                change={brentSrc.change_pct !== undefined
                  ? `${brentSrc.change_pct >= 0 ? "+" : ""}${brentSrc.change_pct.toFixed(2)}%`
                  : undefined}
                positive={(brentSrc.change_pct ?? 0) >= 0}
                accuracyScore={brentSrc.accuracy_score}
                ageMinutes={getAgeMinutes(brentSrc.fetch_time_gmt)}
                note={brentSrc.note}
                live={true}
              />
            )}

            {hasFx && fxSrc.gbp_usd && (
              <PriceCell
                label="GBP/USD"
                value={fxSrc.gbp_usd.toFixed(4)}
                accuracyScore={fxSrc.accuracy_score}
                ageMinutes={getAgeMinutes(fxSrc.fetch_time_gmt)}
                note={fxSrc.note}
                live={true}
              />
            )}

            {hasFx && fxSrc.gbp_eur && (
              <PriceCell
                label="GBP/EUR"
                value={fxSrc.gbp_eur.toFixed(4)}
                accuracyScore={fxSrc.accuracy_score}
                ageMinutes={getAgeMinutes(fxSrc.fetch_time_gmt)}
                note={fxSrc.note}
                live={true}
              />
            )}

            {!hasBrent && (
              <div className="flex items-center gap-1.5 text-xs text-amber-400/70">
                <AlertTriangle size={11} />
                <span>EIA API key not configured — Brent spot price unavailable</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
