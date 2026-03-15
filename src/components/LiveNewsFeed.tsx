import { useState } from "react";
import { ExternalLink, Newspaper, RefreshCw, WifiOff, Trash2, RotateCcw, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FeedPayload } from "@/hooks/useMarketFeeds";
import { formatAgeLabel, getAgeMinutes } from "@/hooks/useMarketFeeds";
import type { DismissedIntelRecord } from "@/hooks/useDismissedIntel";

interface LiveNewsFeedProps {
  feeds: FeedPayload | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  timezone?: string;
  isAdmin?: boolean;
  dismissedStoryIds?: string[];
  dismissedStories?: DismissedIntelRecord[];
  onDismissStory?: (refId: string, title: string) => Promise<void>;
  onUndismissStory?: (id: string) => Promise<void>;
  isDismissed?: (type: 'scout_topic' | 'news_story', refId: string) => boolean;
}

const NEWS_SOURCES = [
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

const sourceColors: Record<string, string> = {
  "BBC Business RSS": "bg-orange-500/15 text-orange-300 border-orange-500/30",
  "Al Jazeera RSS": "bg-sky-500/15 text-sky-300 border-sky-500/30",
  "Guardian Business RSS": "bg-blue-500/15 text-blue-300 border-blue-500/30",
  "Farmers Weekly RSS": "bg-amber-500/15 text-amber-300 border-amber-500/30",
  "AHDB RSS": "bg-green-500/15 text-green-300 border-green-500/30",
  "Bank of England RSS": "bg-rose-500/15 text-rose-300 border-rose-500/30",
  "OBR RSS": "bg-teal-500/15 text-teal-300 border-teal-500/30",
  "MarketWatch RSS": "bg-violet-500/15 text-violet-300 border-violet-500/30",
  "USDA RSS": "bg-lime-500/15 text-lime-300 border-lime-500/30",
  "Financial Times RSS": "bg-pink-500/15 text-pink-300 border-pink-500/30",
  "Reuters World RSS": "bg-red-500/15 text-red-300 border-red-500/30",
  "Reuters Commodities RSS": "bg-orange-500/15 text-orange-300 border-orange-500/30",
  "ReliefWeb Conflict RSS": "bg-slate-500/15 text-slate-300 border-slate-500/30",
  "Shipping RSS": "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
};

const sourceShortNames: Record<string, string> = {
  "BBC Business RSS": "BBC",
  "Al Jazeera RSS": "Al Jazeera",
  "Guardian Business RSS": "Guardian",
  "Farmers Weekly RSS": "FW",
  "AHDB RSS": "AHDB",
  "Bank of England RSS": "BoE",
  "OBR RSS": "OBR",
  "MarketWatch RSS": "MarketWatch",
  "USDA RSS": "USDA",
  "Financial Times RSS": "FT",
  "Reuters World RSS": "Reuters World",
  "Reuters Commodities RSS": "Reuters Comm.",
  "ReliefWeb Conflict RSS": "ReliefWeb",
  "Shipping RSS": "Shipping",
};

function parseDate(pub: string): Date | null {
  if (!pub) return null;
  const d = new Date(pub);
  if (!isNaN(d.getTime())) return d;
  const rfcMonths: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  const m = pub.match(/(\d{1,2})\s+(\w{3})\s+(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?(?:\s+([+-]\d{4}|GMT|UTC|Z))?/);
  if (m) {
    const mo = rfcMonths[m[2]];
    if (mo !== undefined) {
      const utc = Date.UTC(parseInt(m[3]), mo, parseInt(m[1]), parseInt(m[4]), parseInt(m[5]), parseInt(m[6] ?? "0"));
      const tz = m[7];
      if (tz && tz !== 'GMT' && tz !== 'UTC' && tz !== 'Z' && /^[+-]\d{4}$/.test(tz)) {
        const sign = tz[0] === '+' ? 1 : -1;
        const offsetMs = sign * (parseInt(tz.slice(1, 3)) * 60 + parseInt(tz.slice(3))) * 60000;
        return new Date(utc - offsetMs);
      }
      return new Date(utc);
    }
  }
  return null;
}

function formatPublished(pub: string, timezone = "Europe/London"): { relative: string; absolute: string } {
  if (!pub) return { relative: "", absolute: "" };
  try {
    const d = parseDate(pub);
    if (!d) return { relative: "", absolute: pub };
    const ageMin = Math.round((Date.now() - d.getTime()) / 60000);
    if (ageMin < 0 || ageMin > 60 * 24 * 30) return { relative: "", absolute: pub };
    const tzAbbr = new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "short" })
      .formatToParts(d).find(p => p.type === "timeZoneName")?.value ?? timezone;
    const absolute = d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
      hour12: false,
    }) + ` ${tzAbbr}`;
    return { relative: formatAgeLabel(ageMin), absolute };
  } catch {
    return { relative: "", absolute: pub };
  }
}

const RELEVANCE_KEYWORDS: string[] = [
  'oil', 'crude', 'brent', 'gas', 'lng', 'wheat', 'grain', 'corn', 'soy', 'fertilizer',
  'fertiliser', 'freight', 'shipping', 'container', 'supply chain', 'inflation', 'tariff',
  'sanctions', 'embargo', 'conflict', 'war', 'attack', 'disruption', 'shortage', 'harvest',
  'energy', 'steel', 'aluminium', 'gbp', 'sterling', 'dollar', 'interest rate', 'red sea',
  'black sea', 'suez', 'panama', 'houthi', 'ukraine', 'russia', 'middle east', 'opec',
  'commodity', 'price', 'cost', 'procurement', 'import', 'export',
];

function scoreRelevance(title: string, summary: string): number {
  const text = (title + ' ' + summary).toLowerCase();
  let score = 0;
  for (const kw of RELEVANCE_KEYWORDS) {
    if (text.includes(kw)) score += kw.length > 6 ? 3 : 1;
  }
  return score;
}

function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

function deduplicateItems<T extends { title: string; ageMinutes: number | null; accuracyScore: number }>(items: T[]): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    const key = normaliseTitle(item.title);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, item);
    } else {
      const itemAge = item.ageMinutes ?? Infinity;
      const existingAge = existing.ageMinutes ?? Infinity;
      if (item.accuracyScore > existing.accuracyScore || itemAge < existingAge) {
        seen.set(key, item);
      }
    }
  }
  return Array.from(seen.values());
}

interface NewsItem {
  title: string;
  summary: string;
  published: string;
  link: string;
  sourceName: string;
  accuracyScore: number;
  ageMinutes: number | null;
  relevanceScore: number;
}

function storyRefId(item: NewsItem): string {
  return item.link || normaliseTitle(item.title);
}

function getItems(feeds: FeedPayload | null): NewsItem[] {
  if (!feeds) return [];
  const items: NewsItem[] = [];
  for (const src of feeds.sources) {
    if (!NEWS_SOURCES.includes(src.source_name)) continue;
    if (!src.success || !src.items) continue;
    for (const item of src.items) {
      const parsedPub = item.published ? parseDate(item.published) : null;
      const pubAge = parsedPub
        ? Math.round((Date.now() - parsedPub.getTime()) / 60000)
        : getAgeMinutes(src.fetch_time_gmt);
      items.push({
        ...item,
        sourceName: src.source_name,
        accuracyScore: src.accuracy_score,
        ageMinutes: pubAge,
        relevanceScore: scoreRelevance(item.title ?? '', item.summary ?? ''),
      });
    }
  }

  const sorted = items.sort((a, b) => {
    const ta = a.published ? (parseDate(a.published)?.getTime() ?? 0) : 0;
    const tb = b.published ? (parseDate(b.published)?.getTime() ?? 0) : 0;
    return tb - ta;
  });

  const deduped = deduplicateItems(sorted);

  return deduped
    .sort((a, b) => {
      const relevanceDiff = b.relevanceScore - a.relevanceScore;
      if (Math.abs(relevanceDiff) >= 3) return relevanceDiff;
      const ta = a.published ? (parseDate(a.published)?.getTime() ?? 0) : 0;
      const tb = b.published ? (parseDate(b.published)?.getTime() ?? 0) : 0;
      return tb - ta;
    })
    .slice(0, 16);
}

function getSourceStatuses(feeds: FeedPayload | null) {
  if (!feeds) return [];
  return feeds.sources.filter(s => NEWS_SOURCES.includes(s.source_name));
}

function getFreightosWarning(feeds: FeedPayload | null) {
  if (!feeds) return null;
  const src = feeds.sources.find(s => s.source_name === "Freightos Baltic Index RSS");
  if (!src?.success || !src.mentions_surcharge_or_gulf) return null;
  return src;
}

interface NewsRowProps {
  item: NewsItem;
  timezone: string;
  isAdmin: boolean;
  refId: string;
  dismissedRecord?: DismissedIntelRecord;
  onDismiss?: () => Promise<void>;
  onUndismiss?: () => Promise<void>;
}

function NewsRow({ item, timezone, isAdmin, refId, dismissedRecord, onDismiss, onUndismiss }: NewsRowProps) {
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const isDismissed = !!dismissedRecord;
  const { relative, absolute } = formatPublished(item.published, timezone);

  const handleDismissClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirming(true);
  };

  const handleConfirm = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onDismiss) return;
    setWorking(true);
    await onDismiss();
    setWorking(false);
    setConfirming(false);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirming(false);
  };

  const handleUndismiss = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onUndismiss || !dismissedRecord) return;
    setWorking(true);
    await onUndismiss();
    setWorking(false);
  };

  if (isDismissed) {
    return (
      <div className="py-2.5 first:pt-0 flex items-center gap-2.5 opacity-40">
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] shrink-0 px-1.5 py-0.5 font-medium",
            sourceColors[item.sourceName] ?? "bg-slate-500/15 text-slate-300 border-slate-500/30"
          )}
        >
          {sourceShortNames[item.sourceName] ?? item.sourceName}
        </Badge>
        <span className="text-xs text-slate-500 flex-1 min-w-0 truncate line-through">{item.title}</span>
        <span className="text-[9px] text-slate-600 uppercase tracking-wider shrink-0">removed</span>
        {isAdmin && onUndismiss && (
          <button
            onClick={handleUndismiss}
            disabled={working}
            className="shrink-0 flex items-center gap-1 text-[9px] text-slate-500 hover:text-sky-400 transition-colors px-1.5 py-0.5 rounded border border-slate-700/40 hover:border-sky-500/30"
          >
            <RotateCcw size={9} className={working ? 'animate-spin' : ''} />
            Restore
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={cn(
      "py-3 first:pt-0",
      confirming && "rounded-lg bg-red-950/10 px-2 -mx-2"
    )}>
      <div className="flex items-start gap-2.5">
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] shrink-0 mt-0.5 px-1.5 py-0.5 font-medium",
            sourceColors[item.sourceName] ?? "bg-slate-500/15 text-slate-300 border-slate-500/30"
          )}
        >
          {sourceShortNames[item.sourceName] ?? item.sourceName}
        </Badge>
        <div className="flex-1 min-w-0">
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-slate-200 hover:text-sky-400 transition-colors leading-snug flex items-start gap-1.5 group"
          >
            <span className="flex-1">{item.title}</span>
            <ExternalLink size={11} className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
          {item.summary && (
            <p className="text-xs text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">{item.summary}</p>
          )}
          <div className="flex items-center gap-3 mt-1">
            {relative && (
              <span
                className="text-[10px] text-muted-foreground/60 cursor-help"
                title={absolute}
              >
                {relative}
              </span>
            )}
            {item.accuracyScore > 0 && (
              <span className={cn(
                "text-[10px]",
                item.accuracyScore >= 80 ? "text-emerald-500/50" :
                item.accuracyScore >= 50 ? "text-amber-500/50" : "text-orange-500/50"
              )}>
                {item.accuracyScore}% confidence
              </span>
            )}
            {item.relevanceScore >= 6 && (
              <span className="text-[10px] text-sky-500/60 font-medium">
                high relevance
              </span>
            )}
          </div>
        </div>

        {isAdmin && !confirming && (
          <button
            onClick={handleDismissClick}
            className="shrink-0 flex items-center gap-1 text-[9px] text-slate-600 hover:text-red-400 transition-colors px-1.5 py-1 rounded border border-transparent hover:border-red-500/30 hover:bg-red-500/5 mt-0.5"
            title="Remove this story"
          >
            <Trash2 size={11} />
          </button>
        )}

        {isAdmin && confirming && (
          <div className="shrink-0 flex items-center gap-1.5 mt-0.5" onClick={e => e.stopPropagation()}>
            <span className="text-[9px] text-red-400 flex items-center gap-1">
              <AlertTriangle size={9} />
              Remove?
            </span>
            <button
              onClick={handleConfirm}
              disabled={working}
              className="text-[9px] font-semibold px-2 py-0.5 rounded bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition-colors"
            >
              {working ? '...' : 'Yes'}
            </button>
            <button
              onClick={handleCancel}
              className="text-[9px] px-2 py-0.5 rounded border border-slate-700/50 text-slate-500 hover:text-slate-300 transition-colors"
            >
              No
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LiveNewsFeed({
  feeds,
  loading,
  error,
  onRefresh,
  timezone = "Europe/London",
  isAdmin = false,
  dismissedStoryIds = [],
  dismissedStories = [],
  onDismissStory,
  onUndismissStory,
}: LiveNewsFeedProps) {
  const [showDismissed, setShowDismissed] = useState(false);

  const allItems = getItems(feeds);
  const dismissedSet = new Set(dismissedStoryIds);

  const activeItems = allItems.filter(item => !dismissedSet.has(storyRefId(item)));
  const dismissedItems = allItems.filter(item => dismissedSet.has(storyRefId(item)));

  const sourceStatuses = getSourceStatuses(feeds);
  const freightosWarning = getFreightosWarning(feeds);

  return (
    <Card className="bg-slate-800/40 overflow-hidden">
      <CardHeader className="flex-row items-center gap-2.5 px-5 py-4 pb-0 space-y-0">
        <Newspaper size={15} className="text-sky-400" />
        <h2 className="text-sm font-bold text-slate-200 tracking-wide uppercase">Live Intelligence Feeds</h2>
        <div className="ml-auto flex items-center gap-2">
          {activeItems.length > 0 && (
            <span className="text-[10px] text-muted-foreground/50 hidden sm:inline font-mono">
              {activeItems.length} unique · ranked by relevance
            </span>
          )}
          {feeds && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {new Date(feeds.fetched_at).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Europe/London",
              })} GMT
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="text-muted-foreground hover:text-slate-300 transition-colors disabled:opacity-40"
            title="Refresh feeds"
          >
            <RefreshCw size={13} className={cn(loading && "animate-spin")} />
          </button>
        </div>
      </CardHeader>

      <CardContent className="px-5 py-4 space-y-4">
        {sourceStatuses.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {sourceStatuses.map(s => (
              <Badge
                key={s.source_name}
                variant="outline"
                className={cn(
                  "text-[10px] gap-1 px-1.5 py-0.5",
                  s.success
                    ? (sourceColors[s.source_name] ?? "bg-slate-500/15 text-slate-300 border-slate-500/30")
                    : "bg-red-500/10 text-red-400 border-red-500/20"
                )}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full", s.success ? "bg-emerald-400" : "bg-red-400")} />
                {sourceShortNames[s.source_name] ?? s.source_name}
                {s.success && s.accuracy_score > 0 && (
                  <span className="opacity-60">{s.accuracy_score}%</span>
                )}
              </Badge>
            ))}
          </div>
        )}

        {freightosWarning && (
          <div className="bg-amber-950/30 border border-amber-500/30 rounded-lg px-3 py-2.5">
            <p className="text-xs text-amber-300 font-semibold">
              Freightos: Gulf / surcharge terms detected in latest index feed
              {freightosWarning.mentioned_keywords && freightosWarning.mentioned_keywords.length > 0 && (
                <span className="ml-1.5 font-normal opacity-70">
                  ({freightosWarning.mentioned_keywords.join(", ")})
                </span>
              )}
            </p>
          </div>
        )}

        {loading && (
          <div className="py-8 text-center">
            <RefreshCw size={18} className="animate-spin text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Fetching intelligence feeds...</p>
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center gap-2 py-4">
            <WifiOff size={14} className="text-red-400 shrink-0" />
            <p className="text-xs text-red-400">Feed fetch failed: {error}</p>
          </div>
        )}

        {!loading && !error && activeItems.length === 0 && feeds && (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No matching headlines found across monitored sources.
          </p>
        )}

        {!loading && activeItems.length > 0 && (
          <div className="space-y-0 divide-y divide-border">
            {activeItems.map((item, i) => {
              const refId = storyRefId(item);
              return (
                <NewsRow
                  key={i}
                  item={item}
                  timezone={timezone}
                  isAdmin={isAdmin}
                  refId={refId}
                  onDismiss={onDismissStory ? () => onDismissStory(refId, item.title) : undefined}
                  onUndismiss={undefined}
                />
              );
            })}
          </div>
        )}

        {isAdmin && dismissedItems.length > 0 && (
          <div className="pt-2 border-t border-slate-800/60">
            <button
              onClick={() => setShowDismissed(o => !o)}
              className="text-[9px] text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1 border border-slate-700/40 rounded px-2 py-0.5 hover:border-slate-600/60 mb-2"
            >
              <Trash2 size={9} />
              {dismissedItems.length} removed
            </button>

            {showDismissed && (
              <div className="space-y-0 divide-y divide-border/30">
                {dismissedItems.map((item, i) => {
                  const refId = storyRefId(item);
                  const record = dismissedStories.find(d => d.ref_id === refId);
                  return (
                    <NewsRow
                      key={i}
                      item={item}
                      timezone={timezone}
                      isAdmin={isAdmin}
                      refId={refId}
                      dismissedRecord={record}
                      onUndismiss={onUndismissStory && record ? () => onUndismissStory(record.id) : undefined}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
