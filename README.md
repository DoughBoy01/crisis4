# Crisis2 - Market Intelligence Dashboard

Real-time market intelligence dashboard built with React, TypeScript, and Cloudflare Pages.

---

## 🚀 Quick Start

### Local Development

```bash
# One-command setup
./scripts/setup-local-dev.sh

# Or manually:
npm install
npm run db:local:init
npm run build
npm run dev:full
```

**Open**: http://localhost:8788

**Login**:
- Email: `admin@example.com`
- Password: `LocalAdmin123`

---

## 📋 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server (frontend only) |
| `npm run dev:full` | Full stack with Pages Functions |
| `npm run build` | Build for production |
| `npm run deploy` | Deploy to Cloudflare Pages |
| `npm run db:local:init` | Initialize local database |

See [docs/LOCAL-DEVELOPMENT.md](docs/LOCAL-DEVELOPMENT.md) for complete guide.

---

## 🏗️ Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Recharts** - Data visualization
- **Lucide React** - Icons

### Backend
- **Cloudflare Pages** - Hosting
- **Cloudflare Workers** - Serverless functions
- **D1 Database** - SQLite database
- **Durable Objects** - WebSocket state management
- **bcryptjs** - Password hashing
- **JWT** - Authentication tokens

---

## 📂 Project Structure

```
crisis2/
├── src/                    # React frontend
│   ├── components/        # UI components
│   ├── hooks/             # Custom React hooks
│   └── lib/               # API client & utilities
├── functions/             # Cloudflare Pages Functions
│   ├── api/               # API endpoints
│   │   ├── auth/         # Authentication
│   │   ├── feed_cache/   # RSS feed cache
│   │   └── ...
│   └── _middleware.ts    # Global middleware
├── schemas/              # D1 database schemas
├── scripts/              # Utility scripts
├── docs/                 # Documentation
└── wrangler.jsonc        # Cloudflare config
```

---

## 🗄️ Database

### Local Development
- SQLite database in `.wrangler/state/v3/d1/`
- Managed via `wrangler d1` commands
- Initialized with `npm run db:local:init`

### Production
- Cloudflare D1 (distributed SQLite)
- Database ID: `c3bdf315-1aca-46a5-a0fd-0f3aefced92a`

---

## 🌐 Deployment

### Automatic Deployment
Push to `main` branch triggers Cloudflare Pages deployment.

### Manual Deployment
```bash
npm run deploy
```

### URLs
- **Production**: https://crisis2.pages.dev
- **Preview**: https://[hash].crisis2.pages.dev

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [LOCAL-DEVELOPMENT.md](docs/LOCAL-DEVELOPMENT.md) | Complete local dev guide |
| [ADMIN-LOGIN-GUIDE.md](docs/ADMIN-LOGIN-GUIDE.md) | Admin authentication |
| [CLOUDFLARE-MIGRATION-STATUS.md](docs/CLOUDFLARE-MIGRATION-STATUS.md) | Migration roadmap |

---

## 🔧 Configuration

### Environment Variables

**Local** (`.dev.vars`):
```env
JWT_SECRET=local-dev-secret
```

**Production** (Cloudflare Pages):
```bash
echo "secret" | npx wrangler pages secret put JWT_SECRET --project-name crisis2
```

---

## 🐛 Troubleshooting

See [docs/LOCAL-DEVELOPMENT.md](docs/LOCAL-DEVELOPMENT.md) for detailed troubleshooting.

---

## 🔗 Links

- **Production**: https://crisis2.pages.dev
- **Documentation**: [docs/](docs/)
- **Wrangler Docs**: https://developers.cloudflare.com/workers/wrangler/

---

**Last Updated**: 2026-03-18
**Status**: Active Development
