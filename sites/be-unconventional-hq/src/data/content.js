/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  SITE COPY — every heading, label and button word on the site
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ─── WHAT THIS FILE IS FOR ────────────────────────────────────────────────
 * If you want to change wording anywhere on the site, change it HERE. You
 * should not have to open a page or a component to edit text.
 *
 * Before this file existed, the heading for (say) the homepage video row was
 * typed directly into index.astro, the article row's heading into
 * LatestArticles.astro, the events heading into events.astro, and so on —
 * nineteen separate places. Changing "Recent Videos" meant finding the right
 * file first. Now it is one line below.
 *
 * ─── HOW THE THREE-PART HEADINGS WORK ─────────────────────────────────────
 * The site's section headings are rendered by <PageTitle /> and always have
 * the same three pieces:
 *
 *     kicker      small red text above          "LATEST FROM THE CHANNEL"
 *     primary     first big word, white         "RECENT"
 *     secondary   second big word, red          "VIDEOS"
 *
 * So an entry here looks like:
 *
 *     recentVideos: {
 *       kicker: 'Latest From The Channel',
 *       primary: 'Recent',
 *       secondary: 'Videos',
 *     }
 *
 * Change any of those three strings and the heading updates wherever it is
 * used. You do not need to touch casing — the CSS uppercases the kicker.
 *
 * ─── HOW TO ADD A NEW SECTION ─────────────────────────────────────────────
 * 1. Add an entry to SECTIONS below.
 * 2. In the page, import it:  import { SECTIONS } from '../data/content.js';
 * 3. Spread it into PageTitle: <PageTitle {...SECTIONS.yourSection} />
 *
 * ─── RELATED FILES ────────────────────────────────────────────────────────
 *   src/data/site.js        brand name, URL, nav links, social URLs
 *   src/data/sections.js    the article section (Intel) name/slug + byline
 *   src/data/categories.js  the four homepage content pillars
 *   src/data/constants.js   the canonical category list
 */

import { site } from './site.js';

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION HEADINGS
   Every <PageTitle /> on the site. Keys are grouped by where they appear.
   ═══════════════════════════════════════════════════════════════════════════ */
export const SECTIONS = {
  // ── Homepage ────────────────────────────────────────────────────────────
  /** The video row on the homepage. */
  recentVideos: {
    kicker: 'Latest From The Channel',
    primary: 'Recent',
    secondary: 'Videos',
  },
  /** The four category tiles (Film / TV / Games / Events). */
  whatWeCover: {
    kicker: 'Explore The HQ',
    primary: 'What We',
    secondary: 'Cover',
  },
  /** The 50/50 split featured highlights section on the homepage. */
  featuredHighlights: {
    kicker: 'Editorial Depth',
    primary: 'Featured',
    secondary: 'Highlights',
  },
  /** The article row on the homepage. */
  /*
    The homepage article row.

    Was "FROM / THE FEED / LATEST", which named the wrong destination: the row
    links to /intel, not /feed, and "The Feed" is a different section of the
    site. Reading "The Feed" on a row that opens Intel is a taxonomy mismatch,
    so this now says what it actually is.
  */
  latestArticles: {
    kicker: 'The Latest In',
    primary: 'The',
    secondary: 'Intel',
  },

  // ── Feed + Intel ────────────────────────────────────────────────────────
  /** The Feed's page title. Used as the default in FeedLayout. */
  feed: {
    kicker: 'Explore The HQ',
    primary: 'The',
    secondary: 'Feed',
  },

  // ── Interior pages ──────────────────────────────────────────────────────
  events: {
    kicker: 'Coverage',
    primary: 'Upcoming',
    secondary: 'Events',
  },
  /*
    The /events/archive page title. It replaced `eventHubs` ("Portfolio /
    Coverage / Hubs"), which named a thing this site does not have: those
    cards are past events, and calling them a portfolio of hubs sent readers
    looking for /featured. The ruled heading that opens the six-card strip on
    /events is HEADINGS.pastEventArchive below.
  */
  eventArchive: {
    kicker: 'Coverage',
    primary: 'Past Event',
    secondary: 'Archive',
  },
  featured: {
    kicker: 'Spotlight',
    primary: 'Featured',
    secondary: 'Hubs',
  },
  collaborations: {
    kicker: 'Work With Us',
    primary: 'Press &',
    secondary: 'Partners',
  },
  /* Used by a section on /about that is currently commented out. Kept so the
     copy has a home if that section is revived. */
  aboutPress: {
    kicker: 'Media',
    primary: 'Press and',
    secondary: 'Collaborations',
  },
  notFound: {
    kicker: 'Off The Map',
    primary: 'Page',
    secondary: 'Not Found',
  },

  // ── Shared components ───────────────────────────────────────────────────
  subscribe: {
    kicker: 'Newsletter',
    primary: 'The HQ',
    secondary: 'Dispatch',
  },
  socials: {
    kicker: 'Follow Us',
    primary: 'Connect on',
    secondary: 'Social',
  },
  contact: {
    kicker: 'Get In Touch',
    primary: 'Contact',
    secondary: 'Us',
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   BUTTON + LINK LABELS
   Anything a reader clicks. Keeping these together stops the same action
   being called three different things in three places.
   ═══════════════════════════════════════════════════════════════════════════ */
export const LABELS = {
  readNow: 'Read Now',
  readMore: 'Read More',
  nextArticle: 'Next Article',
  watchNow: 'Watch Now',
  viewAllContent: 'View All Content',
  viewAllVideos: 'All Videos',
  viewAllArticles: 'All Articles',
  loadMore: 'Load More',
  clearFilters: 'Clear Filters',
  backHome: 'Back to Home',
  browseFeed: 'Browse the Feed',
  categories: 'Categories',
  subscribe: 'Subscribe',
  subscribeSubstack: 'Subscribe on Substack',
  subscribeYouTube: 'Subscribe on YouTube',
  allPastEvents: 'All Past Events',
};

/* ═══════════════════════════════════════════════════════════════════════════
   RULED SECTION HEADINGS
   The small ruled label that opens a band of content part-way down a page,
   rendered by <SectionHeading />. Distinct from SECTIONS above, which feeds
   the big stacked <PageTitle /> at the top of a page.
   ═══════════════════════════════════════════════════════════════════════════ */
export const HEADINGS = {
  pastEventArchive: 'Past Event Archive',
};

/* ═══════════════════════════════════════════════════════════════════════════
   EMPTY / ERROR MESSAGES
   What the reader sees when there is nothing to show.
   ═══════════════════════════════════════════════════════════════════════════ */
export const MESSAGES = {
  noContent: 'No content found.',
  noFilterMatch: 'No items found for this filter.',
  noArticles: 'No articles published yet.',
  notFoundBody:
    "This one went off-script. The page you're after moved, vanished, or never existed, but the good stuff is still one click away.",
  subscribeSubtitle: `The week's best stories, reviews, and industry analysis from ${site.name}.`,
  newsletterFineprint: 'No spam. Unsubscribe any time.',
};

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE METADATA (<title> and meta description)

   `title` here is the bare page name — Layout appends "| BE Unconventional HQ"
   via site.name, so you never type the brand name into a page again.
   ═══════════════════════════════════════════════════════════════════════════ */
export const META = {
  feed: {
    title: 'All Content',
    description: `Discover all articles, videos, and events from ${site.name}.`,
  },
  feedVideos: {
    title: 'Videos',
    description: `Discover the latest videos from ${site.name}.`,
  },
  feedArticles: {
    title: 'Articles',
    description: `Discover the latest articles from ${site.name}.`,
  },
  events: {
    title: 'Events',
    description: `Live coverage, premieres, and press event highlights from ${site.name}.`,
  },
  links: {
    title: 'Links',
    description: `Connect with ${site.name} across all platforms.`,
  },
  notFound: {
    title: 'Page Not Found',
    description: `That page went off-script. Head back to ${site.name}.`,
  },
  collaborations: {
    title: 'Collaborations',
    description: `Press kit, media kit, brand assets, and contact information for ${site.name}.`,
  },
};

/**
 * Build a page <title>. Always use this rather than writing the template
 * literal by hand, so the separator and brand suffix stay consistent.
 *
 *   pageTitle('Events')            -> "Events | BE Unconventional HQ"
 *   pageTitle('Events', 2)         -> "Events - Page 2 | BE Unconventional HQ"
 */
export function pageTitle(name, pageNumber) {
  const suffix = pageNumber && pageNumber > 1 ? ` - Page ${pageNumber}` : '';
  return `${name}${suffix} | ${site.name}`;
}
