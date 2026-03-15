# Edge Functions

DawnSignal uses four Supabase Edge Functions, running on the Deno runtime. All functions are deployed to `https://<project>.supabase.co/functions/v1/<slug>`.

---

## Overview

| Function | Trigger | Purpose |
|----------|---------|---------|
| `market-feeds` | Frontend (every 15 min) + pipeline | Fetch live market data from 22 sources |
| `ai-brief` | Dashboard on demand + pipeline | Generate persona-specific AI briefs via GPT-4o |
| `overnight-pipeline` | pg_cron at 04:30 UTC + manual | Orchestrate full ETL: feeds → briefs → emails |
| `send-morning-brief` | Pipeline + subscribe form + manual | Manage subscriptions and send HTML emails |

All functions implement CORS headers and handle OPTIONS preflight requests.

---

## `market-feeds`

**File:** `supabase/functions/market-feeds/index.ts`

**Purpose:** Fetches and aggregates overnight market data from 22 external sources, returning a structured `FeedPayload`.

### Data Sources

#### Stooq / Yahoo Finance (22 tickers via CSV)
Tickers fetched:
```
BZ=F   Brent Crude Oil (ICE)
CL=F   WTI Crude Oil (NYMEX)
NG=F   Natural Gas (Henry Hub)
ZW=F   CBOT Wheat
ZC=F   CBOT Corn
ZS=F   CBOT Soybeans
HG=F   COMEX Copper
GC=F   COMEX Gold
SI=F   COMEX Silver
BDI    Baltic Dry Index (BDI)
SCFI   Shanghai Containerized Freight Index
GBPUSD=X  GBP/USD spot
EURUSD=X  EUR/USD spot
GBPEUR=X  GBP/EUR spot
^FTSE  FTSE 100
^GSPC  S&P 500
^DJI   Dow Jones Industrial Average
DX=F   US Dollar Index
^VIX   VIX Volatility Index
```

**Parse method:** Fetches `https://stooq.com/q/d/l/?s={ticker}&i=d` (CSV format). Extracts last 2 rows for 24h change calculation.

#### EIA Brent Crude Spot
**URL:** `https://api.eia.gov/v2/petroleum/pri/spt/data/?frequency=daily&data[0]=value&sort[0][column]=period&sort[0][direction]=desc&offset=0&length=2`

Returns the official US Energy Information Administration daily Brent Crude spot price. Used as the authoritative source for Brent (cross-referenced against Stooq futures).

#### ExchangeRate.host FX
**URL:** `https://api.exchangerate.host/live?source=GBP&currencies=USD,EUR`

Returns interbank mid-rates for GBP/USD and GBP/EUR. Used as a cross-check on Yahoo Finance FX data.

#### RSS News Feeds (19 sources)
Fetched in parallel:

| Source | URL | Category |
|--------|-----|----------|
| AHDB (Agriculture and Horticulture Development Board) | RSS | Agricultural |
| BBC Business | RSS | General Business |
| Guardian Business | RSS | General Business |
| MarketWatch Commodities | RSS | Commodities |
| Financial Times Markets | RSS | Markets |
| Rigzone (Oil & Gas) | RSS | Energy |
| World Grain | RSS | Agricultural |
| Fertilizer International | RSS | Fertilizer |
| Freight & Trade Alliance | RSS | Freight |
| Metal Bulletin | RSS | Metals |
| Al Jazeera English | RSS | Geopolitical |
| Reuters World News | RSS | Geopolitical |
| ReliefWeb Conflict | RSS | Geopolitical |
| Bank of England | RSS | Policy/Macro |
| OBR (Office for Budget Responsibility) | RSS | Policy/Macro |
| Farmers Weekly | RSS | Agricultural |
| USDA Economic Research Service | RSS | Agricultural |
| UN Food and Agriculture Organisation | RSS | Agricultural |
| Lloyd's List (Shipping) | RSS | Freight |

**RSS parsing:** Uses a regex-based XML parser (no external library). Extracts `<title>`, `<link>`, `<description>`, `<pubDate>` from each `<item>`.

### Response Shape (`FeedPayload`)

```typescript
interface FeedPayload {
  sources: FeedSource[];
  fetchedAt: string;  // ISO timestamp
}

interface FeedSource {
  name: string;
  url: string;
  type: 'price' | 'news';
  success: boolean;
  error?: string;
  quotes?: Quote[];
  items?: NewsItem[];
  accuracy: number;      // 0–100 score based on recency
  ageMinutes?: number;   // How old the data is
}

interface Quote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  unit: string;
  lastUpdated: string;
}

interface NewsItem {
  title: string;
  link: string;
  description: string;
  publishedAt: string;  // ISO timestamp
  source: string;
}
```

### Calling Convention

```
POST /functions/v1/market-feeds
Authorization: Bearer <ANON_KEY>
Content-Type: application/json
{}

→ 200: FeedPayload JSON
→ 500: { error: "..." }
```

No request body parameters are needed. The function always fetches fresh data.

---

## `ai-brief`

**File:** `supabase/functions/ai-brief/index.ts`

**Purpose:** Generates AI-powered morning briefs using OpenAI GPT-4o. Supports single-persona and all-personas modes. Implements daily caching via the `daily_brief` table.

### Request Body

```typescript
{
  persona?: 'general' | 'trader' | 'agri' | 'logistics' | 'analyst',
  all_personas?: boolean,   // If true, generates for all 5 personas
  feeds?: FeedPayload,      // Optional pre-fetched feed data
  force?: boolean,          // If true, regenerates even if cached
}
```

### Execution Flow

1. **Receive request.** Extract `persona` (default `'general'`) or `all_personas=true`.
2. **Check cache.** Query `daily_brief` where `brief_date = today` AND `persona = X`. If found and `force` is not set, return cached result.
3. **Load historical context.** Fetch `commodity_percentiles`, `commodity_seasonal_patterns`, `conflict_zone_baselines` from database.
4. **Fetch feeds.** If `feeds` not provided in request body, call `market-feeds` function internally.
5. **Build prompt.** Assemble a multi-section prompt string (see Prompt Architecture below).
6. **Call OpenAI.** POST to `https://api.openai.com/v1/chat/completions` with `model: "gpt-4o"` and `response_format: { type: "json_object" }`.
7. **Parse response.** Extract and validate the JSON output.
8. **Upsert to database.** Insert or update `daily_brief` row for `(brief_date, persona)`.
9. **Return response.** Return the brief as JSON.

### Prompt Architecture

Each prompt is assembled from five sections:

#### Section 1: Role Context
Defines who the AI is acting as and the platform context:
```
You are DawnSignal, an AI procurement intelligence analyst.
Your task is to generate a morning brief for a [PERSONA DESCRIPTION].
Today's date: [DATE]. Current UTC time: [TIME].
The London market opens at 08:00 GMT.
```

#### Section 2: Historical Context
Built from database reference data:
```
HISTORICAL PRICE CONTEXT (10-year percentile bands):
- Brent Crude: current $XX.XX — at ~[RANK]th percentile (median: $72/bbl, p10: $40, p90: $105)
  Seasonal pressure: [PRESSURE_LABEL] for [MONTH] (index: 1.15)
- Wheat CBOT: current XXXc/bu — at ~[RANK]th percentile ...
...
```

#### Section 3: Conflict Baseline Context
```
CONFLICT ZONE STATUS vs HISTORICAL BASELINE:
- Red Sea / Yemen: [N] matching events in last 24h (baseline: 2.0/week)
  → [+X% vs norm] [ELEVATED/HIGH/CRITICAL]
- Ukraine / Black Sea: ...
```

#### Section 4: Live News Items
```
NEWS FEED (categorised):
[GEOPOLITICAL] Al Jazeera: "Houthi forces claim attack on commercial vessel..." (2h ago)
[ENERGY] Rigzone: "OPEC+ considers extending production cuts..." (4h ago)
[AGRICULTURAL] USDA: "Winter wheat condition ratings drop 3 points..." (6h ago)
...
```

#### Section 5: Price Moves
```
OVERNIGHT PRICE MOVES:
BZ=F (Brent Crude): $72.30, -1.80% [SIGNIFICANT MOVE — BUY signal]
ZW=F (Wheat CBOT): 553.25c, +2.10% [SIGNIFICANT MOVE — URGENT signal]
GC=F (Gold): $2,024, +0.40% [MINOR MOVE]
...
```

#### Section 6: Persona-Specific Instructions
Each persona has tailored instructions:

**General (UK business owner/CFO):**
```
Focus on: energy costs (diesel, gas), FX impact on imported goods, freight cost changes.
Express impacts in £ terms where possible. Use plain English — avoid jargon.
Your reader is a non-specialist who needs to make 1–3 decisions before 09:00.
Do NOT include technical analysis, chart patterns, or trading terminology.
```

**Trader:**
```
Focus on: specific price levels, momentum signals, key technical levels, volume/open interest.
Cite prices to 2 decimal places. Include basis relationships where relevant.
Use commodity trading terminology. Note options expiry dates and roll periods.
```

**Agri:**
```
Focus on: grain procurement costs, fertilizer feedstocks, UK domestic vs. global price spreads.
Address harvest risk, planting economics, and any Black Sea supply route disruptions.
Convert CBOT cents/bushel to £/tonne where actionable.
```

**Logistics:**
```
Focus on: BDI (Baltic Dry Index), SCFI (container rates), bunker/fuel costs.
Address Red Sea routing, Suez Canal congestion, Panama Canal water levels.
Express freight rate impacts in $/TEU or £/tonne.
```

**Analyst:**
```
Focus on: all sectors with full citable evidence. Format for client-ready reports.
Include source names and publication times. Note confidence levels.
Flag where evidence is thin or contradictory.
```

#### Section 7: Output Schema
```
Return ONLY valid JSON matching this exact schema:
{
  "top_decision": {
    "signal": "BUY|HOLD|WATCH|URGENT",
    "headline": "string — imperative sentence",
    "deadline": "string — e.g. 'Today — before European close'",
    "market": "string — e.g. 'Energy / Diesel'",
    "gbp_impact": "string — e.g. '£12,000 savings on 500t contract'",
    "rationale": "string — 2–3 sentences",
    "confidence": "HIGH|MEDIUM|LOW"
  },
  "narrative": "string — 3–5 sentence situation summary",
  "three_things": [
    { "title": "string", "body": "string — 2–3 sentences" }
  ],
  "compounding_risk": "string or null — only if 2+ sectors simultaneously adverse",
  "geopolitical_context": "string",
  "procurement_actions": ["string", "string", "string"],
  "market_outlook": "string — what to watch 07:00–17:00 GMT",
  "action_rationale": { "sector_id": "string" },
  "sector_news_digest": { "sector_id": [{ "headline": "string", "source": "string", "url": "string" }] },
  "sector_forward_outlook": { "sector_id": "string" }
}
```

### Fallback Mode

If `OPENAI_API_KEY` is not configured as an edge function secret, the function returns a template brief using the market data only (no AI narrative). This allows the dashboard to function without an OpenAI key configured.

### Calling Convention

Single persona:
```
POST /functions/v1/ai-brief
Authorization: Bearer <ANON_KEY>
Content-Type: application/json

{ "persona": "trader" }

→ 200: { brief_date, persona, narrative, three_things, top_decision, ... }
→ 200: { cached: true, brief: {...} }  (if already generated today)
```

All personas (pipeline mode):
```
POST /functions/v1/ai-brief
Authorization: Bearer <ANON_KEY>
Content-Type: application/json

{ "all_personas": true, "force": true }

→ 200: { all_personas: true, results: { general: {...}, trader: {...}, ... } }
```

---

## `overnight-pipeline`

**File:** `supabase/functions/overnight-pipeline/index.ts`

**Purpose:** Orchestrates the complete overnight ETL: fetches feeds, generates briefs, sends emails. Acts as a coordinator — it calls the other three functions in sequence.

### Time Window Guard

By default, the pipeline only executes if the current UTC hour is between 06 and 07 (inclusive). Outside this window, it returns immediately with a skip message:

```json
{
  "skipped": true,
  "reason": "Pipeline only runs 06:00–08:00 UTC. Current UTC hour: 14. Pass { force: true } to override."
}
```

This prevents accidental double-runs and email sends outside the intended delivery window.

### Pipeline Steps

#### Step 1: market-feeds
- Calls `market-feeds` edge function via internal HTTP
- Passes result to Step 2 as pre-fetched feed data
- Logs: `{ step: "market-feeds", status: "ok"|"error", detail, duration_ms }`

#### Step 2: ai-brief
- Calls `ai-brief` with `{ all_personas: true, feeds: <step1 result>, force: <optional> }`
- If a brief already exists for today and `force` is not set, this step is logged as `"skipped"`
- Logs: `{ step: "ai-brief", status: "ok"|"error"|"skipped", detail: "5 personas generated", duration_ms }`

#### Step 3: send-morning-brief
- Calls `send-morning-brief` with `{ action: "send_now" }`
- Always runs regardless of whether brief was generated or skipped
- Logs: `{ step: "send-morning-brief", status: "ok"|"error", detail: "Sent 3 email(s)", duration_ms }`

#### Step 4: persist logs
- Inserts a row to `pipeline_runs` with `run_date`, `triggered_at`, `total_duration_ms`, `logs`, `forced`
- Failure to insert does not cause the pipeline to error (fire-and-forget)

### Response

```json
{
  "success": true,
  "run_date": "2026-03-15",
  "total_duration_ms": 52341,
  "logs": [
    { "step": "market-feeds", "status": "ok", "detail": "Market data fetched successfully", "duration_ms": 3421 },
    { "step": "ai-brief", "status": "ok", "detail": "Persona briefs generated: 5 personas", "duration_ms": 47832 },
    { "step": "send-morning-brief", "status": "ok", "detail": "Sent 1 email(s), failed 0", "duration_ms": 1204 }
  ]
}
```

HTTP status is `200` if all steps succeed, `207` if any step errored (partial success).

### Calling Convention

Normal (runs only if in 06:00–08:00 UTC window):
```
POST /functions/v1/overnight-pipeline
Authorization: Bearer <ANON_KEY>
Content-Type: application/json
{}
```

Force execution regardless of time or existing brief:
```
POST /functions/v1/overnight-pipeline
Authorization: Bearer <ANON_KEY>
Content-Type: application/json
{ "force": true }
```

### Scheduled Invocation

The pipeline is triggered by a `pg_cron` job created in migration `20260314150631`:

```sql
SELECT cron.schedule(
  'overnight-pipeline',
  '30 4 * * *',  -- 04:30 UTC daily
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/overnight-pipeline',
      headers := '{"Authorization": "Bearer ' || current_setting('app.supabase_anon_key') || '", "Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);
```

The cron fires at 04:30 UTC, but the pipeline itself only executes if the UTC hour check passes (06:00–08:00). This allows the cron to fire a safety margin ahead without the pipeline doing work early.

---

## `send-morning-brief`

**File:** `supabase/functions/send-morning-brief/index.ts`

**Purpose:** Manages email subscriptions and sends HTML-formatted morning briefs via the Resend API.

### Actions

The function is multi-purpose, dispatching on the `action` field in the request body.

#### `subscribe`

Adds or reactivates an email subscription.

```json
{ "action": "subscribe", "email": "jane@example.com", "name": "Jane Smith", "persona": "logistics" }
```

- Upserts a row to `email_subscriptions`
- On conflict (same email): updates `active=true`, `persona=X`, `name=X`
- Returns: `{ success: true, message: "Subscribed successfully" }`

#### `unsubscribe`

Deactivates a subscription via token (used in email unsubscribe links).

```json
{ "action": "unsubscribe", "token": "uuid-from-email" }
```

- Updates `email_subscriptions SET active=false WHERE unsubscribe_token = $token`
- Returns: `{ success: true, message: "Unsubscribed successfully" }`

#### `preview`

Returns the rendered email HTML/text without sending. Useful for debugging.

```json
{ "action": "preview", "persona": "general" }
```

- Loads today's brief for the specified persona
- Renders `buildHtmlEmail()` and `buildTextEmail()`
- Returns: `{ html: "...", text: "...", subject: "..." }`

#### `send_now`

Sends today's brief to all active, confirmed subscribers.

```json
{ "action": "send_now" }
```

Execution:
1. Load all active subscribers from `email_subscriptions`
2. Group by persona
3. For each persona group:
   - Load `daily_brief` for today + this persona
   - If no brief exists, skip this persona group with a warning
4. For each subscriber:
   - Render `buildHtmlEmail(brief, subscriber)`
   - Render `buildTextEmail(brief, subscriber)`
   - POST to Resend API
   - On success: update `last_sent_at` in `email_subscriptions`
5. Return `{ sent: N, failed: M, errors: [...] }`

### Email Rendering

#### `buildHtmlEmail(brief, subscriber, persona)`

Generates a fully self-contained dark-theme HTML email (no external CSS dependencies).

**Structure:**
1. **Header band** — Persona-specific accent colour (amber for General, blue for Trader, green for Agri, slate for Logistics, purple for Analyst)
2. **Date line** — "Monday 15 March 2026 · Before London Open"
3. **Top Decision hero block** — Signal badge (BUY/ACT/WATCH/HOLD), headline, deadline, £ impact
4. **Compounding Risk alert** (only if `compounding_risk` is populated) — amber warning banner
5. **Narrative section** — 3–5 sentence situation summary; geopolitical context sidebar
6. **Price Snapshot table** — Key instruments filtered by persona, with change%, signal colour
7. **Three Things** — Numbered circles (1, 2, 3) with titles and body text
8. **Sector Intelligence table** — Per-sector: analysis paragraph, cited headlines, forward outlook
9. **Procurement Actions list** — Numbered action items
10. **Market Outlook** — What to watch during 07:00–17:00 GMT
11. **CTA button** — "View live dashboard →"
12. **Disclaimer** — Standard financial disclaimer
13. **Footer** — DawnSignal branding, unsubscribe link, persona tag

**Persona accent colours:**
| Persona | Header colour |
|---------|-------------|
| general | Amber (#D97706) |
| trader | Blue (#2563EB) |
| agri | Green (#16A34A) |
| logistics | Slate (#475569) |
| analyst | Teal (#0F766E) |

#### `buildTextEmail(brief, subscriber)`

Plain-text fallback with equivalent content, formatted with Markdown-style conventions (e.g., `## Section Name`, `---` separators, `* bullet points`).

### Email Headers

```
Subject: [BUY] Lock in diesel before Friday — DawnSignal
From: DawnSignal <onboarding@resend.dev>
To: Jane Smith <jane@example.com>
Reply-To: hello@dawnsignal.co.uk
X-Persona: logistics
```

Subject line format: `[{SIGNAL}] {headline} — DawnSignal`

Where `{SIGNAL}` comes from `top_decision.signal` and `{headline}` is the imperative headline from `top_decision.headline`.

### Calling Convention

```
POST /functions/v1/send-morning-brief
Authorization: Bearer <ANON_KEY>
Content-Type: application/json

{ "action": "send_now" }

→ 200: { sent: 3, failed: 0, errors: [] }
→ 207: { sent: 2, failed: 1, errors: ["Failed to send to test@example.com: Invalid email"] }
```

### Required Secrets

| Secret | Description |
|--------|-----------|
| `RESEND_API_KEY` | Resend API key for email delivery |
| `SUPABASE_URL` | Auto-populated by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-populated by Supabase |

---

## Common Patterns Across All Functions

### CORS Headers

All functions include:
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
```

### Error Handling

All functions are wrapped in `try/catch`. Errors are returned as structured JSON with appropriate HTTP status codes (400, 500). The pipeline function collects per-step errors in a `logs` array rather than failing the entire run.

### Internal Function Calls

The pipeline calls other functions via HTTP internally:
```typescript
async function callFunction(baseUrl, anonKey, slug, body?) {
  const res = await fetch(`${baseUrl}/functions/v1/${slug}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { ok: res.ok, data: await res.json(), status: res.status };
}
```

### Environment Variables

All functions use `Deno.env.get()` to access secrets:
- `SUPABASE_URL` — Auto-populated
- `SUPABASE_ANON_KEY` — Auto-populated
- `SUPABASE_SERVICE_ROLE_KEY` — Auto-populated
- `OPENAI_API_KEY` — Must be set via Supabase dashboard / secrets
- `RESEND_API_KEY` — Must be set via Supabase dashboard / secrets
