# Database

DawnSignal uses Supabase (PostgreSQL) as its primary data store. All tables have Row Level Security (RLS) enabled. The frontend accesses the database exclusively via the anon key; the service role key is only available to edge functions.

---

## Tables Overview

| Table | Purpose | Access |
|-------|---------|--------|
| `feed_cache` | Latest market-feeds payload | anon read/write |
| `user_settings` | Per-session timezone preference | session-scoped read/write |
| `daily_brief` | AI-generated briefs (one per date per persona) | anon read; service-role write |
| `email_subscriptions` | Newsletter subscriber list | anon insert/unsubscribe |
| `pipeline_runs` | Overnight pipeline execution logs | service-role only |
| `action_completions` | User-completed action items (per session) | session-scoped read/write |
| `commodity_percentiles` | 10-year price percentile reference data | anon read |
| `commodity_seasonal_patterns` | Monthly seasonal demand pressure | anon read |
| `conflict_zone_baselines` | Historical conflict intensity baselines | anon read |

---

## Detailed Schema

### `feed_cache`

Stores the latest response from the `market-feeds` edge function. There is only ever one row — it is replaced on each pipeline run.

```sql
CREATE TABLE IF NOT EXISTS feed_cache (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  fetched_at  timestamptz NOT NULL DEFAULT now(),
  payload     jsonb       NOT NULL
);
```

**RLS Policies:**
- `anon` and `authenticated` can SELECT (read latest feed)
- `anon` and `authenticated` can INSERT (frontend caches feed after fetching)

**Usage:** After `useMarketFeeds` calls the edge function, it inserts the result here so future loads can check for cached data. The pipeline also populates this as part of step 1.

---

### `user_settings`

Stores per-browser-session user preferences. No authentication required.

```sql
CREATE TABLE IF NOT EXISTS user_settings (
  session_id  text        PRIMARY KEY,
  timezone    text        NOT NULL DEFAULT 'Europe/London',
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```

**RLS Policies:**
- `anon` can SELECT where `session_id = current_setting('request.jwt.claims', true)::json->>'sub'` — or more precisely, the session ID is passed via a direct `.eq('session_id', sessionId)` query from the frontend using the anon key.
- `anon` can INSERT and UPDATE their own session row.

**Session ID:** Generated as a UUID (`crypto.randomUUID()`) and stored in `localStorage` under `"dawnsignal_session_id"`. Consistent across page reloads within the same browser.

---

### `daily_brief`

The central table. Stores AI-generated morning briefs, one per date per persona.

```sql
CREATE TABLE IF NOT EXISTS daily_brief (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_date           date        NOT NULL,
  persona              text        NOT NULL DEFAULT 'general'
                                   CHECK (persona IN ('general','trader','agri','logistics','analyst')),
  generated_at         timestamptz NOT NULL DEFAULT now(),
  model                text,
  prompt_tokens        integer,
  completion_tokens    integer,
  narrative            text,
  three_things         jsonb,        -- array of {title, body}
  action_rationale     jsonb,        -- map of sector_id → narrative string
  geopolitical_context text,
  price_snapshot       jsonb,        -- array of {symbol, name, price, change_pct, signal, currency, unit}
  procurement_actions  text[],       -- array of actionable recommendation strings
  market_outlook       text,         -- what to watch 07:00–17:00 GMT
  sector_news_digest   jsonb,        -- map of sector_id → [{headline, source, url, published_at}]
  sector_forward_outlook jsonb,      -- map of sector_id → "1–2 sentence outlook"
  compounding_risk     text,         -- cross-sector amplification narrative (null if no compounding)
  top_decision         jsonb,        -- {signal, headline, deadline, market, gbp_impact, rationale, confidence}
  UNIQUE (brief_date, persona)
);
```

**`top_decision` JSON shape:**
```json
{
  "signal": "BUY",
  "headline": "Lock in diesel contracts before Friday close",
  "deadline": "Today — before European close",
  "market": "Energy / Diesel",
  "gbp_impact": "£12,000–£18,000 savings on 500t annual contract",
  "rationale": "Brent has retraced 2.1% overnight ...",
  "confidence": "HIGH"
}
```

**`three_things` JSON shape:**
```json
[
  { "title": "Brent softens on demand outlook", "body": "Crude fell 1.8% overnight ..." },
  { "title": "Sterling at 3-month low", "body": "GBP/USD dropped to 1.263 ..." },
  { "title": "Black Sea grain corridor under pressure", "body": "..." }
]
```

**RLS Policies:**
- `anon` and `authenticated` can SELECT (read briefs publicly)
- No public INSERT/UPDATE — only the service role key (used by edge functions) can write.

---

### `email_subscriptions`

Manages the newsletter subscriber list.

```sql
CREATE TABLE IF NOT EXISTS email_subscriptions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email               text        UNIQUE NOT NULL,
  name                text,
  persona             text        NOT NULL DEFAULT 'general'
                                  CHECK (persona IN ('general','trader','agri','logistics','analyst')),
  active              boolean     NOT NULL DEFAULT true,
  confirmed           boolean     NOT NULL DEFAULT false,
  send_hour_utc       integer     NOT NULL DEFAULT 6
                                  CHECK (send_hour_utc BETWEEN 0 AND 23),
  unsubscribe_token   uuid        NOT NULL DEFAULT gen_random_uuid(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  last_sent_at        timestamptz
);
```

**RLS Policies:**
- `anon` can INSERT (subscribe — one row per email, upsert on conflict)
- `anon` can UPDATE where `unsubscribe_token = $token` — used for the email unsubscribe link (sets `active=false`)
- No public SELECT — subscriber emails are not exposed to the frontend

**Notes:**
- `confirmed` is present for future double opt-in support. Currently not enforced — all inserts are treated as confirmed.
- `send_hour_utc` defaults to 6 (06:00 UTC). The pipeline ignores this and sends to everyone on its schedule.
- `unsubscribe_token` is a UUID appended to the unsubscribe link in every email: `/?unsubscribe={token}`.

---

### `pipeline_runs`

Audit log of every execution of the overnight pipeline.

```sql
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date          date        NOT NULL,
  triggered_at      timestamptz NOT NULL DEFAULT now(),
  total_duration_ms integer,
  logs              jsonb,      -- array of {step, status, detail, duration_ms}
  forced            boolean     NOT NULL DEFAULT false
);
```

**`logs` JSON shape:**
```json
[
  { "step": "market-feeds", "status": "ok", "detail": "Market data fetched successfully", "duration_ms": 3421 },
  { "step": "ai-brief", "status": "ok", "detail": "Persona briefs generated: 5 personas", "duration_ms": 47832 },
  { "step": "send-morning-brief", "status": "ok", "detail": "Sent 3 email(s), failed 0", "duration_ms": 1204 }
]
```

**`status` values:** `"ok"` | `"error"` | `"skipped"`

**RLS Policies:**
- No public access. Only the service role key can read/write.
- The `AgentRunHistory` component uses the service role (via edge function) to fetch recent runs for the Diagnostics page.

---

### `action_completions`

Tracks which action items a user has marked complete during a session.

```sql
CREATE TABLE IF NOT EXISTS action_completions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      text        NOT NULL,
  action_id       text        NOT NULL,
  completed_date  date        NOT NULL DEFAULT CURRENT_DATE,
  completed_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, action_id, completed_date)
);

CREATE INDEX IF NOT EXISTS action_completions_session_date_idx
  ON action_completions (session_id, completed_date);
```

**RLS Policies:**
- `anon` can INSERT own session's completions
- `anon` can SELECT own session's completions (`WHERE session_id = :sessionId`)
- `anon` can DELETE own session's completions (for "undo" / clear day)

---

### `commodity_percentiles`

Historical 10-year price percentile bands, used to put current prices in context.

```sql
CREATE TABLE IF NOT EXISTS commodity_percentiles (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity_id    text    NOT NULL,        -- "brent_crude", "wheat_cbot", "natural_gas", etc.
  display_name    text    NOT NULL,
  lookback_years  integer NOT NULL DEFAULT 10,
  p10             numeric NOT NULL,        -- 10th percentile (price level)
  p25             numeric NOT NULL,
  p50             numeric NOT NULL,        -- Median
  p75             numeric NOT NULL,
  p90             numeric NOT NULL,        -- 90th percentile
  currency        text    NOT NULL DEFAULT 'USD',
  unit            text    NOT NULL,        -- "bbl", "bu", "MMBtu", etc.
  data_source     text,                   -- "World Bank Pink Sheet", "EIA", etc.
  last_updated    date    NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (commodity_id, lookback_years)
);
```

**Pre-seeded commodities:**

| commodity_id | Display Name | p10 | p50 | p90 | Unit |
|-------------|-------------|-----|-----|-----|------|
| `brent_crude` | Brent Crude Oil | 40.00 | 72.00 | 105.00 | bbl |
| `wheat_cbot` | CBOT Wheat | 450.00 | 560.00 | 750.00 | bu |
| `corn_cbot` | CBOT Corn | 350.00 | 450.00 | 620.00 | bu |
| `natural_gas` | Natural Gas (Henry Hub) | 2.00 | 3.50 | 6.50 | MMBtu |
| `copper_comex` | COMEX Copper | 2.50 | 3.80 | 4.80 | lb |
| `gold_comex` | COMEX Gold | 1200.00 | 1750.00 | 2200.00 | oz |
| `usd_gbp` | USD/GBP Exchange Rate | 0.72 | 0.79 | 0.86 | GBP per USD |

**RLS Policies:**
- `anon` and `authenticated` can SELECT (public reference data)
- No public INSERT/UPDATE

---

### `commodity_seasonal_patterns`

Monthly seasonal demand pressure indices. Each row is a commodity × month combination.

```sql
CREATE TABLE IF NOT EXISTS commodity_seasonal_patterns (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity_id    text    NOT NULL,
  month           integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  seasonal_index  numeric NOT NULL,      -- 1.0 = average; >1.0 = above average demand
  pressure_label  text    NOT NULL       -- 'HIGH' | 'MODERATE' | 'NORMAL' | 'LOW'
                          CHECK (pressure_label IN ('HIGH','MODERATE','NORMAL','LOW')),
  notes           text,
  UNIQUE (commodity_id, month)
);
```

**Seasonal Index Interpretation:**
- `>1.15` → `HIGH` pressure (e.g., Northern Hemisphere winter for natural gas)
- `1.05–1.14` → `MODERATE`
- `0.95–1.04` → `NORMAL`
- `<0.95` → `LOW`

**Usage:** The `useHistoricalContext` hook loads all patterns. `feedDerived.buildSeasonalContext(symbol, seasonal)` maps the current month's index to a `SeasonalContext` object attached to each `MarketItem`. Displayed in the `PriceRangeChart` component.

---

### `conflict_zone_baselines`

Historical conflict intensity baselines for the six monitored zones.

```sql
CREATE TABLE IF NOT EXISTS conflict_zone_baselines (
  id                          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id                     text    UNIQUE NOT NULL,  -- "red-sea-yemen", "ukraine-black-sea", etc.
  zone_name                   text    NOT NULL,
  baseline_frequency          numeric NOT NULL,          -- avg events per 7-day window historically
  elevated_threshold          numeric NOT NULL,          -- event count that triggers "ELEVATED"
  high_threshold              numeric NOT NULL,          -- event count that triggers "HIGH"
  critical_threshold          numeric NOT NULL,          -- event count that triggers "CRITICAL"
  typical_commodity_impact_pct numeric,                  -- % commodity move historically associated
  top_comparable_event        text,                     -- "2015: Saudi Aramco pipeline attack"
  data_source                 text,
  last_updated                date    NOT NULL DEFAULT CURRENT_DATE
);
```

**Pre-seeded zones:**

| zone_id | Baseline Freq | Elevated | High | Critical |
|---------|--------------|----------|------|----------|
| `red-sea-yemen` | 2.0 | 4.0 | 7.0 | 12.0 |
| `ukraine-black-sea` | 3.0 | 6.0 | 10.0 | 16.0 |
| `middle-east-gulf` | 1.5 | 3.0 | 6.0 | 10.0 |
| `sahel-west-africa` | 1.0 | 2.5 | 4.0 | 7.0 |
| `israel-gaza` | 2.5 | 5.0 | 8.0 | 14.0 |
| `taiwan-strait` | 0.5 | 1.5 | 3.0 | 6.0 |

**Usage:** `deriveConflictZones()` in `feedDerived.ts` counts keyword-matching news items in the last 24h and compares to these thresholds to set the `ConflictZone.riskLevel`. The `ConflictIntensity.vsBaseline` string (e.g., "+50% vs norm") is computed from `baseline_frequency`.

---

## RLS Policy Summary

| Table | anon SELECT | anon INSERT | anon UPDATE | service_role |
|-------|------------|------------|------------|--------------|
| `feed_cache` | All rows | Yes | No | Full |
| `user_settings` | Own session | Yes | Own session | Full |
| `daily_brief` | All rows | No | No | Full |
| `email_subscriptions` | No | Yes (own email) | Via unsubscribe token | Full |
| `pipeline_runs` | No | No | No | Full |
| `action_completions` | Own session | Own session | No | Full |
| `commodity_percentiles` | All rows | No | No | Full |
| `commodity_seasonal_patterns` | All rows | No | No | Full |
| `conflict_zone_baselines` | All rows | No | No | Full |

---

## Migration History

Migrations are applied in chronological order. Each file is named with a UTC timestamp prefix.

### `20260314112713_create_feed_cache.sql`
Creates the `feed_cache` table with anon read/write RLS policies. First migration — establishes the basic caching layer.

### `20260314120224_create_user_settings.sql`
Creates `user_settings` for session-based timezone persistence. Adds policies allowing anon users to read and write their own session row.

### `20260314131152_allow_anon_insert_feed_cache.sql`
Adds an explicit INSERT policy to `feed_cache` for the anon role. Necessary because the frontend caches feed results directly from the browser.

### `20260314144412_create_daily_brief.sql`
Creates the `daily_brief` table with initial columns: `brief_date`, `narrative`, `three_things`, `action_rationale`, `geopolitical_context`, `model`, `prompt_tokens`, `completion_tokens`. Unique constraint on `brief_date` (single brief per day, pre-persona).

### `20260314145940_create_email_subscriptions.sql`
Creates `email_subscriptions` with `email`, `name`, `active`, `confirmed`, `send_hour_utc`, `unsubscribe_token`. Adds anon INSERT policy (subscribe) and anon UPDATE policy (unsubscribe via token).

### `20260314150631_create_pipeline_runs_and_cron.sql`
Creates `pipeline_runs` table. Also schedules `pg_cron` job at `04:30 UTC` to call the `overnight-pipeline` edge function via HTTP.

### `20260315003510_create_historical_context_tables.sql`
Creates three reference tables: `commodity_percentiles`, `commodity_seasonal_patterns`, `conflict_zone_baselines`. Seeds all three with baseline data covering 7 commodities, 12 months × 7 seasonal patterns, and 6 conflict zones. Adds read-only RLS policies for anon access.

### `20260315031021_fix_security_issues.sql`
Security hardening migration:
- Removes overly-permissive policies that used `USING (true)`
- Adds email format validation constraint to `email_subscriptions`
- Adds payload size limit to `feed_cache` (prevents oversized JSON injection)
- Tightens `user_settings` policies to require session_id header
- Adds index on `email_subscriptions(active)` for efficient query filtering

### `20260315034432_create_action_completions.sql`
Creates `action_completions` for tracking user-completed action items per session per day. Adds composite unique constraint on `(session_id, action_id, completed_date)`. Creates index for efficient per-session queries.

### `20260315045553_add_persona_to_email_subscriptions.sql`
Adds `persona` column to `email_subscriptions` with CHECK constraint. Defaults to `'general'`. Allows each subscriber to receive a brief tailored to their role.

### `20260315052405_add_price_snapshot_to_daily_brief.sql`
Adds `price_snapshot` (jsonb) to `daily_brief`. The AI brief generator now includes a structured price table in the brief record, making emails self-contained (no need to re-fetch live prices for email rendering).

### `20260315060254_add_procurement_actions_market_outlook_to_daily_brief.sql`
Adds `procurement_actions` (text array) and `market_outlook` (text) to `daily_brief`. These are generated by GPT-4o and represent specific actionable recommendations and a forward-looking watch list for the trading day.

### `20260315060743_add_sector_news_digest_and_forward_outlook.sql`
Adds `sector_news_digest` (jsonb) and `sector_forward_outlook` (jsonb) to `daily_brief`. Per-sector news citations and directional outlooks are now part of the stored brief, enabling the sector intelligence table in both the dashboard and emails.

### `20260315061609_add_persona_to_daily_brief.sql`
Adds `persona` column to `daily_brief`. Changes the unique constraint from `brief_date` alone to `(brief_date, persona)`. This enables storing 5 separate AI-generated briefs per day — one per persona — without conflicts.

### `20260315061905_add_compounding_risk_to_daily_brief.sql`
Adds `compounding_risk` (text) to `daily_brief`. This field is only populated when GPT-4o determines that 2+ sectors are simultaneously adverse, amplifying each other's effects. Used in the email as a highlighted alert block.

### `20260315063503_add_top_decision_to_daily_brief.sql`
Adds `top_decision` (jsonb) to `daily_brief`. This is the single most important structured recommendation in the brief — surfaced as the hero block in both the dashboard and email. Contains `signal`, `headline`, `deadline`, `market`, `gbp_impact`, `rationale`, and `confidence`.

---

## Querying Examples

### Get today's brief for a persona
```sql
SELECT narrative, three_things, top_decision, procurement_actions
FROM daily_brief
WHERE brief_date = CURRENT_DATE
  AND persona = 'general';
```

### Get current price percentile ranking for Brent
```sql
SELECT p10, p25, p50, p75, p90
FROM commodity_percentiles
WHERE commodity_id = 'brent_crude'
  AND lookback_years = 10;
```

### Get seasonal pressure for wheat in current month
```sql
SELECT seasonal_index, pressure_label, notes
FROM commodity_seasonal_patterns
WHERE commodity_id = 'wheat_cbot'
  AND month = EXTRACT(MONTH FROM CURRENT_DATE);
```

### Get latest pipeline run
```sql
SELECT run_date, triggered_at, total_duration_ms, logs, forced
FROM pipeline_runs
ORDER BY triggered_at DESC
LIMIT 1;
```

### Count active email subscribers by persona
```sql
SELECT persona, COUNT(*) as subscribers
FROM email_subscriptions
WHERE active = true
GROUP BY persona
ORDER BY subscribers DESC;
```
