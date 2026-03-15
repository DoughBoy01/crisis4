/*
  # Allow anon SELECT on email_subscriptions

  ## Summary
  The diagnostics page needs to display subscribers by category. Previously
  only INSERT and UPDATE policies existed, so SELECT queries from the frontend
  returned empty results.

  ## Changes
  - Adds a SELECT policy for the anon role on email_subscriptions so the
    diagnostics page can read subscriber records.
*/

CREATE POLICY "Anon can read subscribers for diagnostics"
  ON email_subscriptions
  FOR SELECT
  TO anon
  USING (true);
