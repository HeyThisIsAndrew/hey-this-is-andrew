# Architecture

How andrew-sites fits together, and how to clone the structure for a new
(or client) site. Plain-language setup steps are in `README.md`; the shared
blocks' props, theming contract and keep-or-share log are in
`packages/ui/README.md`.

## 1. The shape

```
andrew-sites/                      pnpm workspace root
├─ packages/
│  ├─ tokens/   @andrew/tokens     base design tokens + themes/ (CSS only)
│  └─ ui/       @andrew/ui         shared Astro components, styles, scripts
├─ sites/
│  └─ hey-this-is-andrew/          the personal site (GitHub Pages)
├─ templates/
│  └─ site-starter/                the minimal site every new site copies
├─ scripts/new-site.mjs            `pnpm new-site <name>`
└─ .github/workflows/              deploy.yml (personal site), refresh-token.yml
```

Dependency direction is one way: `sites/*` and `templates/*` depend on
`packages/*` through `workspace:*`; packages never import from a site.

### Tooling choices

- **pnpm workspaces, not npm workspaces.** pnpm links each workspace package
  once and is strict about undeclared dependencies. That strictness already
  paid for itself: it caught that the personal site used `sharp` without
  declaring it (npm had hoisted it silently). One lockfile at the root
  (`pnpm-lock.yaml`); `packageManager` pins pnpm 10 so CI and every computer
  agree (`corepack enable` picks it up).
- **One Astro version.** Every workspace package declares `astro ^7.3.1`
  (HQ is on 7.3.1; the personal site resolves 7.3.5). `@andrew/ui` declares
  Astro as a peer dependency, so there is exactly one Astro per site.
- **Shared components ship as source** (`.astro`, `.ts`, `.css`). Astro and
  Vite compile them inside each site's build; there is no package build step.
  `@andrew/ui` carries the `astro-component` keyword so Astro processes it.
- **Node 22** everywhere (`engines`), matching both repos' CI.

## 2. Component map

### Shared (`@andrew/ui`)

| block | file | used by |
| --- | --- | --- |
| BrandAccordion | `packages/ui/src/BrandAccordion.astro` | personal site (brands section), starter |
| Nav | `packages/ui/src/Nav.astro` | personal site, starter |
| Footer | `packages/ui/src/Footer.astro` | personal site, starter |
| SectionHeader | `packages/ui/src/SectionHeader.astro` | every section of the personal site, starter |
| QuoteBand | `packages/ui/src/QuoteBand.astro` | personal site About page, starter |
| NewTag, ViewAllLink, FilterTabs | `packages/ui/src/*.astro` | personal site (Latest, every condensed section, filters) |
| icons | `packages/ui/src/icons.ts` | nav data of both |
| base / chips / cta styles | `packages/ui/src/styles/*.css` | both |
| section-anchor script | `packages/ui/src/scripts/section-anchors.ts` | both |

### Personal site homepage: section-to-component map (after Prompt 2)

The homepage is a funnel: one overall section per topic, the depth on its
archive page behind "View all". Composition: `src/pages/index.astro` →
`src/components/HomeSections.astro` (the hero is a slot, so the hero
concepts under `/preview/hero-*` render the identical page).

| order | section (anchor) | component | archive page | data source |
| --- | --- | --- | --- | --- |
| 0 | header | `@andrew/ui/Nav` + `SiteSearch` (slot) | | `src/data/nav.ts` |
| 1 | hero (`#overview`) | `BrandCarousel.astro` (unchanged; concepts pending) | | latest YouTube videos |
| 2 | The brands (`#directory`, alias `#brands`) | `BrandsSection.astro` → `@andrew/ui/BrandAccordion` | | `src/data/brands.ts` |
| 3 | Meet the creator + Now line (`#about`) | `AboutSection.astro` | `/about/`, `/now/` | About copy, `src/data/now.ts` |
| 4 | Selected work (`#projects`, alias `#photography`) | `SelectedWork.astro` (LatestCard, ProjectCard, photo strip, WorkflowStrip) | `/work/` | `projects` collection, `instagram-feed.json` + `src/assets/instagram/`, `workflow.ts` |
| 5 | Latest (`#latest`, aliases `#writing`, `#network`) | `LatestSection.astro` → `LatestFeed.astro` + `@andrew/ui/FilterTabs` | `/latest/` (+ `/rss.xml`) | `src/lib/network.ts` |
| 6 | Goals (`#goals`) | `GoalsSummary.astro` → `GoalsChecklist.astro` | `/goals/` | `goals` collection |
| 7 | What I do (`#work`) | `WorkWithAndrew.astro` (variant home) | `/services/` | `src/data/services.ts` (DRAFT) |
| 8 | The kit (`#gear`) | `KitSection.astro` → `StorefrontCTA.astro` | `/gear/` (GearGrid) | `src/data/storefront.ts`, `gear` collection |
| 9 | Newsletter (`#newsletter`) | `NewsletterSection.astro` → `NewsletterSignup.astro` (the only signup on the site) | | Substack |
| 10 | footer | `@andrew/ui/Footer` | | `src/data/nav.ts` |

Brief's names → this site's: Hero = BrandCarousel, MeetTheCreator =
AboutSection, PhotoGrid = PhotographyPortfolio (on `/work`), ActivityFeed =
LatestFeed, ServicesSection = WorkWithAndrew, NowBand (on `/now`).
Archive pages (`/work`, `/latest`, `/goals`, `/services`, `/now`, `/gear`)
share `src/layouts/ArchiveLayout.astro`. `/feed` redirects to `/latest`.

Every page uses `src/layouts/BaseLayout.astro` (one layout: head, favicon
set, canonical, grain, Nav, Footer, video player, live banner).
`scripts/audit-dist.mjs` (`pnpm --filter hey-this-is-andrew test:dist`)
fails the build check if any page differs in chrome.

## 3. Content collections (personal site)

Defined in `sites/hey-this-is-andrew/src/content.config.ts`. Updating content
never touches a component: edit a Markdown file, commit, deploy.

| collection | folder | fields |
| --- | --- | --- |
| `projects` | `src/content/projects/` | `title`, `date`, `description`, `role?`, `brand` (`htia`/`be`/`ccc`), `tools[]`, `featured`, `image?`, `link?` |
| `goals` | `src/content/goals/` | `title`, `order` (lower first), `items[]` of `{ label, status: done / in-progress / next, note? }` |
| `gear` | `src/content/gear/` | `category`, `order`, `brand?`, `subtitle?`, `items[]` of `{ name, spec, brand?, affiliateUrl?, tag? }` |

The starter has one collection, `posts` (`title`, `date`, `summary`).

Non-collection data files (one source each): `brands.ts` (accordion
panels), `nav.ts` (header + footer), `services.ts`, `storefront.ts`,
`workflow.ts`, `now.ts`, `instagram-feed.json` (written by
`scripts/sync-instagram.mjs`).

## 4. Theming contract (summary)

Shared components read only CSS custom properties. `@andrew/tokens/tokens.css`
defines the base (dark, square, monochrome); a site's `src/styles/theme.css`
overrides what it needs; ready-made themes live in
`packages/tokens/themes/` (`hq-red.css`). Per-panel accents: a panel renders
`data-accent="<name>"` and the theme re-points `--accordion-*` tokens for
that name. Full token table and two worked examples (HQ red everywhere;
monochrome with one BE-red panel) in `packages/ui/README.md`.

## 5. Duplication map (personal site vs. BE Unconventional HQ)

Produced before any change, from both codebases as of 2026-09-30.

| primitive | personal site (before) | HQ | canonical | status |
| --- | --- | --- | --- | --- |
| Brand/hero accordion | `BrandAccordion.astro`, 1,731 lines: solid collapsed strips, 7s clock whose bar never moved, CSS `!important` mobile layer | `home/HeroAccordion.astro` + `modules/home.css` | HQ's mechanics, rebuilt data-driven as `@andrew/ui/BrandAccordion` | personal site uses the package; HQ keeps its own until it migrates |
| Nav | `Nav.astro` (links hardcoded) | `Navbar.astro` | personal site's (same HQ design language, monochrome), made props-driven | personal + starter use the package |
| Footer | `Footer.astro` (links hardcoded) | `Footer.astro` (reads `data/site.js`, `data/icons.js`) | props-driven package Footer; HQ's data-driven approach adopted | personal + starter use the package |
| Section header | `SectionHeader.astro` (eyebrow, index, rule) | `SectionHeader.astro`, `SectionHeading.astro`, `home/HomeSectionHeader.astro` | personal site's | package |
| Film grain | `global.css` `body::before` | `modules/grain.css` (+ hide under modal) | HQ's (it has the iOS modal fix) | package `styles/base.css` |
| Chips | global `.chip` | `.acc-chip` in `home.css` | personal (token-driven accent) | package `styles/chips.css` |
| Buttons / CTAs | `cta.css` | `modules/buttons.css`, `Button.astro` | personal (`--color-accent` driven) | package `styles/cta.css` |
| Social icons | inline strings in `Footer.astro` | `data/icons.js` (documented library) | HQ's conventions, personal glyphs | package `icons.ts` |
| Tokens | `styles/tokens.css` (HQ palette, red swapped for gray) | CSS variables in `global-base.css` | HQ palette as the base; HQ's red as `themes/hq-red.css` | package `@andrew/tokens` |
| Quote band | `QuoteBand.astro` | none | personal | package |
| Photo grid / viewer | `PhotographyPortfolio.astro` + `lib/spatial.ts` | `InstagramFeed.astro`, `CinematicGallery.astro` (different) | not shared | kept in the site (one consumer) |

## 6. BE Unconventional HQ: why it is not in `sites/` yet, and the plan

HQ is live, and this pass was bound by "nothing may change HQ's visual output
or break its build". Moving it into this workspace is an operational
migration, not a code move, and needs Andrew's go-ahead on four things:

1. **Where the workspace lives.** Today the workspace is this repository
   (`hey-this-is-andrew`). Either rename it to `andrew-sites` and move HQ
   in, or create a new `andrew-sites` repository and move both.
2. **HQ's production pipeline lives in HQ's repository.** `deploy.yml`
   (Cloudflare Workers, with its secrets), eight scheduled workflows that
   commit content to HQ's `main` (YouTube, Instagram, Substack, media kit,
   analytics, WebSub, indexing), a git merge driver installed on
   `postinstall`, and Sanity Studio at `/admin`. Each workflow needs a
   `working-directory: sites/be-unconventional-hq` and its secrets copied.
3. **HQ's guard tests pin file paths.** Its source tests (for example
   `embed-escape`, `home-hero-flush`, `lcp-preload`, `reload-top-guard`)
   read components by path, and its hard rules 3, 10, 11 and 12 bind the hero
   accordion to its YouTube players. Swapping HQ's accordion for the shared
   one means porting its inline-player hooks into the shared component (as an
   optional slot) and updating those tests together.
4. **Pixel parity against production.** HQ must render identically. The
   screenshot harness used for the personal site in this pass (repeated
   full-page captures, compared against the pre-change build) is the check.

Migration steps once approved: (a) `git subtree add` HQ into
`sites/be-unconventional-hq` (keeps its history); (b) switch it to pnpm and
`workspace:*` for `@andrew/tokens` / `@andrew/ui`; (c) move its workflows to
the root with `working-directory`; (d) replace its grain, chips, icons,
Footer and SectionHeader with the packages, one at a time, running its
`npm test` and `test:dist` plus the pixel check after each; (e) the
accordion last, as in point 3; (f) archive the old repository.

## 7. Cloning this structure for a client site

1. `pnpm new-site client-name` (copies `templates/site-starter`).
2. Put the client's colours in `src/styles/theme.css`. If the client's brand
   needs a colour the blocks do not expose as a token yet, add the token to
   `packages/tokens/tokens.css` with a neutral default and read it in the
   component, never hardcode it.
3. Content in `src/content/`, brand data in `src/data/`.
4. Deploy from `sites/client-name` (see its `deploy/github-pages.yml`).
5. A client who must own their code: copy `packages/` and the site folder
   into their own repository with the same workspace files; nothing in a
   site reaches outside `packages/` and itself.
