/*
  # Add admin UPDATE policy for feed_cache

  ## Summary
  Allows authenticated users with the admin role (app_metadata.role = 'admin')
  to update the feed_cache payload — specifically to surgically remove stories
  via JSONB manipulation in the delete-story edge function.

  ## Security Changes
  - New UPDATE policy on feed_cache restricted to admin role only
  - Uses auth.jwt() to check app_metadata.role = 'admin'
*/

CREATE POLICY "Admin can update feed cache"
  ON public.feed_cache
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    payload IS NOT NULL
    AND fetched_at IS NOT NULL
  );
