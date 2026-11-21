# Cloudflare: every site, its own Worker

Each site under `sites/` that opts in deploys to its own Cloudflare Worker on
the `heythisisandrewb.workers.dev` subdomain:

| Site | Live URL |
| :--- | :--- |
| `hey-this-is-andrew` | https://hey-this-is-andrew.heythisisandrewb.workers.dev |
| `netta-henna-and-feathered-soul` | https://netta-henna-and-feathered-soul.heythisisandrewb.workers.dev |
| `reelay` | https://reelay.heythisisandrewb.workers.dev |

`pnpm cf list` prints the current list. BE Unconventional HQ is never deployed
from this repository (its copy here is out of date; see `AGENTS.md`), and the
script refuses it.

## How it works

- **Opt in:** a `"cloudflare": { "worker": "<name>" }` block in the site's
  `package.json`, plus a `wrangler.jsonc` beside it. `pnpm new-site` writes
  both, so new sites are on Cloudflare from their first push.
- **Push to `main`:** `.github/workflows/cloudflare.yml` deploys the sites the
  push touched (all of them when `packages/`, the lockfile or the deploy
  script change). Run it by hand from the Actions tab for one site or `all`.
- **One script:** `scripts/cloudflare.mjs` builds a site with `SITE_URL` /
  `ASTRO_SITE` set to its Worker URL and a root base path, then runs
  `wrangler deploy`. Static sites upload `dist/` as Worker static assets; the
  personal site uses the Astro Cloudflare adapter (its contact form needs a
  server) and deploys the `dist/server/wrangler.json` the adapter writes.
- **Custom domain later:** add `"siteUrl": "https://the-domain"` to the site's
  `cloudflare` block, push, then attach the domain to the Worker in the
  dashboard (Workers & Pages, the Worker, Settings, Domains & Routes).

GitHub Pages keeps publishing the personal site (with the Reelay and Netta
previews under it) from `.github/workflows/deploy.yml`, unchanged.

## One-time setup

1. Cloudflare dashboard, My Profile, API Tokens, Create Token, template
   **Edit Cloudflare Workers**, your account, Create. Copy the token.
2. GitHub repository, Settings, Secrets and variables, Actions, New repository
   secret: name `CLOUDFLARE_API_TOKEN`, value the token.
3. Actions tab, **Deploy to Cloudflare**, Run workflow, site `all`.

Until the secret exists the workflow skips with a notice instead of failing.

## Personal site: contact form email

The contact form sends through Resend. Once, after the first deploy:

```bash
npx wrangler secret put RESEND_API_KEY --name hey-this-is-andrew
```

Optional, once a sending domain is verified in Resend:

```bash
npx wrangler secret put RESEND_FROM_EMAIL --name hey-this-is-andrew
```

Secrets survive later deploys. `/api/contact` on the live site shows
`"configured": true` when the key is set. Without a verified domain, Resend's
default sender only delivers to the Resend account's own address, so CCC
inquiries to `capturecreatecaffeinate@gmail.com` fall back to mailto.

## Deploying by hand

```bash
npx wrangler login
```

```bash
pnpm cf deploy <site>
```

`pnpm cf deploy all` deploys every Cloudflare site; `pnpm cf build <site>`
builds without deploying.

## Personal site details

| File | Purpose |
| :--- | :--- |
| `sites/hey-this-is-andrew/wrangler.jsonc` | Worker name, compatibility date, `auto-trailing-slash` (the site's URLs end in `/`). |
| `sites/hey-this-is-andrew/astro.config.mjs` | Cloudflare adapter when `CF_WORKERS=1`; `site` from `ASTRO_SITE`; `/api/contact` server-rendered on Cloudflare, prerendered elsewhere; `sitemap.xml` copy; Cloudflare `robots.txt` names its own sitemap. |
| `sites/hey-this-is-andrew/src/pages/api/contact.ts` | Resend sender (`RESEND_API_KEY` via `astro:env/server`). CCC inquiries go to `capturecreatecaffeinate@gmail.com`, everything else to `heythisisandrewb@gmail.com`. No key: 503 and the form falls back to mailto. |
| `sites/hey-this-is-andrew/src/layouts/BaseLayout.astro` | Canonical, `og:image` and JSON-LD URLs use the build's own origin. |

The first deploy also creates a small KV namespace for the `SESSION` binding
the Astro adapter declares.
