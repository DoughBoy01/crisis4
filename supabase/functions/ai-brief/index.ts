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
    if (fxSrc.gbp_usd) prices.push(`GBP/USD: ${fxSrc.gbp_usd.toFixed(4)}`);
    if (fxSrc.gbp_eur) prices.push(`GBP/EUR: ${fxSrc.gbp_eur.toFixed(4)}`);
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
  lines.push("Return ONLY valid JSON with this exact structure:");
  lines.push(JSON.stringify({
    narrative: "2-4 sentence plain-English summary of what happened overnight. Lead with the biggest market move or geopolitical development. Reference historical percentile position if relevant. Reference whether conflict news represents escalation above baseline norms.",
    three_things: [
      "The single most important thing to know today (max 20 words)",
      "Second most important thing (max 20 words)",
      "Third most important thing (max 20 words)"
    ],
    geopolitical_context: "1-3 sentences on geopolitical developments affecting commodity supply chains. Reference specific conflict zones and whether activity is elevated above historical baselines. Only include if genuinely relevant.",
    action_rationale: {
      "energy": "What energy markets (Brent, WTI, Nat Gas, Heating Oil, Gasoline) did overnight and why it matters for procurement. Include historical percentile context if extreme.",
      "agricultural": "What grain/oilseed markets (Wheat, Corn, Soybeans, Rice) did overnight and why it matters. Note USDA/World Grain reports and seasonal demand pressure if active.",
      "freight": "What freight/shipping markets (BDI, container rates, tanker routes) did overnight and why it matters. Note any Red Sea/Hormuz disruption signals from Shipping and Freight RSS.",
      "fertilizer": "What fertilizer inputs (urea, DAP, ammonia, potash, nitrogen) did overnight and why it matters. Reference specific products from Fertilizer RSS if available. Note spring/autumn application season pressure.",
      "metals": "What metals markets (Gold, Silver, Copper) did overnight and what it signals. Gold/Silver rising = risk-off/inflation hedge. Copper falling = demand slowdown signal. Note LME/COMEX news from Metals RSS.",
      "fx": "What GBP moves mean for import costs today. Reference BoE/OBR policy signals if any monetary policy news emerged overnight.",
      "policy": "Any Bank of England, OBR, or fiscal policy developments overnight that affect procurement costs, inflation outlook, or GBP. Only include if genuinely relevant — omit if no policy news."
    }
  }));

  return lines.join("\n");
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
      model: openaiData.model ?? "gpt-4o",
      prompt_tokens: usage.prompt_tokens ?? null,
      completion_tokens: usage.completion_tokens ?? null,
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
