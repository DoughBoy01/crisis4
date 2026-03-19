# Crisis2 Data Sources

Complete reference for all market data sources integrated into the Crisis2 dashboard.

## Overview

The Crisis2 platform fetches live market intelligence from **12 data sources** covering:
- **22 financial instruments** (commodities, FX, indices)
- **Multiple RSS feeds** with keyword filtering for relevant news
- **API integrations** for spot prices and exchange rates

All data is fetched via [`/functions/api/feed_cache/trigger.ts`](../functions/api/feed_cache/trigger.ts) and stored in the D1 database.

---

## 🔢 Market Data Sources (3 sources)

### 1. Yahoo Finance (via Stooq)
**Source Type**: HTTP API (CSV format)
**API Key Required**: No
**Update Frequency**: End-of-day data
**Instruments**: 22 tickers

#### Covered Markets:
- **Energy** (5): Brent Crude, WTI Crude, Natural Gas, Heating Oil, RBOB Gasoline
- **FX** (5): GBP/USD, GBP/EUR, EUR/USD, USD/JPY, USD/CNH
- **Grains** (4): Wheat, Corn, Soybeans, Rough Rice
- **Metals** (3): Gold, Silver, Copper
- **Indices** (4): S&P 500, FTSE 100, DAX 40, Baltic Dry Index
- **Dollar Index** (1): US Dollar Index

**Technical Details**:
- Endpoint: `https://stooq.com/q/d/l/?s={symbol}&i=d`
- Format: CSV with OHLC daily data
- Timeout: 8 seconds per symbol
- Fallback: Returns null for individual failed symbols

**Example Response**:
```json
{
  "source_name": "Yahoo Finance",
  "success": true,
  "quotes": [
    {
      "symbol": "BZ=F",
      "label": "Brent Crude Oil (ICE)",
      "price": 85.23,
      "previousClose": 84.50,
      "change": 0.73,
      "changePercent": 0.86,
      "currency": "USD",
      "marketState": "REGULAR"
    }
  ],
  "quotes_count": 22,
  "accuracy_score": 100
}
```

---

### 2. EIA Brent Crude
**Source Type**: REST API (JSON)
**API Key Required**: **Yes** ([Get free key here](https://www.eia.gov/opendata/register.php))
**Update Frequency**: Daily (updated each US business day)
**Data**: Brent Crude Oil spot prices (RBRTE series)

**Technical Details**:
- Endpoint: `https://api.eia.gov/v2/petroleum/pri/spt/data/`
- Series: RBRTE (Europe Brent Spot Price FOB, USD/barrel)
- Returns: Current price, previous price, change %

**Setup**:
1. Register at https://www.eia.gov/opendata/register.php
2. Add API key to `.dev.vars`:
   ```
   EIA_API_KEY=your_key_here
   ```
3. For production, add to Cloudflare Pages secrets:
   ```bash
   npx wrangler pages secret put EIA_API_KEY --project-name crisis2
   ```

**Example Response**:
```json
{
  "source_name": "EIA Brent Crude",
  "success": true,
  "current_price": 85.67,
  "previous_price": 84.12,
  "change_pct": 1.84,
  "change_abs": 1.55,
  "data_period": "2026-03-18",
  "accuracy_score": 100
}
```

---

### 3. ExchangeRate.host FX
**Source Type**: REST API (JSON)
**API Key Required**: No
**Update Frequency**: Daily
**Data**: GBP-based foreign exchange rates

**Technical Details**:
- Endpoint: `https://open.er-api.com/v6/latest/GBP`
- Returns: GBP/USD, GBP/EUR interbank mid-rates
- No authentication required

**Example Response**:
```json
{
  "source_name": "ExchangeRate.host FX",
  "success": true,
  "gbp_usd": 1.2645,
  "gbp_eur": 1.1523,
  "data_timestamp": "2026-03-18T00:00:00.000Z",
  "accuracy_score": 100
}
```

---

## 📰 RSS Feed Sources (9 sources)

All RSS feeds use **keyword filtering** to surface relevant articles about commodities, energy, and geopolitical risks.

### 4. BBC Business RSS
**Keywords**: oil, gas, energy, wheat, grain, shipping, freight, fertilizer, commodity, iran, gulf, inflation, opec, fuel, food
**URL**: `https://feeds.bbci.co.uk/news/business/rss.xml`
**Max Items**: 8
**Max Content Age**: 4 hours

### 5. Al Jazeera RSS
**Keywords**: iran, hormuz, israel, middle east, oil, gulf, houthi, red sea, yemen, tanker, war, opec, conflict
**URL**: `https://www.aljazeera.com/xml/rss/all.xml`
**Max Items**: 5
**Max Content Age**: 6 hours

### 6. Guardian Business RSS
**Keywords**: oil, gas, energy, wheat, grain, shipping, freight, fertilizer, commodity, iran, gulf, inflation, opec, fuel, food, farm
**URL**: `https://www.theguardian.com/business/rss`
**Max Items**: 6
**Max Content Age**: 6 hours

### 7. Reuters World RSS
**Keywords**: war, conflict, sanctions, attack, explosion, iran, russia, ukraine, middle east, israel, blockade, tanker, hormuz, red sea, houthi, yemen, opec
**Fallback URLs**:
- `https://feeds.reuters.com/reuters/worldNews`
- `https://www.reutersagency.com/feed/?best-topics=political-general&post_type=best`
- `https://rss.nytimes.com/services/xml/rss/nyt/World.xml`

**Max Items**: 8
**Max Content Age**: 2 hours

### 8. Reuters Commodities RSS
**Keywords**: oil, crude, brent, gas, wheat, grain, corn, shipping, freight, fertilizer, commodity, supply, tanker, opec, eia, ukraine, export, harvest
**Fallback URLs**:
- `https://feeds.reuters.com/reuters/businessNews`
- `https://www.cnbc.com/id/19836768/device/rss/rss.html`

**Max Items**: 8
**Max Content Age**: 4 hours

### 9. Shipping RSS
**Keywords**: baltic, bdi, dry bulk, container, shipping, freight, tanker, vessel, port, red sea, panama, suez, hormuz, houthi, attack, piracy, congestion, rates, bunker
**Fallback URLs**:
- `https://splash247.com/feed/`
- `https://gcaptain.com/feed/`

**Max Items**: 8
**Max Content Age**: 8 hours

### 10. World Grain RSS
**Keywords**: wheat, corn, grain, soybean, rice, barley, oat, crop, harvest, export, import, supply, demand, price, ukraine, russia, usda, fao
**Fallback URLs**:
- `https://www.world-grain.com/feed/`
- `https://agfax.com/feed/`

**Max Items**: 6
**Max Content Age**: 24 hours

### 11. Fertilizer RSS
**Keywords**: fertilizer, urea, ammonia, nitrogen, potash, phosphate, dap, map, npk, crop input, agrochemical, natural gas, feedstock, price, supply, sanction, russia, belarus
**Fallback URLs**:
- `https://www.agweb.com/feed`

**Max Items**: 6
**Max Content Age**: 24 hours

### 12. Metals RSS
**Keywords**: copper, silver, gold, aluminium, steel, iron ore, nickel, zinc, lme, comex, base metal, precious metal, mining, smelter, supply, demand, china, construction
**Fallback URLs**:
- `https://www.mining.com/feed/`
- `https://www.kitco.com/rss/news.xml`

**Max Items**: 6
**Max Content Age**: 8 hours

---

## 📊 Accuracy Scoring

Each data source receives an **accuracy score (0-100)** based on:
- **Data freshness**: How recently the data was updated
- **Fetch success**: Whether the API/RSS responded successfully
- **Content age**: For RSS feeds, how recent the newest article is

### Score Calculation:

**Market Data (Yahoo, EIA, FX)**:
```
if (age_minutes <= max_fresh_minutes) → 100
else → decay based on how overdue
```

**RSS Feeds**:
```
if (fetch_age > 30 min) → 0 (fetch too old)
if (content_age ≤ max_age) → 100
else → 60-100 with decay
```

### Overall Accuracy:
Average of all successful sources' accuracy scores.

---

## 🔄 Data Fetching Flow

### 1. Trigger Endpoint
```http
POST /api/feed_cache/trigger
Content-Type: application/json

{
  "since_ms": 1234567890000  // Optional: filter RSS by timestamp
}
```

### 2. Parallel Fetching
All 12 sources are fetched concurrently using `Promise.allSettled()` for resilience.

### 3. Storage in D1
```sql
INSERT INTO feed_cache (id, fetched_at, payload, created_at)
VALUES (?, ?, ?, ?)
```

### 4. WebSocket Broadcast (Production Only)
If Durable Objects are available, broadcast to connected clients via `/api/feed_cache/connect`.

### 5. HTTP Fallback
Frontend uses `GET /api/feed_cache` to retrieve latest cached data.

---

## 🚀 Local Development

### Quick Start

1. **Get EIA API Key** (optional but recommended):
   - Register: https://www.eia.gov/opendata/register.php
   - Copy API key

2. **Add to `.dev.vars`**:
   ```bash
   EIA_API_KEY=your_key_here_from_eia_gov
   ```

3. **Build and start dev server**:
   ```bash
   npm run build
   npm run dev:full
   ```

4. **Trigger data fetch**:
   ```bash
   curl -X POST http://localhost:8788/api/feed_cache/trigger
   ```

5. **Check the response**:
   ```bash
   curl http://localhost:8788/api/feed_cache
   ```

### Expected Response:
```json
{
  "success": true,
  "id": "uuid-here",
  "sources_ok": 11,  // 12 if EIA_API_KEY is set
  "sources_total": 12,
  "overall_accuracy_score": 95,
  "monitoring_window_start_utc": "2026-03-18T02:00:00.000Z"
}
```

---

## 🌐 Production Deployment

### Set EIA API Key Secret:
```bash
echo "your_eia_api_key_here" | \
  npx wrangler pages secret put EIA_API_KEY --project-name crisis2
```

### Verify Secrets:
```bash
npx wrangler pages secret list --project-name crisis2
```

### Deploy:
```bash
npm run deploy
```

### Test Production:
```bash
curl -X POST https://crisis2.pages.dev/api/feed_cache/trigger
curl https://crisis2.pages.dev/api/feed_cache
```

---

## 📈 Monitoring

### Check Data Freshness:
```bash
npx wrangler d1 execute crisis2-db --remote \
  --command="SELECT id, fetched_at,
             json_extract(payload, '$.overall_accuracy_score') as accuracy,
             json_extract(payload, '$.sources_ok') as sources_ok
             FROM feed_cache
             ORDER BY created_at DESC
             LIMIT 5;"
```

### View Latest Payload:
```bash
npx wrangler d1 execute crisis2-db --remote \
  --command="SELECT payload FROM feed_cache ORDER BY created_at DESC LIMIT 1;"
```

### Count Failed Sources:
```sql
SELECT
  json_each.value->>'source_name' as source,
  json_each.value->>'error' as error
FROM feed_cache,
  json_each(json_extract(payload, '$.sources'))
WHERE json_each.value->>'success' = 'false'
  AND created_at > datetime('now', '-1 hour');
```

---

## 🔧 Troubleshooting

### EIA API Returns "not configured"
**Cause**: Missing `EIA_API_KEY` environment variable
**Fix**: Add to `.dev.vars` (local) or Cloudflare Pages secrets (production)

### Stooq Returns No Data
**Cause**: Stooq rate limiting or symbol format changed
**Behavior**: Individual symbols fail gracefully, others continue
**Fix**: Wait 1 minute and retry (rate limit resets)

### RSS Feeds Timeout
**Cause**: Slow external server
**Timeout**: 10 seconds per URL
**Behavior**: Falls back to next URL in list
**Fix**: Normal operation, failures are logged

### All Sources Return 0 Accuracy
**Cause**: Network issues or all external APIs down
**Fix**: Check internet connectivity, retry after 5 minutes

---

## 📚 Related Documentation

- [Local Development Guide](LOCAL-DEVELOPMENT.md)
- [Admin Login Guide](ADMIN-LOGIN-GUIDE.md)
- [Cloudflare Setup](CLOUDFLARE-SETUP.md)
- [Migration Status](CLOUDFLARE-MIGRATION-STATUS.md)

---

## 🔗 External Links

- [EIA API Registration](https://www.eia.gov/opendata/register.php)
- [EIA API Documentation](https://www.eia.gov/opendata/documentation.php)
- [Stooq Data Provider](https://stooq.com)
- [Open Exchange Rates](https://open.er-api.com/)

---

**Last Updated**: 2026-03-19
**Version**: 2.0 (Comprehensive market data integration)
