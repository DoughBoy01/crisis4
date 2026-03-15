/*
  # Add persona column to daily_brief table

  ## Summary
  Changes the daily_brief table from storing one generic brief per day to storing
  one brief per persona per day. This enables persona-specific AI analysis where
  each reader role (trader, agri, logistics, analyst, general) gets a brief
  written specifically for their needs and priorities.

  ## Changes
  ### Modified Tables
  - `daily_brief`
    - Add `persona` column (text, default 'general') — identifies which audience
      this brief was written for
    - Drop the existing unique constraint on `brief_date` alone
    - Add a new unique constraint on `(brief_date, persona)` so each persona gets
      one brief per day
    - Add index on `(brief_date, persona)` for fast lookups

  ## Notes
  - Existing rows (without persona) are migrated to persona='general'
  - The old unique index on brief_date is replaced by a composite unique on (brief_date, persona)
  - RLS policies remain unchanged — same access rules apply
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_brief' AND column_name = 'persona'
  ) THEN
    ALTER TABLE daily_brief ADD COLUMN persona text NOT NULL DEFAULT 'general';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'daily_brief_brief_date_key'
  ) THEN
    ALTER TABLE daily_brief DROP CONSTRAINT daily_brief_brief_date_key;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'daily_brief_brief_date_persona_key'
  ) THEN
    ALTER TABLE daily_brief ADD CONSTRAINT daily_brief_brief_date_persona_key
      UNIQUE (brief_date, persona);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_daily_brief_date_persona
  ON daily_brief (brief_date, persona);
