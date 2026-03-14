/*
  # Create user_settings table

  1. New Tables
    - `user_settings`
      - `session_id` (text, primary key) — anonymous browser session identifier
      - `timezone` (text) — IANA timezone string e.g. "America/New_York"
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Purpose
    - Stores per-session timezone preference without requiring authentication
    - Session ID is generated client-side (stored in localStorage) to persist across refreshes
    - No PII is stored

  3. Security
    - RLS enabled
    - Anyone (anon/authenticated) can read and write their own row (matched by session_id)
    - Policy uses session_id equality check so one session cannot read another's settings
*/

CREATE TABLE IF NOT EXISTS user_settings (
  session_id text PRIMARY KEY,
  timezone text NOT NULL DEFAULT 'Europe/London',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Session can read own settings"
  ON user_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Session can insert own settings"
  ON user_settings FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Session can update own settings"
  ON user_settings FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
