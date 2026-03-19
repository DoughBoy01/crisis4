# 🚀 Local Development Quick Start

## One-Command Setup

```bash
./scripts/setup-local-dev.sh
```

This script will:
1. ✅ Install npm dependencies
2. ✅ Initialize local D1 database
3. ✅ Create local admin user
4. ✅ Create .dev.vars file
5. ✅ Build the project

---

## Start Development Server

```bash
npm run dev:full
```

Open: **http://localhost:8788**

---

## Login Credentials

```
Email:    admin@example.com
Password: LocalAdmin123
```

---

## Common Commands

```bash
# Development
npm run dev              # Frontend only (Vite)
npm run dev:full         # Full stack (Pages Functions)

# Database
npm run db:local:init    # Initialize local DB
npx wrangler d1 execute crisis2-db --local --command="SELECT * FROM users;"

# Build & Deploy
npm run build            # Build for production
npm run deploy           # Deploy to Cloudflare

# Type checking
npm run typecheck        # Check TypeScript errors
```

---

## Project URLs

| Environment | URL | Database |
|-------------|-----|----------|
| **Local** | http://localhost:8788 | Local SQLite |
| **Production** | https://crisis2.pages.dev | Cloudflare D1 |

---

## Troubleshooting

### Port already in use
```bash
lsof -ti:8788 | xargs kill -9
```

### Reset local database
```bash
rm -rf .wrangler/state/v3/d1
npm run db:local:init
```

### Reinstall dependencies
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## Full Documentation

See [docs/LOCAL-DEVELOPMENT.md](docs/LOCAL-DEVELOPMENT.md) for complete guide.

---

**Status**: Ready for local development ✅
