import type { FooterLink, NavItem, SocialLink } from '@andrew/ui/types';
import { SOCIAL_LINE_ICONS } from '@andrew/ui/icons';

const rawBase = import.meta.env.BASE_URL;
const base = rawBase === '/' ? '' : rawBase.replace(/\/$/, '');
export const homeUrl = base ? `${base}/` : '/';

export const SITE = {
  name: 'Netta Henna and Feathered Soul',
  tagline: 'Henna art, hair feathers, and hair tinsel in Santa Barbara.',
  description: 'Boho beauty and earthy luxury. Henna art, hair feathers, and hair tinsel in Santa Barbara, CA.',
  location: 'Santa Barbara, CA',
  instagramHandle: '@nettahennaandfeatheredsoul',
  instagramUrl: 'https://www.instagram.com/nettahennaandfeatheredsoul',
  copyright: '© 2026 Netta Henna and Feathered Soul. All rights reserved.',
};

export const HOME_SECTIONS = [
  { id: 'services', label: 'Services' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'booking', label: 'Book a Date' },
  { id: 'instagram', label: 'Instagram' },
];

export const NAV_LINKS: NavItem[] = [
  {
    label: 'Services',
    href: `${homeUrl}#services`,
    section: 'services',
    subsections: [
      { label: 'Henna Art', href: `${homeUrl}#brand-henna-art`, kicker: '01' },
      { label: 'Hair Feathers', href: `${homeUrl}#brand-hair-feathers`, kicker: '02' },
      { label: 'Hair Tinsel', href: `${homeUrl}#brand-hair-tinsel`, kicker: '03' },
    ],
  },
  {
    label: 'Gallery',
    href: `${homeUrl}#gallery`,
    section: 'gallery',
    subsections: [],
  },
  {
    label: 'How It Works',
    href: `${homeUrl}#how-it-works`,
    section: 'how-it-works',
    subsections: [],
  },
  {
    label: 'Book',
    href: `${homeUrl}#booking`,
    section: 'booking',
    subsections: [],
  },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/nettahennaandfeatheredsoul',
    section: 'instagram',
    subsections: [],
  },
];

export const FOOTER_EXPLORE: FooterLink[] = [
  { label: 'Services', href: `${homeUrl}#services` },
  { label: 'Gallery', href: `${homeUrl}#gallery` },
  { label: 'How It Works', href: `${homeUrl}#how-it-works` },
  { label: 'Book a Date', href: `${homeUrl}#booking` },
  { label: 'Instagram (@nettahennaandfeatheredsoul)', href: 'https://www.instagram.com/nettahennaandfeatheredsoul' },
];

export const SOCIALS: SocialLink[] = [
  { label: 'Instagram', href: 'https://www.instagram.com/nettahennaandfeatheredsoul', icon: SOCIAL_LINE_ICONS.Instagram },
];
