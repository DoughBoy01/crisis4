import { TrendingUp, ShoppingBasket, Ship, BarChart2, Briefcase, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { PersonaId } from './PersonaBar';
import type { FeedPayload } from '@/hooks/useMarketFeeds';
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

function buildPersonaSummary(
  persona: PersonaId,
  feeds: FeedPayload | null,
  alerts: MorningAlert[],
  actions: ActionItem[],
  conflictZones: ConflictZone[],
): { headline: string; bullets: string[]; callToAction: string } {
  const brentQ = feeds?.sources.find(s => s.source_name === 'Yahoo Finance')?.quotes?.find(q => q.symbol === 'BZ=F');
  const brentPct = brentQ?.changePercent ?? 0;
  const brentPrice = brentQ?.price ?? 0;
  const gbpUsdQ = feeds?.sources.find(s => s.source_name === 'Yahoo Finance')?.quotes?.find(q => q.symbol === 'GBPUSD=X');
  const gbpUsd = gbpUsdQ?.price ?? 0;
  const gbpPct = gbpUsdQ?.changePercent ?? 0;
  const ngQ = feeds?.sources.find(s => s.source_name === 'Yahoo Finance')?.quotes?.find(q => q.symbol === 'NG=F');
  const ngPct = ngQ?.changePercent ?? 0;
  const ngPrice = ngQ?.price ?? 0;
  const wheatQ = feeds?.sources.find(s => s.source_name === 'Yahoo Finance')?.quotes?.find(q => q.symbol === 'ZW=F');
  const wheatPct = wheatQ?.changePercent ?? 0;
  const wheatPrice = wheatQ?.price ?? 0;
  const copperQ = feeds?.sources.find(s => s.source_name === 'Yahoo Finance')?.quotes?.find(q => q.symbol === 'HG=F');
  const copperPct = copperQ?.changePercent ?? 0;
  const bdiQ = feeds?.sources.find(s => s.source_name === 'Yahoo Finance')?.quotes?.find(q => q.symbol === 'BDI');
  const bdiPct = bdiQ?.changePercent ?? 0;
  const bdiPrice = bdiQ?.price ?? 0;

  const criticalZones = conflictZones.filter(z => z.riskLevel === 'CRITICAL' || z.riskLevel === 'HIGH');
  const hasRedSea = criticalZones.some(z => z.id === 'red-sea-yemen');
  const hasMiddleEast = criticalZones.some(z => z.id === 'middle-east-gulf' || z.id === 'israel-gaza');
  const hasUkraine = criticalZones.some(z => z.id === 'ukraine-russia');
  const urgentActions = actions.filter(a => a.signal === 'URGENT');
  const buyActions = actions.filter(a => a.signal === 'BUY');

  switch (persona) {
    case 'trader': {
      const crisisText = criticalZones.length > 0
        ? `${criticalZones.length} active crisis theatre${criticalZones.length > 1 ? 's' : ''} affecting commodities`
        : 'No critical geopolitical escalations overnight';
      const brentText = brentPct !== 0
        ? `Brent ${brentPct > 0 ? '+' : ''}${brentPct.toFixed(2)}% at $${brentPrice.toFixed(2)}/bbl`
        : 'Brent Crude — awaiting price data';
      const gbpText = gbpUsd > 0
        ? `Sterling at ${gbpUsd.toFixed(4)}${gbpPct < -0.5 ? ' — weakening, USD commodities more expensive in GBP' : ''}`
        : 'FX — awaiting rate data';
      const headline = urgentActions.length > 0
        ? `${urgentActions.length} urgent signal${urgentActions.length > 1 ? 's' : ''} require action before the 7am standup.`
        : brentPct !== 0
          ? `Brent ${brentPct > 0 ? 'up' : 'down'} ${Math.abs(brentPct).toFixed(2)}% overnight — crisis context below.`
          : 'Monitor live crisis feeds — no major moves yet.';
      return {
        headline,
        bullets: [
          crisisText,
          brentText,
          gbpText,
          hasRedSea ? 'Red Sea: shipping disruption active — freight war-risk premiums elevated' : 'Red Sea: no new escalation signals overnight',
        ],
        callToAction: 'Review crisis timeline and price attribution below before 7am standup',
      };
    }
    case 'agri': {
      const wheatText = wheatPrice > 0
        ? `CBOT Wheat at ${wheatPrice.toFixed(0)}¢/bu (${wheatPct >= 0 ? '+' : ''}${wheatPct.toFixed(2)}% overnight)`
        : 'Wheat — awaiting price data';
      const ngText = ngPrice > 0
        ? `Natural gas at $${ngPrice.toFixed(3)}/MMBtu (${ngPct >= 0 ? '+' : ''}${ngPct.toFixed(2)}%) — feeds fertilizer cost`
        : 'Gas feedstock — awaiting data';
      const ukraineText = hasUkraine
        ? 'Ukraine / Black Sea corridor: active disruption risk to grain exports'
        : 'Black Sea grain corridor: no new disruption signals';
      const headline = wheatPct >= 2
        ? `Grain prices rising ${wheatPct.toFixed(1)}% — review forward cover position before suppliers call you.`
        : wheatPct <= -1.5
          ? `Grain prices dipping ${Math.abs(wheatPct).toFixed(1)}% — potential buying window for forward contracts.`
          : ngPct >= 2
            ? `Gas up ${ngPct.toFixed(1)}% — fertilizer input costs are rising. Act before pricing rolls forward.`
            : 'No major agri shocks overnight. Monitor for fertilizer pricing updates.';
      return {
        headline,
        bullets: [
          wheatText,
          ngText,
          ukraineText,
          hasUkraine ? 'Fertilizer supply chain: Russian/Belarusian potash sanctions risk remains elevated' : 'Fertilizer supply: no fresh sanction signals overnight',
        ],
        callToAction: buyActions.length > 0 ? `${buyActions.length} buy signal${buyActions.length > 1 ? 's' : ''} identified — see action checklist below` : 'Monitor action panel for procurement signals',
      };
    }
    case 'logistics': {
      const bdiText = bdiPrice > 0
        ? `Baltic Dry Index at ${bdiPrice.toFixed(0)} pts (${bdiPct >= 0 ? '+' : ''}${bdiPct.toFixed(2)}% overnight)`
        : 'Baltic Dry Index — awaiting data';
      const redSeaText = hasRedSea
        ? 'Red Sea: ACTIVE disruption — rerouting via Cape of Good Hope likely in effect'
        : 'Red Sea: no active disruption signals overnight';
      const hormuzText = hasMiddleEast
        ? 'Persian Gulf / Hormuz: elevated risk — monitor tanker traffic and war-risk surcharges'
        : 'Hormuz: stable overnight — no new tanker incident reports';
      const headline = hasRedSea
        ? 'Red Sea disruption active — Asia–Europe container routes are affected. Check your open shipments now.'
        : bdiPct >= 2
          ? `Dry bulk rates rising ${bdiPct.toFixed(1)}% — bulk freight costs are moving. Review open contracts.`
          : 'No critical shipping lane alerts overnight. Standard operational monitoring.';
      return {
        headline,
        bullets: [
          bdiText,
          redSeaText,
          hormuzText,
          `Fuel cost context: Brent ${brentPct >= 0 ? '+' : ''}${brentPct.toFixed(2)}% at $${brentPrice.toFixed(2)} — bunker fuel implications`,
        ],
        callToAction: 'Review shipping lane status and freight rate tracker below',
      };
    }
    case 'analyst': {
      const riskScore = criticalZones.filter(z => z.riskLevel === 'CRITICAL').length * 3 +
        criticalZones.filter(z => z.riskLevel === 'HIGH').length * 2 +
        conflictZones.filter(z => z.riskLevel === 'ELEVATED').length;
      const riskLabel = riskScore >= 6 ? 'HIGH' : riskScore >= 3 ? 'ELEVATED' : 'MODERATE';
      const headline = criticalZones.length > 0
        ? `${criticalZones.length} HIGH/CRITICAL zone${criticalZones.length > 1 ? 's' : ''} active. Composite geopolitical risk: ${riskLabel}. Client brief data below.`
        : 'Geopolitical risk composite: MODERATE. No critical escalations overnight.';
      return {
        headline,
        bullets: [
          `Composite risk score: ${riskLabel} — ${conflictZones.length} active theatres across ${[hasMiddleEast && 'Middle East', hasRedSea && 'Red Sea', hasUkraine && 'Eastern Europe'].filter(Boolean).join(', ') || 'multiple regions'}`,
          `Brent reaction: ${brentPct >= 0 ? '+' : ''}${brentPct.toFixed(2)}% — ${Math.abs(brentPct) >= 2 ? 'significant, crisis-attributed' : 'within normal variance'}`,
          `GBP/USD: ${gbpUsd > 0 ? gbpUsd.toFixed(4) : '—'} — ${gbpPct <= -0.5 ? 'sterling under pressure, risk-off signal' : 'stable'}`,
          `${urgentActions.length + buyActions.length} actionable procurement signals across tracked markets`,
        ],
        callToAction: 'Export crisis correlation data and scenario modelling for client briefing',
      };
    }
    case 'general':
    default: {
      const brentImpact = brentPct >= 2
        ? `Energy prices are up ${brentPct.toFixed(1)}% overnight — your fuel and utility bills could rise.`
        : brentPct <= -1.5
          ? `Energy prices dipped ${Math.abs(brentPct).toFixed(1)}% overnight — a potential saving opportunity.`
          : 'Energy prices are broadly stable overnight.';
      const fxImpact = gbpUsd > 0 && gbpPct <= -0.5
        ? `Sterling is weakening (${gbpUsd.toFixed(4)}) — imported goods and raw materials are getting more expensive.`
        : gbpUsd > 0
          ? `Sterling is holding at ${gbpUsd.toFixed(4)} — no immediate FX pressure on import costs.`
          : 'FX rates — checking...';
      const crisisImpact = criticalZones.length > 0
        ? `${criticalZones.length} ongoing geopolitical situation${criticalZones.length > 1 ? 's' : ''} could affect UK supply chains and energy prices.`
        : 'No major new geopolitical disruptions overnight.';
      const headline = urgentActions.length > 0
        ? `${urgentActions.length} market movement${urgentActions.length > 1 ? 's' : ''} overnight that could affect UK business costs. Summary below.`
        : 'Markets broadly calm overnight. Here is your quick summary.';
      return {
        headline,
        bullets: [brentImpact, fxImpact, crisisImpact],
        callToAction: 'Scroll down for the full plain-English breakdown',
      };
    }
  }
}

export default function PersonaHero({ persona, feeds, alerts, actions, conflictZones, loading }: PersonaHeroProps) {
  if (persona === 'general' && !loading && feeds === null) return null;

  const meta = getPersonaMeta(persona);
  const Icon = meta.icon;
  const summary = !loading && feeds ? buildPersonaSummary(persona, feeds, alerts, actions, conflictZones) : null;
  const hasCritical = alerts.some(a => a.severity === 'critical');

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

        {loading || !summary ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-4 bg-slate-700/50 rounded w-3/4" />
            <div className="h-3 bg-slate-700/30 rounded w-1/2" />
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
