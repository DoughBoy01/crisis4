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

function buildPrompt(feeds: FeedPayload): string {
  const lines: string[] = [];

  const newsItems: string[] = [];
  const NEWS_SOURCES = [
    "BBC Business RSS", "Al Jazeera RSS", "Guardian Business RSS",
    "Farmers Weekly RSS", "AHDB RSS", "Reuters World RSS",
    "Reuters Commodities RSS", "ReliefWeb Conflict RSS", "Shipping RSS",
    "MarketWatch RSS", "USDA RSS",
  ];
  for (const src of feeds.sources) {
    if (NEWS_SOURCES.includes(src.source_name) && src.success && src.items?.length) {
      for (const item of src.items.slice(0, 3)) {
        newsItems.push(`[${src.source_name}] ${item.title}`);
      }
    }
  }

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

  lines.push("You are a procurement intelligence analyst for a UK food & agricultural business.");
  lines.push("Your monitoring window is 22:00–07:00 GMT (10pm last night to 7am this morning).");
  lines.push("Your audience receives this brief at 07:00 GMT — summarise EVERYTHING that moved or was reported during that 9-hour window.");
  lines.push("Be direct, specific, and actionable. No waffle. Use plain English.");
  lines.push("All price moves are vs the 22:00 GMT baseline (previous close or last traded price at start of window).");
  lines.push("");
  lines.push("=== PRICE MOVES (22:00–07:00 GMT WINDOW) ===");
  lines.push(prices.length ? prices.join("\n") : "No price data available.");
  lines.push("");
  lines.push("=== NEWS & EVENTS (22:00–07:00 GMT WINDOW) ===");
  lines.push(newsItems.length ? newsItems.slice(0, 25).join("\n") : "No news available.");
  lines.push("");
  lines.push("=== YOUR TASK ===");
  lines.push("Return ONLY valid JSON with this exact structure:");
  lines.push(JSON.stringify({
    narrative: "2-4 sentence plain-English summary of what happened overnight that a procurement manager needs to know. Lead with the biggest market move or geopolitical development.",
    three_things: [
      "The single most important thing to know today (max 20 words)",
      "Second most important thing (max 20 words)",
      "Third most important thing (max 20 words)"
    ],
    geopolitical_context: "1-2 sentences on geopolitical developments affecting commodity supply chains. Only include if genuinely relevant.",
    action_rationale: {
      "energy": "What energy markets did overnight and why it matters for procurement",
      "agricultural": "What grain/oilseed markets did overnight and why it matters",
      "freight": "What freight/shipping markets did overnight and why it matters",
      "fertilizer": "What fertilizer inputs did overnight and why it matters",
      "fx": "What GBP moves mean for import costs today"
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

    if (!openaiKey) {
      const fallback: DailyBrief = {
        id: crypto.randomUUID(),
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
      return new Response(JSON.stringify({ cached: false, brief: fallback }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = buildPrompt(feeds!);

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
            content: "You are a terse, expert procurement intelligence analyst. Return only valid JSON.",
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
