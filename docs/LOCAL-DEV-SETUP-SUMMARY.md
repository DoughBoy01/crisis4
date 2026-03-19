# Local Development Setup - Summary

## What Was Configured

I've set up your Crisis2 project for local development with Cloudflare Pages and D1.

---

## ✅ Changes Made

### 1. Updated `wrangler.jsonc`
**Before**:
```jsonc
{
  "d1_databases": [{
    "binding": "DB",
    "database_name": "crisis2-db",
    "database_id": "c3bdf315-1aca-46a5-a0fd-0f3aefced92a",
    "remote": true  // ❌ Forces remote database
  }]
}
```

**After**:
```jsonc
{
  "d1_databases": [{
    "binding": "DB",
    "database_name": "crisis2-db",
    "database_id": "c3bdf315-1aca-46a5-a0fd-0f3aefced92a"
    // ✅ No "remote": true = uses local SQLite by default
  }]
}
```

### 2. Created `.dev.vars`
Local environment variables file (gitignored):
```env
JWT_SECRET=local-dev-secret-change-me-in-production
```

### 3. Updated `.gitignore`
Added entries to ignore local development files:
```
.dev.vars
.wrangler/
.mf/
```

### 4. Added npm Scripts
New commands in `package.json`:
```json
{
  "dev:full": "npm run build && wrangler pages dev dist --live-reload",
  "dev:functions": "wrangler pages dev dist --port 8788",
  "db:local:init": "wrangler d1 execute crisis2-db --local --file=...",
  "db:local:shell": "wrangler d1 execute crisis2-db --local --command",
  "db:remote:shell": "wrangler d1 execute crisis2-db --remote --command",
  "deploy": "npm run build && wrangler pages deploy dist --project-name crisis2 --branch main"
}
```

### 5. Created Setup Script
`scripts/setup-local-dev.sh` - One-command initialization:
- Installs dependencies
- Creates local database
- Creates admin user
- Builds project
- Creates .dev.vars

### 6. Initialized Local Database
Created local SQLite database with:
- All tables from production schema
- Local admin user (admin@example.com / LocalAdmin123)
- Located in `.wrangler/state/v3/d1/`

### 7. Created Documentation
- `docs/LOCAL-DEVELOPMENT.md` - Comprehensive guide (140+ lines)
- `LOCAL-DEV-QUICKSTART.md` - Quick reference
- Updated `README.md` - Project overview

---

## 🎯 How to Use

### First Time Setup
```bash
# One command does everything
./scripts/setup-local-dev.sh
```

### Start Development
```bash
# Full stack (recommended)
npm run dev:full

# Or separate terminals:
npm run dev           # Terminal 1: Frontend
npm run dev:functions # Terminal 2: API Functions
```

### Access Application
- **URL**: http://localhost:8788
- **Email**: admin@example.com
- **Password**: LocalAdmin123

---

## 🔄 Development vs Production

### Local Development
| Feature | Status | Details |
|---------|--------|---------|
| Database | ✅ Local SQLite | `.wrangler/state/v3/d1/` |
| Authentication | ✅ Working | JWT with local secret |
| API Endpoints | ✅ Working | All `/api/*` routes |
| RSS Feeds | ✅ Manual trigger | POST to `/api/feed_cache/trigger` |
| WebSocket | ❌ Not supported | Falls back to HTTP |
| Durable Objects | ❌ Not supported | Production only |

### Production (Cloudflare)
| Feature | Status | Details |
|---------|--------|---------|
| Database | ✅ Cloudflare D1 | Distributed SQLite |
| Authentication | ✅ Working | JWT with Pages secret |
| API Endpoints | ✅ Working | All `/api/*` routes |
| RSS Feeds | ✅ Working | HTTP endpoint available |
| WebSocket | ⚠️ Configured | Needs DO binding in dashboard |
| Durable Objects | ⚠️ Configured | Needs dashboard setup |

---

## 📊 Database Comparison

### Local Database
```bash
# Location
.wrangler/state/v3/d1/crisis2-db-c3bdf315-1aca-46a5-a0fd-0f3aefced92a.sqlite

# Query
npx wrangler d1 execute crisis2-db --local --command="SELECT * FROM users;"

# Admin
Email: admin@example.com
Password: LocalAdmin123
```

### Production Database
```bash
# Database ID
c3bdf315-1aca-46a5-a0fd-0f3aefced92a

# Query
npx wrangler d1 execute crisis2-db --remote --command="SELECT * FROM users;"

# Admin
Email: admin@example.com
Password: Admin123Secure
```

---

## 🛠️ Common Tasks

### Add Test Data Locally
```bash
npx wrangler d1 execute crisis2-db --local --command="
INSERT INTO feed_cache (id, fetched_at, payload, created_at)
VALUES ('test-1', datetime('now'), '{\"test\": \"data\"}', datetime('now'));
"
```

### Reset Local Database
```bash
rm -rf .wrangler/state/v3/d1
npm run db:local:init
```

### Test API Locally
```bash
# Login
curl -X POST http://localhost:8788/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"LocalAdmin123"}'

# Get feed cache
curl http://localhost:8788/api/feed_cache
```

### Deploy to Production
```bash
npm run deploy
```

---

## 📝 Important Notes

### What Works Locally
✅ Frontend React app
✅ All API endpoints (`/api/*`)
✅ Database queries (local SQLite)
✅ Authentication (login/logout)
✅ HTTP data fetching
✅ User settings
✅ Feed cache retrieval

### What Doesn't Work Locally
❌ WebSocket real-time updates (needs Durable Objects)
❌ Durable Objects (Cloudflare production feature)
❌ Scheduled cron jobs (needs Cloudflare infrastructure)
❌ Email sending (needs email service integration)

### Workarounds
- **WebSocket**: Use HTTP fallback (already implemented)
- **RSS Feeds**: Manually trigger with `POST /api/feed_cache/trigger`
- **Cron**: Manually run endpoints as needed

---

## 🔐 Security Notes

### Local Development
- `.dev.vars` is gitignored (never committed)
- Local database is not synced to production
- JWT secret is different from production
- Local admin password is separate

### Production
- Secrets managed via Cloudflare Pages dashboard
- Production database is separate
- JWT secret set via `wrangler pages secret put`
- Production admin password is different

---

## 📚 Next Steps

1. **Try it out**:
   ```bash
   ./scripts/setup-local-dev.sh
   npm run dev:full
   ```

2. **Make changes**:
   - Edit files in `src/` or `functions/`
   - See changes instantly with live reload

3. **Test locally**:
   - Login with local credentials
   - Test API endpoints
   - Check database queries

4. **Deploy to production**:
   ```bash
   npm run deploy
   ```

---

## 🔗 Resources

- **Quick Start**: [LOCAL-DEV-QUICKSTART.md](../LOCAL-DEV-QUICKSTART.md)
- **Full Guide**: [LOCAL-DEVELOPMENT.md](./LOCAL-DEVELOPMENT.md)
- **Main README**: [README.md](../README.md)
- **Wrangler Docs**: https://developers.cloudflare.com/workers/wrangler/

---

## ✅ Verification Checklist

After setup, verify everything works:

- [ ] `npm run dev:full` starts without errors
- [ ] Can open http://localhost:8788
- [ ] Can login with local credentials
- [ ] Dashboard loads and displays UI
- [ ] Can query local database
- [ ] Type checking passes: `npm run typecheck`
- [ ] Build succeeds: `npm run build`

---

**Setup Date**: 2026-03-18
**Status**: ✅ Ready for local development
**Local Admin**: admin@example.com / LocalAdmin123
