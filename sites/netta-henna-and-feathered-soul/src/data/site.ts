import type { FooterLink, NavItem, SocialLink } from '@andrew/ui/types';
import { SOCIAL_LINE_ICONS } from '@andrew/ui/icons';

const rawBase = import.meta.env.BASE_URL;
const base = rawBase === '/' ? '' : rawBase.replace(/\/$/, '');
export const homeUrl = base ? `${base}/` : '/';

export const SITE = {
  name: 'Netta Henna and Feathered Soul',
  website: 'nettahennaandfeatheredsoul.com',
  tagline: 'Henna art, hair feathers, and hair tinsel in Santa Barbara.',
  description: 'Boho beauty and earthy luxury. Henna art, hair feathers, and hair tinsel in Santa Barbara, CA. DM to Book.',
  location: 'Santa Barbara, CA',
  bookingLine: 'DM to Book',
  instagramHandle: '@nettahennaandfeatheredsoul',
  instagramUrl: 'https://www.instagram.com/nettahennaandfeatheredsoul',
  copyright: '© 2026 Netta Henna and Feathered Soul. All rights reserved.',
};

/**
 * BOOKING_MODE:
 * Master switch for Netta's appointment request flow.
 * - 'sms': 3A Flip the Flow (PRIMARY / DEFAULT ON).
 *   On submit, opens the customer's native Messages app with Netta's number
 *   and appointment request prefilled. The customer taps Send directly in Messages.
 *   Free forever, zero backend/workers, zero third-party accounts.
 * - 'email': 3B Direct Email via Formspree (FALLBACK SWITCH).
 *   On submit, posts the booking to BOOKING_DELIVERY.endpoint, delivering
 *   an email to Netta with customer contact info.
 *
 * Flipping this one setting switches the live submission path without modifying any other code.
 */
export const BOOKING_MODE: 'sms' | 'email' = 'sms';

/**
 * Netta's booking phone number for 3A Flip the Flow.
 * Andrew will fill this in once Netta confirms her preferred business phone number.
 * Format: digits only or E.164, e.g. '8055550123' or '+18055550123'.
 * Leave empty ('') until Netta confirms her number.
 */
export const BOOKING_SMS_NUMBER = '';

export const BOOKING_DELIVERY = {
  // Configured submission endpoint for 3B email fallback (Formspree free tier or custom endpoint).
  // Built as a fallback switch; placeholder ID from pass 17, owner unknown.
  endpoint: 'https://formspree.io/f/mqaeovgq',
  serviceName: 'Formspree Free Tier (Direct Email Notification)',
};

export const HOME_SECTIONS = [
  { id: 'overview', label: 'Home' },
  { id: 'services', label: 'Services' },
  { id: 'price-list', label: 'Price List' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'booking', label: 'Book an Appointment' },
  { id: 'contact', label: 'Contact' },
];

export const NAV_LINKS: NavItem[] = [
  {
    label: 'Home',
    href: `${homeUrl}#overview`,
    section: 'overview',
    subsections: [],
  },
  {
    label: 'Services',
    href: `${homeUrl}#services`,
    section: 'services',
    subsections: [],
  },
  {
    label: 'Price List',
    href: `${homeUrl}#price-list`,
    section: 'price-list',
    subsections: [],
  },
  {
    label: 'Gallery',
    href: `${homeUrl}#gallery`,
    section: 'gallery',
    subsections: [],
  },
  {
    label: 'Book Now',
    href: `${homeUrl}#booking`,
    section: 'booking',
    subsections: [],
  },
  {
    label: 'Contact',
    href: `${homeUrl}#site-footer`,
    section: 'contact',
    subsections: [],
  },
];

export const FOOTER_EXPLORE: FooterLink[] = [
  { label: 'Home', href: `${homeUrl}#overview` },
  { label: 'Services', href: `${homeUrl}#services` },
  { label: 'Price List', href: `${homeUrl}#price-list` },
  { label: 'Gallery', href: `${homeUrl}#gallery` },
  { label: 'Book an Appointment', href: `${homeUrl}#booking` },
  { label: 'Contact Netta', href: `${homeUrl}#site-footer` },
];

export const SOCIALS: SocialLink[] = [
  { label: 'Instagram', href: 'https://www.instagram.com/nettahennaandfeatheredsoul', icon: SOCIAL_LINE_ICONS.Instagram },
];
