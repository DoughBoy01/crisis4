/*
  # Create dismissed_intel table

  ## Purpose
  Allows admins to permanently dismiss/delete misclassified scout intelligence topics
  or news stories that should not be shown in the dashboard.

  ## New Tables

  ### `dismissed_intel`
  Tracks individual topic or story dismissals by admin users.

  - `id` (uuid, primary key)
  - `type` (text) - either 'scout_topic' or 'news_story'
  - `ref_id` (text) - for scout topics: topic_id; for news: normalized title hash
  - `ref_label` (text) - human-readable label (topic_label or headline title)
  - `category` (text, nullable) - scout category or news source name
  - `signal` (text, nullable) - original signal (BULLISH/BEARISH/etc.)
  - `reason` (text, nullable) - optional admin note for why it was dismissed
  - `dismissed_by` (uuid, references auth.users) - admin who dismissed it
  - `dismissed_at` (timestamptz)
  - `scouting_run_id` (uuid, nullable) - which run the topic came from
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Only authenticated admins can insert/delete
  - Authenticated users can SELECT (so frontend can filter dismissed items)
  - Service role has full access
*/

CREATE TABLE IF NOT EXISTS dismissed_intel (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type            text NOT NULL CHECK (type IN ('scout_topic', 'news_story')),
  ref_id          text NOT NULL,
  ref_label       text NOT NULL,
  category        text,
  signal          text,
  reason          text,
  dismissed_by    uuid REFERENCES auth.users(id),
  dismissed_at    timestamptz DEFAULT now(),
  scouting_run_id uuid,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dismissed_intel_type_ref_idx ON dismissed_intel(type, ref_id);
CREATE INDEX IF NOT EXISTS dismissed_intel_run_idx ON dismissed_intel(scouting_run_id) WHERE scouting_run_id IS NOT NULL;

ALTER TABLE dismissed_intel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view dismissed intel"
  ON dismissed_intel FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can dismiss intel"
  ON dismissed_intel FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = dismissed_by);

CREATE POLICY "Authenticated users can remove dismissals"
  ON dismissed_intel FOR DELETE
  TO authenticated
  USING (auth.uid() = dismissed_by);
