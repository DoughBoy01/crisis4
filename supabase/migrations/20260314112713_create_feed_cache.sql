/*
  # Create feed_cache table

  Stores the latest result from the market-feeds edge function so the
  frontend can show "last fetched" metadata and avoid redundant calls.

  ## New Tables
  - `feed_cache`
    - `id` (uuid, pk)
    - `fetched_at` (timestamptz) — when the edge function ran
    - `payload` (jsonb) — full JSON response from the function
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Authenticated users can SELECT (read cached feeds)
  - No direct INSERT/UPDATE/DELETE from the client — writes go through
    the service role inside the edge function
*/

CREATE TABLE IF NOT EXISTS feed_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fetched_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE feed_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read feed cache"
  ON feed_cache
  FOR SELECT
  TO anon, authenticated
  USING (true);
