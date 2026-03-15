# DawnSignal — Procurement Intelligence Platform

DawnSignal is an AI-powered overnight market intelligence platform designed for UK procurement teams. It monitors commodity prices, geopolitical events, and supply chain disruptions while you sleep, then delivers a personalised morning brief — in your inbox before the London market opens at 08:00 GMT.

---

## What It Does

Every morning, DawnSignal:

1. **Fetches overnight market data** from 22 sources — commodity futures, FX rates, shipping indices, and news feeds from Reuters, BBC, Al Jazeera, USDA, and more.
2. **Detects market-moving events** — price spikes, conflict escalations, shipping lane disruptions, trade policy changes.
3. **Generates a personalised AI brief** tailored to your role (buyer, trader, logistics director, risk analyst).
4. **Sends an HTML email** with your top decision, key price moves, sector intelligence, and specific procurement actions — with £-impact estimates attached.
5. **Updates a live dashboard** you can use throughout the day as a reference tool.

---

## Who It Is For

DawnSignal serves five user personas, each receiving a different analytical lens on the same underlying data:

| Persona | Focus |
|---------|-------|
| **General** | UK business owner / CFO — plain-English £ impact, energy and FX headlines |
| **Trader** | Commodity trader — price signals, momentum, entry/exit levels |
| **Agri** | Agricultural buyer — grain costs, fertilizer, Black Sea risk, harvest economics |
| **Logistics** | Logistics director — shipping lanes, BDI, bunker costs, rerouting decisions |
| **Analyst** | Risk analyst — all sectors, citable sources, client-ready report format |

---

## Core Capabilities

### Real-Time Market Monitoring
- 20+ instruments: Brent Crude, WTI, Natural Gas, Wheat, Corn, Soybeans, Copper, Gold, Baltic Dry Index, SCFI, GBP/USD, EUR/USD, and more
- Data refreshed every 15 minutes during trading hours
- Signal classification: **BUY / HOLD / WATCH / URGENT** per instrument

### Historical Context
- 10-year price percentile rankings (p10, p25, p50, p75, p90)
- Seasonal demand pressure indices by month
- Conflict zone activity vs. historical baseline frequency

### Geopolitical Risk Intelligence
- Active conflict zone monitoring: Red Sea / Yemen, Middle East / Gulf, Ukraine / Black Sea, Sahel / West Africa, Israel / Gaza, Taiwan Strait
- Cross-referenced with affected commodities and supply routes
- Escalation scoring vs. historical baseline

### Supply Chain Exposure Matrix
- Exposure scoring (0–100) per commodity market
- Factors: conflict proximity (40%), supply concentration (35%), UK import dependency (25%)
- Live boost from current price moves and shipping alerts

### Contingency Playbooks
- Pre-built response playbooks triggered by market conditions
- Scenarios: Brent Spike, Grain Disruption, Freight Surge, GBP Weakness, Geopolitical Escalation
- Step-by-step actions with owners and deadlines

### Personalised Email Briefs
- Dark-themed HTML email with persona-specific header colours
- Top decision hero block (signal, £ impact, deadline, rationale)
- Compounding risk alert when 2+ sectors are simultaneously adverse
- Sector intelligence table (analysis, cited news, forward outlook)
- Unsubscribe via tokenised link (no account required)

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, Radix UI primitives |
| Charts | Recharts |
| Icons | Lucide React |
| Database | Supabase (PostgreSQL) |
| Auth / Session | Supabase anon keys + localStorage session IDs |
| Edge Functions | Supabase Edge Functions (Deno) |
| AI | OpenAI GPT-4o |
| Email | Resend API |
| Scheduling | Supabase pg_cron (04:30 UTC daily) |
| Market Data | Stooq (Yahoo Finance proxy), EIA, ExchangeRate.host |
| News Sources | 19 RSS feeds (Reuters, BBC, FT, Al Jazeera, USDA, BoE, and more) |

---

## Project Structure

```
project/
├── src/
│   ├── components/          # React UI components (34 components)
│   │   └── ui/              # Radix-based primitive components
│   ├── hooks/               # React hooks (6 hooks)
│   ├── lib/                 # Utilities and Supabase client
│   ├── data/                # Static data scaffolding
│   ├── types/               # TypeScript type definitions
│   └── App.tsx              # Root component with routing
├── supabase/
│   ├── functions/           # Edge functions (4 functions)
│   │   ├── market-feeds/    # Overnight data fetcher
│   │   ├── ai-brief/        # GPT-4o brief generator
│   │   ├── overnight-pipeline/ # Orchestrator
│   │   └── send-morning-brief/ # Email sender
│   └── migrations/          # Database schema (16 migrations)
└── docs/                    # This documentation
```

---

## Documentation Index

| Document | Contents |
|----------|---------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design, data flow diagrams, key decisions |
| [DATABASE.md](./DATABASE.md) | Schema tables, RLS policies, all migrations |
| [EDGE-FUNCTIONS.md](./EDGE-FUNCTIONS.md) | All four edge functions in detail |
| [FRONTEND.md](./FRONTEND.md) | Components, hooks, derived data library |
| [DATA-PIPELINE.md](./DATA-PIPELINE.md) | Overnight pipeline, email delivery, scheduling |
