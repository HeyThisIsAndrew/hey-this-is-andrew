# Addendum, 2026-10-02: search hint, footer logo, brand view, zoom audit, buttons, parity

Branch `claude/personal-site-visual-fixes`. Not merged, not deployed.
Before = `main` at 3fb40c4 (the site as live). After = this branch, built
locally. Andrew's own photos stand in for the Instagram sync in the shots
(never committed). BE Unconventional HQ was not touched.

Every `*.jpg` here is BEFORE on the left, AFTER on the right, unless named
otherwise.

## 1. Search: no visible Command K hint

- Gone: the ⌘K badge in the nav button, the ⌘K badge in the phone menu's
  search row, "(⌘K)" and "Press ⌘K or /" in its tooltip and name, and the
  ↑ ↓ ↵ ESC badges in the search window. The window's ESC badge was also
  its close button: it now reads CLOSE.
- Still works: Cmd+K and Ctrl+K open and close search, "/" opens it, the
  arrows, Enter and Esc work in the window (checked: Ctrl+K and Cmd+K both
  land in the search box). Screen readers are told the shortcut through
  `aria-keyshortcuts`. Nothing is shown.
- Where: `packages/ui/src/Nav.astro` (shared), the site's `data/nav.ts` and
  `SiteSearch.astro`. On a phone the icon-only search button is now a 44px
  square (the badge was what made it wide).
- Shots: `01-search-closed-*`, `01-search-open-*`, `01-search-menu-390`.

## 2. Footer logo

- It links home, named "HEY_THISISANDREW, home". The image's alt is still
  HEY_THISISANDREW and the PNG is unchanged.
- 390: 170 x 42 (was 324 wide), in a 44px-tall link. Clicked from /cafe/
  and from /work/, it lands on / at 390 and at 1512 (`checks-after.json`).
- Desktop: 243 x 60 at 1512. Unchanged: it already sits as the brand
  block's mark, the same weight as the Explore and Follow columns.
- Shared: `Footer.astro` takes `homeHref` (the starter passes it too).
- Shots: `02-footer-390`, `02-footer-1512`.

## 3. The brand view, back on phones and on desktop

A tap on ANY brand goes into its full-screen view: a closed brand expands on
the way (desktop: the strip grows and the camera sets off for the box it is
growing into, as one move; phone: the row moves to the top as before and
the camera starts at once). The art fills the screen under a black band the
height of the header; the brand's chips, headline, line, button and "Start a
project" sit over the foot of the art at screen size. Close, Esc, a tap
anywhere outside the copy and the phone's Back all close it. The page does
not scroll while it is open (checked with touch swipes and the wheel: the
page stays at the same pixel). The band is solid black from the first frame
to the last, so the status bar has black behind it the whole time; the side
panel, back-to-top and progress bar step out of the way. Rows stay equal
height and the in-page expand is unchanged.

**Timing and easing.** One 700ms move on `cubic-bezier(0.25, 1, 0.5, 1)`, the
same curve and length as the existing desktop dolly (the hero camera's): a
fast start that settles slowly into place, like a camera easing onto its
mark. The whole move is a transform on one layer (the stage: translate and
scale), and the black backdrop fades on opacity alongside it. The copy fades
in from 250ms, rising with the camera. Closing runs the same move backwards
and the copy leaves first. On a phone the camera goes from 1x to 3.5x (the
16:9 art to a full portrait screen), on desktop from 1x to 1.46x. With
reduced motion it cuts straight in and out (checked: in the view at 40ms).

- Measured: phone 390, 60 frames a second through the move (median frame
  17ms, no frame over 17ms). Desktop 1512 on this build machine: about 30
  frames a second, the same as the existing desktop dolly on `main` measured
  the same way. The machine renders in software with no GPU, so the
  desktop number needs a check on a real Mac.
- Found and fixed on the way: in phone landscape the page jumped 155px as
  the view opened (the browser's scroll anchoring picked a node inside the
  accordion); a tap on the art opened the view and the same click closed
  it; a long button label ran off a phone screen; the phone's headline
  stretched over the whole panel and took every tap to the brand's site (it
  is a normal link again; the tap on the art now goes into the view, where
  the brand's button is).
- `fullscreen` was desktop-only in `BrandAccordion.astro`; it is every width
  now. `view="fit"` keeps the earlier desktop framing (the art whole, the
  copy under it) if Andrew prefers it on desktop.
- Shots: `03-brands-rest-*`, `03-brands-tap-ccc-*` (before: the tap only
  opened the row), `03-brand-view-states-*` (CCC, the open brand, Sip the
  Magic's teaser, and after closing). Recordings: `03-brand-view-390.webm`,
  `03-brand-view-1512.webm`.

## 4. Camera zoom audit

Rules applied to every zoom: transform or opacity only, a reduced-motion
fallback, nothing that holds back the first paint.

| Page / section | Today | Decision | Why |
| --- | --- | --- | --- |
| Home, portrait hero | static (hover glitch on desktop) | **Reject** a zoom | It is the page's first paint and its LCP image; Andrew asked for it unchanged. |
| Home, The Brands | full-through, desktop only | **Accept, extended** to phones and every brand tap (item 3) | The one place a zoom is the content: it takes you into the brand. |
| Home and /work, "Shot on the job." | full-through onto a photo (the elevator) | **Accept as is** | Transform only; reduced motion jumps straight there. |
| Home, Meet the Creator to /about (and back) | route zoom: a black veil grows from the link, the next page settles from 1.035x | **Accept, fixed** | The veil animated `clip-path` (now a transform), and the arriving page started at opacity 0, which held back its first paint and LCP (now transform only; the page is never hidden). |
| Home Latest, /work Videos, /latest | the card zooms into the player | **Accept as is, one exception** | It animates `clip-path` on the player's frame. Rewriting the player's open is not a clear win (it is the player); listed for Andrew below. Reduced motion opens it at once. |
| Article cards (Latest, /about Notes) | gentle-forward on hover (1.04, image only) | **Accept as is** | Hover only, transform, off with reduced motion. |
| Home, Selected work / /work Projects | press feedback only | **Reject** | The cards go to another page; a zoom would promise a view that does not come. |
| Home Goals, What I do; /goals, /services, /build, /now, /press, /privacy, /sitemap, /links, /events | none | **Reject** | Text and lists: nothing to move into. |
| Gear (home and /gear) | none | **Reject** | Small product shots that link to a store; blown up they go soft. |
| /cafe, Studio Coffee Setup and the 9:16 reel card | none | **Reject** | A product list, and the reel card was just fixed to stop promising playback (item 8 last round). |
| /about portrait | static | **Reject** | Matches HQ's "Inside the HQ", which is static. |
| /brands/* hero still | static | **Reject for now** | It is that page's LCP; a slow push-in is possible but not a clear win. Listed below. |

Shots: `04-route-zoom-mid-*` (the veil mid-move, before and after), item 3's
for the brand view.

## 5. The button standard

All sizes are tokens in `@andrew/tokens` ("Controls") and the rules are in
`@andrew/ui/styles/cta.css`; the README of `@andrew/ui` has the table. The
cause of the drift: buttons were sized in rem, and this site's root is 75%
on laptops and 100% on phones, so one `.btn` was 41.8px on a laptop and 55px
on a phone, next to 44px nav controls and a 37px Subscribe. Controls now use
one unit that matches HQ's pixels at every width up to 1919 (and scales
above, with the rest of the page).

| Size | Height | Side padding | Label | Tracking | Radius | Used by |
| --- | --- | --- | --- | --- | --- | --- |
| md (default) | 44 | 24 | 12px | 0.18em | 0 | `.btn` (primary, secondary), brand CTAs (accordion, brand pages), Subscribe and its email box, Amazon storefront button, nav Search and Menu (sm padding), back to top (square), the brand view's Close |
| sm (dense) | 32 box, 44 hit area | 14 | 11px | 0.18em | 0 | `.btn--sm`, filter tabs (All / Video / Writing), gear chips, the small "Storefront" links, the search window's Close |
| text | 44 hit area, no box | 0 | 12px | 0.18em | none | `.btn-ghost`, View all, section links ("See the full feed"), "Start a project" |

One focus ring for all of them: 2px in the focus colour, 3px off. The
site-wide ring used `--key-ink`, which this site sets to black: keyboard
focus was a black ring on a black page anywhere a component did not set its
own. Fixed in the shared base.

| Measured (before → after) | 390 | 1512 |
| --- | --- | --- |
| `.btn` | 55.1 → 44 | 41.8 → 44 |
| Subscribe | 49 → 44 (input 44 too) | 37 → 44 |
| Filter tabs | 44 box, 0 vertical padding → 32 box, 6/14 padding, 44 hit | same |
| Back to top | 44, UA padding 1px 6px → 44, padding 0 | same |
| Brand CTA (accordion) | n/a on phone portrait | 44 (HQ px) → 44 |
| Brand page CTAs | 51.4 / 72 → 44 / 57.6 (a two-line label) | 39 → 44 |
| Section link "See the full feed" | 44 | 14.8 → 44 |
| Gear chips | 44 → 32 + 44 hit | 25.2 → 32 + 44 hit |
| Nav search | 75 wide (badge) → 44 square | 117 → 109 wide, 44 |
| Labels | 12.8px → 12px | 9.6px → 12px (easier to read) |

Spot-checked drift that stays, on purpose: the link-in-bio rows on /links
(cards, not buttons), the round play/pause toggle on the brands (HQ's), the
storefront dots (44 squares), and labels too long for one line, which wrap
instead of being cut (three: "Visit Capture Create Caffeinate" at 390,
"Shop Beverage Kit on Amazon" at 390, the gear page's "View on Amazon
Storefront" in its narrow columns). Full inventories:
`05-button-inventory-before.tsv`, `-after.tsv`. Hit areas checked by
tapping 5.5px above and below each sm control. Shots: `05-buttons-390`,
`05-buttons-1512` (home, /work, /cafe).

## 6. Parity (what must not regress)

| Check | Result | Evidence |
| --- | --- | --- |
| Fixed header, progress bar under the nav | fixed at both widths; bar at 76 (390) and 68 (1512), the nav's bottom edge; top-edge element is the header | `06-header-progress-*`, `checks-after.json` |
| Side panel shrinks to ticks | 45 x 100 tab at 390, ticks at 1512 | `06-sidepanel-*` |
| Portrait hero unchanged | the portrait is identical; the copy under it sits 11px lower at 390 because its button is now the standard 44 (was 55) | `06-hero-*` |
| Menu stays open while scrolling | open after three touch swipes | `06-menu-after-swipes-390` |
| Espresso search cards | styled cards, unchanged | `06-espresso-*` |
| Footer links readable | unchanged | `02-footer-*` |
| No sideways scroll | none on 18 pages at 390 and 1512 | `checks-after.json` |

Also: axe, 0 violations on 19 pages x 2 widths; unit tests and the built-site
audit pass; type check 40 errors, the same 40 as `main`. A new guard,
`sites/hey-this-is-andrew/scripts/controls.test.mjs`, runs in `pnpm test`
and fails on `main` (it catches the key hint, the footer link, a
desktop-only brand view, and rem-sized buttons).

## How the monorepo works, in plain words

The repo is one pnpm workspace holding three kinds of folder.
`packages/tokens` is a single CSS file of design values (colours, the chrome
colour, spacing, and now the button sizes) that every site loads first.
`packages/ui` is the shared building blocks: the header, footer, brand
accordion, side panel, section headers, and the base, button and chip
styles. `sites/hey-this-is-andrew` is the real site and `templates/site-starter`
is the starting point for a new one; both list the two packages as
`workspace:*` dependencies, so they read them straight from this repo, not
from a registry. A change in `packages/` therefore reaches every site the
next time it builds, and a change inside `sites/hey-this-is-andrew` reaches
only that site. A site changes the look without touching the packages by
re-pointing tokens in its own theme file (this site sets its black chrome,
its BE red on one brand panel and its big-screen scaling there). BE
Unconventional HQ is a separate repository and is not part of the
workspace, so nothing here can change it.

## Decisions for Andrew

1. **Desktop brand view framing.** It now fills the screen (art behind, copy
   over it), like the phone. The earlier framing (art whole, copy under it)
   is one prop away: `view="fit"`. Pick one.
2. **Button height.** md is 44, the same as HQ's CTA, the nav controls and
   the touch minimum. On a phone the main buttons got smaller (55 to 44).
   48 is a one-line token change if they should stay bigger.
3. **The brand view's Close on desktop** still shows a small ESC key badge
   (hidden on phones). Item 1 removed key hints from search only; say if
   this one should go too.
4. **The video player's opening zoom** animates `clip-path`, the one zoom not
   on transform. Rewrite it, or leave it as the exception?
5. **A slow push-in on the /brands/* hero stills.** Rejected for now (it is
   their LCP image); yes or no.
6. **Desktop frame rate** of the brand view to confirm on a real Mac (this
   machine has no GPU).
7. Still open from before: favicon files, the cafe product links, press kit
   numbers, the LinkedIn handle, /goals vs /build, the Now line size, a full
   light theme.
