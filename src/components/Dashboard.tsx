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
import DataFreshnessBar from './DataFreshnessBar';
import { useMarketFeeds, getBrentFromFeeds, getFxFromFeeds } from '@/hooks/useMarketFeeds';
import { useDailyBrief } from '@/hooks/useDailyBrief';
import { useUserSettings } from '@/hooks/useUserSettings';
import { ChevronDown, ChevronUp, Shield, BarChart2, Newspaper, Filter } from 'lucide-react';

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
  agricultural: ['grain', 'wheat', 'corn', 'soybean', 'fertilizer', 'fertiliser', 'crop', 'harvest', 'agricultural', 'urea', 'ammonia', 'fuel', 'oil', 'gas'],
  freight:      ['freight', 'shipping', 'container', 'tanker', 'vessel', 'port', 'red sea', 'suez', 'panama', 'bdi', 'bulk', 'logistics'],
  food:         ['grain', 'wheat', 'corn', 'soybean', 'oil', 'food', 'commodity', 'packaging', 'fx', 'sterling', 'gbp'],
  energy:       ['oil', 'crude', 'brent', 'gas', 'energy', 'fuel', 'diesel', 'lng', 'power', 'electricity'],
};

const SECTOR_AFFECTED_MARKET_KEYWORDS: Record<string, string[]> = {
  agricultural: ['Oil', 'Gas', 'Grain', 'Fertilizer', 'Commodities', 'FX'],
  freight:      ['Oil', 'Freight', 'Gas', 'Commodities'],
  food:         ['Grain', 'Oil', 'Gas', 'FX', 'Commodities'],
  energy:       ['Oil', 'Gas', 'Commodities'],
};

const SECTOR_SUPPLY_CATEGORIES: Record<string, string[]> = {
  agricultural: ['agricultural', 'energy', 'fertilizer'],
  freight:      ['freight', 'energy'],
  food:         ['agricultural', 'energy', 'fertilizer'],
  energy:       ['energy'],
};

const SECTOR_PLAYBOOK_TRIGGERS: Record<string, string[]> = {
  agricultural: ['PRICE_SPIKE', 'SUPPLY_DISRUPTION', 'GEOPOLITICAL', 'FX_STRESS'],
  freight:      ['FREIGHT_SURGE', 'GEOPOLITICAL', 'PRICE_SPIKE'],
  food:         ['SUPPLY_DISRUPTION', 'PRICE_SPIKE', 'FX_STRESS', 'GEOPOLITICAL'],
  energy:       ['PRICE_SPIKE', 'GEOPOLITICAL', 'FX_STRESS'],
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
  const [marketsOpen, setMarketsOpen] = useState(false);
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

  const marketItems = useMemo(() => deriveMarketItems(feeds), [feeds]);
  const overnightStats = useMemo(() => deriveOvernightStats(feeds), [feeds]);
  const actionItems = useMemo(() => deriveActionItems(feeds), [feeds]);
  const morningAlerts = useMemo(() => deriveMorningAlerts(feeds), [feeds]);
  const conflictZones = useMemo(() => deriveConflictZones(feeds), [feeds]);
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

      {/* ── CRITICAL ALERT STRIP ── full-bleed, unmissable ── */}
      {criticalAlerts.length > 0 && (
        <div className="border-b border-red-900/60 bg-red-950/30">
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-4">
            <AlertBanner alerts={criticalAlerts} timezone={timezone} variant="critical-strip" />
          </div>
        </div>
      )}

      {/* ── SECTOR FILTER BAR ── sticky below header ── */}
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

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">

        {/* ── TWO-COLUMN LAYOUT: primary workflow + context sidebar ── */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 items-start">

          {/* ══ LEFT: Primary daily workflow ══ */}
          <div className="space-y-5">

            {/* Situation brief */}
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

            {/* Live price ticker */}
            <LivePriceBanner
              brentSrc={brentSrc}
              fxSrc={fxSrc}
              loading={feedsLoading}
            />

            {/* Today vs yesterday price diffs */}
            <DailyDiff />

            {/* Overnight alerts */}
            {(filteredAlerts.length > 0 || feedsLoading) && (
              <div className="space-y-3">
                <SectionDivider
                  label="Alerts from last night"
                  sub={activeSector ? "— filtered for your sector" : "— read before markets open"}
                />
                {feedsLoading && filteredAlerts.length === 0 ? (
                  <div className="rounded-xl border border-border/30 bg-slate-800/20 px-5 py-4 animate-pulse">
                    <div className="h-3 bg-slate-700/50 rounded w-2/3 mb-2" />
                    <div className="h-3 bg-slate-700/30 rounded w-1/2" />
                  </div>
                ) : (
                  <AlertBanner alerts={filteredAlerts} timezone={timezone} />
                )}
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              <SectionDivider
                label="Your actions for today"
                sub={activeSector ? "— filtered for your sector" : "— work through this before 9am"}
              />
              {topAction?.roi && (
                <ROISavingsBar topAction={topAction} subscriptionCost={SUBSCRIPTION_COST_ANNUAL} />
              )}
              {feedsLoading && actionItems.length === 0 ? (
                <div className="rounded-xl border border-border/30 bg-slate-800/20 px-5 py-8 text-center animate-pulse">
                  <div className="h-3 bg-slate-700/50 rounded w-1/3 mx-auto mb-2" />
                  <div className="h-3 bg-slate-700/30 rounded w-1/4 mx-auto" />
                </div>
              ) : (
                <ActionPanel actions={actionItems} activeSector={activeSector} aiRationale={dailyBrief?.action_rationale} />
              )}
            </div>

          </div>

          {/* ══ RIGHT: Context, accuracy, signal guide ══ */}
          <div className="xl:sticky xl:top-[118px] space-y-4">
            <IntelSidebar
              feeds={feeds}
              loading={feedsLoading}
              secondsSinceRefresh={secondsSinceRefresh}
              nextRefreshIn={nextRefreshIn}
              onRefresh={refreshFeeds}
            />
            {/* Data freshness detail — mobile only, desktop uses IntelSidebar */}
            <div className="xl:hidden">
              <DataFreshnessBar
                feeds={feeds}
                loading={feedsLoading}
                secondsSinceRefresh={secondsSinceRefresh}
                nextRefreshIn={nextRefreshIn}
                onRefresh={refreshFeeds}
              />
            </div>
          </div>

        </div>

        {/* ── BELOW FOLD: Deep intelligence (collapsible) ── */}
        <div className="mt-8 space-y-3">
          <SectionDivider
            label="Deeper intelligence"
            sub={activeSector ? "— filtered for your sector" : "— conflict, news & market data"}
          />

          <CollapsibleSection
            icon={Shield}
            label="Conflict Intelligence"
            sublabel={activeSector
              ? `— ${filteredConflictZones.length} zones relevant to your sector`
              : `— ${conflictZones.length} active zones`}
            open={conflictOpen}
            onToggle={() => setConflictOpen(o => !o)}
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <ConflictRiskMap zones={filteredConflictZones} loading={feedsLoading} />
              <SupplyChainExposure items={filteredSupplyExposure} loading={feedsLoading} />
              <ContingencyPlaybook scenarios={filteredPlaybooks} loading={feedsLoading} />
            </div>
          </CollapsibleSection>

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

          <CollapsibleSection
            icon={BarChart2}
            label="Market Price Reference"
            sublabel={activeSector ? '— filtered for your sector' : '— all tracked commodities'}
            open={marketsOpen}
            onToggle={() => setMarketsOpen(o => !o)}
          >
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
