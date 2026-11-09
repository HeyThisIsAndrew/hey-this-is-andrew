/**
 * Capture Create Caffeinate: the facts the /ccc/ page and the homepage both
 * show, in one place so they cannot drift apart again. Source of truth: the
 * pitch deck (v7.3, public/ccc/Capture-Create-Caffeinate-Deck.pdf).
 */

import { CONTACT } from './contact';

const rawBase = import.meta.env.BASE_URL;
const base = rawBase === '/' ? '' : rawBase.replace(/\/$/, '');

export const CCC_TURNAROUND = '15 selects the next day. The full gallery within a week.';

/** Used for the brand everywhere on this site (Build, About, Sitemap). */
export const CCC_DESCRIPTOR = 'Photo and video for bars, restaurants, and events';

export const CCC_PAGE = `${base}/ccc/`;
export const CCC_DECK = {
  href: `${base}/ccc/Capture-Create-Caffeinate-Deck.pdf`,
  /** The download button's label, file size included. Update with the file. */
  label: 'Pitch deck (PDF, 2.6 MB)',
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
