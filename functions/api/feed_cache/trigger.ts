import type { Env } from '../../types';

interface NewsItem {
  title: string;
  summary: string;
  published: string;
  link: string;
}

interface YahooQuoteResult {
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

interface FeedSource {
  source_name: string;
  success: boolean;
  error: string | null;
  fetch_time_gmt: string;
  data_age_minutes: number | null;
  accuracy_score: number;
  items?: NewsItem[];
  quotes?: YahooQuoteResult[];
  quotes_count?: number;
  current_price?: number;
  previous_price?: number;
  change_pct?: number;
  change_abs?: number;
  data_period?: string;
  data_timestamp?: string;
  gbp_usd?: number;
  gbp_eur?: number;
  note?: string;
  newest_item_published?: string | null;
  items_in_window?: number;
  items_total?: number;
}

interface FeedPayload {
  fetched_at: string;
  monitoring_window_start_utc: string;
  overall_accuracy_score: number;
  sources_ok: number;
  sources_total: number;
  sources: FeedSource[];
}

// Utility functions
function nowISO(): string {
  return new Date().toISOString();
}

function ageMinutes(fetchTime: string): number {
  return Math.round((Date.now() - new Date(fetchTime).getTime()) / 60000);
}

function accuracyScore(ageMin: number, maxFreshMin: number, hasData: boolean): number {
  if (!hasData) return 0;
  if (ageMin <= maxFreshMin) return 100;
  const overdue = ageMin - maxFreshMin;
  const decay = Math.min(overdue / maxFreshMin, 1);
  return Math.round(100 - decay * 100);
}

function feedAccuracyScore(fetchAgeMin: number, contentAgeMin: number | null, maxContentAgeMin: number, feedResponded: boolean): number {
  if (!feedResponded) return 0;
  if (fetchAgeMin > 30) return 0;
  if (contentAgeMin === null) return 90;
  if (contentAgeMin <= maxContentAgeMin) return 100;
  const overdue = contentAgeMin - maxContentAgeMin;
  const decay = Math.min(overdue / maxContentAgeMin, 1);
  return Math.round(Math.max(60, 100 - decay * 40));
}

function monitoringWindowStart(): number {
  const now = new Date();
  return now.getTime() - 18 * 60 * 60 * 1000; // 18 hours ago
}

async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Crisis2/1.0 MarketIntelligence" },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// RSS parser
function parseRSS(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = (/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>/.exec(block) ||
      /<title[^>]*>([\s\S]*?)<\/title>/.exec(block))?.[1]?.trim() ?? "";
    const summary = (/<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/description>/.exec(block) ||
      /<description[^>]*>([\s\S]*?)<\/description>/.exec(block) ||
      /<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/.exec(block))?.[1]
      ?.replace(/<[^>]+>/g, "").trim().slice(0, 300) ?? "";
    const published = (/<pubDate>([\s\S]*?)<\/pubDate>/.exec(block) ||
      /<dc:date>([\s\S]*?)<\/dc:date>/.exec(block))?.[1]?.trim() ?? "";
    const link = (/<link[^>]*>([\s\S]*?)<\/link>/.exec(block) ||
      /<link\s+href="([^"]+)"/.exec(block))?.[1]?.trim() ?? "";

    if (title) items.push({ title, summary, published, link });
  }

  return items;
}

function filterByKeywords(items: NewsItem[], keywords: string[]): NewsItem[] {
  const lower = keywords.map(k => k.toLowerCase());
  return items.filter(item => {
    const text = (item.title + " " + item.summary).toLowerCase();
    return lower.some(k => text.includes(k));
  });
}

function filterBySince(items: NewsItem[], sinceMs: number): NewsItem[] {
  return items.filter(item => {
    if (!item.published) return true;
    const ts = new Date(item.published).getTime();
    return isNaN(ts) || ts >= sinceMs;
  });
}

// Stooq CSV parser for Yahoo Finance data
function parseStooqCSV(csv: string): { date: string; close: number; open: number; prevClose: number } | null {
  const allLines = csv.trim().split("\n").map(l => l.trim()).filter(l => l.length > 0);
  if (allLines.length < 3) return null;
  const dataLines = allLines.slice(1);
  if (dataLines.length < 1) return null;
  const latest = dataLines[dataLines.length - 1].split(",");
  const prev = dataLines.length >= 2 ? dataLines[dataLines.length - 2].split(",") : null;
  if (latest.length < 5 || isNaN(parseFloat(latest[4]))) return null;
  const close = parseFloat(latest[4]);
  const open = parseFloat(latest[1]);
  const prevClose = prev && prev.length >= 5 && !isNaN(parseFloat(prev[4])) ? parseFloat(prev[4]) : open;
  return { date: latest[0], open, close, prevClose };
}

async function fetchStooqSymbol(stooqSymbol: string): Promise<{ close: number; prevClose: number; date: string } | null> {
  try {
    const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSymbol)}&i=d`;
    const res = await fetchWithTimeout(url, 8000);
    if (!res.ok) return null;
    const csv = await res.text();
    if (csv.includes("No data") || csv.includes("Exceeded")) return null;
    return parseStooqCSV(csv);
  } catch {
    return null;
  }
}

// Data fetching functions

async function fetchYahooFinance(): Promise<FeedSource> {
  const fetchTime = nowISO();

  const TICKERS: { symbol: string; stooq: string; label: string; currency: string }[] = [
    { symbol: "BZ=F",     stooq: "cb.f",      label: "Brent Crude Oil (ICE)",  currency: "USD" },
    { symbol: "CL=F",     stooq: "cl.f",      label: "WTI Crude Oil",           currency: "USD" },
    { symbol: "NG=F",     stooq: "ng.f",      label: "Natural Gas (NYMEX)",     currency: "USD" },
    { symbol: "HO=F",     stooq: "ho.f",      label: "Heating Oil (NYMEX)",     currency: "USD" },
    { symbol: "RB=F",     stooq: "rb.f",      label: "RBOB Gasoline",           currency: "USD" },
    { symbol: "GBPUSD=X", stooq: "gbpusd",    label: "GBP/USD",                 currency: "USD" },
    { symbol: "GBPEUR=X", stooq: "gbpeur",    label: "GBP/EUR",                 currency: "EUR" },
    { symbol: "EURUSD=X", stooq: "eurusd",    label: "EUR/USD",                 currency: "USD" },
    { symbol: "USDJPY=X", stooq: "usdjpy",    label: "USD/JPY",                 currency: "JPY" },
    { symbol: "USDCNH=X", stooq: "usdcnh",    label: "USD/CNH",                 currency: "CNH" },
    { symbol: "ZW=F",     stooq: "zw.f",      label: "Wheat (CBOT)",            currency: "USX" },
    { symbol: "ZC=F",     stooq: "zc.f",      label: "Corn (CBOT)",             currency: "USX" },
    { symbol: "ZS=F",     stooq: "zs.f",      label: "Soybeans (CBOT)",         currency: "USX" },
    { symbol: "ZR=F",     stooq: "rr.f",      label: "Rough Rice (CBOT)",       currency: "USX" },
    { symbol: "GC=F",     stooq: "gc.f",      label: "Gold",                    currency: "USD" },
    { symbol: "SI=F",     stooq: "si.f",      label: "Silver",                  currency: "USD" },
    { symbol: "HG=F",     stooq: "hg.f",      label: "Copper",                  currency: "USX" },
    { symbol: "DX=F",     stooq: "dx.f",      label: "US Dollar Index",         currency: "USD" },
    { symbol: "^GSPC",    stooq: "^spx",      label: "S&P 500",                 currency: "USD" },
    { symbol: "^FTSE",    stooq: "^ftse",     label: "FTSE 100",                currency: "GBp" },
    { symbol: "^GDAXI",   stooq: "^dax",      label: "DAX 40",                  currency: "EUR" },
    { symbol: "BDI",      stooq: "bdi.i",     label: "Baltic Dry Index",        currency: "pts" },
  ];

  try {
    const results = await Promise.allSettled(
      TICKERS.map(t => fetchStooqSymbol(t.stooq))
    );

    const quotes: YahooQuoteResult[] = TICKERS.map((t, i) => {
      const r = results[i];
      const data = r.status === "fulfilled" ? r.value : null;
      const price = data?.close ?? null;
      const prevClose = data?.prevClose ?? null;
      const change = price !== null && prevClose !== null ? Math.round((price - prevClose) * 10000) / 10000 : null;
      const changePercent = price !== null && prevClose !== null && prevClose !== 0
        ? Math.round(((price - prevClose) / prevClose) * 10000) / 100
        : null;
      return {
        symbol: t.symbol,
        label: t.label,
        price,
        previousClose: prevClose,
        change,
        changePercent,
        currency: t.currency,
        marketState: price !== null ? "REGULAR" : null,
        regularMarketTime: data?.date ? new Date(data.date).getTime() / 1000 : null,
      };
    });

    const successful = quotes.filter(q => q.price !== null);
    if (successful.length === 0) throw new Error("Stooq returned no price data for any instrument");

    const fetchAge = ageMinutes(fetchTime);

    return {
      source_name: "Yahoo Finance",
      success: true,
      error: null,
      fetch_time_gmt: fetchTime,
      quotes,
      quotes_count: successful.length,
      data_age_minutes: fetchAge,
      accuracy_score: accuracyScore(fetchAge, 30, successful.length > 0),
      note: `Market quotes via Stooq — ${successful.length}/${quotes.length} instruments retrieved (end-of-day data)`,
    };
  } catch (e) {
    return {
      source_name: "Yahoo Finance",
      success: false,
      error: String(e),
      fetch_time_gmt: fetchTime,
      quotes: [],
      quotes_count: 0,
      data_age_minutes: null,
      accuracy_score: 0,
    };
  }
}

async function fetchBrentCrude(env: Env): Promise<FeedSource> {
  const fetchTime = nowISO();
  const apiKey = env.EIA_API_KEY;

  if (!apiKey) {
    return {
      source_name: "EIA Brent Crude",
      success: false,
      error: "EIA_API_KEY not configured",
      fetch_time_gmt: fetchTime,
      data_age_minutes: null,
      accuracy_score: 0,
    };
  }

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      frequency: "daily",
      "data[]": "value",
      "facets[series][]": "RBRTE",
      "sort[0][column]": "period",
      "sort[0][direction]": "desc",
      offset: "0",
      length: "2",
    });
    const url = `https://api.eia.gov/v2/petroleum/pri/spt/data/?${params.toString()}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as { response?: { data?: { period: string; value: string | number }[] } };
    const data = json?.response?.data ?? [];

    const brentRows = data.filter(d => {
      const v = parseFloat(String(d.value));
      return !isNaN(v) && v > 20 && v < 250;
    });

    if (brentRows.length === 0) {
      throw new Error(`No valid Brent price rows in EIA RBRTE response`);
    }

    const current = parseFloat(String(brentRows[0].value));
    const previous = brentRows.length >= 2 ? parseFloat(String(brentRows[1].value)) : current;
    const changePct = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    const age = ageMinutes(fetchTime);

    return {
      source_name: "EIA Brent Crude",
      success: true,
      error: null,
      fetch_time_gmt: fetchTime,
      data_period: brentRows[0].period ?? null,
      current_price: current,
      previous_price: previous,
      change_pct: Math.round(changePct * 100) / 100,
      change_abs: Math.round((current - previous) * 100) / 100,
      data_age_minutes: age,
      accuracy_score: accuracyScore(age, 1440, current > 0),
      note: `EIA Brent spot (RBRTE series) — daily, updated each US business day. Period: ${brentRows[0].period}`,
    };
  } catch (e) {
    return {
      source_name: "EIA Brent Crude",
      success: false,
      error: String(e),
      fetch_time_gmt: fetchTime,
      data_age_minutes: null,
      accuracy_score: 0
    };
  }
}

async function fetchFxRates(): Promise<FeedSource> {
  const fetchTime = nowISO();
  try {
    const url = "https://open.er-api.com/v6/latest/GBP";
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as { result?: string; rates?: Record<string, number>; time_last_update_unix?: number };
    if (json.result !== "success") throw new Error("API returned non-success result");
    const rates = json.rates ?? {};
    const dataTimestamp = json.time_last_update_unix
      ? new Date(json.time_last_update_unix * 1000).toISOString()
      : fetchTime;
    const dataAge = json.time_last_update_unix
      ? Math.round((Date.now() - json.time_last_update_unix * 1000) / 60000)
      : 0;
    return {
      source_name: "ExchangeRate.host FX",
      success: true,
      error: null,
      fetch_time_gmt: fetchTime,
      data_timestamp: dataTimestamp,
      gbp_usd: rates["USD"] ?? null,
      gbp_eur: rates["EUR"] ?? null,
      data_age_minutes: dataAge,
      accuracy_score: accuracyScore(dataAge, 1440, !!(rates["USD"])),
      note: "Interbank mid-rate via open.er-api.com — no API key required, updated daily",
    };
  } catch (e) {
    return {
      source_name: "ExchangeRate.host FX",
      success: false,
      error: String(e),
      fetch_time_gmt: fetchTime,
      data_age_minutes: null,
      accuracy_score: 0
    };
  }
}

// RSS feed fetchers with keyword filtering

async function fetchRSSWithKeywords(
  urls: { url: string; name: string }[],
  sourceName: string,
  keywords: string[],
  maxItems: number,
  maxContentAgeMin: number
): Promise<FeedSource> {
  const fetchTime = nowISO();
  let lastError = `All ${sourceName} RSS URLs failed`;

  for (const { url, name } of urls) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) { lastError = `HTTP ${res.status} from ${url}`; continue; }
      const xml = await res.text();
      const all = parseRSS(xml);
      if (all.length === 0) { lastError = `No items parsed from ${url}`; continue; }
      const filtered = filterByKeywords(all, keywords).slice(0, maxItems);
      const items = filtered.length > 0 ? filtered : all.slice(0, maxItems);
      const newestPub = items.length > 0 ? items[0].published : null;
      const dataAge = newestPub ? Math.round((Date.now() - new Date(newestPub).getTime()) / 60000) : null;
      const fetchAge = ageMinutes(fetchTime);

      return {
        source_name: sourceName,
        success: true,
        error: null,
        fetch_time_gmt: fetchTime,
        items,
        newest_item_published: newestPub,
        data_age_minutes: dataAge ?? fetchAge,
        accuracy_score: feedAccuracyScore(fetchAge, dataAge, maxContentAgeMin, true),
        note: `${name} — via ${url}`,
      };
    } catch (e) {
      lastError = String(e);
    }
  }

  return {
    source_name: sourceName,
    success: false,
    error: lastError,
    fetch_time_gmt: fetchTime,
    items: [],
    data_age_minutes: null,
    accuracy_score: 0
  };
}

async function fetchBBCBusinessRSS(): Promise<FeedSource> {
  const keywords = ["oil", "gas", "energy", "wheat", "grain", "shipping", "freight", "fertilizer", "fertiliser", "commodity", "iran", "gulf", "inflation", "opec", "fuel", "food"];
  return fetchRSSWithKeywords(
    [{ url: "https://feeds.bbci.co.uk/news/business/rss.xml", name: "BBC Business" }],
    "BBC Business RSS",
    keywords,
    8,
    240
  );
}

async function fetchAlJazeeraRSS(): Promise<FeedSource> {
  const keywords = ["iran", "hormuz", "israel", "middle east", "oil", "gulf", "houthi", "red sea", "yemen", "tanker", "war", "opec", "conflict"];
  return fetchRSSWithKeywords(
    [{ url: "https://www.aljazeera.com/xml/rss/all.xml", name: "Al Jazeera English" }],
    "Al Jazeera RSS",
    keywords,
    5,
    360
  );
}

async function fetchGuardianBusinessRSS(): Promise<FeedSource> {
  const keywords = ["oil", "gas", "energy", "wheat", "grain", "shipping", "freight", "fertilizer", "fertiliser", "commodity", "iran", "gulf", "inflation", "opec", "fuel", "food", "farm"];
  return fetchRSSWithKeywords(
    [{ url: "https://www.theguardian.com/business/rss", name: "The Guardian Business" }],
    "Guardian Business RSS",
    keywords,
    6,
    360
  );
}

async function fetchReutersWorldRSS(): Promise<FeedSource> {
  const keywords = ["war", "conflict", "sanctions", "attack", "explosion", "iran", "russia", "ukraine", "middle east", "israel", "blockade", "tanker", "hormuz", "red sea", "houthi", "yemen", "opec", "ceasefire", "coup", "militia"];
  const urls = [
    { url: "https://feeds.reuters.com/reuters/worldNews", name: "Reuters World" },
    { url: "https://www.reutersagency.com/feed/?best-topics=political-general&post_type=best", name: "Reuters Agency" },
    { url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", name: "NYT World" },
  ];
  return fetchRSSWithKeywords(urls, "Reuters World RSS", keywords, 8, 120);
}

async function fetchReutersCommoditiesRSS(): Promise<FeedSource> {
  const keywords = ["oil", "crude", "brent", "gas", "wheat", "grain", "corn", "shipping", "freight", "fertilizer", "fertiliser", "commodity", "supply", "tanker", "opec", "eia", "ukraine", "export", "harvest"];
  const urls = [
    { url: "https://feeds.reuters.com/reuters/businessNews", name: "Reuters Business" },
    { url: "https://www.cnbc.com/id/19836768/device/rss/rss.html", name: "CNBC Commodities" },
  ];
  return fetchRSSWithKeywords(urls, "Reuters Commodities RSS", keywords, 8, 240);
}

async function fetchShippingRSS(): Promise<FeedSource> {
  const keywords = ["baltic", "bdi", "dry bulk", "container", "shipping", "freight", "tanker", "vessel", "port", "red sea", "panama", "suez", "hormuz", "houthi", "attack", "piracy", "congestion", "rates", "bunker"];
  const urls = [
    { url: "https://splash247.com/feed/", name: "Splash247" },
    { url: "https://gcaptain.com/feed/", name: "gCaptain" },
  ];
  return fetchRSSWithKeywords(urls, "Shipping RSS", keywords, 8, 480);
}

async function fetchWorldGrainRSS(): Promise<FeedSource> {
  const keywords = ["wheat", "corn", "grain", "soybean", "rice", "barley", "oat", "crop", "harvest", "export", "import", "supply", "demand", "price", "ukraine", "russia", "usda", "fao"];
  const urls = [
    { url: "https://www.world-grain.com/feed/", name: "World Grain" },
    { url: "https://agfax.com/feed/", name: "AgFax" },
  ];
  return fetchRSSWithKeywords(urls, "World Grain RSS", keywords, 6, 1440);
}

async function fetchFertilizerRSS(): Promise<FeedSource> {
  const keywords = ["fertilizer", "fertiliser", "urea", "ammonia", "nitrogen", "potash", "phosphate", "dap", "map", "npk", "crop input", "agrochemical", "natural gas", "feedstock", "price", "supply", "sanction", "russia", "belarus"];
  const urls = [
    { url: "https://www.agweb.com/feed", name: "AgWeb" },
  ];
  return fetchRSSWithKeywords(urls, "Fertilizer RSS", keywords, 6, 1440);
}

async function fetchMetalsRSS(): Promise<FeedSource> {
  const keywords = ["copper", "silver", "gold", "aluminium", "aluminum", "steel", "iron ore", "nickel", "zinc", "lme", "comex", "base metal", "precious metal", "mining", "smelter", "supply", "demand", "china", "construction"];
  const urls = [
    { url: "https://www.mining.com/feed/", name: "Mining.com" },
    { url: "https://www.kitco.com/rss/news.xml", name: "Kitco" },
  ];
  return fetchRSSWithKeywords(urls, "Metals RSS", keywords, 6, 480);
}

function computeOverallAccuracy(sources: FeedSource[]): number {
  const successfulScores = sources
    .filter(s => s.success === true)
    .map(s => s.accuracy_score ?? 0);
  if (successfulScores.length === 0) return 0;
  return Math.round(successfulScores.reduce((a, b) => a + b, 0) / successfulScores.length);
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const body = await request.json().catch(() => ({})) as { since_ms?: number };

    const sinceMs: number = body?.since_ms
      ? Number(body.since_ms)
      : monitoringWindowStart();

    console.log('[Feed Trigger] Fetching all data sources...');

    // Fetch all data sources in parallel
    const results = await Promise.allSettled([
      fetchYahooFinance(),
      fetchBrentCrude(env),
      fetchFxRates(),
      fetchBBCBusinessRSS(),
      fetchAlJazeeraRSS(),
      fetchGuardianBusinessRSS(),
      fetchReutersWorldRSS(),
      fetchReutersCommoditiesRSS(),
      fetchShippingRSS(),
      fetchWorldGrainRSS(),
      fetchFertilizerRSS(),
      fetchMetalsRSS(),
    ]);

    const rawSources = results.map(r =>
      r.status === "fulfilled"
        ? r.value
        : {
            source_name: "unknown",
            success: false,
            error: String((r as PromiseRejectedResult).reason),
            fetch_time_gmt: nowISO(),
            data_age_minutes: null,
            accuracy_score: 0
          }
    );

    // Filter RSS items by time window
    const sources = rawSources.map(src => {
      if (src.items && Array.isArray(src.items)) {
        const filtered = filterBySince(src.items, sinceMs);
        return {
          ...src,
          items: filtered,
          items_in_window: filtered.length,
          items_total: src.items.length
        };
      }
      return src;
    });

    const overallAccuracy = computeOverallAccuracy(sources);
    const successCount = sources.filter(s => s.success === true).length;
    const windowStart = new Date(sinceMs).toISOString();

    const payload: FeedPayload = {
      fetched_at: nowISO(),
      monitoring_window_start_utc: windowStart,
      overall_accuracy_score: overallAccuracy,
      sources_ok: successCount,
      sources_total: sources.length,
      sources,
    };

    console.log(`[Feed Trigger] Success: ${successCount}/${sources.length} sources, accuracy: ${overallAccuracy}%`);

    // Store in D1 database
    const id = crypto.randomUUID();
    const payloadStr = JSON.stringify(payload);

    await env.DB.prepare(
      'INSERT INTO feed_cache (id, fetched_at, payload, created_at) VALUES (?, ?, ?, ?)'
    )
      .bind(id, payload.fetched_at, payloadStr, nowISO())
      .run();

    console.log(`[Feed Trigger] Stored in D1 with ID: ${id}`);

    // Broadcast to WebSocket clients via Durable Object (if available)
    if (env.MARKET_FEED_ROOM) {
      try {
        const durableId = env.MARKET_FEED_ROOM.idFromName('global_market_feed');
        const stub = env.MARKET_FEED_ROOM.get(durableId);
        await stub.fetch('https://fake-host/broadcast', {
          method: 'POST',
          body: payloadStr
        });
        console.log('[Feed Trigger] Broadcasted to WebSocket clients');
      } catch (e) {
        console.warn('[Feed Trigger] WebSocket broadcast failed (normal in local dev):', e);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      id,
      sources_ok: successCount,
      sources_total: sources.length,
      overall_accuracy_score: overallAccuracy,
      monitoring_window_start_utc: windowStart,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Feed Trigger] Fatal error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Failed to fetch feeds'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
