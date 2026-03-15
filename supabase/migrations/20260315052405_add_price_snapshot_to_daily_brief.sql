/*
  # Add price_snapshot column to daily_brief

  ## Summary
  Adds a JSONB column `price_snapshot` to the `daily_brief` table to store
  the key market price data at time of brief generation.

  This allows the email function to include actual price numbers directly in
  the email body without needing to re-fetch live data, making each email
  a self-contained intelligence record.

  ## Changes
  - `daily_brief`: adds `price_snapshot` (jsonb, nullable) — stores array of
    { label, price, change_pct, currency } objects for the top instruments
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_brief' AND column_name = 'price_snapshot'
  ) THEN
    ALTER TABLE daily_brief ADD COLUMN price_snapshot jsonb;
  END IF;
END $$;
