# 🚀 Live Data Quick Start

Get your local development environment fetching **real market data** in 5 minutes.

---

## What You Get

After following this guide, your local Crisis2 instance will fetch:

✅ **22 market tickers**: Brent, WTI, Natural Gas, Wheat, Corn, Gold, Silver, Copper, FX rates, indices
✅ **9 RSS feeds**: BBC, Guardian, Reuters, Al Jazeera, Shipping, Grain, Fertilizer, Metals
✅ **Live data**: Updates every time you trigger the feed endpoint
✅ **11-12 sources**: All sources work without API keys (except EIA which is optional)

---

## Step 1: Install & Build (2 minutes)

```bash
# Clone or navigate to the project
cd crisis2

# Install dependencies
npm install

# Build the project
npm run build

# Initialize local database
npm run db:local:init
```

---

## Step 2: Create Admin User (1 minute)

```bash
# Generate password hash
node scripts/create-admin-user.js LocalAdmin123

# Copy the INSERT command from output and run it
npx wrangler d1 execute crisis2-db --local --command="INSERT INTO users ..."
```

**Credentials**:
- Email: `admin@example.com`
- Password: `LocalAdmin123`

---

## Step 3: (Optional) Add EIA API Key (2 minutes)

**Skip this if you want to start quickly** - you'll get 11/12 data sources without it.

1. Get free API key: https://www.eia.gov/opendata/register.php
2. Open `.dev.vars` in project root
3. Add your key:
   ```
   EIA_API_KEY=your_key_here
   ```
4. Save the file

---

## Step 4: Start Dev Server (30 seconds)

```bash
npm run dev:full
```

Wait for:
```
⎔ Starting local server...
╭────────────────────────────────────────────────────────────────╮
│  [b] open a browser, [d] open Devtools, [l] turn off local    │
│  mode, [c] clear console, [x] to exit                         │
╰────────────────────────────────────────────────────────────────╯
```

---

## Step 5: Fetch Live Data! (10 seconds)

Open a new terminal and run:

```bash
curl -X POST http://localhost:8788/api/feed_cache/trigger
```

**Expected Response**:
```json
{
  "success": true,
  "id": "abc123...",
  "sources_ok": 11,  // or 12 if you added EIA_API_KEY
  "sources_total": 12,
  "overall_accuracy_score": 95
}
```

---

## Step 6: View Your Data

### Option A: Browser Dashboard
Open: http://localhost:8788

Click profile icon → login with `admin@example.com` / `LocalAdmin123`

### Option B: API Endpoint
```bash
curl http://localhost:8788/api/feed_cache | jq
```

### Option C: Database Query
```bash
npx wrangler d1 execute crisis2-db --local \
  --command="SELECT
    json_extract(payload, '$.overall_accuracy_score') as accuracy,
    json_extract(payload, '$.sources_ok') as sources_ok,
    json_extract(payload, '$.sources_total') as total
  FROM feed_cache
  ORDER BY created_at DESC
  LIMIT 1;"
```

---

## 🎉 You're Done!

Your local Crisis2 instance is now fetching live market data.

---

## What's Next?

### View Market Data Details
```bash
# See all Yahoo Finance quotes
curl http://localhost:8788/api/feed_cache | \
  jq '.sources[] | select(.source_name == "Yahoo Finance") | .quotes'

# See Brent Crude price
curl http://localhost:8788/api/feed_cache | \
  jq '.sources[] | select(.source_name == "EIA Brent Crude")'

# See latest BBC news articles
curl http://localhost:8788/api/feed_cache | \
  jq '.sources[] | select(.source_name == "BBC Business RSS") | .items'
```

### Re-fetch Data
```bash
# Fetch fresh data anytime
curl -X POST http://localhost:8788/api/feed_cache/trigger
```

### Check Data Freshness
```bash
# View all cached fetches
npx wrangler d1 execute crisis2-db --local \
  --command="SELECT id, fetched_at, created_at FROM feed_cache ORDER BY created_at DESC LIMIT 5;"
```

---

## 🛠️ Troubleshooting

### "sources_ok": 0 (all sources failed)
**Fix**: Check internet connection, retry in 30 seconds

### "sources_ok": 11 instead of 12
**Expected** if you didn't add `EIA_API_KEY` to `.dev.vars`

### Dashboard not loading data
**Fix**: Make sure you triggered the feed fetch first:
```bash
curl -X POST http://localhost:8788/api/feed_cache/trigger
```

### Port 8788 already in use
**Fix**: Kill existing wrangler process:
```bash
pkill -f wrangler
npm run dev:full
```

---

## 📚 Learn More

- **Full data source list**: [docs/DATA-SOURCES.md](docs/DATA-SOURCES.md)
- **EIA API setup guide**: [docs/EIA-API-SETUP.md](docs/EIA-API-SETUP.md)
- **Local dev workflow**: [docs/LOCAL-DEVELOPMENT.md](docs/LOCAL-DEVELOPMENT.md)

---

## 🚀 Deploy to Production

Ready to deploy with live data?

1. **Get EIA API key** (optional): https://www.eia.gov/opendata/register.php

2. **Add production secrets**:
   ```bash
   echo "your-eia-key" | npx wrangler pages secret put EIA_API_KEY --project-name crisis2
   ```

3. **Deploy**:
   ```bash
   npm run deploy
   ```

4. **Test production**:
   ```bash
   curl -X POST https://crisis2.pages.dev/api/feed_cache/trigger
   curl https://crisis2.pages.dev/api/feed_cache
   ```

---

**Questions?** Check the docs or open an issue!

**Last Updated**: 2026-03-19
