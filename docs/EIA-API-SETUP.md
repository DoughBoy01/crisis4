# EIA API Setup Guide

Quick guide to obtain and configure your free EIA (Energy Information Administration) API key.

## What is EIA?

The U.S. Energy Information Administration (EIA) provides open data on energy markets, including:
- Crude oil spot prices (Brent, WTI)
- Natural gas prices
- Petroleum production and inventory
- Energy consumption statistics

Crisis2 uses the EIA API to fetch **Brent Crude Oil spot prices** (RBRTE series).

---

## 🔑 Get Your Free API Key

### Step 1: Register
Go to: https://www.eia.gov/opendata/register.php

### Step 2: Fill Out Form
- **Email**: Your email address
- **Organization**: Optional (can be personal/individual)
- **First/Last Name**: Your name

### Step 3: Verify Email
- Check your inbox for verification email
- Click the verification link
- You'll receive your API key immediately

### Step 4: Save Your Key
Copy the API key that looks like:
```
abc123def456ghi789jkl012mno345pq
```

---

## 🛠️ Configure API Key

### Local Development

1. Open `.dev.vars` in the project root
2. Add your API key:
   ```bash
   EIA_API_KEY=abc123def456ghi789jkl012mno345pq
   ```
3. Save the file
4. Restart your dev server:
   ```bash
   npm run dev:full
   ```

### Production (Cloudflare Pages)

Add the secret via wrangler CLI:

```bash
# Interactive prompt
npx wrangler pages secret put EIA_API_KEY --project-name crisis2

# Or via echo
echo "abc123def456ghi789jkl012mno345pq" | \
  npx wrangler pages secret put EIA_API_KEY --project-name crisis2
```

Verify it was added:
```bash
npx wrangler pages secret list --project-name crisis2

# Should show:
# Name: EIA_API_KEY
# Name: JWT_SECRET
```

---

## ✅ Verify It Works

### Local Test
```bash
# Start dev server
npm run dev:full

# Trigger data fetch
curl -X POST http://localhost:8788/api/feed_cache/trigger

# Check response - should show 12/12 sources
# {
#   "sources_ok": 12,  // ✅ All 12 sources (including EIA)
#   "sources_total": 12
# }
```

### Production Test
```bash
# Trigger production fetch
curl -X POST https://crisis2.pages.dev/api/feed_cache/trigger

# View latest data
curl https://crisis2.pages.dev/api/feed_cache
```

### Check EIA Source in Response
```bash
curl http://localhost:8788/api/feed_cache | jq '.sources[] | select(.source_name == "EIA Brent Crude")'

# Expected output:
# {
#   "source_name": "EIA Brent Crude",
#   "success": true,
#   "current_price": 85.67,
#   "previous_price": 84.12,
#   "change_pct": 1.84,
#   "data_period": "2026-03-18",
#   "accuracy_score": 100
# }
```

---

## 🚨 Troubleshooting

### Error: "EIA_API_KEY not configured"
**Cause**: Missing environment variable

**Fix for Local**:
```bash
# Check .dev.vars exists and contains:
EIA_API_KEY=your_key_here
```

**Fix for Production**:
```bash
# Re-add secret
echo "your_key_here" | npx wrangler pages secret put EIA_API_KEY --project-name crisis2
```

### Error: "HTTP 403" or "Invalid API key"
**Cause**: Incorrect API key

**Fix**:
1. Verify your key at https://www.eia.gov/opendata/
2. Check for extra spaces or newlines in `.dev.vars`
3. Regenerate key if needed

### Error: "No valid Brent price rows"
**Cause**: API returned unexpected data format (rare)

**Behavior**: EIA source fails gracefully, other 11 sources continue working

**Fix**: Usually resolves itself on next fetch (data formatting issue on EIA side)

---

## 📊 EIA Data Source Details

### API Endpoint
```
https://api.eia.gov/v2/petroleum/pri/spt/data/
```

### Parameters
- **Series**: RBRTE (Europe Brent Spot Price FOB)
- **Frequency**: Daily
- **Update Schedule**: Each US business day (usually by 5 PM ET)

### Data Structure
```json
{
  "response": {
    "data": [
      {
        "period": "2026-03-18",
        "series": "RBRTE",
        "value": "85.67"
      },
      {
        "period": "2026-03-17",
        "series": "RBRTE",
        "value": "84.12"
      }
    ]
  }
}
```

### Rate Limits
- **Free Tier**: No documented limit
- **Timeout**: 10 seconds per request
- **Caching**: Crisis2 caches results in D1 database

---

## 🔗 Useful Links

- [EIA API Registration](https://www.eia.gov/opendata/register.php)
- [EIA API Documentation](https://www.eia.gov/opendata/documentation.php)
- [API Browser (explore datasets)](https://www.eia.gov/opendata/browser/)
- [Brent Crude Series (RBRTE)](https://www.eia.gov/dnav/pet/pet_pri_spt_s1_d.htm)

---

## 💡 What If I Don't Want EIA?

You can skip EIA entirely - the platform will still work with **11/12 data sources**:
- Yahoo Finance (22 tickers via Stooq) ✅
- ExchangeRate.host FX rates ✅
- 9 RSS feeds ✅
- EIA Brent Crude ❌ (disabled without key)

Just leave `EIA_API_KEY` blank in `.dev.vars`:
```bash
EIA_API_KEY=
```

The feed trigger will log:
```
[Feed Trigger] Success: 11/12 sources, accuracy: 94%
```

---

**Last Updated**: 2026-03-19
**Related Docs**: [DATA-SOURCES.md](DATA-SOURCES.md), [LOCAL-DEVELOPMENT.md](LOCAL-DEVELOPMENT.md)
