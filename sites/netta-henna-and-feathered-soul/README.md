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

Cloudflare Pages project `netta-henna-and-feathered-soul`, connected to this repo
(production branch `main`). This site depends on `workspace:*` packages, so the
build runs from the repo root:

- **Framework preset**: None
- **Root directory**: *(leave blank, repo root)*
- **Build command**: `pnpm --filter netta-henna-and-feathered-soul build`
- **Build output directory**: `sites/netta-henna-and-feathered-soul/dist`
- **Build watch paths (include)**: `sites/netta-henna-and-feathered-soul/*`, `packages/*`, `pnpm-lock.yaml`

Production environment variables:

| Name | Value |
| --- | --- |
| `NODE_VERSION` | `22` (Astro 7 needs Node >= 22.12; the repo requires >= 22.15, so 20 fails) |
| `BASE_PATH` | `/` |
| `SITE_URL` | `https://netta-henna-and-feathered-soul.pages.dev` |

Leave `SITE_URL` unset for Preview so preview builds fall back to `CF_PAGES_URL`.
Cloudflare installs dependencies automatically from the root `pnpm-lock.yaml`.
