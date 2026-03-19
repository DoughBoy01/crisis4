# Local Development Guide

Complete guide for developing Crisis2 locally with Cloudflare Pages and D1.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Initialize Local Database
```bash
# Create tables
npm run db:local:init

# Or manually:
npx wrangler d1 execute crisis2-db --local --file=./schemas/0001_initial_schema.sql
npx wrangler d1 execute crisis2-db --local --file=./schemas/0002_users_table.sql
```

### 3. Create Local Admin User
```bash
# Generate hash
node scripts/create-admin-user.js YourPassword123

# Insert into local DB (copy command from script output)
npx wrangler d1 execute crisis2-db --local --command="INSERT INTO users (...)"
```

**Current Local Admin**:
- Email: `admin@example.com`
- Password: `LocalAdmin123`

### 4. Start Development Server
```bash
# Option 1: Frontend only (React dev server)
npm run dev
# → http://localhost:5173

# Option 2: Full stack with Pages Functions
npm run dev:full
# → http://localhost:8788

# Option 3: Functions only (requires pre-built dist/)
npm run dev:functions
```

---

## 📋 Development Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server (frontend only) |
| `npm run dev:full` | Build + Wrangler Pages dev (full stack) |
| `npm run dev:functions` | Wrangler Pages dev (requires build) |
| `npm run build` | Build React app to `dist/` |
| `npm run typecheck` | TypeScript type checking |
| `npm run db:local:init` | Initialize local D1 database |
| `npm run db:local:shell` | Run SQL on local database |
| `npm run db:remote:shell` | Run SQL on remote database |
| `npm run deploy` | Build and deploy to Cloudflare Pages |

---

## 🗄️ Database Commands

### Local Database (SQLite in `.wrangler/state/v3/d1/`)

```bash
# Execute SQL file
npx wrangler d1 execute crisis2-db --local --file=./path/to/file.sql

# Execute SQL command
npx wrangler d1 execute crisis2-db --local --command="SELECT * FROM users;"

# View all tables
npx wrangler d1 execute crisis2-db --local --command="SELECT name FROM sqlite_master WHERE type='table';"

# Check local admin user
npx wrangler d1 execute crisis2-db --local --command="SELECT email, role FROM users;"
```

### Remote Database (Production Cloudflare D1)

```bash
# Execute SQL file
npx wrangler d1 execute crisis2-db --remote --file=./path/to/file.sql

# Execute SQL command
npx wrangler d1 execute crisis2-db --remote --command="SELECT * FROM users LIMIT 5;"

# Check remote admin user
npx wrangler d1 execute crisis2-db --remote --command="SELECT email, role FROM users WHERE email = 'admin@example.com';"
```

---

## 🔐 Environment Variables

### Local Development (`.dev.vars`)

Create `.dev.vars` in the project root:

```env
# JWT Secret for authentication
JWT_SECRET=local-dev-secret-change-me

# Optional: Supabase (for legacy features)
# VITE_SUPABASE_URL=
# VITE_SUPABASE_ANON_KEY=

# Optional: OpenAI (for AI brief generation)
# OPENAI_API_KEY=
```

**Note**: `.dev.vars` is gitignored and not committed to version control.

### Production (Cloudflare Pages)

Set secrets via Cloudflare dashboard or wrangler:

```bash
# Set JWT secret
echo "your-production-secret" | npx wrangler pages secret put JWT_SECRET --project-name crisis2

# List all secrets
npx wrangler pages secret list --project-name crisis2
```

---

## 🛠️ Development Workflow

### Typical Workflow

1. **Make changes to code**
   ```bash
   # Edit files in src/, functions/, etc.
   ```

2. **Test locally**
   ```bash
   # Start dev server
   npm run dev:full

   # Or separate terminals:
   npm run dev           # Terminal 1: React dev server
   npm run dev:functions # Terminal 2: Pages Functions
   ```

3. **Type check**
   ```bash
   npm run typecheck
   ```

4. **Build**
   ```bash
   npm run build
   ```

5. **Deploy**
   ```bash
   npm run deploy
   ```

### Testing Authentication Locally

```bash
# Start full stack dev server
npm run dev:full

# In another terminal, test login
curl -X POST http://localhost:8788/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"LocalAdmin123"}'

# Should return:
# {"user":{"id":"...","email":"admin@example.com","role":"admin"}}
```

### Adding Sample Data

```bash
# Insert feed cache data
npx wrangler d1 execute crisis2-db --local --command="
INSERT INTO feed_cache (id, fetched_at, payload, created_at)
VALUES (
  'test-feed-1',
  datetime('now'),
  '{\"fetched_at\":\"2026-03-18T12:00:00Z\",\"sources\":[]}',
  datetime('now')
);"

# Verify
npx wrangler d1 execute crisis2-db --local --command="SELECT * FROM feed_cache;"
```

---

## 🌐 URLs

### Local Development

| Service | URL | Description |
|---------|-----|-------------|
| **React Dev** | http://localhost:5173 | Vite dev server (fast refresh) |
| **Pages Dev** | http://localhost:8788 | Wrangler Pages dev (full stack) |
| **API Functions** | http://localhost:8788/api/* | Pages Functions endpoints |

### Production

| Service | URL | Description |
|---------|-----|-------------|
| **Production** | https://crisis2.pages.dev | Main production site |
| **Preview** | https://[hash].crisis2.pages.dev | Branch previews |
| **API** | https://crisis2.pages.dev/api/* | Production API |

---

## 📁 Project Structure

```
crisis2/
├── src/                    # React frontend
│   ├── components/        # UI components
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utilities and API client
│   └── App.tsx            # Main app component
├── functions/             # Cloudflare Pages Functions
│   ├── api/               # API endpoints
│   │   ├── auth/         # Authentication
│   │   ├── feed_cache/   # RSS feed cache
│   │   └── ...           # Other endpoints
│   ├── _middleware.ts    # Global middleware
│   └── types.ts          # Shared types
├── schemas/              # D1 database schemas
│   ├── 0001_initial_schema.sql
│   └── 0002_users_table.sql
├── scripts/              # Utility scripts
│   └── create-admin-user.js
├── .dev.vars             # Local env vars (gitignored)
├── .wrangler/            # Local Wrangler data (gitignored)
├── wrangler.jsonc        # Wrangler configuration
└── package.json          # npm scripts and dependencies
```

---

## 🔄 Differences: Local vs Production

### Local Development
- ✅ SQLite database (`.wrangler/state/v3/d1/`)
- ✅ Environment variables from `.dev.vars`
- ✅ Hot reload with `--live-reload`
- ❌ No Durable Objects (not supported locally)
- ❌ WebSocket won't work (falls back to HTTP)

### Production (Cloudflare)
- ✅ Cloudflare D1 (distributed SQLite)
- ✅ Environment variables from Pages dashboard
- ✅ Durable Objects for WebSocket
- ✅ Real-time WebSocket updates
- ✅ CDN distribution

---

## 🐛 Troubleshooting

### "Module not found" errors

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Local database not found

```bash
# Re-initialize local database
npm run db:local:init
```

### "Invalid credentials" when logging in locally

```bash
# Check if admin user exists
npx wrangler d1 execute crisis2-db --local --command="SELECT * FROM users;"

# If empty, create admin user
node scripts/create-admin-user.js LocalAdmin123
# Then run the INSERT command from output
```

### Changes not reflecting in dev server

```bash
# Rebuild and restart
npm run build
npm run dev:full
```

### Port already in use

```bash
# Find and kill process on port 8788
lsof -ti:8788 | xargs kill -9

# Or use different port
npx wrangler pages dev dist --port 8789
```

### TypeScript errors

```bash
# Run type checker
npm run typecheck

# Fix any errors before deploying
```

---

## 📝 Common Tasks

### Add a New API Endpoint

1. Create file: `functions/api/your-endpoint/index.ts`
2. Implement handler:
   ```typescript
   export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
     // Your logic here
     return new Response(JSON.stringify({ success: true }));
   };
   ```
3. Test locally: `http://localhost:8788/api/your-endpoint`
4. Deploy: `npm run deploy`

### Add a Database Table

1. Create migration: `schemas/0003_your_table.sql`
2. Apply locally:
   ```bash
   npx wrangler d1 execute crisis2-db --local --file=./schemas/0003_your_table.sql
   ```
3. Apply to production:
   ```bash
   npx wrangler d1 execute crisis2-db --remote --file=./schemas/0003_your_table.sql
   ```

### Update Frontend Component

1. Edit file in `src/components/YourComponent.tsx`
2. See changes instantly at `http://localhost:5173` (if using `npm run dev`)
3. Build and test: `npm run build && npm run dev:functions`
4. Deploy: `npm run deploy`

---

## 🔗 Useful Links

- **Wrangler Docs**: https://developers.cloudflare.com/workers/wrangler/
- **D1 Documentation**: https://developers.cloudflare.com/d1/
- **Pages Functions**: https://developers.cloudflare.com/pages/functions/
- **Vite Documentation**: https://vitejs.dev/

---

## ✅ Pre-deployment Checklist

Before deploying to production:

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] Test login locally works
- [ ] Test main features locally
- [ ] Database migrations applied to remote
- [ ] Environment variables set in Cloudflare
- [ ] Git committed and pushed

---

**Last Updated**: 2026-03-18
**Status**: Ready for local development
**Local Admin**: admin@example.com / LocalAdmin123
