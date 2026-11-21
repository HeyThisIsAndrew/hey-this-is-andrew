# Netta Henna and Feathered Soul

Landing page site for Netta Henna and Feathered Soul (Santa Barbara, CA).

## Tech Stack

- **Framework**: Astro 5 (Static Site Generation)
- **Design Tokens**: `@andrew/tokens` (monochrome square base, `--brand: #c86446` terracotta accent)
- **Shared UI**: `@andrew/ui` (`Nav`, `Footer`, `SectionHeader`, `BrandAccordion`, `ChromeMeta`, `PageNav`)
- **Content & Availability Management**: `@andrew/local-cms` (`/local-cms` in dev)

## Development

From repo root:

```sh
# Run locally
corepack pnpm --filter netta-henna-and-feathered-soul dev

# Build
corepack pnpm --filter netta-henna-and-feathered-soul build

# Local CMS (when dev server is running)
# Open http://localhost:4321/local-cms to edit panels, posts, and calendar availability.
```

## Deployment

Cloudflare Worker `netta-henna-and-feathered-soul`, live at
https://netta-henna-and-feathered-soul.heythisisandrewb.workers.dev.

Pushing to `main` deploys it automatically when this folder (or a shared
package) changed: `.github/workflows/cloudflare.yml` runs
`scripts/cloudflare.mjs`, which builds with `SITE_URL` set to the Worker's URL
and `BASE_PATH=/`, then uploads `dist/` as the Worker's static assets
(`wrangler.jsonc`). To deploy by hand from a laptop:

```sh
npx wrangler login
corepack pnpm cf deploy netta-henna-and-feathered-soul
```

For a custom domain later: add `"siteUrl": "https://the-domain"` to the
`cloudflare` block in `package.json`, then attach the domain to the Worker in
the Cloudflare dashboard (Workers & Pages, the Worker, Settings, Domains & Routes).
