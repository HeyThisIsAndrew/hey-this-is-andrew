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

export const HOME_SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'directory', label: 'The Brands' },
  { id: 'posts', label: 'Posts' }
];

export const NAV_LINKS: NavItem[] = [
  {
    label: 'Home',
    href: homeUrl,
    section: 'home',
    subsections: HOME_SECTIONS.map(s => ({ label: s.label, href: `${homeUrl}#${s.id}` }))
  },
  {
    label: 'About',
    href: `${base}/about/`,
    section: 'about',
    subsections: [
      { label: 'Story', href: `${base}/about/#story` }
    ]
  },
  {
    label: 'Gallery',
    href: `${base}/gallery/`,
    section: 'gallery',
    subsections: [
      { label: 'Photos', href: `${base}/gallery/#photos` }
    ]
  }
];

export const FOOTER_EXPLORE: FooterLink[] = NAV_LINKS.map(({ label, href }) => ({ label, href }));

export const SOCIALS: SocialLink[] = [
  { label: 'YouTube', href: 'https://www.youtube.com/', icon: SOCIAL_LINE_ICONS.YouTube },
  { label: 'Instagram', href: 'https://www.instagram.com/', icon: SOCIAL_LINE_ICONS.Instagram },
];
