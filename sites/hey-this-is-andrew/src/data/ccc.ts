/**
 * Capture Create Caffeinate: the facts the /ccc/ page and the homepage both
 * show, in one place so they cannot drift apart again. Source of truth: the
 * pitch deck (v7.3, public/ccc/Capture-Create-Caffeinate-Deck.pdf).
 */

import { CONTACT } from './contact';

const rawBase = import.meta.env.BASE_URL;
const base = rawBase === '/' ? '' : rawBase.replace(/\/$/, '');

export const CCC_PRICING = {
  photo: { label: 'Photo session', price: '$950', desc: '4 hours on site. Every keeper edited, no cap. 15 selects the next day, full gallery within a week.' },
  reel: { label: 'Reel add-on', price: '+$550', desc: 'One finished vertical reel, with one round of revisions included.' },
  bundle: {
    label: 'Photo + reel',
    price: '$1,200',
    regular: 'Regularly $1,500',
    desc: 'Both, together. Founding rate for the first 3 venues.',
  },
  footer: 'Rush: full gallery in 48 hours, +$150 · Events quoted by scope',
  /** The one-line summary (closer, meta description). */
  summary: 'Photos from $950 · Photo + reel $1,200 founding rate',
} as const;

/** The homepage "Starting Rate" card, built from the same numbers. */
export const CCC_STARTING_RATE = `Photo sessions start at ${CCC_PRICING.photo.price}. Add a reel for ${CCC_PRICING.reel.price.replace('+', '')}, or get both for ${CCC_PRICING.bundle.price} (founding rate). Events quoted by scope.`;
export const CCC_TURNAROUND = '15 selects the next day. The full gallery within a week.';

/** Used for the brand everywhere on this site (Build, About, Sitemap). */
export const CCC_DESCRIPTOR = 'Photo and video for bars, restaurants, and events';

export const CCC_PAGE = `${base}/ccc/`;
export const CCC_DECK = {
  href: `${base}/ccc/Capture-Create-Caffeinate-Deck.pdf`,
  /** Shown beside the download link. Update with the file. */
  size: 'PDF, 2.6 MB',
};
export const CCC_PORTFOLIO = 'https://the.fotoapp.co/capturecreatecaffeinate';
export const CCC_EMAIL = CONTACT.ccc;
export const CCC_INQUIRY_HREF =
  `mailto:${CCC_EMAIL}?subject=${encodeURIComponent('Photography project inquiry')}` +
  `&body=${encodeURIComponent('Venue:\nWhat you want to show off:\nDates that work:\n')}`;

/** The video section (deck slides 8 and 9). Set to false to hide it. */
export const CCC_SHOW_VIDEO = true;
/** "Watch the reel" (a plain link, no embed). Empty: no link is shown.
 *  Pending Andrew: the reel's URL on the Capture Create Caffeinate Instagram. */
export const CCC_REEL_URL = '';
