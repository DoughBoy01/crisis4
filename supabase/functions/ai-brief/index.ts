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
}> = {
  general: {
    label: "Business Overview",
    role: "UK business owner or CFO reviewing morning procurement risks",
    primarySectors: ["energy", "fx"],
    supportingSectors: ["freight", "agricultural", "fertilizer", "metals", "policy"],
    focusDescription: "plain-English cost and supply impact for a UK business — what this means in pounds, not market jargon",
    actionVerb: "business cost",
  },
  trader: {
    label: "Commodity Trader",
    role: "commodity trader at a UK food & agricultural business, reviewing before the 07:00 standup",
    primarySectors: ["energy", "fx", "metals"],
    supportingSectors: ["agricultural", "freight", "fertilizer", "policy"],
    focusDescription: "price signals, momentum, risk-off sentiment, and market timing — specific levels, not generalities",
    actionVerb: "trading",
  },
  agri: {
    label: "Agri Buyer",
    role: "agricultural procurement buyer responsible for grain, fertilizer, and soft commodity purchasing",
    primarySectors: ["agricultural", "fertilizer"],
    supportingSectors: ["energy", "fx", "freight"],
    focusDescription: "grain input costs, fertilizer product moves (urea/DAP/ammonia/potash), Black Sea corridor risk, and planting economics",
    actionVerb: "procurement",
  },
  logistics: {
    label: "Logistics Director",
    role: "logistics director managing freight, shipping, and fuel costs for a UK importer",
    primarySectors: ["freight", "energy"],
    supportingSectors: ["fx", "policy"],
    focusDescription: "shipping lane status (Red Sea/Suez/Cape Horn rerouting), BDI moves, bunker costs, and estimated landed cost impacts",
    actionVerb: "logistics",
  },
  analyst: {
    label: "Risk Analyst",
    role: "risk analyst preparing client-ready intelligence reports covering all market sectors",
    primarySectors: ["energy", "agricultural", "freight", "fertilizer", "metals", "fx", "policy"],
    supportingSectors: [],
    focusDescription: "full cross-sector analysis with citable sources, historical percentile context, and scenario framing for client reporting",
    actionVerb: "risk",
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
  if (lines.length === 1) lines.push("No news available.");
  return lines.join("\n");
}

function buildPriceMovesSection(feeds: FeedPayload): string {
  const prices: string[] = [];
  const yahooPrices = feeds.sources.find(s => s.source_name === "Yahoo Finance" || s.source_name === "Stooq Market Data");
  if (yahooPrices?.quotes?.length) {
    for (const q of yahooPrices.quotes) {
      if (q.price != null && q.changePercent != null) {
        const dir = q.changePercent >= 0 ? "+" : "";
        const tier = magnitudeTier(Math.abs(q.changePercent));
        prices.push(`${q.label}: ${q.price.toFixed(2)} (${dir}${q.changePercent.toFixed(2)}%) [${tier}]`);
      }
    }
  }
  const brentSrc = feeds.sources.find(s => s.source_name === "EIA Brent Crude");
  if (brentSrc?.success && brentSrc.current_price) {
    const pct = brentSrc.change_pct != null ? brentSrc.change_pct : 0;
    const dir = pct >= 0 ? "+" : "";
    const tier = magnitudeTier(Math.abs(pct));
    prices.push(`Brent Crude (EIA): $${brentSrc.current_price.toFixed(2)}/bbl (${dir}${pct.toFixed(2)}%) [${tier}]`);
  }
  const fxSrc = feeds.sources.find(s => s.source_name === "ExchangeRate.host FX");
  const yahooGbpUsd = yahooPrices?.quotes?.find(q => q.symbol === "GBPUSD=X");
  const yahooGbpEur = yahooPrices?.quotes?.find(q => q.symbol === "GBPEUR=X");
  if (fxSrc?.success) {
    if (fxSrc.gbp_usd && !yahooGbpUsd?.changePercent) {
      prices.push(`GBP/USD (spot): ${(fxSrc.gbp_usd as number).toFixed(4)} — no overnight change from this source`);
    }
    if (fxSrc.gbp_eur && !yahooGbpEur?.changePercent) {
      prices.push(`GBP/EUR (spot): ${(fxSrc.gbp_eur as number).toFixed(4)} — no overnight change from this source`);
    }
  }
  return prices.length ? prices.join("\n") : "No price data available.";
}

function buildPersonaPrompt(
  persona: PersonaId,
  feeds: FeedPayload,
  percentiles: CommodityPercentile[],
  seasonal: SeasonalPattern[],
  conflictBaselines: ConflictBaseline[],
): string {
  const cfg = PERSONA_CONFIG[persona];
  const lines: string[] = [];

  const historicalContextSection = buildHistoricalContextSection(feeds, percentiles, seasonal);
  const conflictBaselineSection = buildConflictBaselineSection(conflictBaselines, feeds);
  const newsSection = buildNewsSection(feeds);
  const priceMovesSection = buildPriceMovesSection(feeds);

  lines.push(`You are a procurement intelligence analyst writing a morning brief FOR A SPECIFIC READER.`);
  lines.push(`READER PROFILE: ${cfg.role}.`);
  lines.push(`YOUR LENS: Focus depth on ${cfg.focusDescription}.`);
  lines.push(`Your monitoring window is 22:00–07:00 GMT (overnight). Reader receives this at 07:00 GMT.`);
  lines.push(`Be direct, specific, and actionable. No waffle. Use plain English.`);
  lines.push(`All price moves are vs the 22:00 GMT baseline.`);
  lines.push("");

  lines.push("=== PERSONA PRIORITY FRAMEWORK ===");
  lines.push(`PRIMARY SECTORS (write with full analytical depth — 3-5 sentences each):`);
  lines.push(`  ${cfg.primarySectors.join(", ")}`);
  if (cfg.supportingSectors.length > 0) {
    lines.push(`SUPPORTING SECTORS (write only if they directly impact this reader — 1-2 sentences max):`);
    lines.push(`  ${cfg.supportingSectors.join(", ")}`);
  }
  lines.push("");
  lines.push("PERSONA-SPECIFIC INSTRUCTIONS:");

  if (persona === "general") {
    lines.push("- Translate all market moves into £/unit business cost impact where possible");
    lines.push("- Avoid trading jargon — if you write 'bbl', explain it means 'barrel'");
    lines.push("- Focus on: what does this mean for my energy bill, my supplier invoices, my freight costs?");
    lines.push("- The narrative should read as if you're briefing a non-finance MD before their morning meeting");
  } else if (persona === "trader") {
    lines.push("- Lead with the biggest price move — absolute and relative context");
    lines.push("- For metals: explicitly call out gold/silver as risk-off indicator vs genuine demand signal");
    lines.push("- For FX: state exact basis point moves and quantify USD-denominated import cost impact");
    lines.push("- Name specific price levels and whether they represent technical resistance/support");
    lines.push("- Your narrative tone is terse — like a Bloomberg terminal update, not a news article");
  } else if (persona === "agri") {
    lines.push("- Lead with grain sector: wheat/corn/soybeans in that order of UK procurement relevance");
    lines.push("- For fertilizer: name specific products (urea, DAP, ammonia, potash) with any price/supply signals");
    lines.push("- For Black Sea: cross-reference conflict headlines with historical corridor disruption impacts");
    lines.push("- Always state seasonal context for grain: are we in planting, growing, or harvest pressure?");
    lines.push("- Quantify: '£X/tonne estimated input cost change' for key grain moves against GBP/USD");
  } else if (persona === "logistics") {
    lines.push("- Lead with freight: BDI level, Red Sea/Suez status, any rerouting news");
    lines.push("- For energy: focus on bunker fuel (Brent as proxy) — quantify as cost per shipping day");
    lines.push("- State specific corridor status: Red Sea, Cape of Good Hope, Panama Canal, Suez");
    lines.push("- Include estimated voyage time additions and cost uplifts for Cape Horn rerouting if relevant");
    lines.push("- FX only if it affects USD-denominated freight contracts materially (>0.3% move)");
  } else if (persona === "analyst") {
    lines.push("- Cover all sectors comprehensively — this is used in client reports");
    lines.push("- Every claim must be citable: reference specific news source or data point");
    lines.push("- Use academic-grade precision: 'Brent at 73rd percentile vs 10-year history' not 'elevated'");
    lines.push("- The compounding_risk field is critical for this persona — identify cross-sector amplifications");
    lines.push("- Procurement_actions should be structured as risk-management recommendations, not simple instructions");
  }

  lines.push("");
  lines.push("=== INTELLIGENCE GUIDANCE (all personas) ===");
  lines.push("- Magnitude tiers are shown as [SIGNIFICANT/NOTABLE/MODERATE/MINOR/FLAT] — use these to prioritise");
  lines.push("- Compound signals: if Brent SIGNIFICANT + Red Sea news + GBP weakness all present simultaneously,");
  lines.push("  this is a COMPOUNDING COST PRESSURE scenario — call it out explicitly in compounding_risk");
  lines.push("- Gold/silver rising WITH conflict headlines = risk-off flight to safety (different from commodity demand)");
  lines.push("- Copper falling = industrial demand concern (different from metals as safe haven)");
  lines.push("- Cross reference: a wheat move is more significant if: (a) near 10-yr high, (b) in HIGH seasonal demand, (c) Black Sea headlines present");
  lines.push("- FX always means import costs: GBP/USD -0.4% = ~0.4% rise in all USD-denominated commodity import costs");
  lines.push("- Bank of England / OBR news drives GBP and UK interest rate expectations — always link to import cost");
  lines.push("");

  lines.push(`=== PRICE MOVES (22:00–07:00 GMT) ===`);
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

  lines.push("=== YOUR TASK ===");
  lines.push("WRITING STANDARDS:");
  lines.push("- Write as a senior analyst briefing THIS SPECIFIC READER TYPE — not a generic audience");
  lines.push("- Always include specific numbers: exact prices, exact % changes, exact basis points, named sources");
  lines.push("- Reference historical percentile position when available");
  lines.push("- Reference seasonal context when relevant");
  lines.push("- Reference conflict zone baselines when conflict news is present");
  lines.push(`- For ${cfg.actionVerb} implications, be specific: name the exact input cost impact in £/unit`);
  lines.push("- For FX, always state the import cost implication explicitly");
  lines.push("");
  lines.push("CRITICAL RULES FOR action_rationale:");
  lines.push(`- PRIMARY sectors (${cfg.primarySectors.join(", ")}): write 3-5 full sentences when data exists`);
  if (cfg.supportingSectors.length > 0) {
    lines.push(`- SUPPORTING sectors (${cfg.supportingSectors.join(", ")}): write 1-2 sentences ONLY IF directly relevant to this persona`);
  }
  lines.push("- Structure for primary sectors: (1) exact price/move, (2) historical/seasonal context, (3) specific ${cfg.label}-relevant cost/operational impact, (4) forward risk");
  lines.push("- EMPTY STRING if you have no actual data AND no relevant headline for that sector");
  lines.push("- NEVER write filler — a 0.00% move with no news = empty string");
  lines.push("");
  lines.push("CRITICAL RULES FOR compounding_risk:");
  lines.push("- ONLY write this if 2+ sectors are moving simultaneously AND they amplify each other for THIS READER");
  lines.push(`- Example for ${cfg.label}: if energy + FX + freight all moving adversely, state: 'Triple cost pressure — Brent +X%, GBP/USD -Y%, freight BDI +Z% — compounding landed cost increase of approximately [estimate]%'`);
  lines.push("- Be specific about the compounding mechanism — which costs multiply, not just add");
  lines.push("- EMPTY STRING if only one sector is moving or there is no meaningful interaction");
  lines.push("");
  lines.push("CRITICAL RULES FOR three_things:");
  lines.push(`- Pick the 3 most important items FOR THIS ${cfg.label.toUpperCase()} specifically — not the globally biggest moves`);
  lines.push("- Each item: 2-3 sentences. Lead with the specific data point, follow with the ${cfg.label}-specific implication");
  lines.push("- Self-contained — reader should not need to check anything else to understand the significance");
  lines.push("");
  lines.push("CRITICAL RULES FOR procurement_actions:");
  lines.push(`- 2-4 specific, actionable recommendations relevant to A ${cfg.label.toUpperCase()}`);
  lines.push("- Each action must reference a specific market/event and give a concrete instruction");
  lines.push("- If there is nothing actionable (flat, quiet night), return an empty array");
  lines.push("");
  lines.push("CRITICAL RULES FOR market_outlook:");
  lines.push("- 2-3 sentences on what THIS READER should watch during 07:00-17:00 GMT today");
  lines.push("- Name specific data releases, scheduled events, or price levels relevant to this persona");
  lines.push("- EMPTY STRING if nothing notable scheduled");
  lines.push("");
  lines.push("CRITICAL RULES FOR sector_news_digest:");
  lines.push("- For each sector with content, list 1-3 headlines/events that drove the analysis");
  lines.push("- Include source name in brackets: '[Reuters World RSS] headline'");
  lines.push("- Empty array for sectors with no content");
  lines.push("");
  lines.push("CRITICAL RULES FOR sector_forward_outlook:");
  lines.push("- For primary sectors with content: 1-2 sentences directional outlook over next 2-5 days");
  lines.push("- Be directional: 'likely to remain elevated', 'watch for pullback if...' — not vague");
  lines.push("- EMPTY STRING for sectors with no content");
  lines.push("");

  lines.push("Return ONLY valid JSON:");
  lines.push(JSON.stringify({
    narrative: `3-5 sentence summary written specifically for a ${cfg.label}. Lead with the single biggest development RELEVANT TO THIS READER. Include exact prices and % changes. State whether conflict news represents escalation above baseline. End with the net ${cfg.actionVerb} implication for today.`,
    three_things: [
      `Most important thing for a ${cfg.label} today — data point + ${cfg.actionVerb} implication + context. 2-3 sentences. Self-contained.`,
      `Second most important (same format). 2-3 sentences.`,
      `Third most important (same format). 2-3 sentences.`
    ],
    compounding_risk: `ONLY if 2+ sectors are simultaneously adverse for a ${cfg.label} — describe the amplification mechanism and estimated combined cost impact. EMPTY STRING otherwise.`,
    geopolitical_context: "2-4 sentences on named conflicts/events relevant to this reader. State vs historical baseline. EMPTY STRING if no specific geopolitical event.",
    procurement_actions: [
      `Action 1: specific instruction for a ${cfg.label} referencing specific market/price/event`,
      `Action 2: specific instruction`
    ],
    market_outlook: `2-3 sentences on what a ${cfg.label} should watch today (07:00-17:00 GMT). Persona-specific events and thresholds. EMPTY STRING if nothing notable.`,
    action_rationale: {
      "energy": "Primary for trader/logistics/general. 3-5 sentences for primary personas. EMPTY STRING if no data.",
      "agricultural": "Primary for agri/analyst. 3-5 sentences for primary personas. EMPTY STRING if no data.",
      "freight": "Primary for logistics/analyst. 3-5 sentences for primary personas. EMPTY STRING if no data.",
      "fertilizer": "Primary for agri/analyst. 3-5 sentences for primary personas. EMPTY STRING if no data.",
      "metals": "Primary for trader/analyst. 3-5 sentences for primary personas. EMPTY STRING if no data.",
      "fx": "Primary for trader/analyst. 3-5 sentences for primary personas. EMPTY STRING if no data.",
      "policy": "Primary for analyst only. 3-5 sentences for analyst. EMPTY STRING for other personas unless BoE news explicitly affects their sector."
    },
    sector_news_digest: {
      "energy": ["[source] headline"], "agricultural": [], "freight": [],
      "fertilizer": [], "metals": [], "fx": [], "policy": []
    },
    sector_forward_outlook: {
      "energy": "Directional 1-2 sentences for primary personas. EMPTY STRING otherwise.",
      "agricultural": "EMPTY STRING if not primary for this persona.",
      "freight": "EMPTY STRING if not primary for this persona.",
      "fertilizer": "EMPTY STRING if not primary for this persona.",
      "metals": "EMPTY STRING if not primary for this persona.",
      "fx": "EMPTY STRING if not primary for this persona.",
      "policy": "EMPTY STRING if not primary for this persona."
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

  const prompt = buildPersonaPrompt(persona, feeds, percentiles, seasonal, conflictBaselines);

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a terse, expert procurement intelligence analyst writing a personalised morning brief for a ${PERSONA_CONFIG[persona].role}. You have access to price data, news from 19 sources, historical percentile context, seasonal patterns, and conflict zone baselines. Your analysis must be written for THIS SPECIFIC READER — not a generic audience. Return only valid JSON.`,
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

  const briefRow = {
    brief_date: todayUtc,
    persona,
    generated_at: new Date().toISOString(),
    feed_snapshot_at: feeds.fetched_at ?? null,
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

      const { percentiles, seasonal, conflictBaselines } = await fetchHistoricalContext(db);
      const results: Record<string, unknown> = {};

      for (const persona of ALL_PERSONAS) {
        try {
          const result = await generateBriefForPersona(persona, feeds!, percentiles, seasonal, conflictBaselines, openaiKey, db, todayUtc, force);
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

    const { percentiles, seasonal, conflictBaselines } = await fetchHistoricalContext(db);
    const result = await generateBriefForPersona(persona, feeds!, percentiles, seasonal, conflictBaselines, openaiKey, db, todayUtc, force);

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
