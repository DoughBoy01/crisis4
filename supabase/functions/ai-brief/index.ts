import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface NewsItem {
  title: string;
  summary: string;
  published: string;
}

interface FeedSource {
  source_name: string;
  success: boolean;
  items?: NewsItem[];
  current_price?: number;
  previous_price?: number;
  change_pct?: number;
  gbp_usd?: number;
  gbp_eur?: number;
  quotes?: Array<{
    symbol: string;
    label: string;
    price: number | null;
    previousClose: number | null;
    changePercent: number | null;
  }>;
}

interface FeedPayload {
  fetched_at: string;
  sources: FeedSource[];
  overall_accuracy_score: number;
  sources_ok: number;
  sources_total: number;
}

interface DailyBrief {
  id: string;
  brief_date: string;
  generated_at: string;
  feed_snapshot_at: string | null;
  narrative: string;
  three_things: string[];
  action_rationale: Record<string, string>;
  geopolitical_context: string;
  procurement_actions: string[];
  market_outlook: string;
  sector_news_digest: Record<string, string[]>;
  sector_forward_outlook: Record<string, string>;
  model: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
}

interface CommodityPercentile {
  commodity_id: string;
  p10: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  data_source: string;
}

interface SeasonalPattern {
  commodity_id: string;
  month_number: number;
  seasonal_index: number;
  pressure_label: string;
  notes: string | null;
}

interface ConflictBaseline {
  zone_id: string;
  zone_name: string;
  baseline_event_frequency: number;
  historical_commodity_impact_pct: number | null;
  elevated_threshold?: number | null;
  high_threshold?: number | null;
  critical_threshold?: number | null;
}

function computePercentileRank(price: number, p: CommodityPercentile): number | null {
  if (!p.p10 || !p.p25 || !p.p50 || !p.p75 || !p.p90) return null;
  if (price <= p.p10) return 5;
  if (price <= p.p25) return Math.round(10 + ((price - p.p10) / (p.p25 - p.p10)) * 15);
  if (price <= p.p50) return Math.round(25 + ((price - p.p25) / (p.p50 - p.p25)) * 25);
  if (price <= p.p75) return Math.round(50 + ((price - p.p50) / (p.p75 - p.p50)) * 25);
  if (price <= p.p90) return Math.round(75 + ((price - p.p75) / (p.p90 - p.p75)) * 15);
  return Math.min(99, Math.round(90 + ((price - p.p90) / (p.p90 * 0.2)) * 9));
}

function percentileLabel(rank: number): string {
  if (rank >= 90) return "near 10-yr high";
  if (rank >= 75) return "above 10-yr average";
  if (rank >= 50) return "mid 10-yr range";
  if (rank >= 25) return "below 10-yr average";
  return "near 10-yr low";
}

async function fetchHistoricalContext(db: ReturnType<typeof createClient>) {
  const currentMonth = new Date().getMonth() + 1;

  const [percResult, seasonalResult, conflictResult] = await Promise.all([
    db.from("commodity_percentiles").select("commodity_id,p10,p25,p50,p75,p90,data_source").eq("lookback_years", 10),
    db.from("commodity_seasonal_patterns").select("commodity_id,month_number,seasonal_index,pressure_label,notes").eq("month_number", currentMonth),
    db.from("conflict_zone_baselines").select("zone_id,zone_name,baseline_event_frequency,historical_commodity_impact_pct,elevated_threshold,high_threshold,critical_threshold"),
  ]);

  return {
    percentiles: (percResult.data ?? []) as CommodityPercentile[],
    seasonal: (seasonalResult.data ?? []) as SeasonalPattern[],
    conflictBaselines: (conflictResult.data ?? []) as ConflictBaseline[],
  };
}

function buildHistoricalContextSection(
  feeds: FeedPayload,
  percentiles: CommodityPercentile[],
  seasonal: SeasonalPattern[],
): string {
  const lines: string[] = ["=== HISTORICAL CONTEXT (World Bank Pink Sheet + Seasonal Data) ==="];

  const yahooPrices = feeds.sources.find(s => s.source_name === "Yahoo Finance" || s.source_name === "Stooq Market Data");
  const symbolMap: Record<string, string> = {
    "BZ=F": "Brent Crude",
    "NG=F": "Natural Gas",
    "ZW=F": "Wheat",
    "ZC=F": "Corn",
    "ZS=F": "Soybeans",
    "GC=F": "Gold",
    "SI=F": "Silver",
    "HG=F": "Copper",
  };

  if (yahooPrices?.quotes?.length) {
    for (const q of yahooPrices.quotes) {
      if (!symbolMap[q.symbol] || q.price == null) continue;
      const perc = percentiles.find(p => p.commodity_id === q.symbol);
      if (!perc) continue;
      const rank = computePercentileRank(q.price, perc);
      if (rank != null) {
        lines.push(`${symbolMap[q.symbol]}: ${rank}th percentile vs 10-yr history (${percentileLabel(rank)}) — source: ${perc.data_source}`);
      }
      const sp = seasonal.find(s => s.commodity_id === q.symbol);
      if (sp && sp.pressure_label !== "NORMAL") {
        lines.push(`  → Seasonal demand pressure this month: ${sp.pressure_label} (index ${sp.seasonal_index.toFixed(2)}x avg). ${sp.notes ?? ""}`);
      }
    }
  }

  if (lines.length === 1) {
    lines.push("No historical context data available for current prices.");
  }

  return lines.join("\n");
}

function buildConflictBaselineSection(conflictBaselines: ConflictBaseline[], feeds: FeedPayload): string {
  if (conflictBaselines.length === 0) return "";

  const lines: string[] = ["=== CONFLICT ZONE BASELINES (Historical Risk Intelligence) ==="];
  lines.push("These are historical baseline frequencies for conflict events in key supply-chain zones.");
  lines.push("Use these to assess whether current news represents an ESCALATION above normal baseline risk.");
  lines.push("");

  for (const zone of conflictBaselines) {
    const impactStr = zone.historical_commodity_impact_pct != null
      ? ` | Historical commodity price impact: +${zone.historical_commodity_impact_pct}% on escalation`
      : "";
    const thresholds: string[] = [];
    if (zone.elevated_threshold != null) thresholds.push(`elevated=${zone.elevated_threshold}`);
    if (zone.high_threshold != null) thresholds.push(`high=${zone.high_threshold}`);
    if (zone.critical_threshold != null) thresholds.push(`critical=${zone.critical_threshold}`);
    const threshStr = thresholds.length > 0 ? ` | Alert thresholds: ${thresholds.join(", ")} events/wk` : "";
    lines.push(`${zone.zone_name}: baseline ${zone.baseline_event_frequency} events/week${impactStr}${threshStr}`);
  }

  const conflictSources = [
    "Reuters World RSS", "Al Jazeera RSS", "ReliefWeb Conflict RSS",
  ];
  const conflictHeadlines: string[] = [];
  for (const src of feeds.sources) {
    if (conflictSources.includes(src.source_name) && src.success && src.items?.length) {
      for (const item of src.items.slice(0, 4)) {
        conflictHeadlines.push(`[${src.source_name}] ${item.title}`);
      }
    }
  }

  if (conflictHeadlines.length > 0) {
    lines.push("");
    lines.push("Current conflict headlines for comparison against baselines:");
    lines.push(conflictHeadlines.join("\n"));
  }

  return lines.join("\n");
}

const ALL_NEWS_SOURCES = [
  "BBC Business RSS",
  "Al Jazeera RSS",
  "Guardian Business RSS",
  "Farmers Weekly RSS",
  "AHDB RSS",
  "Reuters World RSS",
  "Reuters Commodities RSS",
  "ReliefWeb Conflict RSS",
  "Shipping RSS",
  "Freight Rates RSS",
  "MarketWatch RSS",
  "USDA RSS",
  "Financial Times RSS",
  "Rigzone RSS",
  "World Grain RSS",
  "Fertilizer RSS",
  "Metals RSS",
  "Bank of England RSS",
  "OBR RSS",
];

const SOURCE_CATEGORY: Record<string, string> = {
  "BBC Business RSS": "GENERAL",
  "Guardian Business RSS": "GENERAL",
  "MarketWatch RSS": "GENERAL",
  "Financial Times RSS": "ENERGY/COMMODITY",
  "Reuters Commodities RSS": "ENERGY/COMMODITY",
  "Rigzone RSS": "ENERGY",
  "Al Jazeera RSS": "GEOPOLITICAL",
  "Reuters World RSS": "GEOPOLITICAL",
  "ReliefWeb Conflict RSS": "GEOPOLITICAL",
  "Shipping RSS": "FREIGHT",
  "Freight Rates RSS": "FREIGHT",
  "AHDB RSS": "AGRICULTURAL",
  "Farmers Weekly RSS": "AGRICULTURAL",
  "USDA RSS": "AGRICULTURAL",
  "World Grain RSS": "AGRICULTURAL",
  "Fertilizer RSS": "FERTILIZER",
  "Metals RSS": "METALS",
  "Bank of England RSS": "POLICY",
  "OBR RSS": "POLICY",
};

function buildNewsSection(feeds: FeedPayload): string {
  const byCategory: Record<string, string[]> = {};

  for (const src of feeds.sources) {
    if (!ALL_NEWS_SOURCES.includes(src.source_name)) continue;
    if (!src.success || !src.items?.length) continue;

    const category = SOURCE_CATEGORY[src.source_name] ?? "GENERAL";
    if (!byCategory[category]) byCategory[category] = [];

    for (const item of src.items.slice(0, 3)) {
      byCategory[category].push(`[${src.source_name}] ${item.title}`);
    }
  }

  const lines: string[] = ["=== NEWS & INTELLIGENCE BY CATEGORY (22:00–07:00 GMT WINDOW) ==="];

  const categoryOrder = ["GEOPOLITICAL", "ENERGY", "ENERGY/COMMODITY", "FREIGHT", "AGRICULTURAL", "FERTILIZER", "METALS", "POLICY", "GENERAL"];
  for (const cat of categoryOrder) {
    const items = byCategory[cat];
    if (items && items.length > 0) {
      lines.push(`\n--- ${cat} ---`);
      lines.push(...items.slice(0, 6));
    }
  }

  if (lines.length === 1) {
    lines.push("No news available.");
  }

  return lines.join("\n");
}

function buildPrompt(
  feeds: FeedPayload,
  percentiles: CommodityPercentile[],
  seasonal: SeasonalPattern[],
  conflictBaselines: ConflictBaseline[],
): string {
  const lines: string[] = [];

  const prices: string[] = [];
  const yahooPrices = feeds.sources.find(s => s.source_name === "Yahoo Finance" || s.source_name === "Stooq Market Data");
  if (yahooPrices?.quotes?.length) {
    for (const q of yahooPrices.quotes) {
      if (q.price != null && q.changePercent != null) {
        const dir = q.changePercent >= 0 ? "+" : "";
        prices.push(`${q.label}: ${q.price.toFixed(2)} (${dir}${q.changePercent.toFixed(2)}%)`);
      }
    }
  }

  const brentSrc = feeds.sources.find(s => s.source_name === "EIA Brent Crude");
  if (brentSrc?.success && brentSrc.current_price) {
    const pct = brentSrc.change_pct != null ? ` (${brentSrc.change_pct >= 0 ? "+" : ""}${brentSrc.change_pct.toFixed(2)}%)` : "";
    prices.push(`Brent Crude (EIA): $${brentSrc.current_price.toFixed(2)}/bbl${pct}`);
  }

  const fxSrc = feeds.sources.find(s => s.source_name === "ExchangeRate.host FX");
  if (fxSrc?.success) {
    const yahooGbpUsd = yahooPrices?.quotes?.find(q => q.symbol === "GBPUSD=X");
    const yahooGbpEur = yahooPrices?.quotes?.find(q => q.symbol === "GBPEUR=X");
    if (fxSrc.gbp_usd && !yahooGbpUsd?.changePercent) {
      prices.push(`GBP/USD (spot): ${(fxSrc.gbp_usd as number).toFixed(4)} — no overnight change available from this source`);
    }
    if (fxSrc.gbp_eur && !yahooGbpEur?.changePercent) {
      prices.push(`GBP/EUR (spot): ${(fxSrc.gbp_eur as number).toFixed(4)} — no overnight change available from this source`);
    }
  }

  const historicalContextSection = buildHistoricalContextSection(feeds, percentiles, seasonal);
  const conflictBaselineSection = buildConflictBaselineSection(conflictBaselines, feeds);
  const newsSection = buildNewsSection(feeds);

  lines.push("You are a procurement intelligence analyst for a UK food & agricultural business.");
  lines.push("Your monitoring window is 22:00–07:00 GMT (10pm last night to 7am this morning).");
  lines.push("Your audience receives this brief at 07:00 GMT — summarise EVERYTHING that moved or was reported during that 9-hour window.");
  lines.push("Be direct, specific, and actionable. No waffle. Use plain English.");
  lines.push("All price moves are vs the 22:00 GMT baseline (previous close or last traded price at start of window).");
  lines.push("");
  lines.push("INTELLIGENCE GUIDANCE:");
  lines.push("- Use the historical percentile context to calibrate significance (e.g. 'Wheat is near a 10-yr high, making this move more significant')");
  lines.push("- Use seasonal demand context to explain whether price moves compound or conflict with seasonal patterns");
  lines.push("- Use conflict zone baselines to assess whether current geopolitical news represents genuine ESCALATION above historical norms");
  lines.push("- Cross-reference metals prices (Gold, Silver, Copper) with geopolitical risk — gold/silver rising alongside conflict news signals genuine risk-off sentiment");
  lines.push("- Use Bank of England and OBR policy news to contextualise GBP strength/weakness implications for import costs");
  lines.push("- Fertilizer RSS covers urea, DAP, ammonia, potash — include specific product names if mentioned");
  lines.push("");
  lines.push("=== PRICE MOVES (22:00–07:00 GMT WINDOW) ===");
  lines.push(prices.length ? prices.join("\n") : "No price data available.");
  lines.push("");
  lines.push(historicalContextSection);
  lines.push("");
  if (conflictBaselineSection) {
    lines.push(conflictBaselineSection);
    lines.push("");
  }
  lines.push(newsSection);
  lines.push("");
  lines.push("=== YOUR TASK ===");
  lines.push("WRITING STANDARDS — READ BEFORE WRITING ANYTHING:");
  lines.push("- Write as a senior analyst briefing a CFO or CPO. Be specific, citable, and direct. No hedging.");
  lines.push("- Always include specific numbers: exact prices, exact % changes, exact basis points, named sources.");
  lines.push("- Reference historical percentile position when available (e.g. 'Wheat at 83rd percentile vs 10-yr history — near multi-year highs').");
  lines.push("- Reference seasonal context when relevant (e.g. 'Corn in HIGH seasonal demand period, amplifying the +1.8% overnight move').");
  lines.push("- Reference conflict zone baselines when conflict news is present (e.g. 'Black Sea events this week exceed the baseline of 3/week — elevated risk').");
  lines.push("- For procurement implications, name the specific input cost impact: 'Bread/flour buyers: +£X/tonne estimated input cost increase'.");
  lines.push("- For FX, always state the import cost implication explicitly: 'GBP/USD down 0.4% = approximately 0.4% rise in USD-denominated import costs'.");
  lines.push("");
  lines.push("CRITICAL RULES FOR action_rationale:");
  lines.push("- Each sector value must be a FULL PARAGRAPH of 3-5 sentences minimum when data exists.");
  lines.push("- Sentence 1: What happened (specific price/move/event).");
  lines.push("- Sentence 2: Historical context (percentile, seasonal, baseline comparison).");
  lines.push("- Sentence 3: Named supply chain or procurement implication.");
  lines.push("- Sentence 4 (optional): Forward-looking risk or what to watch.");
  lines.push("- Only write a value for a sector if you have ACTUAL data: a real price move with a non-zero % OR a relevant news headline.");
  lines.push("- If you have no price move data AND no relevant headline for a sector, return EMPTY STRING \"\". Never write filler.");
  lines.push("- A price unchanged (0.00%) with no related news = empty string.");
  lines.push("- Only include geopolitical_context if there is a specific named conflict or policy event. Otherwise empty string.");
  lines.push("");
  lines.push("CRITICAL RULES FOR three_things:");
  lines.push("- Each of the 3 items must be 2-3 sentences. Lead with the specific data point, follow with the procurement/business implication.");
  lines.push("- These must be self-contained — the reader should not need to go anywhere else to understand the significance.");
  lines.push("");
  lines.push("CRITICAL RULES FOR procurement_actions:");
  lines.push("- Provide 2-4 specific, actionable recommendations based on the overnight data.");
  lines.push("- Each action must reference a specific market or event and give a concrete instruction.");
  lines.push("- Example: 'Lock in Q3 wheat contracts this week — prices at 83rd percentile vs 10-yr history and Black Sea risk elevated'.");
  lines.push("- If there is nothing actionable (flat, quiet night), return an empty array.");
  lines.push("");
  lines.push("CRITICAL RULES FOR market_outlook:");
  lines.push("- 2-3 sentences on what to watch during the coming trading session (07:00-17:00 GMT).");
  lines.push("- Name specific data releases, scheduled events, or price levels to monitor.");
  lines.push("- EMPTY STRING if nothing notable is scheduled or signalled.");
  lines.push("");
  lines.push("CRITICAL RULES FOR sector_news_digest:");
  lines.push("- For each sector that has content in action_rationale, list the 1-3 most important news headlines or price events that drove the analysis.");
  lines.push("- Each entry is a plain string: the exact headline text or price event description (e.g. '[Reuters World RSS] Russian strikes hit Odessa port infrastructure').");
  lines.push("- Include the source name in brackets at the start, exactly as it appears in the news feeds above.");
  lines.push("- If a sector has no content (empty string in action_rationale), set its digest to an empty array.");
  lines.push("- This field is used to show the reader WHY the sector analysis was written — cite your sources.");
  lines.push("");
  lines.push("CRITICAL RULES FOR sector_forward_outlook:");
  lines.push("- For each sector that has content in action_rationale, write 1-2 sentences on what is LIKELY TO HAPPEN in that sector over the next 2-5 trading days.");
  lines.push("- Base this on: the current price direction, the geopolitical risk trajectory, seasonal demand patterns, and any upcoming scheduled events.");
  lines.push("- Be directional: say 'prices likely to remain elevated', 'watch for pullback if...', 'further upside risk if...' — not vague generalities.");
  lines.push("- If a sector has no content in action_rationale, set its forward outlook to an empty string.");
  lines.push("");
  lines.push("Return ONLY valid JSON with this exact structure:");
  lines.push(JSON.stringify({
    narrative: "3-5 sentence plain-English summary of the overnight session. Lead with the single biggest market move or geopolitical development. Include exact prices and % changes. Reference historical percentile position for any extreme moves. State whether conflict news represents escalation above baseline norms. End with the net procurement implication.",
    three_things: [
      "Specific data point (price, event, name) — follow immediately with the procurement/business implication in 1-2 additional sentences. Self-contained. No dashboard needed.",
      "Second most important (same format — data + implication + context). 2-3 sentences total.",
      "Third most important (same format). 2-3 sentences total."
    ],
    geopolitical_context: "2-4 sentences. Name specific conflict zones, specific events, specific commodity exposure. State whether current event frequency is above or below historical baseline. State the supply chain corridor at risk and which commodities are most exposed. EMPTY STRING if no specific geopolitical event.",
    procurement_actions: [
      "Action 1: specific instruction referencing specific market/price/event",
      "Action 2: specific instruction referencing specific market/price/event"
    ],
    market_outlook: "2-3 sentences on what to watch today (07:00-17:00 GMT). Name specific data releases, price thresholds, or events. EMPTY STRING if nothing notable scheduled.",
    action_rationale: {
      "energy": "ONLY if Brent, WTI, Nat Gas, Heating Oil, or Gasoline moved meaningfully OR energy headlines appeared. 3-5 sentences: (1) exact price and % move, (2) historical percentile context, (3) procurement impact for energy/fuel buyers, (4) forward risk. EMPTY STRING if no data.",
      "agricultural": "ONLY if Wheat, Corn, Soybeans, or Rice moved meaningfully OR USDA/World Grain/Farmers Weekly headlines appeared. 3-5 sentences: (1) exact prices and % moves for each grain that moved, (2) historical percentile and seasonal context, (3) named procurement impact (flour, feed, food manufacturing costs), (4) key drivers. EMPTY STRING if no data.",
      "freight": "ONLY if BDI, container rates, or shipping headlines appeared. 3-5 sentences: (1) BDI level and move if available, (2) specific shipping lane status (Red Sea, Cape Horn rerouting etc.), (3) impact on lead times and landed cost for importers, (4) bunker cost context. EMPTY STRING if no data.",
      "fertilizer": "ONLY if urea, DAP, ammonia, potash, or nitrogen mentioned in Fertilizer RSS OR had a price move. 3-5 sentences: (1) specific product(s) and price/event, (2) seasonal application relevance (spring/autumn), (3) implication for crop input costs and planting economics. EMPTY STRING if no data.",
      "metals": "ONLY if Gold, Silver, or Copper moved meaningfully (>0.3%) OR metals headlines appeared. 3-5 sentences: (1) exact price and % move, (2) whether gold/silver move signals risk-off sentiment alongside geopolitical news, (3) copper as industrial demand indicator, (4) procurement relevance for packaging, electrical, construction buyers. EMPTY STRING if no data.",
      "fx": "ONLY if GBP/USD or GBP/EUR moved by at least 0.1% OR Bank of England/OBR news appeared. 3-5 sentences: (1) exact rates and % moves, (2) quantified import cost impact (e.g. '0.4% GBP/USD fall = ~0.4% rise in USD import costs'), (3) any BoE/OBR policy context driving the move, (4) hedging or forward cover implications. EMPTY STRING if FX flat and no policy news.",
      "policy": "ONLY if Bank of England, OBR, or fiscal policy news explicitly appeared. 3-5 sentences: (1) specific policy announcement or signal, (2) market reaction, (3) procurement/cost implication (interest rates, credit costs, broader economic outlook). EMPTY STRING if no policy news."
    },
    sector_news_digest: {
      "energy": ["[source name] headline text that drove this analysis", "second headline if applicable"],
      "agricultural": ["[source name] headline text"],
      "freight": [],
      "fertilizer": [],
      "metals": [],
      "fx": [],
      "policy": []
    },
    sector_forward_outlook: {
      "energy": "1-2 sentences on likely direction over next 2-5 days based on current trajectory, geopolitical risk, and seasonal patterns. Directional language required. EMPTY STRING if no data for this sector.",
      "agricultural": "1-2 sentences directional outlook. EMPTY STRING if no data.",
      "freight": "EMPTY STRING if no data.",
      "fertilizer": "EMPTY STRING if no data.",
      "metals": "EMPTY STRING if no data.",
      "fx": "EMPTY STRING if no data.",
      "policy": "EMPTY STRING if no data."
    }
  }));

  return lines.join("\n");
}

interface PriceSnapshotEntry {
  label: string;
  price: number;
  change_pct: number | null;
  currency: string;
}

function buildPriceSnapshot(feeds: FeedPayload): PriceSnapshotEntry[] {
  const snapshot: PriceSnapshotEntry[] = [];

  const KEY_SYMBOLS = ["BZ=F", "CL=F", "NG=F", "ZW=F", "ZC=F", "ZS=F", "GC=F", "SI=F", "HG=F", "GBPUSD=X", "GBPEUR=X", "EURUSD=X", "DX=F", "BDI"];

  const yahooPrices = feeds.sources.find(s => s.source_name === "Yahoo Finance" || s.source_name === "Stooq Market Data");
  if (yahooPrices?.quotes?.length) {
    for (const q of yahooPrices.quotes as Array<{ symbol: string; label: string; price: number | null; changePercent: number | null; currency: string | null }>) {
      if (!KEY_SYMBOLS.includes(q.symbol) || q.price == null) continue;
      snapshot.push({
        label: q.label,
        price: q.price,
        change_pct: q.changePercent ?? null,
        currency: q.currency ?? "USD",
      });
    }
  }

  const brentSrc = feeds.sources.find(s => s.source_name === "EIA Brent Crude") as Record<string, unknown> | undefined;
  if (brentSrc?.success && brentSrc.current_price) {
    snapshot.push({
      label: "Brent Crude (EIA spot)",
      price: brentSrc.current_price as number,
      change_pct: (brentSrc.change_pct as number) ?? null,
      currency: "USD",
    });
  }

  return snapshot;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    const db = createClient(supabaseUrl, serviceKey);

    const todayUtc = new Date().toISOString().slice(0, 10);

    const { data: existing, error: selectErr } = await db
      .from("daily_brief")
      .select("*")
      .eq("brief_date", todayUtc)
      .maybeSingle();

    if (selectErr) throw new Error(`DB select error: ${selectErr.message}`);

    if (existing) {
      return new Response(JSON.stringify({ cached: true, brief: existing as DailyBrief }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let feeds: FeedPayload | null = null;

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    if (body?.feeds) {
      feeds = body.feeds as FeedPayload;
    } else {
      const feedsUrl = `${supabaseUrl}/functions/v1/market-feeds`;
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const feedsRes = await fetch(feedsUrl, {
        headers: { Authorization: `Bearer ${anonKey}` },
      });
      if (!feedsRes.ok) throw new Error(`Failed to fetch market feeds: ${feedsRes.status}`);
      feeds = await feedsRes.json() as FeedPayload;
    }

    const { percentiles, seasonal, conflictBaselines } = await fetchHistoricalContext(db);

    if (!openaiKey) {
      const fallbackRow = {
        brief_date: todayUtc,
        generated_at: new Date().toISOString(),
        feed_snapshot_at: feeds?.fetched_at ?? null,
        narrative: "AI brief unavailable — OPENAI_API_KEY not configured. Market data has been fetched and signals are derived automatically.",
        three_things: [
          "Check price signals in the action list below",
          "Review conflict intelligence for supply chain risks",
          "Monitor GBP/USD for import cost implications"
        ],
        action_rationale: {},
        geopolitical_context: "",
        model: "none",
        prompt_tokens: null,
        completion_tokens: null,
      };
      const { data: savedFallback, error: fallbackErr } = await db
        .from("daily_brief")
        .upsert(fallbackRow, { onConflict: "brief_date" })
        .select()
        .maybeSingle();
      if (fallbackErr) throw new Error(`DB insert error: ${fallbackErr.message}`);
      return new Response(JSON.stringify({ cached: false, brief: savedFallback as DailyBrief }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = buildPrompt(feeds!, percentiles, seasonal, conflictBaselines);

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are a terse, expert procurement intelligence analyst. You have access to price data, news from 19 sources, historical percentile context, seasonal patterns, and conflict zone baselines. Cross-reference all sources to produce the most accurate intelligence possible. Return only valid JSON.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      throw new Error(`OpenAI error ${openaiRes.status}: ${errText}`);
    }

    const openaiData = await openaiRes.json();
    const usage = openaiData.usage ?? {};
    const rawContent = openaiData.choices?.[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      parsed = {};
    }

    const briefRow = {
      brief_date: todayUtc,
      generated_at: new Date().toISOString(),
      feed_snapshot_at: feeds?.fetched_at ?? null,
      narrative: (parsed.narrative as string) || "No narrative generated.",
      three_things: (parsed.three_things as string[]) || [],
      action_rationale: (parsed.action_rationale as Record<string, string>) || {},
      geopolitical_context: (parsed.geopolitical_context as string) || "",
      procurement_actions: (parsed.procurement_actions as string[]) || [],
      market_outlook: (parsed.market_outlook as string) || "",
      sector_news_digest: (parsed.sector_news_digest as Record<string, string[]>) || {},
      sector_forward_outlook: (parsed.sector_forward_outlook as Record<string, string>) || {},
      model: openaiData.model ?? "gpt-4o",
      prompt_tokens: usage.prompt_tokens ?? null,
      completion_tokens: usage.completion_tokens ?? null,
      price_snapshot: buildPriceSnapshot(feeds!),
    };

    const { data: inserted, error: insertErr } = await db
      .from("daily_brief")
      .upsert(briefRow, { onConflict: "brief_date" })
      .select()
      .maybeSingle();

    if (insertErr) throw new Error(`DB insert error: ${insertErr.message}`);

    return new Response(
      JSON.stringify({ cached: false, brief: inserted as DailyBrief }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
