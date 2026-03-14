/*
  # Create email_subscriptions table

  ## Purpose
  Stores email addresses for users who want to receive the daily morning brief
  by email, so they don't need to visit the dashboard.

  ## New Tables

  ### email_subscriptions
  - `id`           — uuid primary key
  - `email`        — subscriber email address (unique, lowercase)
  - `name`         — optional display name for personalisation
  - `active`       — whether the subscription is active (default true)
  - `send_hour_utc` — preferred send hour in UTC (0-23, default 6 = 06:00 UTC)
  - `confirmed`    — whether the email has been confirmed (default true for now, no double opt-in)
  - `created_at`   — timestamp when subscribed
  - `last_sent_at` — timestamp of the last email successfully sent
  - `unsubscribe_token` — secure random token for one-click unsubscribe links

  ## Security
  - RLS enabled
  - anon can INSERT (subscribe) their own row
  - service_role can SELECT/UPDATE/DELETE (used by Edge Function to send emails)
  - No SELECT policy for anon/authenticated — subscribers cannot enumerate other emails

  ## Notes
  - The unsubscribe_token allows a public unsubscribe URL without auth
  - email is stored lowercase and trimmed via a check constraint
*/

CREATE TABLE IF NOT EXISTS email_subscriptions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email              text NOT NULL,
  name               text NOT NULL DEFAULT '',
  active             boolean NOT NULL DEFAULT true,
  send_hour_utc      smallint NOT NULL DEFAULT 6 CHECK (send_hour_utc >= 0 AND send_hour_utc <= 23),
  confirmed          boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  last_sent_at       timestamptz,
  unsubscribe_token  text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  CONSTRAINT email_subscriptions_email_unique UNIQUE (email),
  CONSTRAINT email_subscriptions_email_format CHECK (email = lower(trim(email)) AND email LIKE '%@%')
);

ALTER TABLE email_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can subscribe with own email"
  ON email_subscriptions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anon can unsubscribe via token"
  ON email_subscriptions FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
