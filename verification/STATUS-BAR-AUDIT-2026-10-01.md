# Status bar audit (the Dynamic Island area), 2026-10-01

Reported: on an iPhone 17 Pro Max the top of hey_thisisandrew (behind the
clock and the Dynamic Island) is not black; the page shows through. BE
Unconventional HQ is black. Read from the HQ repo; nothing in it was changed.

## How HQ does it

| Piece | HQ | Where |
| --- | --- | --- |
| Header | **`position: fixed`, top 0, at every width**; on phones `rgba(0,0,0,0.94)`, no blur | `styles/modules/navbar.css`, `responsive-mobile.css` |
| Header height | measured by an inline script right after the header, published as `--nav-h`; the page clears it | `components/Navbar.astro` |
| Viewport tag | `width=device-width, initial-scale=1, interactive-widget=resizes-content` (**no `viewport-fit=cover`**) | `layouts/Layout.astro` |
| theme-color | `#000000` | `layouts/Layout.astro` |
| Page colour | html and body near-black | `styles/global-base.css` |
| `.safe-area-blackout` | present, `env(safe-area-inset-top)` tall, which is **0** without viewport-fit=cover | `responsive-mobile.css` |

The black comes from the first row: iOS Safari 26 no longer reads
theme-color; it colours the status bar from a **fixed** element across the
top of the screen. HQ's header is one, at every scroll position.

## What the personal site had (live, main at f275edd)

- Header `position: sticky`, not fixed. Safari does not colour the status
  bar from it.
- `viewport-fit=cover` (added in the earlier fix, not from HQ), with a black
  strip sized by the safe area. That is a different mechanism from HQ's and
  it did not hold on the reporter's iPhone.
- A full-screen fixed layer (the photo elevator's zoom backdrop, invisible
  but present) across the top of the screen, which HQ does not have.

Measured on the built pages at 390x844 (every fixed or sticky element across
the top edge, at the top, middle and bottom of the page):

| | top | middle | bottom |
| --- | --- | --- | --- |
| HQ | header, fixed, black | same | same |
| personal, live | header **sticky**; zoom backdrop fixed | same | same |
| personal, fixed | header, fixed, black | same | same |

## The fix (shared, in the monorepo)

- `@andrew/ui/Nav.astro`: the header is `position: fixed` at every width, as
  HQ's; a spacer holds its place; its height is published inline right after
  it (`--nav-bar-h`), as HQ's. Phones: solid black, no blur.
- `@andrew/ui/ChromeMeta.astro`: HQ's viewport tag exactly (no
  viewport-fit=cover), theme-color black.
- The photo elevator's zoom backdrop is out of the page while unused.
- Every page is pixel-identical to main at 390 and 1512 (full-page diff):
  the header looks and sits exactly where it did.
- **Guard:** `sites/hey-this-is-andrew/scripts/status-bar.test.mjs` runs in
  `pnpm test` (and so before every deploy). It fails if the shared header is
  not fixed at the top, loses its spacer or inline height, stops being solid
  black on phones, or if viewport-fit=cover comes back. Run against the old
  code it fails with ".site-nav must be position: fixed (HQ #navbar), never
  sticky".

## Round 2 (2026-10-02): still see-through on iOS 27, the real cause

The fixed header alone did not fix it on Andrew's iPhone (iOS 27). The first
audit only listed elements, not pseudo-elements, and skipped anything under
4px, so it missed the two layers that sat ABOVE the header at the top edge:

| Layer at the top edge, phone | HQ | personal (before) |
| --- | --- | --- |
| film grain `body::before`: fixed, full screen, transparent, z 150 (over the header) | **off on phones and touch screens** (responsive-mobile.css) | on |
| scroll progress bar: fixed, 2px, white, z 9999, top 0 | none | yes |
| header: fixed, black | yes | yes |

iOS Safari colours the status bar from the topmost fixed layer at the top of
the screen: on HQ that is the black header; here it was the transparent grain
(or the white bar). Fix: HQ's rule exactly, grain off and header blur off on
`(max-width: 768px), (orientation: landscape) and (max-height: 500px),
(pointer: coarse)`; the progress bar now runs under the header; the blackout
strip back to HQ's z-index 110. After it, every page's top-edge stack at 390
is the same as HQ's: a 0px black strip and the fixed black header. The guard
test now fails if the grain comes back on phones or the bar returns to the top.

## Found on the way (fixed)

- The phone side panel's closed tab took taps over a 118 x 268px area (its
  hidden heading and labels kept their size), so taps on photos and brand
  rows on the left of the screen opened the panel. It is now its visible
  44px tab.

## Other colours (other sites, light mode)

The status bar takes the colour of the fixed header, so it is whatever the
site's chrome colour is. One setting per site, in its layout:
`<ChromeMeta color="#3b1f5c" />` makes the phone header, the page edge, the
status bar and theme-color purple; `lightColor="#ffffff"` adds a light-mode
chrome (system light mode, or `<html data-theme="light">`). Safari picks dark
or light status-bar text from the colour. Tested on the starter: purple in
dark mode, white in light mode, header fixed in both. Limits: the colour must
be solid (a see-through or blurred header gives Safari nothing to sample),
and a full light theme still needs the header's own text and the page
colours to switch, which the sites do not have yet (both are dark-only).

## Not verifiable here

No iPhone in the build machine: the emulator renders neither the Dynamic
Island nor Safari's status-bar colouring. What is verified is that the page
now presents iOS exactly what HQ presents. Andrew to confirm on the iPhone 17
Pro Max after it is merged.
