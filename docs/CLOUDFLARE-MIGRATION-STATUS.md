# Cloudflare Pages Migration Status

## Overview

The Crisis2 application has been partially migrated from Supabase to Cloudflare Pages. This document tracks what's working, what's not, and what needs to be done to complete the migration.

---

## ✅ Working Features

### Frontend Hosting
- **Status**: ✅ Fully functional
- **Details**: React app builds and deploys to Cloudflare Pages successfully
- **URL**: https://crisis2.pages.dev

### RSS Feed Fetching
- **Status**: ✅ Functional (HTTP only)
- **Details**:
  - Created `/functions/api/feed_cache/trigger.ts` endpoint
  - Fetches from 5 RSS sources: BBC, Guardian, Reuters, FT, Al Jazeera
  - Stores data in D1 database
  - HTTP endpoint `/api/feed_cache` retrieves latest feeds
- **Test**: `curl -X POST https://crisis2.pages.dev/api/feed_cache/trigger`

### D1 Database
- **Status**: ✅ Configured and working
- **Details**:
  - Database ID: `c3bdf315-1aca-46a5-a0fd-0f3aefced92a`
  - Schema migrated from PostgreSQL to SQLite
  - Binding name: `DB` (used in all Workers/Pages Functions)
  - Tables: `feed_cache`, `user_settings`, `daily_brief`, etc.

### API Endpoints (Read-Only)
- **Status**: ✅ Working
- **Endpoints**:
  - `/api/feed_cache` - Retrieve latest feeds (GET)
  - `/api/user_settings` - User timezone preferences (GET/POST)
  - `/api/historical_context` - Commodity data (GET)
  - `/api/daily_brief` - Cached AI briefs (GET)
  - `/api/scout_intel` - Scouting data (GET)
  - `/api/dismissed_intel` - Dismissed items (GET/POST/DELETE)

### HTTP Data Fetching
- **Status**: ✅ Working (as of latest deployment)
- **Details**:
  - `useMarketFeeds` hook implements HTTP fallback
  - If WebSocket fails for 5 seconds, automatically falls back to HTTP
  - Fetches from `/api/feed_cache` endpoint
  - Updates dashboard with latest data

---

## ⚠️ Partially Working / Degraded Features

### WebSocket Real-Time Updates
- **Status**: ⚠️ Not working (falls back to HTTP)
- **Issue**: Durable Object binding not properly configured
- **Current Behavior**:
  - WebSocket connection attempts fail
  - HTTP fallback triggers after 5 seconds
  - Data still loads, but not real-time
- **Fix Required**: Configure `MARKET_FEED_ROOM` Durable Object binding in Cloudflare dashboard

### Daily Brief Display
- **Status**: ⚠️ Read-only (cached briefs only)
- **Issue**: No AI generation available
- **Current Behavior**:
  - Can read existing briefs from D1 database
  - Cannot generate new briefs (requires OpenAI integration)
  - "Generate Brief" button disabled
- **Fix Required**: Port Supabase Edge Function `ai-brief` to Cloudflare Worker

---

## ❌ Not Working / Disabled Features

### AI Brief Generation
- **Status**: ❌ Disabled
- **Missing Components**:
  - OpenAI API integration
  - Prompt engineering logic from `supabase/functions/ai-brief/index.ts`
  - Historical context loading and processing
- **Supabase Dependency**: Calls `${SUPABASE_URL}/functions/v1/ai-brief`
- **Fix Required**:
  1. Port `supabase/functions/ai-brief` to `/functions/api/daily_brief/generate.ts`
  2. Add OpenAI API key as Cloudflare secret
  3. Update `useDailyBrief.ts` to call new endpoint

### Email Subscriptions
- **Status**: ❌ Disabled
- **Missing Components**:
  - Email sending infrastructure (Resend/Mailgun)
  - Email template rendering
  - Subscription management
- **Supabase Dependency**: Calls `${SUPABASE_URL}/functions/v1/send-morning-brief`
- **Fix Required**:
  1. Set up Cloudflare Email Workers or integrate Resend API
  2. Port email templates from `supabase/functions/send-morning-brief`
  3. Create `/functions/api/email/subscribe.ts` endpoint

### Scheduled Pipeline (Overnight Cron)
- **Status**: ❌ Not configured
- **Missing Components**:
  - Cron trigger for daily pipeline execution
  - Market data fetching orchestration
  - AI brief generation for all personas
  - Email distribution
- **Supabase Dependency**: `pg_cron` scheduled job calling `overnight-pipeline`
- **Fix Required**:
  1. Add `crons` configuration to `wrangler.toml`
  2. Create `/functions/scheduled/overnight-pipeline.ts`
  3. Orchestrate: feed fetch → AI brief → email send

### Market Scouting
- **Status**: ❌ Not implemented
- **Supabase Dependency**: `supabase/functions/scout-markets/index.ts`
- **Fix Required**: Port scouting logic to Cloudflare Worker

---

## 🔧 Recent Fixes (Deployed)

### 1. HTTP Fallback for Data Fetching
**Problem**: WebSocket failures left the dashboard blank
**Solution**:
- Added HTTP fallback in `useMarketFeeds.ts`
- 5-second timeout before falling back to HTTP
- Proper callback dependencies to prevent stale closures

### 2. Removed Supabase Endpoint Calls
**Problem**: Hundreds of 405 errors from `/undefined/functions/v1/ai-brief`
**Solution**:
- Added guards in `DevControlsPanel.tsx` to disable pipeline controls when Supabase not configured
- Updated `EmailSubscribe.tsx` to show error message when subscription unavailable
- Modified `DailyBriefPreview.tsx` to check for Supabase availability
- Updated `useDailyBrief.ts` to only use cached briefs from D1

### 3. Fixed Callback Dependencies
**Problem**: React hooks with missing dependencies causing stale closures
**Solution**:
- Added proper dependencies to `fetchViaHttp` callback
- Added `fetchViaHttp` to `connect` callback dependencies
- Added cleanup for HTTP fallback timeout

---

## 📋 Migration Roadmap

### Phase 1: Core Data Pipeline (High Priority)
- [ ] Configure Durable Object binding for WebSocket
- [ ] Set up scheduled cron trigger for RSS feed fetching
- [ ] Test real-time WebSocket updates

### Phase 2: AI Integration (Medium Priority)
- [ ] Add OpenAI API key to Cloudflare secrets
- [ ] Port `ai-brief` logic to `/functions/api/daily_brief/generate.ts`
- [ ] Test brief generation with live data
- [ ] Enable "Generate Brief" button in UI

### Phase 3: Email System (Medium Priority)
- [ ] Choose email provider (Resend, Mailgun, or Cloudflare Email Workers)
- [ ] Set up email templates
- [ ] Port subscription management logic
- [ ] Create email sending endpoint
- [ ] Enable email subscription form in UI

### Phase 4: Scheduled Automation (Low Priority)
- [ ] Configure daily cron job in `wrangler.toml`
- [ ] Create overnight pipeline orchestration
- [ ] Test end-to-end: fetch → generate → send
- [ ] Set up monitoring and alerting

### Phase 5: Advanced Features (Future)
- [ ] Port market scouting logic
- [ ] Add scout intel generation
- [ ] Implement pipeline run history tracking

---

## 🚀 Quick Start for Developers

### Current Working Flow

1. **Trigger RSS Feed Fetch**:
```bash
curl -X POST https://crisis2.pages.dev/api/feed_cache/trigger
```

2. **Verify Data in D1**:
```bash
npx wrangler d1 execute crisis2-db --remote \
  --command "SELECT id, fetched_at, length(payload) as size FROM feed_cache ORDER BY created_at DESC LIMIT 1;"
```

3. **View Data in Dashboard**:
- Navigate to https://crisis2.pages.dev
- Data loads via HTTP fallback after 5 seconds
- Dashboard displays RSS feed items

### Testing Locally

1. **Install Dependencies**:
```bash
npm install
```

2. **Build Frontend**:
```bash
npm run build
```

3. **Deploy to Pages**:
```bash
npx wrangler pages deploy dist --project-name crisis2 --branch main
```

---

## 🔐 Required Secrets (Future)

When implementing AI and email features, add these secrets via Cloudflare dashboard:

```bash
# For AI Brief Generation
OPENAI_API_KEY=sk-...

# For Email Sending
RESEND_API_KEY=re_...

# Optional: For monitoring
SENTRY_DSN=https://...
```

---

## 📊 Architecture Comparison

### Before (Supabase)
```
Supabase PostgreSQL ←→ Supabase Edge Functions (Deno)
                              ↓
                         OpenAI API
                              ↓
                         Resend API
                              ↓
                      React Frontend (Vercel)
```

### Current (Cloudflare Pages - Partial)
```
Cloudflare D1 (SQLite) ←→ Pages Functions (V8)
                              ↓
                      [OpenAI API - TODO]
                              ↓
                      [Email API - TODO]
                              ↓
                  React Frontend (Cloudflare Pages)
```

### Target (Cloudflare Pages - Complete)
```
Cloudflare D1 (SQLite) ←→ Pages Functions + Workers
                              ↓
                         OpenAI API
                              ↓
                    Cloudflare Email Workers
                              ↓
                  React Frontend (Cloudflare Pages)
                              ↓
                   Durable Objects (WebSocket)
```

---

## 🐛 Known Issues

1. **WebSocket Connection Failures**
   - Error: `WebSocket connection to 'wss://crisis2.pages.dev/api/feed_cache/connect' failed`
   - Impact: No real-time updates (HTTP fallback works)
   - Fix: Configure DO binding in Cloudflare dashboard

2. **No Fresh Data Without Manual Trigger**
   - Impact: RSS feeds only update when manually calling `/api/feed_cache/trigger`
   - Fix: Set up cron trigger to run every 15 minutes

3. **AI Brief Generation Disabled**
   - Impact: Cannot generate new briefs, only view cached ones
   - Fix: Port OpenAI integration to Workers

---

## 📝 Notes for Future Developers

- **Environment Variables**: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are intentionally left undefined to prevent accidental Supabase calls
- **Fallback Strategy**: All Supabase-dependent features gracefully degrade with user-friendly error messages
- **Database Compatibility**: D1 uses SQLite syntax (not PostgreSQL) - see `schemas/0001_initial_schema.sql` for conversion notes
- **Deployment URL**: New deployments create preview URLs (e.g., `fbe1f0e1.crisis2.pages.dev`), then propagate to `crisis2.pages.dev`

---

## 🔗 Useful Links

- **Cloudflare Dashboard**: https://dash.cloudflare.com
- **Pages Deployment**: https://crisis2.pages.dev
- **D1 Console**: Via Cloudflare Dashboard → D1 → crisis2-db
- **Wrangler Docs**: https://developers.cloudflare.com/workers/wrangler/
- **Durable Objects Guide**: https://developers.cloudflare.com/durable-objects/
- **Cloudflare Email Workers**: https://developers.cloudflare.com/email-routing/email-workers/

---

**Last Updated**: 2026-03-18
**Migration Progress**: ~40% complete
**Next Milestone**: Configure Durable Objects for WebSocket support
