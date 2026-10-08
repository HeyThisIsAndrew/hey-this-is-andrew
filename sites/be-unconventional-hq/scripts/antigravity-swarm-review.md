# Antigravity Swarm Audit — `feature/ui-qa-polish` → `main`

> **Paste everything below the divider into Antigravity as one prompt.**
> Operator checklist is at the bottom under "OPERATOR TO-DO".

---

/goal Act autonomously to completion. Do not ask for approval between steps — investigate, run, measure and re-measure freely, take as long as you need. There is no time budget and no step limit. Your entire deliverable is a written report. Do NOT write, edit, delete, commit, push, or open issues/PRs on any repository, and do NOT create a branch. Produce the report described at the end, then stop.

## READ THIS BEFORE ANYTHING ELSE — TWO ABSOLUTE RULES

**RULE 1 — YOU DO NOT WRITE CODE. AT ALL.**

You are read-and-report only. Not "mostly", not "unless you are confident". On the last pass you were given this same instruction, and you created a branch, committed fixes and pushed it. One of those commits set `.nav-container` and `.safe-area-blackout` from `pointer-events: none` back to `auto` — a leaked mutation from your own falsification command whose `git restore` did not take. That single line would have shipped the site's worst bug back to production: a hidden full-screen overlay swallowing every tap on every phone. It was caught by hand, not by you, and your report said the phantom-overlay suite passed.

So: **no branches, no commits, no pushes, no edits.** If you want to test a hypothesis by changing a file, change it, measure it, and REVERT IT — then verify the revert took with `git status` before you do anything else. Report the finding as prose and a measurement. Someone else applies the fix.

**RULE 2 — YOU NEVER TOUCH THE DESIGN.**

The visual design of this site is finished and correct. It is not yours to improve, tidy, modernise, or "restore". You are hunting BUGS — things that do not work — not things you would have styled differently.

Specifically, and this has already happened once: you re-added borders, a `translateY(-8px)` lift and a box-shadow to the two Instagram rail labels, to make them look like the photo tiles. The owner had explicitly decided those labels are TEXT, not tiles. That was reverted.

If you believe a visual change would fix a functional bug, **say so in the report and stop there.** Describe the bug, the measurement, and your proposed change. Do not make it. Styling decisions belong to the owner, full stop.

Everything below assumes both rules. A report that breaks either one is worth less than no report, because it costs a cycle to undo.


## WHERE THE LAST PASS LANDED — read this before repeating it

You returned NO-GO on four findings. **One was real and valuable. Three were not.** Calibrate against this before you spend a cycle.

**RIGHT, and now fixed:** `.modal-overlay` carries `transition: all 0.4s` (modal.css:20) and was in `FIXED_CONTROLS`, so the 0.1px padding write started a 400ms transition on it, from a handler bound to `visualViewport.scroll`. Reproduced: **20 scroll events with unchanged viewport geometry produced 40 style writes** on `#navbar`. The nudge is now gated on the viewport geometry actually changing (same 20 events → **0 writes**), `.modal-overlay` is out of the list, and hidden controls are skipped. Good catch — that is exactly the job.

**WRONG — `menu-open` on `<html>` "does nothing":** correct that nothing sets it there, therefore removing it is harmless dead code, not a failure. Menu state is cleared on `#navbar` by `purgeNavbarState`. A no-op is not a bug; show the broken behaviour or do not file it.

**WRONG — "Turnstile breaks the CI pipeline":** it does not. All four `test-and-build` jobs have passed on every commit for the last six pushes. That suite talks to the network and flakes in sandboxes without egress; check GitHub's actual check runs before claiming CI is broken.

**MISREAD — "Claude fabricated `HUB_CAROUSEL_MIN_TILES` = 6 and DC = 0":** that sentence is in THIS BRIEF, describing an *earlier* audit's fabrication so you would not repeat it. Claude never made that claim; 7 and 6 are the values Claude reported originally, and your own run confirmed them. Read whose words you are quoting.

**SUSPECT — Lighthouse Best Practices 77:** CI reports **100**. Your sandbox blocks `cdninstagram.com`, `i.ytimg.com` and `wsrv.nl`, and the console errors from those blocked requests sink that category. If you report a Best Practices number again, first list the console errors it is counting and say which are from blocked hosts.

**Scroll-lock losing position on refresh:** you correctly marked it pre-existing on main. Also note the homepage *deliberately* resets to the top on reload — that is bug 5/6 below, a fix, not a defect.

### New since your last pass — verify these specifically

- The geometry gate above. Confirm 0 writes on geometry-unchanged scroll bursts, and confirm it still nudges when the geometry DOES change, or the whole fix is dead.
- `orientationchange` and window `resize` listeners, with the correction repeated at 0/120/320/600ms. **Newest device repro:** load, press ENTER THE HQ, THEN rotate to landscape — navbar and X stop responding; starting in landscape is fine. Unverified on hardware.
- 89 lines of dead `.content-card.event-card` CSS were removed from `home-cards.css`. Confirm nothing regressed on `/events`, `/featured` or the homepage.
- `e2e-phantom-overlay` now sweeps 4 viewports, not 1. It was blind at 1024×1366, where `.nav-container` is a static 498×53 strip.

## Context

You are the **independent verifier** on a release candidate for **BE Unconventional HQ** — Astro 7 (static + `@astrojs/cloudflare`), Tailwind v4, deployed on Cloudflare Workers.

- Branch: **`feature/ui-qa-polish`** (identical content on `claude/unconventional-hq-mobile-qa-bibyua`), targeting **`main`**.
- Another agent (Claude) made these changes, tested them, and returned **GO**.

Your job is **not** to agree. It is to falsify. A second independent GO is what allows this to merge; a NO-GO **with a reproduction** is equally valuable.

### Budget: spend it

You have fresh credits and no deadline. Use them:

- **Run every suite at least twice**, and the e2e suite three times. Flakiness that appears in 1 run of 3 is a finding.
- **Run multiple swarm agents in parallel.** The assignments below are written to be independent.
- **Re-measure anything you are about to report.** A number you saw once is a hypothesis; a number you saw twice, from two directions, is evidence.
- Prefer more passes over more speculation. If you find yourself reasoning about what the code "would" do, go run it instead.

### Rules of evidence — these are not optional

A previous audit returned NO-GO on three "critical" claims. **One was real. Two were false and one contained fabricated numbers** (it reported a constant as 6 when the source says 7, and a page as having 0 qualifying items when it has 6). That wasted a cycle.

So:

1. **Never report a defect you have not reproduced.** Every finding needs: `file:line`, exact commands or steps, observed vs expected, and the measurement you took.
2. **Quote real values.** If you cite a constant, paste the line. If you cite a measurement, paste the number your tooling produced. Do not paraphrase from memory.
3. **A claim you could not test is not a claim you verified.** Say so explicitly.
4. **Distinguish "pre-existing" from "introduced by this branch."** Diff against `main`, not against the branch point — that distinction has already produced one wrong conclusion here.
5. **Check your own measurement's preconditions before believing it.** Three false failures in this work came from sampling a moving target: the navbar's return transition runs 500ms on a 300ms delay, so anything measured before ~900ms after the splash lifts reads a bar that is still translated off-screen at y=-81. If a result surprises you, dump the geometry and the class list at the moment you sampled, and check the element was where you think it was.
6. If you disagree with Claude, **show the measurement**, not the reasoning alone.

### Read this first

`CLAUDE.md` at the repo root encodes constraints learned the expensive way — calendar dates as strings, the protected `HeroTrailer.astro`, no `overflow: hidden` above a YouTube iframe, never `iframe.src = ''`, no `filter: drop-shadow` on `<img>`, the three field classes in `videos.json`. **Check the diff against every one of them.**

## What changed — the claims to falsify

Read the whole diff: `git log --oneline main..feature/ui-qa-polish` and `git diff main...feature/ui-qa-polish`.

**Seven device-reported bugs were fixed. Three shared one pattern — interaction blocked on state that can be wrong — and three more were scroll/hit-testing behaviour that Chromium cannot reproduce.** Those two clusters are your highest-yield hunting ground.

1. **Phone stuck in landscape.** A closed full-screen overlay still received touches. `.nav-container` is fixed, full-width, 100dvh on every page; making it scrollable made it a composited layer, and iOS routes touches to it while invisible. Fixed with `pointer-events: none` when closed.
2. **iPad navbar untappable.** Same class: `#video-modal` (mounted by `Layout.astro` on *every* route, z-index 300, above the navbar's 100) and `#qr-modal` on `/links` were hidden but still `pointer-events: auto`. Guarded, plus `scripts/e2e-phantom-overlay.test.mjs` enforces the invariant across 12 routes.
3. **iPad carousel: tiles at both ends could never be opened.** The tap-to-centre handler gated links on `.is-active`, which requires crossing the track's horizontal centre — impossible for the end tiles. 4 of 10 dead in iPad landscape. Gate is visibility now; `scripts/e2e-carousel-rail.test.mjs` dispatches real clicks at five widths including tablets.
4. **Splash trap on refresh.** `html.splash-armed { overflow: hidden }` freezes whatever offset the document has; iOS restores scroll on refresh and races the reset, so the reader was frozen mid-page, and `touch-action: none` removed the escape. `arm()` now scrolls to top *before* freezing, plus a while-armed safety net.
5. **Jarring up/down glide on refresh.** `html { scroll-behavior: smooth }` is global, so the reload path's three resets did not jump — they *animated*. Measured at 390×844: a bare `scrollTo(0,0)` from 1500 passes through **25** distinct intermediate positions; pinned to `auto` it reports **1**.
6. **The `scroll-behavior` opt-out never applied — six call sites.** Setting `root.style.scrollBehavior = 'auto'` only marks style dirty; with no recalc before the scroll, `scrollTo()` still reads `smooth`. Measured, jumping 390→0, scrollY on the next frame: pin only → **390**; pin + forced recalc → **0**. Extracted to `src/lib/scroll-to.ts` (`jumpTo()`), which pins, forces the recalc, then scrolls. Then: one-shot resets could still be beaten by a late scroll restore, so the reload path now HOLDS the top as a condition (releasing on the first real input). Before: every restore timing painted 8–16 frames at the old offset, one was never corrected. After: 0.
7. **Landscape corner controls unpressable (iPhone, multiple tabs).** The reporter's own diagnosis: it stops the moment every other tab is closed, and *"the user has to tap just beneath each icon for it to actually press."* Safari's landscape tab bar collapses/expands on scroll, resizing the web view; iOS leaves fixed elements hit-tested at the old coordinates. Fixes now on the branch: `src/lib/viewport-anchor.ts` re-resolves fixed controls on `visualViewport` resize/scroll; invisible `::before` hit expansion (6px down inside the bar, 48px left across its empty middle); `touch-action: manipulation`. **A landscape-clearance approach was tried and REVERTED** — growing the header broke `.hero` and `.nav-container`, both of which are measured against it. Do not propose regrowing it without accounting for both.

   **Newest repro, and the sharpest clue yet:** load the site, press ENTER THE HQ, THEN rotate to landscape — the navbar and X stop responding. Starting the session already in landscape works. So the trigger is not the orientation, it is **a viewport resize arriving after the controls have been laid out**. `viewport-anchor.ts` now also listens to `orientationchange` and window `resize`, and repeats the correction at 0/120/320/600ms because a rotation is animated and one early pass lands on a layout still in motion. **Unverified on real hardware — say whether it holds, and whether taps still land below the glyph.**

Also in scope: Instagram topic qualification (`src/lib/instagram-topic.ts`, `HUB_CAROUSEL_MIN_TILES`), hover de-flicker, Featured row width, contact-modal removal, and a median-of-3 Lighthouse gate.

## Swarm assignments

Run these in parallel. Each returns findings with `file:line` and a reproduction. **Fix nothing.**\n\n**Assume this branch is broken in ways nobody has looked at yet.** Two agents and a full CI suite passed it three times while a device found three regressions. "The tests pass" is evidence about the tests, not about the branch.

### Agent 0 — REGRESSION HUNT vs `main` (do this first, and weight it highest)

**This is now the most important assignment, because this branch has a track record.** Three separate regressions were reported from a device *after* CI was green and both agents had reviewed it:

- The category overlay's X fell out of its corner into the middle of the overlay on `/feed` and `/intel`, in both orientations. Cause: `a11y.css` is imported last, and its bare `.nav-toggle { position: relative }` beat `filters.css`'s `position: absolute` — because the overlay's close button is `class="close-fullscreen-btn nav-toggle menu-open"` and deliberately **shares the toggle's class**.
- The landscape header was grown by ~30px to buy tap clearance, and `.hero { padding-top: 5.5rem }` and `.nav-container { padding-top: calc(... + 4.25rem) }` are both measured against the old height — so the hero slid under the header.
- The category list stayed a vertical column in a 440px landscape viewport and turned into a scroller.

**Every one of those is the same failure: a change whose blast radius was larger than the author checked.** Assume there are more. Your job is to find them.

- **Diff every changed CSS selector against `main` and ask "what else matches this?"** For each selector this branch touches, run `document.querySelectorAll` for it on every route and list every element it hits. Shared classes across components are the specific trap here.
- **`src/styles/modules/a11y.css` is imported LAST** (`src/styles/global.css` line 37). Anything it declares wins ties. Audit every rule in it for reach.
- **Screenshot-diff `main` against this branch**, route by route, at every breakpoint in Agent 2's list, portrait and landscape, in these states: default, scrolled, mobile menu open, category overlay open, video modal open, calendar open. Report any pixel difference that is not an intended change from the list below. This is the single highest-yield thing you can do.
- **Anything measured against another element's size** is suspect. Grep for hard-coded offsets (`4.25rem`, `5.5rem`, `padding-top` values that clear a fixed header) and verify each still matches the thing it is clearing.

### Agent 1 — Chaos / state-corruption

Every bug this session came from a component reaching a state its author did not anticipate. Produce those states.

- **Overlay chaos:** open and close the mobile menu, category overlay, video modal and calendar rapidly and in overlapping sequences. Open one from inside another. Rotate mid-animation. Navigate (ClientRouter) with an overlay open. Hit browser Back with one open. Verify the scroll lock's reference count always returns to zero — a stuck lock leaves the page pinned. `src/lib/scroll-lock.ts`.
- **Refresh × scroll position:** reload at the very top, mid-page, at the very bottom, and mid-splash-animation, on `/` and interior routes. Then try to scroll **up**. This family has shipped four times.
- **The top-guard's release path specifically.** After a reload the page holds itself at the top until the first touch/pointer/wheel/key, or 3s. Try to catch it fighting a real scroll: flick immediately on load, flick at 2.9s, start a momentum scroll and reload mid-flight, scroll with a stylus/trackpad, scroll via keyboard only. A page that fights the reader is a worse bug than the one it fixes.
- **Orientation churn:** rotate repeatedly with the menu open, the carousel mid-scroll, and during the splash lift.
- **Back/forward:** traverse in and out of the homepage repeatedly; the splash must not arm on a back-navigation to a scrolled position.
- **Throttling:** 4x CPU slowdown and slow-3G. The splash bug is a race; races hide behind fast machines.
- **Reduced motion:** `prefers-reduced-motion: reduce` through every animated path.
- **Double/triple tap** on carousel tiles, nav links and CTAs; **long-press**; **two-finger** scroll.

### Agent 2 — UI/UX and visual regression

- Every route at 320 / 390 / 430 / 768 / 834 / 956 / 1024 / 1366 / 1440 / 1920 / 2560, **portrait and landscape**. Tablet and landscape-phone widths are explicitly required: bugs 3 and 7 lived there.
- **The landscape header got taller** (`padding-top` 0.4rem→1.15rem, `padding-bottom` 0.4rem→1rem, toggle 44→56px). Judge it: does the short landscape viewport still work? Is the hero still legible? Does anything clip or collide that did not before? This was a deliberate trade — say if it was the wrong one.
- Horizontal overflow, clipped or overlapping content, broken grids, inconsistent gutters, layout shift.
- Typography: the two Instagram rail labels must share family, weight, letter-spacing ratio, colour and uppercase treatment (size may differ).
- Confirm the Featured row aligns with the Subscribe box, and that `/events` and `/feed` are unchanged.
- Hover states on a real pointer: park the cursor **on the edge** of Instagram tiles and in-article YouTube embeds and watch for flicker — the failure was an oscillation at frame rate, visible only at the boundary.

### Agent 3 — Touch targets and the corner controls (bug 7)

- Read `src/styles/modules/a11y.css` (corner-controls section), `landscape.css`, `src/lib/viewport-anchor.ts`, `scripts/e2e-corner-controls.test.mjs`.
- **Hit-test the real pixels.** At 956×440, 932×430 and 844×390, walk a grid over `.nav-toggle` (menu closed AND open), `.modal-close` and `.close-fullscreen-btn`, using `document.elementsFromPoint`. Report the effective area and how far it extends in each direction.
- **The trade to audit:** the hit band extends below the glyph. It must NOT reach past the navbar's opaque box onto page content — an invisible target stealing a real control's taps is worse than the bug. Verify on every route, not just the five the test covers. **Wait ≥900ms after the splash lifts before sampling** or you will measure a bar that is still off-screen.
- Try to construct a viewport where the band spills: very short viewports, large text/zoom settings, `text-size-adjust`, 200% browser zoom.
- **If you have real iOS Safari, this is the single most valuable thing you can bring.** Test with 3+ tabs open, in landscape, scrolling until the tab bar collapses. Report whether the icons are now pressable ON the glyph, and if not, measure how far below the glyph the working point is.

### Agent 4 — E2E, unit and type checks

- `npm ci`, then `npx astro check` (report exact error/warning/**hint** counts; the bar is zero new), `npm test`, `npm run test:e2e` (16 suites), `npm run build`.
- **Then the thing that matters most: verify the new tests can actually fail.** Several tests written in this work initially passed against a deliberately reintroduced bug because they measured the wrong thing. For each of `e2e-phantom-overlay`, `e2e-carousel-rail`, `e2e-reload-scroll`, `e2e-corner-controls`, `e2e-viewport-anchor` and `splash-scroll-lock`: reintroduce the original defect in a scratch copy, rebuild, and confirm the test fails **with a message that names the real problem**. Report any that do not.
- Run the e2e suite **three times**. Note anything order-dependent or timing-dependent.

### Agent 5 — Instagram topic qualification AND its performance cost

The owner reports you previously flagged that the way Instagram images are pulled in will aggressively impact Lighthouse. **Re-establish that claim with measurements, or withdraw it.**

- Read `src/lib/instagram-topic.ts`, `src/lib/instagram.ts`, `InstagramFeed.astro`, both hub `[slug].astro` pages, and the `/api/proxy` route.
- Independently recompute from `src/data/instagram.json` and `src/data/videos.json` which posts qualify for DC, Marvel, SDCC and D23. **Paste your counts.** Confirm `HUB_CAROUSEL_MIN_TILES` and quote the line.
- Verify: DC renders no carousel; Marvel's tiles are genuinely Marvel (caption evidence per tile); unrelated posts cannot pad a short row; an empty keyword list qualifies nothing; the homepage rail is unaffected.
- **The performance claim, measured:** Instagram tiles are served full-resolution through `/api/proxy` with **no `srcset`**, unlike every other host (resized WebP via wsrv.nl). Quantify it: total bytes for the rail, largest single image, decoded size vs displayed size, effect on LCP and on the Performance score with and without the rail present. State the delta in points. Claude investigated this and concluded it is **not** what fails the Lighthouse gate — confirm or refute **with numbers**, and say which pages are affected.

### Agent 6 — Accessibility

- Keyboard-only pass over every overlay and the carousel: focus order, visibility, trapping, Escape, focus return on close.
- **Known and deliberately open:** full focus-trapping is not implemented on all overlays. Report as a gap, not a regression.
- Verify Escape closes the mobile menu, the calendar close button has a visible focus ring, `CategoryOverlay` declares `role="dialog"`.
- **`touch-action: manipulation` was added to three controls.** Confirm it does NOT disable pinch-zoom anywhere, and that the viewport meta still has no `maximum-scale` / `user-scalable=no`. Zoom to 500% and navigate.
- Screen-reader semantics on the Instagram rail: the left label must not be announced as interactive; the right one must be.
- Headings: exactly one `<h1>` per page, no skipped levels. **`/category/*` legitimately has none** — they are `noindex` meta-refresh redirect shims.

### Agent 7 — Performance and build integrity

- `npm run lighthouse` and `npm run lighthouse:desktop`. Report every number, every run.
- Scrutinise the median-of-3 confirmation in `scripts/lighthouse-check.mjs`: does it still fail a genuine reproducible regression, or has it been weakened into a way to hide one? Confirm the **worst** sample is written to the artifact.
- **New JS this branch adds:** `src/lib/scroll-to.ts` and `src/lib/viewport-anchor.ts`. The latter binds `visualViewport` resize/scroll and does a forced layout read per control. Measure its cost during sustained scrolling — is it causing layout thrash? Report frame times with and without it.
- The reload path's top-guard adds a scroll listener for up to 3s after every reload. Measure its cost.
- Check for new render-blocking resources, CLS, and oversized images.

## Environment notes — do not report these as defects

- `npm ci` first. Node 22.
- **External image hosts** (`cdninstagram.com`, `i.ytimg.com`, `wsrv.nl`, `qrserver.com`) may be blocked in your sandbox. Broken images and `ERR_TUNNEL_CONNECTION_FAILED` from those hosts are environmental — but note if they prevented you from verifying something, especially for Agent 5's payload numbers.
- The Substack article sync may fail without network; it degrades to empty **by design**.
- `npm run test:e2e` needs ports 4321/4323/4324/4325 free. Kill stray `workerd` / `astro preview` first.
- The newsletter e2e suite talks to the network and can fail spuriously in a sandbox; re-run before reporting it.
- **If you have WebKit/Safari, say so and use it.** Every iOS fix here is verified by construction and in Chromium only. Chromium hit-tests hidden and fixed elements correctly and resets scroll on reload, so it cannot reproduce four of the seven original bugs. Real Safari is the single most valuable thing you can bring.

## Required output

Report only. No code changes, no commits, no issues.

1. **VERDICT: GO or NO-GO** — first line.
2. **Confidence** (high/medium/low) and what would raise it.
3. **Blocking defects** — each with `file:line`, reproduction steps, observed vs expected, the measurement, and which claim it falsifies. Mark each **introduced by this branch** or **pre-existing on main**.
4. **Non-blocking findings**, ranked.
5. **Tests that cannot fail** — any of the six that still passed with the defect reintroduced.
6. **The Instagram/Lighthouse claim** — restated with numbers, or withdrawn.
7. **Claims you could NOT verify**, and why. State plainly whether you tested real iOS Safari, and with how many tabs open.
8. **Disagreements with Claude**, each with the measurement behind it.
9. **Numbers**: build, `astro check` (errors/warnings/hints), unit, e2e ×3, both Lighthouse runs.

Be adversarial and specific. "Looks fine" is not a finding; neither is a defect without a reproduction. If you believe this is safe to merge, say GO and say why you are confident.

---

## OPERATOR TO-DO — how to run this

**Model:** use **Gemini 3.1 Pro**. It is the stronger reasoner of the two available and this is an analysis job, not a code-writing job. Do **not** switch to the Claude agent in Antigravity — the whole point is an independent second opinion, and a second Claude checking the first Claude's work is worth much less to you.

1. **Pull the branch in Antigravity:** `feature/ui-qa-polish`. Confirm it is at commit `4251681` or later.
2. **Paste the prompt** — everything between the two `---` dividers above, starting at `/goal`.
3. **Let it run.** It is told it has no time budget. Expect a long run if it is doing the job properly; a fast answer is a warning sign, not a good sign.
4. **When it reports back, paste the whole report to me.** Do not act on it yourself — the last audit's report contained two false criticals and one fabricated number, and I will need to verify each finding against the code before anything changes.
5. **What I need from you in parallel** (only you can do these — no sandbox has a real iPhone):
   - Load the site, press **ENTER THE HQ**, then **rotate to landscape**, then tap the hamburger and the X. Newest repro; the fix is unverified.
   - Landscape, **3+ tabs open**, scroll until Safari's tab bar collapses, then tap the hamburger **on the glyph**. If it still needs a low tap, roughly how far below — "half an icon", "a whole icon"?
   - **Categories X** on `/feed` and `/intel`, portrait and landscape: in its corner, one row, no scroller?
   - **Landscape homepage**: header at its original height, hero not sliding under it?
   - Refresh mid-page, both orientations — no up/down lurch?

**Merge gate:** two independent GOs (mine and Antigravity's) plus your device pass on the five items above.
