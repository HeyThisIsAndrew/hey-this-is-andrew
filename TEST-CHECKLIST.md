# Test checklist

One line per check; each takes under a minute. Run the branch locally as in
`VERIFICATION.md` (URLs relative to `http://localhost:3000`). D = desktop
1440x900, M = phone 390x844 (DevTools device mode). Details, files and
screenshots per item: `VERIFICATION.md`, `verification/screenshots/`.

## A. The 36 defects

- [ ] 1 · `/latest/` · D · run `pnpm --filter hey-this-is-andrew test`; online, the BE "Holding a Controller" title reads `You're` (never `&apos;`)
- [ ] 2 · `/#directory` · D+M · open Sip the Magic: monochrome cup-and-steam card, not a black box
- [ ] 3 · `/#goals` and `/goals/` · D · "The Big Goals" group first: 100,000 subscribers / $30,000 per month, both IN PROGRESS
- [ ] 4 · `/about/` · D · black quote band after the intro, before Writing; attribution "Scott Galloway" with no dash; none on `/`
- [ ] 5 · `/` and `/work/` · D · view source, search `cdninstagram`: zero hits
- [ ] 6 · all pages · D+M · run section C below
- [ ] 7 · `/#gear` (load directly) and `/gear/` Lenses tab · D · content readable immediately, nothing dim after the jump or tab switch
- [ ] 8 · footer · M · a social icon link measures 44x44
- [ ] 9 · `/gear/` · D · click a camera: selection bar, alpha mark, G MASTER are white/gray, no red
- [ ] 10 · `/brands/hey-this-is-andrew/` portrait · D · hover the image: glitch fringe black/white only
- [ ] 11 · `/gear/` + CCC panel · D · no gold on the storefront button, pill, badge, CCC chip edge or CTA
- [ ] 12 · `/` search (Cmd/Ctrl+K, type "goal"), newsletter submit, section `#` copy · D · no green anywhere
- [ ] 13 · `/` search "goal" · D · IN-PROGRESS badges gray, not yellow
- [ ] 14 · `/` Meet the Creator paragraph · D · "creative process, where" (comma); `test:dist` passes (it fails on any em dash)
- [ ] 15 · `/#directory` Sip the Magic · D · "SOMETHING IS BREWING" chip, "IN THE WORKS" tag, no link
- [ ] 16 · nav + footer logos, `/og-image.png` · D+M · `HEY_` over `THISISANDREW`, one underscore; logo alt `HEY_THISISANDREW`
- [ ] 17 · `/#directory` · D · collapsed strips show blurred art; hover sharpens and widens ~28px without opening
- [ ] 18 · `/#directory` · D+M · every open headline white and legible
- [ ] 19 · `/#directory` · D · BE CTA red (fills `#cc0000` + glow on hover); CCC CTA white, inverts on hover
- [ ] 20 · `/#directory` · D · chip sits top-left on every open panel
- [ ] 21 · `/#directory` · D · progress bar fills over 8 s (red on BE, white elsewhere), then advances; pauses on hover
- [ ] 22 · `/#directory`, accordion flush under the header · D · ESC/CLOSE is not tabbable while closed; in the brand view it is clickable and closes it
- [ ] 23 · `/` scrolled so the accordion's bottom is at the window bottom · D · back-to-top button hidden, never over a strip
- [ ] 24 · brand view · D · MEDIA BRAND chip top-left, ESC/CLOSE top-right, no overlap
- [ ] 25 · footer Explore · D · HOME is the first link
- [ ] 26 · `/goals/` Content Engine · D · "First hospitality brand collaboration" shows UP NEXT
- [ ] 27 · `/goals/` Landing Page v1 · D · every task shows a DONE tag
- [ ] 28 · nav "Build in Public" dropdown · D · reads "02 CORE ENGINE"; `/build/` heading "Core Engine"
- [x] 29 · retired: the carousel left `/` for hero B; nothing renders it now
- [ ] 30 · nav right side · D · no theme toggle; source shows it commented out; `<html data-theme="dark">`
- [ ] 31 · accordion pause button · D · aria-label "Pause auto-rotation" while rotating, "Play auto-rotation" after clicking a strip; no aria-pressed
- [ ] 32 · any nav dropdown · D · square corners
- [ ] 33 · browser tab + `/favicon-16.png` · D · white `H_` on black, legible at 16x16
- [ ] 34 · `/#work` and `/services/` · D · five services (DRAFT), inquiry line present
- [ ] 35 · source of `/` and `/about/` · D · `newsletter-form` appears once on `/`, zero times on `/about/`
- [ ] 36 · `pnpm --filter hey-this-is-andrew test:dist` · · prints `audit-dist: ok`

## B. Archive pages and Prompt 2

- [ ] `/` · D · 11 blocks; every condensed section ends VIEW ALL → and it opens the right page
- [ ] `/work/` · D+M · header with breadcrumb, videos, projects, workflow
- [ ] `/latest/` · D+M · All / Video / Writing filter the list; `/latest/?filter=writing` preselects Writing
- [ ] `/goals/` · D · all groups with statuses; link to the build roadmap
- [ ] `/services/` · D · five services with descriptions
- [ ] `/now/` · D · month + five Now items
- [ ] `/gear/` · D · GearGrid + storefront; `/gear/#gear-lenses` lands on lenses
- [ ] `/feed/` · D · redirects to `/latest/`
- [ ] `/404.html` · D · site chrome + Home / Sitemap buttons
- [ ] `/rss.xml` · · valid RSS
- [ ] `/sitemap/` · D · lists Work, Latest, Goals, Services, Now
- [ ] `/latest/` · D · NEW tag (white on black) only on items from the last 7 days
- [ ] nav links · D · hover: white underline scales in from the left with a soft glow
- [ ] `/preview/hero-a/`, `-b/`, `-c/` · D+M · render; source has `noindex`; `/` shows hero B (portrait, wordmark, one line, SEE THE BRANDS)

## C. Viewport matrix (Prompt 1 section 1.6)

Viewports: 375x812, 390x844, 768x1024, 1280x800, 1440x900, 1920x1080,
3440x1440. At each, on `/`, `/work/`, `/latest/`, `/goals/`, `/services/`,
`/now/`, `/gear/`, `/about/`:

- [ ] no horizontal scroll (page width equals the window)
- [ ] no overlapping, clipped or unreadable text
- [ ] images keep their aspect ratio (nothing stretched)
- [ ] tap targets ≥ 44px at 375 / 390 / 768
- [ ] nav collapses to MENU at ≤ 860px; the menu opens and closes (Escape too)
- [ ] accordion usable by touch (phones) and keyboard (arrows, Home, End)
- [ ] `/#directory`, `/#brands`, `/#gear`, `/#goals` land with the heading below the sticky header

## D. Regression guard (Prompt 1 section 1.5)

- [ ] YouTube, Substack and network feeds show real content, no broken placeholders (needs network)
- [ ] every nav link and dropdown link resolves (`test:dist` checks pages and anchors)
- [ ] footer links resolve: Work, Latest, Goals, Services, Now, Links, Press kit, Sitemap, Privacy
- [ ] accordion CTAs: beunconventionalhq.com, the.fotoapp.co, the mailto inquiry
- [ ] search opens with Cmd/Ctrl+K and `/`, returns results, Escape closes it
- [ ] hero SEE THE BRANDS lands on the brands heading below the sticky header
- [ ] `/gear/` category tabs filter correctly
- [ ] photo grid click-to-zoom and Escape (once photos are synced)
- [ ] Back-to-top appears after scrolling and returns to the top
- [ ] internal pages load: `/build/`, `/cafe/`, `/events/`, `/links/`, `/press/`, `/privacy/`, `/brands/*`
