import { Ship, AlertTriangle, CheckCircle2, Clock, ArrowUpRight } from 'lucide-react';
import type { FeedPayload } from '@/hooks/useMarketFeeds';
import type { ConflictZone } from '@/types';
import { cn } from '@/lib/utils';

type RAGStatus = 'RED' | 'AMBER' | 'GREEN';

interface LaneStatus {
  id: string;
  name: string;
  region: string;
  status: RAGStatus;
  statusLabel: string;
  impact: string;
  freightImpact: string;
  latestSignal: string;
  source: string;
}

function scoreRedSea(zones: ConflictZone[], feeds: FeedPayload | null): LaneStatus {
  const zone = zones.find(z => z.id === 'red-sea-yemen');
  const shippingItems = feeds?.sources.find(s => s.source_name === 'Shipping RSS')?.items ?? [];
  const freightItems = feeds?.sources.find(s => s.source_name === 'Freight Rates RSS')?.items ?? [];
  const allItems = [...shippingItems, ...freightItems];
  const redSeaKeywords = ['red sea', 'houthi', 'suez', 'bab-el-mandeb', 'divert', 'reroute', 'cape of good hope'];
  const activeSignals = allItems.filter(i =>
    redSeaKeywords.some(k => (i.title + ' ' + (i.summary ?? '')).toLowerCase().includes(k))
  );

  if (zone?.riskLevel === 'CRITICAL' || activeSignals.length >= 3) {
    return {
      id: 'red-sea',
      name: 'Red Sea / Suez',
      region: 'Bab-el-Mandeb · Suez Canal',
      status: 'RED',
      statusLabel: 'ACTIVE DISRUPTION',
      impact: 'Asia–Europe container routes diverted via Cape of Good Hope',
      freightImpact: '+10–14 days transit · +20–30% freight cost',
      latestSignal: activeSignals[0]?.title ?? zone?.latestHeadline ?? 'Houthi activity ongoing — multiple carrier diversions confirmed',
      source: activeSignals[0] ? 'Live feed' : zone?.headlineSource ?? 'Intelligence',
    };
  }
  if (zone?.riskLevel === 'HIGH' || activeSignals.length >= 1) {
    return {
      id: 'red-sea',
      name: 'Red Sea / Suez',
      region: 'Bab-el-Mandeb · Suez Canal',
      status: 'AMBER',
      statusLabel: 'ELEVATED RISK',
      impact: 'Some carriers avoiding — monitor for escalation',
      freightImpact: 'War-risk surcharges active on most Asia–Europe routes',
      latestSignal: activeSignals[0]?.title ?? zone?.latestHeadline ?? 'Risk elevated — monitor carrier advisories',
      source: activeSignals[0] ? 'Live feed' : zone?.headlineSource ?? 'Intelligence',
    };
  }
  return {
    id: 'red-sea',
    name: 'Red Sea / Suez',
    region: 'Bab-el-Mandeb · Suez Canal',
    status: 'GREEN',
    statusLabel: 'NORMAL OPERATIONS',
    impact: 'No active disruption signals',
    freightImpact: 'Standard war-risk premiums apply',
    latestSignal: 'No new escalation detected overnight',
    source: 'Live feed monitoring',
  };
}

function scoreHormuz(zones: ConflictZone[], feeds: FeedPayload | null): LaneStatus {
  const zone = zones.find(z => z.id === 'middle-east-gulf' || z.id === 'israel-gaza');
  const newsItems = [
    ...(feeds?.sources.find(s => s.source_name === 'Al Jazeera RSS')?.items ?? []),
    ...(feeds?.sources.find(s => s.source_name === 'Reuters World RSS')?.items ?? []),
    ...(feeds?.sources.find(s => s.source_name === 'Rigzone RSS')?.items ?? []),
  ];
  const hormuzKeywords = ['hormuz', 'iran', 'persian gulf', 'tanker', 'strait', 'seized'];
  const signals = newsItems.filter(i =>
    hormuzKeywords.some(k => (i.title + ' ' + (i.summary ?? '')).toLowerCase().includes(k))
  );
  const brentPct = feeds?.sources.find(s => s.source_name === 'Yahoo Finance')?.quotes?.find(q => q.symbol === 'BZ=F')?.changePercent ?? 0;

  if (signals.length >= 2 || brentPct >= 3) {
    return {
      id: 'hormuz',
      name: 'Strait of Hormuz',
      region: 'Persian Gulf · Iran',
      status: 'RED',
      statusLabel: 'HIGH TENSION',
      impact: '~20% of global oil transits this strait — supply risk elevated',
      freightImpact: 'Brent risk premium active · VLCC insurance costs rising',
      latestSignal: signals[0]?.title ?? zone?.latestHeadline ?? 'Iranian tensions elevated',
      source: signals[0] ? 'Live feed' : 'Intelligence',
    };
  }
  if (zone?.riskLevel === 'HIGH' || zone?.riskLevel === 'ELEVATED' || signals.length >= 1) {
    return {
      id: 'hormuz',
      name: 'Strait of Hormuz',
      region: 'Persian Gulf · Iran',
      status: 'AMBER',
      statusLabel: 'MONITORED',
      impact: 'Regional tensions monitored — no closure signals',
      freightImpact: 'Insurance premiums elevated for Persian Gulf voyages',
      latestSignal: signals[0]?.title ?? zone?.latestHeadline ?? 'Situation monitored — no immediate threat to transit',
      source: signals[0] ? 'Live feed' : 'Intelligence',
    };
  }
  return {
    id: 'hormuz',
    name: 'Strait of Hormuz',
    region: 'Persian Gulf · Iran',
    status: 'GREEN',
    statusLabel: 'OPEN',
    impact: 'Normal tanker transit — no closure risk signals',
    freightImpact: 'Standard premiums apply',
    latestSignal: 'No new incident reports overnight',
    source: 'Live feed monitoring',
  };
}

function scoreBlackSea(zones: ConflictZone[], feeds: FeedPayload | null): LaneStatus {
  const zone = zones.find(z => z.id === 'ukraine-russia');
  const newsItems = [
    ...(feeds?.sources.find(s => s.source_name === 'Reuters World RSS')?.items ?? []),
    ...(feeds?.sources.find(s => s.source_name === 'World Grain RSS')?.items ?? []),
  ];
  const keywords = ['black sea', 'ukraine', 'odessa', 'grain corridor', 'port', 'kherson'];
  const signals = newsItems.filter(i =>
    keywords.some(k => (i.title + ' ' + (i.summary ?? '')).toLowerCase().includes(k))
  );

  if (signals.length >= 2 || zone?.riskLevel === 'CRITICAL') {
    return {
      id: 'black-sea',
      name: 'Black Sea / Odessa',
      region: 'Ukraine · Grain Corridor',
      status: 'RED',
      statusLabel: 'DISRUPTED',
      impact: 'Ukrainian grain export capacity severely constrained',
      freightImpact: 'War-risk insurance prohibitive for most voyages',
      latestSignal: signals[0]?.title ?? zone?.latestHeadline ?? 'Active conflict restricting port access',
      source: signals[0] ? 'Live feed' : 'Intelligence',
    };
  }
  if (zone?.riskLevel === 'HIGH') {
    return {
      id: 'black-sea',
      name: 'Black Sea / Odessa',
      region: 'Ukraine · Grain Corridor',
      status: 'AMBER',
      statusLabel: 'CONSTRAINED',
      impact: 'Partial grain corridor operations — subject to disruption',
      freightImpact: 'Elevated war-risk premiums — limited carrier availability',
      latestSignal: signals[0]?.title ?? zone?.latestHeadline ?? 'Conflict ongoing — corridor operating at reduced capacity',
      source: signals[0] ? 'Live feed' : 'Intelligence',
    };
  }
  return {
    id: 'black-sea',
    name: 'Black Sea / Odessa',
    region: 'Ukraine · Grain Corridor',
    status: 'GREEN',
    statusLabel: 'OPERATING',
    impact: 'Grain corridor functioning — monitor for change',
    freightImpact: 'War-risk premiums remain but manageable',
    latestSignal: 'No new disruption signals overnight',
    source: 'Live feed monitoring',
  };
}

function scorePanama(feeds: FeedPayload | null): LaneStatus {
  const shippingItems = [
    ...(feeds?.sources.find(s => s.source_name === 'Shipping RSS')?.items ?? []),
    ...(feeds?.sources.find(s => s.source_name === 'Freight Rates RSS')?.items ?? []),
  ];
  const keywords = ['panama', 'canal', 'water level', 'drought', 'transit', 'reservation'];
  const signals = shippingItems.filter(i =>
    keywords.some(k => (i.title + ' ' + (i.summary ?? '')).toLowerCase().includes(k))
  );
  if (signals.length >= 2) {
    return {
      id: 'panama',
      name: 'Panama Canal',
      region: 'Central America',
      status: 'AMBER',
      statusLabel: 'CAPACITY CONSTRAINED',
      impact: 'Reduced daily transits due to water levels — booking delays likely',
      freightImpact: 'Surcharges applied · Some rerouting via Suez',
      latestSignal: signals[0]?.title ?? 'Canal operating below capacity',
      source: 'Live feed',
    };
  }
  return {
    id: 'panama',
    name: 'Panama Canal',
    region: 'Central America',
    status: 'GREEN',
    statusLabel: 'NORMAL',
    impact: 'No active restriction signals overnight',
    freightImpact: 'Standard transit fees — no surcharges detected',
    latestSignal: 'No disruption signals overnight',
    source: 'Live feed monitoring',
  };
}

function scoreEnglishChannel(feeds: FeedPayload | null): LaneStatus {
  const shippingItems = feeds?.sources.find(s => s.source_name === 'Shipping RSS')?.items ?? [];
  const keywords = ['english channel', 'dover', 'calais', 'north sea', 'port disruption', 'strike', 'blockade'];
  const signals = shippingItems.filter(i =>
    keywords.some(k => (i.title + ' ' + (i.summary ?? '')).toLowerCase().includes(k))
  );
  if (signals.length >= 1) {
    return {
      id: 'english-channel',
      name: 'English Channel / Dover',
      region: 'UK–EU · North Sea',
      status: 'AMBER',
      statusLabel: 'DISRUPTION SIGNAL',
      impact: 'Port or ferry disruption detected — monitor cross-Channel freight',
      freightImpact: 'Delays possible for road-sea freight',
      latestSignal: signals[0]?.title ?? 'Disruption signal detected',
      source: 'Live feed',
    };
  }
  return {
    id: 'english-channel',
    name: 'English Channel / Dover',
    region: 'UK–EU · North Sea',
    status: 'GREEN',
    statusLabel: 'CLEAR',
    impact: 'No disruption signals for UK–EU cross-Channel routes',
    freightImpact: 'Normal ferry and road-sea operations',
    latestSignal: 'No disruption overnight',
    source: 'Live feed monitoring',
  };
}

const RAG_CONFIG: Record<RAGStatus, { dot: string; badge: string; badgeText: string; border: string; bg: string }> = {
  RED: {
    dot: 'bg-red-500 animate-pulse',
    badge: 'bg-red-500/20 text-red-300 border-red-500/40',
    badgeText: 'text-red-400',
    border: 'border-red-500/30',
    bg: 'bg-red-950/20',
  },
  AMBER: {
    dot: 'bg-amber-500 animate-pulse',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    badgeText: 'text-amber-400',
    border: 'border-amber-500/30',
    bg: 'bg-amber-950/15',
  },
  GREEN: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
    badgeText: 'text-emerald-400',
    border: 'border-border/30',
    bg: 'bg-slate-900/30',
  },
};

interface ShippingLaneStatusProps {
  feeds: FeedPayload | null;
  conflictZones: ConflictZone[];
  loading: boolean;
}

export default function ShippingLaneStatus({ feeds, conflictZones, loading }: ShippingLaneStatusProps) {
  const lanes: LaneStatus[] = feeds ? [
    scoreRedSea(conflictZones, feeds),
    scoreHormuz(conflictZones, feeds),
    scoreBlackSea(conflictZones, feeds),
    scorePanama(feeds),
    scoreEnglishChannel(feeds),
  ] : [];

  const redCount = lanes.filter(l => l.status === 'RED').length;
  const amberCount = lanes.filter(l => l.status === 'AMBER').length;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Ship size={12} className="text-sky-400/70" />
        <span className="text-xs font-bold text-slate-300 tracking-wider uppercase">Shipping Lane Status</span>
        <div className="ml-auto flex items-center gap-2">
          {redCount > 0 && (
            <span className="text-[10px] font-bold text-red-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {redCount} disrupted
            </span>
          )}
          {amberCount > 0 && (
            <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {amberCount} monitored
            </span>
          )}
        </div>
      </div>

      {loading && lanes.length === 0 ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-slate-800/40 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {lanes.map(lane => {
            const cfg = RAG_CONFIG[lane.status];
            return (
              <div key={lane.id} className={cn('rounded-lg border p-3', cfg.border, cfg.bg)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn('w-2 h-2 rounded-full shrink-0 mt-0.5', cfg.dot)} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12px] font-bold text-slate-200">{lane.name}</span>
                        <span className={cn('text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded border', cfg.badge)}>
                          {lane.statusLabel}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground/50">{lane.region}</span>
                    </div>
                  </div>
                  {lane.status !== 'GREEN' && (
                    <AlertTriangle size={12} className={lane.status === 'RED' ? 'text-red-400 shrink-0' : 'text-amber-400 shrink-0'} />
                  )}
                  {lane.status === 'GREEN' && (
                    <CheckCircle2 size={12} className="text-emerald-500/50 shrink-0" />
                  )}
                </div>

                <div className="mt-2 grid grid-cols-1 gap-1">
                  <p className="text-[11px] text-slate-300 leading-snug">{lane.impact}</p>
                  <p className={cn('text-[10px] font-medium leading-snug', cfg.badgeText)}>{lane.freightImpact}</p>
                  {lane.status !== 'GREEN' && (
                    <div className="flex items-start gap-1 mt-1">
                      <Clock size={8} className="text-muted-foreground/40 mt-0.5 shrink-0" />
                      <p className="text-[10px] text-muted-foreground/60 leading-snug line-clamp-2">{lane.latestSignal}</p>
                      <ArrowUpRight size={8} className="text-muted-foreground/30 shrink-0 mt-0.5" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[9px] text-muted-foreground/30 mt-3 text-right">RAG status derived from live news feeds · Updated on each refresh</p>
    </div>
  );
}
