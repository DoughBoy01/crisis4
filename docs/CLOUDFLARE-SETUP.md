# Cloudflare Setup & Data Flow Guide

## Overview

Your application is now fully deployed on Cloudflare with the following architecture:

```
┌─────────────────────────────────────────────────────────────┐
│  RSS FEEDS (BBC, Guardian, Reuters, FT, Al Jazeera)         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  POST /api/feed_cache/trigger (Cloudflare Pages Function)   │
│  - Fetches RSS feeds in parallel                            │
│  - Stores in D1 database                                    │
│  - Broadcasts to Durable Object                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ├──────────────┐
                       │              │
                       ▼              ▼
        ┌──────────────────┐   ┌────────────────────────────┐
        │   D1 Database    │   │   Durable Object           │
        │   (feed_cache)   │   │   (MarketFeedRoom)         │
        └──────────────────┘   │   - WebSocket broadcasting │
                               └────────────┬───────────────┘
                                            │
                                            ▼
                                ┌──────────────────────────┐
                                │  Frontend WebSocket      │
                                │  GET /api/feed_cache/    │
                                │       connect            │
                                └──────────────────────────┘
```

## Deployed Components

### ✅ Successfully Deployed

1. **Frontend** - https://crisis2.pages.dev
   - Latest deployment: https://988d4463.crisis2.pages.dev

2. **Durable Object Worker** - https://crisis2-durable-objects.pm2120600.workers.dev
   - Handles WebSocket connections
   - Broadcasts feed updates to all connected clients

3. **Pages Functions**
   - `/api/feed_cache/connect` - WebSocket upgrade endpoint
   - `/api/feed_cache/trigger` - RSS feed fetcher (NEW)
   - `/api/feed_cache` - Feed cache retrieval
   - All other API endpoints (auth, user_settings, etc.)

4. **D1 Database**
   - Database ID: `c3bdf315-1aca-46a5-a0fd-0f3aefced92a`
   - Name: `crisis2-db`
   - Binding: `DB`

## Required Configuration

### Step 1: Add Durable Object Binding to Pages Project

The Durable Object binding needs to be configured for your Pages project.

**Via Cloudflare Dashboard:**

1. Go to https://dash.cloudflare.com
2. Navigate to **Workers & Pages** > **crisis2**
3. Click on **Settings** > **Functions**
4. Scroll to **Durable Object bindings**
5. Click **Add binding**
   - Variable name: `MARKET_FEED_ROOM`
   - Durable Object namespace: `MarketFeedRoom` (from `crisis2-durable-objects` worker)
6. Click **Save**

**Via Wrangler CLI** (alternative):

```bash
# This requires wrangler.toml format, not .jsonc
# You may need to temporarily create a wrangler.toml
```

### Step 2: Verify Database Schema

Make sure your D1 database has the `feed_cache` table:

```bash
# Check if table exists
npx wrangler d1 execute crisis2-db --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name='feed_cache';"

# If empty, create the table
npx wrangler d1 execute crisis2-db --remote --file=schemas/0001_initial_schema.sql
```

## Testing the Data Flow

### Test 1: Trigger RSS Feed Fetch

```bash
curl -X POST https://crisis2.pages.dev/api/feed_cache/trigger

# Expected response:
# {
#   "success": true,
#   "id": "uuid",
#   "sources_ok": 5,
#   "sources_total": 5
# }
```

### Test 2: Check D1 Database

```bash
npx wrangler d1 execute crisis2-db --remote --command \
  "SELECT id, fetched_at, length(payload) as payload_size FROM feed_cache ORDER BY created_at DESC LIMIT 1;"
```

### Test 3: Test WebSocket Connection

Open your browser console on https://crisis2.pages.dev and run:

```javascript
const ws = new WebSocket('wss://crisis2.pages.dev/api/feed_cache/connect');

ws.onopen = () => console.log('✅ WebSocket connected');
ws.onmessage = (event) => {
  console.log('📦 Received data:', JSON.parse(event.data));
};
ws.onerror = (error) => console.error('❌ WebSocket error:', error);
ws.onclose = () => console.log('🔌 WebSocket closed');
```

Then trigger a feed fetch and watch for the broadcast:

```bash
curl -X POST https://crisis2.pages.dev/api/feed_cache/trigger
```

## Automating Feed Fetches

### Option 1: Cloudflare Cron Triggers (Recommended)

Add to `wrangler-worker.jsonc`:

```jsonc
{
  "triggers": {
    "crons": ["0 */15 * * *"]  // Every 15 minutes
  }
}
```

Then update the worker to call the trigger endpoint on cron.

### Option 2: External Cron Service

Use a service like cron-job.org or GitHub Actions to POST to the trigger endpoint every 15 minutes.

Example GitHub Action (`.github/workflows/fetch-feeds.yml`):

```yaml
name: Fetch RSS Feeds
on:
  schedule:
    - cron: '*/15 * * * *'  # Every 15 minutes
  workflow_dispatch:  # Manual trigger

jobs:
  fetch:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger feed fetch
        run: |
          curl -X POST https://crisis2.pages.dev/api/feed_cache/trigger
```

### Option 3: Manual Testing

For now, you can manually trigger feeds by visiting a URL or using a browser bookmark:

**Bookmarklet:**
```javascript
javascript:(function(){fetch('https://crisis2.pages.dev/api/feed_cache/trigger',{method:'POST'}).then(r=>r.json()).then(d=>alert('✅ Feeds fetched: '+d.sources_ok+'/'+d.sources_total))})()
```

## Current RSS Feed Sources

The trigger endpoint currently fetches from 5 RSS feeds:

1. **BBC Business** - http://feeds.bbci.co.uk/news/business/rss.xml
2. **Guardian Business** - https://www.theguardian.com/business/rss
3. **Reuters World** - https://www.reutersagency.com/feed/...
4. **Financial Times** - https://www.ft.com/?format=rss
5. **Al Jazeera** - https://www.aljazeera.com/xml/rss/all.xml

## Expanding the Feed List

To add more feeds, edit `functions/api/feed_cache/trigger.ts`:

```typescript
const RSS_FEEDS = [
  // Existing feeds...
  { name: 'USDA RSS', url: 'https://www.usda.gov/rss/latest-releases.xml' },
  { name: 'Farmers Weekly RSS', url: 'https://www.fwi.co.uk/feed' },
  // Add more here
];
```

Then redeploy:

```bash
npm run build
npx wrangler pages deploy dist --project-name crisis2
```

## Troubleshooting

### No Data Showing in Dashboard

1. **Check if trigger has been called:**
   ```bash
   curl -X POST https://crisis2.pages.dev/api/feed_cache/trigger
   ```

2. **Check D1 for data:**
   ```bash
   npx wrangler d1 execute crisis2-db --remote --command \
     "SELECT COUNT(*) as count FROM feed_cache;"
   ```

3. **Check WebSocket connection:**
   - Open browser console
   - Look for `[useMarketFeeds] WebSocket connected` message
   - If you see "MARKET_FEED_ROOM binding is missing", the DO binding isn't configured

### WebSocket Not Connecting

Error: `MARKET_FEED_ROOM binding is missing`

**Fix:** Add the Durable Object binding in Cloudflare Dashboard (see Step 1 above)

### RSS Feeds Failing

Check which feeds failed:

```bash
# Trigger feeds
curl -X POST https://crisis2.pages.dev/api/feed_cache/trigger

# Check the response for sources_ok vs sources_total
# If some failed, check D1 for error details:
npx wrangler d1 execute crisis2-db --remote --command \
  "SELECT json_extract(payload, '$.sources[0].error') as error FROM feed_cache ORDER BY created_at DESC LIMIT 1;"
```

## Next Steps

1. ✅ Add Durable Object binding to Pages project
2. ✅ Run initial feed fetch: `curl -X POST https://crisis2.pages.dev/api/feed_cache/trigger`
3. ⏳ Set up automated fetching (cron trigger or GitHub Action)
4. ⏳ Add more RSS feeds as needed
5. ⏳ Monitor feed quality and accuracy scores

## Production Checklist

- [ ] Durable Object binding configured
- [ ] Initial feed data populated
- [ ] WebSocket connection tested
- [ ] Automated feed fetching configured (every 15 minutes)
- [ ] All desired RSS feeds added
- [ ] Error monitoring set up
- [ ] Custom domain configured (optional)
