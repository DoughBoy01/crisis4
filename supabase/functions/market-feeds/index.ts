import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function nowGMT(): string {
  return new Date().toUTCString();
}

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

function parseRSS(xml: string): { title: string; summary: string; published: string; link: string }[] {
  const items: { title: string; summary: string; published: string; link: string }[] = [];
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

function filterByKeywords(items: { title: string; summary: string; published: string; link: string }[], keywords: string[]): typeof items {
  const lower = keywords.map(k => k.toLowerCase());
  return items.filter(item => {
    const text = (item.title + " " + item.summary).toLowerCase();
    return lower.some(k => text.includes(k));
  });
}

function filterBySince(items: { title: string; summary: string; published: string; link: string }[], sinceMs: number): typeof items {
  return items.filter(item => {
    if (!item.published) return true;
    const ts = new Date(item.published).getTime();
    return isNaN(ts) || ts >= sinceMs;
  });
}

function monitoringWindowStart(): number {
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const windowStartToday = new Date(todayUtc.getTime() - 2 * 60 * 60 * 1000);
  return windowStartToday.getTime();
}

async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "DawnSignal/1.0 MarketIntelligence" },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
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

function parseStooqCSV(csv: string): { date: string; close: number; open: number; prevClose: number } | null {
  const lines = csv.trim().split("\n");
  if (lines.length < 3) return null;
  const latest = lines[lines.length - 1].split(",");
  const prev = lines[lines.length - 2].split(",");
  if (latest.length < 5 || isNaN(parseFloat(latest[4]))) return null;
  return {
    date: latest[0],
    open: parseFloat(latest[1]),
    close: parseFloat(latest[4]),
    prevClose: prev.length >= 5 ? parseFloat(prev[4]) : parseFloat(latest[1]),
  };
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

async function fetchYahooFinance(): Promise<Record<string, unknown>> {
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

async function fetchBrentCrude(): Promise<Record<string, unknown>> {
  const fetchTime = nowISO();
  const apiKey = Deno.env.get("EIA_API_KEY");
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
    const url = `https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key=${apiKey}&data[0]=value&length=5&sort[0][column]=period&sort[0][direction]=desc`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as { response?: { data?: { period: string; value: string }[] } };
    const data = json?.response?.data ?? [];
    const current = parseFloat(data[0]?.value ?? "0");
    const previous = parseFloat(data[1]?.value ?? "0");
    const changePct = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    const age = ageMinutes(fetchTime);
    return {
      source_name: "EIA Brent Crude",
      success: true,
      error: null,
      fetch_time_gmt: fetchTime,
      data_period: data[0]?.period ?? null,
      current_price: current,
      previous_price: previous,
      change_pct: Math.round(changePct * 100) / 100,
      change_abs: Math.round((current - previous) * 100) / 100,
      data_age_minutes: age,
      accuracy_score: accuracyScore(age, 1440, current > 0),
      note: "EIA daily spot price — updated each US business day",
    };
  } catch (e) {
    return { source_name: "EIA Brent Crude", success: false, error: String(e), fetch_time_gmt: fetchTime, data_age_minutes: null, accuracy_score: 0 };
  }
}

async function fetchFxRates(): Promise<Record<string, unknown>> {
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
    return { source_name: "ExchangeRate.host FX", success: false, error: String(e), fetch_time_gmt: fetchTime, data_age_minutes: null, accuracy_score: 0 };
  }
}

async function fetchAHDBRSS(): Promise<Record<string, unknown>> {
  const fetchTime = nowISO();
  const keywords = ["wheat", "barley", "rapeseed", "oilseed", "cereal", "grain", "fertiliser", "fertilizer", "urea", "price", "market", "crop", "harvest", "farm"];
  const candidates = [
    { url: "https://ahdb.org.uk/rss", name: "AHDB" },
    { url: "https://ahdb.org.uk/news/feed", name: "AHDB" },
    { url: "https://www.farminguk.com/RSS/News", name: "Farming UK" },
    { url: "https://www.agriland.co.uk/feed/", name: "AgrilandUK" },
    { url: "https://www.farmersguide.co.uk/feed/", name: "Farmers Guide" },
  ];
  let lastError = "All AHDB/UK agriculture RSS URLs failed";
  for (const { url, name } of candidates) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) { lastError = `HTTP ${res.status} from ${url}`; continue; }
      const xml = await res.text();
      const all = parseRSS(xml);
      if (all.length === 0) { lastError = `No items parsed from ${url}`; continue; }
      const filtered = filterByKeywords(all, keywords).slice(0, 5);
      const items = filtered.length > 0 ? filtered : all.slice(0, 5);
      const newestPub = items.length > 0 ? items[0].published : null;
      const dataAge = newestPub ? Math.round((Date.now() - new Date(newestPub).getTime()) / 60000) : null;
      const fetchAge = ageMinutes(fetchTime);
      return {
        source_name: "AHDB RSS",
        success: true,
        error: null,
        fetch_time_gmt: fetchTime,
        items,
        newest_item_published: newestPub,
        data_age_minutes: dataAge ?? fetchAge,
        accuracy_score: feedAccuracyScore(fetchAge, dataAge, 1440, true),
        note: `${name} — UK agricultural market analysis (via ${url})`,
      };
    } catch (e) {
      lastError = String(e);
    }
  }
  return { source_name: "AHDB RSS", success: false, error: lastError, fetch_time_gmt: fetchTime, items: [], data_age_minutes: null, accuracy_score: 0 };
}

async function fetchBBCBusinessRSS(): Promise<Record<string, unknown>> {
  const fetchTime = nowISO();
  const keywords = ["oil", "gas", "energy", "wheat", "grain", "shipping", "freight", "fertilizer", "fertiliser", "commodity", "iran", "gulf", "inflation", "opec", "fuel", "food"];
  try {
    const res = await fetchWithTimeout("https://feeds.bbci.co.uk/news/business/rss.xml");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const all = parseRSS(xml);
    const filtered = filterByKeywords(all, keywords).slice(0, 8);
    const newestPub = filtered.length > 0 ? filtered[0].published : null;
    const dataAge = newestPub ? Math.round((Date.now() - new Date(newestPub).getTime()) / 60000) : null;
    const age = ageMinutes(fetchTime);
    return {
      source_name: "BBC Business RSS",
      success: true,
      error: null,
      fetch_time_gmt: fetchTime,
      items: filtered,
      newest_item_published: newestPub,
      data_age_minutes: dataAge ?? age,
      accuracy_score: feedAccuracyScore(age, dataAge, 240, true),
      note: "BBC Business — reliable UK/global business and commodity news",
    };
  } catch (e) {
    return { source_name: "BBC Business RSS", success: false, error: String(e), fetch_time_gmt: fetchTime, items: [], data_age_minutes: null, accuracy_score: 0 };
  }
}

async function fetchAlJazeeraRSS(): Promise<Record<string, unknown>> {
  const fetchTime = nowISO();
  const keywords = ["iran", "hormuz", "israel", "middle east", "oil", "gulf", "houthi", "red sea", "yemen", "tanker", "war", "opec", "conflict"];
  try {
    const res = await fetchWithTimeout("https://www.aljazeera.com/xml/rss/all.xml");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const all = parseRSS(xml);
    const filtered = filterByKeywords(all, keywords).slice(0, 5);
    const newestPub = filtered.length > 0 ? filtered[0].published : null;
    const dataAge = newestPub ? Math.round((Date.now() - new Date(newestPub).getTime()) / 60000) : null;
    const age = ageMinutes(fetchTime);
    return {
      source_name: "Al Jazeera RSS",
      success: true,
      error: null,
      fetch_time_gmt: fetchTime,
      items: filtered,
      newest_item_published: newestPub,
      data_age_minutes: dataAge ?? age,
      accuracy_score: feedAccuracyScore(age, dataAge, 360, true),
      note: "Al Jazeera English — geopolitical context for commodity risk",
    };
  } catch (e) {
    return { source_name: "Al Jazeera RSS", success: false, error: String(e), fetch_time_gmt: fetchTime, items: [], data_age_minutes: null, accuracy_score: 0 };
  }
}

async function fetchFarmersWeeklyRSS(): Promise<Record<string, unknown>> {
  const fetchTime = nowISO();
  const keywords = ["fertiliser", "fertilizer", "urea", "supply", "price", "cost", "nitrogen", "ammonia", "wheat", "barley", "rapeseed", "crop", "harvest"];
  try {
    const res = await fetchWithTimeout("https://www.fwi.co.uk/feed");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const all = parseRSS(xml);
    const filtered = filterByKeywords(all, keywords).slice(0, 5);
    const newestPub = filtered.length > 0 ? filtered[0].published : null;
    const dataAge = newestPub ? Math.round((Date.now() - new Date(newestPub).getTime()) / 60000) : null;
    const age = ageMinutes(fetchTime);
    return {
      source_name: "Farmers Weekly RSS",
      success: true,
      error: null,
      fetch_time_gmt: fetchTime,
      items: filtered,
      newest_item_published: newestPub,
      data_age_minutes: dataAge ?? age,
      accuracy_score: feedAccuracyScore(age, dataAge, 1440, true),
      note: "Farmers Weekly — UK agricultural industry news",
    };
  } catch (e) {
    return { source_name: "Farmers Weekly RSS", success: false, error: String(e), fetch_time_gmt: fetchTime, items: [], data_age_minutes: null, accuracy_score: 0 };
  }
}

async function fetchBankOfEnglandRSS(): Promise<Record<string, unknown>> {
  const fetchTime = nowISO();
  const keywords = ["inflation", "interest rate", "monetary policy", "cpi", "rpi", "bank rate", "mpc", "base rate", "gilt", "sterling", "gbp", "energy", "food price", "supply chain"];
  try {
    const res = await fetchWithTimeout("https://www.bankofengland.co.uk/rss/publications");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const all = parseRSS(xml);
    const filtered = filterByKeywords(all, keywords).slice(0, 5);
    const newestPub = filtered.length > 0 ? filtered[0].published : null;
    const dataAge = newestPub ? Math.round((Date.now() - new Date(newestPub).getTime()) / 60000) : null;
    const age = ageMinutes(fetchTime);
    return {
      source_name: "Bank of England RSS",
      success: true,
      error: null,
      fetch_time_gmt: fetchTime,
      items: filtered,
      newest_item_published: newestPub,
      data_age_minutes: dataAge ?? age,
      accuracy_score: feedAccuracyScore(age, dataAge, 2880, true),
      note: "Bank of England publications — MPC decisions, inflation reports, monetary policy",
    };
  } catch (e) {
    return { source_name: "Bank of England RSS", success: false, error: String(e), fetch_time_gmt: fetchTime, items: [], data_age_minutes: null, accuracy_score: 0 };
  }
}

async function fetchOBRRSS(): Promise<Record<string, unknown>> {
  const fetchTime = nowISO();
  const keywords = ["forecast", "inflation", "gdp", "growth", "borrowing", "deficit", "energy", "commodity", "supply", "fiscal"];
  try {
    const res = await fetchWithTimeout("https://obr.uk/feed/");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const all = parseRSS(xml);
    const filtered = filterByKeywords(all, keywords).slice(0, 5);
    const newestPub = filtered.length > 0 ? filtered[0].published : null;
    const dataAge = newestPub ? Math.round((Date.now() - new Date(newestPub).getTime()) / 60000) : null;
    const age = ageMinutes(fetchTime);
    return {
      source_name: "OBR RSS",
      success: true,
      error: null,
      fetch_time_gmt: fetchTime,
      items: filtered,
      newest_item_published: newestPub,
      data_age_minutes: dataAge ?? age,
      accuracy_score: feedAccuracyScore(age, dataAge, 4320, true),
      note: "Office for Budget Responsibility — fiscal forecasts and macro policy analysis",
    };
  } catch (e) {
    return { source_name: "OBR RSS", success: false, error: String(e), fetch_time_gmt: fetchTime, items: [], data_age_minutes: null, accuracy_score: 0 };
  }
}

async function fetchGuardianBusinessRSS(): Promise<Record<string, unknown>> {
  const fetchTime = nowISO();
  const keywords = ["oil", "gas", "energy", "wheat", "grain", "shipping", "freight", "fertilizer", "fertiliser", "commodity", "iran", "gulf", "inflation", "opec", "fuel", "food", "farm"];
  try {
    const res = await fetchWithTimeout("https://www.theguardian.com/business/rss");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const all = parseRSS(xml);
    const filtered = filterByKeywords(all, keywords).slice(0, 6);
    const newestPub = filtered.length > 0 ? filtered[0].published : null;
    const dataAge = newestPub ? Math.round((Date.now() - new Date(newestPub).getTime()) / 60000) : null;
    const age = ageMinutes(fetchTime);
    return {
      source_name: "Guardian Business RSS",
      success: true,
      error: null,
      fetch_time_gmt: fetchTime,
      items: filtered,
      newest_item_published: newestPub,
      data_age_minutes: dataAge ?? age,
      accuracy_score: feedAccuracyScore(age, dataAge, 360, true),
      note: "The Guardian Business — broad commodity and energy market coverage",
    };
  } catch (e) {
    return { source_name: "Guardian Business RSS", success: false, error: String(e), fetch_time_gmt: fetchTime, items: [], data_age_minutes: null, accuracy_score: 0 };
  }
}

async function fetchMarketWatchRSS(): Promise<Record<string, unknown>> {
  const fetchTime = nowISO();
  const keywords = ["oil", "crude", "grain", "wheat", "corn", "freight", "shipping", "dollar", "sterling", "inflation", "commodity", "energy", "gas", "opec", "farm"];
  const urls = [
    "https://www.marketwatch.com/rss/topstories",
    "https://www.marketwatch.com/rss/marketpulse",
    "https://www.cnbc.com/id/10000664/device/rss/rss.html",
  ];
  let lastError = "All MarketWatch/CNBC RSS URLs failed";
  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) { lastError = `HTTP ${res.status} from ${url}`; continue; }
      const xml = await res.text();
      const all = parseRSS(xml);
      if (all.length === 0) { lastError = `No items parsed from ${url}`; continue; }
      const filtered = filterByKeywords(all, keywords).slice(0, 6);
      const items = filtered.length > 0 ? filtered : all.slice(0, 6);
      const newestPub = items.length > 0 ? items[0].published : null;
      const dataAge = newestPub ? Math.round((Date.now() - new Date(newestPub).getTime()) / 60000) : null;
      const age = ageMinutes(fetchTime);
      const sourceName = url.includes("cnbc") ? "CNBC Markets" : "MarketWatch";
      return {
        source_name: "MarketWatch RSS",
        success: true,
        error: null,
        fetch_time_gmt: fetchTime,
        items,
        newest_item_published: newestPub,
        data_age_minutes: dataAge ?? age,
        accuracy_score: feedAccuracyScore(age, dataAge, 120, true),
        note: `${sourceName} — fast-moving commodity and market news (via ${url})`,
      };
    } catch (e) {
      lastError = String(e);
    }
  }
  return { source_name: "MarketWatch RSS", success: false, error: lastError, fetch_time_gmt: fetchTime, items: [], data_age_minutes: null, accuracy_score: 0 };
}

async function fetchUSDARSS(): Promise<Record<string, unknown>> {
  const fetchTime = nowISO();
  const keywords = ["wheat", "grain", "corn", "soybean", "crop", "harvest", "supply", "export", "price", "outlook", "world", "production"];
  const urls = [
    "https://www.usda.gov/rss/latest-releases.xml",
    "https://www.ers.usda.gov/rss/allreleasesnews.xml",
    "https://www.nass.usda.gov/rss/nassr.xml",
  ];
  let lastError = "All USDA RSS URLs failed";
  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) { lastError = `HTTP ${res.status} from ${url}`; continue; }
      const xml = await res.text();
      const all = parseRSS(xml);
      if (all.length === 0) { lastError = `No items parsed from ${url}`; continue; }
      const filtered = filterByKeywords(all, keywords).slice(0, 5);
      const items = filtered.length > 0 ? filtered : all.slice(0, 5);
      const newestPub = items.length > 0 ? items[0].published : null;
      const dataAge = newestPub ? Math.round((Date.now() - new Date(newestPub).getTime()) / 60000) : null;
      const age = ageMinutes(fetchTime);
      return {
        source_name: "USDA RSS",
        success: true,
        error: null,
        fetch_time_gmt: fetchTime,
        items,
        newest_item_published: newestPub,
        data_age_minutes: dataAge ?? age,
        accuracy_score: feedAccuracyScore(age, dataAge, 1440, true),
        note: `USDA — official US crop supply, demand, and price reports (via ${url})`,
      };
    } catch (e) {
      lastError = String(e);
    }
  }
  return { source_name: "USDA RSS", success: false, error: lastError, fetch_time_gmt: fetchTime, items: [], data_age_minutes: null, accuracy_score: 0 };
}

async function fetchFTCommoditiesRSS(): Promise<Record<string, unknown>> {
  const fetchTime = nowISO();
  const keywords = ["oil", "crude", "gas", "wheat", "grain", "shipping", "freight", "fertilizer", "commodity", "iran", "gulf", "opec", "energy", "tanker", "brent"];
  const urls = [
    "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19836768",
    "https://www.cnbc.com/id/19836768/device/rss/rss.html",
    "https://www.cnbc.com/id/10000664/device/rss/rss.html",
  ];
  let lastError = "All Financial Times/CNBC commodity RSS URLs failed";
  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) { lastError = `HTTP ${res.status} from ${url}`; continue; }
      const xml = await res.text();
      const all = parseRSS(xml);
      if (all.length === 0) { lastError = `No items parsed from ${url}`; continue; }
      const filtered = filterByKeywords(all, keywords).slice(0, 6);
      const items = filtered.length > 0 ? filtered : all.slice(0, 6);
      const newestPub = items.length > 0 ? items[0].published : null;
      const dataAge = newestPub ? Math.round((Date.now() - new Date(newestPub).getTime()) / 60000) : null;
      const age = ageMinutes(fetchTime);
      return {
        source_name: "Financial Times RSS",
        success: true,
        error: null,
        fetch_time_gmt: fetchTime,
        items,
        newest_item_published: newestPub,
        data_age_minutes: dataAge ?? age,
        accuracy_score: feedAccuracyScore(age, dataAge, 240, true),
        note: `CNBC Commodities — commodity and energy market reporting (via ${url})`,
      };
    } catch (e) {
      lastError = String(e);
    }
  }
  return { source_name: "Financial Times RSS", success: false, error: lastError, fetch_time_gmt: fetchTime, items: [], data_age_minutes: null, accuracy_score: 0 };
}

async function fetchReutersWorldRSS(): Promise<Record<string, unknown>> {
  const fetchTime = nowISO();
  const keywords = ["war", "conflict", "sanctions", "attack", "explosion", "iran", "russia", "ukraine", "middle east", "israel", "blockade", "tanker", "hormuz", "red sea", "houthi", "yemen", "opec", "ceasefire", "coup", "militia"];
  const urls = [
    "https://feeds.reuters.com/reuters/worldNews",
    "https://feeds.reuters.com/Reuters/worldNews",
    "https://www.reutersagency.com/feed/?best-topics=political-general&post_type=best",
    "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
    "https://www.aljazeera.com/xml/rss/all.xml",
  ];
  let lastError = "All Reuters/world news RSS URLs failed";
  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) { lastError = `HTTP ${res.status} from ${url}`; continue; }
      const xml = await res.text();
      const all = parseRSS(xml);
      if (all.length === 0) { lastError = `No items from ${url}`; continue; }
      const filtered = filterByKeywords(all, keywords).slice(0, 8);
      const items = filtered.length > 0 ? filtered : all.slice(0, 6);
      const newestPub = items[0]?.published ?? null;
      const dataAge = newestPub ? Math.round((Date.now() - new Date(newestPub).getTime()) / 60000) : null;
      const fetchAge = ageMinutes(fetchTime);
      return {
        source_name: "Reuters World RSS",
        success: true,
        error: null,
        fetch_time_gmt: fetchTime,
        items,
        newest_item_published: newestPub,
        data_age_minutes: dataAge ?? fetchAge,
        accuracy_score: feedAccuracyScore(fetchAge, dataAge, 120, true),
        note: `World geopolitical and conflict news (via ${url})`,
      };
    } catch (e) {
      lastError = String(e);
    }
  }
  return { source_name: "Reuters World RSS", success: false, error: lastError, fetch_time_gmt: fetchTime, items: [], data_age_minutes: null, accuracy_score: 0 };
}

async function fetchReutersCommoditiesRSS(): Promise<Record<string, unknown>> {
  const fetchTime = nowISO();
  const keywords = ["oil", "crude", "brent", "gas", "wheat", "grain", "corn", "shipping", "freight", "fertilizer", "fertiliser", "commodity", "supply", "tanker", "opec", "eia", "ukraine", "export", "harvest"];
  const urls = [
    "https://feeds.reuters.com/reuters/businessNews",
    "https://www.cnbc.com/id/19836768/device/rss/rss.html",
    "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19836768",
    "https://www.rigzone.com/news/rss/rigzone_latest.aspx",
  ];
  let lastError = "All Reuters commodity RSS URLs failed";
  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) { lastError = `HTTP ${res.status} from ${url}`; continue; }
      const xml = await res.text();
      const all = parseRSS(xml);
      if (all.length === 0) { lastError = `No items from ${url}`; continue; }
      const filtered = filterByKeywords(all, keywords).slice(0, 8);
      const items = filtered.length > 0 ? filtered : all.slice(0, 5);
      const newestPub = items[0]?.published ?? null;
      const dataAge = newestPub ? Math.round((Date.now() - new Date(newestPub).getTime()) / 60000) : null;
      const fetchAge = ageMinutes(fetchTime);
      return {
        source_name: "Reuters Commodities RSS",
        success: true,
        error: null,
        fetch_time_gmt: fetchTime,
        items,
        newest_item_published: newestPub,
        data_age_minutes: dataAge ?? fetchAge,
        accuracy_score: feedAccuracyScore(fetchAge, dataAge, 240, true),
        note: `Commodity and energy market news (via ${url})`,
      };
    } catch (e) {
      lastError = String(e);
    }
  }
  return { source_name: "Reuters Commodities RSS", success: false, error: lastError, fetch_time_gmt: fetchTime, items: [], data_age_minutes: null, accuracy_score: 0 };
}

async function fetchReliefWebRSS(): Promise<Record<string, unknown>> {
  const fetchTime = nowISO();
  const keywords = ["conflict", "war", "displacement", "famine", "drought", "flood", "ukraine", "sudan", "myanmar", "middle east", "food insecurity", "humanitarian", "crisis", "armed", "attack"];
  const urls = [
    "https://reliefweb.int/updates/rss.xml?primary_country=0&source=0&type[]=News%20and%20Press%20Release",
    "https://reliefweb.int/updates/rss.xml",
    "https://acleddata.com/feed/",
  ];
  let lastError = "All ReliefWeb/conflict RSS URLs failed";
  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) { lastError = `HTTP ${res.status} from ${url}`; continue; }
      const xml = await res.text();
      const all = parseRSS(xml);
      if (all.length === 0) { lastError = `No items from ${url}`; continue; }
      const filtered = filterByKeywords(all, keywords).slice(0, 8);
      const items = filtered.length > 0 ? filtered : all.slice(0, 6);
      const newestPub = items[0]?.published ?? null;
      const dataAge = newestPub ? Math.round((Date.now() - new Date(newestPub).getTime()) / 60000) : null;
      const fetchAge = ageMinutes(fetchTime);
      return {
        source_name: "ReliefWeb Conflict RSS",
        success: true,
        error: null,
        fetch_time_gmt: fetchTime,
        items,
        newest_item_published: newestPub,
        data_age_minutes: dataAge ?? fetchAge,
        accuracy_score: feedAccuracyScore(fetchAge, dataAge, 360, true),
        note: `UN/humanitarian conflict intelligence (via ${url})`,
      };
    } catch (e) {
      lastError = String(e);
    }
  }
  return { source_name: "ReliefWeb Conflict RSS", success: false, error: lastError, fetch_time_gmt: fetchTime, items: [], data_age_minutes: null, accuracy_score: 0 };
}

async function fetchShippingRSS(): Promise<Record<string, unknown>> {
  const fetchTime = nowISO();
  const keywords = ["baltic", "bdi", "dry bulk", "container", "shipping", "freight", "tanker", "vessel", "port", "red sea", "panama", "suez", "hormuz", "houthi", "attack", "piracy", "congestion", "rates", "bunker"];
  const urls = [
    "https://www.tradewindsnews.com/rss",
    "https://splash247.com/feed/",
    "https://www.hellenicshippingnews.com/feed/",
    "https://www.seatrade-maritime.com/rss.xml",
    "https://gcaptain.com/feed/",
  ];
  let lastError = "All shipping RSS URLs failed";
  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) { lastError = `HTTP ${res.status} from ${url}`; continue; }
      const xml = await res.text();
      const all = parseRSS(xml);
      if (all.length === 0) { lastError = `No items from ${url}`; continue; }
      const filtered = filterByKeywords(all, keywords).slice(0, 8);
      const items = filtered.length > 0 ? filtered : all.slice(0, 6);
      const newestPub = items[0]?.published ?? null;
      const dataAge = newestPub ? Math.round((Date.now() - new Date(newestPub).getTime()) / 60000) : null;
      const fetchAge = ageMinutes(fetchTime);
      return {
        source_name: "Shipping RSS",
        success: true,
        error: null,
        fetch_time_gmt: fetchTime,
        items,
        newest_item_published: newestPub,
        data_age_minutes: dataAge ?? fetchAge,
        accuracy_score: feedAccuracyScore(fetchAge, dataAge, 480, true),
        note: `Maritime freight and shipping market news (via ${url})`,
      };
    } catch (e) {
      lastError = String(e);
    }
  }
  return { source_name: "Shipping RSS", success: false, error: lastError, fetch_time_gmt: fetchTime, items: [], data_age_minutes: null, accuracy_score: 0 };
}

async function fetchRigzoneRSS(): Promise<Record<string, unknown>> {
  const fetchTime = nowISO();
  const keywords = ["oil", "gas", "lng", "crude", "brent", "opec", "rig", "offshore", "pipeline", "refinery", "tanker", "energy", "drilling", "production", "supply"];
  const urls = [
    "https://www.rigzone.com/news/rss/rigzone_latest.aspx",
    "https://www.offshore-technology.com/feed/",
    "https://oilprice.com/rss/main",
  ];
  let lastError = "All Rigzone/oil industry RSS URLs failed";
  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) { lastError = `HTTP ${res.status} from ${url}`; continue; }
      const xml = await res.text();
      const all = parseRSS(xml);
      if (all.length === 0) { lastError = `No items from ${url}`; continue; }
      const filtered = filterByKeywords(all, keywords).slice(0, 6);
      const items = filtered.length > 0 ? filtered : all.slice(0, 5);
      const newestPub = items[0]?.published ?? null;
      const dataAge = newestPub ? Math.round((Date.now() - new Date(newestPub).getTime()) / 60000) : null;
      const fetchAge = ageMinutes(fetchTime);
      return {
        source_name: "Rigzone RSS",
        success: true,
        error: null,
        fetch_time_gmt: fetchTime,
        items,
        newest_item_published: newestPub,
        data_age_minutes: dataAge ?? fetchAge,
        accuracy_score: feedAccuracyScore(fetchAge, dataAge, 480, true),
        note: `Oil & gas industry news — upstream production and supply signals (via ${url})`,
      };
    } catch (e) {
      lastError = String(e);
    }
  }
  return { source_name: "Rigzone RSS", success: false, error: lastError, fetch_time_gmt: fetchTime, items: [], data_age_minutes: null, accuracy_score: 0 };
}

async function fetchWorldGrainRSS(): Promise<Record<string, unknown>> {
  const fetchTime = nowISO();
  const keywords = ["wheat", "corn", "grain", "soybean", "rice", "barley", "oat", "crop", "harvest", "export", "import", "supply", "demand", "price", "ukraine", "russia", "usda", "fao"];
  const urls = [
    "https://www.world-grain.com/rss/news",
    "https://www.world-grain.com/feed/",
    "https://agfax.com/feed/",
    "https://www.farmdocdaily.illinois.edu/feed",
  ];
  let lastError = "All World Grain RSS URLs failed";
  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) { lastError = `HTTP ${res.status} from ${url}`; continue; }
      const xml = await res.text();
      const all = parseRSS(xml);
      if (all.length === 0) { lastError = `No items from ${url}`; continue; }
      const filtered = filterByKeywords(all, keywords).slice(0, 6);
      const items = filtered.length > 0 ? filtered : all.slice(0, 5);
      const newestPub = items[0]?.published ?? null;
      const dataAge = newestPub ? Math.round((Date.now() - new Date(newestPub).getTime()) / 60000) : null;
      const fetchAge = ageMinutes(fetchTime);
      return {
        source_name: "World Grain RSS",
        success: true,
        error: null,
        fetch_time_gmt: fetchTime,
        items,
        newest_item_published: newestPub,
        data_age_minutes: dataAge ?? fetchAge,
        accuracy_score: feedAccuracyScore(fetchAge, dataAge, 1440, true),
        note: `Global grain market intelligence (via ${url})`,
      };
    } catch (e) {
      lastError = String(e);
    }
  }
  return { source_name: "World Grain RSS", success: false, error: lastError, fetch_time_gmt: fetchTime, items: [], data_age_minutes: null, accuracy_score: 0 };
}

async function fetchFertilizerRSS(): Promise<Record<string, unknown>> {
  const fetchTime = nowISO();
  const keywords = ["fertilizer", "fertiliser", "urea", "ammonia", "nitrogen", "potash", "phosphate", "dap", "map", "npk", "crop input", "agrochemical", "natural gas", "feedstock", "price", "supply", "sanction", "russia", "belarus"];
  const urls = [
    "https://www.fertilizerweek.com/rss",
    "https://www.icis.com/explore/resources/news/rss/",
    "https://www.agweb.com/feed",
    "https://www.profercy.com/rss/",
  ];
  let lastError = "All fertilizer RSS URLs failed";
  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) { lastError = `HTTP ${res.status} from ${url}`; continue; }
      const xml = await res.text();
      const all = parseRSS(xml);
      if (all.length === 0) { lastError = `No items from ${url}`; continue; }
      const filtered = filterByKeywords(all, keywords).slice(0, 6);
      const items = filtered.length > 0 ? filtered : all.slice(0, 5);
      const newestPub = items[0]?.published ?? null;
      const dataAge = newestPub ? Math.round((Date.now() - new Date(newestPub).getTime()) / 60000) : null;
      const fetchAge = ageMinutes(fetchTime);
      return {
        source_name: "Fertilizer RSS",
        success: true,
        error: null,
        fetch_time_gmt: fetchTime,
        items,
        newest_item_published: newestPub,
        data_age_minutes: dataAge ?? fetchAge,
        accuracy_score: feedAccuracyScore(fetchAge, dataAge, 1440, true),
        note: `Fertilizer and crop input market news (via ${url})`,
      };
    } catch (e) {
      lastError = String(e);
    }
  }
  return { source_name: "Fertilizer RSS", success: false, error: lastError, fetch_time_gmt: fetchTime, items: [], data_age_minutes: null, accuracy_score: 0 };
}

async function fetchFreightRatesRSS(): Promise<Record<string, unknown>> {
  const fetchTime = nowISO();
  const keywords = ["baltic", "bdi", "dry bulk", "capesize", "panamax", "supramax", "handysize", "container", "freight rate", "spot rate", "bunker", "port congestion", "vessel", "charter", "drewry", "xeneta"];
  const urls = [
    "https://www.hellenicshippingnews.com/feed/",
    "https://gcaptain.com/feed/",
    "https://splash247.com/feed/",
    "https://www.maritimeexecutive.com/rss",
  ];
  let lastError = "All freight rates RSS URLs failed";
  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) { lastError = `HTTP ${res.status} from ${url}`; continue; }
      const xml = await res.text();
      const all = parseRSS(xml);
      if (all.length === 0) { lastError = `No items from ${url}`; continue; }
      const filtered = filterByKeywords(all, keywords).slice(0, 6);
      const items = filtered.length > 0 ? filtered : all.slice(0, 5);
      const newestPub = items[0]?.published ?? null;
      const dataAge = newestPub ? Math.round((Date.now() - new Date(newestPub).getTime()) / 60000) : null;
      const fetchAge = ageMinutes(fetchTime);
      return {
        source_name: "Freight Rates RSS",
        success: true,
        error: null,
        fetch_time_gmt: fetchTime,
        items,
        newest_item_published: newestPub,
        data_age_minutes: dataAge ?? fetchAge,
        accuracy_score: feedAccuracyScore(fetchAge, dataAge, 480, true),
        note: `Baltic Exchange, container rates, and freight market intelligence (via ${url})`,
      };
    } catch (e) {
      lastError = String(e);
    }
  }
  return { source_name: "Freight Rates RSS", success: false, error: lastError, fetch_time_gmt: fetchTime, items: [], data_age_minutes: null, accuracy_score: 0 };
}

async function fetchMetalsRSS(): Promise<Record<string, unknown>> {
  const fetchTime = nowISO();
  const keywords = ["copper", "silver", "gold", "aluminium", "aluminum", "steel", "iron ore", "nickel", "zinc", "lme", "comex", "base metal", "precious metal", "mining", "smelter", "supply", "demand", "china", "construction"];
  const urls = [
    "https://www.mining.com/feed/",
    "https://www.metalbulletin.com/rss/",
    "https://www.kitco.com/rss/news.xml",
    "https://www.mining-technology.com/feed/",
  ];
  let lastError = "All metals RSS URLs failed";
  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) { lastError = `HTTP ${res.status} from ${url}`; continue; }
      const xml = await res.text();
      const all = parseRSS(xml);
      if (all.length === 0) { lastError = `No items from ${url}`; continue; }
      const filtered = filterByKeywords(all, keywords).slice(0, 6);
      const items = filtered.length > 0 ? filtered : all.slice(0, 5);
      const newestPub = items[0]?.published ?? null;
      const dataAge = newestPub ? Math.round((Date.now() - new Date(newestPub).getTime()) / 60000) : null;
      const fetchAge = ageMinutes(fetchTime);
      return {
        source_name: "Metals RSS",
        success: true,
        error: null,
        fetch_time_gmt: fetchTime,
        items,
        newest_item_published: newestPub,
        data_age_minutes: dataAge ?? fetchAge,
        accuracy_score: feedAccuracyScore(fetchAge, dataAge, 480, true),
        note: `Metals and mining market intelligence — copper, silver, base metals (via ${url})`,
      };
    } catch (e) {
      lastError = String(e);
    }
  }
  return { source_name: "Metals RSS", success: false, error: lastError, fetch_time_gmt: fetchTime, items: [], data_age_minutes: null, accuracy_score: 0 };
}

function computeOverallAccuracy(sources: Record<string, unknown>[]): number {
  const successfulScores = sources
    .filter(s => s.success === true)
    .map(s => (s.accuracy_score as number) ?? 0);
  if (successfulScores.length === 0) return 0;
  return Math.round(successfulScores.reduce((a, b) => a + b, 0) / successfulScores.length);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    const sinceMs: number = body?.since_ms
      ? Number(body.since_ms)
      : monitoringWindowStart();

    const results = await Promise.allSettled([
      fetchYahooFinance(),
      fetchBrentCrude(),
      fetchFxRates(),
      fetchAHDBRSS(),
      fetchBBCBusinessRSS(),
      fetchAlJazeeraRSS(),
      fetchFarmersWeeklyRSS(),
      fetchBankOfEnglandRSS(),
      fetchOBRRSS(),
      fetchGuardianBusinessRSS(),
      fetchMarketWatchRSS(),
      fetchUSDARSS(),
      fetchFTCommoditiesRSS(),
      fetchReutersWorldRSS(),
      fetchReutersCommoditiesRSS(),
      fetchReliefWebRSS(),
      fetchShippingRSS(),
      fetchRigzoneRSS(),
      fetchWorldGrainRSS(),
      fetchFertilizerRSS(),
      fetchFreightRatesRSS(),
      fetchMetalsRSS(),
    ]);

    const rawSources = results.map(r =>
      r.status === "fulfilled"
        ? r.value
        : { source_name: "unknown", success: false, error: String((r as PromiseRejectedResult).reason), fetch_time_gmt: nowISO(), data_age_minutes: null, accuracy_score: 0 }
    );

    const sources = rawSources.map(src => {
      const s = src as Record<string, unknown>;
      if (s.items && Array.isArray(s.items)) {
        const filtered = filterBySince(
          s.items as { title: string; summary: string; published: string; link: string }[],
          sinceMs,
        );
        return { ...s, items: filtered, items_in_window: filtered.length, items_total: (s.items as unknown[]).length };
      }
      return s;
    });

    const overallAccuracy = computeOverallAccuracy(sources as Record<string, unknown>[]);
    const successCount = sources.filter(s => (s as Record<string, unknown>).success === true).length;

    const windowStart = new Date(sinceMs).toISOString();

    const payload = {
      fetched_at: nowISO(),
      monitoring_window_start_utc: windowStart,
      overall_accuracy_score: overallAccuracy,
      sources_ok: successCount,
      sources_total: sources.length,
      sources,
    };

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
