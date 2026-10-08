# Antigravity brief — responsive scaling audit and ship readiness

**Target:** BE Unconventional HQ
**Branch:** `worker/feed-redesign` (mirrored to `prototype/feed-redesign`)
**Head at time of writing:** `5b2552b2`
**Model:** Gemini 3.1 Pro, multi-agent swarm

---

## 0. What this is and what it is not

This is **an audit, not an implementation task**. Do not push code. Do not open
PRs. Produce findings a human can act on, each one reproducible from the numbers
you print.

The site recently gained a viewport-scaling system (§3). It was built
incrementally under time pressure, one reported symptom at a time, and it has
never been reviewed as a whole. Two questions:

1. **Is the scaling system coherent?** Not "does this page look fine at 4K" but
   "is there one rule, is it applied everywhere, and where does it break?"
2. **Is this build shippable?** A clear yes/no with the evidence behind it.

Assume the person reading your report has not seen the code. Quote numbers.

---

## 1. Ground rules — read these before touching anything

**Read `CLAUDE.md` in the repo root first, end to end.** It encodes decisions
that look like bugs and are not. Findings that contradict it without addressing
its reasoning will be discarded. In particular:

- **Hard rule 1:** calendar dates are `YYYY-MM-DD` strings. Never
  `new Date("YYYY-MM-DD")`.
- **Hard rule 2:** `HeroTrailer.astro` is protected. Do not propose rewriting it.
- **Hard rule 3:** no `overflow: hidden` on any ancestor of a YouTube iframe.
  Several "just clip it" fixes are forbidden by this.
- **Hard rule 4:** never assign an iframe `src = ''`.
- **Hard rule 6:** no `filter: drop-shadow` on `<img>`.
- **`scripts/astro-declined-features.md`** lists things already considered and
  declined. Do not re-propose them.
- **Blurred plates are deliberately requested small.** A backdrop under
  `blur(9px)` or `blur(30px)` upscaling 2–5× is the documented trade, not a
  defect. Check the computed `filter` before reporting any image as low-res.
- **The muted-grey palette is deliberate** and was measured to pass AA. Do not
  report it as a contrast failure without new measurements.

---

## 2. Running it

```bash
npm ci
npx astro check      # must be 0 errors, 0 warnings, 0 hints
npm test             # 34 suites, ~461 assertions, all must pass
npm run build        # must complete; 77 pages
```

**Dev server quirks — budget for these, they cost hours otherwise:**

- `npm run dev` runs `scripts/dev.mjs`, which **ignores `--port` and always
  binds 4321**. You cannot run two.
- Its Vite dep cache corrupts easily. Symptom: routes 500 with
  `"The file does not exist at .../node_modules/.vite/deps_ssr/..."`, or
  `import('fuse.js')` 404s and site search silently returns nothing. **This is
  not a product bug.** Recover with: stop the server, `rm -rf node_modules/.vite`,
  restart. Never clear that directory while the server is running.
- **Verify anything suspicious against `npm run build` output in `dist/`**,
  which is authoritative. A route that 500s in dev but renders in `dist` is a
  dev-cache artifact.

**Serve the built output for measurement** rather than trusting the dev server:

```bash
npm run build && npx serve dist/client -l 8080
```

---

## 3. The system under audit

Everything below lives in `src/styles/modules/layout.css` and
`src/styles/global-base.css`.

### 3.1 The width ladder

```
                   base     ≥1920    ≥2560    ≥3400
--page-max         1536px   1920px   2240px   2600px
--feed-card         320px    380px    440px    500px
--feed-card-featured 560px   660px    760px    860px
```

`--page-max` is read by **both** `.container` and `.container-page`. Card widths
are read by `.feed-row-item` and `.feed-row--prestige .feed-row-item`.

**Intent:** a feed row shows ~5 cards and the featured shelf ~3, at any screen
size. A constant *count*, not a constant *size*.

### 3.2 The root font ladder

`html { font-size: 80% }` from 768px, stepping **90% ≥1920, 100% ≥2560,
110% ≥3400**. The whole site is authored in rem, so this scales type, padding,
gaps and measures together.

**Deliberate:** the ladder variables above are **px, not rem**. If they were rem
they would grow with the root while the `sizes` attributes stayed fixed, and
every image would go soft. `scripts/card-images.test.mjs` fails if either is
written in rem.

### 3.3 The `sizes` contract — the thing that keeps breaking

**A `sizes` attribute is a claim about the CSS.** When they disagree the browser
fetches a smaller rendition and the image is visibly soft. This has been fixed
**six times** in six different places, every time by reusing a correct string
somewhere it did not describe:

| where | promised | actual box |
|---|---|---|
| featured hero card | 360px | 768px |
| featured shelf tile | 360px | 560px |
| 4K browse rows | 360px | 500px |
| phone cards (`42vw`) | 157px | 336px |
| intel lead image | 720px | 1162px |
| intel rail thumbs | 320px | 630px |

Constants live in `src/lib/card-images.ts`; per-component ones in
`IntelMagazine.astro`, `ArticleThumb.astro`, `featured/index.astro`.

**Over-stating a box is safe** (slightly larger rendition, sharp).
**Under-stating it is the bug.**

### 3.4 Known-unresolved, do not report as new

The hero backdrop at 4K is a **5.05:1 slot holding 16:9 art**, so `cover` shows
the full width and ~38% of the height. A taller hero was tried and reverted —
the hero's content is ~537px, so a 1152px box left ~600px of dead space. See
commit `5b2552b2`. **The open question is whether there is a fourth option
nobody has thought of.** If you find one, that is a high-value finding; if not,
say so and move on.

---

## 4. The matrix

Test **every route × every viewport**. Do not sample.

**Viewports** (CSS px; also run 1× and 2× DPR where it changes a rendition):

```
 375×812    (phone)
 414×896    (large phone)
 768×1024   (tablet portrait)
 834×1112   (tablet landscape)
 1024×768   (small laptop)
 1280×800
 1440×900   (most common desktop)
 1536×960   (the base ladder step — check the boundary either side)
 1920×1080  (first ladder step)
 2560×1440  (second step)
 3440×1440  (ultrawide — no ladder step, deliberately; verify it is sane)
 3840×2160  (4K, the reported problem case)
 5120×2880  (5K — verify caps hold and nothing runs away)
```

**Also test the boundaries themselves:** 1919/1920, 2559/2560, 3399/3400. A
ladder that jumps badly at its own step is a defect.

**Routes:**

```
/                         home
/feed                     the redesigned feed
/feed#film /feed#tv /feed#games    section anchors
/feed/videos /feed/articles
/intel                    magazine spread
/intel/<slug>             ×3, including how-resident-evil-makes-being-in
/events                   list + sidebar
/events/2                 pagination
/events/<slug>            ×2, incl. new-york-comic-con-nycc-2026 and pax-unplugged-2026
/featured                 hub deck
/featured/dc-comics       hub page (the reported hero case)
/featured/marvel-comics
/category/<slug>          ×2
/about /links /media-kit
```

---

## 5. Swarm decomposition

Run these in parallel. Each agent owns its lane, prints numbers, and does not
edit code.

### Agent A — Layout integrity
Per route × viewport:
- horizontal overflow: `document.documentElement.scrollWidth > innerWidth`
- any element whose `getBoundingClientRect().right > innerWidth + 2` (name it)
- elements with computed width `0` that have visible children
- text clipped by `overflow: hidden` with no scroll affordance
- tap targets `< 44×44` CSS px below 768px
- **alignment**: for each page, does the navbar's inner edge, the hero's content
  edge and the body's content column share a left edge? Report the delta. They
  should agree within the gutter difference (~17px at 4K, `.container` uses a
  3rem clamp and `.container-page` uses 2rem — flag if that gap is visible).

### Agent B — Image resolution
For every `<img>` with a rendered width > 40px:
```js
const box = img.getBoundingClientRect().width;
const upscale = (box * devicePixelRatio) / img.naturalWidth;
```
- Report anything `> 1.05`, with: selector, route, viewport, `sizes`, `srcset`,
  chosen `currentSrc`, and the computed `filter` of the element **and its parent**.
- **Exclude** anything under `blur(≥9px)` — that is the documented trade (§1).
  State explicitly which ones you excluded and why.
- **Load pages fresh at each viewport.** Resizing an already-loaded page keeps
  the old rendition and produces false readings in both directions.
- Separately: report total image bytes per route at 1440 and 3840.

### Agent C — The scaling system as a system
This is the lane that matters most and cannot be done by measurement alone.
- Find **every** hard-coded width in CSS (`max-width: NNNpx`, `width: NNNpx`,
  `flex: 0 0 NNNpx`, `grid-template-columns` with px) and classify each:
  intentional (a component's own size) or a missed ladder participant.
- Find **every** `sizes` attribute and every `sizes` constant. For each, derive
  the real rendered box at all 13 viewports and report where the claim is short.
- Is the ladder's shape right? `--page-max` stops at 2600px. At 3840 that leaves
  ~620px of gutter each side; at 5120 it leaves ~1260px. **Is stopping correct,
  or should it keep going?** Argue it, with reference to line length for the
  hero copy and the intel standfirst (measure characters per line).
- Are there components that should scale and do not? Look especially at:
  the events list rows, the hub deck cards, the Instagram carousel
  (`CinematicGallery.astro`), the article reading column (`article.css`), the
  footer, and `CommercialRotator.astro`.
- **Recommend a coherent model.** If the current one is sound, say so and name
  the gaps. If it is not, propose the model you would replace it with, and be
  concrete about what changes.

### Agent D — Interaction and motion
- Page transitions: navigate between every pair of nav sections and confirm the
  direction is sensible (`data-page-transition` on `<html>`: `slide-forward`,
  `slide-backward`, `dive-down`, `dive-up`, `page-rows`, `none`).
- `/events` pagination: the tile list must fade **in place**. Scroll position
  must be preserved across the swap, and nothing may animate over the hero.
  Verify by recording `scrollY` before and after and sampling during.
- Article contents rail (`FloatingPageNav.astro`): click every entry on 3
  articles. The clicked entry must highlight immediately, the target must land
  consistently (~200px from the top), and the movement is an **instant jump by
  design** — not a smooth scroll. Confirm there is exactly one movement.
- Feed hero swap: clicking a card must load it into the spotlight hero. On
  `/featured/*` and `/events/*`, clicking a coverage card must play in the page's
  own stage, **not** open the site-wide modal.
- Filters on `/featured/*` and `/events/*`: cards must fade, not snap.
- `prefers-reduced-motion: reduce`: every one of the above must degrade to
  instant. Report any animation that still runs.

### Agent E — Regression and correctness
- Run `npx astro check`, `npm test`, `npm run build`. Report exact output.
- **Audit the test suite itself.** Several suites use a hand-rolled harness
  ending in `process.exit()`; tests appended after that line never run. Five
  guards were dead this way and two of them were failing. Verify every
  `scripts/*.test.mjs` has no live code after its exit, and that the assertion
  count each file prints matches the number of `test(` calls it declares.
- Console errors and failed network requests on every route.
- Site search: open the palette, type `lantern`, expect 7 results. Type 3 other
  real queries. (If it returns nothing, check §2 first — it is usually the
  dev-server cache.)
- Accessibility: axe or equivalent on every route at 1440 and 375. Report
  violations by impact. Keyboard-only pass on the nav, the contents rail, the
  feed rows and the video modal.
- Verify `dist/client` contains no `/local-cms` and that `noindex` routes match
  the `filter:` array in `astro.config.mjs` (**that array is the source of
  truth**, not any prose list).

### Agent F — Performance
- Lighthouse on `/`, `/feed`, `/intel`, `/intel/<slug>`, `/featured/dc-comics`
  at mobile and desktop, against the **built** output, not dev.
- LCP element per route, and its rendition size. The hero backdrop is a known
  LCP candidate; it is requested at `width(2560)` from
  `src/lib/entity-resolver.ts` and serves ~53 KB as WebP. Confirm, and confirm
  it is not regressing INP or CLS.
- CLS specifically at 4K, where the root font ladder changes type size.
- Report any route whose total transfer at 3840 exceeds 1.5× its transfer at 1440
  — the ladder should cost more, but proportionally.

---

## 6. Method requirements

- **Measure, do not eyeball.** Every finding carries numbers.
- **Fresh page load per viewport.** State that you did this.
- **Screenshot every route × viewport** and attach the ones supporting a finding.
- **Reproduce before reporting.** If a symptom appears once, load again and
  confirm. Flaky readings are usually the dev server (§2).
- **Check `filter` and `blur` before calling an image low-res.**
- **Read the comment next to any rule you are about to call wrong.** This
  codebase explains its decisions inline, including several that look like bugs.
  A recent regression happened precisely because a commented-out
  `min-height: 62lvh` carrying the note "Removed massive empty space" was not
  read before the same value was reintroduced.

---

## 7. Report format

One markdown document.

### 7.1 Verdict
**SHIP / SHIP WITH FIXES / DO NOT SHIP**, in the first line, with the three
findings that drove it.

### 7.2 Findings
Severity-ordered. Each one:

```
SEVERITY  blocker | major | minor | polish
WHERE     route + viewport + selector
EXPECTED  the number it should be
ACTUAL    the number it is
EVIDENCE  measurement + screenshot reference
CAUSE     the rule or file responsible, if you found it
FIX       what you would change, and what it risks
CONFIDENCE high | medium | low
```

Severity:
- **blocker** — broken layout, unreadable content, horizontal scroll, dead
  control, a11y violation at `serious`+, or a build/test failure
- **major** — visibly wrong at a common viewport (1440, 1920, 375)
- **minor** — wrong only at an uncommon viewport, or visible only when measured
- **polish** — defensible either way

### 7.3 The scaling verdict (Agent C's lane, given its own section)
- Is the model coherent? Yes/no, argued.
- Every component that does not participate, and whether it should.
- Your recommended model if you would change it, concretely.
- Where the ladder should stop, with the line-length measurements behind it.

### 7.4 Coverage
The full route × viewport matrix as a table, marked pass/fail/not-run. **Say
plainly what you did not test and why.** An honest gap is more useful than an
implied all-clear.

### 7.5 Ship checklist
```
[ ] astro check: 0 errors, 0 warnings, 0 hints
[ ] npm test: 34 suites, 0 failures
[ ] npm run build: completes, 77 pages
[ ] no horizontal overflow on any route × viewport
[ ] no image upscaled > 1.05× that is not under blur(≥9px)
[ ] no console errors, no failed requests
[ ] no axe violations at serious or critical
[ ] keyboard reachable: nav, contents rail, feed rows, video modal
[ ] reduced-motion degrades every animation to instant
[ ] LCP < 2.5s and CLS < 0.1 on /, /feed, /intel at mobile and desktop
```

---

## 8. What a good report looks like

Not: *"the feed looks cramped at 4K."*

But: *"At 3840×2160, `/feed`'s browse rows render `.feed-row-item` at 500px
(`--feed-card`), giving 5.2 cards per 2600px column — matching intent. But
`.events-page-grid` rows on `/events` stay at their base height and do not
participate in the ladder, so the events list is 38% of the visual weight of an
equivalent feed row at the same viewport. Screenshot 14. `--page-max` is applied
to the container but the rows inside carry `min-height: 4.5rem`, which the root
font ladder grows only 37% while card widths grow 56%."*

The second is actionable. The first is not.
