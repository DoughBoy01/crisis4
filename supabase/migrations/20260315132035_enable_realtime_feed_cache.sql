/*
  # Enable Realtime on feed_cache

  ## Summary
  Adds the feed_cache table to Supabase's Realtime publication so that
  UPDATE events are broadcast to all connected clients. This allows any
  user's browser to instantly receive the updated payload when an admin
  deletes a story — without waiting for the next 15-minute auto-refresh.

  ## Changes
  - Adds `feed_cache` to the `supabase_realtime` publication
*/

ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_cache;
