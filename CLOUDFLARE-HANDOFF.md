# Cloudflare deployment: HEY_THISISANDREW

The personal site deploys from `main` to Cloudflare Workers with Static Assets
(`@astrojs/cloudflare`). The same branch still builds the GitHub Pages site;
the Cloudflare setup only switches on when `CF_WORKERS=1`.

Live URL: `https://hey-this-is-andrew.heythisisandrewb.workers.dev`

## Deploy (from the repo root, on `main`)

```bash
git checkout main && git pull
```

```bash
pnpm install && pnpm build:cloudflare
```

```bash
npx wrangler login
```

```bash
pnpm deploy:cloudflare
```

First deploy only, after the deploy (a secret on a Worker that does not exist
yet makes Wrangler offer to create an empty one):

```bash
npx wrangler secret put RESEND_API_KEY --name hey-this-is-andrew
```

Optional, once a sending domain is verified in Resend:

```bash
npx wrangler secret put RESEND_FROM_EMAIL --name hey-this-is-andrew
```

Secrets take effect immediately and survive later deploys. Check
`/api/contact` on the live URL shows `"configured": true`.

Without a verified domain, Resend's default sender (`onboarding@resend.dev`)
only delivers to the Resend account's own address, so CCC inquiries to
`capturecreatecaffeinate@gmail.com` fail and the form falls back to mailto.

## What is Cloudflare-specific

| File | Purpose |
| :--- | :--- |
| `sites/hey-this-is-andrew/wrangler.jsonc` | Worker name, compatibility date, `auto-trailing-slash` (the site's URLs end in `/`). |
| `sites/hey-this-is-andrew/astro.config.mjs` | Cloudflare adapter when `CF_WORKERS=1`; `site` follows the build (`ASTRO_SITE` overrides, e.g. a custom domain); `/api/contact` is server-rendered on Cloudflare, prerendered elsewhere; copies `sitemap-index.xml` to `sitemap.xml`; Cloudflare `robots.txt` names its own sitemap. |
| `sites/hey-this-is-andrew/src/pages/api/contact.ts` | Sends inquiries through Resend using `RESEND_API_KEY` (read via `astro:env/server`). CCC inquiries go to `capturecreatecaffeinate@gmail.com`, everything else to `heythisisandrewb@gmail.com`. No key: 503, and the form falls back to mailto. |
| `sites/hey-this-is-andrew/src/layouts/BaseLayout.astro` | Canonical, `og:image` and JSON-LD URLs use the build's own origin. |
| `package.json`, `sites/hey-this-is-andrew/package.json` | `build:cloudflare` / `deploy:cloudflare` scripts; `wrangler` dev dependency. |

The first deploy also creates a small KV namespace for the `SESSION` binding
the Astro adapter declares.
