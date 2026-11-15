# Cloudflare Deployment Handoff Guide

This document prepares Claude (or any deployment agent) to deploy the **HEY_THISISANDREW** personal site to Cloudflare Workers with Static Assets.

---

## 1. Cloudflare Architecture Decision: Workers vs Pages

**Decision**: **Cloudflare Workers with Static Assets** (Modern Astro SSR via `@astrojs/cloudflare`).

**Why**: Modern Astro (`@astrojs/cloudflare` v14+) compiles directly to Cloudflare Workers with Static Assets (`main: "entry.mjs"`, `assets: { directory: "../client" }`). Cloudflare Pages Functions are considered legacy architecture by Cloudflare and Astro. Deploying as a Worker with Static Assets gives us native edge runtime execution for the server-side contact API endpoint (`/api/contact`), zero git-provider linkage requirements, and immediate push-to-deploy to a `workers.dev` subdomain (e.g., `hey-this-is-andrew.<account-subdomain>.workers.dev`) via the Wrangler CLI without needing a custom domain or DNS setup.

---

## 2. Every File Changed & Why

| File | Change & Purpose |
| :--- | :--- |
| `sites/hey-this-is-andrew/wrangler.jsonc` | Added Wrangler configuration for Cloudflare Workers with Static Assets, defining asset directory `../client`, HTML handling rules, and compatibility settings. |
| `sites/hey-this-is-andrew/package.json` | Added `build:cloudflare` script (`CF_WORKERS=1 ASTRO_BASE=/ astro build`), `deploy` script (`npx wrangler deploy --config dist/server/wrangler.json`), and `wrangler` devDependency. |
| `package.json` (root) | Added monorepo shortcut scripts `build:cloudflare` and `deploy:cloudflare`. |
| `sites/hey-this-is-andrew/astro.config.mjs` | Configured `cloudflare-prep` integration: 1) `astro:route:setup` dynamically switches `/api/contact.ts` to `prerender: false` when `CF_WORKERS=1` (server mode) and `prerender: true` on GitHub Pages (static mode); 2) `astro:build:done` copies `sitemap-index.xml` to `sitemap.xml` in both `dist/` and `dist/client/`. |
| `sites/hey-this-is-andrew/src/pages/api/contact.ts` | Rewrote endpoint from a 501 stub into a live email sender using Resend API (`POST https://api.resend.com/emails`). Reads `RESEND_API_KEY` from Cloudflare Worker runtime bindings (`context.locals.runtime.env`). Returns clean HTTP 503 if secret is unset to trigger frontend mailto fallback. Enforces strict routing: `capturecreatecaffeinate@gmail.com` ONLY for CCC inquiries; `heythisisandrewb@gmail.com` for all others. |
| `sites/hey-this-is-andrew/src/layouts/BaseLayout.astro` | Fixed Part 2 white line bug: measures `.site-nav` bottom dynamically on scroll, resize, and init, setting `progressBar.style.top = \`${navBottom}px\`` and updating `--nav-bar-h`. Hides progress bar if nav is absent. |
| `sites/hey-this-is-andrew/src/styles/global.css` | Updated `.scroll-progress-bar` default fallback in CSS from 76px to 68px (`top: var(--nav-bar-h, 68px)`). |
| `sites/hey-this-is-andrew/src/data/events.json` | Removed `cohley-summit-2026` from upcoming events. |
| `sites/hey-this-is-andrew/src/lib/hq-events.ts` | Removed `COHLEY_SUMMIT` object and its upcoming map registration. |
| `sites/hey-this-is-andrew/src/pages/api/search.json.ts` | Indexed brand pages (HQ, CCC, personal brand, overview), core pages (`/about/`, `/gear/`, `/events/`, `/contact/`), and storefront referrals (`Mint Mobile`, `inKind`, `Fetch`, `Instacart`, `Rakuten`). Added real brand/product images to results and targeted search tags so "mint" and "Mint Mobile" rank #1. |
| `sites/hey-this-is-andrew/public/brands/` & `public/referrals/` | Staged static logos (`be-logo.png`, `ccc-logo.png`, `hey-thisisandrew.png`, `mint-mobile.png`) for search palette thumbnails. |
| `sites/hey-this-is-andrew/public/robots.txt` | Added `Sitemap: https://heythisisandrew.github.io/hey-this-is-andrew/sitemap.xml`. |
| `sites/hey-this-is-andrew/src/components/GearGrid.astro` | Suppressed browser native search cancel button via `-webkit-search-cancel-button { display: none; }` so only the site's bare X button shows. Adjusted desktop `--card-w: min(580px, 54%)` and deck translations (`translateX(28%)`, `translateX(52%)`) for balanced card width without large black gutters. Kept mobile at 86%. |
| `sites/hey-this-is-andrew/src/pages/contact.astro` | Created dedicated `/contact/` page route with monochrome form, validation, POST to `/api/contact`, mailto fallback, and links to specialized channels. |
| `sites/hey-this-is-andrew/src/pages/sitemap.astro` | Added `/contact/` to `corePages` and `/sitemap.xml` to `machineFeeds`. |
| `sites/hey-this-is-andrew/src/components/PressSection.astro` | Updated "Past partnerships" section copy to acknowledge active brand partnerships with Mint Mobile and Cohley, removing the contradiction (without em dashes). |
| `sites/hey-this-is-andrew/src/pages/about.astro` | Added `id="referrals"` anchor to the referrals container. |

---

## 3. Exact Commands for Claude to Deploy

From the repo root:

```bash
# 1. Verify you are on the cloudflare-ready branch
git checkout cloudflare-ready

# 2. Login to Cloudflare Wrangler (if not already authenticated)
npx wrangler login
# Alternatively, provide CLOUDFLARE_API_TOKEN in your environment.

# 3. Build the site for Cloudflare Workers
pnpm build:cloudflare
# (Runs: CF_WORKERS=1 ASTRO_BASE=/ pnpm --filter hey-this-is-andrew build)

# 4. Set the Resend Email API secret on the Worker
npx wrangler secret put RESEND_API_KEY --config sites/hey-this-is-andrew/dist/server/wrangler.json
# When prompted, paste Andrew's Resend API key (e.g. re_123456789...).
# Optional: if sending from a verified custom domain on Resend:
# npx wrangler secret put RESEND_FROM_EMAIL --config sites/hey-this-is-andrew/dist/server/wrangler.json

# 5. Deploy the Worker with Static Assets to Cloudflare
pnpm deploy:cloudflare
# (Runs: npx wrangler deploy --config sites/hey-this-is-andrew/dist/server/wrangler.json)
```

Wrangler will output the live URL (e.g. `https://hey-this-is-andrew.<subdomain>.workers.dev`).

---

## 4. What Claude Needs From Andrew

Before executing deployment, obtain the following from Andrew:

1. **Cloudflare Authentication**:
   - Either run `npx wrangler login` interactively so Andrew can authorize in browser, OR
   - Request a Cloudflare API Token with `Workers:Edit` and `Account:Read` permissions (`CLOUDFLARE_API_TOKEN`) plus `CLOUDFLARE_ACCOUNT_ID`.
2. **Resend API Key**:
   - Environment secret name: `RESEND_API_KEY`
   - Andrew should create an API key at [resend.com](https://resend.com).
   - If not set immediately, `/api/contact` safely returns HTTP 503 and the frontend automatically invokes the user's native email client with `mailto:heythisisandrewb@gmail.com`.
3. **Optional Custom Sender Email**:
   - Environment secret name: `RESEND_FROM_EMAIL` (default fallback is `HEY_THISISANDREW <onboarding@resend.dev>`).

---

## 5. Verification Checklist Completed

- [x] Static build check: `node scripts/site.mjs check` passed (all 24 pages ok, all tests passed).
- [x] Cloudflare build check: `CF_WORKERS=1 ASTRO_BASE=/ pnpm --filter hey-this-is-andrew build` built cleanly with `@astrojs/cloudflare` server adapter.
- [x] Wrangler dry run: `wrangler deploy --dry-run` passed with 13 server modules and 247 static client assets.
- [x] White line bug: scroll progress bar sits flush at 0px gap at all scroll positions on desktop and mobile.
- [x] Cohley Summit: completely removed from events data, upcoming list, and lib mappings.
- [x] Search indexing: "mint" and "Mint Mobile" return Mint Mobile as result #1 with thumbnail.
- [x] Sitemap: `/sitemap.xml` generated and verified.
- [x] Gear page: browser search clear button hidden; single site bare X displayed; card width balanced on desktop.
- [x] Contact page: `/contact/` route live and working.
- [x] Partnerships text: About page contradiction resolved.
- [x] Zero horizontal overflow on 1440x900 desktop and 390x844 mobile across all routes.
