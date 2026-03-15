import { Activity, Globe, AlertTriangle, Rss, Clock, Sparkles, Loader2, TrendingUp, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
  briefLoading: _briefLoading,
  briefGenerating,
}: MorningBriefProps) {
  const tzAbbr = getTzAbbreviation(timezone);
  const localBriefGenerated = briefGeneratedAt ? convertGmtTimeStringToTz(briefGeneratedAt, timezone) : null;
  const localMarketOpen = convertGmtTimeStringToTz(marketOpenTime, timezone);
  const isMarketOpen = marketOpenCountdown === 'Open';
  const isClosedPermanent = marketOpenCountdown.startsWith('Mon') || marketOpenCountdown.startsWith('Tomorrow');

  const todayShort = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: timezone,
  });

  const hasUrgent = urgentCount > 0;
  const aiNarrative = dailyBrief?.narrative;
  const threeThings = dailyBrief?.three_things ?? [];
  const geopolitical = dailyBrief?.geopolitical_context;
  const compoundingRisk = dailyBrief?.compounding_risk;
  const fallbackHeadline = buildFallbackHeadline(urgentCount, buyCount, watchCount, topMover);
  const isGenerating = briefGenerating;
  const hasAI = !!aiNarrative && aiNarrative.length > 10;
  const hasLiveData = (liveSourcesOk ?? 0) > 0;

  return (
    <div className={cn(
      'relative overflow-hidden rounded-xl border',
      hasUrgent
        ? 'border-red-500/30 bg-gradient-to-r from-red-950/30 via-slate-800/70 to-slate-900/80'
        : 'border-slate-700/50 bg-gradient-to-r from-slate-800/70 via-slate-800/50 to-slate-900/80'
    )}>
      {/* Top accent line */}
      <div className={cn(
        'absolute top-0 left-0 right-0 h-px',
        hasUrgent
          ? 'bg-gradient-to-r from-red-500/70 via-red-400/30 to-transparent'
          : 'bg-gradient-to-r from-sky-500/50 via-sky-400/20 to-transparent'
      )} />

      <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-0 divide-y lg:divide-y-0 lg:divide-x divide-border/20">

        {/* ── LEFT: Narrative + three things ── */}
        <div className="px-5 pt-4 pb-4">

          {/* Meta row */}
          <div className="flex items-center gap-2.5 mb-3 flex-wrap">
            <span className="text-[10px] font-bold text-muted-foreground/50 tracking-widest uppercase">{todayShort}</span>
            {hasLiveData ? (
              <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-mono gap-1 py-0 h-4">
                <Activity size={7} />
                LIVE
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[9px] bg-slate-700/30 text-muted-foreground/50 border-slate-600/30 font-mono gap-1 py-0 h-4">
                LOADING
              </Badge>
            )}

            {/* Market status */}
            <div className={cn(
              'flex items-center gap-1.5 rounded-md border px-2 py-0.5',
              isMarketOpen ? 'bg-emerald-950/30 border-emerald-500/25' : 'bg-slate-900/40 border-border/40'
            )}>
              <Clock size={9} className={isMarketOpen ? 'text-emerald-400' : 'text-muted-foreground/50'} />
              <span className={cn(
                'text-[11px] font-bold font-mono',
                isMarketOpen ? 'text-emerald-400' : 'text-slate-300'
              )}>
                {isMarketOpen ? 'Market Open' : marketOpenCountdown}
              </span>
              {!isMarketOpen && (
                <span className="text-[9px] text-muted-foreground/40">
                  {isClosedPermanent ? `opens ${localMarketOpen} ${tzAbbr}` : `opens ${localMarketOpen} ${tzAbbr}`}
                </span>
              )}
            </div>

            {/* Signal chips */}
            {urgentCount > 0 && (
              <Badge variant="outline" className="bg-red-500/20 text-red-300 border-red-500/40 font-bold tracking-widest gap-1 animate-pulse text-[10px] h-5">
                <AlertTriangle size={8} />
                {urgentCount} URGENT
              </Badge>
            )}
            {buyCount > 0 && (
              <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold tracking-widest gap-1 text-[10px] h-5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {buyCount} BUY
              </Badge>
            )}
            {watchCount > 0 && (
              <Badge variant="outline" className="bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold tracking-widest gap-1 text-[10px] h-5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                {watchCount} WATCH
              </Badge>
            )}
          </div>

          {/* Main narrative */}
          {isGenerating ? (
            <div className="flex items-center gap-2 mb-2">
              <Loader2 size={13} className="text-sky-400 animate-spin shrink-0" />
              <span className="text-sm text-muted-foreground/60 italic">Generating overnight brief...</span>
            </div>
          ) : hasAI ? (
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Sparkles size={12} className="text-sky-400 shrink-0 mt-0.5" />
                <p className={cn(
                  'text-sm sm:text-base font-semibold leading-snug',
                  hasUrgent ? 'text-red-100' : 'text-slate-100'
                )}>
                  {aiNarrative}
                </p>
              </div>
              {geopolitical && (
                <p className="text-xs text-slate-400 leading-relaxed pl-[22px] border-l border-border/30">
                  {geopolitical}
                </p>
              )}
              {compoundingRisk && (
                <div className="flex items-start gap-2 mt-2 rounded-lg border border-amber-500/25 bg-amber-950/20 px-3 py-2">
                  <Layers size={11} className="text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-200/80 leading-relaxed font-medium">{compoundingRisk}</p>
                </div>
              )}
            </div>
          ) : (
            <p className={cn(
              'text-sm sm:text-base font-semibold leading-snug',
              hasUrgent ? 'text-red-100' : 'text-slate-100'
            )}>
              {fallbackHeadline}
            </p>
          )}

          {/* Three things */}
          {threeThings.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {threeThings.map((thing, i) => (
                <div key={i} className="flex items-start gap-1.5 bg-slate-900/50 border border-border/30 rounded-lg px-2.5 py-1.5 max-w-xs">
                  <span className="text-[10px] font-bold text-sky-500/80 font-mono shrink-0 mt-0.5">{i + 1}</span>
                  <p className="text-[11px] text-slate-300 leading-snug">{thing}</p>
                </div>
              ))}
            </div>
          )}

          {/* Footer meta */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {localBriefGenerated && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground/40">
                <Globe size={8} />
                <span>Updated {localBriefGenerated}</span>
              </div>
            )}
            {hasAI && dailyBrief?.model && dailyBrief.model !== 'none' && (
              <>
                <span className="text-muted-foreground/25">·</span>
                <div className="flex items-center gap-1 text-[10px] text-sky-500/40">
                  <Sparkles size={7} />
                  <span>DawnSignal Data Scout</span>
                </div>
              </>
            )}
            {liveSourcesOk !== undefined && liveSourcesTotal !== undefined && (
              <>
                <span className="text-muted-foreground/25">·</span>
                <div className="flex items-center gap-1 text-[10px]">
                  <Rss size={8} className={liveSourcesOk === liveSourcesTotal ? 'text-emerald-500/50' : 'text-amber-500/50'} />
                  <span className={liveSourcesOk === liveSourcesTotal ? 'text-emerald-500/50' : 'text-amber-500/50'}>
                    {liveSourcesOk}/{liveSourcesTotal} sources
                  </span>
                </div>
              </>
            )}
            {liveHeadlineCount !== undefined && (
              <>
                <span className="text-muted-foreground/25">·</span>
                <span className="text-[10px] text-muted-foreground/40">{liveHeadlineCount} headlines</span>
              </>
            )}
          </div>
        </div>

        {/* ── RIGHT: KPI stat tiles ── */}
        {overnightStats.length > 0 && (
          <div className="lg:w-72 xl:w-80 px-4 py-4 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 mb-3">
              <TrendingUp size={10} className="text-muted-foreground/40" />
              <span className="text-[10px] font-bold text-muted-foreground/40 tracking-widest uppercase">Overnight Stats</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2">
              {overnightStats.map(stat => (
                <div
                  key={stat.label}
                  className={cn(
                    'rounded-lg px-2.5 py-2.5 border flex flex-col',
                    stat.highlight
                      ? 'bg-red-950/40 border-red-500/30'
                      : 'bg-slate-900/60 border-border/40'
                  )}
                >
                  <div className={cn(
                    'text-lg font-bold font-mono leading-none',
                    stat.highlight ? 'text-red-300' : 'text-slate-100'
                  )}>
                    {stat.value}
                  </div>
                  <div className="text-[10px] text-muted-foreground/55 leading-tight mt-1">{stat.label}</div>
                  {stat.sub && (
                    <div className="text-[9px] text-muted-foreground/35 leading-tight">{stat.sub}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
