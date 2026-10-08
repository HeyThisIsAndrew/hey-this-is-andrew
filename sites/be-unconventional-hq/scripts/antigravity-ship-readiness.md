# Ship-readiness test pass — `worker/feed-redesign`

**Branch:** `worker/feed-redesign`, mirrored byte-for-byte to `prototype/feed-redesign`.
**Head at time of writing:** `bc4e4f41`.
**`main` is off limits.** It carries only `github-actions[bot]` content syncs. Nothing
here is to be merged into it.

Read this whole document before starting. Sections 0 and 1 are not optional.

---

## 0. STOP: we are both editing one working tree

Two agents are writing to this checkout at the same time. That has already caused
one near-miss, and it will cause a lost edit if we do not split the files.

**Currently uncommitted in this tree, authored by Antigravity, NOT by Claude:**

| File | State |
|---|---|
| `astro.config.mjs` | `inlineStylesheets` changed `'always'` → `'auto'` |
| `src/styles/modules/grain.css` | `body::before` renamed to `body::never` |

**`body::never` must not be committed.** It is not a valid pseudo-element, so the
selector never matches and the grain layer is silently deleted site-wide. That is a
legitimate bisect step and an illegitimate fix. Either restore `body::before` and
optimise the texture properly, or delete the rule and its companion
`html.modal-open` rule outright and say so in the commit. Do not leave a selector
in the tree whose purpose is to never match.

**Also untracked and unexplained** (please claim or delete): `dist-index.html`,
`lh-report.json`, `parse-lh.mjs`, `parse-lh2.mjs`, `parse-lh3.mjs`, `parse-lh4.mjs`,
`parse-lh-diagnostics.mjs`, `run-quick-lh.mjs`. `parse-lh2.mjs:3` is the sole reason
`npx astro check` reports `1 hint` against a documented 0/0/0 baseline.

**Ports.** Claude has been using `4399`. Please use something else, and prefer
`npx astro preview stop` over `pkill`. Two preview servers on one port produce a
server that answers `500` on every request while claiming to be running, which
looks exactly like a broken build and is not one.

---

## 1. Corrections to the performance report

Three of the four diagnoses in the slowness report did not survive measurement.
Please do not re-apply them as written.

### 1.1 `inlineStylesheets` — already correct, claim was stale

The report states the config has `inlineStylesheets: 'always'` inlining "400KB+"
of CSS. Measured on the current build:

- 16 external CSS files are emitted to `dist/client/assets/`
- `dist/client/index.html` carries **3** `<link rel="stylesheet">` and **10,377
  bytes** of inline CSS, not 400KB
- `index.html` is 231KB, of which **56.6KB is inline `<script>`** and 20KB is
  inline SVG. CSS is not what is making the document big.

If the document size is the FCP problem, the target is the 56.6KB of inline script,
not the stylesheets. The single largest block is 17.6KB.

### 1.2 The Ken Burns hero blur — measured at zero cost

Claim: animating `transform: scale()` on `.hero-bg-inner` while it carries
`filter: blur(30px)` "obliterates the frame rate".

Measured at idle on the homepage, 150 frames sampled per condition:

| Condition | mean | p50 | p95 | max | frames >20ms |
|---|---|---|---|---|---|
| kenburns running | 16.66ms | 16.7 | 17.5 | 18.6 | 0 |
| animation disabled | 16.67ms | 16.7 | 17.6 | 17.7 | 0 |

A 0.01ms difference is noise. Solid 60fps both ways. **This does not mean the claim
is false on the reporter's hardware** — it was measured on an Apple GPU, at idle,
in a desktop Chromium. It does mean it must not be treated as established. If you
can still reproduce jitter, please attach: device, OS, browser, and a frame-time
distribution under the same A/B, because the fix (splitting the animation onto a
wrapper) is not free and should not be paid for on a hunch.

Note also `.hero-bg-inner` already has `will-change: transform` and a transform, so
it is already promoted. Adding `transform: translateZ(0)` as the report instructs
would **overwrite** its `scale(1.15)` and snap the background to an unscaled crop.

### 1.3 The navbar prescription is harmful, and misses the real problem

The report prescribes:

```css
will-change: transform, background-color, backdrop-filter;
transform: translateZ(0);
```

Please do not. `#navbar` is present on every route for the entire session, so a
`will-change` on three properties is never released, and `will-change:
backdrop-filter` pins the most expensive layer on the page permanently. The
`translateZ(0)` is inert — the navbar is never transformed.

The actual cost is on `navbar.css:15`:

```css
transition: background 0.3s ease, border-color 0.3s ease, backdrop-filter 0.3s ease;
```

It **transitions `backdrop-filter`**, so a full-width fixed blur is re-evaluated
every frame for 300ms, on every `.scrolled` toggle and every hover. The codebase
already has a note against exactly this, in `hero.css` above `.hero-overlay`:
"Avoid animating this property; prefer opacity/transform only during scroll-driven
visuals."

**Unverified — this is a hypothesis, not a finding.** Claude was not able to
complete the A/B: `requestAnimationFrame` does not fire while the Browser pane is
hidden, and the run timed out. Please measure it properly and, if it holds, drop
`backdrop-filter` from that transition list and keep the blur static.

### 1.4 The grain

Not measured either way. See section 0 — whatever the verdict, the fix cannot be
`body::never`.

---

## 2. What changed this session, and what to verify

All in `src/components/HomeSpotlightBar.astro` unless stated.

### 2.1 `HomeSpotlightBar` — the rotating homepage band

Two instances of one component: `variant="panel"` (floating at the hero's foot) and
`variant="banner"` (full-bleed between What We Cover and Featured). Both must be
checked; several bugs this session were present in only one.

- [ ] **Titles** set in the display face, uppercase, weight 700. "Lanterns" must
      render `LANTERNS` via `text-transform`, with the stored data unchanged.
- [ ] **Brand slide** shows the BE UNCONVENTIONAL mark on a black-to-red gradient.
      The gradient must reach **no stop at full `--color-accent`** — it is the
      accent at alpha 0.06→0.34 over `#0a0a0a`, matching the hero's own glow.
      A slide of solid `#cc0000` is the bug, not the design.
- [ ] **All slide art is `loading="eager"`.** Non-current slides are
      `visibility: hidden`, and a lazy image inside a hidden element never starts
      loading, so those slides swapped in blank. Verify every slide's `<img>`
      reports `naturalWidth > 0` **before** it becomes current.
- [ ] **No `filter: drop-shadow` on any `<img>`** anywhere in the component
      (hard rule 6).
- [ ] **Mark vs CTA must not overlap at any width.** Test 320, 375, 599, 600, 768,
      1024, 1512, 1920, 2560, 3840. Assert by rect intersection, not by eye. Below
      600px the mark is absolutely positioned above the content column; at and
      above 600px it is a flex item in the row. Both must clear the CTA **and** the
      title, and the title must not truncate.
- [ ] **Frame clips.** `.spotlight-frame` is `overflow: hidden` for BOTH variants.
      Regression under test: the frame height is a clamp and lands on a fraction
      (199.672px at 1512), so the art keeps a device-pixel row the frame has given
      up and it paints as a bright line under the band. Check the bottom edge at
      many widths — the failure is width-dependent by nature, so a single width
      proves nothing.
- [ ] **Lanterns accent** is `#3E9B33`, sourced from `seriesAccent` in
      `src/data/videos.json` (five documents). It must not be hardcoded in the
      component. It is used as the eyebrow's `color`, so it must clear WCAG AA on
      `--color-surface` (it is 5.34:1).
- [ ] **Key-art crop.** Slides carry `data-art-focus`. `thumbnail` keeps
      `object-position: center 35%`; `keyart` uses `center 53%`. On the Lanterns
      art the ring occupies 43.6%–61.3% of image height and must be **fully
      visible in both variants**. The panel is the binding constraint at 9.69:1,
      not the banner at 6.4:1 — verify the panel specifically.
- [ ] **Responsive images.** `sizes` is `100vw` for the banner and
      `(min-width: 2737px) 2600px, 95vw` for the panel. The srcset ladder is
      capped at the source file's width. At 3840 both variants must select the
      **top** rung (2560w with today's art), not 1600w.

### 2.2 4K and half-4K scaling

- [ ] `.hero` is `min-height: 100vh` (no 1000px cap). At 3840×2160 the hero must
      fill the viewport and its bottom must land **on** the fold. Nothing from
      What We Cover may appear on first screen.
- [ ] Lockup ceilings raised (`.word-be`, `.word-unconventional`, `.word-hq`,
      `.hero-subtitle`). At 3840, `.word-unconventional` computes 176.8px.
- [ ] `.hero-content` has `max-width: var(--page-max)` and is centred.
- [ ] `.spotlight--banner .spotlight-frame` has
      `min-height: clamp(180px, 12vw, 450px)`. **On the frame, not the section** —
      on the section it adds empty page and crops the art just as hard. At 3840 the
      band is 450px tall and 8.5:1, down from ~13:1.
- [ ] Root font: 130% at `min-width: 3400px`.
- [ ] **Half-4K.** Layout.astro sets `data-screen-4k` inline from `screen.width`,
      and `:root[data-screen-4k]` takes 130% above a 1600px window. Verify on a
      real 4K panel with the window at half width: root must compute 20.8px, giving
      an effective 1477px layout. **CSS alone cannot detect this case** — a 1920px
      window on a 4K panel is indistinguishable from a 1080p monitor to any media
      query, which is why it is read from `screen.width`.
- [ ] Regression check: at 1512 nothing moves. Hero still fills the viewport, band
      still 6.4:1, root font still 12.8px.
- [ ] Confirm no CLS from the inline attribute. It is set before first paint
      deliberately; if it ever lands after, the whole document reflows.

### 2.3 Event hero image ladders

`cappedWidths()` in `src/lib/local-content.ts`, used by `EventHero.astro`,
`EventFeatured.astro`, `EventAnnouncement.astro`.

- [ ] No hero `srcset` requests a width above its asset's native width. 15 of 37
      assets are 1920 wide and were being upsampled to 2400. Verify a 1920 asset
      tops out at 1920 and a 2560 asset gains a 2560 rung.
- [ ] The two 3840 assets (DC, Marvel) can now be served at 3840.
- [ ] Hero `src` is still the SMALL candidate (mobile-first fallback). This is why
      the heroes were not converted to `buildImageSet`, whose `src` is the largest.

### 2.4 Splash pulse e2e

- [ ] `scripts/e2e-splash.test.mjs` passes 57/57. The bleed ceiling moved 4 → 15
      because `.hero-overlay` now carries an intentional radial glow, so the wall
      behind the CTA has a red cast of its own (measured 9 above the button, 5
      below, 0 either side; the button's interior is >30). If you raise the glow's
      alpha, this threshold needs revisiting — it is not headroom to spend.

---

## 3. Full regression sweep

- [ ] `npm test` — all suites, exit 0.
- [ ] `npx astro check` — 0 errors, 0 warnings. The `1 hint` is `parse-lh2.mjs`
      (section 0); it should be 0 once those files are dealt with.
- [ ] `npm run build` completes.
- [ ] `node scripts/e2e-splash.test.mjs` — 57/57.
- [ ] Routes return 200: `/`, `/feed`, `/intel`, `/events`, `/events/sdcc-2026`,
      `/events/archive`, `/featured`, `/featured/netflix`, `/about`, `/links`.
- [ ] Lighthouse on `/` and `/feed`, mobile and desktop. `/feed` mobile has been
      sitting at 84% against a 90% target — that gap predates this session.
- [ ] iOS Safari: the YouTube iframe on an event page still plays. Hard rules 2,
      3 and 4 are all about this one failure mode and none of them are covered by
      an automated test.
- [ ] Both branches identical: `git ls-remote origin worker/feed-redesign
      prototype/feed-redesign` must return the same SHA.

---

## 4. Known-open, not regressions

- New event hero art at **3840×960 (4:1), sRGB** has not been supplied. When it is,
  `HERO_WIDTHS` gains its 3840 rung automatically — no edit needed.
- Purpose-built spotlight band art at **3840×600 (6.4:1)**, subject inside the
  central 66% vertically and clear of the left 45%, is wanted. Same: the ladder
  picks up the rung on its own once the file exists.
- `coverageType` is empty on Coyote vs. Acme, so its chip reads ANALYSIS on a
  Review.
- 9 of 30 published videos carry no `hubs`.
- The 350ms page transition is still active on desktop. It is removable by dropping
  the `pointer: coarse` condition; this is an open design decision, not a defect.
