/**
 * Every email address this site shows, in one place.
 *
 * - ccc:      Capture Create Caffeinate project inquiries.
 * - press:    press and partnership inquiries (edited in the local CMS, in
 *             src/data/press.json, so it is read from there).
 * - personal: the general address (Links page, Privacy page).
 *
 * Unified to heythisisandrewb@gmail.com across all pages.
 */
import pressData from './press.json';

export const CONTACT = {
  ccc: 'capturecreatecaffeinate@gmail.com',
  press: pressData.email,
  personal: 'heythisisandrewb@gmail.com',
} as const;
