# Verification guide (Prompt 1 defects + Prompt 2)

For every defect: the files that changed, the exact URL to check, the
steps, and what "fixed" looks like. Screenshots named by defect number are
in `verification/screenshots/` (BEFORE = the `pre-monorepo` commit
`b9cc358`, AFTER = this branch; 1440x900 and 390x844; real renders).
One-line checks for a fast pass: `TEST-CHECKLIST.md`.

## How to run the branch locally

```sh
git clone https://github.com/HeyThisIsAndrew/hey-this-is-andrew && cd hey-this-is-andrew
git checkout claude/hey-thisisandrew-repair-monorepo-bcs47a
corepack enable && pnpm install
ASTRO_BASE=/ pnpm --filter hey-this-is-andrew build
pnpm --filter hey-this-is-andrew preview          # http://localhost:3000
pnpm --filter hey-this-is-andrew test:dist        # built-site audit (run after the build)
```

All URLs below are relative to `http://localhost:3000`. (`ASTRO_BASE=/`
builds for the root so `preview` serves it correctly; the production
build uses `/hey-this-is-andrew/`, so on GitHub Pages every path is
prefixed with that.) Site files are under `sites/hey-this-is-andrew/`
(written `site/` below); shared blocks under `packages/`.

Screenshot caveats: YouTube thumbnails cannot load in the environment the
screenshots were taken in, so they render as flat gray; fonts were served
locally (the same Syne / Inter / JetBrains Mono files Google serves).

## Prompt 1 defects

| # | files changed | URL | steps | expected |
| --- | --- | --- | --- | --- |
| 1 | `site/src/lib/feed-text.ts` (new), `site/src/lib/latest-content.ts`, `site/src/lib/network.ts`, `site/scripts/feed-text.test.mjs` | `/` (Latest), `/latest/` | Run `pnpm --filter hey-this-is-andrew test`. With network access, find the BE article "…Feel Like You're Actually Holding a Controller" in Latest. | Test prints `feed-text: ok`; the title reads `You're`, never `&apos;`. (Offline builds use fallback titles, so the live title needs network.) |
| 2 | `packages/ui/src/BrandAccordion.astro`, `site/src/data/brands.ts` | `/#directory` | Click the Sip the Magic strip. | Open panel shows a monochrome card (line-drawn cup with steam), never a black box; `TODO (Andrew)` on `mediaSrc` in `brands.ts`. |
| 3 | `site/src/content/goals/big-goals.md` (new), `site/src/content.config.ts`, `site/src/components/GoalsSummary.astro` | `/#goals`, `/goals/`, `/about/#goals` | Read the first goal group. | "The Big Goals": "100,000 subscribers on YouTube" and "$30,000 per month as a creator", both IN PROGRESS, notes verbatim. |
| 4 | `packages/ui/src/QuoteBand.astro`, `site/src/pages/about.astro` | `/about/` | Scroll past the intro. | Pure black band, eyebrow "A QUOTE I LIVE BY", the Galloway quote, attribution "Scott Galloway" (no dash), before the Writing section. Not on `/`. |
| 5 | `site/scripts/sync-instagram.mjs` (new), `site/src/lib/instagram.ts`, `site/src/components/PhotographyPortfolio.astro`, `site/src/components/SelectedWork.astro`, `.github/workflows/deploy.yml`, `site/src/data/instagram-media-todo.md` | `/`, `/work/` | View page source; search for `cdninstagram`. | Zero matches. Photos render only from `site/src/assets/instagram/`; until the sync runs, the photo strip and the `/work` photo wall are absent (by design, see TODO). |
| 6 | (test only) | every page | Run the 7-viewport matrix (`TEST-CHECKLIST.md` section C). | No horizontal scroll, tap targets ≥ 44px on touch widths, anchors land under the header. |
| 7 | `site/src/lib/spatial.ts`, `site/src/components/GearGrid.astro`, `packages/ui/src/FilterTabs.astro` | `/#gear`, `/gear/` | Load `/#gear` directly (no scrolling). On `/gear/`, click the Lenses tab. | Content is readable immediately; nothing sits dim/invisible after a jump or tab switch. |
| 8 | `packages/ui/src/Footer.astro`, `site/src/styles/global.css`, `packages/ui/src/styles/cta.css`, `packages/ui/src/SectionHeader.astro`, `packages/ui/src/Nav.astro` | `/` at 390x844 | DevTools: measure a footer social icon link. | 44x44px. |
| 9 | `site/src/components/GearGrid.astro` | `/gear/` | Click a camera in the manifest. | Selection bar, alpha mark and "G MASTER" are white/gray; schematics gray; no red. |
| 10 | `site/src/styles/global.css` | `/brands/hey-this-is-andrew/` desktop (the homepage carousel that also used it was retired for hero B) | Hover the portrait. | Glitch fringe is white/black only; no red or cyan. |
| 11 | `site/src/components/GearGrid.astro`, `packages/ui/src/BrandAccordion.astro`, `site/src/styles/theme.css` | `/gear/`, `/#directory` | Look at "View on Amazon Storefront", the influencer pill, badge text; open the CCC panel. | No gold anywhere; storefront button is white-outline, inverts to white on hover; CCC chip edge and CTA white. |
| 12 | `site/src/components/GearGrid.astro`, `site/src/components/NewsletterSignup.astro`, `packages/ui/src/SectionHeader.astro`, `site/src/components/SiteSearch.astro`, `site/src/pages/build.astro` | `/`, `/gear/`, `/build/` | Press Cmd/Ctrl+K, type `goal`; submit the newsletter form; click a section `#` link. | Status badges, pulse dot, COPIED toast and success tick are white/gray; no green. |
| 13 | `site/src/components/SiteSearch.astro` | `/` | Cmd/Ctrl+K, type `goal`. | IN-PROGRESS badges gray, not yellow. |
| 14 | `site/src/components/AboutSection.astro`, `site/src/pages/press.astro` | `/about/`, `/press/` | Read the Meet the Creator paragraph and the press stats. | "…the creative process, where building…" (comma). No em dash anywhere (the audit fails on one). |
| 15 | `site/src/data/brands.ts` | `/#directory` | Open Sip the Magic. | Chip "SOMETHING IS BREWING", tag "IN THE WORKS", no link. |
| 16 | `site/scripts/build-brand-marks.mjs` (new), `site/src/assets/brand-logos/hey-thisisandrew.svg` (new), `packages/ui/src/Nav.astro`, `packages/ui/src/Footer.astro`, `site/public/og-image.png`, all page titles | every page | Look at the nav and footer logos; hover the nav logo for alt; view `/og-image.png`. | `HEY_` over `THISISANDREW`, one underscore; alt `HEY_THISISANDREW`. |
| 17 | `packages/ui/src/BrandAccordion.astro` | `/#directory` desktop | Look at the collapsed strips; hover one. | Each strip shows its art blurred; hovering sharpens it and widens the strip ~28px without opening it. |
| 18 | same | `/#directory` | Read each open panel's headline. | White headline over a dark scrim, legible on all three. |
| 19 | same + `site/src/styles/theme.css` | `/#directory` | Hover the BE CTA; open CCC, hover its CTA. | BE: red border, fills `#cc0000` with red glow. CCC: white, inverts on hover. |
| 20 | same | `/#directory` | Look at the chip on each open panel. | Top-left. |
| 21 | same | `/#directory` desktop | Scroll the accordion into view and wait 8 s. | Bar under the open panel fills over 8 s (red on BE, white on others), then the next panel opens; pauses on hover. |
| 22 | same | `/#directory` desktop | Scroll so the accordion is flush under the header; press Tab through the page. Click the open panel, then click ESC/CLOSE. | The close control is not in the tab order until the view opens; when open it is on top and clicks close the view. |
| 23 | `site/src/layouts/BaseLayout.astro`, `packages/ui/src/BrandAccordion.astro` (`data-avoid-fab`) | `/` desktop | Scroll down past 600px, then scroll until the accordion's bottom edge sits at the bottom of the window. | Back-to-top button hides while the accordion is in its corner; never covers a strip. |
| 24 | `packages/ui/src/BrandAccordion.astro` | `/#directory` desktop | Click the open panel to enter the brand view. | "MEDIA BRAND" chip top-left, ESC/CLOSE top-right, no collision. |
| 25 | `packages/ui/src/Footer.astro`, `site/src/data/nav.ts` | any page | Look at the footer Explore column. | "HOME" is the first link. |
| 26 | `site/src/components/GoalsChecklist.astro` | `/goals/` | Read Content Engine's third task. | Shows an "UP NEXT" status tag. |
| 27 | same | `/goals/` | Read Landing Page v1. | Every task shows a visible "DONE" tag. |
| 28 | `site/src/data/nav.ts`, `site/src/pages/build.astro` | any page, then `/build/` | Hover "Build in Public"; follow "Core Engine". | Dropdown reads "02 / CORE ENGINE"; the heading on `/build/` reads "Core Engine". |
| 29 | `site/src/components/BrandCarousel.astro` | none: retired | The carousel left `/` when hero B was chosen (2026-09-30). The fix stays in the file, which nothing renders now. | Nothing to check on the live site. |
| 30 | `packages/ui/src/Nav.astro`, `site/src/layouts/BaseLayout.astro` | any page | Look at the nav's right side; view source for `nav-theme-toggle`. | No toggle rendered; its code is present but commented out; `<html data-theme="dark">`. |
| 31 | `packages/ui/src/BrandAccordion.astro` | `/#directory` desktop | Inspect the pause button's `aria-label`; click a strip; inspect again; click the button; inspect again. | "Pause auto-rotation" while rotating, "Play auto-rotation" after a manual choice, "Pause…" after pressing it; no `aria-pressed`. |
| 32 | `packages/ui/src/Nav.astro`, `site/src/styles/global.css`, `site/src/pages/sitemap.astro` | any page | Hover a nav item. | Dropdown corners square (radius 0). |
| 33 | `site/scripts/build-brand-marks.mjs`, `site/public/favicon*`, `site/public/apple-touch-icon.png`, `site/public/icon-512.png`, `site/src/layouts/BaseLayout.astro` | any page (tab icon), `/favicon.svg` | Look at the browser tab; open `/favicon-16.png`, `/favicon.svg`. | White `H_` on `#080808`, Syne 800, one underscore; linked as ICO, SVG, 16/32/64 PNG, 180 apple-touch. |
| 34 | `site/src/data/services.ts` (new), `site/src/components/WorkWithAndrew.astro` | `/#work`, `/services/` | Read the list. | Five services (DRAFT for Andrew's approval); inquiry line kept. |
| 35 | `site/src/components/WorkWithAndrew.astro`, `site/src/components/WritingSection.astro`, `site/src/components/NewsletterSection.astro` | every page | View source of `/`, then `/about/`; search `newsletter-form`. | Exactly one, on `/` only (the About page's copy was removed too). Preview routes `/preview/hero-*` are copies of `/` and carry the same single form. |
| 36 | `site/src/layouts/BaseLayout.astro`, `site/src/pages/{events,feed→latest,links,sitemap}.astro`, `site/scripts/audit-dist.mjs` | every page | Run `pnpm --filter hey-this-is-andrew test:dist`. | `audit-dist: ok` (same nav, footer, favicon set, canonical, one h1 on every page). |

Also fixed: press-kit "Download" pointed at a missing file (`/press/`);
goals pulse ignored reduced motion (`GoalsChecklist.astro`).

## Prompt 2

| item | files | URL | steps | expected |
| --- | --- | --- | --- | --- |
| Homepage funnel | `site/src/pages/index.astro`, `site/src/components/HomeSections.astro` | `/` | Scroll the page. | 11 blocks: nav, hero, brands, meet the creator (+ Now line), selected work, latest, goals, what I do, the kit, newsletter, footer. Each condensed section ends "VIEW ALL →". |
| /work | `site/src/pages/work.astro` | `/work/` | Load; follow nav Home ▸ Selected Work. | Archive header, videos, projects, workflow (photo wall once photos are synced). |
| /latest | `site/src/pages/latest.astro`, `site/src/components/LatestFeed.astro` | `/latest/`, `/latest/?filter=writing` | Click All / Video / Writing. | List filters; `?filter=writing` preselects Writing. |
| /goals | `site/src/pages/goals.astro` | `/goals/` | Load. | Every goal group with visible statuses. |
| /services | `site/src/pages/services.astro` | `/services/` | Load. | Five services with descriptions. |
| /now | `site/src/pages/now.astro` | `/now/` | Load. | The Now list (month + five items). |
| /gear | `site/src/pages/gear.astro` | `/gear/`, `/gear/#gear-lenses` | Load; use nav Production & Gear ▸ Zoom Lenses. | Collection-driven GearGrid + storefront; the anchor lands on lenses. |
| /feed → /latest | `site/astro.config.mjs` | `/feed/` | Load. | Redirects to `/latest/`. |
| 404 | `site/src/pages/404.astro` | `/404.html` (any unknown path on Pages) | Load. | Site chrome, "Page not found", Home and Sitemap buttons. |
| RSS | `site/src/pages/rss.xml.ts` | `/rss.xml` | Load. | Valid RSS of the writing items. |
| Sitemap page | `site/src/pages/sitemap.astro` | `/sitemap/` | Read Core Pages. | Lists Work, Latest, Goals, Services, Now; no Feed. |
| NEW tag | `packages/ui/src/NewTag.astro` | `/latest/` | Items published in the last 7 days. | White "NEW" tag on black text; never on items with an unknown date. |
| Nav underline | `packages/ui/src/Nav.astro`, `packages/tokens/tokens.css` | any page, desktop | Hover a nav link. | White underline scales in from the left with a soft white glow. |
| No dead anchors | `site/scripts/audit-dist.mjs` | all | `test:dist`. | Passes (it fails on any internal `#id` whose page lacks that id). |
| Hero concepts | `site/src/components/hero/*`, `site/src/pages/preview/hero-{a,b,c,d}.astro` | `/preview/hero-a/` to `/preview/hero-d/` | Load; view source. | `noindex`; not in `sitemap-0.xml`. `/` renders concept B (`HeroStatement.astro`), the same hero as `/preview/hero-b/`. |
