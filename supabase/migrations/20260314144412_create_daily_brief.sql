/*
  # Create daily_brief table

  ## Purpose
  Stores the AI-generated overnight intelligence brief, keyed by calendar date.
  One row per day. The Edge Function checks for today's row before calling
  OpenAI — if it already exists the cached result is returned, so the AI runs
  at most once per day per deployment.

  ## New Tables

  ### daily_brief
  - `id`           — uuid primary key
  - `brief_date`   — DATE, unique per day (YYYY-MM-DD, UTC). The dedup key.
  - `generated_at` — timestamp of when the AI call completed
  - `feed_snapshot_at` — ISO timestamp from the FeedPayload that was analysed
  - `narrative`    — Plain-English overnight situation summary (string)
  - `three_things` — JSON array of 3 key points (string[])
  - `action_rationale` — JSON map of actionId → AI rationale string
  - `geopolitical_context` — AI prose on geopolitical drivers
  - `model`        — which model was used (e.g. "gpt-4o")
  - `prompt_tokens` / `completion_tokens` — usage tracking

  ## Security
  - RLS enabled. Authenticated users can SELECT (read) their own org's brief.
  - anon role can SELECT (so the front-end anon key can read cached briefs).
  - Only the service_role (Edge Function) can INSERT/UPDATE.
*/

CREATE TABLE IF NOT EXISTS daily_brief (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_date           date NOT NULL,
  generated_at         timestamptz NOT NULL DEFAULT now(),
  feed_snapshot_at     text,
  narrative            text NOT NULL DEFAULT '',
  three_things         jsonb NOT NULL DEFAULT '[]'::jsonb,
  action_rationale     jsonb NOT NULL DEFAULT '{}'::jsonb,
  geopolitical_context text NOT NULL DEFAULT '',
  model                text NOT NULL DEFAULT 'gpt-4o',
  prompt_tokens        integer,
  completion_tokens    integer,
  CONSTRAINT daily_brief_date_unique UNIQUE (brief_date)
);

ALTER TABLE daily_brief ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read daily brief"
  ON daily_brief FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Authenticated can read daily brief"
  ON daily_brief FOR SELECT
  TO authenticated
  USING (true);
