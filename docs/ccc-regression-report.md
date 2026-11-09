# Capture Create Caffeinate regression report

**Implementation handoff for Antigravity Gemini 4 Argon · November 8, 2026**

**Route** [/hey-this-is-andrew/ccc/](https://heythisisandrew.github.io/hey-this-is-andrew/ccc/)

**Live revision** [`0b20e22` · successful Pages deployment](https://github.com/HeyThisIsAndrew/hey-this-is-andrew/actions/runs/42544661948)

**Pre-overhaul comparison** [`f94671f` · previous successful deployment](https://github.com/HeyThisIsAndrew/hey-this-is-andrew/actions/runs/42518778675), rebuilt locally from Git.

## Scope and recovery references

Repair the CCC page in place. Keep the current content, photography and captions, two-line hero, paired Contact and Portfolio controls, video section, package details, and five-field inquiry flow. Scope the layout and scroll changes to CCC. Check any necessary shared-component changes against their other callers.

The previous production build establishes the original layout, especially the alternating “How it works” grids. It predates the custom CCC parallax. The exact owner-approved animated build is unidentified. For motion, compare the candidate revisions below before choosing a reference. Use a matching build or the owner's recording for aesthetic decisions. Implement the independently reproducible layout, accessibility, and timing fixes while that comparison is pending.

| Revision | What to compare |
| --- | --- |
| [`95969ce`](https://github.com/heythisisandrew/hey-this-is-andrew/commit/95969ce) | Earlier restoration of the production layout with the inquiry modal. |
| [`8ffbf4a`](https://github.com/heythisisandrew/hey-this-is-andrew/commit/8ffbf4a) | Introduces the cinematic typography and in-section effects. Also removes the split-grid CSS still needed by “How it works.” |
| [`71fc613`](https://github.com/heythisisandrew/hey-this-is-andrew/commit/71fc613) | Last build before the switch to one hero dock. Compare cumulative desktop docking, compact landscape docking, and the closer push-up. |
| [`b9314f5`](https://github.com/heythisisandrew/hey-this-is-andrew/commit/b9314f5) and [`fb7514b`](https://github.com/heythisisandrew/hey-this-is-andrew/commit/fb7514b) | First switches to one hero dock and a scale/fade on consecutive sections. Second adds overlapping section edges, mobile image overlap, and separate mobile fold-out offsets. Compare these two if the reference used a single dock. |

## CCC-01 · P1 · Restore the “How it works” layout

**Reproduce.** At 3840 × 2160, scroll to “Four hours, no disruption.” Its crew photo is 2,765 CSS px wide and pushes the numbered steps below it. The second split repeats the problem. The full section is 9,816 px tall, compared with 2,165 px in the pre-overhaul build. The crew photo was 520 px wide there. At 1512 × 982 the same section grows from 2,022 to 5,394 px.

**Cause.** [`ccc.astro` markup](../sites/hey-this-is-andrew/src/pages/ccc.astro#L287) still renders `.ccc-split`, `.ccc-split-media` and `.is-flip`. The typography commit removed their CSS while replacing the “Why it matters” layout. The remaining global image rule fills each now block-width wrapper.

**Fix.** Recover the split-specific grid, spacing, and media sizing from `f94671f:sites/hey-this-is-andrew/src/pages/ccc.astro` around lines 402–418. Reapply it to the two `#how` rows using the current `.ccc-steps` and `.ccc-easy` children. Desktop media goes left in the first row and right in the second. Below 900 px use a single column in reading order. Start from the previous 520 px photo cap and calibrate against the reference. The source files are 735 px wide. Keep the existing copy and responsive image pipeline.

**Accept when.** At 900, 1512, 1920 and 3840 CSS px, both media and copy share a row and the image fits its grid track. At 390 and 899, both stack in the intended order. At 4K the first image and steps are visible in the same view when landing on the section.

## CCC-02 · P1 · Restore coherent wide-screen proportions

**Reproduce.** Open the page at 1512 × 982, then compare 1919 × 1080, 1920 × 1080, 2560 × 1440 and 3840 × 2160. Measure CSS pixels at 100% zoom. Rounded Chromium measurements at rest:

| Viewport width | Root type | Content width | Hero title | Hero logo | Hero CTA row | Why photo | Work drink tile | Packages photo |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1512 | 12 | 1421 | 38.4 | 260 | 380 | 580 | 454 | 420 |
| 1919 | 12 | 1804 | 38.4 | 260 | 380 | 580 | 581 | 420 |
| 1920 | 16 | 1382 | 51.2 | 260 | 380 | 580 | 434 | 420 |
| 2560 | 16 | 1843 | 51.2 | 260 | 380 | 580 | 588 | 420 |
| 3840 | 16 | 2765 | 51.2 | 260 | 380 | 580 | 895 | 420 |

At 4K the hero action row occupies 9.9% of the viewport, versus 25.1% at 1512. The older 4K build had a 747 px action group and a 57.6 px hero title with a different typeface and different controls. Treat those as reference measurements. The section titles now measure 60.8 px at 4K versus 43.2 px previously, so a blanket type increase would enlarge headings that have already grown. The 1920 × 2160 half-window simulation and the 1920 × 1080 viewport at DPR 2 matched the 1920 CSS-width sizes above.

**Cause.** Two layers interact.

- The shared wide-screen rule `font-size: calc(75% * (100vw / 1512))` leaves a length in a percentage calculation. Chromium reports `CSS.supports('font-size', value) === false`; it falls back to 16 px. At the same breakpoint `--page-max` changes from 94vw to 72vw, shrinking the content by 422 px as the viewport widens by 1 px. Both predate the overhaul and reproduce on `f94671f`. [Global scaling](../sites/hey-this-is-andrew/src/styles/global.css#L7), [layout tokens](../packages/tokens/tokens.css#L73), [shared container](../packages/ui/src/styles/base.css#L58).
- CCC mixes fixed caps for the logo, CTA row, Why photos and Packages photo with rem-capped text and fluid media grids. The 380 px CTA cap was added in [`fdb5921`](https://github.com/heythisisandrew/hey-this-is-andrew/commit/fdb5921) with the equal-width row. The Why photos reach 580 px while the columns and their overlap offsets follow different sizing rules. A negative margin by itself cannot make a photo cross a track boundary once its width is capped. The Work and Video grids continue to grow. [Hero sizing](../sites/hey-this-is-andrew/src/pages/ccc.astro#L398), [Why tracks and caps](../sites/hey-this-is-andrew/src/pages/ccc.astro#L711), [Packages and closer sizing](../sites/hey-this-is-andrew/src/pages/ccc.astro#L1008).

**Fix.**

1. Introduce CCC-scoped width and sizing values through a route class or wrapper. Keep the existing 1512 geometry as a control for unaffected sections. Bridge the width breakpoint continuously, measuring around 1919/1920 and at 2560 and 3840. Size the hero and section type, brand marks, action group, media tracks and spacing separately. Keep prose measures in characters and preserve a two-line hero with equal-width controls. Confirm the actual visual targets against the reference build and on the owner's display.
2. Align the Why media and copy at the inner edge of their tracks. Couple the overlap distance to the actual rendered media, and give the copy enough clearance. Retain its mobile image-over-copy composition if that matches the reference, with the readable text outside the overlap.
3. Use the current shared button sizes as the control and scale the CCC action group and button variables together where required. Keep the shared root and tokens out of this patch unless there is a separately reviewed site-wide change. Substituting `1512px` into the invalid expression makes it parse in tested Chromium, but would produce approximately 30.5 px at 4K and resize every rem-based component. Treat the shared syntax issue as separate.

**Accept when.** The content column grows or holds steady across 1919 → 1920 and agreed wide-screen widths. No abrupt text-size jump at 1920. The logo and actions, photo tracks, and gaps follow the chosen reference proportions. The two hero lines fit their available width at 320 through 3840 and at increased zoom. Record CSS viewport, browser zoom, OS scaling and DPR during the owner's real-screen sign-off.

## CCC-03 · P1 · Repair scroll timing and recover the intended choreography

**Reproduce.** At 3840 × 2160, start at the top and scroll exactly 140 CSS px. The hero logo becomes fully transparent and the hero content drops to 15% opacity while the action row is still in view, around y=636. At 390 × 844 the same fade leaves the action row around y=351, where Contact still accepts clicks. Next, scroll through “Every part of your night” and “The room and the details.” Their motion is already at its endpoint when the rows enter view. The second Why photo and copy also follow the first row's clock. The motion exists in the script, but most of its travel happens before these lower subjects can be seen.

**Cause.** The hero fades based on absolute scrollY ÷ 140, dating to [`5cf80fa`](https://github.com/heythisisandrew/hey-this-is-andrew/commit/5cf80fa). The Why and Work timing dates to [`8ffbf4a`](https://github.com/heythisisandrew/hey-this-is-andrew/commit/8ffbf4a). The Why rows share progress from `#why`; the Work trio, mosaic, and room share progress from `#work`. Section stacking uses rectangles of sections that the same loop translates and scales, so prior-frame transforms can change thresholds. It also reads dock height during its max-height transition and mixes geometry reads with style writes. [Hero and stacking](../sites/hey-this-is-andrew/src/pages/ccc.astro#L1231), [in-section motion](../sites/hey-this-is-andrew/src/pages/ccc.astro#L1345), [closer motion](../sites/hey-this-is-andrew/src/pages/ccc.astro#L1445).

**Fix.**

- Build the candidate revisions in isolation and record a down-and-up pass at 390, 1512 and 3840 CSS px. Compare the number of docked bars, section overlap, where each animation starts and settles, and the closer's dock handoff. Select the matching choreography before tuning its depth, opacity, offsets or easing. Keep a screen recording or progress snapshots with the implementation.
- Compute hero exit from stable hero-content geometry and the measured header/dock edge. Keep the copy and actions readable while they are available. Dock when the reference handoff is reached. Keep dock geometry stable while its painted surface animates.
- Keep section anchors and measurement wrappers in normal flow. Measure the Why pairs independently and use the Where grid and Work trio, mosaic and room wrappers as their own progress subjects. Animate visual children so transforms never move the trigger geometry. Set bounded, reversible start/settle points tied to each subject's actual viewport entry and reading position. Use the actual breakpoint to distinguish mobile 2×2 and desktop four-column Where layouts.
- Use one scheduled update with geometry reads first and visual writes second. Recalculate on resize, orientation changes and changes to the measured header/layout. Scope work to nearby sections, reset stale inline state on mode changes, and make initialization idempotent. For the closer, coordinate the dock exit, foreground reveal, and background crop using the same measured geometry. Keep the actions reachable and readable.

**Accept when.** At matched scroll checkpoints, each intended effect changes while its subject is on screen, settles into the reference layout and reverses without a jump. Arriving at a given scroll position from either direction produces the same settled state. Check slow trackpad scroll, fast wheel/touch scroll, resize, rotation and browser back. The hero remains readable before the handoff. Verify the active Page Nav item and test direct fragments, Page Nav jumps, and links back from the closer. Use stable anchor geometry and account for the maximum scroll position on a tall screen. A normal-motion 4K deep link to the closer settled with the heading at y≈696, inside the viewport; preserve that reachability.

## CCC-04 · P1 · Respect reduced motion and dock visibility

**Reproduce.** Load with reduced motion enabled, scroll 140 px, then reach the closer. In Chromium the hero still fades to 0.15 and the logo still translates and scales. The closer still scales its title to 1.10 and its background to 1.15 at the bottom. The fully hidden dock was still focusable, with its bottom at y=−20. Its child explicitly restores pointer events even when the parent disables them. [Reduced-motion styles](../sites/hey-this-is-andrew/src/pages/ccc.astro#L638), [dock and animation script](../sites/hey-this-is-andrew/src/pages/ccc.astro#L1231), [global smooth scrolling](../sites/hey-this-is-andrew/src/styles/global.css#L5).

**Fix.** Apply reduced motion to the entire CCC animation path, including hero, closer, dock push-away, and return-to-top. Remove stale transforms, opacity and motion classes when the preference changes. Show or hide the dock discretely in reduced motion. Use `inert` or equivalent state for collapsed and fully dismissed dock controls, and preserve a sensible focus destination if the dock disappears while focused. Make reduced-motion navigation instant in practice. `behavior: 'auto'` can inherit the document's smooth scrolling.

**Accept when.** With reduced motion set before load and when toggled mid-scroll, all CCC content stays legible in its static layout. Return-to-top and anchor navigation do not animate. The dock is operable only while visible and absent from tab order both at the top and after its closer dismissal.

## CCC-05 · P2 · Match image delivery to the restored layout

At 4K, some “Where it goes” images render at 667 px from 424 px originals, drink photos at 895 px from 562 px, mosaic tiles at 389 px from 252 px, and the room photo at 1635 px from 1110 px. The full-bleed closer uses a 1500 px background source. These are source-resolution limits. Several `sizes` hints also describe fractions of viewport width rather than the actual content tracks. [Photo component](../sites/hey-this-is-andrew/src/components/ccc/CccPhoto.astro#L18), [CCC image calls](../sites/hey-this-is-andrew/src/pages/ccc.astro#L182).

After fixing the layout, measure the real slots at each breakpoint and align `sizes` to them. Compare `currentSrc` candidate widths against rendered width × DPR. Use higher-resolution originals where available for enlarged photos, or cap their display width where the composition permits. Preserve aspect ratios, crops, alt text, reserved space and lazy loading.

## CCC-06 · P2 · Make package Contact reachable from the keyboard

**Reproduce.** At Packages, focus a card and press Enter. It flips. Tab goes to the next card, skipping Contact. The back-face Contact is a `span` with `tabIndex === -1` inside the outer card button. Pointer activation opens the modal and correctly prefills the package. [FlipCard markup](../packages/ui/src/FlipCard.astro#L44), [card input handler](../packages/ui/src/FlipCard.astro#L318), [modal gating](../sites/hey-this-is-andrew/src/components/ccc/CccInquiryModal.astro#L595).

**Fix.** Separate the flip control and back-face Contact into sibling semantic controls inside a card wrapper. Expose Contact to focus only while its back face is available. Preserve explicit click/tap to flip and keep the modal opening bound to Contact. Restore focus to the activating control on close, or to the flip control if the back face is closed. Exercise both CCC and the shared component's existing HQ usage.

**Accept when.** Each of the three packages can be flipped and its Contact activated by keyboard, mouse and touch. Contact is absent from the focus order when hidden. Escape closes the dialog and focus returns to a visible control. Opening the dialog from a package selects the matching service.

## CCC-07 · P2 · Show the actual inquiry delivery state

The form button says “Send inquiry” and then promises a response. The client-side code composes a `mailto:` draft and exposes a copy fallback. Delivery depends on the visitor sending the message from their email app. The current E2E test enforces the misleading confirmation. [Dialog copy](../sites/hey-this-is-andrew/src/components/ccc/CccInquiryModal.astro#L103), [submit handler](../sites/hey-this-is-andrew/src/components/ccc/CccInquiryModal.astro#L654), [E2E expectation](../e2e/ccc-overhaul.spec.ts#L61).

Keep the static email workflow and five fields. Label the action “Open email draft,” show “Your inquiry is ready to send,” and instruct the visitor to send from their mail app or use the existing copy fallback. Verify both paths with a test payload without sending email. Update the copy assertion.

## Verification and release gates

- Current result. All six existing CCC Playwright cases passed against live in Chromium at desktop and mobile sizes. The repository-configured preview timed out starting locally, so the suite used a temporary live-only configuration. The cases assert content presence, a modal draft, and basic scroll visibility. They lack checks for viewport intersection, content geometry, motion state, keyboard package actions, and reduced motion. The section-order loop only checks element visibility. [CCC spec](../e2e/ccc-overhaul.spec.ts), [Playwright projects](../playwright.config.ts).
- Add targeted checks for the split layout, monotonic sizing around 1920, and actual two-line title geometry after fonts load. Exercise portrait 320/390, short landscape 844 × 390, 899/900, laptop 1512 × 982, 1919/1920, QHD 2560 × 1440, 3840 × 2160, and 1920 × 2160. Check a DPR 2 configuration and browser zoom for clipping. Use stable screenshots for layout and scroll checkpoints for motion.
- Add tests that sample a visible subject at its entry, midpoint and settled state. Verify reverse travel, reload/anchor jumps, dock visibility and focus, reduced motion on initial load and after a live preference change, and all package CTAs. Wait for the state under test or frame settling instead of asserting immediately after a smooth scroll starts. Check heading and CTA rectangles against the header, dock, and viewport.
- Run `pnpm --filter hey-this-is-andrew check`, build with `ASTRO_BASE=/hey-this-is-andrew/ pnpm --filter hey-this-is-andrew build`, then run the CCC spec against that build and the rest of the site suite before deployment. Verify the deployed revision on the live URL.
- This audit used emulated Chromium CSS viewports and a locally rebuilt historical reference. A cached WebKit runner independently reproduced the block layout, 16 px root fallback, and reduced-motion hero fade and closer zoom at 4K. The Portfolio destination returned HTTP 200. Physical sizing, current Safari on the owner's monitor, and real mobile keyboard and rotation behavior still need device verification.
