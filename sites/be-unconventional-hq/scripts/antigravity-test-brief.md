# Antigravity test brief — events coverage overhaul

Paste everything between the `=== BEGIN PROMPT ===` and `=== END PROMPT ===`
markers into Google Antigravity as the task for its agent swarm.

Written for **Gemini 3.1 Pro**, which on this project has repeatedly reported
design decisions as defects and asserted measurements it never took. The
prompt is therefore structured around evidence rather than opinion: every
finding must carry a number or a selector that a human can re-run. The
"Cannot be a bug" list is not optional politeness, it is a list of specific
false positives this model has already filed here.

Keep this file in sync when the routes or the false-positive list change.

---

=== BEGIN PROMPT ===

# ROLE

You are a **test execution swarm**. You measure and you report. You are not a
designer, a reviewer, or an editor.

# ABSOLUTE PROHIBITIONS

Violating any of these makes your entire report unusable.

1. **Do not modify any file in the repository.** No edits, no fixes, no
   "while I was here". You have read access and a browser. That is all.
2. **Do not commit, push, branch, stash, or run any `git` command that
   writes.** `git status`, `git log`, `git diff` are fine.
3. **Do not report a defect you did not observe.** If you did not run the
   step, the step has no result. Write `NOT_RUN`.
4. **Do not report an opinion as a defect.** "The spacing feels cramped",
   "the grey is too light", "this would be better as a grid" are not
   findings. A finding is a broken behaviour, a wrong number, or a crash.
5. **Do not invent URLs, file paths, CSS selectors, or element IDs.** Every
   one you use must come from this brief or from something you actually
   queried in the DOM. If a selector returns null, report that it returned
   null. Do not substitute a similar-looking one and continue.
6. **Do not judge layout from a screenshot alone.** Screenshots are evidence
   attached to a finding, never the basis for one. Get numbers from
   `getBoundingClientRect()`, `getComputedStyle()`, `scrollWidth`,
   `document.documentElement.scrollWidth` and so on.
7. **Do not report anything on the "CANNOT BE A BUG" list below.** Those are
   settled decisions. Reporting one wastes a review cycle.

# SETUP — run these exactly

```
node -v                  # must be >= 22.15
npm ci                   # only if node_modules is absent
npm run build            # must exit 0. If it does not, STOP and report that.
npm run preview          # serves the built site on http://localhost:4321
```

`npm run preview` runs wrangler. It prints a Local Explorer banner BEFORE the
worker is listening, so **do not treat the first line containing
`http://localhost:` as readiness.** Poll `http://localhost:4321/` until it
returns HTTP 200, then begin.

Headless Chrome in a container needs `--no-sandbox --disable-dev-shm-usage`.

The homepage (`/`) has a splash curtain. Interior pages do not. If you land on
`/` and the page seems frozen, click `[data-splash-trigger]`. Every route in
this brief except `/` is free of it.

The site uses Astro's ClientRouter (view transitions). **Clicking a link is
NOT the same as `page.goto()`.** Several checks below depend on the
difference and say so explicitly. Where a step says "click through", clicking
is the test. Do not replace it with a navigation.

# RULES OF EVIDENCE

Every finding you file must contain all five fields, or it is discarded:

- `route` — the exact URL you were on
- `viewport` — `WIDTHxHEIGHT` you had set
- `selector` — the element you measured, as a CSS selector that resolves
- `observed` — the actual value (a number, a string, a count, an error)
- `expected` — what this brief said it should be

If you cannot fill `expected` from this brief, you are reporting an opinion.
Do not file it.

**A FINDING THAT REPEATS IDENTICALLY IS ONE FINDING, AND PROBABLY YOURS.**
If the same `observed` value appears on every route at every viewport, stop.
That is the signature of a broken selector or an unloaded asset in YOUR
harness, not of a defect on every page of the site. Before filing more than
five findings that share an `observed` value, verify the selector resolves
on one page by hand and say in `out_of_scope_observations` that you did.

**Reproduce before filing.** Run the failing step a second time from a fresh
page load. If it does not reproduce, mark it `FLAKY` and say so. Do not
silently drop it and do not file it as confirmed.

**Console errors:** capture `pageerror` and `console.error` on every page you
visit. Report them verbatim. Do not paraphrase a stack trace.

# CANNOT BE A BUG — do not report these

These have all been filed before and are all wrong. They are design decisions
or accepted trade-offs, documented in `CLAUDE.md`.

1. **The muted grey text palette.** `--color-white-muted` (#888888) on
   `--color-surface` (#111111) is 5.33:1 and passes WCAG AA. So does
   `--color-accent-text` (#ef4444) at 5.02:1. `--color-accent` (#cc0000) is
   3.21:1 and is a border and glow colour only, never text. Do not report
   contrast on `--color-accent` unless you find it applied to text or an
   icon, in which case report the exact selector where.
2. **The hero trailer restarting when the device rotates.** Tested,
   accepted, impossible to fix without a jsapi redesign.
3. **`noindex` on `/events-new`, `/links`, `/admin`, `/local-cms`,
   `/media-kit`, `/collaborations/press-kit`.** All deliberate. The
   authority is the `filter:` array in `astro.config.mjs`, not your
   intuition about what should be indexed. `/media-kit` and
   `/collaborations/press-kit` also correctly have no canonical tag,
   because they do not use the shared layout.
4. **`/local-cms` showing "Restricted Access" in a production build.** That
   is the route working as designed. It exists only in dev.
5. **Missing `overflow: hidden` on wrappers around YouTube iframes.** Its
   absence is deliberate and load-bearing: iOS Safari renders a clipped
   iframe as a black box.
6. **A hub or event page with no coverage showing an empty state.** Some
   hubs genuinely hold no content yet. That is data, not a defect.
7. **An event page with no ARTICLES/VIDEOS filter row.** The row renders
   only when BOTH articles and videos are present in the visible tiles. Its
   absence on a single-kind page is correct and intentional.
8. **An event page with no "All coverage" link.** It renders only when the
   event has more than 6 items. Most do not.
9. **Em dashes in code comments.** House style bans them in visitor-facing
   copy only.
10. **The 3-column editorial layout on event pages.** It is built and
    correct. Do not propose rebuilding it.
11. **"Official Gaming Hub" rather than "Official Game Hub".** PlayStation,
    Xbox and Nintendo are platforms. The label is deliberate and there is a
    test pinning it.
12. **A hub card heading of plain "Official Hub".** That is the fallback for
    a hub whose `hubCategory` is unset. If you see one, report it as an
    OBSERVATION naming the hub, not as a defect: it is a data gap the
    fallback is designed to make visible.
13. **An article with no hub card.** Some articles are about the industry
    rather than a brand, and get no card. Correct, and expected on roughly
    one page in ten.
14. **"More From Intel" missing below 1200px.** Deliberate. The article
    column already renders "Suggested Reading" below the body at every
    width, and showing the rail's copy too would print the same links twice
    in a row.
15. **The "Contents" / "On This Page" rail missing below 1200px.**
    Deliberate. A jump-link list belongs beside the text or nowhere.
16. **A hub logo that fails to load.** The marks are served from
    `cdn.sanity.io`. If your environment cannot reach it, the `<img>` is
    still correct in the HTML. Check the `src` attribute before reporting,
    and report a network failure under `third_party_failures`.

# CURRENT DATA STATE — measured, so you do not mistake it for a defect

The site's content store is small right now. These numbers were taken from a
real build immediately before this brief was written. **Read them before you
file anything about a missing control.**

| Route | coverage tiles | cards outside the coverage section | filter buttons | "All coverage" link |
|---|---|---|---|---|
| `/featured/marvel-comics` | 6 | 1 (an Upcoming Events card) | 2 | none |
| `/featured/dc-comics` | 6 | 0 | 2 | none |
| `/featured/a24` | 1 | 0 | 0 | none |
| `/featured/xbox` | 1 | 0 | 0 | none |
| `/events/avengers-doomsday-premiere` | 1 | 0 | 0 | none |
| `/events/sdcc-2026` | 2 | 0 | 0 | none |
| `/events/blizzcon-2026` | 0 | 0 | 0 | none |

And on the article side, across all eleven `/intel/<slug>` pages:

| Hub card heading | how many articles |
|---|---|
| Official Franchise Hub | 4 |
| Official Streamer Hub | 4 |
| Official Studio Hub | 2 |
| no hub card at all | 1 (a piece about physical media, which is about no brand) |

Only two per-event coverage feeds are built, because only two events have any
coverage: `/events/avengers-doomsday-premiere/coverage` and
`/events/sdcc-2026/coverage` return 200. Every other
`/events/<slug>/coverage` returns 404 BY DESIGN.

Consequences you must accept rather than report:

- **No event page has more than 6 tiles today**, so no event page shows an
  "All coverage" link. The six-item cap is therefore an INVARIANT you verify
  (never more than 6), not a threshold you can watch being crossed. If you
  cannot make an overflow link appear, that is the data, not a bug: mark
  those steps `NOT_RUN` with the reason `"no event exceeds the cap in the
  current data"`.
- **No event page shows a filter row today**, because each holds only one
  kind of content. The row is gated on both kinds being present. Its absence
  on these two routes is CORRECT. Test the filter behaviour on the hub
  routes, which do have it.
- `/events/avengers-doomsday-premiere` holds exactly one article. One tile is
  the complete, correct coverage for that event right now.

If any of these numbers differs when you run, report the difference as an
observation with your measured value — the store may have been synced since.
A number being HIGHER than 6 in the first column is always a finding.

# SWARM ASSIGNMENTS

Seven agents. Scopes do not overlap. Do not let an agent wander outside its
scope — if it notices something elsewhere, it reports it under
`out_of_scope_observations`, not as a finding.

---

## AGENT 1 — Event coverage: the cap and the overflow feed

Routes:
- `/events/avengers-doomsday-premiere` (Avengers: Doomsday Premiere)
- `/events/sdcc-2026`
- `/events/avengers-doomsday-premiere/coverage`
- `/events/sdcc-2026/coverage`

Viewports: 390x844, 768x1024, 1440x900.

Steps and expected values:

1. On **every** `/events/<slug>` route in the site (there are 19 — get the
   list from the links on `/events` and `/events/archive`, do not type them
   from memory), count
   `document.querySelectorAll('[data-coverage="event"] .content-card').length`.
   **Expected: 6 or fewer, on every single one. Never 7 or more.** This is
   the invariant the whole change rests on. If you find 7+, that is a
   BLOCKER: report the count and the route.
2. Read `[data-coverage="event"] .coverage-more-link`. Per the data table
   above, **you will probably find none, and that is correct** — mark steps
   2 and 3 `NOT_RUN` with the reason `"no event exceeds the cap in the
   current data"` and move on. If one DOES exist, read its `href` and its
   text; the text contains a number in parentheses. **Expected:** `href` is
   `/events/<the slug you are on>/coverage`, and the number is strictly
   greater than the tile count from step 1.
3. If the link exists, click it. **Expected:** you land on that URL, HTTP
   200, and the page shows at most 12 `.content-card` elements.
4. On any `/coverage` page, check `.coverage-back` exists and its `href` is
   the event page. Click it. **Expected:** you land back on the event page.
5. On any `/coverage` page, if a "Next" pagination link exists, click it.
   **Expected:** HTTP 200, more cards, and the URL ends in `/coverage/2`.
6. Visit `/events/blizzcon-2026/coverage` directly. **Expected: HTTP 404.**
   That event has no coverage, so the route is deliberately not built. A 404
   here is a PASS. Report `PASS` even though it is a 404.

---

## AGENT 2 — The coverage filter, including the deep-link bug

This agent tests the single highest-risk behaviour in the change. Read the
whole section before starting.

Routes:
- `/featured/marvel-comics`
- `/featured/dc-comics`
- `/events/avengers-doomsday-premiere`

Viewports: 390x844 (do this one first, the bug was reported on a phone) and
1440x900.

**Part A — filters on a page you navigated to directly.**

For each route that has `.filter-btn` elements inside its coverage scope
(`[data-coverage="hub"]` on `/featured/*`, `[data-coverage="event"]` on
`/events/*`):

1. Count tiles inside the scope at rest. Call it `N`.
2. Count `.content-card` elements OUTSIDE the scope
   (`document.querySelectorAll('.content-card')` minus those inside). Call
   it `OUTSIDE`. This number is the whole point of the next steps.
3. Click the `ARTICLES` button. Record:
   - visible tiles inside the scope — **expected: every visible one has
     `data-type="article"`**
   - visible `.content-card` OUTSIDE the scope — **expected: still exactly
     `OUTSIDE`.** If this number drops, that is a confirmed, severe finding:
     a filter is hiding content in a section it does not own.
   - the button's `aria-pressed` — **expected: `"true"`**
4. Click `ARTICLES` again. **Expected: all `N` tiles visible again, and
   `aria-pressed` back to `"false"` on every button.** A button that cannot
   be deselected is a confirmed finding.
5. Click `VIDEOS`, then click `ARTICLES` without clicking `VIDEOS` again.
   **Expected: exactly one button has `aria-pressed="true"`, and only
   article tiles are visible.**

**Part B — the deep link. This is the reported bug. Do not skip it and do
not substitute a page load for the click.**

1. `page.goto('/events/avengers-doomsday-premiere')`.
2. Find the link to the franchise hub:
   `document.querySelector('a[href^="/featured/"]')`. **Expected: it exists
   and points at `/featured/marvel-comics`.**
3. **CLICK it.** Do not call `goto`. The bug only exists when both pages'
   JavaScript modules are alive at once, which only a client-side navigation
   produces. A `goto` reloads the document and hides the defect entirely.
4. Wait 500ms for the transition.
5. Now run every step of Part A on the hub you landed on.
   **Expected: identical results to visiting `/featured/marvel-comics`
   directly.** Any difference between the two is a confirmed finding —
   report both sets of numbers side by side.
6. Specifically confirm: after clicking a filter here, the "Upcoming Events"
   tiles above the filter row are still visible. **Expected: visible.**
   Them vanishing is the exact originally-reported symptom. On
   `/featured/marvel-comics` there is exactly ONE such card (see the data
   table), so the number to watch is 1 before the click and 1 after. On
   `/featured/dc-comics` there are none, which means that route cannot
   exercise this step at all — run it on marvel-comics.

---

## AGENT 3 — Responsive layout and horizontal overflow

Routes: `/`, `/events`, `/events/avengers-doomsday-premiere`, `/events/sdcc-2026`,
`/events/archive`, `/events/avengers-doomsday-premiere/coverage`, `/featured`,
`/featured/marvel-comics`, `/intel`, `/feed`.

Viewports: 320x568, 390x844, 414x896, 844x390 (landscape), 768x1024,
1024x768, 1440x900, 1920x1080.

For each route at each viewport, measure and report:

1. `document.documentElement.scrollWidth` vs `window.innerWidth`.
   **Expected: scrollWidth <= innerWidth + 1.** Anything more is horizontal
   overflow: a confirmed finding. When you find one, also report the widest
   offending element, found with:
   ```js
   [...document.querySelectorAll('*')]
     .map(el => ({ sel: el.tagName + (el.className ? '.' + String(el.className).split(' ')[0] : ''),
                   right: el.getBoundingClientRect().right }))
     .filter(x => x.right > window.innerWidth + 1)
     .sort((a, b) => b.right - a.right).slice(0, 5)
   ```
2. Any text node whose element has `scrollWidth > clientWidth + 2` AND
   `white-space: nowrap` — that is clipped text. Report the selector and
   both numbers.
3. Any element whose `getBoundingClientRect().left` is less than 16 at
   viewport widths under 768, other than full-bleed backgrounds and images.
   The page keeps a 16px side gutter.

Do NOT report: something merely looking tight, uneven, or unbalanced. Only
numbers.

---

## AGENT 4 — Links, routes and status codes

1. Crawl every internal `href` on every route listed for Agent 3, two levels
   deep. Record the HTTP status of each.
   **Expected: 200 for every internal link that is rendered on a page.** A
   rendered link returning 404 is a confirmed finding. Report the source
   route, the href, and the status.
2. Confirm the two coverage routes that SHOULD exist do
   (`/events/avengers-doomsday-premiere/coverage`, `/events/sdcc-2026/coverage`
   — both 200) and that a coverage route for an event with no coverage does
   NOT (`/events/blizzcon-2026/coverage` — 404, which is a PASS).
3. For each route, report `<title>`, the meta description, and whether a
   `<link rel="canonical">` exists. **Expected: a canonical on every route
   EXCEPT `/media-kit` and `/collaborations/press-kit`.** Do not report
   those two.
4. Report any `<a>` with an empty or `#` href that is not a legitimate
   in-page anchor target.

---

## AGENT 5 — Console, network and runtime health

For every route listed for Agent 3, at 390x844 and 1440x900:

1. Capture every `pageerror` and every `console.error`. Report verbatim,
   with the route. **Expected: none.**
2. Capture every failed network request (status >= 400, or a request that
   errored). Report the URL, the status and the initiator route.
   **Expected: none for same-origin requests.** Third-party requests
   (youtube.com, sanity.io, substackcdn.com) may fail in a sandboxed
   environment — report them separately under `third_party_failures` and do
   NOT count them as findings.
3. On each event page and each hub page, confirm no iframe has
   `src=""`. **Expected: any parked iframe uses `about:blank`.** An empty
   string here is a confirmed, severe finding — it reloads the whole site
   inside the frame.
4. Report the count of elements with `data-bound="true"` inside
   `[data-coverage]` after a page load, and again after a client-side
   navigation to the same page type. **Expected: the same count both times.**
   A growing count means listeners are stacking up.

---

## AGENT 6 — Keyboard and assistive technology

Routes: `/events/avengers-doomsday-premiere`, `/featured/marvel-comics`,
`/events/avengers-doomsday-premiere/coverage`.

1. Tab through the whole page. Record the focus order as a list of
   selectors. **Expected: no focus trap, and no element that receives focus
   while invisible (`getBoundingClientRect().width === 0`).**
2. On a page with a filter row, focus a `.filter-btn` and press Enter, then
   Space. **Expected: both activate it, and `aria-pressed` flips.**
3. Confirm each `.filter-btn` has an `aria-pressed` attribute that is
   `"true"` or `"false"`, never missing and never `"undefined"`.
4. Confirm the coverage grid has exactly one accessible heading above it and
   that heading is not empty.
5. Report any `<img>` without an `alt` attribute. **Expected: none.** An
   empty `alt=""` on a decorative image is correct — do not report it.

---

## AGENT 7 — The hub card and the article support rail

The newest work, and the least covered by anything else here.

Routes: every `/intel/<slug>` page (get the list from the links on `/intel`,
do not type them from memory), plus `/events/avengers-doomsday-premiere` for the
event-side version of the same card.

Viewports: 390x844, 844x390, 768x1024, 1024x768, 1440x900. All five. The
whole point of this section is that the rail used to exist only on desktop.

**Part A — the heading is a property of the HUB, not of the page.**

1. On each article page, read
   `document.querySelector('.rail-hub .article-rail-head')?.textContent`.
   **Expected: one of exactly these four strings**, or no card at all:
   `Official Franchise Hub`, `Official Streamer Hub`, `Official Studio Hub`,
   `Official Gaming Hub`. Anything else is a finding. `Official Hub` is the
   documented fallback: report it as an observation naming the route, per
   item 12 above.
2. Read the card's link: `.rail-hub-card` href. **Expected: it starts with
   `/featured/` and returns 200.** Follow it and confirm.
3. **Cross-check the heading against the hub it links to.** Open the
   `/featured/<slug>` page it points at and read the row label the hub page
   shows for itself. It will be one of `Franchises`, `Streamers`, `Studios`,
   `Games`. **Expected: the pair matches this table exactly.**

   | card heading on the article | row label on the hub page |
   |---|---|
   | Official Franchise Hub | Franchises |
   | Official Streamer Hub | Streamers |
   | Official Studio Hub | Studios |
   | Official Gaming Hub | Games |

   A card headed "Official Streamer Hub" linking to a hub in the Studios row
   is exactly the bug this section exists for, and it is a MAJOR finding.
   Report both strings and both routes. Note the fourth row: the singular of
   the "Games" row is "Gaming", NOT "Game". That pairing is correct and is
   item 11 on the cannot-be-a-bug list.
4. Tally the four headings across all eleven articles and compare with the
   table above. A tally that differs is an observation, not a finding, but
   report the numbers you measured.

   **No article currently resolves to a gaming hub**, so you will probably
   never see "Official Gaming Hub" in the wild. Do not report the label as
   missing or broken on that basis. If you want to see it exercised, the
   assertion lives in `scripts/hub-card.test.mjs`, which you may RUN
   (`node scripts/hub-card.test.mjs`) but must not edit.

**THE EXACT SELECTORS. Do not guess these.**

A previous run invented `img.hub-card-logo` and `.rail-hub-logo img`.
Neither exists: the `<img>` IS `.rail-hub-logo`, it is not inside it. Both
queries returned null, the harness's own fallback substituted
`logoH: 0, leftOfText: false`, and it filed 120 MAJOR findings that were all
one wrong selector. Use these and nothing else:

| what | selector |
|---|---|
| the whole card (the link) | `.rail-hub-card` |
| the box the mark sits in | `.rail-hub-mark` |
| **the mark itself** | `.rail-hub-logo` (an `<img>`, NOT a wrapper) |
| the copy block beside it | `.rail-hub-text` |
| the call to action | `.rail-hub-cta` |
| the heading above the card | `.rail-hub .article-rail-head` |

If any of these returns null, that is itself the finding. Report the null.
Do NOT substitute a default value and measure it.

**THE MARK IS LAZY-LOADED AND BELOW THE FOLD.** It has `loading="lazy"` and
no width/height attributes, so it measures 0x0 until it is on screen AND
decoded. Before measuring anything, on every page and every viewport:

```js
document.querySelector('.rail-hub').scrollIntoView({block:'center', behavior:'instant'});
// then, in the page:
const img = document.querySelector('.rail-hub-logo');
if (img && !img.complete) await new Promise(r => { img.onload = r; img.onerror = r; });
```

**THE MARKS COME FROM cdn.sanity.io.** If your environment cannot reach it,
every mark measures 0 and none of the size assertions mean anything. Check
`document.querySelector('.rail-hub-logo').naturalWidth` first: if it is 0,
the image never loaded. That is a `third_party_failures` entry, NOT a
layout finding, and you must mark the size steps `NOT_RUN`.

**Part B — the rail is not desktop-only any more.**

For each viewport, on an article page that HAS a hub card:

1. Is `.article-rail-right` visible (`getBoundingClientRect().height > 0`)?
   **Expected: yes at every one of the five viewports.** This is the whole
   fix. A `height` of 0 below 1200px is a BLOCKER.
2. Are all three of `.rail-hub`, `.article-rail-desk` and `.referral-block`
   visible? **Expected: yes, at every viewport.**
3. At 1200px and below only:
   - `.article-rail-left` **must NOT be visible** (the TOC stays desktop-only)
   - `.article-rail-more` **must NOT be visible** (it would duplicate
     "Suggested Reading")
   - `.article-related` (in the column) **must be visible** — that is the
     copy that survives
   - `getComputedStyle(rail).position` **must not be `sticky`**
   - the rail's `getBoundingClientRect().top` must be **greater than or
     equal to** `.article-column`'s `getBoundingClientRect().bottom`, give or
     take 2px. The rail goes AFTER the article, never before it.
4. Measure the vertical gap:
   `.rail-hub` top minus `.article-column` last child's bottom.
   **Expected: between 70 and 130 pixels.** It was 144 and that was judged a
   hole; below ~60 the section break stops reading. Report the number you
   measure at each viewport whatever it is.
5. `document.documentElement.scrollWidth` vs `window.innerWidth` on these
   pages at every viewport. **Expected: no more than 1px difference.**

**Part D — touch feedback, checked the only way that works.**

`.rail-hub-card` and `.referral-item` each have an `:active` rule. Two
things have made this check give a false answer before:

  ASTRO SCOPES THE SELECTOR. It ships as
  `.rail-hub-card[data-astro-cid-XXXXXXX]:active`, so a substring test for
  `".rail-hub-card:active"` never matches. Match with a regex that allows
  the attribute: `/\.rail-hub-card(\[[^\]]*\])?:active/`.

  THE CSS IS PER PAGE. These styles ship only on pages that render the
  component. Checking `document.styleSheets` on `/` finds nothing, because
  the homepage has no hub card and no referral rail. Run the check on an
  `/intel/<slug>` page that HAS a hub card.

Report PRESENT or MISSING for each, with the matched selector text.

**Part C — the event side still works.**

On `/events/avengers-doomsday-premiere`, confirm the card is present, its
heading is `Official Franchise Hub` (Marvel is a franchise, so this one IS
correct), and it links to `/featured/marvel-comics`. The card markup moved
into a shared component recently; this is the check that the move did not
drop it.

---

# OUTPUT CONTRACT

Return ONE JSON object. No prose before or after it. No markdown fence around
it if your tooling can emit raw JSON.

```json
{
  "run": {
    "commit": "<output of: git rev-parse --short HEAD>",
    "build_exit_code": 0,
    "started_utc": "<ISO 8601>",
    "finished_utc": "<ISO 8601>",
    "browser": "<name and version>"
  },
  "agents": [
    {
      "agent": "1",
      "scope": "Event coverage: the cap and the overflow feed",
      "steps_run": 6,
      "steps_not_run": 0,
      "result": "PASS | FAIL | PARTIAL"
    }
  ],
  "findings": [
    {
      "id": "F1",
      "agent": "2",
      "severity": "BLOCKER | MAJOR | MINOR",
      "route": "/featured/marvel-comics",
      "viewport": "390x844",
      "selector": "[data-coverage=\"hub\"] .filter-btn[data-filter=\"article\"]",
      "observed": "aria-pressed stayed \"true\" after a second click",
      "expected": "aria-pressed returns to \"false\" on a second click",
      "reproduced": true,
      "steps": ["goto /featured/marvel-comics", "click ARTICLES", "click ARTICLES"],
      "screenshot": "<path, or null>"
    }
  ],
  "third_party_failures": [],
  "out_of_scope_observations": [],
  "not_run": [
    { "agent": "3", "step": "1920x1080 on /intel", "reason": "<why>" }
  ]
}
```

Severity, decided by consequence and nothing else:

- `BLOCKER` — content is lost or unreachable, a page errors, a control cannot
  be undone, or a rendered link 404s.
- `MAJOR` — a documented expected value in this brief is wrong, but the page
  still functions.
- `MINOR` — cosmetic and measurable (a 3px overflow, a missing `alt`).

If `findings` is empty, say so with an empty array. **An empty findings array
is a completely acceptable outcome and is far more useful than a padded one.**
Do not invent findings to appear thorough. A report with three real findings
beats a report with three real ones and nine invented ones, because a human
has to check all twelve.

# SELF-CHECK BEFORE YOU SUBMIT

Answer each of these to yourself and fix anything that fails:

1. Does every finding have all five evidence fields filled with real values?
2. Did I actually run every step I claim a result for?
3. Does any agent report `result: "PASS"` with `steps_run: 0`? An agent that
   ran nothing did not pass. Set it to `"NOT_RUN"` and put the reason in
   `not_run`. A previous run reported agents 5 and 6 as PASS having executed
   zero steps, which reads as two clean areas that were never tested.
4. Is any finding on the "CANNOT BE A BUG" list? Remove it.
5. Is any finding phrased as a preference rather than a measurement? Remove
   it.
6. Did I modify any file? If yes, revert it and say so loudly at the top of
   `out_of_scope_observations`.
7. For Part B of Agent 2 — did I CLICK the link, or did I navigate to it? If
   I navigated, that step is `NOT_RUN`, not `PASS`.
8. For Agent 7 — did I run Part B at ALL FIVE viewports, or only the ones
   that were convenient? The rail being desktop-only is the bug it replaces,
   so a run that skipped the phone viewports has tested nothing.
9. Is my output valid JSON that parses?

=== END PROMPT ===
