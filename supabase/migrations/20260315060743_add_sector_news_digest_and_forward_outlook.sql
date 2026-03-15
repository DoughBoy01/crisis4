/*
  # Add sector_news_digest and sector_forward_outlook to daily_brief

  1. Changes
    - `daily_brief` table
      - Add `sector_news_digest` (jsonb) — per-sector array of cited news headlines that drove the analysis
      - Add `sector_forward_outlook` (jsonb) — per-sector 1-2 sentence directional outlook for next 2-5 days

  2. Notes
    - Both columns are nullable so existing rows are unaffected
    - No RLS changes needed (existing policies cover these columns)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_brief' AND column_name = 'sector_news_digest'
  ) THEN
    ALTER TABLE daily_brief ADD COLUMN sector_news_digest jsonb DEFAULT '{}';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_brief' AND column_name = 'sector_forward_outlook'
  ) THEN
    ALTER TABLE daily_brief ADD COLUMN sector_forward_outlook jsonb DEFAULT '{}';
  END IF;
END $$;
