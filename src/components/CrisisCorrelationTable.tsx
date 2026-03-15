import { BarChart2, TrendingUp, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConflictZone } from '@/types';

interface CorrelationRow {
  eventType: string;
  market: string;
  historicalImpact: string;
  direction: 'up' | 'down' | 'mixed';
  timelag: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  sourceNote: string;
  comparable?: string;
}

const STATIC_CORRELATIONS: CorrelationRow[] = [
  {
    eventType: 'Middle East Escalation',
    market: 'Brent Crude',
    historicalImpact: '+5–15%',
    direction: 'up',
    timelag: 'Immediate – 48h',
    confidence: 'HIGH',
    sourceNote: 'Gulf War I, 2003 Iraq, 2019 Aramco attack',
    comparable: '2019 Aramco attack: Brent +15% on day',
  },
  {
    eventType: 'Red Sea / Suez Closure',
    market: 'Container Freight (Asia–EU)',
    historicalImpact: '+20–50%',
    direction: 'up',
    timelag: '1–3 weeks',
    confidence: 'HIGH',
    sourceNote: '2021 Ever Given, 2024 Houthi crisis',
    comparable: '2024 Red Sea crisis: Drewry WCI +300% over 8 weeks',
  },
  {
    eventType: 'Russian Gas Supply Cut',
    market: 'European Nat. Gas (TTF)',
    historicalImpact: '+20–100%',
    direction: 'up',
    timelag: '2–7 days',
    confidence: 'HIGH',
    sourceNote: '2021–22 Ukraine conflict buildup',
    comparable: 'Aug 2022: TTF hit €350/MWh record',
  },
  {
    eventType: 'Ukraine / Black Sea Disruption',
    market: 'CBOT Wheat',
    historicalImpact: '+10–35%',
    direction: 'up',
    timelag: '1–5 days',
    confidence: 'HIGH',
    sourceNote: 'Feb 2022 invasion, grain corridor suspensions',
    comparable: 'Mar 2022: Wheat +40% in 3 weeks',
  },
  {
    eventType: 'Sanctions on Major Producer',
    market: 'Fertilizer (Urea/Potash)',
    historicalImpact: '+15–40%',
    direction: 'up',
    timelag: '1–4 weeks',
    confidence: 'HIGH',
    sourceNote: '2022 Russian/Belarusian potash sanctions',
    comparable: 'Urea: +30% post-Russia sanctions 2022',
  },
  {
    eventType: 'GBP Sharp Decline (>2%)',
    market: 'All USD-Priced Commodities (in GBP)',
    historicalImpact: '+2–3% landed cost',
    direction: 'up',
    timelag: 'Immediate',
    confidence: 'HIGH',
    sourceNote: 'Sept 2022 mini-budget crisis; GBP/USD at 1.04',
    comparable: 'Sept 2022: GBP/USD -4.3% in one day',
  },
  {
    eventType: 'OPEC+ Supply Cut Announcement',
    market: 'Brent Crude',
    historicalImpact: '+3–8%',
    direction: 'up',
    timelag: 'Immediate – 24h',
    confidence: 'HIGH',
    sourceNote: 'OPEC+ cuts 2022, 2023 voluntary cuts',
    comparable: 'Apr 2023 surprise cut: Brent +6% overnight',
  },
  {
    eventType: 'Geopolitical De-escalation / Ceasefire',
    market: 'Brent Crude / Gold',
    historicalImpact: '-3–8%',
    direction: 'down',
    timelag: 'Immediate',
    confidence: 'MEDIUM',
    sourceNote: 'Risk-off reversal when geopolitical premium unwinds',
    comparable: 'Ceasefire signals historically reduce oil risk premium',
  },
  {
    eventType: 'Taiwan Strait Military Activity',
    market: 'Semiconductors / LNG (Asia)',
    historicalImpact: '+10–30% (LNG spot)',
    direction: 'up',
    timelag: '1–7 days',
    confidence: 'MEDIUM',
    sourceNote: 'Aug 2022 Pelosi visit — limited actual impact but significant risk',
    comparable: 'Historical scenario risk; no full blockade precedent',
  },
  {
    eventType: 'UK Rail / Port Strike',
    market: 'UK Supply Chains / Container Dwell',
    historicalImpact: '+5–20% dwell time cost',
    direction: 'up',
    timelag: 'Immediate',
    confidence: 'MEDIUM',
    sourceNote: 'RMT strikes 2022–23, Felixstowe dock strike',
    comparable: '2022 Felixstowe strike: 3–5 day delays',
  },
];

const CONFIDENCE_CONFIG = {
  HIGH: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  MEDIUM: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  LOW: 'bg-slate-700/30 text-slate-400 border-border/30',
};

interface CrisisCorrelationTableProps {
  conflictZones: ConflictZone[];
}

export default function CrisisCorrelationTable({ conflictZones }: CrisisCorrelationTableProps) {
  const activeZoneIds = new Set(conflictZones.map(z => z.id));

  const activeEventTypes = new Set<string>();
  if (activeZoneIds.has('middle-east-gulf') || activeZoneIds.has('israel-gaza')) {
    activeEventTypes.add('Middle East Escalation');
    activeEventTypes.add('OPEC+ Supply Cut Announcement');
  }
  if (activeZoneIds.has('red-sea-yemen')) {
    activeEventTypes.add('Red Sea / Suez Closure');
  }
  if (activeZoneIds.has('ukraine-russia')) {
    activeEventTypes.add('Ukraine / Black Sea Disruption');
    activeEventTypes.add('Sanctions on Major Producer');
    activeEventTypes.add('Russian Gas Supply Cut');
  }
  if (activeZoneIds.has('taiwan-strait')) {
    activeEventTypes.add('Taiwan Strait Military Activity');
  }

  const sorted = STATIC_CORRELATIONS.slice().sort((a, b) => {
    const aActive = activeEventTypes.has(a.eventType) ? 0 : 1;
    const bActive = activeEventTypes.has(b.eventType) ? 0 : 1;
    return aActive - bActive;
  });

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <BarChart2 size={12} className="text-amber-400/70" />
        <span className="text-xs font-bold text-slate-300 tracking-wider uppercase">Crisis-to-Market Correlations</span>
        <span className="ml-auto text-[10px] text-muted-foreground/40">historical reference</span>
      </div>
      <p className="text-[9px] text-muted-foreground/40 mb-3 pl-[20px]">
        Static historical data — impact ranges from past events. "ACTIVE NOW" means a matching zone is live in your current feeds; actual current price impact may differ.
      </p>

      <div className="space-y-2">
        {sorted.map((row, i) => {
          const isActive = activeEventTypes.has(row.eventType);
          return (
            <div key={i} className={cn(
              'rounded-lg border p-3 transition-all',
              isActive
                ? 'border-amber-500/30 bg-amber-950/15'
                : 'border-border/25 bg-slate-900/20'
            )}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {isActive && (
                      <span className="text-[9px] font-bold text-amber-400 tracking-widest uppercase bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 rounded">
                        ACTIVE NOW
                      </span>
                    )}
                    <span className="text-[11px] font-semibold text-slate-200">{row.eventType}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[10px] text-muted-foreground/60">{row.market}</span>
                    <span className={cn(
                      'text-[11px] font-bold',
                      row.direction === 'up' ? 'text-red-400' : row.direction === 'down' ? 'text-emerald-400' : 'text-amber-400'
                    )}>
                      {row.historicalImpact}
                    </span>
                    <div className="flex items-center gap-0.5">
                      {row.direction === 'up' ? (
                        <TrendingUp size={9} className="text-red-400" />
                      ) : row.direction === 'down' ? (
                        <TrendingUp size={9} className="text-emerald-400 rotate-180" />
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[9px] text-muted-foreground/40">Lag: {row.timelag}</span>
                    <span className="text-muted-foreground/25">·</span>
                    <span className={cn('text-[9px] px-1.5 py-0.5 rounded border', CONFIDENCE_CONFIG[row.confidence])}>
                      {row.confidence} confidence
                    </span>
                  </div>
                </div>
              </div>
              {row.comparable && (
                <div className="mt-2 pt-2 border-t border-border/20">
                  <div className="flex items-start gap-1">
                    <ExternalLink size={8} className="text-muted-foreground/30 mt-0.5 shrink-0" />
                    <p className="text-[10px] text-muted-foreground/50 leading-snug">
                      <span className="text-muted-foreground/70">{row.comparable}</span>
                      {' · '}<span className="italic">{row.sourceNote}</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[9px] text-muted-foreground/30 mt-3 text-right">
        Historical ranges from EIA, USDA, Reuters, Drewry WCI · Reference data only · Not a forecast · Verify before citing
      </p>
    </div>
  );
}
