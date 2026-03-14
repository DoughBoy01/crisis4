import { Activity, Globe, AlertTriangle, Rss, Clock, ArrowRight, Sparkles, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { OvernightStat } from '../types';
import type { DailyBrief } from '@/hooks/useDailyBrief';
import { convertGmtTimeStringToTz, getTzAbbreviation } from '@/lib/timezone';
import { cn } from '@/lib/utils';

interface TopMover {
  label: string;
  cp: number;
  price: string;
  signal: string;
}

interface MorningBriefProps {
  urgentCount: number;
  buyCount: number;
  watchCount: number;
  marketOpenCountdown: string;
  marketOpenTime: string;
  briefGeneratedAt: string | null;
  monitoringStartedAt?: string | null;
  overnightStats: OvernightStat[];
  liveHeadlineCount?: number;
  liveSourcesOk?: number;
  liveSourcesTotal?: number;
  timezone: string;
  topMover?: TopMover | null;
  dailyBrief?: DailyBrief | null;
  briefLoading?: boolean;
  briefGenerating?: boolean;
}

function buildFallbackHeadline(urgentCount: number, buyCount: number, watchCount: number, topMover?: TopMover | null): string {
  const totalSignals = urgentCount + buyCount + watchCount;
  const hasMover = topMover && Math.abs(topMover.cp) >= 0.5;

  if (totalSignals === 0) {
    if (hasMover) {
      const dir = topMover.cp > 0 ? 'up' : 'down';
      const abs = Math.abs(topMover.cp).toFixed(2);
      return `Markets mostly quiet. ${topMover.label} moved ${dir} ${abs}% overnight.`;
    }
    return "Markets flat overnight. No notable moves to act on.";
  }

  const parts: string[] = [];
  if (urgentCount > 0) parts.push(`${urgentCount} urgent signal${urgentCount > 1 ? 's' : ''}`);
  if (buyCount > 0) parts.push(`${buyCount} buy opportunit${buyCount > 1 ? 'ies' : 'y'}`);
  if (watchCount > 0) parts.push(`${watchCount} market${watchCount > 1 ? 's' : ''} to watch`);

  let base: string;
  if (parts.length === 1) {
    base = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  } else {
    const last = parts.pop()!;
    base = (parts.join(', ') + ' and ' + last);
    base = base.charAt(0).toUpperCase() + base.slice(1);
  }

  if (hasMover) {
    const dir = topMover.cp > 0 ? 'up' : 'down';
    const abs = Math.abs(topMover.cp).toFixed(2);
    return `${base}. Biggest move: ${topMover.label} ${dir} ${abs}%.`;
  }

  return `${base}.`;
}

export default function MorningBrief({
  urgentCount,
  buyCount,
  watchCount,
  marketOpenCountdown,
  marketOpenTime,
  briefGeneratedAt,
  overnightStats,
  liveHeadlineCount,
  liveSourcesOk,
  liveSourcesTotal,
  timezone,
  topMover,
  dailyBrief,
  briefLoading,
  briefGenerating,
}: MorningBriefProps) {
  const tzAbbr = getTzAbbreviation(timezone);
  const localBriefGenerated = briefGeneratedAt ? convertGmtTimeStringToTz(briefGeneratedAt, timezone) : null;
  const localMarketOpen = convertGmtTimeStringToTz(marketOpenTime, timezone);
  const isMarketOpen = marketOpenCountdown === 'Open';
  const isClosedPermanent = marketOpenCountdown.startsWith('Mon') || marketOpenCountdown.startsWith('Tomorrow');

  const todayLong = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: timezone,
  });

  const hasUrgent = urgentCount > 0;
  const aiNarrative = dailyBrief?.narrative;
  const threeThings = dailyBrief?.three_things ?? [];
  const geopolitical = dailyBrief?.geopolitical_context;
  const fallbackHeadline = buildFallbackHeadline(urgentCount, buyCount, watchCount, topMover);
  const isGenerating = briefGenerating;
  const hasAI = !!aiNarrative && aiNarrative.length > 10;

  return (
    <div className={cn(
      'relative overflow-hidden rounded-xl border',
      hasUrgent
        ? 'border-red-500/30 bg-gradient-to-br from-red-950/20 via-slate-800/80 to-slate-900/90'
        : 'border-slate-700/60 bg-gradient-to-br from-slate-800/80 via-slate-800/60 to-slate-900/90'
    )}>
      <div className={cn(
        'absolute top-0 left-0 right-0 h-px',
        hasUrgent ? 'bg-gradient-to-r from-red-500/60 via-red-400/30 to-transparent' : 'bg-gradient-to-r from-sky-500/40 via-sky-400/20 to-transparent'
      )} />

      <div className="relative px-5 pt-5 pb-5">

        {/* Date + live badge row */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] sm:text-[11px] font-bold text-muted-foreground/50 tracking-widest uppercase">
              {todayLong}
            </span>
            <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-mono gap-1 py-0">
              <Activity size={7} />
              LIVE
            </Badge>
          </div>

          <div className={cn(
            'shrink-0 flex items-center gap-2 rounded-lg border px-2.5 sm:px-3 py-1.5',
            isMarketOpen
              ? 'bg-emerald-950/40 border-emerald-500/30'
              : 'bg-slate-900/60 border-border/60'
          )}>
            <Clock size={10} className={isMarketOpen ? 'text-emerald-400' : 'text-muted-foreground/60'} />
            <div>
              <div className={cn(
                'text-sm sm:text-base font-bold font-mono leading-none',
                isMarketOpen ? 'text-emerald-400' : 'text-slate-200'
              )}>
                {isMarketOpen ? 'Open' : marketOpenCountdown}
              </div>
              <div className="text-[9px] text-muted-foreground/50 leading-none mt-0.5">
                {isMarketOpen
                  ? 'Trading now'
                  : isClosedPermanent
                    ? `Next open ${localMarketOpen} ${tzAbbr}`
                    : `Opens ${localMarketOpen} ${tzAbbr}`}
              </div>
            </div>
          </div>
        </div>

        {/* Main narrative / headline */}
        <div className="mb-4">
          {isGenerating ? (
            <div className="flex items-center gap-2.5 mb-2">
              <Loader2 size={14} className="text-sky-400 animate-spin shrink-0" />
              <span className="text-sm text-muted-foreground/60 italic">Generating overnight brief...</span>
            </div>
          ) : hasAI ? (
            <div className="space-y-2.5">
              <div className="flex items-start gap-2">
                <Sparkles size={13} className="text-sky-400 shrink-0 mt-1" />
                <p className={cn(
                  'text-base sm:text-lg font-semibold leading-snug',
                  hasUrgent ? 'text-red-100' : 'text-slate-100'
                )}>
                  {aiNarrative}
                </p>
              </div>
              {geopolitical && (
                <p className="text-sm text-slate-400 leading-relaxed pl-5 border-l border-border/40">
                  {geopolitical}
                </p>
              )}
            </div>
          ) : (
            <h1 className={cn(
              'text-xl sm:text-2xl font-bold leading-tight tracking-tight',
              hasUrgent ? 'text-red-100' : 'text-slate-100'
            )}>
              {fallbackHeadline}
            </h1>
          )}

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {localBriefGenerated && (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
                <Globe size={9} />
                <span>Brief ready at {localBriefGenerated}</span>
              </div>
            )}
            {hasAI && dailyBrief?.model && dailyBrief.model !== 'none' && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <div className="flex items-center gap-1 text-[10px] text-sky-500/50">
                  <Sparkles size={8} />
                  <span>AI analysis · {dailyBrief.model}</span>
                </div>
              </>
            )}
            {liveSourcesOk !== undefined && liveSourcesTotal !== undefined && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <div className="flex items-center gap-1 text-[10px]">
                  <Rss size={9} className={liveSourcesOk === liveSourcesTotal ? 'text-emerald-500/60' : 'text-amber-500/60'} />
                  <span className={liveSourcesOk === liveSourcesTotal ? 'text-emerald-500/60' : 'text-amber-500/60'}>
                    {liveSourcesOk}/{liveSourcesTotal} sources live
                  </span>
                </div>
              </>
            )}
            {liveHeadlineCount !== undefined && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span className="text-[10px] text-muted-foreground/50">{liveHeadlineCount} headlines scanned</span>
              </>
            )}
          </div>
        </div>

        {/* Three things that matter today */}
        {threeThings.length > 0 && (
          <div className="mb-4 bg-slate-900/50 rounded-lg border border-border/40 px-3.5 py-3 space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground/50 tracking-widest uppercase">3 things that matter today</p>
            {threeThings.map((thing, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="text-[10px] font-bold text-sky-500/70 font-mono mt-0.5 shrink-0">{i + 1}</span>
                <p className="text-sm text-slate-300 leading-snug">{thing}</p>
              </div>
            ))}
          </div>
        )}

        {/* Signal chips */}
        {(urgentCount > 0 || buyCount > 0 || watchCount > 0) && (
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <ArrowRight size={10} className="text-muted-foreground/40" />
            {urgentCount > 0 && (
              <Badge variant="outline" className="bg-red-500/20 text-red-300 border-red-500/40 font-bold tracking-widest gap-1.5 animate-pulse text-[10px]">
                <AlertTriangle size={9} />
                {urgentCount} URGENT
              </Badge>
            )}
            {buyCount > 0 && (
              <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold tracking-widest gap-1.5 text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {buyCount} BUY NOW
              </Badge>
            )}
            {watchCount > 0 && (
              <Badge variant="outline" className="bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold tracking-widest gap-1.5 text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                {watchCount} WATCH
              </Badge>
            )}
          </div>
        )}

        <Separator className="mb-4 bg-border/30" />

        {/* KPI grid */}
        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 gap-2">
          {overnightStats.map(stat => (
            <div
              key={stat.label}
              className={cn(
                'rounded-lg px-2.5 py-2.5 border',
                stat.highlight
                  ? 'bg-red-950/30 border-red-500/25'
                  : 'bg-slate-900/50 border-border/50'
              )}
            >
              <div className={cn(
                'text-lg font-bold font-mono leading-none',
                stat.highlight ? 'text-red-400' : 'text-slate-100'
              )}>
                {stat.value}
              </div>
              <div className="text-[10px] text-muted-foreground/60 leading-tight mt-1">{stat.label}</div>
              {stat.sub && (
                <div className="text-[10px] text-muted-foreground/40 leading-tight">{stat.sub}</div>
              )}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
