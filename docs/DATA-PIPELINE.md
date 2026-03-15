# Data Pipeline

This document describes the complete overnight data pipeline — from raw market data ingestion to email delivery — including scheduling, monitoring, and operational procedures.

---

## Overview

The pipeline runs once per day, targeting a 07:00 GMT delivery time (before the London market open at 08:00 GMT). It is fully automated but can be manually triggered at any time with `force: true`.

```
04:30 UTC — pg_cron fires
     ↓
overnight-pipeline edge function starts
     ↓
Step 1: market-feeds        ~3–5s
     ↓
Step 2: ai-brief (5 personas) ~30–60s
     ↓
Step 3: send-morning-brief   ~2–5s
     ↓
Log persisted to pipeline_runs
     ↓
~05:10–05:30 UTC — Emails delivered
(07:10–07:30 GMT during winter, 06:10–06:30 GMT during summer)
```

---

## Step 1: Market Data Ingestion

### What Gets Fetched

The `market-feeds` function fetches from 22 external sources in parallel:

**Price data (3 sources):**
- **Stooq** — 22 instrument tickers via CSV download (delayed 15–20min on some markets)
- **EIA** — Official US EIA Brent Crude daily spot price (authoritative, published daily)
- **ExchangeRate.host** — GBP/USD and GBP/EUR interbank FX rates

**News feeds (19 RSS sources):**

| Category | Sources |
|----------|---------|
| Agricultural | AHDB, World Grain, Fertilizer International, Farmers Weekly, USDA ERS, UN FAO |
| Energy | Rigzone |
| Freight | Freight & Trade Alliance, Lloyd's List |
| Metals | Metal Bulletin |
| General / Business | BBC Business, Guardian Business, MarketWatch, Financial Times |
| Geopolitical | Al Jazeera English, Reuters World, ReliefWeb Conflict |
| Macro / Policy | Bank of England, Office for Budget Responsibility |

### Data Quality Scoring

Each source receives an accuracy score (0–100) based on:
- **Recency:** Data < 6h old → 100; 6–12h → 75; 12–24h → 50; > 24h → 25
- **Parse success:** Failed parse → 0
- **Item count:** < 3 items → reduced score

The `DataFreshnessBar` component uses these scores to colour-code data freshness in the UI.

### Failure Handling

If a single source fails (network error, timeout, malformed response), it is recorded as `success: false` in the `FeedPayload` with an `error` string. The pipeline continues with the remaining sources. The `FeedPayload` always returns — even if every source fails.

The `ai-brief` function handles sparse or missing data gracefully by adjusting its prompt accordingly (e.g., "Note: EIA data unavailable — using Stooq futures only").

---

## Step 2: AI Brief Generation

### Persona Processing

When called with `all_personas: true`, the function generates briefs for all 5 personas sequentially:
1. `general`
2. `trader`
3. `agri`
4. `logistics`
5. `analyst`

Each brief is generated independently via a separate OpenAI API call. Sequential processing (not parallel) avoids rate limit issues on the OpenAI API.

### Caching Logic

Before calling OpenAI, the function checks the database:

```sql
SELECT id, generated_at
FROM daily_brief
WHERE brief_date = '2026-03-15'
  AND persona = 'general';
```

- **Found + `force` not set:** Returns cached brief. Skips OpenAI call. Zero cost.
- **Found + `force: true`:** Calls OpenAI, overwrites the existing row.
- **Not found:** Calls OpenAI, inserts new row.

This means on a normal day, all 5 briefs are generated exactly once (at pipeline time). Any subsequent dashboard loads for that day use the cached version.

### OpenAI Call Parameters

```json
{
  "model": "gpt-4o",
  "response_format": { "type": "json_object" },
  "temperature": 0.3,
  "max_tokens": 4000,
  "messages": [
    { "role": "system", "content": "You are DawnSignal..." },
    { "role": "user", "content": "[full prompt with market data]" }
  ]
}
```

Temperature 0.3 is intentionally low — we want consistent, analytical output rather than creative variation.

### Token Usage

Approximate per-persona token usage:
- **Input (prompt):** 2,000–3,500 tokens (varies with news volume and price data)
- **Output (brief):** 1,000–1,500 tokens

For all 5 personas: approximately 15,000–25,000 tokens per pipeline run. Costs depend on current GPT-4o pricing.

### Brief Storage

Each generated brief is upserted to `daily_brief`:

```sql
INSERT INTO daily_brief (brief_date, persona, narrative, three_things, top_decision, ...)
VALUES ('2026-03-15', 'general', '...', '...', '...')
ON CONFLICT (brief_date, persona)
DO UPDATE SET
  narrative = EXCLUDED.narrative,
  three_things = EXCLUDED.three_things,
  ...
  generated_at = now();
```

The `generated_at` timestamp is updated on each upsert, allowing the dashboard to show "Brief generated at 05:24 UTC".

---

## Step 3: Email Delivery

### Subscriber Selection

The function queries all active subscribers:

```sql
SELECT id, email, name, persona, unsubscribe_token
FROM email_subscriptions
WHERE active = true;
```

Subscribers are grouped by persona. For each persona group, the matching `daily_brief` row is loaded once and reused for all subscribers in that group.

### Brief Availability Guard

If no brief exists for a persona that has subscribers:
- The function logs a warning
- Those subscribers are skipped for this run
- No email is sent to them
- This is recorded in the pipeline logs

### Email Rendering

Each email is rendered individually per subscriber (to personalise the name, unsubscribe token, etc.). However, the heavy brief content (narrative, sector intelligence, etc.) is computed once per persona.

**HTML email features:**
- Fully inlined CSS (no external stylesheets — required for email client compatibility)
- Persona-specific accent colour in header
- Responsive layout (single column on mobile, 600px max-width)
- Dark background (#0f172a) with light text — consistent with the dashboard
- CTA button: "View live dashboard →" linking to the deployed URL
- Unsubscribe link: `https://[app-url]/?unsubscribe={token}`

**Subject line format:**
```
[BUY] Lock in diesel before Friday — DawnSignal
[URGENT] Wheat up 2.1% — review grain exposure — DawnSignal
[WATCH] Monitor energy markets — Brent +1.2% — DawnSignal
```

### Resend API Integration

Each email is sent via a POST to the Resend API:

```typescript
await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${RESEND_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from: "DawnSignal <onboarding@resend.dev>",
    to: [subscriber.email],
    subject: subjectLine,
    html: htmlContent,
    text: textContent,
  }),
});
```

On success: `email_subscriptions.last_sent_at` is updated to `now()`.

On failure: the error is logged; the pipeline continues to the next subscriber.

---

## Pipeline Monitoring

### Pipeline Runs Table

Every execution — whether successful, partial, or failed — is recorded in `pipeline_runs`:

```sql
SELECT run_date, triggered_at, total_duration_ms, logs, forced
FROM pipeline_runs
ORDER BY triggered_at DESC
LIMIT 10;
```

The `logs` array contains one entry per step:

```json
[
  {
    "step": "market-feeds",
    "status": "ok",
    "detail": "Market data fetched successfully",
    "duration_ms": 3421
  },
  {
    "step": "ai-brief",
    "status": "ok",
    "detail": "Persona briefs generated: 5 personas",
    "duration_ms": 47832
  },
  {
    "step": "send-morning-brief",
    "status": "ok",
    "detail": "Sent 1 email(s), failed 0",
    "duration_ms": 1204
  }
]
```

### AgentRunHistory Component

The `AgentRunHistory` component in the Diagnostics page fetches and displays recent pipeline runs. Shows:
- Run date and trigger time
- Total duration
- Whether it was a forced run
- Step-level status (green tick / red cross / amber skip)
- Error detail on hover/expand

### Interpreting Pipeline Status Codes

| HTTP Status | Meaning |
|------------|---------|
| `200` | All steps completed successfully |
| `207` | Partial success — at least one step errored, others may have succeeded |
| `500` | Pipeline threw an unhandled exception |

A `207` response with `step: "ai-brief", status: "skipped"` is not an error — it means a brief was already generated for today and was not regenerated.

---

## Scheduling

The pipeline is scheduled via `pg_cron` in the Supabase database:

```sql
-- Created in migration 20260314150631
SELECT cron.schedule(
  'overnight-pipeline',
  '30 4 * * *',  -- 04:30 UTC every day
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/overnight-pipeline',
      headers := '{"Authorization": "Bearer " || current_setting('app.supabase_anon_key') || '", "Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);
```

**Why 04:30 UTC?**
- GPT-4o brief generation takes ~45–60 seconds
- Email delivery takes ~5 seconds per subscriber
- 04:30 UTC trigger → pipeline completes ~05:15–05:30 UTC
- Emails arrive in inboxes 05:15–05:30 UTC = 05:15–06:30 BST (summer) / 05:15–06:30 GMT (winter)
- Subscribers receive email 1–2 hours before London market open

**Time window guard:**
The pipeline code checks `hourUtc < 6 || hourUtc >= 8` and skips execution outside that window. The 04:30 UTC cron fires but the pipeline sees `hourUtc === 4` and skips. This is intentional — the cron is set early as a safety buffer, and the guard ensures the pipeline doesn't run accidentally during the day if triggered manually without `force: true`.

**To change the schedule:** Create a new migration that updates the cron schedule via `SELECT cron.unschedule('overnight-pipeline')` followed by a new `cron.schedule()` call.

---

## Manual Operations

### Trigger the Pipeline Manually

Via the Diagnostics page DevControlsPanel:
1. Click "Run full pipeline"
2. This calls `POST /functions/v1/overnight-pipeline` with `{ "force": true }`
3. Monitor logs in the AgentRunHistory panel

Via curl:
```bash
curl -X POST \
  https://<project>.supabase.co/functions/v1/overnight-pipeline \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"force": true}'
```

### Regenerate a Brief for a Single Persona

```bash
curl -X POST \
  https://<project>.supabase.co/functions/v1/ai-brief \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"persona": "trader", "force": true}'
```

### Preview an Email Without Sending

```bash
curl -X POST \
  https://<project>.supabase.co/functions/v1/send-morning-brief \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"action": "preview", "persona": "general"}'
```

Returns `{ html, text, subject }` for inspection.

### Check What's in the Feed Cache

```sql
SELECT fetched_at, jsonb_array_length(payload->'sources') as source_count
FROM feed_cache
ORDER BY fetched_at DESC
LIMIT 1;
```

### Check Today's Briefs

```sql
SELECT persona, generated_at, model, prompt_tokens, completion_tokens,
       LEFT(narrative, 200) as narrative_preview
FROM daily_brief
WHERE brief_date = CURRENT_DATE
ORDER BY persona;
```

### Check Email Delivery Stats

```sql
SELECT
  COUNT(*) FILTER (WHERE active = true) as active_subscribers,
  COUNT(*) FILTER (WHERE last_sent_at::date = CURRENT_DATE) as sent_today,
  COUNT(*) FILTER (WHERE last_sent_at IS NULL) as never_received
FROM email_subscriptions;
```

---

## Configuration Reference

### Required Secrets (Edge Function Secrets)

| Secret Name | Purpose | Where to Set |
|------------|---------|-------------|
| `OPENAI_API_KEY` | GPT-4o brief generation | Supabase Dashboard > Edge Functions > Secrets |
| `RESEND_API_KEY` | Email delivery | Supabase Dashboard > Edge Functions > Secrets |

### Auto-Populated Secrets (No Action Needed)

| Secret Name | Value |
|------------|-------|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (for DB writes) |
| `SUPABASE_DB_URL` | Direct database connection URL |

### Frontend Environment Variables (`.env`)

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL (matches `SUPABASE_URL`) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (matches `SUPABASE_ANON_KEY`) |

---

## Common Issues

### Brief not generated / "generating" spinner stuck

**Cause:** OpenAI API key not configured or rate limited.

**Check:**
```sql
SELECT id, brief_date, persona, generated_at
FROM daily_brief
WHERE brief_date = CURRENT_DATE;
```

If empty, check the pipeline_runs log for the ai-brief step error detail.

**Fix:**
1. Verify `OPENAI_API_KEY` is set in Supabase Edge Function secrets
2. Check OpenAI usage dashboard for rate limit or billing issues
3. Force regenerate: `POST /functions/v1/ai-brief` with `{ "force": true }`

### Emails not sending

**Cause:** `RESEND_API_KEY` not set, or Resend account in sandbox mode (can only send to verified addresses).

**Check pipeline_runs:**
```sql
SELECT logs
FROM pipeline_runs
WHERE run_date = CURRENT_DATE
ORDER BY triggered_at DESC
LIMIT 1;
```

Look for `"step": "send-morning-brief", "status": "error"` with detail.

**Fix:**
1. Verify `RESEND_API_KEY` is set in edge function secrets
2. Verify Resend account is not in sandbox mode (add and verify sending domain)
3. Test preview: `POST /functions/v1/send-morning-brief` with `{ "action": "preview" }`

### Market data missing / stale

**Cause:** External data source (Stooq, EIA, RSS) returned error or was unreachable.

**Check feed_cache:**
```sql
SELECT fetched_at,
       payload->'sources' as sources
FROM feed_cache
ORDER BY fetched_at DESC
LIMIT 1;
```

Individual source errors show as `"success": false` with an error message in the source object.

**Note:** Stooq provides delayed data (15–20 minutes on some instruments). This is expected and noted in the UI.

### Pipeline skipped outside time window

The pipeline returns `{ "skipped": true }` if run outside 06:00–08:00 UTC. This is intentional behaviour, not an error.

To override: add `{ "force": true }` to the request body.

### pg_cron not firing

**Diagnose:**
```sql
SELECT * FROM cron.job_run_details
WHERE jobname = 'overnight-pipeline'
ORDER BY start_time DESC
LIMIT 10;
```

If no recent entries, check that `pg_cron` is enabled in the Supabase project (it is enabled by default on all projects).

---

## Email Delivery SLA

| Metric | Target |
|--------|--------|
| Pipeline start | 04:30 UTC |
| Brief generation complete | 05:15–05:30 UTC |
| Email delivery to inbox | 05:15–06:00 UTC |
| Time before London open | 2–3 hours |
| Delivery failure rate | < 1% (Resend guaranteed deliverability) |

---

## Future Considerations

- **Parallel persona generation:** The 5 AI briefs are currently generated sequentially. Parallelising them would reduce step 2 time from ~60s to ~15s, but requires careful OpenAI rate limit management.
- **Webhook-based triggering:** Replace pg_cron HTTP call with a native Supabase scheduled function trigger when available.
- **Double opt-in:** The `confirmed` column exists in `email_subscriptions` but is not enforced. Activating email confirmation would require a confirmation link flow.
- **Delivery windows per subscriber:** The `send_hour_utc` column exists in `email_subscriptions` but the pipeline currently ignores it, sending to everyone at once. Per-subscriber delivery windows would require a queue-based approach.
- **Data source expansion:** Adding Bloomberg API or Refinitiv for real-time (non-delayed) price data would improve signal accuracy for the Trader persona.
