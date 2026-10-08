# Antigravity brief: BE Unconventional HQ performance and interaction audit

**Repository:** `HeyThisIsAndrew/BeUnconventionalHQ`
**Branch to check out and test: `worker/feed-redesign`**
`prototype/feed-redesign` is kept byte-identical to it, so either works, but use
`worker/feed-redesign` as the canonical one. **Do not test `main`** — it does not
have the Feed rail work.

**If you push anything, push to your own branch** (e.g.
`antigravity/perf-audit`). Do not push to `worker/feed-redesign`,
`prototype/feed-redesign` or `main`. Reporting without pushing is fine and is
the default expectation.

---

## The two reported problems

### 1. `/feed` fails the mobile Lighthouse gate. Everything else passes.

From CI on commit `09b74c44`, mobile, median of 3 runs:

| Page | Perf | A11y | Best practices | SEO |
|---|---|---|---|---|
| `/` | 91% | 100% | 100% | 100% |
| **`/feed`** | **75%** ❌ | 95% | 100% | 92% |
| `/intel` | 96% | 100% | 100% | 100% |
| `/events` | 95% | 100% | 100% | 100% |
| `/featured` | 94% | 100% | 100% | 100% |
| `/about` | 96% | 100% | 100% | 100% |
| `/intel/la-comic-con-2026` | 97% | 100% | 100% | 100% |

`/feed` confirmation samples: 73% / 75% / 76%. **Consistent, not noise.**

Metric breakdown for `/feed`:

```
first-contentful-paint      1.4 s    98
largest-contentful-paint    7.9 s     3   <-- the whole problem
total-blocking-time        170 ms    93
cumulative-layout-shift        0    100
speed-index                 1.4 s   100
interactive                 8.1 s    42
```

**The contradiction to explain.** LCP is 7.9s but the reported LCP phases add up
to ~336ms:

```
Time to first byte       27ms
Resource load delay      20ms
Resource load duration   19ms
Element render delay    270ms
```

LCP element is `<img id="hero-bg" src="https://i.ytimg.com/vi/…/maxresdefault.jpg">`.
Either the LCP candidate changed late or the element is being blocked by
something the phase breakdown does not attribute. **Finding out which is the
single most valuable thing in this audit.**

### 2. Interaction latency on mobile: 1 to 2 seconds before a transition starts

Reported by the owner on a real phone: tap a control, and it takes **1 to 2
seconds before the transition even begins**. Not a slow animation, a slow
*start*. Reproduce this first and characterise it before theorising.

---

## What has already been fixed, so you do not re-report it

Two regressions were found and fixed at `09b74c44` and after. If you still see
these, say so loudly, because it means the fix did not hold:

1. **A 414 KB logo shipping as a plain `src`.** `logoImage.src` on an imported
   asset resolves to a path Astro never emits under compile-time image
   optimization, so it 404'd on 27 pages. Routing it through `getImage()` fixed
   the 404 but, without dimensions, emitted the 414 KB original — it became the
   heaviest request on `/feed` at 405 KB, larger than the hero backdrop, for an
   element that renders at 180px tall. Now sized. Heaviest logo variant
   referenced by `/feed` went **403 KB -> 75 KB**.
2. **`CommercialRotator`'s banner logo**, same asset, unsized `<Image>`,
   displayed at 48px tall. Now `height={96}`.

**Both landed after the CI numbers above were measured.** Your first job is to
re-run the gate and report the new `/feed` score. If it is still under 90%,
everything below applies.

---

## Ground rules

- **Read `CLAUDE.md` first.** It documents hard rules learned expensively.
  Several of them are performance-adjacent and will look like bugs if you do not
  know them: `HeroTrailer.astro` is protected, no `overflow: hidden` on any
  ancestor of a YouTube iframe, never assign an iframe `src = ''`, no
  `filter: drop-shadow` on `<img>`.
- **Read `scripts/astro-declined-features.md`.** Incremental builds, LQIP
  placeholders and the Sanity content loader are explicitly declined. Do not
  re-propose them.
- **Read the comment next to any rule you are about to call wrong.** This
  codebase explains its own trade-offs in place, and several "obvious
  optimisations" were tried and reverted with the reason written down.
- **Measure. Do not eyeball.** Every claim needs a number and how you got it.

## How to run it

```bash
npm ci
npm run build                  # production build, fully offline
npm test                       # 35 offline suites
npx astro check                # must stay 0 errors / 0 warnings / 0 hints
PUBLIC_DISABLE_ANALYTICS=true npm run lighthouse
npm run test:e2e               # 27 suites, ~8 minutes
```

**Dev-server traps that will waste your time:**
- `scripts/dev.mjs` ignores `--port` and binds 4321.
- Vite's dep cache corrupts into routes 500ing and site search silently
  returning nothing. Both look like product bugs and are not. **Verify against
  `dist/`, not the dev server.**
- The e2e runner starts its own preview server. **Never run two e2e suites
  concurrently** — they collide on the port and the failure looks like a test
  failure. (This happened during the investigation and produced a false result.)
- `e2e-newsletter-subscribe` and `e2e-turnstile-lazy` fail in some local
  environments on `networkidle0` never settling for the homepage. They pass in
  CI. Confirm against CI before reporting them.

---

## Lane A — why `/feed` LCP is 7.9s

This is the priority. `/feed` is the only page failing and LCP is the only
metric failing badly.

1. Reproduce the gate result. Report the current median-of-3 `/feed` mobile
   performance score post-fix.
2. **Resolve the phases-vs-total contradiction.** 336ms of attributed phases
   against a 7.9s LCP. Get the real LCP candidate timeline. Did the candidate
   change? Is the element in the viewport at paint time? Is it being deferred by
   a `content-visibility`, a mask, an animation, or the ClientRouter?
3. The hero backdrop is a YouTube `maxresdefault.jpg` from `i.ytimg.com`, a
   **third-party origin with no preconnect measured**. Quantify the connection
   setup cost on a throttled mobile connection. Would `preconnect` or an
   origin change actually move LCP, and by how much?
4. `/feed` renders **8 rails, 88 tiles, ~154 `<img>` elements**. Establish how
   many are actually fetched before LCP, and whether lazy loading is doing its
   job. Rails scroll horizontally, so tiles beyond the fold are still inside a
   scrolling container — confirm whether the browser treats them as in-viewport.
5. Compare `/feed` against `/featured` (94%) and `/events` (95%), which are also
   image-heavy. **What does `/feed` do that they do not?** That contrast is
   likely to hand you the answer faster than profiling `/feed` alone.

Report: the cause, the measured cost of each contributor, and the smallest
change that moves LCP under the gate.

## Lane B — the 1 to 2 second interaction delay on mobile

Reproduce on a real or emulated mobile device with CPU throttling, not on a
desktop browser.

1. **Characterise it first.** Which controls? Every control, or specific ones?
   Time from `pointerdown` to first visual change. Is the delay before the
   handler runs, inside it, or between it and the first paint?
2. Candidate mechanisms, all present in this codebase — confirm or eliminate
   each with a measurement rather than by reading:
   - Astro `ClientRouter` view transitions. `Layout.astro` has
     `directionFor()` with `slide-forward`, `slide-backward`, `dive-down`,
     `dive-up`, `page-rows`, `none`.
   - The splash / scroll-lock system (`src/lib/scroll-lock.ts`,
     `splash-armed` / `splash-lifting` / `splash-dropping` on the root).
   - `astro:page-load` handlers re-binding on every navigation — `FeedGrid`
     alone binds per rail.
   - `html { scroll-behavior: smooth }`, which makes every anchor jump animate.
   - The coverage filter's `FADE_MS = 180` two-step.
   - 88 tiles' worth of `reveal` / `animate-on-scroll` IntersectionObservers.
3. Main-thread profile during the delay. What is actually executing? TBT on
   `/feed` is 170ms, which does NOT obviously explain a 1-2s stall, so the cause
   is likely waiting rather than computing. Find out what it is waiting on.
4. Check whether it is worse on `/feed` than elsewhere. If so, Lane A and Lane B
   may share a cause.

Report: the mechanism, a trace, and the smallest fix. If the answer is "a
transition is waiting on an image decode", say which image.

## Lane C — the rest of the performance surface

Lower priority. Only after A and B.

- `/feed` SEO is 92% and accessibility 95%, the lowest of any page. Both pass,
  but every other page is at 100%. Find the specific audits and report them.
- Asset integrity: `npm run test:e2e` includes `e2e-asset-integrity`, currently
  reporting 1,863 references across 78 pages all resolving. Confirm it stays
  green, and report any reference that is present-but-oversized rather than
  merely missing — that is the class of bug the 414 KB logo belonged to.
- The `sizes` attribute contract. `src/lib/card-images.ts` declares px ladders
  that must mirror `--feed-card` / `--feed-card-featured` in
  `src/styles/modules/layout.css`. **This has been wrong six times.** Verify
  every declared width against what the CSS actually renders at 390px, 768px,
  1440px and 3840px.
- A blurred backdrop plate is requested SMALL deliberately (640px on
  `/featured`, 900px on a hub page) because the blur destroys more than the
  upsample costs. **Check computed `filter` before reporting an upscale**, and
  state which images you excluded on that basis.

---

## What is out of scope

Do not redesign anything. Do not change the information architecture. Do not
propose removing rails, sections or content. Do not touch the visual system:
typography, spacing, colour, card treatment, rail behaviour, the navbar or the
footer. Do not add CMS fields.

The Lanterns curated collection on `/feed` is deliberate and owner-designed.
Do not "fix" it.

This is a performance and interaction-latency audit.

---

## Report format

Lead with a verdict line:

> **`/feed` mobile performance is now N%. The LCP cause is X. The interaction
> delay is Y.**

Then, per finding:

- **Severity**: blocks the gate / measurable regression / minor
- **Evidence**: the number, and the command or trace that produced it
- **Cause**: the specific file and line
- **Fix**: the smallest change, with the expected delta
- **Confidence**: high / medium / low, and what would raise it

End with:
- what you could not test, and why
- anything you expected to find and did not
- any finding you are reporting at low confidence, flagged as such

A finding without a number is not a finding. "The Feed loads a lot of images" is
useless; "`/feed` fetches 41 images before LCP, 18 of them below the fold,
costing 2.1s on a throttled connection" is actionable.
