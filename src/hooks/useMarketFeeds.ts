import { useState, useEffect, useCallback, useRef } from "react";

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

// WebSocket connection URL - adjust based on your deployment
const getWebSocketUrl = (): string => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/api/feed_cache/connect`;
};

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_DELAY_MS = 30000;
const HTTP_FALLBACK_DELAY_MS = 5000; // Try HTTP if WebSocket fails for 5 seconds

export function useMarketFeeds(): FeedState {
  const [data, setData] = useState<FeedPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const [secondsSinceRefresh, setSecondsSinceRefresh] = useState(0);
  const [nextRefreshIn, setNextRefreshIn] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(RECONNECT_DELAY_MS);
  const lastFetchTimeRef = useRef<number | null>(null);
  const unmountedRef = useRef(false);
  const httpFallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usingHttpFallbackRef = useRef(false);

  // HTTP fallback for when WebSocket isn't available
  const fetchViaHttp = useCallback(async () => {
    if (unmountedRef.current) return;

    try {
      console.log('[useMarketFeeds] Using HTTP fallback to fetch data');
      const response = await fetch('/api/feed_cache');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const feedData = await response.json();

      if (Array.isArray(feedData) && feedData.length > 0) {
        const latestFeed = feedData[0];
        if (latestFeed.payload) {
          setData(latestFeed.payload);
          setLastFetchedAt(latestFeed.fetched_at);
          lastFetchTimeRef.current = Date.now();
          setSecondsSinceRefresh(0);
          setError(null);
          setLoading(false);
          usingHttpFallbackRef.current = true;
        }
      }
    } catch (err) {
      console.error('[useMarketFeeds] HTTP fallback failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      setLoading(false);
    }
  }, [setData, setLastFetchedAt, setSecondsSinceRefresh, setError, setLoading]);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;

    // Start HTTP fallback timer - if WebSocket doesn't connect within 5 seconds, use HTTP
    httpFallbackTimeoutRef.current = setTimeout(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.log('[useMarketFeeds] WebSocket failed to connect within 5s, triggering HTTP fallback');
        fetchViaHttp();
      }
    }, HTTP_FALLBACK_DELAY_MS);

    try {
      const ws = new WebSocket(getWebSocketUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[useMarketFeeds] WebSocket connected');
        setError(null);
        setLoading(false);
        reconnectDelayRef.current = RECONNECT_DELAY_MS; // Reset backoff on successful connection

        // Cancel HTTP fallback since WebSocket connected successfully
        if (httpFallbackTimeoutRef.current) {
          clearTimeout(httpFallbackTimeoutRef.current);
          httpFallbackTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as FeedPayload;
          setData(payload);
          setLastFetchedAt(payload.fetched_at);
          lastFetchTimeRef.current = Date.now();
          setSecondsSinceRefresh(0);
          setError(null);
        } catch (err) {
          console.error('[useMarketFeeds] Failed to parse message:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('[useMarketFeeds] WebSocket error:', event);
        setError('WebSocket connection error');
      };

      ws.onclose = (event) => {
        console.log('[useMarketFeeds] WebSocket closed:', event.code, event.reason);
        wsRef.current = null;

        if (!unmountedRef.current) {
          setLoading(true);
          setError('Connection lost, reconnecting...');

          // Exponential backoff for reconnection
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelayRef.current);

          reconnectDelayRef.current = Math.min(
            reconnectDelayRef.current * 2,
            MAX_RECONNECT_DELAY_MS
          );
        }
      };
    } catch (err) {
      console.error('[useMarketFeeds] Failed to create WebSocket:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setLoading(false);
    }
  }, [fetchViaHttp]);

  const refresh = useCallback(() => {
    // Send a ping to request fresh data (if needed)
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send('PING');
    }
  }, []);

  // Initial connection
  useEffect(() => {
    unmountedRef.current = false;
    connect();

    return () => {
      unmountedRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (httpFallbackTimeoutRef.current) {
        clearTimeout(httpFallbackTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
        wsRef.current = null;
      }
    };
  }, [connect]);

  // Timer to track seconds since last refresh
  useEffect(() => {
    const ticker = setInterval(() => {
      if (lastFetchTimeRef.current) {
        const elapsed = Math.floor((Date.now() - lastFetchTimeRef.current) / 1000);
        setSecondsSinceRefresh(elapsed);
      }
    }, 1000);
    return () => clearInterval(ticker);
  }, []);

  return {
    data,
    loading,
    error,
    lastFetchedAt,
    secondsSinceRefresh,
    nextRefreshIn,
    refresh
  };
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
