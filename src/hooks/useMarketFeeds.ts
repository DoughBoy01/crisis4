import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

const AUTO_REFRESH_MS = 15 * 60 * 1000;

export interface NewsItem {
  title: string;
  summary: string;
  published: string;
  link: string;
}

export interface YahooQuote {
  symbol: string;
  label: string;
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  currency: string | null;
  marketState: string | null;
  regularMarketTime: number | null;
}

export interface FeedSource {
  source_name: string;
  success: boolean;
  error: string | null;
  fetch_time_gmt: string;
  data_age_minutes: number | null;
  accuracy_score: number;
  note?: string;
  items?: NewsItem[];
  newest_item_published?: string | null;
  current_price?: number;
  previous_price?: number;
  change_pct?: number;
  change_abs?: number;
  data_period?: string;
  gbp_usd?: number;
  gbp_eur?: number;
  data_timestamp?: string;
  raw_snippet?: string;
  mentions_surcharge_or_gulf?: boolean;
  mentioned_keywords?: string[];
  quotes?: YahooQuote[];
  quotes_count?: number;
}

export interface FeedPayload {
  fetched_at: string;
  overall_accuracy_score: number;
  sources_ok: number;
  sources_total: number;
  sources: FeedSource[];
}

export interface FeedState {
  data: FeedPayload | null;
  loading: boolean;
  error: string | null;
  lastFetchedAt: string | null;
  secondsSinceRefresh: number;
  nextRefreshIn: number;
  refresh: () => void;
}

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/market-feeds`;
const HEADERS = {
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
};

async function persistToCache(payload: FeedPayload): Promise<void> {
  await supabase.from("feed_cache").insert({
    fetched_at: payload.fetched_at,
    payload,
  });
}

export function useMarketFeeds(): FeedState {
  const [data, setData] = useState<FeedPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const [secondsSinceRefresh, setSecondsSinceRefresh] = useState(0);
  const [nextRefreshIn, setNextRefreshIn] = useState(AUTO_REFRESH_MS / 1000);

  const lastFetchTimeRef = useRef<number | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchFeeds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(FUNCTION_URL, { headers: HEADERS });
      if (!res.ok) throw new Error(`Edge function returned ${res.status}`);
      const json = (await res.json()) as FeedPayload;
      setData(json);
      setLastFetchedAt(json.fetched_at);
      lastFetchTimeRef.current = Date.now();
      setSecondsSinceRefresh(0);
      setNextRefreshIn(AUTO_REFRESH_MS / 1000);
      persistToCache(json).catch(() => {});
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeeds();
  }, [fetchFeeds]);

  useEffect(() => {
    refreshTimerRef.current = setInterval(fetchFeeds, AUTO_REFRESH_MS);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [fetchFeeds]);

  useEffect(() => {
    const channel = supabase
      .channel("feed_cache_updates")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "feed_cache" },
        (payload) => {
          const updated = payload.new as { payload: FeedPayload; fetched_at: string } | null;
          if (!updated?.payload) return;
          setData(updated.payload);
          setLastFetchedAt(updated.fetched_at ?? updated.payload.fetched_at);
          lastFetchTimeRef.current = Date.now();
          setSecondsSinceRefresh(0);
          setNextRefreshIn(AUTO_REFRESH_MS / 1000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const ticker = setInterval(() => {
      if (lastFetchTimeRef.current) {
        const elapsed = Math.floor((Date.now() - lastFetchTimeRef.current) / 1000);
        setSecondsSinceRefresh(elapsed);
        const remaining = Math.max(0, AUTO_REFRESH_MS / 1000 - elapsed);
        setNextRefreshIn(remaining);
      }
    }, 1000);
    return () => clearInterval(ticker);
  }, []);

  return { data, loading, error, lastFetchedAt, secondsSinceRefresh, nextRefreshIn, refresh: fetchFeeds };
}

export function getBrentFromFeeds(feeds: FeedPayload | null): FeedSource | null {
  if (!feeds) return null;
  const src = feeds.sources.find(s => s.source_name === "EIA Brent Crude");
  if (!src?.success || !src.current_price) return null;
  return src;
}

export function getFxFromFeeds(feeds: FeedPayload | null): FeedSource | null {
  if (!feeds) return null;
  const src = feeds.sources.find(s => s.source_name === "ExchangeRate.host FX");
  if (!src?.success || !src.gbp_usd) return null;
  return src;
}

export function getSourceByName(feeds: FeedPayload | null, name: string): FeedSource | null {
  if (!feeds) return null;
  return feeds.sources.find(s => s.source_name === name) ?? null;
}

export function getNewsItems(feeds: FeedPayload | null, sourceNames: string[]): (NewsItem & { sourceName: string })[] {
  if (!feeds) return [];
  return feeds.sources
    .filter(s => sourceNames.includes(s.source_name) && s.success && s.items)
    .flatMap(s => (s.items ?? []).map(item => ({ ...item, sourceName: s.source_name })))
    .sort((a, b) => {
      const ta = a.published ? new Date(a.published).getTime() : 0;
      const tb = b.published ? new Date(b.published).getTime() : 0;
      return tb - ta;
    })
    .slice(0, 12);
}

export function getYahooFromFeeds(feeds: FeedPayload | null): FeedSource | null {
  if (!feeds) return null;
  const src = feeds.sources.find(s => s.source_name === "Yahoo Finance");
  if (!src?.success || !src.quotes?.length) return null;
  return src;
}

export function getYahooQuote(feeds: FeedPayload | null, symbol: string): YahooQuote | null {
  const src = getYahooFromFeeds(feeds);
  if (!src?.quotes) return null;
  return src.quotes.find(q => q.symbol === symbol) ?? null;
}

export function getAgeMinutes(isoTimestamp: string | null | undefined): number | null {
  if (!isoTimestamp) return null;
  const ms = Date.now() - new Date(isoTimestamp).getTime();
  if (isNaN(ms) || ms < 0) return null;
  return Math.round(ms / 60000);
}

export function formatAgeLabel(minutes: number | null): string {
  if (minutes === null) return "unknown age";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h ago`;
  return `${hours}h ${mins}m ago`;
}

export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
