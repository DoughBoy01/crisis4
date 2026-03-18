# Next Steps - Fix 401 Errors & Complete Deployment

## 🎯 Current Status

✅ **Deployment Successful** - Frontend loads at https://crisis4.pages.dev
❌ **401 Errors** - All API endpoints return "Unauthorized"
❌ **WebSocket Failed** - Cannot connect to market feed

**Root Cause**: Missing bindings and configuration in Cloudflare Dashboard

---

## 🚀 Quick Start (Run These Commands)

```bash
# 1. Install dependencies (adds bcryptjs for secure password hashing)
npm install

# 2. Create D1 database
wrangler d1 create crisis2-db
# ⚠️ COPY THE database_id FROM OUTPUT

# 3. Apply database schemas
wrangler d1 execute crisis2-db --file=./schemas/0001_initial_schema.sql --remote
wrangler d1 execute crisis2-db --file=./schemas/0002_users_table.sql --remote

# 4. Create admin user
node scripts/create-admin-user.js yourSecurePassword123
# ⚠️ COPY AND RUN THE SQL COMMAND FROM OUTPUT

# 5. Deploy Durable Objects Worker
wrangler deploy --config wrangler-worker.jsonc

# 6. Generate JWT secret
openssl rand -base64 32
# ⚠️ COPY THIS SECRET
```

---

## 🔧 Dashboard Configuration

Go to: **https://dash.cloudflare.com** → **Workers & Pages** → **crisis4** → **Settings**

### 1. Add D1 Database Binding

**Settings** → **Functions** → **Bindings** → **Add**

- **Type**: D1 Database
- **Variable name**: `DB`
- **D1 Database**: Select `crisis2-db`
- Click **Save**

### 2. Add Durable Object Binding

**Settings** → **Functions** → **Bindings** → **Add**

- **Type**: Durable Object
- **Variable name**: `MARKET_FEED_ROOM`
- **Durable Object namespace**: `MarketFeedRoom`
- **Script**: `crisis2-durable-objects`
- Click **Save**

### 3. Add JWT_SECRET Environment Variable

**Settings** → **Environment variables** → **Add variable**

- **Variable name**: `JWT_SECRET`
- **Value**: (paste the secret from step 6 above)
- **Type**: **Encrypted** ✅ (important!)
- **Environment**: Production
- Click **Save**

---

## ✅ Verification Checklist

### Database Setup:
- [ ] D1 database `crisis2-db` created
- [ ] Schema `0001_initial_schema.sql` applied
- [ ] Schema `0002_users_table.sql` applied
- [ ] Admin user created and inserted
- [ ] Durable Objects Worker deployed

### Dashboard Configuration:
- [ ] D1 binding: `DB` → `crisis2-db`
- [ ] DO binding: `MARKET_FEED_ROOM` → `crisis2-durable-objects`
- [ ] Environment variable: `JWT_SECRET` (encrypted)

### Testing:
- [ ] Login works: `https://crisis4.pages.dev/api/auth/login`
- [ ] Auth endpoint works: `https://crisis4.pages.dev/api/auth/me`
- [ ] Feed cache works: `https://crisis4.pages.dev/api/feed_cache`
- [ ] WebSocket connects (check browser DevTools console)
- [ ] Dashboard shows data

---

## 🧪 Testing After Configuration

### Test 1: Login

```bash
curl -X POST https://crisis4.pages.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"yourSecurePassword123"}'

# Expected: {"user":{"id":"...","email":"admin@example.com","role":"admin"}}
# Status: 200 OK
```

### Test 2: Authenticated Endpoint

```bash
curl https://crisis4.pages.dev/api/auth/me \
  -H "Cookie: session_token=YOUR_TOKEN_FROM_LOGIN"

# Expected: {"id":"...","email":"admin@example.com","role":"admin"}
# Status: 200 OK (NOT 401)
```

### Test 3: Feed Cache

```bash
curl https://crisis4.pages.dev/api/feed_cache \
  -H "Cookie: session_token=YOUR_TOKEN"

# Expected: {"fetched_at":"...","payload":{...}}
# Status: 200 OK (NOT 401)
```

### Test 4: WebSocket (Browser DevTools Console)

After logging in, open DevTools → Console and look for:

```
✅ [useMarketFeeds] WebSocket connected
```

**NOT**:
```
❌ WebSocket connection failed
```

---

## 📁 Files Created/Modified

### New Files:
- `schemas/0002_users_table.sql` - Users table for authentication
- `scripts/create-admin-user.js` - Helper to create admin users
- `docs/AUTH-IMPROVEMENTS.md` - Authentication improvements summary
- `docs/NEXT-STEPS.md` - This file

### Modified Files:
- `package.json` - Added `bcryptjs` and `@types/bcryptjs`
- `functions/api/auth/login.ts` - Real D1 authentication with bcrypt
- `functions/api/auth/update_password.ts` - Bcrypt password hashing
- `docs/FIX-401-ERRORS.md` - Updated with new schema and script instructions

---

## 🔍 Troubleshooting

### Still Getting 401 Errors?

1. **Check Cloudflare Dashboard Logs**:
   - Go to: **Deployments** → Select latest deployment → **Functions** tab
   - Look for errors related to missing bindings

2. **Verify Bindings**:
   ```bash
   # Check if DB binding is set
   wrangler pages deployment list --project-name=crisis4
   ```

3. **Verify User Exists**:
   ```bash
   wrangler d1 execute crisis2-db --remote --command="SELECT * FROM users;"
   # Should show at least one user
   ```

4. **Verify JWT_SECRET**:
   - Dashboard → Settings → Environment variables
   - Make sure `JWT_SECRET` is set and encrypted

5. **Check for Typos**:
   - Binding names are case-sensitive
   - `DB` (not `db` or `Database`)
   - `MARKET_FEED_ROOM` (not `MarketFeedRoom`)

---

## 📚 Documentation References

- [FIX-401-ERRORS.md](FIX-401-ERRORS.md) - Detailed 401 error troubleshooting
- [AUTH-IMPROVEMENTS.md](AUTH-IMPROVEMENTS.md) - Authentication changes summary
- [DEPLOYMENT.md](DEPLOYMENT.md) - Full deployment guide
- [WEBSOCKET-UPGRADE.md](WEBSOCKET-UPGRADE.md) - WebSocket implementation details

---

## 💡 Important Notes

1. **Run `npm install` first** - bcryptjs is required for authentication
2. **D1 bindings require dashboard configuration** - Cannot be set via wrangler.jsonc for Pages
3. **JWT_SECRET must be encrypted** - Use "Encrypted" type in environment variables
4. **Users table is critical** - Authentication will fail without it
5. **WebSocket requires DO binding** - `MARKET_FEED_ROOM` binding is mandatory

---

## 🎉 Expected Result

After completing all steps:

```
✅ Frontend loads: https://crisis4.pages.dev
✅ Login works: POST /api/auth/login → 200 OK
✅ Auth endpoint: GET /api/auth/me → 200 OK
✅ Feed cache: GET /api/feed_cache → 200 OK
✅ User settings: GET /api/user_settings → 200 OK
✅ WebSocket connected: Real-time market feed updates
✅ Dashboard shows data: All components load correctly
```

---

## ❓ Need Help?

If you're still experiencing issues after following these steps:

1. Check Cloudflare Dashboard → **Functions** → **Real-time logs**
2. Look for specific error messages
3. Verify all bindings are correctly configured
4. Check that JWT_SECRET is set correctly (encrypted)
5. Verify D1 database has users: `wrangler d1 execute crisis2-db --remote --command="SELECT COUNT(*) FROM users;"`

---

## 🔄 After Configuration Changes

Cloudflare Pages automatically redeploys when:
- You push to git (auto-deployment)
- You change bindings in dashboard
- You change environment variables

**No manual redeployment needed** - just save changes in dashboard!
