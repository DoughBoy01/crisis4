import { TrendingUp, ShoppingBasket, Ship, BarChart2, Briefcase, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { PersonaId } from './PersonaBar';
import type { FeedPayload } from '@/hooks/useMarketFeeds';
import { getYahooQuote } from '@/hooks/useMarketFeeds';
import type { ActionItem, MorningAlert, ConflictZone } from '@/types';
import { cn } from '@/lib/utils';

interface PersonaHeroProps {
  persona: PersonaId;
  feeds: FeedPayload | null;
  alerts: MorningAlert[];
  actions: ActionItem[];
  conflictZones: ConflictZone[];
  loading: boolean;
}

function getPersonaMeta(persona: PersonaId) {
  switch (persona) {
    case 'trader':
      return {
        icon: TrendingUp,
        label: 'Trader View',
        color: 'text-red-400',
        bg: 'from-red-950/40 via-slate-900/60 to-slate-900/80',
        border: 'border-red-500/25',
        accent: 'bg-red-500/70',
      };
    case 'agri':
      return {
        icon: ShoppingBasket,
        label: 'Agri Buyer View',
        color: 'text-emerald-400',
        bg: 'from-emerald-950/30 via-slate-900/60 to-slate-900/80',
        border: 'border-emerald-500/25',
        accent: 'bg-emerald-500/70',
      };
    case 'logistics':
      return {
        icon: Ship,
        label: 'Logistics Director View',
        color: 'text-sky-400',
        bg: 'from-sky-950/30 via-slate-900/60 to-slate-900/80',
        border: 'border-sky-500/25',
        accent: 'bg-sky-500/70',
      };
    case 'analyst':
      return {
        icon: BarChart2,
        label: 'Risk Analyst View',
        color: 'text-amber-400',
        bg: 'from-amber-950/30 via-slate-900/60 to-slate-900/80',
        border: 'border-amber-500/25',
        accent: 'bg-amber-500/70',
      };
    case 'general':
    default:
      return {
        icon: Briefcase,
        label: 'Business Overview',
        color: 'text-slate-300',
        bg: 'from-slate-800/50 via-slate-900/60 to-slate-900/80',
        border: 'border-slate-600/25',
        accent: 'bg-slate-500/70',
      };
  }
}

function fmt(n: number, d = 2) { return n.toFixed(d); }
function pctStr(n: number) { return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`; }

function buildPersonaSummary(
  persona: PersonaId,
  feeds: FeedPayload,
  alerts: MorningAlert[],
  actions: ActionItem[],
  conflictZones: ConflictZone[],
): { headline: string; bullets: string[]; callToAction: string } {
  const brentQ    = getYahooQuote(feeds, 'BZ=F');
  const ngQ       = getYahooQuote(feeds, 'NG=F');
  const wheatQ    = getYahooQuote(feeds, 'ZW=F');
  const gbpUsdQ   = getYahooQuote(feeds, 'GBPUSD=X');
  const goldQ     = getYahooQuote(feeds, 'GC=F');
  const copperQ   = getYahooQuote(feeds, 'HG=F');

  const brentEia  = feeds.sources.find(s => s.source_name === 'EIA Brent Crude');
  const fxSrc     = feeds.sources.find(s => s.source_name === 'ExchangeRate.host FX');

  const brentPct   = brentQ?.changePercent ?? brentEia?.change_pct ?? 0;
  const brentPrice = brentQ?.price ?? brentEia?.current_price ?? 0;
  const ngPct      = ngQ?.changePercent ?? 0;
  const ngPrice    = ngQ?.price ?? 0;
  const wheatPct   = wheatQ?.changePercent ?? 0;
  const wheatPrice = wheatQ?.price ?? 0;
  const gbpUsd     = gbpUsdQ?.price ?? fxSrc?.gbp_usd ?? 0;
  const gbpPct     = gbpUsdQ?.changePercent ?? 0;
  const goldPct    = goldQ?.changePercent ?? 0;

  const criticalZones  = conflictZones.filter(z => z.riskLevel === 'CRITICAL' || z.riskLevel === 'HIGH');
  const elevatedZones  = conflictZones.filter(z => z.riskLevel === 'ELEVATED');
  const hasRedSea      = conflictZones.some(z => z.id === 'red-sea-yemen');
  const hasMiddleEast  = conflictZones.some(z => z.id === 'middle-east-gulf' || z.id === 'israel-gaza');
  const hasUkraine     = conflictZones.some(z => z.id === 'ukraine-russia');
  const urgentActions  = actions.filter(a => a.signal === 'URGENT');
  const buyActions     = actions.filter(a => a.signal === 'BUY');

  const hasBrentData  = brentPrice > 0;
  const hasGbpData    = gbpUsd > 0;
  const hasWheatData  = wheatPrice > 0;
  const hasNgData     = ngPrice > 0;

  switch (persona) {
    case 'trader': {
      const crisisText = criticalZones.length > 0
        ? `${criticalZones.length} HIGH/CRITICAL zone${criticalZones.length > 1 ? 's' : ''}: ${criticalZones.map(z => z.region).join(', ')}`
        : elevatedZones.length > 0
          ? `${elevatedZones.length} ELEVATED zone${elevatedZones.length > 1 ? 's' : ''} — ${elevatedZones.map(z => z.region).join(', ')}`
          : 'No active geopolitical escalations overnight';
      const brentText = hasBrentData
        ? `Brent Crude ${pctStr(brentPct)} at $${fmt(brentPrice, 2)}/bbl`
        : 'Brent Crude — price loading';
      const gbpText = hasGbpData
        ? `GBP/USD ${fmt(gbpUsd, 4)} (${pctStr(gbpPct)})${gbpPct < -0.5 ? ' — sterling weakening, USD costs rising' : ''}`
        : 'GBP/USD — rate loading';
      const goldText = goldQ?.price
        ? `Gold ${pctStr(goldPct)} at $${fmt(goldQ.price, 0)}/oz — risk sentiment ${goldPct >= 0.5 ? 'elevated' : 'neutral'}`
        : 'Gold — loading';

      const headline = urgentActions.length > 0
        ? `${urgentActions.length} urgent signal${urgentActions.length > 1 ? 's' : ''} require action before the 7am standup.`
        : hasBrentData && Math.abs(brentPct) >= 0.5
          ? `Brent ${brentPct > 0 ? 'up' : 'down'} ${Math.abs(brentPct).toFixed(2)}% overnight — crisis context below.`
          : criticalZones.length > 0
            ? `${criticalZones.length} active crisis theatre${criticalZones.length > 1 ? 's' : ''} — see timeline and price attribution below.`
            : elevatedZones.length > 0
              ? `${elevatedZones.length} elevated zone${elevatedZones.length > 1 ? 's' : ''} on watch — no critical overnight escalations.`
              : 'No major overnight moves detected. Markets within normal variance.';

      return {
        headline,
        bullets: [crisisText, brentText, gbpText, goldText],
        callToAction: urgentActions.length > 0
          ? 'Review crisis timeline and price attribution before 7am standup'
          : 'Open crisis timeline to review overnight event-to-market links',
      };
    }

    case 'agri': {
      const wheatText = hasWheatData
        ? `CBOT Wheat ${pctStr(wheatPct)} at ${fmt(wheatPrice, 0)}¢/bu`
        : 'Wheat — price loading';
      const ngText = hasNgData
        ? `Natural gas ${pctStr(ngPct)} at $${fmt(ngPrice, 3)}/MMBtu — feeds fertilizer cost`
        : 'Natural gas — price loading';
      const ukraineText = hasUkraine
        ? 'Ukraine / Black Sea corridor: active disruption risk to grain exports'
        : 'Black Sea grain corridor: no new disruption signals overnight';
      const fertText = hasUkraine
        ? 'Fertilizer supply: Russian/Belarusian sanctions risk remains — monitor Humber landed cost'
        : 'Fertilizer supply: no fresh sanction signals overnight';

      const headline = hasWheatData && wheatPct >= 2
        ? `Grain prices up ${wheatPct.toFixed(1)}% — review forward cover before suppliers price in the move.`
        : hasWheatData && wheatPct <= -1.5
          ? `Grain prices down ${Math.abs(wheatPct).toFixed(1)}% — potential buying window for forward contracts.`
          : hasNgData && ngPct >= 2
            ? `Gas feedstock up ${ngPct.toFixed(1)}% — fertilizer input costs rising. Act before pricing rolls forward.`
            : hasUkraine
              ? 'Black Sea disruption signals active — monitor grain and fertilizer supply chain exposure.'
              : buyActions.length > 0
                ? `${buyActions.length} buy signal${buyActions.length > 1 ? 's' : ''} in the action panel — potential procurement window today.`
                : 'No major agri shocks overnight. Standard monitoring applies.';

      return {
        headline,
        bullets: [wheatText, ngText, ukraineText, fertText],
        callToAction: buyActions.length > 0
          ? `${buyActions.length} buy signal${buyActions.length > 1 ? 's' : ''} identified — see action checklist below`
          : 'Check shipping lane status for Black Sea grain route updates',
      };
    }

    case 'logistics': {
      const freightSrc = feeds.sources.find(s => s.source_name === 'Freight Rates RSS');
      const freightHeadlines = freightSrc?.items?.length ?? 0;

      const bdiText = hasBrentData
        ? `Bunker fuel (Brent proxy) ${pctStr(brentPct)} at $${fmt(brentPrice, 2)}/bbl`
        : 'Bunker fuel — loading';
      const redSeaText = hasRedSea
        ? `Red Sea: ACTIVE disruption — Asia-Europe containers rerouting via Cape of Good Hope (+~14 days)`
        : 'Red Sea: no active disruption signals overnight';
      const hormuzText = hasMiddleEast
        ? 'Persian Gulf / Hormuz: elevated risk — war-risk insurance costs rising'
        : 'Hormuz: stable overnight — no new tanker incident reports';
      const freightText = freightHeadlines > 0
        ? `${freightHeadlines} freight rate headline${freightHeadlines > 1 ? 's' : ''} in live feed — review below`
        : hasBrentData
          ? `Fuel cost baseline ${pctStr(brentPct)} — bunker implications for open freight contracts`
          : 'Freight rate feed — loading';

      const headline = hasRedSea
        ? 'Red Sea disruption active — check open Asia–Europe shipments now and confirm carrier rerouting status.'
        : criticalZones.length > 0
          ? `${criticalZones.length} active shipping risk zone${criticalZones.length > 1 ? 's' : ''} — see lane status below.`
          : hasBrentData && Math.abs(brentPct) >= 1
            ? `Bunker fuel ${brentPct > 0 ? 'up' : 'down'} ${Math.abs(brentPct).toFixed(1)}% — review freight contract fuel clauses.`
            : 'No critical shipping lane alerts overnight. Standard operational monitoring.';

      return {
        headline,
        bullets: [bdiText, redSeaText, hormuzText, freightText],
        callToAction: 'Review shipping lane RAG status and freight rate tracker below',
      };
    }

    case 'analyst': {
      const criticalCount  = conflictZones.filter(z => z.riskLevel === 'CRITICAL').length;
      const highCount      = conflictZones.filter(z => z.riskLevel === 'HIGH').length;
      const elevatedCount  = conflictZones.filter(z => z.riskLevel === 'ELEVATED').length;
      const riskScore      = criticalCount * 3 + highCount * 2 + elevatedCount;
      const riskLabel      = riskScore >= 6 ? 'HIGH' : riskScore >= 3 ? 'ELEVATED' : 'MODERATE';
      const scoreBreakdown = [
        criticalCount > 0 && `${criticalCount}× CRITICAL`,
        highCount > 0 && `${highCount}× HIGH`,
        elevatedCount > 0 && `${elevatedCount}× ELEVATED`,
      ].filter(Boolean).join(', ') || 'no active zones';

      const regionList = [
        hasMiddleEast && 'Middle East',
        hasRedSea && 'Red Sea',
        hasUkraine && 'Eastern Europe',
      ].filter(Boolean).join(', ') || (conflictZones.length > 0 ? 'multiple regions' : 'no active zones');

      const brentReaction = hasBrentData
        ? `Brent ${pctStr(brentPct)} — ${Math.abs(brentPct) >= 2 ? 'significant, likely crisis-attributed' : 'within normal variance'}`
        : 'Brent — loading';
      const gbpReaction = hasGbpData
        ? `GBP/USD ${fmt(gbpUsd, 4)} (${pctStr(gbpPct)}) — ${gbpPct <= -0.5 ? 'sterling under pressure, risk-off signal' : 'stable'}`
        : 'GBP/USD — loading';

      const headline = criticalZones.length > 0
        ? `${criticalZones.length} HIGH/CRITICAL zone${criticalZones.length > 1 ? 's' : ''} active. Composite risk: ${riskLabel}. Client-ready data below.`
        : `Geopolitical risk composite: ${riskLabel}. ${conflictZones.length} monitored theatre${conflictZones.length !== 1 ? 's' : ''} — no critical escalations overnight.`;

      return {
        headline,
        bullets: [
          `Composite risk: ${riskLabel} (${scoreBreakdown}) — ${regionList}`,
          brentReaction,
          gbpReaction,
          `${urgentActions.length + buyActions.length} actionable market signals · ${alerts.length} overnight alerts`,
        ],
        callToAction: 'Open correlation table for citable historical precedents · expand crisis timeline for event attribution',
      };
    }

    case 'general':
    default: {
      const brentImpact = hasBrentData
        ? brentPct >= 2
          ? `Energy prices up ${brentPct.toFixed(1)}% overnight — fuel and utility bills may rise shortly.`
          : brentPct <= -1.5
            ? `Energy prices down ${Math.abs(brentPct).toFixed(1)}% overnight — a potential saving opportunity on fuel contracts.`
            : `Energy prices broadly stable (${pctStr(brentPct)}) — no immediate pressure from oil markets.`
        : 'Energy prices — checking live data.';

      const fxImpact = hasGbpData
        ? gbpPct <= -0.5
          ? `Sterling weakening at ${fmt(gbpUsd, 4)} — imported goods and raw materials more expensive in GBP.`
          : `Sterling steady at ${fmt(gbpUsd, 4)} — no immediate FX pressure on import costs.`
        : 'FX rates — checking live data.';

      const crisisImpact = criticalZones.length > 0
        ? `${criticalZones.length} ongoing geopolitical situation${criticalZones.length > 1 ? 's' : ''} (${criticalZones.map(z => z.region).join(', ')}) could affect UK supply chains.`
        : 'No major new geopolitical disruptions overnight. Markets broadly calm.';

      const copperText = copperQ?.price
        ? `Metals (Copper ${pctStr(copperQ.changePercent ?? 0)} at ${fmt(copperQ.price, 2)}¢/lb) — construction & manufacturing input costs.`
        : null;

      const freightText = hasRedSea
        ? 'Shipping: Red Sea disruption active — container & import delays possible. Factor into lead times.'
        : null;

      const bullets = [brentImpact, fxImpact, crisisImpact];
      if (copperText) bullets.push(copperText);
      else if (freightText) bullets.push(freightText);

      const headline = urgentActions.length > 0
        ? `${urgentActions.length} market movement${urgentActions.length > 1 ? 's' : ''} overnight that could affect UK business costs. Summary below.`
        : hasBrentData && Math.abs(brentPct) >= 1
          ? `${brentPct > 0 ? 'Energy prices rising' : 'Energy prices falling'} — here is what it means for your business.`
          : criticalZones.length > 0
            ? 'Global events to watch — here is what they mean for UK costs and supply chains.'
            : 'Markets broadly calm overnight. Here is your quick summary.';

      return {
        headline,
        bullets,
        callToAction: 'Scroll down for the full plain-English breakdown and action checklist',
      };
    }
  }
}

export default function PersonaHero({ persona, feeds, alerts, actions, conflictZones, loading }: PersonaHeroProps) {
  const meta = getPersonaMeta(persona);
  const Icon = meta.icon;

  const summary = feeds ? buildPersonaSummary(persona, feeds, alerts, actions, conflictZones) : null;
  const hasCritical = alerts.some(a => a.severity === 'critical');
  const isLoading = loading && !feeds;

  return (
    <div className={cn(
      'relative overflow-hidden rounded-xl border',
      hasCritical && persona === 'trader' ? 'border-red-500/40' : meta.border,
      'bg-gradient-to-r',
      meta.bg,
    )}>
      <div className={cn('absolute top-0 left-0 right-0 h-0.5', meta.accent)} />

      <div className="px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Icon size={13} className={meta.color} />
          <span className={cn('text-[11px] font-bold tracking-widest uppercase', meta.color)}>{meta.label}</span>
          {hasCritical && persona === 'trader' && (
            <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-red-400 animate-pulse">
              <AlertTriangle size={9} />
              CRITICAL ALERT
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-4 bg-slate-700/50 rounded w-3/4" />
            <div className="h-3 bg-slate-700/30 rounded w-2/3" />
            <div className="h-3 bg-slate-700/20 rounded w-1/2" />
          </div>
        ) : summary ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-100 leading-snug">{summary.headline}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {summary.bullets.map((b, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <CheckCircle2 size={10} className={cn('mt-0.5 shrink-0', meta.color)} />
                  <span className="text-[11px] text-slate-300 leading-snug">{b}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-1.5 pt-1 border-t border-border/20">
              <ArrowRight size={10} className={meta.color} />
              <span className={cn('text-[11px] font-medium', meta.color)}>{summary.callToAction}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-2 animate-pulse">
            <div className="h-4 bg-slate-700/50 rounded w-3/4" />
            <div className="h-3 bg-slate-700/30 rounded w-1/2" />
          </div>
        )}
      </div>
    </div>
  );
}
