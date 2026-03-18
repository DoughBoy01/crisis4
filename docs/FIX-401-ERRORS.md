# Fix 401 Errors - Missing Bindings & Configuration

## 🎉 Good News!
Your deployment **succeeded**! The frontend loads correctly.

## ❌ The Problem

All API endpoints return **401 Unauthorized** because:

1. **Missing D1 Database binding** - `DB` not configured
2. **Missing JWT_SECRET** - Authentication middleware fails
3. **Missing Durable Object binding** - WebSocket fails
4. **No database/users** - Empty D1 database

---

## 🔧 FIXES REQUIRED (In Order)

### Fix 1: Configure D1 Database Binding

#### Step 1: Create D1 Database

```bash
# Create the database
wrangler d1 create crisis2-db

# Output will show:
# database_id: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
# Copy this ID!
```

#### Step 2: Add D1 Binding in Cloudflare Dashboard

1. Go to: **https://dash.cloudflare.com**
2. **Workers & Pages** → **crisis4** (your project)
3. **Settings** tab
4. Scroll to: **Functions** section
5. Click: **Bindings** → **Add**
6. Select: **D1 Database**
7. **Variable name:** `DB`
8. **D1 Database:** Select `crisis2-db` from dropdown
9. Click: **Save**

#### Step 3: Initialize Database Schema

```bash
# Apply the main schema to your D1 database
wrangler d1 execute crisis2-db --file=./schemas/0001_initial_schema.sql --remote

# Apply the users table schema (CRITICAL - required for authentication)
wrangler d1 execute crisis2-db --file=./schemas/0002_users_table.sql --remote

# Verify tables were created
wrangler d1 execute crisis2-db --remote --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

---

### Fix 2: Add JWT_SECRET Environment Variable

#### Generate a Secure Secret

```bash
# Generate a random 32-byte secret
openssl rand -base64 32

# Example output:
# K7x9Qm2Wp5Tn8Vr3Hs6Jk1Lz4Nc0Pd9Fg2Yw5Xu7Bv3
```

#### Add to Cloudflare Dashboard

1. Still in **Settings** → **Environment variables**
2. Click: **Add variable**
3. **Production:**
   - **Variable name:** `JWT_SECRET`
   - **Value:** (paste the generated secret)
   - **Type:** **Encrypted** (important!)
4. Click: **Save**

---

### Fix 3: Configure Durable Object Binding (For WebSocket)

#### Step 1: Deploy the Durable Objects Worker

```bash
# Deploy the DO Worker first
wrangler deploy --config wrangler-worker.jsonc

# Output should show:
# ✅ Published crisis2-durable-objects
```

#### Step 2: Add DO Binding to Pages

1. Back in **Settings** → **Functions** → **Bindings**
2. Click: **Add** → **Durable Object**
3. **Variable name:** `MARKET_FEED_ROOM`
4. **Durable Object namespace:** Select `MarketFeedRoom`
5. **Script:** Select `crisis2-durable-objects`
6. Click: **Save**

---

### Fix 4: Create Initial User Account

After D1 and JWT_SECRET are configured, you need to create a user account.

#### Option A: Via Helper Script (Recommended)

Use the provided script to generate the hash and SQL command:

```bash
# Run the script with your desired password
node scripts/create-admin-user.js yourSecurePassword123

# The script will output:
# - User details (ID, email, role)
# - Bcrypt hash
# - Ready-to-run SQL command

# Copy and run the SQL command shown in the output
# Example:
# wrangler d1 execute crisis2-db --remote --command="INSERT INTO users ..."
```

#### Option B: Manual Method

If you prefer to do it manually:

```bash
# 1. Generate bcrypt hash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('yourPassword', 10, (err, hash) => { console.log(hash); process.exit(); });"

# 2. Generate UUID
node -e "console.log(require('crypto').randomUUID());"

# 3. Insert user with generated values
wrangler d1 execute crisis2-db --remote --command="INSERT INTO users (id, email, password_hash, role, active, created_at) VALUES ('YOUR_UUID', 'admin@example.com', 'YOUR_BCRYPT_HASH', 'admin', 1, datetime('now'));"
```

**Important Notes:**
- SQLite uses `1` for true (not `true`)
- Use a strong password (minimum 8 characters)
- Keep your password secure - you'll need it to login

#### Option B: Create a Registration Endpoint (Better)

If you have a `/api/auth/register` endpoint, use that after bindings are configured.

---

## 📋 Configuration Checklist

After completing the above, verify in Dashboard:

### Bindings (Settings → Functions → Bindings):
- [ ] **D1 Database:** `DB` → `crisis2-db`
- [ ] **Durable Object:** `MARKET_FEED_ROOM` → `MarketFeedRoom` from `crisis2-durable-objects`

### Environment Variables (Settings → Environment variables):
- [ ] **JWT_SECRET** → (encrypted, 32+ chars)
- [ ] **NODE_VERSION** → `18` (optional, for builds)

### D1 Database:
- [ ] Database created: `crisis2-db`
- [ ] Main schema applied: `wrangler d1 execute crisis2-db --file=./schemas/0001_initial_schema.sql --remote`
- [ ] Users table schema applied: `wrangler d1 execute crisis2-db --file=./schemas/0002_users_table.sql --remote`
- [ ] At least one user exists in users table

---

## 🧪 Testing After Configuration

### Test 1: Check D1 Binding

```bash
# Query the database to verify binding works
wrangler d1 execute crisis2-db --remote --command="SELECT * FROM users LIMIT 1;"

# Should show your user if inserted
```

### Test 2: Test Auth Endpoint (In Browser)

1. Open DevTools → Network tab
2. Visit: `https://crisis4.pages.dev/api/auth/me`
3. **Before login:** Should return `401` with JSON: `{"error": "Unauthorized"}`
4. **After login:** Should return user object

### Test 3: Login

1. Go to: `https://crisis4.pages.dev`
2. Try to login with your credentials
3. Check DevTools for successful auth
4. Should see: `200 OK` on `/api/auth/login`

### Test 4: WebSocket Connection

After login, check DevTools console:
```
✅ [useMarketFeeds] WebSocket connected
```

**Not:**
```
❌ WebSocket connection failed
```

---

## 🚨 Current Issue Summary

| Endpoint | Status | Reason | Fix |
|----------|--------|--------|-----|
| `/api/auth/me` | 401 | No JWT_SECRET or DB | Add JWT_SECRET + DB binding |
| `/api/feed_cache` | 401 | Auth middleware requires JWT | Same as above |
| `/api/user_settings` | 401 | Auth middleware requires JWT | Same as above |
| WebSocket | Failed | No DO binding or auth | Add MARKET_FEED_ROOM binding |

---

## ⚡ Quick Fix Script

Run these commands in order:

```bash
# 0. Install dependencies (includes bcryptjs for password hashing)
npm install

# 1. Create D1 database
wrangler d1 create crisis2-db
# Copy the database_id from output

# 2. Apply schemas (main + users table)
wrangler d1 execute crisis2-db --file=./schemas/0001_initial_schema.sql --remote
wrangler d1 execute crisis2-db --file=./schemas/0002_users_table.sql --remote

# 3. Create admin user (generates bcrypt hash and SQL command)
node scripts/create-admin-user.js yourSecurePassword123
# Copy and run the SQL command from the output

# 4. Deploy Durable Objects Worker
wrangler deploy --config wrangler-worker.jsonc

# 5. Generate JWT secret
openssl rand -base64 32
# Copy this secret
```

Then in **Cloudflare Dashboard**:
1. Add D1 binding: `DB` → `crisis2-db`
2. Add DO binding: `MARKET_FEED_ROOM` → `crisis2-durable-objects`
3. Add environment variable: `JWT_SECRET` → (paste secret, encrypted)
4. Create a user in D1 (see above)

---

## ✅ Expected Result

After all fixes:

```
✅ /api/auth/me → 200 OK (when logged in)
✅ /api/feed_cache → 200 OK
✅ /api/user_settings → 200 OK
✅ WebSocket connected
✅ Data loads in UI
```

---

## 📖 Related Docs

- [DEPLOYMENT.md](DEPLOYMENT.md) - Full deployment guide
- [DEPLOYMENT-SUCCESS.md](DEPLOYMENT-SUCCESS.md) - Post-deployment steps
- [WEBSOCKET-UPGRADE.md](WEBSOCKET-UPGRADE.md) - WebSocket implementation

---

## Need Help?

If you're still getting 401 errors after configuration:

1. Check Cloudflare Dashboard → **Functions** → **Real-time logs**
2. Look for binding errors or missing environment variables
3. Verify JWT_SECRET is set correctly (encrypted)
4. Verify D1 database has data: `wrangler d1 execute crisis2-db --remote --command="SELECT COUNT(*) FROM users;"`
