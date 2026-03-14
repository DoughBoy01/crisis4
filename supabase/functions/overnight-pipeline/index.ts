import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PipelineLog {
  step: string;
  status: "ok" | "error" | "skipped";
  detail?: string;
  duration_ms?: number;
}

async function callFunction(baseUrl: string, anonKey: string, slug: string, body?: unknown): Promise<{ ok: boolean; data: unknown; status: number }> {
  const res = await fetch(`${baseUrl}/functions/v1/${slug}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data, status: res.status };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const runStarted = Date.now();
  const logs: PipelineLog[] = [];

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey);

    const nowUtc = new Date();
    const hourUtc = nowUtc.getUTCHours();
    const todayUtc = nowUtc.toISOString().slice(0, 10);

    const body = await req.json().catch(() => ({}));
    const force = body?.force === true;

    if (!force && (hourUtc < 6 || hourUtc >= 8)) {
      return new Response(
        JSON.stringify({
          skipped: true,
          reason: `Pipeline only runs 06:00–08:00 UTC (targets 07:00 GMT send). Current UTC hour: ${hourUtc}. Pass { force: true } to override.`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: existingBrief } = await db
      .from("daily_brief")
      .select("id, generated_at")
      .eq("brief_date", todayUtc)
      .maybeSingle();

    // ── Step 1: Fetch overnight market feeds ─────────────────────────────────
    const step1Start = Date.now();
    let feedData: unknown = null;

    {
      const result = await callFunction(supabaseUrl, anonKey, "market-feeds");
      const duration_ms = Date.now() - step1Start;

      if (result.ok) {
        feedData = result.data;
        logs.push({ step: "market-feeds", status: "ok", detail: "Market data fetched successfully", duration_ms });
      } else {
        logs.push({ step: "market-feeds", status: "error", detail: `HTTP ${result.status}: ${JSON.stringify(result.data)}`, duration_ms });
      }
    }

    // ── Step 2: Generate AI brief ─────────────────────────────────────────────
    const step2Start = Date.now();
    let briefGenerated = false;

    if (existingBrief && !force) {
      logs.push({ step: "ai-brief", status: "skipped", detail: `Brief already exists for ${todayUtc} (generated at ${existingBrief.generated_at})` });
    } else {
      const briefBody: Record<string, unknown> = {};
      if (feedData) briefBody.feeds = feedData;
      if (force) briefBody.force = true;

      const result = await callFunction(supabaseUrl, anonKey, "ai-brief", briefBody);
      const duration_ms = Date.now() - step2Start;

      if (result.ok) {
        briefGenerated = true;
        const detail = result.data as { source?: string; model?: string };
        logs.push({
          step: "ai-brief",
          status: "ok",
          detail: `Brief generated (model: ${detail?.model ?? "unknown"}, source: ${detail?.source ?? "ai"})`,
          duration_ms,
        });
      } else {
        logs.push({ step: "ai-brief", status: "error", detail: `HTTP ${result.status}: ${JSON.stringify(result.data)}`, duration_ms });
      }
    }

    // ── Step 3: Send morning brief emails ────────────────────────────────────
    const step3Start = Date.now();

    {
      const result = await callFunction(supabaseUrl, anonKey, "send-morning-brief", { action: "send_now" });
      const duration_ms = Date.now() - step3Start;

      const detail = result.data as { sent?: number; failed?: number; message?: string; error?: string };

      if (result.ok) {
        logs.push({
          step: "send-morning-brief",
          status: "ok",
          detail: detail?.message ?? `Sent ${detail?.sent ?? 0} email(s), failed ${detail?.failed ?? 0}`,
          duration_ms,
        });
      } else {
        logs.push({
          step: "send-morning-brief",
          status: "error",
          detail: detail?.error ?? `HTTP ${result.status}`,
          duration_ms,
        });
      }
    }

    // ── Persist pipeline run log ──────────────────────────────────────────────
    await db.from("pipeline_runs").insert({
      run_date: todayUtc,
      triggered_at: new Date(runStarted).toISOString(),
      total_duration_ms: Date.now() - runStarted,
      logs,
      forced: force,
    }).then(() => undefined).catch(() => undefined);

    const hasError = logs.some(l => l.status === "error");

    return new Response(
      JSON.stringify({
        success: !hasError,
        run_date: todayUtc,
        total_duration_ms: Date.now() - runStarted,
        logs,
      }),
      {
        status: hasError ? 207 : 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    logs.push({ step: "pipeline", status: "error", detail: String(err) });
    return new Response(
      JSON.stringify({ success: false, total_duration_ms: Date.now() - runStarted, logs }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
