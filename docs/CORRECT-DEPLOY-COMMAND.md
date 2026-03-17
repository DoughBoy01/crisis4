# Correct Cloudflare Pages Deploy Command

## ❌ WRONG Command (What You Have Now)

```bash
npx wrangler deploy
```

**Error:** This is for **Workers**, not **Pages**. It looks for a Worker entry point and fails.

---

## ✅ CORRECT Command (What You Need)

```bash
npx wrangler pages deploy dist
```

Or with explicit project name:

```bash
npx wrangler pages deploy dist --project-name=crisis2
```

---

## Why This Matters

### Workers vs Pages Deploy Commands:

| Command | Purpose | What it does |
|---------|---------|--------------|
| `wrangler deploy` | Workers | Deploys a Worker script (requires `main` entry point) |
| `wrangler pages deploy` | Pages | Deploys static assets + Functions to Pages |

---

## How to Fix in Dashboard

### Option 1: Via Cloudflare Dashboard (Recommended)

1. Go to: **https://dash.cloudflare.com**
2. Navigate to: **Workers & Pages** → Your Pages Project
3. Click: **Settings** tab
4. Find: **Build configuration** section
5. Look for: **Deploy command** field
6. **Change from:** `npx wrangler deploy`
7. **Change to:** `npx wrangler pages deploy dist`
8. Click: **Save**
9. Go to: **Deployments** tab
10. Click: **Retry deployment**

### Option 2: Via Configuration File (May Not Override Dashboard)

I've added `cloudflare.toml` with:

```toml
[build]
deploy_command = "npx wrangler pages deploy dist"
```

**However:** Dashboard settings usually take precedence, so you should still update the dashboard.

---

## What Each Part Does

```bash
npx wrangler pages deploy dist
│   │        │     │      │
│   │        │     │      └─ Directory to deploy (build output)
│   │        │     └─ Deploy subcommand
│   │        └─ Pages command (not Worker)
│   └─ Wrangler CLI
└─ Execute npm package
```

---

## Expected Result

After using the correct command, your deployment logs should show:

```
✓ Build command completed
✓ Deploying to Cloudflare Pages
✓ Uploading... (XX files)
✓ Deployment complete!
🎉 https://crisis2.pages.dev
```

**NOT:**

```
❌ Missing entry-point to Worker script
```

---

## Alternative: Let Pages Handle It Automatically

If you're using **Git-connected deployments** (which you are), you can also:

1. **Remove** the deploy command field entirely (if the UI allows)
2. OR set it to: **`echo "Deployment handled by Pages"`**

Cloudflare Pages will automatically deploy the `dist` folder after the build completes.

---

## Summary

**In your Cloudflare Pages dashboard, change:**

```diff
- Deploy command: npx wrangler deploy
+ Deploy command: npx wrangler pages deploy dist
```

That's it! Then retry the deployment.
