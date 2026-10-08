# Merge-Readiness Test Plan — `antigravity/engineering-trio` → `main`

**Target branch:** `antigravity/engineering-trio` (PR #171)
**Base:** `main`
**Deliverable:** a single **GO / NO-GO** report with per-workstream verdicts and evidence.
**Audience:** a multi-agent swarm. Workstreams A–H are independent and parallelisable; I is the integrator and runs last.

---

## 0. Read this first

### 0.1 The one rule that matters

**Evidence, not assertion.** Every PASS must cite something measured: a command and its output, a computed number, a DOM read, a screenshot. "Looks correct" is not a result. A workstream that reports all-PASS with no evidence will be treated as NOT RUN.

**Try to break it.** Your job is not to confirm the work is good. It is to find the case where it is not. A workstream that finds nothing must state what it tried and why it believes the surface is covered.

### 0.2 Known-false-positive traps in this repo

These have all produced wrong bug reports before. Check against this list before filing anything.

| Symptom | Why it is not a bug |
|---|---|
| `body.scrollWidth` exceeds viewport | `overflow-x: clip` is set; the page does not actually scroll horizontally. Verify by scrolling, not by measuring. |
| `grep -c '<lastmod>' sitemap.xml` returns 1 | The sitemap is minified to one line. `grep -c` counts lines, not matches. Use `grep -o … \| wc -l`. |
| Routes carrying `noindex` that "should be indexed" | The `filter:` array in `astro.config.mjs` is the source of truth for what is meant to be indexed. Read it before concluding anything. |
| Images fail to load in a sandbox | `cdn.sanity.io`, `i.ytimg.com`, `substackcdn.com` and `challenges.cloudflare.com` are frequently unreachable from CI/sandbox egress. Confirm against a real network before reporting. |
| `e2e-newsletter-subscribe` fails locally | It needs Cloudflare Turnstile. It fails identically on `main` from a sandbox. Not a regression. |
| Muted grey text "fails WCAG" | It does not. `--color-white-muted` (#888) on `--color-surface` (#111) is 5.33:1. Only `--color-accent` (#cc0000, 3.21:1) fails, and it is a border/glow colour only, never text. |
| Hamburger renders 0×0 between 769px and 1024px | Pre-existing, not from this branch, and harmless: the full desktop nav list is shown at those widths. |

### 0.3 Hard constraints you must not violate while testing or proposing fixes

From `CLAUDE.md`. Treat a proposed fix that breaks one of these as an automatic NO-GO on that proposal.

1. Calendar dates are `YYYY-MM-DD` **strings**. Never `new Date("YYYY-MM-DD")` — it UTC-shifts to the previous day west of Greenwich.
2. `HeroTrailer.astro` is protected. Do not rewrite its lifecycle.
3. No `overflow: hidden` on any ancestor of a YouTube iframe (iOS Safari renders a black box).
4. Never assign an iframe `src = ''` — use `'about:blank'`.
5. No `filter: drop-shadow` on an `<img>` (iOS Safari). On inline `<svg>` it is established practice here.
6. Rearrange layouts with responsive CSS, never JS reordering or duplicated per-breakpoint markup.
7. **No em dashes in user-facing copy.** Headings, body, empty states, alt text, meta descriptions.

---

## 1. Scope

17 files changed, +2041/−24. The functional surface:

| Area | Files |
|---|---|
| Search palette (new) | `src/components/CommandPalette.astro`, `src/pages/api/search-index.json.ts` |
| Nav controls | `src/components/Navbar.astro`, `src/styles/modules/navbar.css` |
| Tap-target geometry | `src/styles/modules/a11y.css` |
| Hub pages | `src/pages/featured/[slug].astro`, `src/pages/featured/index.astro` |
| Article pages | `src/pages/intel/[slug].astro` |
| Layout / trailer | `src/layouts/Layout.astro`, `src/components/HeroTrailer.astro` |
| Tests | `scripts/command-palette.test.mjs`, `scripts/e2e-corner-controls.test.mjs`, `scripts/featured-containment.test.mjs` |

### 1.1 Regressions this branch has already shipped and fixed

**Test each of these explicitly.** They are proven failure modes for this exact code, which makes them the highest-value checks in the plan.

| # | What broke | How it was caught |
|---|---|---|
| R1 | Mobile `max-height: 60dvh` declared **above** the base `80vh` rule — equal specificity, source order won, fix did nothing. 208px of results sat behind the keyboard. | Measured panel height at an iPhone viewport |
| R2 | Header search button 38×38, 4px from a 44×44 hamburger | Measured |
| R3 | Hamburger's invisible `::before` tap band extended 48px **left, directly over the search button**, and won every tap in landscape | `elementFromPoint` at the button's centre returned `.nav-toggle` |
| R4 | Desktop search button computed **0×0** — SVG had no size and no CSS sized it. Scripted `.click()` still passed. | Measured `getBoundingClientRect()` |
| R5 | Fallback thumbnail used `logoImage.src` on a `src/assets` import — path never emitted, **broken image referenced by all 53 pages** | `e2e-asset-integrity` |
| R6 | Result rows with no image skipped the thumbnail box entirely, so the text column slid left out of the column line | Measured title X per row |
| R7 | Instagram carousel tiles unclickable in production — `inert` disables **pointer events**, not just tab order | Reported from production |
| R8 | Escape closed the `<dialog>` natively without running teardown, leaving the page permanently unscrollable | Focus off the input, then Escape |
| R9 | Cmd+K did not count as keyboard navigation, so keyboard users got **no focus indicator** | Measured `outline` across four entry routes |

---

## 2. Workstreams

### A — Search correctness and relevance

**Scope:** `CommandPalette.astro` query path, `search-index.json.ts`.

**A1. Index integrity.** Fetch `/api/search-index.json`. Assert: every entry has non-empty `title` and `url`; no duplicate `id`; every `url` resolves to a real route in the build output (200, not 404); `type` is one of `video|article|event|hub|page`; hub entries carry `hubCategory`; event entries carry both `date` and `endDate`.

**A2. Default view contract.** Empty query must yield **exactly 10**: 3 articles, 3 videos, 4 hubs. The 4 hubs must be **one from each distinct `hubCategory`** (studios, streaming, universes, gaming). No `page` entries. Assert counts and category distinctness programmatically.

**A3. Event eligibility.** Past events must never appear unprompted. Verify by stubbing the index response with: (a) an event ending tomorrow → shown if a slot exists; (b) a multi-day event that started yesterday and ends in three days → **shown**, this is the case a start-date-only check gets wrong; (c) an event that ended yesterday → hidden; (d) an event with no dates → treated as not-over. Also confirm the **backfill** path applies the same rule (force it by stubbing an index with fewer than 3 articles).

**A4. Timezone.** Set the browser to `Pacific/Kiritimati` (UTC+14) and `Pacific/Midway` (UTC−11) and re-run A3. An event must not appear or disappear a day early or late in either. This is hard rule 1 in practice.

**A5. Query quality.** For each of at least 20 queries, record the top 5 results and judge relevance: exact title match; partial title; a hub name (`marvel`, `a24`, `nintendo`); a franchise in tags but not the title; a misspelling (`marvle`, `avengrs`) — fuzzy matching should still hit; a two-word query; a query matching only a `page`; a query matching nothing. Report anything where a plainly correct result is absent from the top 5.

**A6. Ranking sanity.** `title` is weighted 2, `tags` 1, `type` 0.5, `threshold: 0.4`, `ignoreLocation: true`. Verify a title match outranks a tag-only match for the same term. Report if `threshold` is letting through results a person would call wrong.

**A7. Result actions.** Enter, click and tap each result type. Article/hub/event/page navigate to the right URL. **Video results must open the video modal, not navigate to YouTube** — verify `data-action="open-video"` and the extracted video id are correct, including for `youtu.be` short links.

**A8. Index freshness.** Confirm the index is generated at build time from the same sources the pages render from (`getVideosUnified`, `getArticleItems`, `getEventsLocal`, `getFeaturedBrandsLocal`). Add a video/article to `src/data/videos.json`, rebuild, confirm it appears. Assert **no page renders content the index lacks**, and vice versa.

---

### B — Chaos and defensive testing

**Scope:** what happens when the environment is hostile. Assume every external call fails.

**B1. Index fetch failures.** Intercept `/api/search-index.json` and return, in turn: `500`; `404`; a 30s hang; valid JSON that is `[]`; valid JSON that is `{}` (not an array); a truncated/malformed JSON body; a 50MB array. For each: the palette must not throw an uncaught error, must not lock scroll, must remain closeable, and must show a sane state. **Record any case that leaves the page unusable.**

**B2. Malformed entries.** Inject entries with: `title: null`; `url: undefined`; `type: "banana"`; a 5000-character title; a title of only emoji; RTL text; `image` pointing at a 404; `date: "not-a-date"`; `endDate` before `date`. The palette must render or skip each without throwing.

**B3. Script-load failure.** Block `fuse.js` from loading (simulate an ad blocker or CDN failure). The palette must fail visibly and safely, never silently swallow input or leave a spinner forever.

**B4. Rapid input.** Type 200 characters as fast as the driver allows, then clear, 20 times. Then hold ArrowDown for 500 events. Then open/close the palette 50 times. After each: assert scroll is unlocked, `body`/`html` carry no leftover lock class, no listener leak (compare `getEventListeners` counts or heap growth), and `document.activeElement` is sane.

**B5. Escape hatches.** Close the palette by every route: Escape from the input; Escape with focus on the close button; Escape with focus on a result; backdrop click; close-button click; result click; browser back; an Astro view transition (`astro:before-swap`). **After every one, assert the page scrolls.** R8 is why.

**B6. Concurrency.** Open the palette, then trigger a client-side navigation while it is open. Then trigger one mid-fetch. Then open it during the splash animation on `/`. Confirm no duplicate palettes (`transition:persist` is set), no double-registered listeners, and no orphaned scroll lock.

**B7. Storage and privacy modes.** Run in a private window, with cookies blocked, with JS storage throwing on access. Nothing in the palette should depend on storage, but confirm rather than assume.

**B8. Offline.** Load a page, go offline, open the palette. Then reload while offline. Report the behaviour; it should degrade, not hang.

**B9. Injection.** Search for `<script>alert(1)</script>`, `"><img src=x onerror=alert(1)>`, `{{7*7}}`, `../../etc/passwd`, and a 10KB string. Confirm results render as **text** — the row builder uses `textContent` for titles but `innerHTML` for the placeholder glyph, so verify no index-derived value ever reaches `innerHTML`. This is the single highest-severity check in the plan: a stored-XSS path from `videos.json` into the palette would be critical.

---

### C — UI, UX and interaction

**C1. Viewport matrix.** Test at minimum: 320×568, 375×667, 393×852, 430×932, 852×393 (landscape), 667×375 (landscape), 768×1024, 1024×768, 1280×800, 1440×900, 1920×1080, and 2560×1440. At each: open the palette, type, arrow through results, and close. Report anything clipped, overlapping, overflowing, or unreachable.

**C2. Keyboard geometry.** At 393×852, open the palette and shrink the visual viewport to 516px (a typical iOS keyboard). **No result may sit below the fold.** R1 is why. Repeat at 430×932 and in landscape, where vertical space is scarcest.

**C3. Tap targets.** Every interactive element in the nav bar and the palette must be ≥44×44 and **100% reachable** — for each, sample a grid across its own box with `elementFromPoint` and confirm nothing else is on top. R3 and R4 are why. Do this in **both orientations**; the landscape `::before` band is the failure mode.

**C4. Row alignment.** In the default view and for at least five queries, assert every result row shares one title X coordinate and one thumbnail box size, including rows whose entry has no image. R6 is why.

**C5. Keyboard navigation.** Tab order through the palette is sane and trapped inside the dialog. ArrowUp/Down wrap or stop predictably. Home/End if implemented. Enter opens. Escape closes. `aria-activedescendant` tracks the visual highlight exactly.

**C6. Focus indicator.** Verify all four entry routes: click (no ring), **Cmd+K (ring — R9)**, Tab-then-open (ring), Tab inside the panel (ring). Then confirm focus returns to the element that opened the palette on close, from both the header button and the shortcut.

**C7. Reduced motion.** With `prefers-reduced-motion: reduce`, the palette must not animate. Confirm the site's other motion also respects it.

**C8. Zoom.** At 200% and 400% browser zoom, the palette must remain usable and must not clip content. This is WCAG 1.4.4 and 1.4.10.

**C9. Copy review.** Every visible string in the palette: no em dashes, house voice, no truncation at any tested width. Includes the placeholder, eyebrow, empty state, and the dismiss control.

**C10. Cross-browser.** Chromium, Firefox, and **WebKit/Safari** — the last is non-negotiable. `:has()`, `dvh`, `<dialog>`, `:focus-visible` and `inert` all have Safari-specific histories in this codebase.

**C11. Real-device iOS pass.** Simulators do not reproduce this repo's known iOS bugs. On a physical iPhone in Safari: portrait and landscape, with and without Low Power Mode, with the keyboard up. Confirm the search icon is pressable in landscape (R3), the panel clears the keyboard (R1), and the × dismisses.

---

### D — Accessibility

**D1. Automated.** axe-core on every main route with the palette both closed and open. Zero new violations vs `main`.

**D2. Combobox conformance.** Against the ARIA Authoring Practices combobox pattern: `role="combobox"`, `aria-expanded` tracking reality, `aria-controls` pointing at the listbox, `aria-autocomplete="list"`, `role="listbox"` on the container, `role="option"` **plus `aria-selected`** on every row, and `aria-activedescendant` on the input.

**D3. Screen readers.** VoiceOver on iOS **and** macOS, and NVDA on Windows. Announce on open, on typing, on arrowing, and on selecting. Confirm the result count is conveyed and the active row is announced as selected.

**D4. Contrast.** Compute every foreground/background pair in the palette at rest **and on hover/focus/active**. Automated tools measure only at rest, which is exactly where a violation hid in this repo before. AA is 4.5:1 for text.

**D5. Label in name.** WCAG 2.5.3 — every control's accessible name must contain its visible text. The dismiss control shows "ESC" on desktop and "×" on touch with one accessible name; verify both.

**D6. Reachability without a mouse.** Complete a full search-and-navigate journey using only the keyboard, and again using only VoiceOver gestures on a phone.

---

### E — SEO, Google Search and Search Console

Answering the direct question: *is anything about having site search a compliance concern?*

**E1. No crawlable search-result URLs.** Confirm the palette produces **no** URL-based results page (no `?q=`, no `/search`). Google's guidance is explicit that internal search result pages should not be crawled or indexed. This branch is compliant by construction — verify it stays that way.

**E2. `/api/search-index.json` crawlability — FINDING, decide before merge.** The file is emitted as a real static asset at `dist/client/api/search-index.json` (~17KB). `robots.txt` is `Allow: /` with only `/admin` and `/local-cms` disallowed, so **it is crawlable**. It is not in the sitemap and not linked from any HTML, so discovery is unlikely but not impossible: Googlebot renders JS and may follow the fetch.

Severity: **low**. Worst case is one thin JSON URL appearing in Search Console as an indexed non-page.

Recommended fix, if taken: add `X-Robots-Tag: noindex` for `/api/*` in `public/_headers`. Prefer that over a `robots.txt` Disallow — `noindex` requires the crawler to be able to fetch the file, so disallowing it would prevent the directive from ever being read.

**`public/_headers` DOES land on the Workers deployment — answered 2026-09-12.**
This was left open above because `_headers` began as a Pages feature and this
site deploys to Workers (see CLAUDE.md), so whether the file did anything in
production was unverified. It does. Measured against a deployed branch preview:

```
curl -sI https://<branch>-beunconventionalhq.<account>.workers.dev/intel/<slug> \
  | grep -i content-security-policy
```

returned the `Content-Security-Policy` line byte-for-byte identical to
`public/_headers`. A header added to that file therefore reaches real
responses, and this is the command to re-confirm it after any change to how
the site is deployed.

Worth keeping as a standing pre-launch check for one reason: the CSP is
invisible locally. Neither `astro dev` nor a plain static server applies
`_headers`, so a policy can be wrong — or absent — through every local test
and only fail once deployed.

**E3. Do not add `SearchAction` structured data.** Schema.org `SearchAction` / the sitelinks searchbox requires a `target` URL template with a query parameter. This site has no such endpoint (E1), so any markup would be invalid. Separately, confirm current Google guidance on whether that rich result is still supported before anyone proposes it.

**E4. Sitemap integrity.** Count URLs in `sitemap-index.xml` and each child on this branch and on `main`, and diff. **The count must not drop.**

Measured baseline on this branch at commit `c8c1dda`: **50 URLs** in `sitemap-0.xml`. Build `main` and compare. A drop means pages left the build output; an unexplained rise means something newly indexable appeared and needs justifying. Specifically confirm every `/intel/*` article is present: `src/pages/intel/[slug].astro` was changed on this branch, and an earlier revision of it set `prerender = false`, which removes pages from the build output — and the sitemap is generated *from* the build output. Use `grep -o '<loc>' | wc -l`, never `grep -c`.

**E5. Prerender status.** Confirm every **content** route is still statically prerendered. `grep -rn "prerender = false" src/pages/` and diff against `main`. The expected on-demand set is the API routes only, all five of them: `live-status.json`, `youtube-webhook`, `subscribe`, `proxy`, `contact`. **No route under `src/pages/intel/`, `src/pages/featured/` or `src/pages/events/` may appear in that list.** `intel/[slug].astro` carries a comment explaining why it must stay static; read it.

**E6. Head integrity.** For a sample of at least 10 routes across every template, diff against `main`: `<title>`, meta description, canonical, `og:*`, `twitter:*`, and the presence/absence of `noindex`. The palette is injected into `Layout.astro`, so a change there reaches every page.

**E7. Gated routes unchanged.** The `filter:` array in `astro.config.mjs` is the source of truth. Confirm `/events-new`, `/links`, `/admin`, `/local-cms`, `/media-kit`, `/collaborations/press-kit` retain exactly the gating they had, and that nothing new was added or dropped.

**E8. Structured data.** Validate existing JSON-LD on article, event and hub pages with Google's Rich Results Test. No new errors vs `main`.

**E9. Rendered-HTML parity.** Fetch a sample of pages with JS disabled and confirm the primary content is present in the served HTML. The palette is progressive enhancement; it must not be load-bearing for any indexable content.

**E10. Core Web Vitals.** Lighthouse on the routes the CI gate covers, on this branch and on `main`, and diff. Pay attention to: **CLS** (the palette must not shift layout on open), **LCP** (confirm `fuse.js` and the index are genuinely lazy and not in the critical path), and total blocking time. Confirm the new fallback image is lazy-loaded and correctly sized. **Any CWV regression vs `main` is a NO-GO.**

**E11. Search Console readiness.** After merge, what to watch: Coverage for new "Indexed, though blocked" or "Crawled – currently not indexed" entries; the sitemap's submitted-vs-indexed counts; and Core Web Vitals field data. State a baseline now so a change is detectable later.

---

### F — Performance and resource behaviour

**F1. Bundle cost.** Confirm `fuse.js` (~9KB gz) and the index (~5KB gz) load **only on first palette interaction** — not on page load, not preloaded, not in the initial bundle. Verify with a network trace, not by reading code.

**F2. Repeat cost.** Opening the palette a second time must not refetch either.

**F3. Throttled network.** On Slow 3G, measure time from first interaction to a usable palette. Confirm the UI communicates the wait rather than appearing broken.

**F4. Memory.** Open/close 100 times and compare heap before and after a forced GC. Report growth that does not level off.

**F5. Long lists.** Stub 5,000 index entries. Measure typing latency. The render caps at 10 rows, so the risk is in Fuse's search cost, not the DOM.

---

### G — Cross-surface regression

The palette is in `Layout.astro`, so it is on every page. The nav and a11y CSS changes are global.

**G1. Every route.** Visit every route in the sitemap plus the gated ones. Confirm: no console errors, no layout shift, no changed nav geometry, and the palette opens and closes correctly on each.

**G2. Hub pages.** `/featured/[slug]` changed. Verify the trailer still plays once and does not loop, the replay control works, the stage is not clipped (hard rule 3), and only one player exists at a time. `scripts/featured-containment.test.mjs` guards this; run it and read what it actually asserts.

**G3. `/featured` index.** `PROD_FONT` changed from `syncopate` to `gotham` (Montserrat 500). Verify the woff2 is self-hosted, loads, is not blocked by CSP, does not cause FOUT/FOIT, and that the row labels still fit at every width.

**G4. Article pages.** `/intel/[slug]` changed. Verify prerendering, the "More From" related-article matching, and the category/content-type mapping.

**G5. Instagram carousel.** R7. Confirm tiles are clickable **in production-equivalent conditions**, that duplicated marquee groups use `tabindex="-1"` and **not `inert`**, and that `aria-hidden` is still applied to duplicates. `scripts/a11y-tokens.test.mjs` guards this.

**G6. Mobile nav.** Open the menu, confirm the search button is still reachable with the menu open, confirm the X closes it, and confirm the tap bands do not collide in either orientation.

**G7. Forms.** Contact and newsletter still submit. Turnstile still loads on first interaction and renders after a client-side navigation.

---

### H — Build, CI and supply chain

**H1. Clean-clone build.** `rm -rf node_modules dist && npm ci && npm run build` from a fresh clone. Must succeed offline.

**H2. Both gates.** `npx astro check` (0/0/0) **and** `npm run build`. They catch different classes of error in `.astro` files — a JSX comment misplacement passes one and fails the other. Run both.

**H3. Full suites.** `npm test` and `npm run test:e2e`. Expect `e2e-newsletter-subscribe` to fail only where Turnstile is unreachable; confirm that by running it against `main` too.

**H4. Test quality audit.** `scripts/command-palette.test.mjs` is new and large. **Mutation-test it**: revert each fix it claims to guard, one at a time, and confirm the corresponding assertion fails and no other does. A test that cannot fail is worse than no test — an earlier accessibility test in this repo asserted the wrong rule and certified a bug on the way in. Report any assertion that survives its own mutation.

**H5. Dependency delta.** Diff `package.json` and `package-lock.json` against `main`. `fuse.js` is the only expected addition. Check its licence, transitive dependencies, install scripts, and known advisories (`npm audit`).

**H6. Merge cleanliness.** Confirm the branch merges into current `main` without conflict and that CI is green on the merge result, not just on the branch head.

---

### I — Integrator (runs last)

**I1.** Collect every workstream's findings. De-duplicate.

**I2.** Assign each finding a severity:

- **P0 / blocks merge** — data loss, XSS, a route that 500s, a control that cannot be operated on a real device, a CWV or sitemap regression, any hard-rule violation.
- **P1 / fix before merge** — a real defect with a bounded fix.
- **P2 / file a ticket** — real but not merge-blocking.
- **P3 / note** — cosmetic or subjective.

**I3.** For every P0 and P1, state: reproduction steps, the evidence, the suspected file and line, and a proposed fix.

**I4.** Issue the verdict.

> **GO** — no P0, no P1, and every workstream reported with evidence.
> **CONDITIONAL GO** — no P0; list each P1 and whether it is fixed pre-merge or accepted.
> **NO-GO** — any P0, or any workstream that could not be run. Say which and why.

**I5.** State explicitly what was **not** tested and what risk that leaves. An honest gap is worth more than a fabricated pass.

---

## 3. Reporting format

```
## VERDICT: GO | CONDITIONAL GO | NO-GO

### Workstream results
| WS | Area | Verdict | Findings | Evidence |
|----|------|---------|----------|----------|

### P0 (blocking)
### P1 (fix before merge)
### P2 (ticket)
### P3 (note)

### Coverage gaps
### Environments tested
```

For each finding: **what** was observed, **where** (file:line or route + viewport), **how** to reproduce, **evidence** (output/measurement/screenshot), **severity**, **proposed fix**.

---

## 4. Notes for the swarm

- Workstreams **A–H are independent**. Run them in parallel. **I runs last.**
- Workstreams **C11 (real iOS device)** and **D3 (screen readers)** cannot be satisfied by a headless browser. If no agent can perform them, say so in I5 rather than reporting a pass.
- Where a check duplicates an existing test in `scripts/`, **read what that test actually asserts** before trusting it. §0.2 and H4 exist because tests in this repo have been wrong before.
- Do not fix anything you find without reporting it first. The deliverable is the report.
