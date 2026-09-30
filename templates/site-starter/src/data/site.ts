// Everything that names this site lives here. Change these first.
import type { FooterLink, NavItem, SocialLink } from '@andrew/ui/types';
import { SOCIAL_LINE_ICONS } from '@andrew/ui/icons';

const rawBase = import.meta.env.BASE_URL;
const base = rawBase === '/' ? '' : rawBase.replace(/\/$/, '');
export const homeUrl = base ? `${base}/` : '/';

export const SITE = {
  name: 'NEW_SITE',
  tagline: 'A site built from the shared blocks.',
  description: 'A new site scaffolded from the andrew-sites starter.',
  copyright: '© 2026 Your Name. All rights reserved.',
};

// The ONE nav data source: the header reads NAV_LINKS, the footer reads
// NAV_LINKS plus FOOTER_ONLY, so they can never disagree.
export const NAV_LINKS: NavItem[] = [
  {
    label: 'Home',
    href: homeUrl,
    section: 'home',
    subsections: [
      { label: 'The Brands', href: `${homeUrl}#directory`, kicker: '01' },
      { label: 'Posts', href: `${homeUrl}#posts`, kicker: '02' },
    ],
  },
];

const FOOTER_ONLY: FooterLink[] = [];
export const FOOTER_EXPLORE: FooterLink[] = [...NAV_LINKS.map(({ label, href }) => ({ label, href })), ...FOOTER_ONLY];

export const SOCIALS: SocialLink[] = [
  { label: 'YouTube', href: 'https://www.youtube.com/', icon: SOCIAL_LINE_ICONS.YouTube },
  { label: 'Instagram', href: 'https://www.instagram.com/', icon: SOCIAL_LINE_ICONS.Instagram },
];
