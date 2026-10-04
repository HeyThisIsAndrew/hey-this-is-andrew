# HEY_THISISANDREW: the personal site

Astro 7, static output, GitHub Pages. Dark, square, monochrome; the one red
on the site is the BE Unconventional HQ panel in the brand accordion (a BE
brand context). Built from the shared blocks in `packages/` (see the root
`README.md` and `ARCHITECTURE.md`).

## Run it (from the repository root)

```sh
pnpm install
pnpm dev                                             # http://localhost:3000
pnpm --filter hey-this-is-andrew build               # production build to dist/
pnpm --filter hey-this-is-andrew test                # unit tests
pnpm --filter hey-this-is-andrew test:dist           # checks the built site (run after build)
pnpm --filter hey-this-is-andrew sync:instagram      # self-host new "Shot on the Job" photos
pnpm --filter hey-this-is-andrew build:marks         # regenerate the wordmark + favicon set
```

## Where things live

```
src/data/*.json     projects, goals, gear, now, brands: edited at /local-cms
                    under `pnpm dev` (local-cms.config.mjs), then commit
src/data/           nav (header + footer), services (DRAFT), storefront,
                    workflow, images.ts (CMS image resolver), instagram-feed.json
src/components/     this site's sections (shared blocks come from @andrew/ui)
src/layouts/        BaseLayout.astro: the one layout every page uses
src/styles/         theme.css (overrides on @andrew/tokens), global.css
src/assets/instagram/   self-hosted portfolio photos (sync:instagram)
scripts/            sync-instagram, build-brand-marks, audit-dist, tests
legacy/             the original static prototype (not built, not deployed)
```

## Rules this site keeps

- Wordmark: `HEY_THISISANDREW`, one underscore; stacked as `HEY_` over
  `THISISANDREW`. The SVG is generated from Syne 800 outlines
  (`scripts/build-brand-marks.mjs`).
- No colour in UI chrome except the BE panel; no em dashes in copy; no
  rounded frames; the film grain never animates.
- Portfolio photos are self-hosted, never hotlinked from Instagram's
  expiring CDN.
