import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { FeedPayload, YahooQuote } from "./useMarketFeeds";

export interface PriceDiff {
  symbol: string;
  label: string;
  todayPrice: number;
  yesterdayPrice: number;
  change: number;
  changePercent: number;
  currency: string;
}

export interface DailyDiffResult {
  todayFetchedAt: string | null;
  yesterdayFetchedAt: string | null;
  priceDiffs: PriceDiff[];
  brentDiff: { today: number | null; yesterday: number | null; change: number | null; changePct: number | null } | null;
  fxDiff: {
    gbpUsd: { today: number | null; yesterday: number | null; change: number | null } | null;
    gbpEur: { today: number | null; yesterday: number | null; change: number | null } | null;
  } | null;
  sourcesHealthDiff: { today: number; yesterday: number; delta: number } | null;
  loading: boolean;
  error: string | null;
  hasData: boolean;
}

async function fetchLatestForDate(dateStr: string): Promise<{ fetched_at: string; payload: FeedPayload } | null> {
  const startOfDay = `${dateStr}T00:00:00Z`;
  const endOfDay = `${dateStr}T23:59:59Z`;

  const { data, error } = await supabase
    .from("feed_cache")
    .select("fetched_at, payload")
    .gte("fetched_at", startOfDay)
    .lte("fetched_at", endOfDay)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as { fetched_at: string; payload: FeedPayload };
}

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function computeBrentDiff(today: FeedPayload, yesterday: FeedPayload) {
  const getPrice = (p: FeedPayload) =>
    p.sources.find(s => s.source_name === "EIA Brent Crude")?.current_price ?? null;
  const t = getPrice(today);
  const y = getPrice(yesterday);
  if (t === null || y === null) return null;
  const change = Math.round((t - y) * 100) / 100;
  const changePct = y !== 0 ? Math.round(((t - y) / y) * 10000) / 100 : null;
  return { today: t, yesterday: y, change, changePct };
}

function computeFxDiff(today: FeedPayload, yesterday: FeedPayload) {
  const getSrc = (p: FeedPayload) => p.sources.find(s => s.source_name === "ExchangeRate.host FX");
  const ts = getSrc(today);
  const ys = getSrc(yesterday);

  const diff = (t: number | undefined, y: number | undefined) => {
    if (!t || !y) return null;
    return { today: t, yesterday: y, change: Math.round((t - y) * 10000) / 10000 };
  };

  return {
    gbpUsd: diff(ts?.gbp_usd, ys?.gbp_usd),
    gbpEur: diff(ts?.gbp_eur, ys?.gbp_eur),
  };
}

function computePriceDiffs(today: FeedPayload, yesterday: FeedPayload): PriceDiff[] {
  const todayQuotes: YahooQuote[] = today.sources.find(s => s.source_name === "Yahoo Finance")?.quotes ?? [];
  const yesterdayQuotes: YahooQuote[] = yesterday.sources.find(s => s.source_name === "Yahoo Finance")?.quotes ?? [];

  if (todayQuotes.length === 0 || yesterdayQuotes.length === 0) return [];

  const yesterdayMap: Record<string, YahooQuote> = {};
  for (const q of yesterdayQuotes) {
    if (q.symbol) yesterdayMap[q.symbol] = q;
  }

  const diffs: PriceDiff[] = [];
  for (const tq of todayQuotes) {
    const yq = yesterdayMap[tq.symbol];
    if (!yq || tq.price === null || yq.price === null) continue;
    const change = Math.round((tq.price - yq.price) * 10000) / 10000;
    const changePercent = yq.price !== 0
      ? Math.round(((tq.price - yq.price) / yq.price) * 10000) / 100
      : 0;
    diffs.push({
      symbol: tq.symbol,
      label: tq.label,
      todayPrice: tq.price,
      yesterdayPrice: yq.price,
      change,
      changePercent,
      currency: tq.currency ?? "USD",
    });
  }

  return diffs.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
}

export function useDailyDiff(): DailyDiffResult {
  const [result, setResult] = useState<DailyDiffResult>({
    todayFetchedAt: null,
    yesterdayFetchedAt: null,
    priceDiffs: [],
    brentDiff: null,
    fxDiff: null,
    sourcesHealthDiff: null,
    loading: true,
    error: null,
    hasData: false,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const now = new Date();
        const todayStr = toDateStr(now);
        const yesterdayDate = new Date(now);
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayStr = toDateStr(yesterdayDate);

        const [todayRow, yesterdayRow] = await Promise.all([
          fetchLatestForDate(todayStr),
          fetchLatestForDate(yesterdayStr),
        ]);

        if (cancelled) return;

        if (!todayRow || !yesterdayRow) {
          setResult(prev => ({
            ...prev,
            loading: false,
            hasData: false,
            todayFetchedAt: todayRow?.fetched_at ?? null,
            yesterdayFetchedAt: yesterdayRow?.fetched_at ?? null,
          }));
          return;
        }

        const todayPayload = todayRow.payload;
        const yPayload = yesterdayRow.payload;

        const priceDiffs = computePriceDiffs(todayPayload, yPayload);
        const brentDiff = computeBrentDiff(todayPayload, yPayload);
        const fxDiff = computeFxDiff(todayPayload, yPayload);

        const todayHealth = todayPayload.sources_ok;
        const yHealth = yPayload.sources_ok;
        const sourcesHealthDiff = {
          today: todayHealth,
          yesterday: yHealth,
          delta: todayHealth - yHealth,
        };

        setResult({
          todayFetchedAt: todayRow.fetched_at,
          yesterdayFetchedAt: yesterdayRow.fetched_at,
          priceDiffs,
          brentDiff,
          fxDiff,
          sourcesHealthDiff,
          loading: false,
          error: null,
          hasData: true,
        });
      } catch (e) {
        if (!cancelled) {
          setResult(prev => ({ ...prev, loading: false, error: String(e), hasData: false }));
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return result;
}
