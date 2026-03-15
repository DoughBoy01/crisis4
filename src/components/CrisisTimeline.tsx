import { useState } from 'react';
import { Clock, TrendingUp, TrendingDown, AlertTriangle, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import type { FeedPayload } from '@/hooks/useMarketFeeds';
import type { ConflictZone } from '@/types';
import { cn } from '@/lib/utils';

interface TimelineEvent {
  id: string;
  time: string;
  title: string;
  source: string;
  link: string;
  marketImpact: {
    market: string;
    direction: 'up' | 'down' | 'neutral';
    magnitude: 'high' | 'medium' | 'low';
    note: string;
  }[];
  severity: 'critical' | 'high' | 'medium';
  zone?: string;
}

function buildTimeline(feeds: FeedPayload | null, zones: ConflictZone[]): TimelineEvent[] {
  if (!feeds) return [];

  const crisisKeywords = [
    'attack', 'strike', 'explosion', 'killed', 'war', 'sanctions', 'blockade', 'seized',
    'conflict', 'invasion', 'escalation', 'ceasefire', 'houthi', 'iran', 'ukraine', 'missile',
    'tanker', 'hormuz', 'red sea', 'opec', 'supply cut', 'pipeline', 'shortage',
  ];

  const marketKeywordsMap: Record<string, { markets: string[]; direction: 'up' | 'down' | 'neutral'; magnitude: 'high' | 'medium' | 'low' }> = {
    'oil': { markets: ['Brent Crude', 'WTI'], direction: 'up', magnitude: 'high' },
    'crude': { markets: ['Brent Crude', 'WTI'], direction: 'up', magnitude: 'high' },
    'brent': { markets: ['Brent Crude'], direction: 'up', magnitude: 'high' },
    'tanker': { markets: ['Brent Crude', 'Freight'], direction: 'up', magnitude: 'high' },
    'hormuz': { markets: ['Brent Crude', 'LNG'], direction: 'up', magnitude: 'high' },
    'red sea': { markets: ['Container Freight', 'Brent Crude'], direction: 'up', magnitude: 'high' },
    'houthi': { markets: ['Container Freight', 'War Risk'], direction: 'up', magnitude: 'high' },
    'suez': { markets: ['Container Freight'], direction: 'up', magnitude: 'high' },
    'pipeline': { markets: ['Natural Gas', 'Brent Crude'], direction: 'up', magnitude: 'medium' },
    'gas': { markets: ['Natural Gas'], direction: 'up', magnitude: 'medium' },
    'lng': { markets: ['Natural Gas', 'LNG'], direction: 'up', magnitude: 'medium' },
    'grain': { markets: ['Wheat', 'Corn'], direction: 'up', magnitude: 'medium' },
    'wheat': { markets: ['Wheat'], direction: 'up', magnitude: 'high' },
    'ukraine': { markets: ['Wheat', 'Corn', 'Natural Gas'], direction: 'up', magnitude: 'medium' },
    'russia': { markets: ['Natural Gas', 'Wheat', 'Fertilizer'], direction: 'up', magnitude: 'medium' },
    'sanctions': { markets: ['Natural Gas', 'Oil', 'Fertilizer'], direction: 'up', magnitude: 'high' },
    'opec': { markets: ['Brent Crude', 'WTI'], direction: 'up', magnitude: 'high' },
    'supply cut': { markets: ['Brent Crude'], direction: 'up', magnitude: 'high' },
    'ceasefire': { markets: ['Brent Crude', 'Gold'], direction: 'down', magnitude: 'medium' },
    'deal': { markets: ['Brent Crude'], direction: 'down', magnitude: 'low' },
    'sterling': { markets: ['GBP/USD'], direction: 'down', magnitude: 'low' },
    'dollar': { markets: ['USD Index'], direction: 'up', magnitude: 'low' },
    'shipping': { markets: ['Container Freight'], direction: 'up', magnitude: 'low' },
    'freight': { markets: ['Container Freight', 'Baltic Dry'], direction: 'up', magnitude: 'low' },
  };

  const crisisSources = [
    'Reuters World RSS', 'Al Jazeera RSS', 'BBC Business RSS', 'ReliefWeb Conflict RSS',
    'Rigzone RSS', 'Shipping RSS', 'Freight Rates RSS', 'Guardian Business RSS',
  ];

  const allItems: { title: string; summary: string; published: string; link: string; source: string }[] = [];
  for (const srcName of crisisSources) {
    const src = feeds.sources.find(s => s.source_name === srcName);
    if (!src?.items?.length) continue;
    for (const item of src.items) {
      allItems.push({ ...item, source: srcName.replace(' RSS', '') });
    }
  }

  const filtered = allItems.filter(item => {
    const text = (item.title + ' ' + (item.summary ?? '')).toLowerCase();
    return crisisKeywords.some(k => text.includes(k));
  });

  const seen = new Set<string>();
  const unique = filtered.filter(item => {
    const key = item.title.slice(0, 60).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const sorted = unique.sort((a, b) => {
    const ta = a.published ? new Date(a.published).getTime() : 0;
    const tb = b.published ? new Date(b.published).getTime() : 0;
    return tb - ta;
  }).slice(0, 10);

  return sorted.map((item, idx) => {
    const text = (item.title + ' ' + (item.summary ?? '')).toLowerCase();

    const criticalTerms = ['war', 'attack', 'explosion', 'killed', 'missile', 'blockade', 'seized', 'sanctions'];
    const highTerms = ['surge', 'spike', 'shortage', 'crisis', 'ban', 'tariff', 'cut', 'drought', 'opec'];
    const severity: 'critical' | 'high' | 'medium' = criticalTerms.some(t => text.includes(t))
      ? 'critical'
      : highTerms.some(t => text.includes(t))
        ? 'high'
        : 'medium';

    const marketImpacts: TimelineEvent['marketImpact'] = [];
    const addedMarkets = new Set<string>();

    for (const [kw, config] of Object.entries(marketKeywordsMap)) {
      if (!text.includes(kw)) continue;
      for (const market of config.markets) {
        if (addedMarkets.has(market)) continue;
        addedMarkets.add(market);
        marketImpacts.push({
          market,
          direction: config.direction,
          magnitude: config.magnitude,
          note: `Keyword: "${kw}" detected`,
        });
      }
      if (marketImpacts.length >= 3) break;
    }

    const zoneMatch = zones.find(z =>
      z.affectedCommodities.some(c => addedMarkets.has(c))
    );

    const pubDate = item.published ? new Date(item.published) : null;
    const timeStr = pubDate
      ? pubDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' GMT'
      : 'Recent';

    return {
      id: `event-${idx}`,
      time: timeStr,
      title: item.title,
      source: item.source,
      link: item.link,
      marketImpact: marketImpacts,
      severity,
      zone: zoneMatch?.region,
    };
  });
}

const SEVERITY_CONFIG = {
  critical: { dot: 'bg-red-500 animate-pulse', line: 'border-red-500/30', badge: 'text-red-400', text: 'text-red-100' },
  high: { dot: 'bg-amber-500', line: 'border-amber-500/30', badge: 'text-amber-400', text: 'text-slate-100' },
  medium: { dot: 'bg-sky-500/70', line: 'border-border/30', badge: 'text-sky-400', text: 'text-slate-200' },
};

const MAGNITUDE_CONFIG = {
  high: 'font-bold',
  medium: 'font-medium',
  low: 'font-normal opacity-70',
};

interface CrisisTimelineProps {
  feeds: FeedPayload | null;
  conflictZones: ConflictZone[];
  loading: boolean;
}

export default function CrisisTimeline({ feeds, conflictZones, loading }: CrisisTimelineProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const events = buildTimeline(feeds, conflictZones);

  const criticalCount = events.filter(e => e.severity === 'critical').length;
  const highCount = events.filter(e => e.severity === 'high').length;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Clock size={12} className="text-red-400/70" />
        <span className="text-xs font-bold text-slate-300 tracking-wider uppercase">Crisis Timeline</span>
        <div className="ml-auto flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="text-[10px] font-bold text-red-400 flex items-center gap-1 animate-pulse">
              <AlertTriangle size={8} />
              {criticalCount} critical
            </span>
          )}
          {highCount > 0 && (
            <span className="text-[10px] font-bold text-amber-400">{highCount} high</span>
          )}
        </div>
      </div>

      {loading && events.length === 0 ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3">
              <div className="w-2 h-2 rounded-full bg-slate-700 mt-1.5 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-slate-700/50 rounded w-3/4" />
                <div className="h-2 bg-slate-700/30 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="text-[11px] text-muted-foreground/50 text-center py-4">No crisis events detected in current feeds.</p>
      ) : (
        <div className="relative">
          <div className="absolute left-[5px] top-2 bottom-2 w-px bg-border/30" />
          <div className="space-y-3 pl-5">
            {events.map(event => {
              const cfg = SEVERITY_CONFIG[event.severity];
              const isOpen = expanded === event.id;
              return (
                <div key={event.id} className="relative">
                  <div className={cn('absolute -left-[19px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-background', cfg.dot)} />
                  <button
                    className="w-full text-left group"
                    onClick={() => setExpanded(isOpen ? null : event.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <span className="text-[9px] font-mono text-muted-foreground/40">{event.time}</span>
                          <span className={cn('text-[9px] font-bold tracking-widest uppercase', cfg.badge)}>
                            {event.severity}
                          </span>
                          {event.zone && (
                            <span className="text-[9px] text-muted-foreground/40">{event.zone}</span>
                          )}
                        </div>
                        <p className={cn('text-[11px] leading-snug line-clamp-2 group-hover:line-clamp-none transition-all', cfg.text)}>
                          {event.title}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 mt-0.5">
                        <span className="text-[9px] text-muted-foreground/40">{event.source}</span>
                        {isOpen ? <ChevronUp size={9} className="text-muted-foreground/40" /> : <ChevronDown size={9} className="text-muted-foreground/40" />}
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="mt-2 pl-0 space-y-2">
                      {event.marketImpact.length > 0 && (
                        <div className="rounded-md bg-slate-900/60 border border-border/30 p-2.5">
                          <p className="text-[9px] font-bold text-muted-foreground/50 tracking-widest uppercase mb-1.5">Market Attribution</p>
                          <div className="space-y-1">
                            {event.marketImpact.map((impact, i) => (
                              <div key={i} className="flex items-center gap-2">
                                {impact.direction === 'up' ? (
                                  <TrendingUp size={9} className="text-red-400 shrink-0" />
                                ) : impact.direction === 'down' ? (
                                  <TrendingDown size={9} className="text-emerald-400 shrink-0" />
                                ) : (
                                  <span className="w-2" />
                                )}
                                <span className={cn('text-[11px] text-slate-200', MAGNITUDE_CONFIG[impact.magnitude])}>
                                  {impact.market}
                                </span>
                                <span className="text-[9px] text-muted-foreground/40">
                                  {impact.direction === 'up' ? 'upward pressure' : impact.direction === 'down' ? 'downward pressure' : 'monitoring'}
                                  {impact.magnitude === 'high' ? ' — significant' : ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {event.link && (
                        <a
                          href={event.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-sky-400/70 hover:text-sky-400 transition-colors"
                        >
                          <ExternalLink size={9} />
                          Read full report
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-[9px] text-muted-foreground/30 mt-3 text-right">
        Crisis events from {events.length > 0 ? `${events.length} signals` : 'live feeds'} · Tap event to see market attribution
      </p>
    </div>
  );
}
