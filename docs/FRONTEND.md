# Frontend

The frontend is a single-page React application built with Vite and TypeScript. It is designed as a live intelligence dashboard — data refreshes every 15 minutes, and the UI reacts to changes without page reloads.

---

## Application Structure

```
src/
├── App.tsx                     # Root component: routing between HomePage and Dashboard
├── main.tsx                    # React DOM entry point
├── index.css                   # Global styles (Tailwind base + custom CSS variables)
├── vite-env.d.ts               # Vite environment type declarations
│
├── components/                 # UI components
│   ├── ui/                     # Primitive components (Radix-based)
│   └── [feature components]    # Domain-specific components
│
├── hooks/                      # Custom React hooks
├── lib/                        # Utilities and Supabase client
├── data/                       # Static scaffolding
└── types/                      # TypeScript interfaces
```

---

## Pages

### `App.tsx`

Root component. Manages top-level routing between two views:

- **HomePage** — Shown on first load if no preferences are set. Landing page with persona selection and email subscription.
- **Dashboard** — Main intelligence dashboard.

Also renders a global `AlertBanner` component that overlays critical alerts.

### `HomePage.tsx`

Landing page / onboarding flow. Shows:
- Platform value proposition
- Persona selection grid (5 cards)
- Email subscription form (`EmailSubscribe`)
- ROI savings bar (`ROISavingsBar`)

Users select their persona here, which is stored in user settings and used to personalise the AI brief.

### `Dashboard.tsx`

Main application view. Orchestrates all hooks and passes derived data down to child components.

**Data acquisition:**
```typescript
const { data: feeds, loading, lastFetchedAt, nextRefreshIn } = useMarketFeeds();
const { context: historical } = useHistoricalContext();
const { settings } = useUserSettings();
const { brief } = useDailyBrief(persona);
```

**Client-side derivation:**
```typescript
const marketItems = deriveMarketItems(feeds, historical);
const actionItems = deriveActionItems(feeds);
const alerts = deriveMorningAlerts(feeds);
const conflictZones = deriveConflictZones(feeds, historical);
const supplyExposure = deriveSupplyExposure(feeds);
const playbooks = deriveContingencyPlaybooks(feeds);
const stats = deriveOvernightStats(feeds);
```

**Layout:** Three-column layout (market section, brief/actions, intel sidebar) on desktop, single-column stack on mobile.

---

## Components

### Layout & Navigation

#### `Header.tsx`
Top navigation bar. Shows:
- DawnSignal logo (lucide `Zap` icon)
- Current time in user's timezone (from `useUserSettings`)
- `TimezoneSelector` dropdown
- Link to `DiagnosticsPage`
- `DataFreshnessBar`

#### `PersonaBar.tsx`
Horizontal tab strip for switching between the 5 personas. Each tab has an icon, label, and brief description. Active persona is highlighted; switching triggers a re-fetch of the AI brief.

#### `PersonaHero.tsx`
Full-width hero section below the header, personalised to the active persona. Shows persona name, description, and accent-coloured background.

#### `SectorTabs.tsx`
Tab navigation for filtering market data by category: All / Energy / Agricultural / Freight / Metals / FX.

---

### Market & Price Display

#### `MarketCard.tsx`
Card for a single instrument. Shows:
- Instrument name and short name
- Current price with currency and unit
- 24h change (value and percentage), colour-coded (red/green)
- Weekly change
- Signal badge (`BUY`/`HOLD`/`WATCH`/`URGENT`)
- Rationale text (natural-language explanation)
- `SparkLine` mini chart
- Percentile context badge (if historical data available)
- Seasonal pressure indicator
- Clickable — opens `PriceChartModal`

#### `SparkLine.tsx`
Minimal SVG sparkline showing 24-hour price history. Colour matches signal direction (green for favourable, amber for watch, red for urgent). Uses SVG path rendering — no charting library dependency.

#### `PriceChartModal.tsx`
Modal overlay triggered by clicking a `MarketCard`. Shows:
- Instrument name and live price
- `CommodityMiniChart` (recharts area chart)
- `PriceRangeChart` (percentile band chart)
- Historical context stats (percentile rank, seasonal pressure)
- Close button

#### `CommodityMiniChart.tsx`
Recharts `AreaChart` displaying 24h or 7-day price history for a single instrument. Responsive container. Y-axis domain auto-scales to data range. Tooltip shows price and timestamp formatted in user's timezone.

#### `PriceRangeChart.tsx`
Horizontal bar chart showing current price vs. 10-year percentile bands (p10, p25, p50, p75, p90). Uses Recharts `BarChart`. Displays a marker line for the current price overlaid on the band. Colour bands: sky (low) → emerald → amber → orange → red (high).

#### `LivePriceBanner.tsx`
Rotating ticker banner at the top of the dashboard. Cycles through top movers every 3 seconds. Shows symbol, current price, and change percentage. Red/green colouring based on direction.

---

### Signal & Action Display

#### `SignalBadge.tsx`
Reusable badge component for `BUY` / `HOLD` / `WATCH` / `URGENT` signals.

| Signal | Colour | Use case |
|--------|--------|---------|
| `BUY` | Emerald | Favourable entry — price is down, opportunity to lock in |
| `URGENT` | Red | Price is up significantly — review unhedged exposure immediately |
| `WATCH` | Amber | Price moving; monitor but no immediate action required |
| `HOLD` | Slate | No significant movement — maintain current strategy |

#### `ActionPanel.tsx`
Panel listing derived `ActionItem` objects from `deriveActionItems(feeds)`. Each action shows:
- Signal badge
- Title (imperative sentence)
- Detail paragraph
- Market and evidence text
- Deadline (if time-sensitive)
- ROI estimate (e.g., "£12,000 saving on 500t contract")
- Completion checkbox (via `useActionCompletions`)

Actions are sorted: URGENT first, then BUY, then WATCH, then HOLD.

#### `AlertBanner.tsx`
Full-width banner showing up to 3 critical alerts from `deriveMorningAlerts(feeds)`. Only visible when severity is `critical` or `high`. Shows alert title, body, source, and affected markets. Dismissible per alert (uses local state; not persisted).

#### `DailyDiff.tsx`
Compact stats bar showing overnight market movements:
- Top 5 movers (name, change%, colour-coded)
- Total headline count scanned
- Top single mover (largest absolute move)
- Last updated timestamp

---

### Risk & Intelligence

#### `ConflictRiskMap.tsx`
Panel showing active geopolitical risk zones from `deriveConflictZones(feeds, historical)`. For each zone:
- Zone name and region
- Risk level badge (`CRITICAL` / `HIGH` / `ELEVATED` / `MODERATE` / `LOW`)
- Affected commodities and trade routes
- Latest headline with source link
- Evidence count (number of matching news items)
- Intensity vs. historical baseline (e.g., "+50% vs norm")
- Supply impact statement

Zones sorted by risk level (CRITICAL first).

#### `CrisisCorrelationTable.tsx`
Matrix table cross-referencing active conflict zones against commodities they affect. Cells show risk level colour. Allows users to quickly see which commodities are exposed to multiple conflict zones simultaneously.

#### `CrisisTimeline.tsx`
Timeline view of recent conflict/supply events extracted from news feeds. Shows:
- Event description
- Source
- Time ago
- Associated conflict zone
- Commodity impact

Sorted most-recent first.

#### `SupplyChainExposure.tsx`
Scoring matrix showing supply exposure per commodity market from `deriveSupplyExposure(feeds)`. For each market:
- Exposure score (0–100) with colour bar
- Conflict proximity sub-score
- Supply concentration sub-score
- UK import dependency
- Top risk summary
- Linked conflict zones
- Mitigation note

Sorted by exposure score descending.

#### `ShippingLaneStatus.tsx`
Status cards for major shipping corridors:
- Red Sea / Bab-el-Mandeb
- Suez Canal
- Panama Canal
- Cape of Good Hope

Each shows current status (DISRUPTED / CONGESTED / NORMAL), transit time impact, and key news.

#### `ContingencyPlaybook.tsx`
Playbook cards from `deriveContingencyPlaybooks(feeds)`. Active playbooks (where conditions are currently met) are highlighted. Each card shows:
- Trigger condition
- Activation evidence (if active)
- Severity
- Step-by-step response plan (owner + deadline per step)
- Affected markets

---

### Briefing & Reports

#### `MorningBrief.tsx`
Full AI brief display for the dashboard. Renders all fields from the `DailyBrief` type:
- `top_decision` hero block
- `narrative` paragraph
- `three_things` numbered list
- `compounding_risk` warning block
- `sector_forward_outlook` table
- `geopolitical_context` paragraph

Includes persona selector and loading/generating states.

#### `DailyBriefPreview.tsx`
Compact version of `MorningBrief` shown in the dashboard sidebar. Shows `top_decision` hero, narrative summary, and a link to the full brief. Used in the `IntelSidebar`.

#### `LiveNewsFeed.tsx`
Scrollable list of recent headlines from all news sources. Filterable by category (All / Energy / Agri / Geopolitical / Macro / Freight). Shows:
- Headline text (clickable link)
- Source name
- Time ago
- Category badge

#### `IntelSidebar.tsx`
Right-hand sidebar panel on the dashboard. Contains:
- `DailyBriefPreview`
- `LiveNewsFeed`
- `AlertBanner` (inline variant)

---

### User Preferences & Data

#### `TimezoneSelector.tsx`
Dropdown (using native `<select>`) for choosing the display timezone. Options include 13 major timezones (London, New York, Chicago, Dubai, Singapore, Tokyo, etc.), each showing the timezone name and UTC offset.

On change, calls `useUserSettings().updateTimezone(tz)` which persists to the database.

#### `EmailSubscribe.tsx`
Email subscription form. Fields:
- Email address (required, validated)
- Name (optional)
- Persona selector (5 radio options)

On submit, calls `send-morning-brief` edge function with `action: "subscribe"`.

Shows confirmation message or error state after submission. Handles duplicate email (reactivation) gracefully.

#### `ROISavingsBar.tsx`
Horizontal bar showing the potential ROI of the platform. Computed from the highest-ROI action item in `deriveActionItems()`. Example: "Acting on today's fuel signal could save £12,000 on a 500t contract — 24× your annual subscription."

---

### Status & Diagnostics

#### `DataFreshnessBar.tsx`
Compact bar in the header showing:
- Age of current market data (e.g., "Data 4m old")
- Countdown to next refresh (e.g., "Refreshing in 11:23")
- Visual indicator: green (fresh < 5min), amber (5–15min), red (stale > 15min)

#### `AgentRunHistory.tsx`
List of recent pipeline runs from `pipeline_runs` table. Shows:
- Run date and time
- Duration
- Whether it was forced
- Status per step (market-feeds, ai-brief, send-morning-brief)
- Error details if any step failed

Used in `DiagnosticsPage`.

#### `DiagnosticsPage.tsx`
Admin/debug view accessible from the header. Contains:
- `AgentRunHistory` (recent pipeline runs)
- `DataFreshnessBar` (detailed view)
- Feed source status table (each source: name, type, success/error, accuracy score, age)
- Manual pipeline trigger buttons (via `DevControlsPanel`)

#### `DevControlsPanel.tsx`
Developer control panel (visible in dev mode or when explicitly enabled). Buttons:
- "Refresh feeds now" — calls `market-feeds` immediately
- "Generate brief (force)" — calls `ai-brief` with `force: true`
- "Run full pipeline" — calls `overnight-pipeline` with `force: true`
- Feed cache status

---

## Hooks

### `useMarketFeeds`

**File:** `src/hooks/useMarketFeeds.ts`

Manages live market data fetching with auto-refresh.

```typescript
const {
  data,             // FeedPayload | null
  loading,          // boolean
  error,            // string | null
  lastFetchedAt,    // ISO string | null
  nextRefreshIn,    // seconds until next auto-refresh
  secondsSinceRefresh, // elapsed seconds since last fetch
  refetch,          // () => void — manual trigger
} = useMarketFeeds();
```

**Behaviour:**
- On mount: immediately calls `market-feeds` edge function
- On success: persists result to `feed_cache` table; sets `data` state
- Auto-refresh: every 15 minutes (900 seconds)
- Countdown timer: updates every 1 second

**Helper functions exported from this file:**
```typescript
getBrentFromFeeds(feeds: FeedPayload): FeedSource | undefined
getFxFromFeeds(feeds: FeedPayload): FeedSource | undefined
getYahooFromFeeds(feeds: FeedPayload): FeedSource | undefined
getYahooQuote(feeds: FeedPayload, symbol: string): Quote | undefined
getNewsItems(feeds: FeedPayload, sourceNames?: string[]): NewsItem[]
getSourceByName(feeds: FeedPayload, name: string): FeedSource | undefined
getAgeMinutes(isoTimestamp: string): number
formatAgeLabel(minutes: number): string  // "5m ago", "2h 30m ago"
formatCountdown(seconds: number): string // "14:30", "02:45:12"
```

---

### `useDailyBrief`

**File:** `src/hooks/useDailyBrief.ts`

Loads or generates a persona-specific AI brief.

```typescript
const {
  brief,       // DailyBrief | null
  loading,     // true while checking cache
  generating,  // true while AI is generating
  error,       // string | null
  cached,      // true if loaded from DB cache
  trigger,     // (feeds, persona) => void — manually trigger generation
} = useDailyBrief(persona);
```

**Behaviour:**
- On mount: queries `daily_brief` table for today's brief + active persona
- If found in DB: returns immediately with `cached: true`
- If not found: sets `generating: true`, calls `ai-brief` edge function, upserts result to DB
- Re-queries when `persona` prop changes

---

### `useUserSettings`

**File:** `src/hooks/useUserSettings.ts`

Manages per-session user preferences (currently just timezone).

```typescript
const {
  settings,         // { timezone: string }
  loading,          // boolean
  updateTimezone,   // (tz: string) => Promise<void>
} = useUserSettings();
```

**Session ID:** Generated once via `crypto.randomUUID()` and stored in `localStorage` under `"dawnsignal_session_id"`. Stable across page reloads.

**Behaviour:**
- On mount: reads session ID from localStorage (creates if missing)
- Queries `user_settings` table for that session ID
- If not found: creates row with default timezone `'Europe/London'`
- `updateTimezone(tz)`: upserts new value; updates local state immediately for instant UI response

---

### `useHistoricalContext`

**File:** `src/hooks/useHistoricalContext.ts`

Loads static reference data from the database.

```typescript
const {
  context,  // { percentiles, seasonal, conflictBaselines }
  loading,  // boolean
  error,    // string | null
} = useHistoricalContext();
```

**Fetches on mount:**
- `commodity_percentiles` (all rows)
- `commodity_seasonal_patterns` (all rows)
- `conflict_zone_baselines` (all rows)

**Exported helper functions:**
```typescript
computePercentileRank(price: number, perc: CommodityPercentile): number
// Returns 1–99 by interpolating between p10/p25/p50/p75/p90

getPercentileLabel(rank: number): { label: string, color: string, bg: string }
// rank >= 90: "Near 10-yr high" (red)
// rank >= 75: "Above 10-yr avg" (orange)
// rank >= 50: "Mid-range" (amber)
// rank >= 25: "Below 10-yr avg" (emerald)
// rank < 25:  "Near 10-yr low" (sky)

getSeasonalPressure(commodityId: string, seasonal: SeasonalPattern[], month?: number): SeasonalPattern | null

getConflictBaseline(zoneId: string, baselines: ConflictZoneBaseline[]): ConflictZoneBaseline | null

scoreVsBaseline(evidenceCount: number, baseline: ConflictZoneBaseline): {
  label: string,
  vsBaseline: string,  // "+50% vs norm"
  color: string,
}
```

---

### `useDailyDiff`

**File:** `src/hooks/useDailyDiff.ts`

Derives overnight market statistics from feed data.

```typescript
const {
  topMovers,     // OvernightStat[] — top 5 by absolute % change
  headlineCount, // number — total headlines scanned
  topMover,      // { label, cp, price, signal } | null — single largest mover
} = useDailyDiff(feeds);
```

Uses `deriveOvernightStats(feeds)` and `deriveTopMover(feeds)` from `feedDerived.ts`.

---

### `useActionCompletions`

**File:** `src/hooks/useActionCompletions.ts`

Tracks which action items the user has completed today.

```typescript
const {
  completedIds,          // string[] — action IDs completed today
  markComplete,          // (actionId: string) => Promise<void>
  isComplete,            // (actionId: string) => boolean
  clearDay,              // () => Promise<void>
} = useActionCompletions();
```

**Behaviour:**
- On mount: loads today's completions from `action_completions` table for current session ID
- `markComplete(id)`: inserts row; updates local state optimistically
- `isComplete(id)`: checks local `completedIds` array (no DB query)
- `clearDay()`: deletes all completions for today's date in current session

---

## `feedDerived.ts` — Client-Side Intelligence Library

**File:** `src/lib/feedDerived.ts`

This is the core intelligence engine of the frontend. It transforms raw `FeedPayload` data into actionable market intelligence through a series of pure functions. No database calls. No side effects.

### `deriveMarketItems(feeds, historicalContext?)`

Maps quotes from the feed to `MarketItem` objects, enriched with signals, rationale, and historical context.

**SYMBOL_CONFIG map** (hardcoded metadata for each ticker):

| Symbol | Name | Category |
|--------|------|----------|
| `BZ=F` | Brent Crude Oil (ICE) | energy |
| `CL=F` | WTI Crude Oil | energy |
| `NG=F` | Natural Gas | energy |
| `ZW=F` | CBOT Wheat | agricultural |
| `ZC=F` | CBOT Corn | agricultural |
| `ZS=F` | CBOT Soybeans | agricultural |
| `HG=F` | COMEX Copper | metals |
| `GC=F` | COMEX Gold | metals |
| `SI=F` | COMEX Silver | metals |
| `BDI` | Baltic Dry Index | freight |
| `SCFI` | Shanghai Containerized Freight | freight |
| `GBPUSD=X` | GBP/USD | fx |
| `EURUSD=X` | EUR/USD | fx |

**Signal logic:**
```
changePercent <= -1.5% → BUY
changePercent >= 2.0%  → URGENT
abs(changePercent) >= 0.5% → WATCH
else → HOLD
```

**Rationale generation** (examples):
- BUY on Brent: "Brent down 1.8% overnight — favourable entry window before European open. Consider locking forward contracts."
- URGENT on Wheat: "Wheat up 2.1% — supply concern or weather event. Review open purchase orders immediately."
- WATCH on GBP/USD: "Sterling softened 0.7% vs dollar — all USD-denominated imports are marginally more expensive."

### `deriveActionItems(feeds)`

Generates specific, actionable procurement recommendations from live feed data.

**Decision logic per market:**

| Market | BUY trigger | URGENT trigger | ROI calculation |
|--------|------------|----------------|----------------|
| Brent / Diesel | Brent < -1.5% | Brent > +2.0% | 500t × ΔPrice × 0.85 (diesel factor) |
| Wheat | Wheat < -1.5% | Wheat > +2.0% | 200t × ΔPence per bushel → £/t |
| Natural Gas | NG < -2.0% | NG > +3.0% | Annual gas bill × impact % |
| GBP/USD | FX drop > 0.5% | — | USD spend × ΔRate |
| Shipping | War risk keywords | — | £/TEU × 10 shipments |

### `deriveMorningAlerts(feeds)`

Scans all news items for high-severity keywords. Returns up to 5 alerts sorted by severity.

**Keyword taxonomy:**
- **Critical keywords:** `war`, `invasion`, `attack`, `explosion`, `airstrike`, `missile`, `sanctions imposed`, `force majeure`, `emergency`
- **High keywords:** `conflict`, `tensions`, `escalation`, `disruption`, `closure`, `blockade`, `strike action`
- **Medium keywords:** `concern`, `warning`, `risk`, `uncertainty`, `pressure`, `dispute`

**Source weighting:** Al Jazeera, Reuters, BBC, Guardian weighted higher for geopolitical signals. AHDB, USDA weighted higher for agricultural alerts.

**Geopolitical context mapping:**
- Keywords: `iran`, `hormuz` → "Middle East / Strait of Hormuz situation"
- Keywords: `houthi`, `red sea`, `yemen` → "Red Sea / Bab-el-Mandeb shipping disruption"
- Keywords: `ukraine`, `russia`, `black sea` → "Ukraine conflict / Black Sea grain corridor"
- Keywords: `taiwan`, `strait` → "Taiwan Strait tensions"

### `deriveConflictZones(feeds, historicalContext?)`

Scores six conflict zones based on news evidence and baseline comparisons.

**Zone configurations:**

| Zone ID | Region | Commodity impacts | Keywords |
|---------|--------|------------------|---------|
| `red-sea-yemen` | Red Sea / Yemen | Container Freight, Grain, Brent Crude | houthi, red sea, bab-el-mandeb, shipping lane |
| `ukraine-black-sea` | Ukraine / Black Sea | Wheat, Corn, Sunflower, Fertilizer | ukraine, russia, black sea, grain corridor |
| `middle-east-gulf` | Middle East / Gulf | Brent Crude, LNG, Refined Products | iran, strait of hormuz, gulf, opec |
| `sahel-west-africa` | Sahel / West Africa | Cocoa, Cotton, Gold | sahel, niger, mali, burkina faso |
| `israel-gaza` | Israel / Gaza | Brent Crude, Phosphates | israel, gaza, hamas, west bank |
| `taiwan-strait` | Taiwan Strait | Semiconductors, Copper, LNG | taiwan, china, pla, strait |

**Risk level assignment:**
- Evidence count vs. `conflict_zone_baselines` thresholds
- `CRITICAL` if count >= `critical_threshold`
- `HIGH` if count >= `high_threshold`
- `ELEVATED` if count >= `elevated_threshold`
- `MODERATE` if count > 0
- `LOW` if no matching items

### `deriveSupplyExposure(feeds)`

Computes a 0–100 exposure score for 5 commodity markets.

**Weighting formula:**
```
exposureScore = (conflictProximity × 0.40) + (supplyConcentration × 0.35) + (ukImportDependency × 0.25)
```

Boosters applied if:
- Current price move > 2% → +10 to exposure score
- Shipping alert keywords found → +15 to freight exposure

### `deriveContingencyPlaybooks(feeds)`

Evaluates 5 scenario triggers and returns playbooks with `active` flag set if conditions are currently met.

**Scenario triggers:**

| Scenario | Trigger condition | Evidence check |
|----------|-----------------|---------------|
| Brent Spike | Brent > +3% | `getYahooQuote(feeds, 'BZ=F').changePercent > 3` |
| Grain Disruption | Wheat > +2.5% OR Black Sea headline | `ZW=F changePercent > 2.5` OR keywords match |
| Freight Surge | BDI > +5% OR SCFI > +3% OR Red Sea headline | Quote check OR shipping keywords |
| GBP Weakness | GBP/USD < -1% | `GBPUSD=X changePercent < -1` |
| Geopolitical Escalation | Critical alert detected | `deriveMorningAlerts(feeds).some(a => a.severity === 'critical')` |

---

## `lib/timezone.ts`

Timezone formatting utilities. All use the native `Intl.DateTimeFormat` API — no external date library.

```typescript
const TIMEZONE_OPTIONS = [
  { value: "Europe/London", label: "London", offset: "GMT+0/+1" },
  { value: "America/New_York", label: "New York", offset: "GMT-5/-4" },
  { value: "America/Chicago", label: "Chicago", offset: "GMT-6/-5" },
  { value: "Europe/Paris", label: "Paris / Frankfurt", offset: "GMT+1/+2" },
  { value: "Europe/Zurich", label: "Zurich / Geneva", offset: "GMT+1/+2" },
  { value: "Asia/Dubai", label: "Dubai", offset: "GMT+4" },
  { value: "Asia/Singapore", label: "Singapore", offset: "GMT+8" },
  { value: "Asia/Tokyo", label: "Tokyo", offset: "GMT+9" },
  { value: "Asia/Shanghai", label: "Shanghai / Hong Kong", offset: "GMT+8" },
  { value: "Australia/Sydney", label: "Sydney", offset: "GMT+10/+11" },
  { value: "America/Los_Angeles", label: "Los Angeles", offset: "GMT-8/-7" },
  { value: "America/Sao_Paulo", label: "São Paulo", offset: "GMT-3" },
  { value: "Africa/Johannesburg", label: "Johannesburg", offset: "GMT+2" },
];

formatInTimezone(date, timezone, opts?)    // Full formatting with options
formatTimeInTz(date, timezone)             // "14:30"
formatDateTimeInTz(date, timezone)         // "15 Mar 14:30"
getTzAbbreviation(timezone)                // "BST", "EST", "SGT"
getCurrentTimeInTz(timezone)               // Current time as string
getCurrentDateInTz(timezone)               // Current date as string
convertGmtTimeStringToTz(gmtStr, timezone) // "06:00 GMT" → "07:00 BST"
getTimezoneLabel(value)                    // "London (GMT+0/+1)"
```

---

## TypeScript Types

**File:** `src/types/index.ts`

Core domain types used throughout the application:

| Type | Purpose |
|------|---------|
| `Signal` | `'BUY' | 'HOLD' | 'WATCH' | 'URGENT'` |
| `MarketCategory` | `'energy' | 'freight' | 'fertilizer' | 'agricultural' | 'metals' | 'fx'` |
| `SectorId` | `'food_importer' | 'chemicals' | 'freight_3pl' | 'construction' | 'financial'` |
| `MarketItem` | Full instrument record (price, signal, history, percentile context) |
| `MorningAlert` | Geopolitical/market alert (severity, title, body, affected markets) |
| `ActionItem` | Procurement recommendation (signal, ROI, deadline, evidence) |
| `OvernightStat` | Single stat for the `DailyDiff` display |
| `ConflictZone` | Geopolitical risk zone with evidence count and intensity |
| `SupplyExposureItem` | Per-market supply risk score |
| `ContingencyScenario` | Playbook with trigger condition and response steps |
| `DailyBrief` | Full AI brief from database |
| `PercentileContext` | 10-year percentile context for a market item |
| `SeasonalContext` | Monthly seasonal pressure for a market item |
| `ConflictIntensity` | Intensity vs. historical baseline for a conflict zone |
| `ROIPotential` | £ savings calculation for an action item |

---

## Styling

**Framework:** Tailwind CSS v3 with custom CSS variables.

**Theme:** Dark mode by default. Custom CSS variables in `index.css` define the colour system:

```css
:root {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --card: 222.2 47.4% 11.2%;
  --border: 217.2 32.6% 17.5%;
  --primary: 210 40% 98%;
  --muted: 217.2 32.6% 17.5%;
  --accent: 217.2 32.6% 17.5%;
  ...
}
```

**Persona accent colours** are applied via Tailwind conditional classes based on the active persona.

**Component primitives** (`src/components/ui/`) use Radix UI for accessible behaviour:
- `card.tsx` — Container with `card`, `card-header`, `card-content` sub-components
- `button.tsx` — Variants: `default`, `destructive`, `outline`, `ghost`, `link`
- `badge.tsx` — Variants: `default`, `secondary`, `destructive`, `outline`
- `alert.tsx` — Variants: `default`, `destructive`
- `tooltip.tsx` — Radix `TooltipProvider` + `Tooltip` + `TooltipContent`
- `scroll-area.tsx` — Radix `ScrollArea` with custom scrollbar styling
- `separator.tsx` — Horizontal or vertical divider

**Utility:** `src/lib/utils.ts` exports `cn()` — a `clsx` + `tailwind-merge` helper used in all components for conditional class composition.
