import type { FooterLink, NavItem, SocialLink } from '@andrew/ui/types';
import { SOCIAL_LINE_ICONS } from '@andrew/ui/icons';
import { HOME_SECTIONS, BUILD_SECTIONS, GEAR_SECTIONS, ABOUT_SECTIONS } from './sections';

const rawBase = import.meta.env.BASE_URL;
const base = rawBase === '/' ? '' : rawBase.replace(/\/$/, '');
export const homeUrl = base ? `${base}/` : '/';
const page = (slug: string) => `${base}/${slug}/`;

const toSubsections = (sections: { id: string; label: string; kicker?: string }[], baseUrl: string) =>
  sections.map((s) => ({
    label: s.label,
    href: `${baseUrl}#${s.id}`,
    kicker: s.kicker || '',
  }));

export const NAV_LINKS: NavItem[] = [
  {
    label: 'Home',
    href: homeUrl,
    section: 'home',
    subsections: toSubsections(HOME_SECTIONS, homeUrl),
  },
      {
    label: 'Build in Public',
    href: page('build'),
    section: 'build',
    subsections: toSubsections(BUILD_SECTIONS, page('build')),
  },
  {
    label: 'Gear',
    href: homeUrl + '#gear',
    section: 'gear',
    spy: ['gear'],
    subsections: [],
  },
  {
    label: 'About',
    href: page('about'),
    section: 'about',
    subsections: toSubsections(ABOUT_SECTIONS, page('about')),
  },
];

export const FOOTER_EXPLORE: FooterLink[] = NAV_LINKS.map(({ label, href }) => ({ label, href }));

export const FOOTER_UTILITY: FooterLink[] = [{ label: 'Sitemap', href: page('sitemap') }];

export const PRIVACY_HREF = page('privacy');

export const SOCIALS: SocialLink[] = [
  { label: 'YouTube', href: 'https://www.youtube.com/@HeyThisIsAndrew', icon: SOCIAL_LINE_ICONS.YouTube },
  { label: 'Instagram', href: 'https://www.instagram.com/hey_thisisandrew/', icon: SOCIAL_LINE_ICONS.Instagram },
  { label: 'TikTok', href: 'https://tiktok.com/@hey_thisisandrew', icon: SOCIAL_LINE_ICONS.TikTok },
  { label: 'Threads', href: 'https://www.threads.net/@hey_thisisandrew', icon: SOCIAL_LINE_ICONS.Threads },
  { label: 'Substack', href: 'https://thisiscoffeetalk.substack.com/', icon: SOCIAL_LINE_ICONS.Substack },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/andrewlwyrbaxter/', icon: SOCIAL_LINE_ICONS.LinkedIn },
];

export const SEARCH_TRIGGER = {
  label: 'Search',
  ariaLabel: 'Search site',
  title: 'Search gear, milestones, projects',
  keyShortcuts: 'Meta+K Control+K /',
  mobileText: 'Search gear, milestones, projects...',
  mobileAria: 'Open search',
};
