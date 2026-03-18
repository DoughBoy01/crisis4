# Quick Test Guide

## ✅ Deployment Complete!

Your Crisis2 application is now fully deployed on Cloudflare with RSS feed fetching working!

### Deployed URLs

- **Frontend:** https://crisis2.pages.dev
- **Latest deployment:** https://c869dd15.crisis2.pages.dev
- **Durable Objects Worker:** https://crisis2-durable-objects.pm2120600.workers.dev

## Quick Functionality Test

### 1. Test RSS Feed Trigger

```bash
curl -X POST https://crisis2.pages.dev/api/feed_cache/trigger
```

**Expected Response:**
```json
{
  "success": true,
  "id": "uuid",
  "sources_ok": 4,
  "sources_total": 5
}
```

✅ **Currently Working:** 4 out of 5 RSS feeds successfully fetching!

### 2. Verify Data in Database

```bash
npx wrangler d1 execute crisis2-db --remote --command \
  "SELECT COUNT(*) as total_feeds, MAX(fetched_at) as latest_fetch FROM feed_cache;"
```

### 3. Test WebSocket Connection

Open your browser console at https://crisis2.pages.dev and paste:

```javascript
const ws = new WebSocket('wss://crisis2.pages.dev/api/feed_cache/connect');

ws.onopen = () => {
  console.log('✅ WebSocket CONNECTED');
  // Trigger a feed fetch to test broadcast
  fetch('/api/feed_cache/trigger', { method: 'POST' })
    .then(r => r.json())
    .then(d => console.log('🔔 Triggered feed fetch:', d));
};

ws.onmessage = (event) => {
  console.log('📦 RECEIVED DATA:', JSON.parse(event.data));
};

ws.onerror = (error) => {
  console.error('❌ WebSocket ERROR:', error);
};

ws.onclose = (event) => {
  console.log('🔌 WebSocket CLOSED:', event.code, event.reason);
};
```

### 4. Check Dashboard Data

Visit https://crisis2.pages.dev and you should see:
- Live news headlines from BBC, Guardian, Reuters, Al Jazeera
- Data freshness indicators
- Market intelligence panels

If you don't see data yet:
1. Trigger a feed fetch (step 1 above)
2. Wait 2-3 seconds for WebSocket broadcast
3. Refresh the page

## Current Status

### ✅ Working Components

- [x] Frontend deployed to Cloudflare Pages
- [x] Durable Objects worker deployed
- [x] D1 Database configured and accessible
- [x] RSS feed fetcher endpoint functional
- [x] Data successfully stored in D1 (verified!)
- [x] WebSocket endpoint available
- [x] Authentication middleware configured

### 📊 Data Sources Currently Active

1. **BBC Business RSS** - ✅ Working
2. **Guardian Business RSS** - ✅ Working
3. **Reuters World RSS** - ✅ Working
4. **Al Jazeera RSS** - ✅ Working
5. **Financial Times RSS** - ⚠️ May require auth/different URL

### 🔄 Next Steps

1. **Set up automated fetching** (choose one):
   - GitHub Action (every 15 min)
   - Cloudflare Cron Trigger
   - External cron service

2. **Add more RSS feeds** (edit `functions/api/feed_cache/trigger.ts`):
   - USDA RSS
   - Farmers Weekly
   - AHDB
   - MarketWatch
   - Lloyd's List

3. **Monitor feed quality:**
   - Check which feeds are failing
   - Adjust timeouts if needed
   - Add retry logic for failed feeds

## Troubleshooting

### No data in dashboard?

```bash
# 1. Check if data exists in D1
npx wrangler d1 execute crisis2-db --remote --command \
  "SELECT fetched_at FROM feed_cache ORDER BY created_at DESC LIMIT 1;"

# 2. If empty, trigger a fetch
curl -X POST https://crisis2.pages.dev/api/feed_cache/trigger

# 3. Check WebSocket connection in browser console
# Look for "[useMarketFeeds] WebSocket connected" message
```

### WebSocket not connecting?

The Durable Object binding should be configured via `wrangler.toml`. If you see errors:

```bash
# Redeploy to ensure binding is active
npm run build
npx wrangler pages deploy dist --project-name crisis2
```

### RSS feeds timing out?

Some RSS feeds may be slow or blocked. Check the response:

```bash
curl -X POST https://crisis2.pages.dev/api/feed_cache/trigger | jq
```

Look at `sources_ok` vs `sources_total` to see how many succeeded.

## Architecture Summary

```
User Browser
    ↓ (WebSocket)
    ↓
Cloudflare Pages → /api/feed_cache/connect
    ↓
Durable Object (MarketFeedRoom)
    ↓ (broadcasts to all connected clients)
    ↑
    ↑ (POST /broadcast)
    ↑
RSS Trigger Endpoint
    ↓
    ├─→ Fetch 5 RSS feeds in parallel
    ├─→ Store in D1 database (feed_cache table)
    └─→ Broadcast to Durable Object
```

## Success Metrics

Current deployment is **SUCCESSFUL** if:
- ✅ Trigger endpoint returns `{"success": true}`
- ✅ D1 database contains feed_cache records
- ✅ WebSocket connection establishes
- ✅ Dashboard loads without errors

All checked! 🎉

## Git Commits Made

1. **a5269b3** - Add Cloudflare Durable Objects integration and RSS feed fetcher
2. **18b89b8** - Allow public access to feed cache trigger and WebSocket endpoints

Both pushed to `main` branch successfully!
