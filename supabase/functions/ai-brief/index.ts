import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type PersonaId = "general" | "trader" | "agri" | "logistics" | "analyst";

const ALL_PERSONAS: PersonaId[] = ["general", "trader", "agri", "logistics", "analyst"];

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
    currency?: string | null;
  }>;
}

interface FeedPayload {
  fetched_at: string;
  sources: FeedSource[];
  overall_accuracy_score: number;
  sources_ok: number;
  sources_total: number;
}

interface TopDecision {
  signal: "BUY" | "HOLD" | "ACT" | "WATCH";
  headline: string;
  deadline: string;
  market: string;
  gbp_impact: string;
  rationale: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

interface DailyBrief {
  id: string;
  brief_date: string;
  persona: string;
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
  compounding_risk: string;
  top_decision: TopDecision | null;
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

const PERSONA_CONFIG: Record<PersonaId, {
  label: string;
  role: string;
  primarySectors: string[];
  supportingSectors: string[];
  focusDescription: string;
  actionVerb: string;
  topDecisionMarkets: string;
}> = {
  general: {
    label: "Business Overview",
    role: "UK business owner or CFO reviewing morning procurement risks",
    primarySectors: ["energy", "fx"],
    supportingSectors: ["freight", "agricultural", "fertilizer", "metals", "policy"],
    focusDescription: "plain-English cost and supply impact for a UK business — what this means in pounds, not market jargon",
    actionVerb: "business cost",
    topDecisionMarkets: "energy (diesel/gas), FX (GBP/USD import costs), freight surcharges",
  },
  trader: {
    label: "Commodity Trader",
    role: "commodity trader at a UK food & agricultural business, reviewing before the 07:00 standup",
    primarySectors: ["energy", "fx", "metals"],
    supportingSectors: ["agricultural", "freight", "fertilizer", "policy"],
    focusDescription: "price signals, momentum, risk-off sentiment, and market timing — specific levels, not generalities",
    actionVerb: "trading",
    topDecisionMarkets: "energy futures, FX positions, metals (gold/copper), agricultural futures",
  },
  agri: {
    label: "Agri Buyer",
    role: "agricultural procurement buyer responsible for grain, fertilizer, and soft commodity purchasing",
    primarySectors: ["agricultural", "fertilizer"],
    supportingSectors: ["energy", "fx", "freight"],
    focusDescription: "grain input costs, fertilizer product moves (urea/DAP/ammonia/potash), Black Sea corridor risk, and planting economics",
    actionVerb: "procurement",
    topDecisionMarkets: "wheat (CBOT/LIFFE), corn, urea/DAP fertilizer, Black Sea freight",
  },
  logistics: {
    label: "Logistics Director",
    role: "logistics director managing freight, shipping, and fuel costs for a UK importer",
    primarySectors: ["freight", "energy"],
    supportingSectors: ["fx", "policy"],
    focusDescription: "shipping lane status (Red Sea/Suez/Cape Horn rerouting), BDI moves, bunker costs, and estimated landed cost impacts",
    actionVerb: "logistics",
    topDecisionMarkets: "bunker fuel (Brent proxy), freight contracts (BDI), Red Sea surcharges, rerouting decisions",
  },
  analyst: {
    label: "Risk Analyst",
    role: "risk analyst preparing client-ready intelligence reports covering all market sectors",
    primarySectors: ["energy", "agricultural", "freight", "fertilizer", "metals", "fx", "policy"],
    supportingSectors: [],
    focusDescription: "full cross-sector analysis with citable sources, historical percentile context, and scenario framing for client reporting",
    actionVerb: "risk",
    topDecisionMarkets: "the highest-conviction cross-sector signal (energy + FX + freight compounding, or single dominant move)",
  },
};

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

function magnitudeTier(absPct: number): string {
  if (absPct >= 3) return "SIGNIFICANT (>=3%) — lead with this";
  if (absPct >= 1.5) return "NOTABLE (1.5–3%) — include with context";
  if (absPct >= 0.5) return "MODERATE (0.5–1.5%) — include if relevant to persona";
  if (absPct >= 0.1) return "MINOR (0.1–0.5%) — mention only if combined with news";
  return "FLAT (<0.1%) — ignore unless news-driven";
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
  const symbolMap: Record<string, string> = {
    "BZ=F": "Brent Crude", "NG=F": "Natural Gas", "ZW=F": "Wheat",
    "ZC=F": "Corn", "ZS=F": "Soybeans", "GC=F": "Gold",
    "SI=F": "Silver", "HG=F": "Copper",
  };
  const yahooPrices = feeds.sources.find(s => s.source_name === "Yahoo Finance" || s.source_name === "Stooq Market Data");
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
  if (lines.length === 1) lines.push("No historical context data available.");
  return lines.join("\n");
}

function buildConflictBaselineSection(conflictBaselines: ConflictBaseline[], feeds: FeedPayload): string {
  if (conflictBaselines.length === 0) return "";
  const lines: string[] = ["=== CONFLICT ZONE BASELINES (Historical Risk Intelligence) ==="];
  lines.push("Compare current headlines against these baselines to assess ESCALATION vs normal risk.");
  lines.push("");
  for (const zone of conflictBaselines) {
    const impactStr = zone.historical_commodity_impact_pct != null
      ? ` | Historical commodity impact on escalation: +${zone.historical_commodity_impact_pct}%`
      : "";
    const thresholds: string[] = [];
    if (zone.elevated_threshold != null) thresholds.push(`elevated=${zone.elevated_threshold}`);
    if (zone.high_threshold != null) thresholds.push(`high=${zone.high_threshold}`);
    if (zone.critical_threshold != null) thresholds.push(`critical=${zone.critical_threshold}`);
    const threshStr = thresholds.length > 0 ? ` | Alert thresholds: ${thresholds.join(", ")} events/wk` : "";
    lines.push(`${zone.zone_name}: baseline ${zone.baseline_event_frequency} events/week${impactStr}${threshStr}`);
  }
  const conflictSources = ["Reuters World RSS", "Al Jazeera RSS", "ReliefWeb Conflict RSS"];
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
    lines.push("Current conflict headlines:");
    lines.push(conflictHeadlines.join("\n"));
  }
  return lines.join("\n");
}

const ALL_NEWS_SOURCES = [
  "BBC Business RSS", "Al Jazeera RSS", "Guardian Business RSS", "Farmers Weekly RSS",
  "AHDB RSS", "Reuters World RSS", "Reuters Commodities RSS", "ReliefWeb Conflict RSS",
  "Shipping RSS", "Freight Rates RSS", "MarketWatch RSS", "USDA RSS",
  "Financial Times RSS", "Rigzone RSS", "World Grain RSS", "Fertilizer RSS",
  "Metals RSS", "Bank of England RSS", "OBR RSS",
];

const SOURCE_CATEGORY: Record<string, string> = {
  "BBC Business RSS": "GENERAL", "Guardian Business RSS": "GENERAL", "MarketWatch RSS": "GENERAL",
  "Financial Times RSS": "ENERGY/COMMODITY", "Reuters Commodities RSS": "ENERGY/COMMODITY",
  "Rigzone RSS": "ENERGY", "Al Jazeera RSS": "GEOPOLITICAL",
  "Reuters World RSS": "GEOPOLITICAL", "ReliefWeb Conflict RSS": "GEOPOLITICAL",
  "Shipping RSS": "FREIGHT", "Freight Rates RSS": "FREIGHT",
  "AHDB RSS": "AGRICULTURAL", "Farmers Weekly RSS": "AGRICULTURAL",
  "USDA RSS": "AGRICULTURAL", "World Grain RSS": "AGRICULTURAL",
  "Fertilizer RSS": "FERTILIZER", "Metals RSS": "METALS",
  "Bank of England RSS": "POLICY", "OBR RSS": "POLICY",
};

function buildNewsSection(feeds: FeedPayload): string {
  const byCategory: Record<string, Array<{ headline: string; summary: string }>> = {};
  for (const src of feeds.sources) {
    if (!ALL_NEWS_SOURCES.includes(src.source_name)) continue;
    if (!src.success || !src.items?.length) continue;
    const category = SOURCE_CATEGORY[src.source_name] ?? "GENERAL";
    if (!byCategory[category]) byCategory[category] = [];
    for (const item of src.items.slice(0, 5)) {
      const summary = item.summary ? ` — ${item.summary.slice(0, 180)}` : "";
      byCategory[category].push({
        headline: `[${src.source_name}] ${item.title}`,
        summary,
      });
    }
  }
  const lines: string[] = ["=== NEWS & INTELLIGENCE BY CATEGORY (22:00–07:00 GMT WINDOW) ==="];
  const categoryOrder = ["GEOPOLITICAL", "ENERGY", "ENERGY/COMMODITY", "FREIGHT", "AGRICULTURAL", "FERTILIZER", "METALS", "POLICY", "GENERAL"];
  for (const cat of categoryOrder) {
    const items = byCategory[cat];
    if (items && items.length > 0) {
      lines.push(`\n--- ${cat} ---`);
      for (const item of items) {
        lines.push(item.headline);
        if (item.summary) lines.push(`  ${item.summary}`);
      }
    }
  }
  if (lines.length === 1) lines.push("No news available.");
  return lines.join("\n");
}

const DATA_WARNINGS: string[] = [];

function isSuspiciousPrice(symbol: string, price: number): boolean {
  const ranges: Record<string, [number, number]> = {
    "BZ=F": [20, 200], "CL=F": [15, 200], "NG=F": [0.5, 30],
    "ZW=F": [200, 2000], "ZC=F": [150, 1500], "ZS=F": [500, 3000],
    "GC=F": [500, 5000], "SI=F": [5, 200], "HG=F": [100, 800],
    "GBPUSD=X": [0.8, 2.0], "GBPEUR=X": [0.8, 1.6], "EURUSD=X": [0.7, 1.8],
    "DX=F": [70, 130],
  };
  const range = ranges[symbol];
  if (!range) return false;
  return price < range[0] || price > range[1];
}

function buildPriceMovesSection(feeds: FeedPayload): string {
  DATA_WARNINGS.length = 0;
  const prices: string[] = [];
  const warnings: string[] = [];

  const yahooPrices = feeds.sources.find(s => s.source_name === "Yahoo Finance" || s.source_name === "Stooq Market Data");
  if (yahooPrices?.quotes?.length) {
    for (const q of yahooPrices.quotes) {
      if (q.price == null) continue;
      if (isSuspiciousPrice(q.symbol, q.price)) {
        warnings.push(`⚠ DATA QUALITY WARNING: ${q.label} (${q.symbol}) = ${q.price} — this value appears outside the normal range and may be a data error. Do NOT use this number in your analysis. State that this data point is unavailable.`);
        DATA_WARNINGS.push(`${q.label} price suspect (${q.price})`);
        continue;
      }
      if (q.changePercent != null) {
        const dir = q.changePercent >= 0 ? "+" : "";
        const tier = magnitudeTier(Math.abs(q.changePercent));
        prices.push(`${q.label}: ${q.price.toFixed(2)} (${dir}${q.changePercent.toFixed(2)}%) [${tier}]`);
      } else {
        prices.push(`${q.label}: ${q.price.toFixed(2)} (no overnight change data)`);
      }
    }
  }

  const brentSrc = feeds.sources.find(s => s.source_name === "EIA Brent Crude");
  if (brentSrc?.success && brentSrc.current_price) {
    const cp = brentSrc.current_price as number;
    if (cp < 20 || cp > 200) {
      warnings.push(`⚠ DATA QUALITY WARNING: EIA Brent Crude = $${cp}/bbl — this value is outside the plausible range ($20-$200). This is likely a data error. Do NOT use this EIA Brent figure. Use the Stooq BZ=F price if available, or state that Brent spot data is unavailable.`);
      DATA_WARNINGS.push(`EIA Brent suspect ($${cp})`);
    } else {
      const pct = brentSrc.change_pct != null ? brentSrc.change_pct as number : 0;
      const dir = pct >= 0 ? "+" : "";
      const tier = magnitudeTier(Math.abs(pct));
      prices.push(`Brent Crude (EIA spot): $${cp.toFixed(2)}/bbl (${dir}${pct.toFixed(2)}%) [${tier}]`);
    }
  }

  const fxSrc = feeds.sources.find(s => s.source_name === "ExchangeRate.host FX");
  const yahooGbpUsd = yahooPrices?.quotes?.find(q => q.symbol === "GBPUSD=X");
  const yahooGbpEur = yahooPrices?.quotes?.find(q => q.symbol === "GBPEUR=X");
  if (fxSrc?.success) {
    if (fxSrc.gbp_usd && !yahooGbpUsd?.price) {
      const gbpUsd = fxSrc.gbp_usd as number;
      if (gbpUsd > 0.8 && gbpUsd < 2.0) {
        prices.push(`GBP/USD (daily spot): ${gbpUsd.toFixed(4)} — no overnight change data from this source`);
      }
    }
    if (fxSrc.gbp_eur && !yahooGbpEur?.price) {
      const gbpEur = fxSrc.gbp_eur as number;
      if (gbpEur > 0.8 && gbpEur < 1.6) {
        prices.push(`GBP/EUR (daily spot): ${gbpEur.toFixed(4)} — no overnight change data from this source`);
      }
    }
  }

  const result: string[] = [];
  if (warnings.length > 0) {
    result.push("=== DATA QUALITY ALERTS — READ BEFORE USING PRICES ===");
    result.push(...warnings);
    result.push("");
  }
  result.push(...prices);
  return result.length ? result.join("\n") : "No price data available.";
}

interface ScoutTopicIntelligence {
  topic_id: string;
  topic_label: string;
  category: string;
  findings: string[];
  sources: { title: string; url: string }[];
  summary: string;
  signal: string;
}

interface ScoutPayload {
  intelligence?: ScoutTopicIntelligence[];
  skipped?: boolean;
}

function buildScoutSection(scout: ScoutPayload | null, persona: PersonaId): string {
  if (!scout?.intelligence?.length) return "";
  const cfg = PERSONA_CONFIG[persona];
  const relevantCategories = [...cfg.primarySectors, ...cfg.supportingSectors];

  const relevant = scout.intelligence.filter(t =>
    relevantCategories.includes(t.category) || t.category === "geopolitical" || t.category === "policy"
  );
  if (!relevant.length) return "";

  const lines: string[] = ["=== SCOUTING INTELLIGENCE (OpenAI Web Search — Last 24h) ==="];
  lines.push("The following intelligence was gathered by an automated scout agent searching the live web before market open.");
  lines.push("Use this to supplement and cross-reference the RSS news below. Prioritise findings with named sources and specific figures.");
  lines.push("");

  for (const topic of relevant) {
    lines.push(`--- ${topic.topic_label.toUpperCase()} [${topic.signal}] ---`);
    lines.push(`Summary: ${topic.summary}`);
    if (topic.findings.length > 0) {
      lines.push("Findings:");
      for (const f of topic.findings) {
        lines.push(`  • ${f}`);
      }
    }
    if (topic.sources.length > 0) {
      lines.push("Sources:");
      for (const s of topic.sources.slice(0, 3)) {
        lines.push(`  [${s.title}] ${s.url}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

function buildPersonaPrompt(
  persona: PersonaId,
  feeds: FeedPayload,
  percentiles: CommodityPercentile[],
  seasonal: SeasonalPattern[],
  conflictBaselines: ConflictBaseline[],
  scout: ScoutPayload | null,
): string {
  const cfg = PERSONA_CONFIG[persona];
  const lines: string[] = [];

  const historicalContextSection = buildHistoricalContextSection(feeds, percentiles, seasonal);
  const conflictBaselineSection = buildConflictBaselineSection(conflictBaselines, feeds);
  const newsSection = buildNewsSection(feeds);
  const priceMovesSection = buildPriceMovesSection(feeds);
  const scoutSection = buildScoutSection(scout, persona);

  const nowUtc = new Date();
  const dayOfWeek = nowUtc.toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
  const isWeekend = nowUtc.getUTCDay() === 0 || nowUtc.getUTCDay() === 6;
  const dateLabel = nowUtc.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const monthName = nowUtc.toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });

  lines.push("=== WHO YOU ARE ===");
  lines.push(`You are a senior procurement intelligence analyst at a UK specialist advisory firm. You've been doing this for 15 years. You write a personalised morning brief every day at 07:00 GMT for a specific client.`);
  lines.push(`Today's reader: ${cfg.role}.`);
  lines.push(`Today is ${dateLabel}.`);
  lines.push("");
  lines.push("=== YOUR WRITING VOICE ===");
  lines.push("You write like a trusted, highly intelligent colleague — not a compliance document.");
  lines.push("You are direct, warm, occasionally dry. You use real sentences, not bullet-point fragments.");
  lines.push("You never pad. You never write 'no significant movements were reported overnight' — that's a cop-out.");
  lines.push("Instead, when prices are flat, you explain WHAT that flat price means in context: is it expensive by historical standards? Is it deceptively calm before a known catalyst? Are we in a seasonal pressure window?");
  lines.push("You always have something worth saying. A good analyst never leaves a section blank just because a price didn't move.");
  lines.push("You write in complete, flowing sentences. You name things. You cite numbers. You connect dots.");
  lines.push("");
  lines.push("=== LATERAL INTELLIGENCE: USE ALL THE NEWS ===");
  lines.push("Do not discard a headline just because it seems tangential. Ask: what does this mean for supply chains, energy demand, or risk sentiment?");
  lines.push("Examples of lateral thinking you should apply:");
  lines.push("- F1 races cancelled in Bahrain/Saudi Arabia due to Iran conflict → means commercial aviation and Gulf fuel hubs are affected → freight surcharge risk and jet fuel/kerosene supply tightening → relevant to energy costs");
  lines.push("- Pakistani military action in Afghanistan → affects road freight corridors from Central Asia → relevant to supply chain diversification for agri buyers sourcing from that region");
  lines.push("- A drought in the US Midwest → relevant not just to corn/soy but to river freight (Mississippi barge costs), and therefore to UK grain import landed costs");
  lines.push("- Central bank minutes published → affects GBP trajectory → directly affects all USD-denominated imports");
  lines.push("The test is: can you make a credible, non-speculative link from this headline to something that costs this reader money or changes their risk profile? If yes, include it.");
  lines.push("");
  lines.push("=== READER FOCUS ===");
  lines.push(`This reader cares most about: ${cfg.focusDescription}.`);
  lines.push(`Primary sectors to cover with full depth: ${cfg.primarySectors.join(", ")}.`);
  if (cfg.supportingSectors.length > 0) {
    lines.push(`Supporting sectors — include only where you can make a direct, specific link to this reader's costs or decisions: ${cfg.supportingSectors.join(", ")}.`);
  }
  lines.push("");

  if (isWeekend) {
    lines.push(`=== WEEKEND BRIEF (${dayOfWeek.toUpperCase()}) ===`);
    lines.push(`Futures markets are closed or thin. The last meaningful prices are Friday's close.`);
    lines.push(`This brief is about POSITIONING: what does the week's data tell us about where we stand, and what should this reader be ready to act on when London opens Monday?`);
    lines.push(`Do not say "no movements" because it's the weekend. Instead: summarise the week's net moves, flag what news broke over the weekend, and give a clear forward view for Monday.`);
    lines.push("");
  }

  lines.push("=== PERSONA-SPECIFIC LENS ===");

  if (persona === "general") {
    lines.push("Your reader is a non-finance business owner or CFO. They are intelligent but not a trader.");
    lines.push("Translate everything into plain business language. If you say 'Brent', explain it's the global oil benchmark that underpins diesel prices. If you say 'GBP/USD fell', say what that means in practice — 'your dollar-priced goods just got more expensive overnight'.");
    lines.push("The best sentence you can write for this reader: 'If you're buying X this week, it'll cost you roughly Y more than last Monday.' Give them that clarity.");
    lines.push("Don't lecture. Don't over-explain. They're busy. Tell them what matters, why it matters, and what to do.");
    lines.push("Geopolitical and macro news should be connected to operating costs — 'the Iran situation is now disrupting Gulf aviation routes, which tightens jet fuel supply and keeps energy costs elevated this week.'");
  } else if (persona === "trader") {
    lines.push("Your reader lives in a terminal and talks in basis points. Don't waste their time with context they already know.");
    lines.push("Lead with the biggest price move, absolute level, and whether it's technically significant (near resistance/support, multi-month high/low, etc.).");
    lines.push("Gold/silver rising with conflict headlines = risk-off signal. Be explicit about that. Don't just report the price.");
    lines.push("Copper falling = industrial demand concern, not a metals rally. Call it.");
    lines.push("FX: state exact basis points, not just percentage. Quantify the USD import cost impact explicitly.");
    lines.push("Tone: terse, precise. Like a Bloomberg terminal update written by a human.");
  } else if (persona === "agri") {
    lines.push("Your reader buys grain, fertilizer, and soft commodities for a UK food business.");
    lines.push("Lead with wheat (CBOT/LIFFE), then corn, then soybeans. Always state the seasonal context: is it planting, growing, or pre-harvest pressure? ${monthName} is a specific point in the crop calendar — say what that means.");
    lines.push("For fertilizer: name the products. Urea, DAP, ammonia, potash. Don't generalise. If natural gas moves, connect it to urea and ammonia feedstock costs explicitly.");
    lines.push("For Black Sea: you know the history. Any conflict escalation near Ukraine or Russia = corridor disruption risk. Compare against the baseline you've been given.");
    lines.push("Quantify whenever possible: 'a £X/tonne input cost change on a 1,000 tonne forward position'.");
  } else if (persona === "logistics") {
    lines.push("Your reader manages freight contracts, shipping lanes, and fuel costs for a UK importer.");
    lines.push("Lead with freight: BDI level and direction, Red Sea/Suez corridor status, any rerouting signals.");
    lines.push("For energy: Brent is bunker fuel. Quantify it as cost-per-shipping-day for a mid-size container vessel.");
    lines.push("Name each corridor: Red Sea, Cape of Good Hope, Suez, Panama, English Channel. State what's open, what's disrupted, what's elevated-risk.");
    lines.push("If Cape Horn rerouting is in effect, state the voyage time addition (+10-14 days) and the freight cost uplift (+20-30%). That's what your reader needs to put in front of their board.");
    lines.push("FX matters here because freight contracts are USD-denominated. A GBP move of >0.3% is worth calling out.");
  } else if (persona === "analyst") {
    lines.push("Your reader writes client intelligence reports. Everything you write must be citable.");
    lines.push("Use precision: '73rd percentile vs 10-year history' not 'elevated'. Name the source. Name the date.");
    lines.push("Cover every sector that has data. The compounding_risk field is your most important section — identify where two or more adverse moves are multiplying, not just adding.");
    lines.push("Procurement_actions should be structured as risk-management recommendations with probability weighting where possible.");
    lines.push("This reader is the most sophisticated in the system. Give them the full picture.");
  }

  lines.push("");
  lines.push("=== HOW TO HANDLE FLAT OR QUIET SESSIONS ===");
  lines.push("A flat price move is not a reason to leave a section empty. Here's what to write instead:");
  lines.push(`- Energy flat: 'Brent is holding at $X/bbl, sitting at the Nth percentile vs 10-year history. That's ${persona === "general" ? "still historically elevated — your diesel costs are structurally higher than they were three years ago" : "mid-range historically, but the Iran situation creates a clear upside risk catalyst this week"}.'`);
  lines.push("- Freight flat: Explain the current BDI level in historical context. Note what's driving it being flat — seasonal lull, Red Sea bypass stabilising, etc.");
  lines.push("- FX flat: Note the current GBP/USD level and what it means for import budgets at the current level, not just the overnight change.");
  lines.push("- Metals flat: Connect to industrial demand outlook or risk-off context even without a price move.");
  lines.push("The section should only be empty if there is genuinely zero price data AND zero relevant headlines for that sector.");
  lines.push("");

  lines.push("=== SIGNAL INTELLIGENCE ===");
  lines.push("Magnitude tiers: [SIGNIFICANT ≥3%] [NOTABLE 1.5-3%] [MODERATE 0.5-1.5%] [MINOR 0.1-0.5%] [FLAT <0.1%]");
  lines.push("Use these to prioritise depth, but do not let FLAT stop you from writing substantive context.");
  lines.push("Cross-reference signals:");
  lines.push("- Brent SIGNIFICANT + GBP weak + freight elevated = compounding landed cost pressure → call it out in compounding_risk");
  lines.push("- Gold rising WITH conflict headlines = risk-off flight to safety, not commodity demand");
  lines.push("- Copper falling = industrial demand concern");
  lines.push("- Wheat move amplified if: near 10-yr high + HIGH seasonal demand month + Black Sea headlines present");
  lines.push("- FX rule: GBP/USD -0.4% = approximately +0.4% on all USD-denominated commodity imports");
  lines.push("- BoE/OBR news drives GBP and rate expectations — connect to import cost trajectory");
  lines.push("- FLAT price + active conflict news = supply disruption not yet priced in. That IS the signal.");
  lines.push("");

  lines.push(`=== PRICE DATA (day-over-day: prev close → latest close) ===`);
  lines.push(priceMovesSection);
  lines.push("");
  lines.push(historicalContextSection);
  lines.push("");
  if (conflictBaselineSection) {
    lines.push(conflictBaselineSection);
    lines.push("");
  }
  lines.push(newsSection);
  lines.push("");
  if (scoutSection) {
    lines.push(scoutSection);
    lines.push("");
  }

  lines.push("=== OUTPUT STANDARDS — NON-NEGOTIABLE ===");
  lines.push("Every number you cite must come from the PRICE DATA section above. Do not invent or estimate prices.");
  lines.push("Every news reference must come from the NEWS & INTELLIGENCE section above. Do not invent events, headlines, or sources.");
  lines.push("Every £ estimate must use realistic reference volumes for this reader's role.");
  lines.push("Do NOT invent scheduled data releases (PMI, CPI, BoE decisions, USDA reports, etc.) unless they appear in the feeds above. No economic calendar guessing.");
  lines.push("If a price appears in DATA QUALITY ALERTS above, treat it as unavailable. Do not use it. Acknowledge the data gap instead.");
  lines.push("Write in complete, confident sentences. No bullet-point fragments in narrative fields.");
  lines.push("The reader should feel like a smart colleague just briefed them over coffee — not like they read a compliance report.");
  lines.push("");

  lines.push("=== top_decision: THE SINGLE MOST IMPORTANT OUTPUT ===");
  lines.push("This appears in large type at the top of the email. It is the first and most important thing the reader sees.");
  lines.push("It must be: specific, time-bound, expressed in £ terms, and immediately actionable.");
  lines.push(`Markets relevant to this reader: ${cfg.topDecisionMarkets}`);
  lines.push("");
  lines.push("signal choices:");
  lines.push("  BUY = act now to lock in a price before it rises further");
  lines.push("  ACT = take a defensive or risk-management action urgently (hedge, diversify, escalate)");
  lines.push("  WATCH = don't act yet, but have a decision ready — a catalyst is imminent");
  lines.push("  HOLD = genuinely nothing to do; markets flat, no escalation, no catalyst");
  lines.push("");
  lines.push("headline: max 12 words, imperative, specific. Examples:");
  lines.push(`  'GBP down 1% — lock in USD contracts before London open'`);
  lines.push(`  'Brent rising on Iran risk — review diesel forward cover now'`);
  lines.push(`  'Wheat at seasonal high — pause spot buys, review forward book'`);
  lines.push("deadline: specific. 'before 09:30 UK', 'before London close', 'within 48 hours', 'this week before Friday close'");
  lines.push(`gbp_impact: a real number. E.g.: 'Est. +£8,400 on a 50,000L diesel order', '~£14/tonne input cost rise on 1,000t wheat', '~0.95% uplift on all USD-denominated imports this week'`);
  lines.push("rationale: 1-2 sentences using the actual price data and/or headline that makes this the right call");
  lines.push("confidence: HIGH (multiple confirming signals), MEDIUM (one clear signal), LOW (watch only)");
  lines.push("");
  lines.push("Only use HOLD if: ALL relevant price moves <0.3%, no conflict escalation, no supply chain news, no upcoming catalysts.");
  lines.push("");

  lines.push("=== action_rationale: SECTOR ANALYSIS ===");
  lines.push(`Primary sectors — write substantively even if the price is flat. Use historical context, seasonal context, and news intelligence to fill these sections: ${cfg.primarySectors.join(", ")}`);
  lines.push("Structure: (1) price level and overnight move, (2) historical/seasonal context, (3) specific cost or operational impact for this reader, (4) forward risk or opportunity.");
  if (cfg.supportingSectors.length > 0) {
    lines.push(`Supporting sectors — include only where there is a direct, non-speculative link to this reader's costs or decisions: ${cfg.supportingSectors.join(", ")}`);
  }
  lines.push("Only use empty string if there is genuinely no price data AND no relevant news headline for that sector.");
  lines.push("");
  lines.push("=== compounding_risk ===");
  lines.push("Only write this if 2+ sectors are simultaneously adverse AND their effects multiply (not just add) for this reader.");
  lines.push(`Example: 'Brent +2.1%, GBP/USD -0.95%, BDI +1.4% — your energy, FX, and freight costs are all moving against you simultaneously. Estimated combined landed cost increase of 3-4% this week on USD-priced commodity imports.'`);
  lines.push("Empty string if only one sector is adverse or there is no meaningful interaction.");
  lines.push("");
  lines.push("=== three_things ===");
  lines.push(`Pick the 3 most important items FOR THIS SPECIFIC READER — not the globally biggest moves. Include lateral intelligence where it connects.`);
  lines.push("Each item: 2-3 complete sentences. Lead with the data point or event, then explain the specific implication for this reader.");
  lines.push("Example of good three_things item: 'GBP/USD fell 0.95% overnight to [price], its largest single-session drop in three weeks. For any business buying USD-priced goods — commodities, shipping, machinery — that's an immediate +0.95% cost increase before the day even starts. With the pound at [level] it is still above its 2023 lows, but watch the BoE rate decision this week for further direction.'");
  lines.push("");
  lines.push("=== procurement_actions ===");
  lines.push(`2-4 specific, named actions for this reader. Each must reference a specific market, price level, or event.`);
  lines.push("Good example: 'GBP/USD fell 0.95% overnight — if you have USD-denominated contracts to fix this week, do it before the London open at 08:00. The next material downside catalyst is the BoE rate decision on Thursday.'");
  lines.push("Bad example: 'Monitor FX closely.' — too vague, no specific instruction.");
  lines.push("Empty array only if markets are genuinely flat across all sectors and no action is required.");
  lines.push("");
  lines.push("=== market_outlook ===");
  lines.push("2-3 sentences on what this reader should monitor between 07:00 and 17:00 GMT today.");
  lines.push("STRICT RULE: Only reference a scheduled data release (PMI, CPI, BoE decision, USDA report, etc.) if it appears in the news headlines above. Do NOT invent or assume economic calendar events. If no scheduled releases appear in the feeds, focus on price levels, geopolitical triggers, or momentum signals to watch instead.");
  lines.push("Good example using only price signals: 'Brent is testing the $X resistance level — a break above would extend diesel cost exposure. Watch the GBP/USD response at the London open; any move below [level] would compound import costs further.'");
  lines.push("Good example if a real event is in the feeds: 'The [specific event from headlines] is the key watch today — [implication]. Alongside this, Brent at $X/bbl means any further escalation in Gulf tensions would push diesel costs above [threshold].'");
  lines.push("");
  lines.push("=== sector_news_digest ===");
  lines.push("For each sector with content, list 1-3 of the specific headlines from the feeds above that drove your analysis.");
  lines.push("Format: '[Source Name] Headline text'");
  lines.push("Do not invent headlines. Only use headlines present in the news section above.");
  lines.push("");
  lines.push("=== sector_forward_outlook ===");
  lines.push("For primary sectors: 1-2 directional sentences for the next 2-5 days.");
  lines.push("Be specific: 'likely to remain above $X unless...' or 'watch for a pullback if...'");
  lines.push("Empty string for sectors with no data.");
  lines.push("");

  if (persona === "agri" || persona === "logistics" || persona === "analyst") {
    lines.push("=== shipping_lane_snapshot: 5 LANES TO ASSESS ===");
    lines.push("Derive RAG status from the conflict and shipping headlines above. Use all available signals.");
    lines.push("  RED = Active disruption confirmed by a headline or conflict zone at CRITICAL/HIGH risk level");
    lines.push("  AMBER = Elevated risk present, monitor closely — any conflict proximity, routing change signal, or war-risk premium");
    lines.push("  GREEN = No active disruption signals overnight");
    lines.push("Lanes:");
    lines.push("  1. Red Sea / Suez — Bab-el-Mandeb · Suez Canal — keywords: Houthi, Red Sea, Suez, diversion, Cape of Good Hope");
    lines.push("  2. Strait of Hormuz — Persian Gulf · Iran — keywords: Iran, Hormuz, tanker seizure, Persian Gulf, Brent spike");
    lines.push("  3. Black Sea / Odessa — Ukraine · Grain Corridor — keywords: Ukraine, Black Sea, grain corridor, Odessa, port");
    lines.push("  4. Panama Canal — Central America — keywords: Panama, canal, water level, drought, capacity");
    lines.push("  5. English Channel / Dover — UK-EU · North Sea — keywords: Dover, Calais, channel, port strike, North Sea");
    lines.push("freightImpact: specific string, e.g. '+10-14 days transit · +20-30% freight cost' or 'Standard war-risk premiums apply'");
    lines.push("latestSignal: the most relevant overnight headline for this lane, or 'No disruption signals overnight'");
    lines.push("impact: one sentence on what this status means for cargo or routing decisions");
    lines.push("");
  }

  if (persona === "agri" || persona === "analyst") {
    lines.push("=== fertilizer_detail: 4 PRODUCTS ===");
    lines.push("Always include all 4 products. Derive from the feeds above. If no specific product headline, use base rates + natural gas price + geopolitical context to derive a signal.");
    lines.push("  1. Urea — nitrogen source. Russia/Middle East/China supply. Feedstock: natural gas.");
    lines.push("  2. DAP/MAP — phosphate. Morocco/Russia/China supply. Geopolitically sensitive.");
    lines.push("  3. Ammonia — anhydrous/liquid. Nitrate feedstock. Directly tracks natural gas price.");
    lines.push("  4. Potash (MOP/SOP) — Belarus/Russia/Canada. Long-cycle, sanctions sensitive.");
    lines.push("direction: UP (rising price/risk), DOWN (falling), STABLE (no clear signal)");
    lines.push("priceSignal: 1-2 sentences on current level, any move, and direct cause — name the feedstock or supply driver");
    lines.push("supplyRisk: 1 sentence — name the specific risk or state 'Low — no active disruption signals'");
    lines.push("actionNote: 1 concrete instruction — timing, product, and reason");
    lines.push("");
  }

  const shippingLaneExample = (persona === "agri" || persona === "logistics" || persona === "analyst") ? `
    shipping_lane_snapshot: [
      { lane: "Red Sea / Suez", region: "Bab-el-Mandeb · Suez Canal", status: "RED | AMBER | GREEN", statusLabel: "ACTIVE DISRUPTION | ELEVATED RISK | NORMAL OPERATIONS", impact: "one sentence on route/cargo impact", freightImpact: "specific cost/time string", latestSignal: "headline or 'No disruption signals overnight'" },
      { lane: "Strait of Hormuz", region: "Persian Gulf · Iran", status: "RED | AMBER | GREEN", statusLabel: "HIGH TENSION | MONITORED | OPEN", impact: "one sentence", freightImpact: "specific string", latestSignal: "headline or 'No disruption signals overnight'" },
      { lane: "Black Sea / Odessa", region: "Ukraine · Grain Corridor", status: "RED | AMBER | GREEN", statusLabel: "DISRUPTED | CONSTRAINED | OPERATING", impact: "one sentence", freightImpact: "specific string", latestSignal: "headline or 'No disruption signals overnight'" },
      { lane: "Panama Canal", region: "Central America", status: "AMBER | GREEN", statusLabel: "CAPACITY CONSTRAINED | NORMAL", impact: "one sentence", freightImpact: "specific string", latestSignal: "headline or 'No disruption signals overnight'" },
      { lane: "English Channel / Dover", region: "UK-EU · North Sea", status: "AMBER | GREEN", statusLabel: "DISRUPTION SIGNAL | CLEAR", impact: "one sentence", freightImpact: "specific string", latestSignal: "headline or 'No disruption signals overnight'" }
    ],` : "";

  const fertilizerExample = (persona === "agri" || persona === "analyst") ? `
    fertilizer_detail: [
      { product: "Urea", direction: "UP | DOWN | STABLE", priceSignal: "1-2 sentences on price/cause", supplyRisk: "1 sentence", actionNote: "1 concrete instruction" },
      { product: "DAP/MAP", direction: "UP | DOWN | STABLE", priceSignal: "1-2 sentences", supplyRisk: "1 sentence", actionNote: "1 concrete instruction" },
      { product: "Ammonia", direction: "UP | DOWN | STABLE", priceSignal: "1-2 sentences", supplyRisk: "1 sentence", actionNote: "1 concrete instruction" },
      { product: "Potash (MOP/SOP)", direction: "UP | DOWN | STABLE", priceSignal: "1-2 sentences", supplyRisk: "1 sentence", actionNote: "1 concrete instruction" }
    ],` : "";

  lines.push("Return ONLY valid JSON:");
  lines.push(JSON.stringify({
    top_decision: {
      signal: "BUY | HOLD | ACT | WATCH",
      headline: `Max 12 words. Imperative. Specific to a ${cfg.label}.`,
      deadline: "Specific time constraint e.g. 'before 09:30 UK' or 'within 24 hours'",
      market: `The specific instrument relevant to a ${cfg.label}`,
      gbp_impact: `Quantified £ exposure using realistic volumes for a ${cfg.label}`,
      rationale: `1-2 sentences citing specific price data and/or headline that drives this decision for a ${cfg.label}`,
      confidence: "HIGH | MEDIUM | LOW",
    },
    narrative: `3-5 flowing sentences written for a ${cfg.label}. Lead with the most important overnight development for this reader. Weave in exact prices, % changes, and named sources. Connect lateral intelligence (geopolitical, macro) to specific cost implications. End with the net ${cfg.actionVerb} position for today — what should they be thinking about when they sit down this morning?`,
    three_things: [
      `Most important thing for a ${cfg.label} today. Lead with the specific data point or event, then connect it directly to their cost or decision context. 2-3 complete sentences.`,
      `Second most important. Same format. Can include lateral intelligence if it connects to costs.`,
      `Third most important. Can be a forward-looking warning, a seasonal context note, or an emerging risk.`
    ],
    compounding_risk: `Only if 2+ sectors are simultaneously adverse for a ${cfg.label} and their effects multiply. Name the sectors, the moves, and estimate the combined cost impact. Empty string otherwise.`,
    geopolitical_context: `2-4 sentences on named conflicts or macro events. Connect each event to a specific supply chain, commodity, or cost implication for this reader. State how it compares to the conflict zone baseline. Empty string only if genuinely no geopolitical headlines present.`,
    procurement_actions: [
      `Specific, named action for a ${cfg.label} — market, price level, timing, reason`,
      `Second action`
    ],
    market_outlook: `2-3 sentences on what a ${cfg.label} should watch between 07:00 and 17:00 GMT. Name specific events, data releases, or price levels. What is the trigger point that would change the picture?`,
    action_rationale: {
      "energy": `Full analysis for primary personas (${cfg.primarySectors.includes("energy") ? "THIS IS PRIMARY — write 3-5 substantive sentences even if price is flat" : "include only if directly relevant"}). Empty string only if zero price data and zero news.`,
      "agricultural": `Full analysis for primary personas (${cfg.primarySectors.includes("agricultural") ? "THIS IS PRIMARY — write 3-5 substantive sentences even if price is flat" : "include only if directly relevant"}). Empty string only if zero data.`,
      "freight": `Full analysis for primary personas (${cfg.primarySectors.includes("freight") ? "THIS IS PRIMARY — write 3-5 substantive sentences even if price is flat" : "include only if directly relevant"}). Empty string only if zero data.`,
      "fertilizer": `Full analysis for primary personas (${cfg.primarySectors.includes("fertilizer") ? "THIS IS PRIMARY — write 3-5 substantive sentences even if price is flat" : "include only if directly relevant"}). Empty string only if zero data.`,
      "metals": `Full analysis for primary personas (${cfg.primarySectors.includes("metals") ? "THIS IS PRIMARY — write 3-5 substantive sentences even if price is flat" : "include only if directly relevant"}). Empty string only if zero data.`,
      "fx": `Full analysis for primary personas (${cfg.primarySectors.includes("fx") ? "THIS IS PRIMARY — write 3-5 substantive sentences even if price is flat" : "include only if directly relevant"}). Empty string only if zero data.`,
      "policy": `Full analysis for analyst persona only. Include for others only if BoE/OBR news directly affects their sector. Empty string otherwise.`
    },
    sector_news_digest: {
      "energy": ["[Source] headline from feeds above that drove your energy analysis"],
      "agricultural": [],
      "freight": [],
      "fertilizer": [],
      "metals": [],
      "fx": [],
      "policy": []
    },
    sector_forward_outlook: {
      "energy": `Directional 1-2 sentences for the next 2-5 days. Name a price level or trigger. Empty string if not primary for this persona.`,
      "agricultural": "Empty string if not primary for this persona.",
      "freight": "Empty string if not primary for this persona.",
      "fertilizer": "Empty string if not primary for this persona.",
      "metals": "Empty string if not primary for this persona.",
      "fx": "Empty string if not primary for this persona.",
      "policy": "Empty string if not primary for this persona."
    }
  }).replace("}", `${shippingLaneExample}${fertilizerExample}}`));

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
      snapshot.push({ label: q.label, price: q.price, change_pct: q.changePercent ?? null, currency: q.currency ?? "USD" });
    }
  }
  const brentSrc = feeds.sources.find(s => s.source_name === "EIA Brent Crude") as Record<string, unknown> | undefined;
  if (brentSrc?.success && brentSrc.current_price) {
    snapshot.push({ label: "Brent Crude (EIA spot)", price: brentSrc.current_price as number, change_pct: (brentSrc.change_pct as number) ?? null, currency: "USD" });
  }
  return snapshot;
}

async function generateBriefForPersona(
  persona: PersonaId,
  feeds: FeedPayload,
  percentiles: CommodityPercentile[],
  seasonal: SeasonalPattern[],
  conflictBaselines: ConflictBaseline[],
  openaiKey: string,
  db: ReturnType<typeof createClient>,
  todayUtc: string,
  force: boolean,
  scout: ScoutPayload | null,
): Promise<{ brief: DailyBrief; cached: boolean }> {
  const { data: existing, error: selectErr } = await db
    .from("daily_brief")
    .select("*")
    .eq("brief_date", todayUtc)
    .eq("persona", persona)
    .maybeSingle();

  if (selectErr) throw new Error(`DB select error: ${selectErr.message}`);

  if (existing && !force) {
    return { brief: existing as DailyBrief, cached: true };
  }

  let filteredScout = scout;
  if (scout?.intelligence?.length) {
    const { data: dismissedRows } = await db
      .from("dismissed_intel")
      .select("ref_id")
      .eq("type", "scout_topic");
    const dismissedIds = new Set((dismissedRows ?? []).map((r: { ref_id: string }) => r.ref_id));
    if (dismissedIds.size > 0) {
      filteredScout = {
        ...scout,
        intelligence: scout.intelligence.filter(t => !dismissedIds.has(t.topic_id)),
      };
    }
  }

  const prompt = buildPersonaPrompt(persona, feeds, percentiles, seasonal, conflictBaselines, filteredScout);

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a senior procurement intelligence analyst at a UK advisory firm, writing a personalised daily morning brief for a specific client: ${PERSONA_CONFIG[persona].role}. You have access to live price data, news from 19 real-time sources, 10-year historical percentile context, seasonal demand patterns, and conflict zone baselines. You write like a trusted, highly intelligent colleague — direct, specific, occasionally dry, always useful. You never produce thin or generic analysis. You always connect news to cost implications. You use lateral intelligence: if a headline seems tangential, you find the supply chain or cost angle and use it. You never leave a section blank just because a price didn't move — flat prices still have context, history, and seasonal relevance. The top_decision field is the single most important output and must appear at the top of the email in large type. Return only valid JSON.`,
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
  try { parsed = JSON.parse(rawContent); } catch { parsed = {}; }

  const topDecisionRaw = parsed.top_decision as Record<string, unknown> | null;
  const topDecision: TopDecision | null = topDecisionRaw && typeof topDecisionRaw === "object" ? {
    signal: (["BUY", "HOLD", "ACT", "WATCH"].includes(topDecisionRaw.signal as string)
      ? topDecisionRaw.signal : "WATCH") as TopDecision["signal"],
    headline: (topDecisionRaw.headline as string) || "",
    deadline: (topDecisionRaw.deadline as string) || "",
    market: (topDecisionRaw.market as string) || "",
    gbp_impact: (topDecisionRaw.gbp_impact as string) || "",
    rationale: (topDecisionRaw.rationale as string) || "",
    confidence: (["HIGH", "MEDIUM", "LOW"].includes(topDecisionRaw.confidence as string)
      ? topDecisionRaw.confidence : "MEDIUM") as TopDecision["confidence"],
  } : null;

  const briefRow = {
    brief_date: todayUtc,
    persona,
    generated_at: new Date().toISOString(),
    feed_snapshot_at: feeds.fetched_at ?? null,
    top_decision: topDecision,
    narrative: (parsed.narrative as string) || "No narrative generated.",
    three_things: (parsed.three_things as string[]) || [],
    action_rationale: (parsed.action_rationale as Record<string, string>) || {},
    geopolitical_context: (parsed.geopolitical_context as string) || "",
    procurement_actions: (parsed.procurement_actions as string[]) || [],
    market_outlook: (parsed.market_outlook as string) || "",
    sector_news_digest: (parsed.sector_news_digest as Record<string, string[]>) || {},
    sector_forward_outlook: (parsed.sector_forward_outlook as Record<string, string>) || {},
    compounding_risk: (parsed.compounding_risk as string) || "",
    model: openaiData.model ?? "gpt-4o",
    prompt_tokens: usage.prompt_tokens ?? null,
    completion_tokens: usage.completion_tokens ?? null,
    price_snapshot: buildPriceSnapshot(feeds),
    shipping_lane_snapshot: (parsed.shipping_lane_snapshot as unknown[]) || null,
    fertilizer_detail: (parsed.fertilizer_detail as unknown[]) || null,
  };

  const { data: inserted, error: insertErr } = await db
    .from("daily_brief")
    .upsert(briefRow, { onConflict: "brief_date,persona" })
    .select()
    .maybeSingle();

  if (insertErr) throw new Error(`DB insert error: ${insertErr.message}`);
  return { brief: inserted as DailyBrief, cached: false };
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

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const force = body?.force === true;

    const personaParam = body?.persona;
    const allPersonas = body?.all_personas === true;

    if (allPersonas) {
      if (!openaiKey) throw new Error("OPENAI_API_KEY not configured");

      let feeds: FeedPayload | null = body?.feeds ?? null;
      if (!feeds) {
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const feedsRes = await fetch(`${supabaseUrl}/functions/v1/market-feeds`, {
          headers: { Authorization: `Bearer ${anonKey}` },
        });
        if (!feedsRes.ok) throw new Error(`Failed to fetch market feeds: ${feedsRes.status}`);
        feeds = await feedsRes.json() as FeedPayload;
      }

      const scout: ScoutPayload | null = body?.scout ?? null;

      const { percentiles, seasonal, conflictBaselines } = await fetchHistoricalContext(db);
      const results: Record<string, unknown> = {};

      for (const persona of ALL_PERSONAS) {
        try {
          const result = await generateBriefForPersona(persona, feeds!, percentiles, seasonal, conflictBaselines, openaiKey, db, todayUtc, force, scout);
          results[persona] = { cached: result.cached, brief_date: result.brief.brief_date };
        } catch (e) {
          results[persona] = { error: String(e) };
        }
      }

      return new Response(JSON.stringify({ all_personas: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const persona: PersonaId = (ALL_PERSONAS.includes(personaParam) ? personaParam : "general") as PersonaId;

    const { data: existing } = await db
      .from("daily_brief")
      .select("*")
      .eq("brief_date", todayUtc)
      .eq("persona", persona)
      .maybeSingle();

    if (existing && !force) {
      return new Response(JSON.stringify({ cached: true, brief: existing as DailyBrief }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let feeds: FeedPayload | null = body?.feeds ?? null;
    if (!feeds) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const feedsRes = await fetch(`${supabaseUrl}/functions/v1/market-feeds`, {
        headers: { Authorization: `Bearer ${anonKey}` },
      });
      if (!feedsRes.ok) throw new Error(`Failed to fetch market feeds: ${feedsRes.status}`);
      feeds = await feedsRes.json() as FeedPayload;
    }

    if (!openaiKey) {
      const fallbackRow = {
        brief_date: todayUtc,
        persona,
        generated_at: new Date().toISOString(),
        feed_snapshot_at: feeds?.fetched_at ?? null,
        top_decision: null,
        narrative: "AI brief unavailable — OPENAI_API_KEY not configured. Market data has been fetched and signals are derived automatically.",
        three_things: ["Check price signals in the action list below", "Review conflict intelligence for supply chain risks", "Monitor GBP/USD for import cost implications"],
        action_rationale: {},
        geopolitical_context: "",
        procurement_actions: [],
        market_outlook: "",
        sector_news_digest: {},
        sector_forward_outlook: {},
        compounding_risk: "",
        model: "none",
        prompt_tokens: null,
        completion_tokens: null,
        price_snapshot: buildPriceSnapshot(feeds!),
      };
      const { data: savedFallback, error: fallbackErr } = await db
        .from("daily_brief")
        .upsert(fallbackRow, { onConflict: "brief_date,persona" })
        .select()
        .maybeSingle();
      if (fallbackErr) throw new Error(`DB insert error: ${fallbackErr.message}`);
      return new Response(JSON.stringify({ cached: false, brief: savedFallback as DailyBrief }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const scout: ScoutPayload | null = body?.scout ?? null;
    const { percentiles, seasonal, conflictBaselines } = await fetchHistoricalContext(db);
    const result = await generateBriefForPersona(persona, feeds!, percentiles, seasonal, conflictBaselines, openaiKey, db, todayUtc, force, scout);

    return new Response(
      JSON.stringify({ cached: result.cached, brief: result.brief }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
