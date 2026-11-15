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

Deploy independently to Cloudflare Pages or Netlify.
- **Root directory**: `sites/netta-henna-and-feathered-soul`
- **Build command**: `pnpm install && pnpm run build`
- **Output directory**: `dist`
