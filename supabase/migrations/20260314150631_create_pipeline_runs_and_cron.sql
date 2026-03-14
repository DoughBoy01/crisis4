/*
  # Pipeline runs table + pg_cron overnight schedule

  ## Purpose
  1. Stores a log of every overnight pipeline run (market fetch → AI brief → email send)
     so admins can see what happened and debug failures.
  2. Schedules the `overnight-pipeline` Edge Function to fire automatically at 04:30 UTC
     every day using `pg_cron` + `pg_net`.

  ## New Tables

  ### pipeline_runs
  - `id`               — uuid primary key
  - `run_date`         — date the pipeline ran for (yyyy-mm-dd)
  - `triggered_at`     — exact timestamp the run started
  - `total_duration_ms`— wall-clock time for the full pipeline in ms
  - `logs`             — JSONB array of per-step log entries (step, status, detail, duration_ms)
  - `forced`           — whether the run was manually forced outside the 04–06 UTC window
  - `created_at`       — row creation timestamp

  ## Cron Schedule
  - Fires daily at 04:30 UTC
  - Calls the `overnight-pipeline` Supabase Edge Function via HTTP (pg_net)
  - Job name: `overnight-pipeline-daily`

  ## Security
  - RLS enabled on pipeline_runs
  - No public read policy — only service_role can access logs
    (the Edge Function inserts using the service role key)
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Pipeline run logs table
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date           date NOT NULL,
  triggered_at       timestamptz NOT NULL DEFAULT now(),
  total_duration_ms  integer,
  logs               jsonb NOT NULL DEFAULT '[]'::jsonb,
  forced             boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated access — service_role only (used by the Edge Function)

-- Schedule: every day at 04:30 UTC
-- Uses pg_net to make an HTTP POST to the overnight-pipeline Edge Function.
-- The cron job is idempotent — calling it twice on the same day is safe because
-- the Edge Function checks for an existing brief before regenerating.

SELECT cron.schedule(
  'overnight-pipeline-daily',
  '30 4 * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url', true) || '/functions/v1/overnight-pipeline',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key', true)
    ),
    body    := '{"source":"cron"}'::jsonb
  );
  $$
);
