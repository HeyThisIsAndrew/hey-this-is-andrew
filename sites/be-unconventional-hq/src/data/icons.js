/**
 * ICON LIBRARY: every inline SVG the site uses, in one place.
 *
 * ─── WHY THIS FILE EXISTS ─────────────────────────────────────────────────
 * The social icon set was pasted into THREE files: Footer.astro,
 * SocialsSection.astro and pages/links.astro: with slightly different
 * attributes in each. Adding a platform meant editing three files and hoping
 * you matched the formatting; fixing an icon meant finding all three copies.
 * Now there is one object, imported wherever an icon is drawn.
 *
 * ─── HOW TO USE ONE ───────────────────────────────────────────────────────
 *     import { SOCIAL_ICONS } from '../data/icons.js';
 *     <span set:html={SOCIAL_ICONS.YouTube} />
 *
 * `set:html` is safe here because these strings are authored in this file:
 * they are never user input and never come from a feed.
 *
 * ─── HOW TO ADD ONE ───────────────────────────────────────────────────────
 * Every icon must:
 *   • use `fill="currentColor"` (or `stroke="currentColor"`), so it inherits
 *     the colour of whatever it sits in and works in every context;
 *   • carry `aria-hidden="true"` and `focusable="false"`, because the link
 *     around it always has its own accessible label: without this a screen
 *     reader announces the icon as a second, meaningless element;
 *   • have NO width or height attribute. Size is a CSS concern; baking it in
 *     is what forces `!important` overrides later.
 *
 * ─── THE TWO SETS ─────────────────────────────────────────────────────────
 * SOCIAL_ICONS  official platform marks (Simple Icons path data).
 * BRAND_ICONS   icons for the referral/gear links in src/data/referrals.js.
 *               Where a real brand mark is licensed and available it goes
 *               here; where it is not, there is a neutral CATEGORY icon
 *               instead: see the note above BRAND_ICONS.
 */

/* Shared attribute string, so no icon can drift from the rules above. */
const A = 'xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"';
/** Filled icons: brand marks. */
const FILL = `${A} fill="currentColor"`;
/** Outline icons: authored glyphs. `round` joins keep them looking drawn
    rather than cut, at the small sizes these render at. */
const LINE = `${A} fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"`;

/*
  The `@type` annotations on both objects are what let a component write
  `SOCIAL_ICONS[someString]` without `astro check` complaining that a plain
  object literal has no index signature. They are JSDoc, so this stays an
  ordinary .js file: no build step, no .d.ts to keep in sync.
*/

import { SOCIAL_ICONS as SHARED_SOCIAL_ICONS } from '@andrew/ui/icons';

/** @type {Record<string, string>} */
export const SOCIAL_ICONS = SHARED_SOCIAL_ICONS;

/**
 * BRAND / CATEGORY ICONS: used by the referral links.
 *
 * ⚠ A NOTE ON BRAND LOGOS
 * Only `amazon` here is an actual brand mark, and it is one we already had in
 * the repo. The rest are neutral CATEGORY glyphs authored for this site: a
 * lens for cameras, a colour wheel for grading, and so on.
 *
 * That is deliberate, for two reasons. Redrawing a company's logo from memory
 * produces something subtly wrong, which looks worse than no logo at all. And
 * brand marks come with usage terms: the right way to show Sony's or Mint
 * Mobile's logo is to use the file THEY publish, under THEIR guidelines.
 *
 * TO DROP IN A REAL BRAND LOGO
 *   1. save the official SVG to src/assets/brands/<name>.svg;
 *   2. paste its <path> here under the same key, keeping `fill="currentColor"`
 *      (or, if the logo must keep its own colours, reference the file from
 *      the referral entry's `logo` field instead);
 *   3. nothing else changes: referrals.js already points at these keys.
 *
 * @type {Record<string, string>}
 */
export const BRAND_ICONS = {
  /** Real Amazon mark — the same one the footer uses. */
  amazon: SOCIAL_ICONS.Amazon,

  /** Camera lens aperture — stills and cinema bodies. */
  aperture: `<svg ${LINE} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3v8m6.2 1.6-7-4M6.9 19.4l7-4M3.4 15.1l7.2-3.6M20.6 8.9l-7.2 3.6M6.9 4.6l6.6 8.4M17.1 19.4l-6.6-8.4"/></svg>`,

  /** Camera body — a second gear glyph, so two camera links aren't identical. */
  camera: `<svg ${LINE} viewBox="0 0 24 24"><path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h2L9 4h6l1.5 2h2A2.5 2.5 0 0 1 21 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5z"/><circle cx="12" cy="12.5" r="3.5"/></svg>`,

  /** Colour-grading wheel — editing and finishing software. */
  colorWheel: `<svg ${LINE} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v6m0 6v6M3 12h6m6 0h6"/></svg>`,

  /** Stacked layers — image and design tools. */
  layers: `<svg ${LINE} viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/><path d="m3 17 9 5 9-5" opacity=".5"/></svg>`,

  /** Broadcast waves — streaming and capture. */
  broadcast: `<svg ${LINE} viewBox="0 0 24 24"><circle cx="12" cy="12" r="2.5"/><path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6m7.6-7.6a5.4 5.4 0 0 1 0 7.6"/><path d="M5.4 5.4a9.3 9.3 0 0 0 0 13.2m13.2-13.2a9.3 9.3 0 0 1 0 13.2"/></svg>`,

  /** Signal bars — mobile service. Placeholder for the Mint Mobile mark. */
  signal: `<svg ${LINE} viewBox="0 0 24 24"><path d="M4 19v-4m5 4V9m5 10V5m5 14V11"/></svg>`,

  /** Shopping bag — general storefronts and curated lists. */
  storefront: `<svg ${LINE} viewBox="0 0 24 24"><path d="M4 8h16l-1.2 11a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8z"/><path d="M8.5 11V7a3.5 3.5 0 0 1 7 0v4"/></svg>`,
};
