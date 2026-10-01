# Items 1 to 12 (the 12-item prompt plus its addendum), 2026-10-01

Branch `claude/personal-site-visual-fixes`. Before = `main` at 08ed163 (the
site as live). After = this branch. Andrew's own photos stand in for the
Instagram sync. HQ = BE Unconventional HQ rendered locally from its repo,
untouched.

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| 1 + 3 | Brand section = HQ's hero, one to one, in packages/ui | Done | `01-03-brands-vs-hq-390.jpg`, `-1512.jpg`, `-land.jpg`, `01-03-brands-focus-state.jpg` |
| 2 | Andrew's PNG logo in nav and hero | Done (stood down; verified) | `02-logo-png.jpg` |
| 4 | Photo elevator on the homepage after About | Done earlier | `../2026-10-01-visual-fixes/` |
| 5 | Work page gallery | Done earlier | `../2026-10-01-visual-fixes/` |
| 6 | Meet the Creator = HQ's Inside the HQ | Done earlier | `../2026-10-01-problems-6-9/06-*` |
| 7 | Red cocktail photo off the Cafe page | Done earlier | `../2026-10-01-problems-6-9/07-08-*` |
| 8 | Reel cards play or stop promising | Done earlier | `../2026-10-01-problems-6-9/07-08-*`, `08-*` |
| 9 | Solid status bar on phones | Done earlier | `../2026-10-01-problems-6-9/09-*` |
| 10 | Footer: top-level links only | Done | `10-footer-1512.jpg`, `10-footer-390.jpg` |
| 11 | Phone menu closed itself on scroll | Fixed | `11-12-menu-390.jpg`, `11-menu-before-390.webm`, `11-menu-after-390.webm` |
| 12 | Slim menu + HQ's side panel, shared | Done | `11-12-menu-390.jpg`, `12-side-panel-390.jpg`, `12-side-panel-1512.jpg` |
| extra | Search results had no styling | Fixed (found in my own pass) | `extra-search-390.jpg`, `extra-search-1512.jpg` |

## What was decided, and why

- **Items 1 and 3 are one section.** Andrew's call (asked in the session):
  the portrait hero at the top stays as it is; The Brands becomes the copy
  of HQ's hero. The addendum's item 1 complaints (text too big, metadata in
  the wrong place, bad buttons) describe the brand panel in his screenshot,
  which is what was rebuilt.
- **One to one, with these differences, each for a stated reason:**
  - Phone headlines may take three lines (HQ: two). "WHERE NERD CULTURE GETS
    CINEMATIC." needs three at 390 and HQ's clamp cut "CINEMATIC." off.
  - Closed rows centre the name in the room right of the logo, not in the
    row, and may wrap to two lines: HQ's labels are one word ("TV"), these
    are three ("CAPTURE CREATE CAFFEINATE"), which HQ's rule truncated.
  - The play/pause toggle is 44px (HQ: 40px), this site's touch-target size.
  - No centre play button on the art: none of the three brands has a video,
    and a play mark that plays nothing breaks item 8.
  - Accent per brand: the BE panel keeps HQ's red; Capture Create Caffeinate
    and Sip the Magic use the site's monochrome accent.
  - Phone portrait has no button under the copy, as on HQ; the headline is
    the link and covers the whole panel there.
  - The desktop brand view (camera zoom into the open panel) is kept.
- **Panel height on desktop now follows HQ** (75% of the window less the
  nav), so the open panel is no longer exactly 16:9.
- **The side panel (item 12) is HQ's FloatingPageNav**, ported to
  `@andrew/ui/PageNav.astro` with its active-section logic. HQ hides it
  below 1200px; Andrew wants it on phones, so on touch screens it is a slim
  tab: tap to open, tap a section to jump (it closes), tap outside to close.
  Its entries are each page's own section headings, so every page gets one.
- **Footer:** the five top-level destinations in one row. Sitemap, which
  lists every page, moved to the legal row beside Privacy so the pages that
  left the footer are still one tap away.
- **Menu (item 11):** it closed on any upward swipe of 40px over it, which is
  what scrolling it is. Now it closes only on Close, a link, a tap outside,
  or Escape. The recording replays the same touch swipes against main
  (menu closes) and this branch (menu stays open).
- **"Stray dot" under The Brands:** the rule's end mark was already removed
  there; the other candidate was the heading's "#" copy-link glyph, which a
  phone's sticky hover left showing after a tap. It now shows only on mouse
  hover or keyboard focus.

## My own checks

- Regression sweep, every page before vs after at 390 and 1512 (side panel
  hidden, as it floats over everything): changes only in the brand section
  and the footer, everything else a pure shift.
- axe: 0 violations on all 19 pages at both sizes. Unit tests, Pages build,
  built-site audit: pass. Type check: 40 errors, the same as before.
- 7-viewport matrix: all clear (the side panel's collapsed links are skipped:
  on touch the handle covers them and takes the tap).
- Anchors land under the nav at 390, 1280, 1512, 1920.
- Not verifiable here: a real iPhone. Andrew to confirm item 11 on his
  iPhone 17 Pro Max; the Muse prompt covers the rest.
