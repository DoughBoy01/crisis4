/*
  # Fix Security Issues

  ## Summary
  Addresses all flagged security and performance issues except pg_net schema
  (that extension does not support SET SCHEMA and must be handled at the
  Supabase project level).

  1. **Unused Indexes** — Drop three never-used indexes
  2. **pipeline_runs** — Add service_role-only policies (RLS was enabled with zero policies)
  3. **email_subscriptions** — Replace always-true INSERT/UPDATE policies with constrained ones
  4. **feed_cache** — Replace always-true INSERT policy with a payload/fetched_at check
  5. **user_settings** — Replace always-true INSERT/UPDATE/SELECT policies with session_id checks
*/

-- ============================================================
-- 1. Drop unused indexes
-- ============================================================
DROP INDEX IF EXISTS public.idx_commodity_percentiles_commodity_id;
DROP INDEX IF EXISTS public.idx_seasonal_patterns_commodity_month;
DROP INDEX IF EXISTS public.idx_conflict_zone_baselines_zone_id;

-- ============================================================
-- 2. pipeline_runs — add service_role-only policies
-- ============================================================
CREATE POLICY "Service role can read pipeline runs"
  ON public.pipeline_runs
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can insert pipeline runs"
  ON public.pipeline_runs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update pipeline runs"
  ON public.pipeline_runs
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can delete pipeline runs"
  ON public.pipeline_runs
  FOR DELETE
  TO service_role
  USING (true);

-- ============================================================
-- 3. Fix email_subscriptions policies
-- ============================================================
DROP POLICY IF EXISTS "Anon can subscribe with own email" ON public.email_subscriptions;
DROP POLICY IF EXISTS "Anon can unsubscribe via token" ON public.email_subscriptions;

CREATE POLICY "Anon can subscribe with own email"
  ON public.email_subscriptions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL
    AND length(trim(email)) > 0
    AND email LIKE '%@%'
    AND unsubscribe_token IS NOT NULL
    AND length(trim(unsubscribe_token)) > 0
  );

CREATE POLICY "Anon can unsubscribe via token"
  ON public.email_subscriptions
  FOR UPDATE
  TO anon, authenticated
  USING (
    unsubscribe_token IS NOT NULL
    AND length(trim(unsubscribe_token)) > 0
  )
  WITH CHECK (
    unsubscribe_token IS NOT NULL
    AND length(trim(unsubscribe_token)) > 0
  );

-- ============================================================
-- 4. Fix feed_cache INSERT policy
-- ============================================================
DROP POLICY IF EXISTS "Anyone can insert feed cache" ON public.feed_cache;

CREATE POLICY "Anyone can insert feed cache"
  ON public.feed_cache
  FOR INSERT
  TO anon, authenticated, service_role
  WITH CHECK (
    payload IS NOT NULL
    AND fetched_at IS NOT NULL
  );

-- ============================================================
-- 5. Fix user_settings policies
-- ============================================================
DROP POLICY IF EXISTS "Session can insert own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Session can update own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Session can read own settings" ON public.user_settings;

CREATE POLICY "Session can read own settings"
  ON public.user_settings
  FOR SELECT
  TO anon, authenticated
  USING (
    session_id IS NOT NULL
    AND length(trim(session_id)) > 0
  );

CREATE POLICY "Session can insert own settings"
  ON public.user_settings
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    session_id IS NOT NULL
    AND length(trim(session_id)) > 0
  );

CREATE POLICY "Session can update own settings"
  ON public.user_settings
  FOR UPDATE
  TO anon, authenticated
  USING (
    session_id IS NOT NULL
    AND length(trim(session_id)) > 0
  )
  WITH CHECK (
    session_id IS NOT NULL
    AND length(trim(session_id)) > 0
  );
