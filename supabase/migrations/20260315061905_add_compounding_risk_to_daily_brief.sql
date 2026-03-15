/*
  # Add compounding_risk column to daily_brief

  ## Summary
  Adds a new `compounding_risk` text column to the daily_brief table to store
  cross-sector compounding risk analysis. This field is populated when 2+ sectors
  are moving adversely simultaneously in ways that amplify each other for a
  specific reader persona (e.g., Brent up + GBP/USD down + freight up = compounding
  landed cost pressure for an importer).

  ## Changes
  ### Modified Tables
  - `daily_brief`
    - Add `compounding_risk` (text, default '') — cross-sector amplification narrative
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_brief' AND column_name = 'compounding_risk'
  ) THEN
    ALTER TABLE daily_brief ADD COLUMN compounding_risk text NOT NULL DEFAULT '';
  END IF;
END $$;
