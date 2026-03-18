# Authentication Improvements - Summary

## Overview

Fixed critical authentication issues to resolve 401 errors after deployment.

---

## ✅ What Was Fixed

### 1. Missing Users Table Schema

**Problem**: The authentication system expected a `users` table, but it was missing from the database schema.

**Solution**: Created `schemas/0002_users_table.sql` with proper user authentication structure:

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

### 2. Insecure Password Hashing

**Problem**:
- `login.ts` had hardcoded mock authentication (`admin@example.com` / `admin`)
- `update_password.ts` used SHA-256 (insecure for passwords)

**Solution**:
- Added `bcryptjs` package for secure password hashing
- Updated `login.ts` to query D1 users table and verify bcrypt hashes
- Updated `update_password.ts` to use bcrypt instead of SHA-256

**Files Changed**:
- [package.json](../package.json#L19) - Added `bcryptjs` dependency
- [package.json](../package.json#L30) - Added `@types/bcryptjs` dev dependency
- [functions/api/auth/login.ts](../functions/api/auth/login.ts) - Real D1 authentication
- [functions/api/auth/update_password.ts](../functions/api/auth/update_password.ts) - Bcrypt hashing

---

### 3. No User Creation Script

**Problem**: No easy way to create admin users with proper bcrypt hashes.

**Solution**: Created `scripts/create-admin-user.js` helper script:

```bash
node scripts/create-admin-user.js mySecurePassword123

# Outputs:
# - User details (ID, email, role)
# - Bcrypt hash
# - Ready-to-run SQL command to insert user
```

---

## 📋 Changes Summary

| File | Change | Why |
|------|--------|-----|
| `schemas/0002_users_table.sql` | Created | Missing users table for authentication |
| `package.json` | Added bcryptjs | Secure password hashing for Workers |
| `functions/api/auth/login.ts` | Rewritten | Replace mock auth with real D1 queries |
| `functions/api/auth/update_password.ts` | Fixed | Replace SHA-256 with bcrypt |
| `scripts/create-admin-user.js` | Created | Helper to generate users with bcrypt hashes |
| `docs/FIX-401-ERRORS.md` | Updated | Include new schema + helper script instructions |

---

## 🔐 Security Improvements

### Before:
- ❌ Hardcoded credentials (`admin@example.com` / `admin`)
- ❌ SHA-256 password hashing (vulnerable to rainbow tables)
- ❌ No users table in database
- ❌ Manual bcrypt hash generation required

### After:
- ✅ Real D1 database authentication
- ✅ Bcrypt password hashing (industry standard)
- ✅ Proper users table with constraints
- ✅ Helper script for easy user creation
- ✅ Password verification via `bcrypt.compare()`

---

## 🚀 Deployment Steps

After these changes, you need to:

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Apply Users Table Schema**:
   ```bash
   wrangler d1 execute crisis2-db --file=./schemas/0002_users_table.sql --remote
   ```

3. **Create Admin User**:
   ```bash
   node scripts/create-admin-user.js yourSecurePassword123
   # Copy and run the SQL command from output
   ```

4. **Rebuild and Deploy**:
   ```bash
   npm run build
   # Cloudflare Pages will auto-deploy on git push
   ```

---

## 🧪 Testing Authentication

After configuration:

1. **Test Login Endpoint**:
   ```bash
   curl -X POST https://crisis4.pages.dev/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@example.com","password":"yourSecurePassword123"}'

   # Should return:
   # {"user":{"id":"...","email":"admin@example.com","role":"admin"}}
   ```

2. **Test Authenticated Endpoint**:
   ```bash
   curl https://crisis4.pages.dev/api/auth/me \
     -H "Cookie: session_token=YOUR_TOKEN_FROM_LOGIN"

   # Should return user info, NOT 401
   ```

3. **Test Password Update**:
   ```bash
   curl -X POST https://crisis4.pages.dev/api/auth/update_password \
     -H "Content-Type: application/json" \
     -H "Cookie: session_token=YOUR_TOKEN" \
     -d '{"password":"newSecurePassword456"}'

   # Should return: {"success":true}
   ```

---

## 📚 Related Documentation

- [FIX-401-ERRORS.md](FIX-401-ERRORS.md) - Comprehensive 401 error fix guide
- [DEPLOYMENT.md](DEPLOYMENT.md) - Full deployment guide
- [WEBSOCKET-UPGRADE.md](WEBSOCKET-UPGRADE.md) - WebSocket implementation

---

## 🔧 Code Examples

### Login Flow (functions/api/auth/login.ts:43-58)

```typescript
// Query users table from D1
const { results } = await env.DB.prepare(
  'SELECT id, email, password_hash, role, active FROM users WHERE email = ? AND active = 1'
).bind(email).all();

if (!results || results.length === 0) {
  return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  });
}

const user = results[0];

// Verify password against stored hash
const isValid = await bcrypt.compare(password, user.password_hash);
```

### Password Update (functions/api/auth/update_password.ts:25-30)

```typescript
// Hash the password securely using bcryptjs
const hashedPassword = await bcrypt.hash(password, 10);

// Update password in D1 users table
await env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
  .bind(hashedPassword, userId)
  .run();
```

---

## ✅ Verification Checklist

After applying these fixes:

- [ ] `npm install` completed successfully
- [ ] `schemas/0002_users_table.sql` applied to D1
- [ ] Admin user created with `scripts/create-admin-user.js`
- [ ] Login works with created credentials
- [ ] `/api/auth/me` returns 200 (not 401) when logged in
- [ ] `/api/feed_cache` returns 200 when authenticated
- [ ] Password update functionality works

---

## 💡 Key Takeaways

1. **Never use hardcoded credentials** - Always use database-backed authentication
2. **Never use SHA-256 for passwords** - Use bcrypt, argon2, or scrypt
3. **Cloudflare Workers support bcryptjs** - Pure JavaScript implementation works
4. **Helper scripts improve UX** - Makes user creation easy and secure
5. **Test authentication thoroughly** - Verify all endpoints after changes
