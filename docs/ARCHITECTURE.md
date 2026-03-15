# Architecture

DawnSignal is built as a serverless, edge-first intelligence platform. The design prioritises low-latency data delivery, AI-generated narrative at the edge, and a stateless frontend that derives most of its intelligence client-side from live feeds.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  EXTERNAL DATA SOURCES (22 total)                                   │
│  Stooq/Yahoo Finance · EIA · ExchangeRate.host · 19 RSS feeds      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTP (fetch)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SUPABASE EDGE FUNCTIONS (Deno runtime)                             │
│                                                                     │
│  market-feeds ──→ ai-brief ──→ overnight-pipeline ──→ send-morning-brief │
│       │              │                                    │         │
│       │         OpenAI GPT-4o                       Resend API     │
└───────┼──────────────┼────────────────────────────────────┼─────────┘
        │              │                                    │
        ▼              ▼                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SUPABASE POSTGRESQL DATABASE                                       │
│                                                                     │
│  feed_cache · daily_brief · email_subscriptions · pipeline_runs    │
│  user_settings · action_completions · commodity_percentiles        │
│  commodity_seasonal_patterns · conflict_zone_baselines             │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ Supabase JS client (RLS enforced)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  REACT FRONTEND (Vite + TypeScript)                                 │
│                                                                     │
│  useMarketFeeds ─────────────→ feedDerived library                 │
│  useDailyBrief                  ├─ deriveMarketItems               │
│  useHistoricalContext           ├─ deriveActionItems               │
│  useUserSettings                ├─ deriveMorningAlerts             │
│  useDailyDiff                   ├─ deriveConflictZones             │
│  useActionCompletions           ├─ deriveSupplyExposure            │
│                                 └─ deriveContingencyPlaybooks      │
│                                                                     │
│  Dashboard · DailyBriefPreview · ConflictRiskMap · ActionPanel     │
│  LiveNewsFeed · SupplyChainExposure · ContingencyPlaybook ...      │
└─────────────────────────────────────────────────────────────────────┘
                               │ (separate channel)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  USER'S EMAIL INBOX (HTML + plain-text)                             │
│  Rendered by send-morning-brief · Sent via Resend API              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Execution Flows

### 1. Overnight Pipeline (04:30 UTC Daily)

```
pg_cron (Supabase)
    │
    └─→ overnight-pipeline (edge function)
            │
            ├─→ market-feeds
            │       ├─ Fetch: Stooq CSV (22 tickers)
            │       ├─ Fetch: EIA Brent Crude JSON
            │       ├─ Fetch: ExchangeRate.host FX
            │       └─ Fetch: 19 RSS feeds (parallel)
            │               └─→ Returns FeedPayload
            │
            ├─→ ai-brief (with all_personas=true)
            │       ├─ Load: commodity_percentiles (DB)
            │       ├─ Load: commodity_seasonal_patterns (DB)
            │       ├─ Load: conflict_zone_baselines (DB)
            │       ├─ For each of 5 personas:
            │       │       ├─ Build prompt with context
            │       │       ├─ Call: OpenAI GPT-4o (JSON mode)
            │       │       └─ Upsert: daily_brief row
            │       └─→ Returns {results: {general:{}, trader:{}, ...}}
            │
            ├─→ send-morning-brief (action: send_now)
            │       ├─ Load: daily_brief for today (per subscriber persona)
            │       ├─ Render: HTML email (persona-themed)
            │       ├─ Render: Plain-text email
            │       ├─ Send: via Resend API
            │       └─→ Returns {sent: N, failed: M}
            │
            └─→ Insert: pipeline_runs log row
```

### 2. Frontend Page Load

```
User loads dashboard
    │
    ├─→ useMarketFeeds
    │       ├─ POST /functions/v1/market-feeds
    │       ├─ Persist result to feed_cache (Supabase)
    │       └─ Set state: data (FeedPayload)
    │
    ├─→ useHistoricalContext
    │       ├─ SELECT commodity_percentiles
    │       ├─ SELECT commodity_seasonal_patterns
    │       └─ SELECT conflict_zone_baselines
    │
    ├─→ useUserSettings
    │       ├─ Get/create session_id (localStorage)
    │       └─ SELECT/UPSERT user_settings
    │
    └─→ useDailyBrief(persona)
            ├─ SELECT daily_brief WHERE brief_date=today AND persona=X
            ├─ If found: return cached
            └─ If not: POST /functions/v1/ai-brief

Client-side derivation (no network calls):
    feedDerived(FeedPayload, HistoricalContext)
        ├─ deriveMarketItems        → MarketItem[]
        ├─ deriveActionItems        → ActionItem[]
        ├─ deriveMorningAlerts      → MorningAlert[]
        ├─ deriveConflictZones      → ConflictZone[]
        ├─ deriveSupplyExposure     → SupplyExposureItem[]
        └─ deriveContingencyPlaybooks → ContingencyScenario[]
```

### 3. Email Subscription

```
User submits email form (EmailSubscribe component)
    │
    └─→ POST /functions/v1/send-morning-brief
            body: { action: "subscribe", email, name, persona }
            │
            └─→ UPSERT email_subscriptions
                    (active=true, unsubscribe_token=uuid, persona=X)
```

---

## Key Design Decisions

### Edge-First Data Fetching

Market data is fetched and processed in edge functions rather than client-side. This keeps API keys (EIA, etc.) server-side and avoids CORS issues with financial data providers. The frontend only receives a structured `FeedPayload` JSON.

### Client-Side Intelligence Derivation

The `feedDerived.ts` library (~1,150 lines) runs entirely in the browser. All signal classification, action generation, conflict zone scoring, and playbook activation are pure functions operating on the `FeedPayload`. This means:
- No additional database queries for intelligence
- Instant recalculation when feeds refresh
- Full TypeScript type safety
- Testable without network access

### Session-Based Preferences Without Auth

Users don't need accounts. Timezone preferences are stored in `user_settings` keyed by a UUID session ID that lives in `localStorage`. This is secure enough for non-sensitive preference data and removes signup friction entirely.

### Daily Dedup for AI Briefs

The `daily_brief` table uses a `(brief_date, persona)` unique constraint. The AI is only called once per persona per day. Subsequent dashboard loads return the cached brief immediately. The pipeline's `force=true` flag bypasses this to allow re-generation.

### Persona-Specific Prompt Engineering

Each of the 5 personas has a ~500-word prompt section describing:
1. Who the user is (role, company type, risk tolerance)
2. What they care about (specific markets, horizons)
3. Tone and format requirements (plain English vs. citable data)
4. What NOT to include (avoid noise)

The same underlying market data is used for all personas; only the analytical lens changes.

### RLS-Enforced Database Access

Every table has Row Level Security enabled. The frontend only uses the anon key. Sensitive operations (pipeline execution, brief generation) use the service role key available only in edge functions. No privileged operations are exposed to the browser.

### Email as Primary Delivery Channel

The dashboard is a reference tool; email is the primary product. The morning brief email is self-contained — it does not require the user to log in. All key intelligence (top decision, price moves, sector analysis, procurement actions) is embedded directly in the email body, with the dashboard CTA for deeper exploration.

---

## Data Residency Model

| Data Type | Location | Retention |
|-----------|----------|-----------|
| Live market feeds | Edge function memory | Transient (per request) |
| Feed cache | `feed_cache` table | Replaced on each pipeline run |
| AI briefs | `daily_brief` table | One row per date per persona; no auto-deletion |
| Email subscribers | `email_subscriptions` table | Permanent (soft-delete via `active=false`) |
| Pipeline logs | `pipeline_runs` table | Permanent (manual pruning) |
| Historical context | `commodity_percentiles`, `seasonal_patterns`, `conflict_zone_baselines` | Permanent (updated via migrations) |
| Session preferences | `user_settings` + `localStorage` | Permanent in DB; browser-local for session ID |
| Action completions | `action_completions` table | Per session + date |

---

## Security Model

- **Frontend:** anon key only. RLS policies determine what is readable/writable.
- **Edge functions:** service role key used where needed (brief generation, pipeline orchestration). Never exposed to browser.
- **OpenAI API key:** stored as Supabase edge function secret. Never in client bundle.
- **Resend API key:** same — edge function secret only.
- **Email subscriptions:** unsubscribe tokens are UUIDs generated at insert time. No auth required to unsubscribe.
- **Pipeline trigger:** accessible via HTTP but guards against out-of-window execution unless `force=true`.
- **Admin access:** `pipeline_runs` table has no public read policy — only accessible via service role (Supabase dashboard or trusted edge functions).

---

## Limitations and Known Constraints

- **No real-time WebSocket feeds.** Price data is polled every 15 minutes. Not suitable for high-frequency trading decisions.
- **Stooq/Yahoo Finance data.** Stooq provides delayed data (15–20 min on some markets). Presented clearly as "delayed" in the UI.
- **GPT-4o latency.** Each brief generation takes 10–30 seconds depending on prompt length. Mitigated by the daily caching pattern (one call per persona per day at pipeline time).
- **Single Resend domain.** Email is sent from `onboarding@resend.dev` (sandbox domain). Production deployment requires a custom verified domain in Resend.
- **No user authentication.** Session IDs are UUID-based but not cryptographically bound to a user. Preferences are not portable between devices.
- **pg_cron scheduling.** The 04:30 UTC cron is defined in a migration. Adjusting the schedule requires a new migration or manual Supabase dashboard change.
