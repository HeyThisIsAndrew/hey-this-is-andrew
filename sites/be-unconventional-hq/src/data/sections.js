/**
 * Content section definitions.
 *
 * The article section's name and slug live here as a single exported value,
 * not typed into route files. Renaming the section is a change to this file
 * plus the directory name under `src/pages/` — nowhere else.
 *
 * Convention note: this sits in `src/data/*.js` alongside site.js /
 * constants.js / categories.js rather than in a new `src/consts.ts`, because
 * that is the pattern this repo already uses for shared config.
 */

/** The written-word section. Substack is the writing tool; this is where it publishes. */
export const ARTICLE_SECTION = {
  /** Display name, used in nav, headings and <title>. */
  name: 'Intel',
  /** URL slug. Must match the directory name under src/pages/. */
  slug: 'intel',
  /** Section index path. */
  path: '/intel',
  /** Kicker above the section title, matching the site's PageTitle pattern. */
  kicker: 'Read The HQ',
  /** PageTitle splits its heading into two words. */
  titlePrimary: 'The',
  titleSecondary: 'Intel',
  description:
    'Long-form reviews, analysis and on-location reporting from BE Unconventional HQ.',
};

/** Path to a single article. Never build this by hand. */
export const articlePath = (slug) => `${ARTICLE_SECTION.path}/${slug}`;

/**
 * How many articles the magazine spread consumes before the paginated archive
 * starts. Lives here rather than in the route because `getStaticPaths()` runs
 * in its own isolated scope and cannot see a page's frontmatter constants —
 * only imports.
 *
 * KEEP THIS EVEN. IntelMagazine deals the articles alternately (0→left,
 * 1→right, 2→left …), so an odd number leaves the left rail one tile longer
 * than the right and the spread looks lopsided. 8 gives four tiles a side.
 */
export const MAGAZINE_SIZE = 8;

/**
 * Byline. Hardcoded to the founder for now — deliberately a named constant so
 * swapping it is a one-line change per author once a contributors system
 * exists. See follow-up #4 in scripts/epic-000-audit.md.
 */
export const DEFAULT_BYLINE = {
  name: 'Andrew Baxter',
  role: 'Founder & Editor',
  /* One line establishing why this byline is worth trusting. Kept short — it
     appears under every article. Signals editorial standing rather than
     enthusiasm, which is what accreditation boards and Google's quality
     guidance both look for. */
  bio: 'Covering film, television and games with on-location reporting, long-form criticism and industry analysis.',
};

/** Where the writing is authored. Attribution links point back here. */
export const SOURCE_PUBLICATION = {
  name: 'BE Unconventional HQ',
  platform: 'Substack',
  url: 'https://beunconventionalhq.substack.com/',
};

/** Shared CTA copy, previously repeated inline across card and section markup. */
export const CTA = {
  readNow: 'Read Now',
  watchNow: 'Watch Now',
  subscribe: 'Subscribe',
  viewAll: 'View All Content',
};
