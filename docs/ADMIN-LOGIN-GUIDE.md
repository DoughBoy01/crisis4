# Admin Login Guide

## Quick Answer

To log in as admin on https://crisis2.pages.dev:

1. **Navigate to the admin login page** - Click on your profile icon in the top-right header (or go directly to the diagnostics view which triggers admin login)
2. **Use credentials**:
   - Email: `admin@example.com`
   - Password: *You need to set this up first (see below)*

---

## ⚠️ Important: First-Time Setup Required

The admin user **does not exist yet** in your Cloudflare D1 database. You need to create it first.

---

## 🚀 How to Create Your Admin Account

### Step 1: Ensure Users Table Exists

First, make sure the users table is created in your D1 database:

```bash
npx wrangler d1 execute crisis2-db --remote --file=./schemas/0002_users_table.sql
```

This creates the `users` table with proper structure for authentication.

### Step 2: Generate Admin User

Run the admin user creation script with your desired password:

```bash
node scripts/create-admin-user.js YourSecurePassword123
```

**Example output**:
```
🔐 Generating bcrypt hash...
✅ Hash generated successfully!

📋 User Details:
   ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
   Email: admin@example.com
   Role: admin
   Password: YourSecurePassword123

🔑 Bcrypt Hash:
   $2a$10$N9qo8uLOickgx2ZoE/uK/.X7/example...

📝 Run this command to create the user:

wrangler d1 execute crisis2-db --remote --command="INSERT INTO users (id, email, password_hash, role, active, created_at) VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'admin@example.com', '$2a$10$N9qo8uLOickgx2ZoE/uK/.X7/example...', 'admin', 1, datetime('now'));"

✅ After running the command above, you can login with:
   Email: admin@example.com
   Password: YourSecurePassword123
```

### Step 3: Insert Admin User into Database

Copy and run the `wrangler d1 execute` command from the output above. It will look like:

```bash
npx wrangler d1 execute crisis2-db --remote --command="INSERT INTO users (id, email, password_hash, role, active, created_at) VALUES ('YOUR_ID', 'admin@example.com', 'YOUR_BCRYPT_HASH', 'admin', 1, datetime('now'));"
```

### Step 4: Verify User Was Created

Check that the user exists:

```bash
npx wrangler d1 execute crisis2-db --remote --command="SELECT email, role, active, created_at FROM users WHERE email = 'admin@example.com';"
```

Expected output:
```
┌─────────────────────┬────────┬────────┬──────────────────────┐
│ email               │ role   │ active │ created_at          │
├─────────────────────┼────────┼────────┼──────────────────────┤
│ admin@example.com   │ admin  │ 1      │ 2026-03-18 10:30:00 │
└─────────────────────┴────────┴────────┴──────────────────────┘
```

---

## 🔑 How to Log In

### Method 1: Via Header Button (Recommended)

1. Go to https://crisis2.pages.dev
2. Look for the **profile/user icon** in the top-right corner of the header
3. Click it
4. You'll be redirected to the admin login page
5. Enter:
   - **Email**: `admin@example.com`
   - **Password**: The password you set in Step 2

### Method 2: Via URL (Direct)

The app doesn't have a `/diagnostics` route accessible directly via URL. Instead:

1. Go to https://crisis2.pages.dev
2. Click the admin/profile icon in the header
3. This triggers the internal routing to show the AdminLogin component

### What Happens After Login

Once authenticated:
- ✅ You'll see the main dashboard
- ✅ Admin-only features will be unlocked (if any)
- ✅ Session cookie is set (HttpOnly, secure)
- ✅ Future API requests include authentication

---

## 🔐 Authentication Details

### How Login Works

1. **Frontend**: User enters email/password in `AdminLogin.tsx` component
2. **API Call**: POST to `/api/auth/login` with credentials
3. **Verification**:
   - Backend queries D1 `users` table for email
   - Compares password with stored bcrypt hash using `bcrypt.compare()`
   - Checks if user role is `admin`
4. **Session**: If valid, creates session token stored in HttpOnly cookie
5. **Response**: Returns user object with `{id, email, role}`

### Security Features

- ✅ **Bcrypt password hashing** (10 rounds)
- ✅ **HttpOnly session cookies** (can't be accessed by JavaScript)
- ✅ **Role-based access control** (admin vs. user)
- ✅ **Active user check** (inactive users can't login)
- ✅ **Credentials sent via POST** (not URL parameters)

---

## 📝 Complete Setup Example

Here's the full workflow from scratch:

```bash
# 1. Create users table
npx wrangler d1 execute crisis2-db --remote --file=./schemas/0002_users_table.sql

# 2. Generate admin user
node scripts/create-admin-user.js MyPassword123

# 3. Copy the INSERT command from output and run it
npx wrangler d1 execute crisis2-db --remote --command="INSERT INTO users (...)"

# 4. Verify user exists
npx wrangler d1 execute crisis2-db --remote --command="SELECT * FROM users;"

# 5. Go to https://crisis2.pages.dev and login!
```

---

## 🐛 Troubleshooting

### "Invalid credentials" Error

**Possible causes**:
1. User doesn't exist in database → Run Step 3 again
2. Wrong password → Check the password you used in Step 2
3. User is inactive → Check `active` column is `1` not `0`
4. Wrong email → Default is `admin@example.com`

**How to debug**:
```bash
# Check if user exists and is active
npx wrangler d1 execute crisis2-db --remote --command="SELECT email, role, active FROM users WHERE email = 'admin@example.com';"
```

### "Access denied. Admin only." Error

**Cause**: User exists but role is not `admin`

**Fix**:
```bash
npx wrangler d1 execute crisis2-db --remote --command="UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';"
```

### Session Expires Immediately

**Cause**: Session token not being set or cookies blocked

**Check**:
1. Open browser DevTools → Application/Storage → Cookies
2. Look for `session_token` cookie on `crisis2.pages.dev`
3. If missing, check that cookies are enabled for the site

### Can't Access Admin Login Page

**Cause**: Looking for `/admin` or `/login` URL

**Solution**:
- There's no direct URL route for admin login
- Click the user/profile icon in the header
- Or implement a custom route if needed

---

## 🔄 Changing Admin Password

### Method 1: Via Database (Recommended)

```bash
# Generate new hash
node scripts/create-admin-user.js NewPassword456

# Update database with new hash (copy hash from script output)
npx wrangler d1 execute crisis2-db --remote --command="UPDATE users SET password_hash = 'NEW_BCRYPT_HASH', updated_at = datetime('now') WHERE email = 'admin@example.com';"
```

### Method 2: Via API (When Logged In)

```bash
curl -X POST https://crisis2.pages.dev/api/auth/update_password \
  -H "Content-Type: application/json" \
  -H "Cookie: session_token=YOUR_SESSION_TOKEN" \
  -d '{"password":"NewPassword456"}'
```

---

## 👥 Creating Additional Admin Users

To create more admin accounts with different emails:

```bash
# Modify the script to accept email as parameter, or manually set values:
node scripts/create-admin-user.js StrongPassword789

# Then edit the INSERT command to use a different email:
npx wrangler d1 execute crisis2-db --remote --command="INSERT INTO users (id, email, password_hash, role, active, created_at) VALUES ('new-uuid-here', 'admin2@company.com', 'HASH_FROM_SCRIPT', 'admin', 1, datetime('now'));"
```

---

## 📊 Checking All Users

View all users in the database:

```bash
npx wrangler d1 execute crisis2-db --remote --command="SELECT id, email, role, active, created_at FROM users ORDER BY created_at DESC;"
```

---

## 🔗 Related Files

- [`src/components/AdminLogin.tsx`](../src/components/AdminLogin.tsx) - Login UI component
- [`functions/api/auth/login.ts`](../functions/api/auth/login.ts) - Authentication endpoint
- [`schemas/0002_users_table.sql`](../schemas/0002_users_table.sql) - Users table schema
- [`scripts/create-admin-user.js`](../scripts/create-admin-user.js) - User creation script
- [`docs/AUTH-IMPROVEMENTS.md`](./AUTH-IMPROVEMENTS.md) - Authentication system details

---

## ✅ Quick Checklist

Before attempting login, ensure:

- [ ] Users table created in D1 database
- [ ] Admin user created with `create-admin-user.js` script
- [ ] User inserted into database via `wrangler d1 execute`
- [ ] User verified with SELECT query
- [ ] Remembered the password you set
- [ ] Navigating to https://crisis2.pages.dev (not localhost)

---

**Last Updated**: 2026-03-18
**Status**: Ready for use after initial setup
**Default Email**: admin@example.com
**Default Password**: *You must set this during setup*
