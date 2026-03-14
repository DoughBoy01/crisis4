/*
  # Allow anon INSERT on feed_cache

  The feed_cache table caches the market-feeds edge function response.
  The frontend writes to it via the anon key after fetching live data.

  ## Changes
  - Add INSERT policy for anon and authenticated users so the cache can
    be populated from the browser without a service role key.

  ## Notes
  - The data is non-sensitive (public market data), matching the existing
    SELECT policy which already allows unrestricted reads.
  - No UPDATE/DELETE policies are added; old rows accumulate and can be
    pruned by a scheduled job if needed.
*/

CREATE POLICY "Anyone can insert feed cache"
  ON feed_cache
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
