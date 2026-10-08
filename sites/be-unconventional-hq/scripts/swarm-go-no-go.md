# Go / No-Go swarm review — `d95c1ab`

**Target:** commit `d95c1ab`, present identically on both
`claude/buhq-indexing-gsc-s4lksg` and `antigravity/seo-perf-ux-fixes`.
Open PR: #144 into `main`.

**Question you are answering:** *should this merge to `main` and deploy?*
Not "is it good". **Ship or don't ship, and why.**

---

## 0. Read this first, or you will waste a lane

### What already passed, locally, on this exact commit

| Gate | Result |
|---|---|
| `npx astro check` | 0 errors, 0 warnings, 0 hints (baseline is 0/0/0) |
| `npm test` | 26 suites, 414 assertions, 0 failed |
| `npm run test:e2e` | 22/22 suites, 467s |
| `npm run build` | clean |
| `npm run lighthouse` | 7 pages, all ≥96% across all four categories |

**Re-running these is not a lane.** If you only re-run them you have added
nothing. Your job is the things these gates cannot see.

### Known and accepted — do NOT report these as findings

1. **The portrait hero leak on iOS is UNFIXED.** On a real iPhone in
   portrait, the top of the next section can show under the hero. Three
   units were tried (`svh`, `dvh`, a measured `visualViewport` height); all
   three were worse and the reasoning is recorded in
   `scripts/viewport-units.test.mjs`. It needs a real device. Out of scope.
2. **`Gaming` → `Games` HAS since been done** (issue #146), taxonomy and URLs
   together: `/category/gaming` and `/intel/topic/gaming` now 301 to their
   `games` equivalents, and old tag spellings resolve through
   `CATEGORY_TAG_ALIASES` in `src/data/constants.js`. This note used to say
   the rename was deliberately skipped and that `/featured` still read GAMING.
   It does not any more.
3. **`.brand-stage` geometry changed on `/featured`.** It went from the old
   two-column insets back to `inset: 0`, and `.brand-stage-mark` from 74% to
   88%. This is intentional: a stale duplicate of the stylesheet had been
   silently reverting the newer design since 23 Aug. Judge whether it *looks*
   right, but do not report the change itself as a regression.
4. **Local Lighthouse performance numbers are not trustworthy** in a sandbox
   that cannot reach `substackcdn.com` — article body images never load, so
   the score is optimistic. This exact discrepancy already produced 98%
   locally against 75% in CI. **CI is authoritative.** If you cannot reach
   Substack's CDN, do not report a performance number at all.

### Scale, honestly

```
36 files, +2825 / -1685, 40 commits since main

  SHIPPED CODE    26 files   +1863 / -1641
  test suites      7 files   +919  / -30
  CI workflow      1 file    +18   / -1
  lockfile         1 file    +12   / -0
  synced data      1 file    +13   / -13
```

Of the 1,779 added lines under `src/` and `astro.config.mjs`, 151 are
comments and 241 are blank: **~1,387 real lines**. And 1,574 of the 1,641
deletions are a single stale duplicated `<style>` region in
`src/pages/featured/index.astro`. So the change is broad in *reach* and much
narrower in *new logic* than the headline suggests. Weight your effort
accordingly: reach is the risk here, not volume.

---

## 1. Lanes

Run these **in parallel, one agent each**. They are deliberately
non-overlapping. Do not let an agent wander into another lane; if you find
something outside yours, note it and hand it over rather than investigating.

Every agent: **evidence or it did not happen.** A finding is a file, a line,
a reproduction, and an observed value. "Looks risky" is not a finding.

---

### Lane A — Routing, canonicals and search exposure
**Why this lane exists:** this is the only lane whose mistakes are expensive
to undo. Google caches what it sees.

- Build (`npm run build`), then for **every** HTML file in `dist/client`:
  - Exactly one `<link rel="canonical">`, absolute, on the apex domain, and
    **slash-free** (`wrangler.jsonc` sets
    `assets.html_handling: "drop-trailing-slash"`).
  - `<meta name="robots">` present ONLY where intended. **Read the `filter:`
    array in `astro.config.mjs`'s sitemap config for the gated set — do not
    take a list from this brief or from CLAUDE.md.** An earlier version of
    this brief hardcoded four routes and omitted `/media-kit` and
    `/collaborations/press-kit`, and a review agent duly reported both as
    P0 blockers. They were correctly gated the whole time. A route in that
    filter array carrying `noindex` is correct; anything NOT in it that
    carries `noindex` is a P0.
  - Astro's static redirect template emits `noindex` + a canonical to the
    target. Confirm every redirect stub in `astro.config.mjs`
    (`/articles`, `/videos`, `/events-new`, `/press-kit`) resolves to a real
    200 target and that the *target* is not itself noindexed.
- `dist/client/sitemap-0.xml`: no redirect sources listed, no gated routes,
  every URL 200s, `lastmod` sane and not in the future.
- `dist/client/rss.xml` is **new on this branch**. Validate it: well-formed,
  slash-free links matching canonicals, no reserved slugs leaking in, items
  resolve to 200.
- `/author/andrew-baxter` is **a new route**. Canonical, title, description,
  schema, and every byline that now links to it.
- Structured data: run every page type through Google's Rich Results
  expectations. `ProfilePage`, `AboutPage`, article schema. Report invalid
  types and missing required fields.

**P0:** an indexable page carrying `noindex`; a canonical pointing at a
redirect or a 404; a sitemap advertising either. **P1:** schema validation
failures.

---

### Lane B — `/featured`, the deck, and the typeface system
**Why this lane exists:** the largest deletion in the diff and the most
recently churned interaction.

- **Deck state.** The bug just fixed was `initAccordionAndDecks()` running
  twice (module scope *and* `astro:page-load`, which ClientRouter fires on
  the initial load) and attaching duplicate gesture listeners. Verify with
  CDP `DOMDebugger.getEventListeners` on `.deck-stack`: **exactly 1 each of
  `touchstart`, `touchend`, `wheel`**. Then exercise:
  - fresh load → swipe → tap a thumb → swipe. Must land on card 1, not 2.
  - alternate tap/swipe 10+ times in random order; the visible card must
    always equal the highlighted thumb.
  - swipe backwards; wrap around both ends.
  - do all of it on touch **and** trackpad-wheel, mobile **and** desktop.
  - open each of the four rows and repeat. The guard is per-row
    (`section.dataset.deckWired`); a row that wires twice is a P0.
- **After a client-side navigation.** Navigate away and back via an in-page
  link (ClientRouter swaps the DOM). Re-count listeners. Re-run the sequence.
  This is the path the per-element guards used to cover and the new guard
  must still cover.
- **Typeface.** `PROD_FONT` is `syncopate`. Confirm the built page ships the
  self-hosted `syncopate-700-latin.woff2`, preloads it, makes **zero**
  requests to `fonts.googleapis.com`, and emits no picker markup. In `npm run
  dev`, confirm all 17 picker faces change the heading, and that a face which
  fails to load is struck through with a console warning.
- **Visual.** Screenshot all four rows, open and closed, at 390/768/1024/1440
  and in landscape. Compare against `main`. The `.brand-stage` change in §0.3
  is expected; anything else moving is a finding.
- `scripts/featured-containment.test.mjs` encodes the invariants. Read it
  before judging intent.

**P0:** duplicate listeners; deck state desync; a heading in the fallback
face in a production build; a third-party font request.

---

### Lane C — The reveal failsafe (touches every page)
**Why this lane exists:** it is the newest change and it is global.

Three classes ship at `opacity: 0` and wait for JS: `.animate-on-scroll`,
`.reveal`, `.cat-stagger`. Two gates now exist —
`html:not(.js)` and `.reveal-failsafe` / `.stagger-failsafe`, set by a
watchdog in Layout.astro's `is:inline` head script at 5s.

- With **JavaScript disabled**, on every route: nothing with a rendered box
  may sit below `opacity: 0.05`. (Excludes `display:none` /
  `visibility:hidden`, hover chrome and deliberate carousel states.)
- With **every `.js` request blocked**, same assertion after 7s, and
  `document.documentElement.className` must carry the right failsafe class.
- On a **healthy** load, neither failsafe class may appear — a false positive
  silently kills every entrance animation on the site. Check a route with
  category tiles (`/`) and several without (`/feed`, `/intel`, `/about`).
- Throttle CPU 6x and network to Slow 3G. Does the watchdog trip on a load
  that would have succeeded? If it trips routinely at 5s, say so — the
  number is a judgement call and worth challenging with data.
- The staggered tile reveal must still animate normally after the splash
  lifts. Confirm the 90ms `nth-child` stagger is visible, not a hard cut.
- **Do not "fix" the splash curtain.** It locks scroll until a gesture by
  design and lifts on wheel-down, swipe-up, Tab, Escape, PageDown, or the
  scroll cue.

**P0:** content invisible with JS off or blocked. **P1:** a failsafe class on
a healthy load.

---

### Lane D — Article pipeline and `/intel`
**Why this lane exists:** it already produced a shipped Lighthouse
regression once.

- **Body images.** `rewriteBodyImages()` was rewritten. Every `<img>` in an
  article body must carry `loading`, `decoding`, and — where a rendition
  exists — a `srcset`. A missing rendition must still get lazy/decoding and
  must never be left eager at `w_1456`. That exact defect took an article
  page to 75% in CI.
- Hero/cover sizing and CLS. Measure CLS on three real articles with images
  genuinely loading. **If you cannot reach `substackcdn.com`, skip and say
  so** rather than reporting a fabricated number.
- Pull quotes survive the sanitizer (`liftPullQuotes()`,
  `allowedClasses: { blockquote: ['pullquote'] }`).
- TOC: scroll to the bottom, click the masthead to jump to top, confirm the
  highlight clears rather than sticking on the last section.
- **The eyebrow (`MARVEL | REVIEW`) is a `<span>` and must stay inert.** No
  colour change on hover, tap, or focus. On iOS `:hover` sticks after a tap,
  which was the reported bug. Also confirm it has no expanded `::before` hit
  area stealing taps from neighbours.
- Byline → `/author/andrew-baxter`: hovers red, **no underline** (it would
  overlap "FOUNDER & EDITOR"), keyboard-focusable, correct destination.

**P0:** eager full-width body images; a body image with no `loading`.

---

### Lane E — Accessibility and keyboard
- axe-core (or equivalent) on all seven audited routes plus an article and a
  hub page. Report violations by impact.
- Keyboard-only: reach and operate all four `/featured` rows, the deck cards,
  the nav rail, the mobile menu, the video modal (open, ESC, focus restore),
  the newsletter form, and the splash curtain (Tab must lift it).
- Focus visibility on every interactive element. Focus must never be trapped
  outside a modal, nor lost to the top of the page on close.
- Contrast: the muted-grey palette is a **deliberate** trade-off (see
  `CLAUDE.md`) and passes AA at rest. `--color-accent` (#cc0000, 3.21:1) is a
  border/glow colour only — flag it **only** if it is used as text or an icon.
- Reduced motion: with `prefers-reduced-motion: reduce`, confirm the splash,
  the tile stagger and the deck transitions do not visibly animate.
  **`transition-duration: 1ms !important` is the intended implementation, not
  a defect** — `none` stops `transitionend` firing, and code here waits on it.
  An earlier version of this brief said "OFF, not merely faster", and a review
  agent reported the deliberate 1ms as a P0.

---

### Lane F — CI, workflows and secrets
- `.github/workflows/sync-articles.yml` went to hourly (`30 * * * *`) and
  gained an Indexing API step. Confirm: the concurrency group still
  serialises against the other four content syncs; the snapshot is written to
  `RUNNER_TEMP` and can never be committed; the notify step is
  `continue-on-error` and **no-ops cleanly when `GOOGLE_INDEXING_CREDENTIALS`
  is unset** (it currently is).
- **Grep the entire diff for secrets.** Tokens, keys, service-account JSON,
  private hostnames, in code *and* in example snippets. Any hit is a P0 and
  stops the merge.
- The Lighthouse gate is now two-band: ≥90 pass, 80–90 warn (green build),
  <80 fail. Confirm the warn band genuinely does not fail the build and that
  sub-80 genuinely does.
- Run the full battery on CI hardware, not a dev laptop, and report the
  **CI** Lighthouse numbers. Those are the ones that count.

---

## 2. Severity rubric — use these words exactly

| | Meaning | Effect on the call |
|---|---|---|
| **P0** | Broken for real users, or search-visible and expensive to undo | **NO-GO** |
| **P1** | Real defect, narrow blast radius, or degrades quality | GO with a named follow-up issue |
| **P2** | Polish, inconsistency, or a nit | Does not affect the call |

A finding without a reproduction is not a finding. A finding you did not
observe on `d95c1ab` is not a finding.

---

## 3. Required output

One report. Lead with the verdict, then justify it.

```
VERDICT: GO | GO-WITH-FOLLOWUPS | NO-GO

P0 (blocking)
  - <file:line> — <what breaks> — <exact reproduction> — <observed vs expected>

P1 (ship, then fix)
  - ...

P2 (noted)
  - ...

Coverage
  Lane A ... F: what was actually exercised, and what could not be and why.
```

**State what you could not test.** A lane that could not reach Substack's
CDN, or had no real iOS device, must say so plainly. An unqualified GO from
a swarm that silently skipped a lane is worse than a NO-GO — it is a false
negative wearing a verdict.

If every lane is clean, say **GO** and say it plainly. Manufacturing a
finding to look thorough is its own failure mode.
