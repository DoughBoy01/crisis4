import type { FeedPayload, FeedSource, YahooQuote } from '@/hooks/useMarketFeeds';
import type { MarketItem, MarketCategory, OvernightStat, ActionItem, MorningAlert, SectorId, Signal, ConflictZone, ConflictRiskLevel, SupplyExposureItem, ContingencyScenario, PlaybookTrigger, PercentileContext, SeasonalContext, ConflictIntensity } from '@/types';
import type { HistoricalContext, CommodityPercentile, SeasonalPattern, ConflictZoneBaseline } from '@/hooks/useHistoricalContext';
import { computePercentileRank, getPercentileLabel, getSeasonalPressure, getConflictBaseline, scoreVsBaseline } from '@/hooks/useHistoricalContext';

function pct(value: number | null | undefined): number {
  return value ?? 0;
}

function fmt(value: number | null | undefined, decimals = 2): string {
  if (value == null) return '—';
  return value.toFixed(decimals);
}

function signalFromChange(changePercent: number | null | undefined): Signal {
  const cp = changePercent ?? 0;
  if (cp <= -1.5) return 'BUY';
  if (cp >= 2) return 'URGENT';
  if (Math.abs(cp) >= 0.5) return 'WATCH';
  return 'HOLD';
}

function rationale(label: string, cp: number): string {
  const abs = Math.abs(cp).toFixed(2);
  if (cp <= -1.5) return `${label} down ${abs}% overnight — favourable entry point for forward purchases before any recovery.`;
  if (cp >= 2) return `${label} up ${abs}% — review unhedged exposure now and consider locking in forward cover.`;
  if (cp >= 1) return `${label} rising ${abs}% — trend worth monitoring; consider whether to bring forward any planned purchases.`;
  if (cp <= -1) return `${label} falling ${abs}% — continued weakness may open a buying window.`;
  if (cp >= 0.5) return `${label} edging up ${abs}% — small move but directional; keep under review.`;
  if (cp <= -0.5) return `${label} softening ${abs}% — minor dip, watch for further movement before acting.`;
  return `${label} flat overnight. No immediate action required.`;
}

const SYMBOL_CONFIG: Record<string, {
  name: string;
  shortName: string;
  category: MarketCategory;
  unit: string;
  currency: string;
  relevantSectors: SectorId[];
  sourceUrl: string;
}> = {
  'BZ=F': {
    name: 'Brent Crude Oil (ICE)',
    shortName: 'Brent Crude',
    category: 'energy',
    unit: 'bbl',
    currency: 'USD',
    relevantSectors: ['food_importer', 'chemicals', 'freight_3pl', 'construction', 'financial'],
    sourceUrl: 'https://www.eia.gov/petroleum/',
  },
  'CL=F': {
    name: 'WTI Crude Oil',
    shortName: 'WTI Crude',
    category: 'energy',
    unit: 'bbl',
    currency: 'USD',
    relevantSectors: ['chemicals', 'freight_3pl', 'construction', 'financial'],
    sourceUrl: 'https://www.cmegroup.com/',
  },
  'NG=F': {
    name: 'Natural Gas (NYMEX)',
    shortName: 'Natural Gas',
    category: 'energy',
    unit: 'MMBtu',
    currency: 'USD',
    relevantSectors: ['chemicals', 'food_importer', 'construction', 'financial'],
    sourceUrl: 'https://www.cmegroup.com/',
  },
  'ZW=F': {
    name: 'Wheat (CBOT)',
    shortName: 'Wheat',
    category: 'agricultural',
    unit: 'bu',
    currency: 'USX',
    relevantSectors: ['food_importer', 'financial'],
    sourceUrl: 'https://www.cmegroup.com/',
  },
  'ZC=F': {
    name: 'Corn (CBOT)',
    shortName: 'Corn',
    category: 'agricultural',
    unit: 'bu',
    currency: 'USX',
    relevantSectors: ['food_importer', 'financial'],
    sourceUrl: 'https://www.cmegroup.com/',
  },
  'ZS=F': {
    name: 'Soybeans (CBOT)',
    shortName: 'Soybeans',
    category: 'agricultural',
    unit: 'bu',
    currency: 'USX',
    relevantSectors: ['food_importer', 'financial'],
    sourceUrl: 'https://www.cmegroup.com/',
  },
  'GC=F': {
    name: 'Gold',
    shortName: 'Gold',
    category: 'metals',
    unit: 'oz',
    currency: 'USD',
    relevantSectors: ['financial'],
    sourceUrl: 'https://www.cmegroup.com/',
  },
  'DX=F': {
    name: 'US Dollar Index',
    shortName: 'USD Index',
    category: 'fx',
    unit: 'pts',
    currency: 'USD',
    relevantSectors: ['food_importer', 'freight_3pl', 'chemicals', 'financial'],
    sourceUrl: 'https://www.ice.com/',
  },
  'GBPUSD=X': {
    name: 'GBP/USD',
    shortName: 'GBP/USD',
    category: 'fx',
    unit: '',
    currency: 'USD',
    relevantSectors: ['food_importer', 'freight_3pl', 'chemicals', 'construction', 'financial'],
    sourceUrl: 'https://www.bankofengland.co.uk/',
  },
  'GBPEUR=X': {
    name: 'GBP/EUR',
    shortName: 'GBP/EUR',
    category: 'fx',
    unit: '',
    currency: 'EUR',
    relevantSectors: ['food_importer', 'freight_3pl', 'chemicals', 'construction', 'financial'],
    sourceUrl: 'https://www.bankofengland.co.uk/',
  },
  '^GSPC': {
    name: 'S&P 500',
    shortName: 'S&P 500',
    category: 'metals',
    unit: 'pts',
    currency: 'USD',
    relevantSectors: ['financial'],
    sourceUrl: 'https://www.spglobal.com/',
  },
  '^FTSE': {
    name: 'FTSE 100',
    shortName: 'FTSE 100',
    category: 'metals',
    unit: 'pts',
    currency: 'GBp',
    relevantSectors: ['financial'],
    sourceUrl: 'https://www.londonstockexchange.com/',
  },
};

function getSeasonalColor(pressureLabel: string): string {
  switch (pressureLabel) {
    case 'HIGH': return 'text-red-400';
    case 'MODERATE': return 'text-amber-400';
    case 'LOW': return 'text-emerald-400';
    default: return 'text-slate-400';
  }
}

function buildPercentileContext(
  symbol: string,
  price: number,
  percentiles: CommodityPercentile[],
): PercentileContext | undefined {
  const perc = percentiles.find(p => p.commodity_id === symbol);
  if (!perc) return undefined;
  const rank = computePercentileRank(price, perc);
  if (rank == null) return undefined;
  const { label, color, bg } = getPercentileLabel(rank);
  return {
    rank,
    label,
    color,
    bg,
    median: perc.p50 ?? 0,
    p25: perc.p25 ?? 0,
    p75: perc.p75 ?? 0,
    dataSource: perc.data_source,
  };
}

function buildSeasonalContext(
  symbol: string,
  seasonal: SeasonalPattern[],
): SeasonalContext | undefined {
  const pattern = getSeasonalPressure(symbol, seasonal);
  if (!pattern) return undefined;
  return {
    seasonalIndex: pattern.seasonal_index,
    pressureLabel: pattern.pressure_label,
    notes: pattern.notes,
    color: getSeasonalColor(pattern.pressure_label),
  };
}

function quoteToMarketItem(
  q: YahooQuote,
  lastUpdated: string,
  percentiles?: CommodityPercentile[],
  seasonal?: SeasonalPattern[],
): MarketItem | null {
  const cfg = SYMBOL_CONFIG[q.symbol];
  if (!cfg || q.price == null) return null;
  const cp = pct(q.changePercent);
  const signal = signalFromChange(cp);

  const percentileContext = percentiles ? buildPercentileContext(q.symbol, q.price, percentiles) : undefined;
  const seasonalContext = seasonal ? buildSeasonalContext(q.symbol, seasonal) : undefined;

  return {
    id: q.symbol,
    name: cfg.name,
    shortName: cfg.shortName,
    price: q.price,
    currency: cfg.currency,
    unit: cfg.unit,
    change24h: q.change ?? 0,
    changePercent24h: cp,
    changeWeekly: q.change ?? 0,
    changeWeeklyPercent: cp,
    signal,
    rationale: rationale(cfg.shortName, cp),
    source: 'Stooq (via Yahoo Finance)',
    sourceUrl: cfg.sourceUrl,
    lastUpdated,
    history: [],
    category: cfg.category,
    relevantSectors: cfg.relevantSectors,
    percentileContext,
    seasonalContext,
  };
}

export function deriveMarketItems(feeds: FeedPayload | null, historicalContext?: HistoricalContext | null): MarketItem[] {
  if (!feeds) return [];
  const yahooSrc = feeds.sources.find(s => s.source_name === 'Yahoo Finance');
  if (!yahooSrc?.success || !yahooSrc.quotes?.length) return [];
  const lastUpdated = yahooSrc.fetch_time_gmt ?? feeds.fetched_at;
  return yahooSrc.quotes
    .map(q => quoteToMarketItem(q, lastUpdated, historicalContext?.percentiles, historicalContext?.seasonal))
    .filter((x): x is MarketItem => x !== null);
}

const OVERNIGHT_SYMBOL_DISPLAY: { symbol: string; label: string; priceFmt: (p: number) => string }[] = [
  { symbol: 'BZ=F',     label: 'Brent Crude',  priceFmt: p => `$${fmt(p, 2)}` },
  { symbol: 'NG=F',     label: 'Nat. Gas',     priceFmt: p => `$${fmt(p, 3)}` },
  { symbol: 'ZW=F',     label: 'Wheat',        priceFmt: p => `${fmt(p, 0)}¢` },
  { symbol: 'ZC=F',     label: 'Corn',         priceFmt: p => `${fmt(p, 0)}¢` },
  { symbol: 'ZS=F',     label: 'Soybeans',     priceFmt: p => `${fmt(p, 0)}¢` },
  { symbol: 'GC=F',     label: 'Gold',         priceFmt: p => `$${fmt(p, 0)}` },
  { symbol: 'GBPUSD=X', label: 'GBP/USD',      priceFmt: p => fmt(p, 4) },
  { symbol: 'GBPEUR=X', label: 'GBP/EUR',      priceFmt: p => fmt(p, 4) },
  { symbol: '^FTSE',    label: 'FTSE 100',     priceFmt: p => `${fmt(p, 0)}` },
  { symbol: '^GSPC',    label: 'S&P 500',      priceFmt: p => `${fmt(p, 0)}` },
  { symbol: 'DX=F',     label: 'USD Index',    priceFmt: p => fmt(p, 2) },
];

export function deriveOvernightStats(feeds: FeedPayload | null): OvernightStat[] {
  if (!feeds) return [];

  const yahooSrc = feeds.sources.find(s => s.source_name === 'Yahoo Finance');
  if (!yahooSrc?.success || !yahooSrc.quotes?.length) return [];

  const candidates: { label: string; price: number; cp: number; priceFmt: string; absCp: number }[] = [];

  for (const def of OVERNIGHT_SYMBOL_DISPLAY) {
    const q = yahooSrc.quotes.find(qq => qq.symbol === def.symbol);
    if (!q?.price || q.changePercent == null) continue;
    candidates.push({
      label: def.label,
      price: q.price,
      cp: q.changePercent,
      priceFmt: def.priceFmt(q.price),
      absCp: Math.abs(q.changePercent),
    });
  }

  const sorted = [...candidates].sort((a, b) => b.absCp - a.absCp);
  const topMovers = sorted.slice(0, 5);

  const stats: OvernightStat[] = topMovers.map(m => ({
    label: m.label,
    value: m.priceFmt,
    sub: `${m.cp >= 0 ? '+' : ''}${fmt(m.cp, 2)}%`,
    highlight: Math.abs(m.cp) >= 2,
  }));

  const news = feeds.sources.filter(s => s.items && s.items.length > 0);
  const totalHeadlines = news.reduce((acc, s) => acc + (s.items?.length ?? 0), 0);
  if (totalHeadlines > 0) {
    stats.push({ label: 'Headlines', value: String(totalHeadlines), sub: 'scanned' });
  }

  return stats;
}

export function deriveTopMover(feeds: FeedPayload | null): { label: string; cp: number; price: string; signal: Signal } | null {
  if (!feeds) return null;
  const yahooSrc = feeds.sources.find(s => s.source_name === 'Yahoo Finance');
  if (!yahooSrc?.success || !yahooSrc.quotes?.length) return null;

  let best: { label: string; cp: number; price: string; signal: Signal } | null = null;
  let bestAbs = 0;

  for (const def of OVERNIGHT_SYMBOL_DISPLAY) {
    const q = yahooSrc.quotes.find(qq => qq.symbol === def.symbol);
    if (!q?.price || q.changePercent == null) continue;
    const abs = Math.abs(q.changePercent);
    if (abs > bestAbs) {
      bestAbs = abs;
      best = {
        label: def.label,
        cp: q.changePercent,
        price: def.priceFmt(q.price),
        signal: signalFromChange(q.changePercent),
      };
    }
  }
  return best;
}

export function deriveActionItems(feeds: FeedPayload | null): ActionItem[] {
  if (!feeds) return [];

  const actions: ActionItem[] = [];

  const yahooSrc = feeds.sources.find(s => s.source_name === 'Yahoo Finance');
  const brentEia = feeds.sources.find(s => s.source_name === 'EIA Brent Crude');
  const fx = feeds.sources.find(s => s.source_name === 'ExchangeRate.host FX');

  let actionId = 1;

  const brentPrice = brentEia?.success && brentEia.current_price
    ? brentEia.current_price
    : yahooSrc?.quotes?.find(q => q.symbol === 'BZ=F')?.price;
  const brentChangePct = brentEia?.change_pct
    ?? yahooSrc?.quotes?.find(q => q.symbol === 'BZ=F')?.changePercent;

  if (brentPrice != null && brentChangePct != null) {
    const signal = signalFromChange(brentChangePct);
    if (signal === 'BUY') {
      actions.push({
        id: `action-${actionId++}`,
        signal: 'BUY',
        title: `Lock in fuel contracts now — Brent down ${Math.abs(brentChangePct).toFixed(1)}%`,
        detail: `Brent crude is at $${fmt(brentPrice, 2)}/bbl, down ${Math.abs(brentChangePct).toFixed(1)}% overnight. This is a meaningful dip — call your fuel supplier before markets open and lock in forward contracts at today's rate. Prices could recover once European trading begins.`,
        market: 'Energy / Fuel',
        evidence: `Brent crude at $${fmt(brentPrice, 2)}/bbl (${brentChangePct >= 0 ? '+' : ''}${fmt(brentChangePct, 2)}% overnight). EIA daily spot data.`,
        source: brentEia?.success ? 'EIA Brent Crude Spot' : 'Stooq/Yahoo Finance',
        relevantSectors: ['food_importer', 'chemicals', 'freight_3pl', 'construction'],
        roi: {
          savingAmount: Math.round(50000 * (Math.abs(brentChangePct) / 100) * brentPrice * 0.001),
          tonnage: 50000,
          priceMove: parseFloat(fmt(Math.abs(brentChangePct / 100) * brentPrice, 2)),
          unit: 'litres',
          deadline: 'Today — before European close',
          annualSubscriptionCost: 588,
          multiplier: Math.max(1, Math.round((50000 * (Math.abs(brentChangePct) / 100) * brentPrice * 0.001) / 588)),
        },
      });
    } else if (signal === 'URGENT') {
      actions.push({
        id: `action-${actionId++}`,
        signal: 'URGENT',
        title: `Fuel cost spike — Brent up ${brentChangePct.toFixed(1)}% overnight`,
        detail: `Brent crude has moved ${brentChangePct.toFixed(1)}% higher to $${fmt(brentPrice, 2)}/bbl. Any unhedged fuel, diesel, or energy contracts are now more expensive in real terms. Review your open exposure immediately and consider whether to hedge or bring forward any planned fuel purchases before prices move further.`,
        market: 'Energy / Fuel',
        evidence: `Brent at $${fmt(brentPrice, 2)}/bbl, +${fmt(brentChangePct, 2)}% overnight move. EIA/Stooq data.`,
        source: brentEia?.success ? 'EIA Brent Crude Spot' : 'Stooq/Yahoo Finance',
        relevantSectors: ['food_importer', 'chemicals', 'freight_3pl', 'construction', 'financial'],
      });
    } else if (signal === 'WATCH') {
      actions.push({
        id: `action-${actionId++}`,
        signal: 'WATCH',
        title: `Energy moving — Brent ${brentChangePct >= 0 ? 'up' : 'down'} ${Math.abs(brentChangePct).toFixed(1)}%`,
        detail: `Brent crude at $${fmt(brentPrice, 2)}/bbl (${brentChangePct >= 0 ? '+' : ''}${fmt(brentChangePct, 2)}% overnight). The move is directional but not yet at action threshold. Monitor through the morning — if it continues in this direction, a procurement call will be warranted.`,
        market: 'Energy / Fuel',
        evidence: `Brent at $${fmt(brentPrice, 2)}/bbl. Overnight change: ${brentChangePct >= 0 ? '+' : ''}${fmt(brentChangePct, 2)}%.`,
        source: brentEia?.success ? 'EIA Brent Crude Spot' : 'Stooq/Yahoo Finance',
        relevantSectors: ['chemicals', 'freight_3pl', 'construction', 'financial'],
      });
    }
  }

  if (yahooSrc?.success) {
    const wheat = yahooSrc.quotes?.find(q => q.symbol === 'ZW=F');
    if (wheat?.price != null && wheat.changePercent != null) {
      const cp = wheat.changePercent;
      const signal = signalFromChange(cp);
      if (signal === 'BUY') {
        actions.push({
          id: `action-${actionId++}`,
          signal: 'BUY',
          title: `Grain buying window — Wheat down ${Math.abs(cp).toFixed(1)}% overnight`,
          detail: `CBOT Wheat is at ${fmt(wheat.price, 0)}¢/bu, down ${Math.abs(cp).toFixed(1)}% overnight. If you have grain requirements in the next 1–3 months — whether for food production, animal feed, or next season's fertilizer planning — this dip could represent a meaningful saving. Contact your supplier or trader for today's available forward cover.`,
          market: 'Agricultural / Grain',
          evidence: `CBOT Wheat at ${fmt(wheat.price, 0)}¢/bu (${cp >= 0 ? '+' : ''}${fmt(cp, 2)}% overnight). Stooq/CBOT data.`,
          source: 'Stooq via Yahoo Finance',
          relevantSectors: ['food_importer', 'financial'],
        });
      } else if (signal === 'URGENT') {
        actions.push({
          id: `action-${actionId++}`,
          signal: 'URGENT',
          title: `Grain prices rising — Wheat up ${cp.toFixed(1)}% overnight`,
          detail: `CBOT Wheat has moved ${cp.toFixed(1)}% higher to ${fmt(wheat.price, 0)}¢/bu overnight. For UK food importers and supermarket suppliers, this feeds directly into next season's input pricing and could put further pressure on already-sensitive food inflation. Review your grain procurement position before the London open and check whether to bring forward any planned purchases.`,
          market: 'Agricultural / Grain',
          evidence: `CBOT Wheat at ${fmt(wheat.price, 0)}¢/bu, +${fmt(cp, 2)}% overnight. Stooq/CBOT data.`,
          source: 'Stooq via Yahoo Finance',
          relevantSectors: ['food_importer', 'financial'],
        });
      } else if (signal === 'WATCH') {
        actions.push({
          id: `action-${actionId++}`,
          signal: 'WATCH',
          title: `Grain softening — Wheat ${cp >= 0 ? 'up' : 'down'} ${Math.abs(cp).toFixed(1)}% overnight`,
          detail: `CBOT Wheat at ${fmt(wheat.price, 0)}¢/bu (${cp >= 0 ? '+' : ''}${fmt(cp, 2)}%). A modest but directional overnight move. UK food importers and supermarket suppliers should track this — if the move continues, it will feed into fertilizer cost planning and next season's crop input pricing. Watch for further movement before acting.`,
          market: 'Agricultural / Grain',
          evidence: `CBOT Wheat at ${fmt(wheat.price, 0)}¢/bu. Overnight change: ${fmt(cp, 2)}%.`,
          source: 'Stooq via Yahoo Finance',
          relevantSectors: ['food_importer', 'financial'],
        });
      }
    }

    const ng = yahooSrc.quotes?.find(q => q.symbol === 'NG=F');
    if (ng?.price != null && ng.changePercent != null) {
      const cp = ng.changePercent;
      const signal = signalFromChange(cp);
      if (signal === 'BUY' || signal === 'URGENT' || signal === 'WATCH') {
        actions.push({
          id: `action-${actionId++}`,
          signal,
          title: `Natural gas ${cp < 0 ? 'falls' : 'rises'} ${Math.abs(cp).toFixed(1)}% — review gas and fertiliser exposure`,
          detail: `NYMEX Natural Gas is at $${fmt(ng.price, 3)}/MMBtu (${cp >= 0 ? '+' : ''}${fmt(cp, 2)}% overnight). ${cp < 0 ? 'A dip creates a potential buying window for forward gas or energy contracts. Natural gas is also a key feedstock for chemical and plastics manufacturers — and prices feed directly into fertiliser costs.' : 'Rising gas prices increase feedstock costs for chemical and plastics manufacturers, raise fertiliser input costs, and push up energy bills across manufacturing. Check your exposure on both fronts before the London open.'}`,
          market: 'Energy / Gas',
          evidence: `NYMEX Natural Gas: $${fmt(ng.price, 3)}/MMBtu, ${cp >= 0 ? '+' : ''}${fmt(cp, 2)}% overnight.`,
          source: 'Stooq via Yahoo Finance',
          relevantSectors: ['chemicals', 'food_importer', 'construction', 'financial'],
        });
      }
    }

    const gbpUsdQ = yahooSrc.quotes?.find(q => q.symbol === 'GBPUSD=X');
    const gbpUsdRate = fx?.success && fx.gbp_usd ? fx.gbp_usd : gbpUsdQ?.price;
    const gbpUsdChange = gbpUsdQ?.changePercent ?? 0;
    if (gbpUsdRate) {
      if (gbpUsdRate < 1.22 || gbpUsdChange <= -0.5) {
        actions.push({
          id: `action-${actionId++}`,
          signal: gbpUsdChange <= -1.5 ? 'URGENT' : 'WATCH',
          title: `Sterling ${gbpUsdChange < 0 ? 'weakening' : 'weak'} at ${fmt(gbpUsdRate, 4)} — USD commodity costs rising`,
          detail: `GBP/USD is at ${fmt(gbpUsdRate, 4)}${gbpUsdChange !== 0 ? ` (${gbpUsdChange >= 0 ? '+' : ''}${fmt(gbpUsdChange, 2)}% overnight)` : ''}. All USD-priced commodities — oil, grain, metals — are now more expensive in sterling terms. For SME freight forwarders with USD-denominated war risk surcharges, this compounds margin pressure. For IFAs, it will affect client portfolios exposed to dollar assets. Review any upcoming USD-denominated purchases and consider whether to accelerate or hedge.`,
          market: 'FX / GBP',
          evidence: `GBP/USD at ${fmt(gbpUsdRate, 4)}. ${gbpUsdChange !== 0 ? `Overnight move: ${fmt(gbpUsdChange, 2)}%.` : 'Source: open.er-api.com interbank mid-rate.'}`,
          source: gbpUsdQ ? 'Stooq via Yahoo Finance' : 'ExchangeRate.host',
          relevantSectors: ['food_importer', 'freight_3pl', 'chemicals', 'construction', 'financial'],
        });
      }
    }

    const corn = yahooSrc.quotes?.find(q => q.symbol === 'ZC=F');
    if (corn?.price != null && corn.changePercent != null) {
      const cp = corn.changePercent;
      const signal = signalFromChange(cp);
      if (signal === 'BUY' || signal === 'URGENT') {
        actions.push({
          id: `action-${actionId++}`,
          signal,
          title: `Corn ${cp < 0 ? 'dips' : 'spikes'} ${Math.abs(cp).toFixed(1)}% overnight`,
          detail: `CBOT Corn at ${fmt(corn.price, 0)}¢/bu (${cp >= 0 ? '+' : ''}${fmt(cp, 2)}% overnight). ${cp < 0 ? 'A buying opportunity may be developing for feed or food-grade corn — contact your supplier for availability and forward cover pricing.' : 'Rising corn prices will feed through to animal feed costs and food input pricing. For UK food importers this compounds fertilizer-driven margin pressure. Review your forward cover position before the London open.'}`,
          market: 'Agricultural / Grain',
          evidence: `CBOT Corn at ${fmt(corn.price, 0)}¢/bu, ${cp >= 0 ? '+' : ''}${fmt(cp, 2)}% overnight.`,
          source: 'Stooq via Yahoo Finance',
          relevantSectors: ['food_importer', 'financial'],
        });
      }
    }

    const gold = yahooSrc.quotes?.find(q => q.symbol === 'GC=F');
    if (gold?.price != null && gold.changePercent != null) {
      const cp = gold.changePercent;
      if (Math.abs(cp) >= 1) {
        actions.push({
          id: `action-${actionId++}`,
          signal: cp >= 2 ? 'URGENT' : 'WATCH',
          title: `Gold ${cp < 0 ? 'falls' : 'rises'} ${Math.abs(cp).toFixed(1)}% — risk sentiment indicator`,
          detail: `Gold is at $${fmt(gold.price, 0)}/oz (${cp >= 0 ? '+' : ''}${fmt(cp, 2)}% overnight). ${cp > 0 ? 'Rising gold typically signals risk-off sentiment or geopolitical stress — relevant context for IFAs and portfolio managers managing client exposure ahead of the London open. Watch for correlated moves in oil and freight war risk premiums.' : 'Falling gold may signal reduced geopolitical risk premium — a positive signal for IFAs. Could ease pressure on energy prices and freight war risk surcharges.'}`,
          market: 'Metals / Gold',
          evidence: `COMEX Gold: $${fmt(gold.price, 0)}/oz, ${cp >= 0 ? '+' : ''}${fmt(cp, 2)}% overnight.`,
          source: 'Stooq via Yahoo Finance',
          relevantSectors: ['financial'],
        });
      }
    }
  } else if (fx?.success && fx.gbp_usd) {
    const gbpUsd = fx.gbp_usd;
    if (gbpUsd < 1.22) {
      actions.push({
        id: `action-${actionId++}`,
        signal: 'WATCH',
        title: `Sterling weak at ${fmt(gbpUsd, 4)} — USD commodity costs elevated`,
        detail: `GBP/USD at ${fmt(gbpUsd, 4)}. USD-priced commodities (oil, grain, metals) are more expensive in sterling terms at this level. SME freight forwarders face compounded margin pressure where war risk surcharges are USD-denominated. Review upcoming USD purchases and consider hedging options.`,
        market: 'FX / GBP',
        evidence: `GBP/USD at ${fmt(gbpUsd, 4)}. Source: open.er-api.com interbank mid-rate.`,
        source: 'ExchangeRate.host',
        relevantSectors: ['food_importer', 'freight_3pl', 'chemicals', 'construction', 'financial'],
      });
    }
  }

  if (yahooSrc?.success) {
    const ng = yahooSrc.quotes?.find(q => q.symbol === 'NG=F');
    const brentPct = brentEia?.change_pct ?? yahooSrc?.quotes?.find(q => q.symbol === 'BZ=F')?.changePercent ?? 0;
    if (ng?.price != null && ng.changePercent != null && Math.abs(ng.changePercent) >= 0.5) {
      const cp = ng.changePercent;
      const fertilizerSignal = signalFromChange(cp);
      if (fertilizerSignal !== 'HOLD') {
        actions.push({
          id: `action-${actionId++}`,
          signal: fertilizerSignal,
          title: `Fertilizer feedstock costs ${cp > 0 ? 'rising' : 'falling'} — natural gas ${cp > 0 ? 'up' : 'down'} ${Math.abs(cp).toFixed(1)}%`,
          detail: `Natural gas drives ~70–80% of urea and ammonia production costs. With NYMEX gas at $${fmt(ng.price, 3)}/MMBtu (${cp >= 0 ? '+' : ''}${fmt(cp, 2)}% overnight), expect fertilizer pricing to move in the same direction. UK food importers and supermarket suppliers should factor this into next season's crop input cost projections — fertilizer pricing typically lags gas by 4–8 weeks.`,
          market: 'Fertilizer / Gas Feedstock',
          evidence: `NYMEX Natural Gas: $${fmt(ng.price, 3)}/MMBtu, ${cp >= 0 ? '+' : ''}${fmt(cp, 2)}% overnight. Brent crude: ${brentPct >= 0 ? '+' : ''}${fmt(brentPct, 2)}%.`,
          source: 'Stooq via Yahoo Finance',
          relevantSectors: ['food_importer', 'chemicals', 'financial'],
        });
      }
    }

    const freightKeywords = ['red sea', 'houthi', 'suez', 'war risk', 'surcharge', 'divert', 'reroute'];
    const hasFreightAlert = feeds?.sources.some(s =>
      s.items?.some(i => freightKeywords.some(k => (i.title + ' ' + i.summary).toLowerCase().includes(k)))
    ) ?? false;

    if (hasFreightAlert) {
      actions.push({
        id: `action-${actionId++}`,
        signal: 'URGENT',
        title: 'War risk surcharges elevated — Red Sea / Suez situation active',
        detail: `Live news feeds are showing active Red Sea or Suez Canal disruption signals. CMA CGM and Hapag-Lloyd war risk surcharges are likely in effect, hitting SME freight forwarder and 3PL margins before they can reprice customers. Contact your shipping lines immediately to confirm current surcharge levels and assess whether to reroute via Cape of Good Hope for any pending shipments.`,
        market: 'Freight / War Risk',
        evidence: 'Red Sea / Suez disruption keywords detected across live news feeds.',
        source: 'Reuters / Al Jazeera / Shipping RSS',
        relevantSectors: ['freight_3pl', 'food_importer', 'construction', 'financial'],
      });
    }
  }

  return actions;
}

function severityFromKeywords(title: string, summary: string): 'critical' | 'high' | 'medium' {
  const text = (title + ' ' + summary).toLowerCase();
  const criticalTerms = ['war', 'attack', 'explosion', 'sanctions', 'conflict', 'strike', 'blockade', 'tanker attacked', 'hormuz', 'red sea'];
  const highTerms = ['surge', 'spike', 'shortage', 'crisis', 'ban', 'tariff', 'drought', 'flood', 'opec cut'];
  if (criticalTerms.some(t => text.includes(t))) return 'critical';
  if (highTerms.some(t => text.includes(t))) return 'high';
  return 'medium';
}

function affectedMarketsFromText(title: string, summary: string): string[] {
  const text = (title + ' ' + summary).toLowerCase();
  const markets: string[] = [];
  if (text.includes('oil') || text.includes('crude') || text.includes('brent') || text.includes('petroleum')) markets.push('Oil');
  if (text.includes('gas') || text.includes('lng') || text.includes('natural gas')) markets.push('Gas');
  if (text.includes('wheat') || text.includes('grain') || text.includes('cereal') || text.includes('corn')) markets.push('Grain');
  if (text.includes('shipping') || text.includes('freight') || text.includes('tanker')) markets.push('Freight');
  if (text.includes('fertiliser') || text.includes('fertilizer') || text.includes('urea') || text.includes('ammonia')) markets.push('Fertilizer');
  if (text.includes('gbp') || text.includes('sterling') || text.includes('dollar') || text.includes('fx') || text.includes('currency')) markets.push('FX');
  if (markets.length === 0) markets.push('Commodities');
  return markets;
}

export function deriveMorningAlerts(feeds: FeedPayload | null): MorningAlert[] {
  if (!feeds) return [];

  const alerts: MorningAlert[] = [];
  let alertId = 1;

  const urgentNewsSources = [
    'Al Jazeera RSS',
    'BBC Business RSS',
    'Guardian Business RSS',
    'MarketWatch RSS',
    'Financial Times RSS',
  ];

  const criticalKeywords = ['war', 'attack', 'explosion', 'sanctions', 'conflict', 'strike', 'blockade', 'tanker attacked', 'hormuz', 'red sea', 'surge', 'spike', 'shortage', 'crisis', 'ban', 'tariff'];

  for (const sourceName of urgentNewsSources) {
    const src = feeds.sources.find(s => s.source_name === sourceName);
    if (!src?.success || !src.items?.length) continue;

    for (const item of src.items.slice(0, 3)) {
      const text = (item.title + ' ' + item.summary).toLowerCase();
      if (!criticalKeywords.some(k => text.includes(k))) continue;

      const severity = severityFromKeywords(item.title, item.summary);
      const affectedMarkets = affectedMarketsFromText(item.title, item.summary);

      alerts.push({
        id: `alert-${alertId++}`,
        severity,
        title: item.title,
        body: item.summary || item.title,
        source: sourceName.replace(' RSS', ''),
        affectedMarkets,
        timestamp: item.published || feeds.fetched_at,
        geopoliticalContext: text.includes('iran') || text.includes('hormuz') || text.includes('red sea') || text.includes('houthi')
          ? 'Middle East / Strait of Hormuz situation — monitor for oil supply disruption risk'
          : undefined,
      });

      if (alerts.length >= 5) break;
    }
    if (alerts.length >= 5) break;
  }

  return alerts.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2 };
    return order[a.severity] - order[b.severity];
  });
}

const CONFLICT_ZONE_CONFIGS: {
  id: string;
  region: string;
  subRegion?: string;
  keywords: string[];
  affectedCommodities: string[];
  affectedRoutes: string[];
  supplyImpact: string;
  baseRisk: ConflictRiskLevel;
}[] = [
  {
    id: 'middle-east-gulf',
    region: 'Middle East / Persian Gulf',
    subRegion: 'Strait of Hormuz',
    keywords: ['iran', 'hormuz', 'gulf', 'persian', 'strait', 'tanker', 'opec', 'saudi'],
    affectedCommodities: ['Brent Crude', 'LNG', 'Natural Gas'],
    affectedRoutes: ['Strait of Hormuz', 'Persian Gulf VLCC lanes'],
    supplyImpact: '~20% of global oil transit; disruption adds $10–30/bbl',
    baseRisk: 'ELEVATED',
  },
  {
    id: 'red-sea-yemen',
    region: 'Red Sea / Yemen',
    subRegion: 'Bab-el-Mandeb Strait',
    keywords: ['red sea', 'houthi', 'yemen', 'bab-el-mandeb', 'suez', 'shipping lane'],
    affectedCommodities: ['Container Freight', 'Grain', 'Brent Crude'],
    affectedRoutes: ['Red Sea shipping lane', 'Suez Canal corridor'],
    supplyImpact: '12–15% of global trade; diversions add 10–14 days & 20–30% freight cost',
    baseRisk: 'HIGH',
  },
  {
    id: 'ukraine-russia',
    region: 'Eastern Europe',
    subRegion: 'Ukraine / Black Sea',
    keywords: ['ukraine', 'russia', 'black sea', 'grain corridor', 'kherson', 'odessa', 'crimea'],
    affectedCommodities: ['Wheat', 'Corn', 'Sunflower Oil', 'Fertilizer'],
    affectedRoutes: ['Black Sea grain export routes', 'Odessa port corridor'],
    supplyImpact: 'Ukraine ~10% of global wheat exports; ongoing disruption elevates grain prices',
    baseRisk: 'HIGH',
  },
  {
    id: 'sahel-africa',
    region: 'West Africa / Sahel',
    subRegion: 'Mali, Niger, Burkina Faso',
    keywords: ['sahel', 'mali', 'niger', 'burkina', 'coup', 'militia', 'jihadist', 'west africa'],
    affectedCommodities: ['Cocoa', 'Cotton', 'Gold', 'Agricultural Inputs'],
    affectedRoutes: ['Trans-Saharan trade routes'],
    supplyImpact: 'Agricultural supply disruption; cocoa & cotton export risk',
    baseRisk: 'MODERATE',
  },
  {
    id: 'israel-gaza',
    region: 'Eastern Mediterranean',
    subRegion: 'Israel / Gaza / Lebanon',
    keywords: ['israel', 'gaza', 'hamas', 'hezbollah', 'lebanon', 'west bank', 'idf'],
    affectedCommodities: ['Brent Crude', 'Freight Insurance', 'LNG'],
    affectedRoutes: ['Eastern Mediterranean shipping', 'Israel port access'],
    supplyImpact: 'Regional energy risk premium; freight insurance surcharges elevated',
    baseRisk: 'HIGH',
  },
  {
    id: 'taiwan-strait',
    region: 'East Asia',
    subRegion: 'Taiwan Strait',
    keywords: ['taiwan', 'china', 'pla', 'strait', 'semiconductor', 'blockade', 'beijing'],
    affectedCommodities: ['Semiconductors', 'Electronics', 'LNG'],
    affectedRoutes: ['Taiwan Strait', 'South China Sea'],
    supplyImpact: 'Potential blockade risk to global semiconductor supply chains',
    baseRisk: 'MODERATE',
  },
];

function scoreConflictZone(
  config: typeof CONFLICT_ZONE_CONFIGS[0],
  allItems: { title: string; summary: string; published: string; link: string; source: string }[],
  fetchedAt: string,
  baselines?: ConflictZoneBaseline[],
): ConflictZone | null {
  const matches = allItems.filter(item => {
    const text = (item.title + ' ' + item.summary).toLowerCase();
    return config.keywords.some(k => text.includes(k));
  });
  if (matches.length === 0) return null;

  const escalationKeywords = ['attack', 'strike', 'explosion', 'killed', 'missile', 'war', 'blockade', 'seized', 'crisis'];
  const escalationCount = matches.filter(m =>
    escalationKeywords.some(k => (m.title + ' ' + m.summary).toLowerCase().includes(k))
  ).length;

  const riskLevels: ConflictRiskLevel[] = ['LOW', 'MODERATE', 'ELEVATED', 'HIGH', 'CRITICAL'];
  const baseIdx = riskLevels.indexOf(config.baseRisk);
  const boost = escalationCount >= 3 ? 2 : escalationCount >= 1 ? 1 : 0;
  const riskLevel = riskLevels[Math.min(4, baseIdx + boost)];

  const best = matches[0];

  let intensity: ConflictIntensity | undefined;
  if (baselines) {
    const baseline = getConflictBaseline(config.id, baselines);
    if (baseline) {
      const scored = scoreVsBaseline(matches.length, baseline);
      const comparableEvents = baseline.comparable_events ?? [];
      const topEvent = comparableEvents.length > 0
        ? `${comparableEvents[0].year}: ${comparableEvents[0].event}`
        : null;
      intensity = {
        vsBaseline: scored.vsBaseline,
        label: scored.label,
        color: scored.color,
        historicalImpactPct: baseline.historical_commodity_impact_pct ?? null,
        topComparableEvent: topEvent,
      };
    }
  }

  return {
    id: config.id,
    region: config.region,
    subRegion: config.subRegion,
    riskLevel,
    affectedCommodities: config.affectedCommodities,
    affectedRoutes: config.affectedRoutes,
    latestHeadline: best.title,
    headlineSource: best.source,
    headlineLink: best.link,
    lastUpdated: best.published || fetchedAt,
    evidenceCount: matches.length,
    supplyImpact: config.supplyImpact,
    intensity,
  };
}

export function deriveConflictZones(feeds: FeedPayload | null, historicalContext?: HistoricalContext | null): ConflictZone[] {
  if (!feeds) return [];

  const conflictSources = ['Reuters World RSS', 'Al Jazeera RSS', 'BBC Business RSS', 'ReliefWeb Conflict RSS', 'Guardian Business RSS', 'MarketWatch RSS', 'Shipping RSS'];
  const allItems: { title: string; summary: string; published: string; link: string; source: string }[] = [];

  for (const srcName of conflictSources) {
    const src = feeds.sources.find(s => s.source_name === srcName);
    if (!src?.success || !src.items?.length) continue;
    for (const item of src.items) {
      allItems.push({ ...item, source: srcName.replace(' RSS', '') });
    }
  }

  const zones: ConflictZone[] = [];
  for (const config of CONFLICT_ZONE_CONFIGS) {
    const zone = scoreConflictZone(config, allItems, feeds.fetched_at, historicalContext?.conflictBaselines);
    if (zone) zones.push(zone);
  }

  const order: Record<ConflictRiskLevel, number> = { CRITICAL: 0, HIGH: 1, ELEVATED: 2, MODERATE: 3, LOW: 4 };
  return zones.sort((a, b) => order[a.riskLevel] - order[b.riskLevel]);
}

const SUPPLY_EXPOSURE_BASE: Omit<SupplyExposureItem, 'exposureScore' | 'topRisk' | 'linkedZones'>[] = [
  {
    market: 'Brent Crude / Fuel',
    category: 'energy',
    conflictProximity: 85,
    supplyConcentration: 70,
    ukImportDependency: 60,
    mitigationNote: 'Forward fuel contracts, strategic reserve monitoring',
  },
  {
    market: 'Natural Gas',
    category: 'energy',
    conflictProximity: 75,
    supplyConcentration: 65,
    ukImportDependency: 55,
    mitigationNote: 'LNG spot market exposure; diversify to North Sea contracts',
  },
  {
    market: 'Wheat / Grain',
    category: 'agricultural',
    conflictProximity: 80,
    supplyConcentration: 75,
    ukImportDependency: 45,
    mitigationNote: 'Consider forward purchases when CBOT wheat falls below 600¢',
  },
  {
    market: 'Container Freight',
    category: 'freight',
    conflictProximity: 90,
    supplyConcentration: 50,
    ukImportDependency: 70,
    mitigationNote: 'Build 4–6 week buffer stock; pre-book freight capacity early',
  },
  {
    market: 'Fertilizer / Urea',
    category: 'fertilizer',
    conflictProximity: 70,
    supplyConcentration: 80,
    ukImportDependency: 65,
    mitigationNote: 'Diversify away from Russian/Belarusian potash sources',
  },
];

export function deriveSupplyExposure(feeds: FeedPayload | null): SupplyExposureItem[] {
  if (!feeds) return [];

  const conflictZones = deriveConflictZones(feeds);
  const brentQ = feeds.sources.find(s => s.source_name === 'Yahoo Finance')?.quotes?.find(q => q.symbol === 'BZ=F');
  const brentPct = brentQ?.changePercent ?? 0;
  const wheatQ = feeds.sources.find(s => s.source_name === 'Yahoo Finance')?.quotes?.find(q => q.symbol === 'ZW=F');
  const wheatPct = wheatQ?.changePercent ?? 0;
  const ngQ = feeds.sources.find(s => s.source_name === 'Yahoo Finance')?.quotes?.find(q => q.symbol === 'NG=F');
  const ngPct = ngQ?.changePercent ?? 0;
  const shippingSrc = feeds.sources.find(s => s.source_name === 'Shipping RSS');
  const hasShippingAlert = shippingSrc?.items?.some(i =>
    ['attack', 'divert', 'avoid', 'surge', 'spike', 'congestion', 'delay'].some(k =>
      (i.title + i.summary).toLowerCase().includes(k)
    )
  ) ?? false;

  const priceBoosts: Record<string, number> = {
    'Brent Crude / Fuel': Math.min(15, Math.abs(brentPct) * 1.5),
    'Natural Gas': Math.min(15, Math.abs(ngPct) * 1.5),
    'Wheat / Grain': Math.min(15, Math.abs(wheatPct) * 1.5),
    'Container Freight': hasShippingAlert ? 12 : 0,
    'Fertilizer / Urea': Math.min(10, (Math.abs(ngPct) + Math.abs(wheatPct)) * 0.5),
  };

  const zoneLinkedMarkets: Record<string, string[]> = {
    'Brent Crude / Fuel': ['middle-east-gulf', 'red-sea-yemen', 'israel-gaza'],
    'Natural Gas': ['middle-east-gulf', 'ukraine-russia'],
    'Wheat / Grain': ['ukraine-russia', 'sahel-africa'],
    'Container Freight': ['red-sea-yemen', 'taiwan-strait'],
    'Fertilizer / Urea': ['ukraine-russia'],
  };

  const activeZoneIds = new Set(conflictZones.map(z => z.id));

  return SUPPLY_EXPOSURE_BASE.map(base => {
    const linked = (zoneLinkedMarkets[base.market] ?? []).filter(id => activeZoneIds.has(id));
    const zoneBoost = linked.length * 5;
    const rawScore = (base.conflictProximity * 0.4 + base.supplyConcentration * 0.35 + base.ukImportDependency * 0.25)
      + (priceBoosts[base.market] ?? 0) + zoneBoost;
    const exposureScore = Math.min(100, Math.round(rawScore));

    const topZone = conflictZones.find(z => linked.includes(z.id));
    const priceChange = priceBoosts[base.market] > 5 ? ` — price moving ${priceBoosts[base.market].toFixed(0)}pts above baseline` : '';
    const topRisk = topZone
      ? `${topZone.region} (${topZone.riskLevel})${priceChange}`
      : `Supply concentration risk${priceChange}`;

    return { ...base, exposureScore, topRisk, linkedZones: linked };
  }).sort((a, b) => b.exposureScore - a.exposureScore);
}

const PLAYBOOK_TEMPLATES: Omit<ContingencyScenario, 'active' | 'activationEvidence' | 'lastReviewed'>[] = [
  {
    id: 'playbook-brent-spike',
    trigger: 'PRICE_SPIKE',
    title: 'Brent Crude Spike Response',
    condition: 'Brent crude rises >3% in a single session',
    severity: 'critical',
    steps: [
      { order: 1, action: 'Review all open and upcoming fuel/energy contracts for unhedged exposure', owner: 'Procurement Lead', deadline: 'Within 2 hours' },
      { order: 2, action: 'Contact fuel suppliers to confirm fixed-price availability on remaining open volumes', owner: 'Buyer', deadline: 'Same day' },
      { order: 3, action: 'Calculate total GBP impact of sustained +5% Brent on annual fuel spend', owner: 'Finance', deadline: 'Same day' },
      { order: 4, action: 'Escalate to CFO if unhedged exposure exceeds £50,000 annualised', owner: 'Procurement Lead', deadline: 'Before close of business' },
      { order: 5, action: 'Document rationale and decision in procurement log', owner: 'Buyer', deadline: 'End of day' },
    ],
    affectedMarkets: ['Energy / Fuel', 'Freight', 'Agricultural Inputs'],
  },
  {
    id: 'playbook-grain-disruption',
    trigger: 'SUPPLY_DISRUPTION',
    title: 'Grain Supply Disruption',
    condition: 'Wheat up >3% OR Ukrainian Black Sea grain corridor threatened',
    severity: 'high',
    steps: [
      { order: 1, action: 'Assess current grain stock levels vs forward order requirements', owner: 'Buyer', deadline: 'Same day' },
      { order: 2, action: 'Contact 2–3 alternative grain suppliers for spot pricing and availability', owner: 'Buyer', deadline: 'Within 24 hours' },
      { order: 3, action: 'Evaluate forward purchase options (3–6 month contracts)', owner: 'Procurement Lead', deadline: 'Within 48 hours' },
      { order: 4, action: 'Review product formulations for wheat substitution possibilities', owner: 'Technical', deadline: 'Within 1 week' },
    ],
    affectedMarkets: ['Grain / Feed', 'Food Production', 'Fertilizer'],
  },
  {
    id: 'playbook-freight-surge',
    trigger: 'FREIGHT_SURGE',
    title: 'Freight Cost Surge',
    condition: 'Red Sea / Suez diversions in effect OR container rates up >20%',
    severity: 'high',
    steps: [
      { order: 1, action: 'Identify all inbound shipments transiting Red Sea / Suez Canal', owner: 'Logistics', deadline: 'Within 4 hours' },
      { order: 2, action: 'Contact freight forwarders for current rate quotes and transit time impacts', owner: 'Logistics', deadline: 'Same day' },
      { order: 3, action: 'Assess buffer stock levels — can any shipments be delayed without operational impact?', owner: 'Operations', deadline: 'Same day' },
      { order: 4, action: 'Negotiate fixed-rate freight contracts for next 90 days if rates are below Q+1 forward curve', owner: 'Procurement Lead', deadline: 'Within 48 hours' },
      { order: 5, action: 'Review Incoterms on supplier contracts — ensure freight cost exposure is understood', owner: 'Procurement Lead', deadline: 'Within 1 week' },
    ],
    affectedMarkets: ['Container Freight', 'Fuel', 'General Supply Chain'],
  },
  {
    id: 'playbook-gbp-weakness',
    trigger: 'FX_STRESS',
    title: 'Sterling Weakness Protocol',
    condition: 'GBP/USD falls below 1.20 or drops >1.5% in a session',
    severity: 'medium',
    steps: [
      { order: 1, action: 'Calculate total USD-denominated purchase exposure for next 90 days', owner: 'Finance', deadline: 'Same day' },
      { order: 2, action: 'Review open USD invoices — can any be prepaid at today\'s rate?', owner: 'Finance', deadline: 'Same day' },
      { order: 3, action: 'Explore FX forward contracts with treasury/bank to lock in current rate', owner: 'Finance Lead', deadline: 'Within 48 hours' },
      { order: 4, action: 'Flag to suppliers any contracts with GBP pricing clauses that may be triggered', owner: 'Procurement Lead', deadline: 'Within 48 hours' },
    ],
    affectedMarkets: ['FX / GBP', 'Energy', 'Agricultural Commodities'],
  },
  {
    id: 'playbook-geopolitical-escalation',
    trigger: 'GEOPOLITICAL',
    title: 'Geopolitical Escalation Response',
    condition: 'Major conflict event affecting key supply routes or production zones',
    severity: 'critical',
    steps: [
      { order: 1, action: 'Convene emergency procurement review — identify all affected supply categories', owner: 'CPO', deadline: 'Within 2 hours' },
      { order: 2, action: 'Map supply routes for top 10 spend categories against conflict zone', owner: 'Procurement Lead', deadline: 'Within 4 hours' },
      { order: 3, action: 'Contact strategic suppliers to confirm continuity of supply and current pricing', owner: 'Buyers', deadline: 'Within 24 hours' },
      { order: 4, action: 'Assess inventory build-up feasibility for critical materials (4–8 week buffer)', owner: 'Operations', deadline: 'Within 48 hours' },
      { order: 5, action: 'Identify and pre-qualify alternative suppliers in non-affected regions', owner: 'Procurement Lead', deadline: 'Within 1 week' },
      { order: 6, action: 'Report to board with exposure summary, actions taken, and cost projections', owner: 'CPO', deadline: 'Within 1 week' },
    ],
    affectedMarkets: ['All categories — review based on specific conflict zone'],
  },
];

function checkPlaybookActivation(
  scenario: typeof PLAYBOOK_TEMPLATES[0],
  feeds: FeedPayload,
): { active: boolean; evidence?: string } {
  const yahooSrc = feeds.sources.find(s => s.source_name === 'Yahoo Finance');
  const brentEia = feeds.sources.find(s => s.source_name === 'EIA Brent Crude');
  const fx = feeds.sources.find(s => s.source_name === 'ExchangeRate.host FX');

  if (scenario.trigger === 'PRICE_SPIKE') {
    const brentPct = brentEia?.change_pct ?? yahooSrc?.quotes?.find(q => q.symbol === 'BZ=F')?.changePercent ?? 0;
    const brentPrice = brentEia?.current_price ?? yahooSrc?.quotes?.find(q => q.symbol === 'BZ=F')?.price ?? 0;
    if (brentPct >= 3) {
      return { active: true, evidence: `Brent at $${brentPrice.toFixed(2)}/bbl, +${brentPct.toFixed(2)}% this session` };
    }
  }

  if (scenario.trigger === 'SUPPLY_DISRUPTION') {
    const wheatPct = yahooSrc?.quotes?.find(q => q.symbol === 'ZW=F')?.changePercent ?? 0;
    const wheatPrice = yahooSrc?.quotes?.find(q => q.symbol === 'ZW=F')?.price ?? 0;
    const allSources = ['Reuters World RSS', 'Al Jazeera RSS', 'ReliefWeb Conflict RSS'];
    const ukraineInNews = allSources.some(sn => {
      const src = feeds.sources.find(s => s.source_name === sn);
      return src?.items?.some(i => ['ukraine', 'black sea', 'grain corridor', 'odessa'].some(k =>
        (i.title + i.summary).toLowerCase().includes(k)
      ));
    });
    if (wheatPct >= 3) return { active: true, evidence: `Wheat at ${wheatPrice.toFixed(0)}¢/bu, +${wheatPct.toFixed(2)}% session` };
    if (ukraineInNews) return { active: true, evidence: 'Ukraine / Black Sea situation flagged in live news feeds' };
  }

  if (scenario.trigger === 'FREIGHT_SURGE') {
    const shippingSrc = feeds.sources.find(s => s.source_name === 'Shipping RSS');
    const redSeaInNews = ['Reuters World RSS', 'Al Jazeera RSS', 'Shipping RSS', 'BBC Business RSS'].some(sn => {
      const src = feeds.sources.find(s => s.source_name === sn);
      return src?.items?.some(i => ['red sea', 'houthi', 'suez', 'divert', 'shipping lane'].some(k =>
        (i.title + i.summary).toLowerCase().includes(k)
      ));
    });
    const shippingAlert = shippingSrc?.items?.some(i =>
      ['surge', 'spike', 'attack', 'avoid', 'divert', 'congestion'].some(k =>
        (i.title + i.summary).toLowerCase().includes(k)
      )
    );
    if (redSeaInNews || shippingAlert) return { active: true, evidence: 'Red Sea / freight disruption signals detected in live feeds' };
  }

  if (scenario.trigger === 'FX_STRESS') {
    const gbpUsd = fx?.gbp_usd ?? 0;
    const gbpUsdQ = yahooSrc?.quotes?.find(q => q.symbol === 'GBPUSD=X');
    const rate = gbpUsd || gbpUsdQ?.price || 0;
    const changePct = gbpUsdQ?.changePercent ?? 0;
    if (rate > 0 && (rate < 1.22 || changePct <= -1.5)) {
      return { active: true, evidence: `GBP/USD at ${rate.toFixed(4)}${changePct <= -1.5 ? `, ${changePct.toFixed(2)}% session drop` : ''}` };
    }
  }

  if (scenario.trigger === 'GEOPOLITICAL') {
    const criticalSources = ['Reuters World RSS', 'Al Jazeera RSS', 'ReliefWeb Conflict RSS'];
    const criticalTerms = ['war', 'attack', 'explosion', 'blockade', 'seized', 'missile', 'strikes', 'invasion'];
    for (const sn of criticalSources) {
      const src = feeds.sources.find(s => s.source_name === sn);
      if (!src?.items?.length) continue;
      const hit = src.items.find(i => criticalTerms.some(k => (i.title + i.summary).toLowerCase().includes(k)));
      if (hit) return { active: true, evidence: `"${hit.title.slice(0, 80)}" (${sn.replace(' RSS', '')})` };
    }
  }

  return { active: false };
}

export function deriveContingencyPlaybooks(feeds: FeedPayload | null): ContingencyScenario[] {
  if (!feeds) return [];

  const now = feeds.fetched_at;
  return PLAYBOOK_TEMPLATES.map(template => {
    const { active, evidence } = checkPlaybookActivation(template, feeds);
    return {
      ...template,
      active,
      activationEvidence: active ? evidence : undefined,
      lastReviewed: now,
    };
  }).sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    const order = { critical: 0, high: 1, medium: 2 };
    return order[a.severity] - order[b.severity];
  });
}
