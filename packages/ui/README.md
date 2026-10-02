# @andrew/ui

The shared building blocks. Every site imports these instead of keeping its
own copy. They are **themeable, not themed**: every colour, font and size
comes from a CSS custom property in `@andrew/tokens`, and a site changes how
a block looks only by overriding tokens in its own theme file.

## What is in here

| import | what it is | props (short) |
| --- | --- | --- |
| `@andrew/ui/BrandAccordion.astro` | the brand accordion: HQ's hero accordion, mechanics and look one to one (sizes in `--acc-u`) | `panels`, `fullscreen?` (the brand view: a tap on any brand dollies into it, phones and desktop; Esc, Close, a tap outside and Back close it), `view?` (`'fill'` default: the art fills the screen, the copy over it; `'fit'`: the panel whole, the copy under it; phones always fill), `interval?`, `labels?` |
| `@andrew/ui/ChromeMeta.astro` | the viewport tag (HQ's, exactly) and the site's chrome colour: phone header, page edge and status bar / Dynamic Island area, plus matching theme-color; put it in every layout's `<head>` | `color?` (any solid colour, default black), `lightColor?` (light-mode chrome), `interactiveWidget?` |
| `@andrew/ui/Nav.astro` | fixed header (HQ's), dropdowns, mobile menu, scrollspy; paints the phone status-bar strip solid (`--chrome`) and clears it | `logo`, `homeHref`, `links` (a link is lit on its own page; on the home page only while a section in its `spy` list is current), `search?` (icon only, no box, no visible key hint; `keyShortcuts` goes to `aria-keyshortcuts`); default slot for a search modal |
| `@andrew/ui/Footer.astro` | brand block, one row of primary links, social icons, legal row | `logo`, `homeHref?` (links the logo home, named `homeLabel`, default "<alt>, home"), `tagline`, `explore`, `socials`, `copyright`, `privacyHref`, `utility?` (small links beside Privacy), `notes?` |
| `@andrew/ui/PageNav.astro` | BE Unconventional HQ's side panel: the page's sections as ticks on the left edge, words on hover (desktop) or tap (touch); active-section tracking | `items?` (defaults to the page's `h2[id]`s; a heading can set `data-pn-label`), `heading?`, `selector?` |
| `@andrew/ui/SectionHeader.astro` | the one section heading pattern | `kicker`, `title`, `index?`, `lede?`, `linkLabel?`, `linkHref?`, `id?` |
| `@andrew/ui/QuoteBand.astro` | standalone quote band | `eyebrow`, `quote`, `attribution`, `label?` |
| `@andrew/ui/icons` | social icon library (`SOCIAL_LINE_ICONS`) | |
| `@andrew/ui/types` | TypeScript types for all of the above | |
| `@andrew/ui/styles/base.css` | film grain, selection, focus ring, `.container`, `.vh` | |
| `@andrew/ui/styles/chips.css` | `.chip`, `.chip--brand` | |
| `@andrew/ui/styles/cta.css` | the button standard: `.btn` (md), `.btn--sm` (sm), `.btn-primary`, `.btn-secondary`, `.btn-ghost` (text), `.ui-hit` (a 44px hit area for any small control) | sizes are tokens, see below |
| `@andrew/ui/scripts/section-anchors.ts` | click a section's `#` to copy its link | |

Load order in a layout (see `templates/site-starter/src/layouts/BaseLayout.astro`):

```astro
import '@andrew/tokens/tokens.css';   // 1. base tokens
import '../styles/theme.css';         // 2. this site's overrides
import '@andrew/ui/styles/base.css';  // 3. shared chrome
import '@andrew/ui/styles/chips.css';
import '../styles/global.css';        // 4. this site's globals
import '@andrew/ui/styles/cta.css';   // 5. buttons last
```

## The button standard

Every control that acts as a button takes its size from the Controls tokens
in `@andrew/tokens`, never from rem (the personal site's root is 75% on
laptops and 100% on phones, which is how one `.btn` came out 42px on a laptop
and 55px on a phone). One unit, `--ui-u`, is 1px; a site whose root scales
on big screens re-points it there (the personal site does above 1920).

| size | used for | height | side padding | label | tracking | radius |
| --- | --- | --- | --- | --- | --- | --- |
| md (default) | `.btn`, brand CTAs, Subscribe, nav search and Menu, back to top, Close | 44 | 24 | 12px | 0.18em | `--radius` (0) |
| sm (dense) | `.btn--sm`, filter tabs, gear chips, small store links, the search Close | 32 box, 44 hit area | 14 | 11px | 0.18em | 0 |
| text | `.btn-ghost`, View all, section links, "Start a project" | 44 hit area, no box | 0 | 12px | 0.18em | none |

A label too long for one line wraps (it is never cut), so that button is
taller. Focus is one ring for everything: 2px `--focus-ring`, offset 3px
(base.css and cta.css).

## The theming contract

**Rule: no brand value is written inside a shared component.** A component
reads tokens; a site sets tokens. The tokens a theme usually touches:

| token | used by | base value |
| --- | --- | --- |
| `--color-accent` | chips (`.chip--brand` edge), `--key` | `#b2b2b2` |
| `--color-accent-text`, `--color-accent-hover`, `--color-accent-dim` | nav hover text, `--key-dim` | grays |
| `--page-bg`, `--bg`, `--surface`, `--surface-2`, `--line` | backgrounds, cards, hairlines | near-blacks |
| `--ink`, `--muted`, `--text`, `--text-muted` | text | `#f0f0f0`, `#888888` |
| `--focus-ring`, `--selection-bg`, `--selection-ink` | keyboard focus, text selection | white / black |
| `--font-display`, `--font-section`, `--font-body`, `--font-mono` | all type | Syne, Inter, JetBrains Mono |
| `--radius` | every frame | `0` (sharp) |
| `--acc-strip`, `--acc-gap`, `--acc-ease`, `--acc-duration` | accordion geometry and motion | HQ's values |
| `--accordion-edge` | open panel's edge bar, chip edge | `#f0f0f0` |
| `--accordion-progress` | rotation progress bar | `#f0f0f0` |
| `--accordion-frame`, `--accordion-frame-glow` | collapsed strip hover frame | white, faint |
| `--accordion-label-glow` | strip label hover glow | white |
| `--accordion-cta-border`, `--accordion-cta-hover-bg`, `--accordion-cta-hover-ink`, `--accordion-cta-glow` | panel CTA | white invert |

The accordion reads the `--accordion-*` tokens **on each panel**, and each
panel renders `data-accent="<accent>"` from its data. So a theme can change
every panel (set the tokens on `:root`) or one panel (set them on
`[data-accent="name"]`).

### Worked example 1: HQ red everywhere

BE Unconventional HQ's own look. One line in the layout:

```astro
import '@andrew/tokens/tokens.css';
import '@andrew/tokens/themes/hq-red.css';   // every accordion panel red, red accent
```

`themes/hq-red.css` sets `--color-accent: #cc0000` and every `--accordion-*`
token to HQ's reds (`#e60000` edge, `#9b0000` progress, `#cc0000` CTA fill
with `0 0 30px rgba(204,0,0,.4)` glow).

### Worked example 2: monochrome with one red panel (the personal site)

The personal site stays on the monochrome base and turns ONE panel red,
because that panel is a BE brand context. In `src/data/brands.ts`:

```ts
{ id: 'be', name: 'BE Unconventional HQ', accent: 'be-red', ctaFillOnPanelHover: true, ... }
```

and in `src/styles/theme.css`:

```css
[data-accent="be-red"] {
  --accordion-edge: var(--be-red);          /* #e60000 */
  --accordion-progress: var(--be-crimson);  /* #9b0000 */
  --accordion-cta-border: var(--be-cta-hover);
  --accordion-cta-hover-bg: var(--be-cta-hover);  /* #cc0000 */
  --accordion-cta-hover-ink: #ffffff;
  --accordion-cta-glow: var(--be-cta-glow);
  /* frame, frame glow, label glow likewise */
}
```

Every other panel has no `accent`, so it keeps the base (white) values.

## Keep or share: the decision log

The test for sharing: is it needed by more than one site, and can it be
driven entirely by props and tokens? When in doubt it stays in its site; a
premature abstraction is worse than a duplication.

| block | decision | why |
| --- | --- | --- |
| BrandAccordion | **shared** | Both sites have one, the prompt names HQ's mechanics as the reference, and it is fully data-driven. HQ's mechanics won: its rAF clock (runs only while visible and not held), its independent pause holds, its visible progress bar (interval is a prop: HQ runs 7s, the personal site 8s), its no-repaint desktop layout (`--open-w`), its keyboard model. The personal site's fullscreen brand view is kept as an opt-in (`fullscreen`). |
| Nav | **shared** | Every site needs one and the starter needs one. Links, logo, search trigger and labels are props; a site's search modal goes in the slot. |
| Footer | **shared** | Same as Nav. Its Explore list is built from the same data file as the Nav, so the two cannot disagree. |
| SectionHeader | **shared** | The personal site's version (eyebrow, file-tab index, title, lede, link, hairline rule) is the richer, better-engineered pattern; HQ has three thin variants (`SectionHeader`, `SectionHeading`, `home/HomeSectionHeader`). |
| QuoteBand | **shared** | Tiny, generic, content via props. |
| Social icons | **shared** | Adopted HQ's `src/data/icons.js` conventions (currentColor, no size, aria-hidden, one object), the better-engineered of the two. The personal site's line glyphs are the set in here now; HQ's official-mark set joins when HQ migrates. |
| Grain, focus, selection, `.container`, `.vh` | **shared** (`styles/base.css`) | Identical in both repos. HQ's grain carried a fix the personal site lacked (hide the grain while a modal is open, for iOS Safari with YouTube iframes); the shared layer has it. |
| Chips, buttons | **shared** (`styles/chips.css`, `styles/cta.css`) | Same grammar in both repos; the accent is a token. |
| PhotoGrid + PhotoViewer (the personal site's "Shot on the Job") | **kept in the site** | One consumer, and it is built on the personal site's own camera/zoom library (`src/lib/spatial.ts`). HQ's photo surfaces (`InstagramFeed`, `CinematicGallery`) are different components. Share when a second site needs the same thing. |
| Hero carousel (`BrandCarousel`) | **kept in the site** | Site-specific composition; decision 8 froze it. |
| Homepage sections, brand data, content collections, search index | **kept in the site** | Content and compositions belong to a site, not the library. |
| HQ's YouTube players, embed escape and pause libraries | **kept in HQ** | Bound to HQ's hard rules 3, 11 and 12 and its guard tests. |
