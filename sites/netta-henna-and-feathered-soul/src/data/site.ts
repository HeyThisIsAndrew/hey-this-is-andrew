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

export const BOOKING_DELIVERY = {
  // Configured submission endpoint for appointment requests (Formspree free tier or custom endpoint).
  // Sends an immediate email notification to Netta with customer name, phone (tap-to-text),
  // selected services, preferred date and time, and notes.
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
    subsections: [
      { label: 'Henna Art', href: `${homeUrl}#services`, kicker: '01' },
      { label: 'Hair Feathers', href: `${homeUrl}#services`, kicker: '02' },
      { label: 'Hair Tinsel', href: `${homeUrl}#services`, kicker: '03' },
    ],
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
