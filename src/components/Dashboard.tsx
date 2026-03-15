import { useState, useMemo, useEffect } from 'react';
import { marketOpenTime } from '../data/marketData';
import { deriveMarketItems, deriveOvernightStats, deriveActionItems, deriveMorningAlerts, deriveConflictZones, deriveSupplyExposure, deriveContingencyPlaybooks, deriveTopMover } from '@/lib/feedDerived';
import type { MarketCategory, SectorId } from '../types';
import Header from './Header';
import MorningBrief from './MorningBrief';
import AlertBanner from './AlertBanner';
import ActionPanel from './ActionPanel';
import MarketSection from './MarketSection';
import ROISavingsBar from './ROISavingsBar';
import SectorTabs from './SectorTabs';
import LiveNewsFeed from './LiveNewsFeed';
import LivePriceBanner from './LivePriceBanner';
import IntelSidebar from './IntelSidebar';
import ConflictRiskMap from './ConflictRiskMap';
import SupplyChainExposure from './SupplyChainExposure';
import ContingencyPlaybook from './ContingencyPlaybook';
import DailyDiff from './DailyDiff';
import { useMarketFeeds, getBrentFromFeeds, getFxFromFeeds } from '@/hooks/useMarketFeeds';
import { useDailyBrief } from '@/hooks/useDailyBrief';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useHistoricalContext } from '@/hooks/useHistoricalContext';
import { ChevronDown, ChevronUp, Shield, BarChart2, Newspaper, Filter } from 'lucide-react';
import CommodityMiniChart from './CommodityMiniChart';

const NEWS_SOURCES_LIST = [
  "BBC Business RSS",
  "Al Jazeera RSS",
  "Guardian Business RSS",
  "Farmers Weekly RSS",
  "AHDB RSS",
  "Bank of England RSS",
  "OBR RSS",
  "MarketWatch RSS",
  "USDA RSS",
  "Financial Times RSS",
  "Reuters World RSS",
  "Reuters Commodities RSS",
  "ReliefWeb Conflict RSS",
  "Shipping RSS",
];

const categories: { id: MarketCategory; label: string; description: string }[] = [
  { id: 'energy', label: 'Energy', description: 'Oil · Gas · Red Diesel' },
  { id: 'freight', label: 'Freight', description: 'Dry Bulk · Container · War Risk' },
  { id: 'fertilizer', label: 'Fertilizers', description: 'Urea · AN · Phosphate' },
  { id: 'agricultural', label: 'Agricultural', description: 'Cereals · Oilseeds' },
  { id: 'metals', label: 'Metals', description: 'Steel · Aluminium' },
];

const SUBSCRIPTION_COST_ANNUAL = 588;

const SECTOR_MARKET_KEYWORDS: Record<string, string[]> = {
  food_importer:  ['grain', 'wheat', 'corn', 'soybean', 'fertilizer', 'fertiliser', 'crop', 'harvest', 'food', 'packaging', 'oil', 'gas', 'gbp', 'sterling', 'fx'],
  chemicals:      ['gas', 'lng', 'oil', 'crude', 'brent', 'feedstock', 'plastics', 'chemical', 'petrochemical', 'energy', 'electricity'],
  freight_3pl:    ['freight', 'shipping', 'container', 'tanker', 'vessel', 'port', 'red sea', 'suez', 'panama', 'bdi', 'bulk', 'logistics', 'war risk', 'surcharge', 'houthi'],
  construction:   ['steel', 'fuel', 'oil', 'diesel', 'aluminium', 'energy', 'gas', 'materials', 'commodity', 'gbp'],
  financial:      ['oil', 'crude', 'brent', 'gas', 'grain', 'wheat', 'gold', 'ftse', 'gbp', 'sterling', 'dollar', 'fx', 'inflation', 'rates'],
};

const SECTOR_AFFECTED_MARKET_KEYWORDS: Record<string, string[]> = {
  food_importer: ['Grain', 'Oil', 'Gas', 'FX', 'Fertilizer', 'Commodities'],
  chemicals:     ['Oil', 'Gas', 'Commodities'],
  freight_3pl:   ['Oil', 'Freight', 'Gas', 'Commodities'],
  construction:  ['Oil', 'Gas', 'Commodities'],
  financial:     ['Oil', 'Gas', 'Grain', 'FX', 'Commodities'],
};

const SECTOR_SUPPLY_CATEGORIES: Record<string, string[]> = {
  food_importer: ['agricultural', 'energy', 'fertilizer'],
  chemicals:     ['energy'],
  freight_3pl:   ['freight', 'energy'],
  construction:  ['energy', 'metals'],
  financial:     ['agricultural', 'energy', 'fertilizer', 'freight', 'metals'],
};

const SECTOR_PLAYBOOK_TRIGGERS: Record<string, string[]> = {
  food_importer: ['PRICE_SPIKE', 'SUPPLY_DISRUPTION', 'GEOPOLITICAL', 'FX_STRESS'],
  chemicals:     ['PRICE_SPIKE', 'GEOPOLITICAL', 'FX_STRESS'],
  freight_3pl:   ['FREIGHT_SURGE', 'GEOPOLITICAL', 'PRICE_SPIKE'],
  construction:  ['PRICE_SPIKE', 'GEOPOLITICAL', 'FX_STRESS'],
  financial:     ['PRICE_SPIKE', 'SUPPLY_DISRUPTION', 'FREIGHT_SURGE', 'GEOPOLITICAL', 'FX_STRESS'],
};

function SectionDivider({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-black tracking-[0.16em] uppercase text-muted-foreground/40 whitespace-nowrap">{label}</span>
      {sub && <span className="text-[10px] text-muted-foreground/25 hidden sm:inline">{sub}</span>}
      <div className="flex-1 h-px bg-border/20" />
    </div>
  );
}

function CollapsibleSection({
  icon: Icon,
  label,
  sublabel,
  badge,
  open,
  onToggle,
  children,
}: {
  icon: React.ElementType;
  label: string;
  sublabel?: string;
  badge?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/40 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 sm:px-5 py-3.5 bg-slate-800/30 hover:bg-slate-800/50 transition-colors text-left"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon size={13} className="text-muted-foreground/60 shrink-0" />
          <span className="text-xs font-bold text-slate-300 tracking-wider uppercase">{label}</span>
          {sublabel && <span className="text-[10px] text-muted-foreground/50 hidden sm:inline">{sublabel}</span>}
          {badge}
        </div>
        {open
          ? <ChevronUp size={13} className="text-muted-foreground/50 shrink-0 ml-2" />
          : <ChevronDown size={13} className="text-muted-foreground/50 shrink-0 ml-2" />
        }
      </button>
      {open && (
        <div className="px-4 sm:px-5 py-5 border-t border-border/30 bg-slate-900/20">
          {children}
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ onOpenDiagnostics }: { onOpenDiagnostics?: () => void }) {
  const [activeSector, setActiveSector] = useState<SectorId | null>(null);
  const [conflictOpen, setConflictOpen] = useState(true);
  const [newsOpen, setNewsOpen] = useState(false);
  const [marketsOpen, setMarketsOpen] = useState(true);
  const { settings, updateTimezone } = useUserSettings();
  const timezone = settings.timezone;

  const {
    data: feeds,
    loading: feedsLoading,
    error: feedsError,
    lastFetchedAt,
    secondsSinceRefresh,
    nextRefreshIn,
    refresh: refreshFeeds,
  } = useMarketFeeds();

  const { context: historicalContext, loading: historicalLoading } = useHistoricalContext();

  const marketItems = useMemo(() => deriveMarketItems(feeds, historicalContext), [feeds, historicalContext]);
  const overnightStats = useMemo(() => deriveOvernightStats(feeds), [feeds]);
  const actionItems = useMemo(() => deriveActionItems(feeds), [feeds]);
  const morningAlerts = useMemo(() => deriveMorningAlerts(feeds), [feeds]);
  const conflictZones = useMemo(() => deriveConflictZones(feeds, historicalContext), [feeds, historicalContext]);
  const supplyExposure = useMemo(() => deriveSupplyExposure(feeds), [feeds]);
  const contingencyPlaybooks = useMemo(() => deriveContingencyPlaybooks(feeds), [feeds]);

  const filteredAlerts = useMemo(() => {
    if (!activeSector) return morningAlerts;
    const keywords = SECTOR_AFFECTED_MARKET_KEYWORDS[activeSector] ?? [];
    const textKeywords = SECTOR_MARKET_KEYWORDS[activeSector] ?? [];
    const sectorFiltered = morningAlerts.filter(a => {
      const matchesAffected = a.affectedMarkets.some(m => keywords.some(k => m.toLowerCase().includes(k.toLowerCase())));
      const matchesText = textKeywords.some(k => (a.title + ' ' + a.body).toLowerCase().includes(k));
      return matchesAffected || matchesText;
    });
    return sectorFiltered.length > 0 ? sectorFiltered : morningAlerts;
  }, [morningAlerts, activeSector]);

  const filteredConflictZones = useMemo(() => {
    if (!activeSector) return conflictZones;
    const textKeywords = SECTOR_MARKET_KEYWORDS[activeSector] ?? [];
    const filtered = conflictZones.filter(z => {
      const commodityMatch = z.affectedCommodities.some(c =>
        textKeywords.some(k => c.toLowerCase().includes(k))
      );
      return commodityMatch;
    });
    return filtered.length > 0 ? filtered : conflictZones;
  }, [conflictZones, activeSector]);

  const filteredSupplyExposure = useMemo(() => {
    if (!activeSector) return supplyExposure;
    const cats = SECTOR_SUPPLY_CATEGORIES[activeSector] ?? [];
    const filtered = supplyExposure.filter(i => cats.includes(i.category));
    return filtered.length > 0 ? filtered : supplyExposure;
  }, [supplyExposure, activeSector]);

  const filteredPlaybooks = useMemo(() => {
    if (!activeSector) return contingencyPlaybooks;
    const triggers = SECTOR_PLAYBOOK_TRIGGERS[activeSector] ?? [];
    const filtered = contingencyPlaybooks.filter(p => triggers.includes(p.trigger));
    return filtered.length > 0 ? filtered : contingencyPlaybooks;
  }, [contingencyPlaybooks, activeSector]);

  const sectorActionItems = useMemo(() => {
    if (!activeSector) return actionItems;
    return actionItems.filter(a => a.relevantSectors.includes(activeSector));
  }, [actionItems, activeSector]);

  const displayItems = activeSector ? sectorActionItems : actionItems;
  const urgentCount = displayItems.filter(i => i.signal === 'URGENT').length;
  const buyCount = displayItems.filter(i => i.signal === 'BUY').length;
  const watchCount = displayItems.filter(i => i.signal === 'WATCH').length;
  const topAction = displayItems.find(a => a.roi && a.signal === 'URGENT') ?? displayItems[0] ?? null;
  const topMover = useMemo(() => deriveTopMover(feeds), [feeds]);

  const {
    brief: dailyBrief,
    loading: briefLoading,
    generating: briefGenerating,
    trigger: triggerBrief,
  } = useDailyBrief();

  useEffect(() => {
    if (feeds && !feedsLoading && !dailyBrief && !briefLoading && !briefGenerating) {
      triggerBrief(feeds);
    }
  }, [feeds, feedsLoading, dailyBrief, briefLoading, briefGenerating, triggerBrief]);

  const brentSrc = getBrentFromFeeds(feeds);
  const fxSrc = getFxFromFeeds(feeds);

  const liveFxRates = fxSrc
    ? [
        { pair: 'GBP/USD', rate: fxSrc.gbp_usd ?? 0, change: 0 },
        { pair: 'GBP/EUR', rate: fxSrc.gbp_eur ?? 0, change: 0 },
      ]
    : null;

  const tzAbbr = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "short" })
        .formatToParts(new Date()).find(p => p.type === "timeZoneName")?.value ?? "GMT";
    } catch { return "GMT"; }
  }, [timezone]);

  const headerLastRefreshed = lastFetchedAt
    ? new Date(lastFetchedAt).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone,
        hour12: false,
      }) + ` ${tzAbbr}`
    : null;

  const liveBriefGeneratedAt = lastFetchedAt
    ? new Date(lastFetchedAt).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
        hour12: false,
      }) + ' GMT'
    : null;

  const marketOpenCountdown = (() => {
    const now = new Date();
    const [openH, openM] = marketOpenTime.split(':').map(Number);

    const tzDate = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      weekday: 'short',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).formatToParts(now);

    const get = (type: string) => Number(tzDate.find(p => p.type === type)?.value ?? 0);
    const weekday = tzDate.find(p => p.type === 'weekday')?.value ?? '';

    const isWeekend = weekday === 'Sat' || weekday === 'Sun';

    const curH = get('hour');
    const curM = get('minute');
    const curS = get('second');
    const isAfterClose = curH > 17 || (curH === 17 && curM >= 30);
    const isBeforeOpen = curH < openH || (curH === openH && curM < openM);

    if (isWeekend) {
      return `Mon ${marketOpenTime}`;
    }

    if (isAfterClose) {
      return `Tomorrow ${marketOpenTime}`;
    }

    if (!isBeforeOpen) {
      return 'Open';
    }

    const nowSecs = curH * 3600 + curM * 60 + curS;
    const openSecs = openH * 3600 + openM * 60;
    const diffSecs = openSecs - nowSecs;
    const totalMins = Math.ceil(diffSecs / 60);
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  })();

  const liveHeadlineCount = useMemo(() => {
    if (!feeds) return undefined;
    return feeds.sources
      .filter(s => NEWS_SOURCES_LIST.includes(s.source_name) && s.success && s.items)
      .flatMap(s => s.items ?? []).length;
  }, [feeds]);

  const criticalAlerts = filteredAlerts.filter(a => a.severity === 'critical');

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header
        lastFetchedAt={headerLastRefreshed}
        fxRates={liveFxRates}
        overallAccuracy={feeds?.overall_accuracy_score ?? null}
        feedsLoading={feedsLoading}
        timezone={timezone}
        onTimezoneChange={updateTimezone}
        onOpenDiagnostics={onOpenDiagnostics}
      />

      {criticalAlerts.length > 0 && (
        <div className="border-b border-red-900/60 bg-red-950/30">
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-4">
            <AlertBanner alerts={criticalAlerts} timezone={timezone} variant="critical-strip" />
          </div>
        </div>
      )}

      {/* ── SECTOR FILTER BAR ── */}
      <div className="border-b border-border/30 bg-background/95 backdrop-blur-sm sticky top-14 z-40">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 shrink-0">
              <Filter size={11} className="text-muted-foreground/50" />
              <span className="text-[10px] font-bold text-muted-foreground/50 tracking-wider uppercase hidden sm:inline">Filter</span>
            </div>
            <SectorTabs active={activeSector} onChange={setActiveSector} />
          </div>
        </div>
      </div>

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5 space-y-5">

        {/* ═══════════════════════════════════════════════════
            ROW 1: Situation brief (full-width hero)
        ═══════════════════════════════════════════════════ */}
        <MorningBrief
          urgentCount={urgentCount}
          buyCount={buyCount}
          watchCount={watchCount}
          marketOpenCountdown={marketOpenCountdown}
          marketOpenTime={marketOpenTime}
          briefGeneratedAt={liveBriefGeneratedAt}
          overnightStats={overnightStats}
          liveHeadlineCount={liveHeadlineCount}
          liveSourcesOk={feeds?.sources_ok}
          liveSourcesTotal={feeds?.sources_total}
          timezone={timezone}
          topMover={topMover}
          dailyBrief={dailyBrief}
          briefLoading={briefLoading}
          briefGenerating={briefGenerating}
        />

        {/* ═══════════════════════════════════════════════════
            ROW 2: Live price ticker
        ═══════════════════════════════════════════════════ */}
        <LivePriceBanner
          brentSrc={brentSrc}
          fxSrc={fxSrc}
          loading={feedsLoading}
        />

        {/* ═══════════════════════════════════════════════════
            ROW 3: Main dashboard grid
            Left: Alerts + Actions  |  Right: Intel sidebar
        ═══════════════════════════════════════════════════ */}
        <div className="space-y-5">

            {/* ROI savings banner */}
            {topAction?.roi && (
              <ROISavingsBar topAction={topAction} subscriptionCost={SUBSCRIPTION_COST_ANNUAL} />
            )}

            {/* 2-up grid: Overnight alerts + Today vs yesterday */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Overnight alerts panel */}
              <div className="rounded-xl border border-border/40 bg-slate-800/30 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30 bg-slate-800/40">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-xs font-bold text-slate-300 tracking-wider uppercase">Overnight Alerts</span>
                  {filteredAlerts.length > 0 && (
                    <span className="ml-auto text-[10px] font-mono text-amber-400/70">{filteredAlerts.length} signals</span>
                  )}
                </div>
                <div className="p-4">
                  {feedsLoading && filteredAlerts.length === 0 ? (
                    <div className="space-y-2 animate-pulse">
                      <div className="h-3 bg-slate-700/50 rounded w-2/3" />
                      <div className="h-3 bg-slate-700/30 rounded w-1/2" />
                    </div>
                  ) : filteredAlerts.length > 0 ? (
                    <AlertBanner alerts={filteredAlerts} timezone={timezone} />
                  ) : (
                    <p className="text-sm text-muted-foreground/50 text-center py-4">No overnight alerts.</p>
                  )}
                </div>
              </div>

              {/* Daily diff panel */}
              <div className="rounded-xl border border-border/40 bg-slate-800/30 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30 bg-slate-800/40">
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  <span className="text-xs font-bold text-slate-300 tracking-wider uppercase">Price Changes</span>
                  <span className="ml-auto text-[10px] text-muted-foreground/40">vs yesterday</span>
                </div>
                <div className="p-4">
                  <DailyDiff />
                </div>
              </div>

            </div>

            {/* Action panel — full width */}
            <div className="rounded-xl border border-border/40 bg-slate-800/30 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30 bg-slate-800/40">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-xs font-bold text-slate-300 tracking-wider uppercase">Your Actions Today</span>
                <span className="ml-auto text-[10px] text-muted-foreground/40">
                  {activeSector ? 'filtered for your sector' : 'work through before 9am'}
                </span>
              </div>
              <div className="p-0">
                {feedsLoading && actionItems.length === 0 ? (
                  <div className="px-5 py-8 text-center animate-pulse">
                    <div className="h-3 bg-slate-700/50 rounded w-1/3 mx-auto mb-2" />
                    <div className="h-3 bg-slate-700/30 rounded w-1/4 mx-auto" />
                  </div>
                ) : (
                  <ActionPanel actions={actionItems} activeSector={activeSector} aiRationale={dailyBrief?.action_rationale} />
                )}
              </div>
            </div>

            {/* Intel 3-col grid — full width */}
            <IntelSidebar
              feeds={feeds}
              loading={feedsLoading}
              secondsSinceRefresh={secondsSinceRefresh}
              nextRefreshIn={nextRefreshIn}
              onRefresh={refreshFeeds}
            />

        </div>

        {/* ═══════════════════════════════════════════════════
            ROW 4: Market Price Reference — inline, no collapse
        ═══════════════════════════════════════════════════ */}
        <div className="rounded-xl border border-border/40 bg-slate-800/20 overflow-hidden">
          <div className="flex items-center gap-2 px-4 sm:px-5 py-3.5 border-b border-border/30 bg-slate-800/30">
            <BarChart2 size={13} className="text-sky-400/70" />
            <span className="text-xs font-bold text-slate-300 tracking-wider uppercase">Market Price Reference</span>
            <span className="text-[10px] text-muted-foreground/40 hidden sm:inline ml-1">
              {activeSector ? '— filtered for your sector' : '— all tracked commodities'}
            </span>
          </div>
          <div className="p-4 sm:p-5">
            {(feedsLoading || historicalLoading) && marketItems.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {categories.map(cat => (
                  <div key={cat.id} className="space-y-3">
                    <div className="h-3 bg-slate-700/50 rounded w-1/2 animate-pulse" />
                    <div className="rounded-xl border border-border/30 bg-slate-800/20 px-4 py-8 animate-pulse">
                      <div className="h-3 bg-slate-700/50 rounded w-2/3 mb-3" />
                      <div className="h-6 bg-slate-700/40 rounded w-1/2 mb-2" />
                      <div className="h-2 bg-slate-700/30 rounded w-full mt-4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-5">
                {marketItems.length > 0 && (
                  <div className="rounded-xl border border-border/30 bg-slate-800/25 px-5 py-4">
                    <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/40 mb-3">Session performance — all tracked instruments</p>
                    <CommodityMiniChart items={marketItems} />
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  {categories.map(cat => (
                    <MarketSection
                      key={cat.id}
                      category={cat.id}
                      label={cat.label}
                      description={cat.description}
                      items={marketItems.filter(i => i.category === cat.id)}
                      activeSector={activeSector}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            ROW 5: Deep intel — 3-up grid (conflict / news / supply)
        ═══════════════════════════════════════════════════ */}
        <div className="space-y-3">
          <SectionDivider
            label="Deeper intelligence"
            sub={activeSector ? "— filtered for your sector" : "— conflict, supply chain & news"}
          />

          {/* 3-up panel row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border/40 bg-slate-800/20 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30 bg-slate-800/30">
                <Shield size={12} className="text-red-400/70" />
                <span className="text-xs font-bold text-slate-300 tracking-wider uppercase">Conflict Zones</span>
                <span className="ml-auto text-[10px] text-muted-foreground/40">{filteredConflictZones.length} active</span>
              </div>
              <div className="p-4">
                <ConflictRiskMap zones={filteredConflictZones} loading={feedsLoading} />
              </div>
            </div>

            <div className="rounded-xl border border-border/40 bg-slate-800/20 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30 bg-slate-800/30">
                <span className="w-2 h-2 rounded-full bg-orange-400/80" />
                <span className="text-xs font-bold text-slate-300 tracking-wider uppercase">Supply Chain Exposure</span>
              </div>
              <div className="p-4">
                <SupplyChainExposure items={filteredSupplyExposure} loading={feedsLoading} />
              </div>
            </div>

            <div className="rounded-xl border border-border/40 bg-slate-800/20 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30 bg-slate-800/30">
                <span className="w-2 h-2 rounded-full bg-sky-400/80" />
                <span className="text-xs font-bold text-slate-300 tracking-wider uppercase">Contingency Playbook</span>
              </div>
              <div className="p-4">
                <ContingencyPlaybook scenarios={filteredPlaybooks} loading={feedsLoading} />
              </div>
            </div>
          </div>

          {/* News feed — collapsible to save vertical space */}
          <CollapsibleSection
            icon={Newspaper}
            label="Live News Feed"
            sublabel={liveHeadlineCount ? `— ${liveHeadlineCount} headlines` : undefined}
            open={newsOpen}
            onToggle={() => setNewsOpen(o => !o)}
          >
            <LiveNewsFeed
              feeds={feeds}
              loading={feedsLoading}
              error={feedsError}
              onRefresh={refreshFeeds}
              timezone={timezone}
            />
          </CollapsibleSection>
        </div>

      </main>

      <footer className="border-t border-border mt-8">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground/50">ClearBid Procurement Intelligence</p>
            <p className="text-xs text-muted-foreground/30">Market data from live sources. Accuracy scores shown per source. Verify with named sources before trading.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
