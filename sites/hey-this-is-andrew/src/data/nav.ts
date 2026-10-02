// The ONE nav data source. Nav (header) and Footer both read this file, so
// their links can never disagree: the footer's Explore list is the header's
// top-level links plus the footer-only extras below.
import type { FooterLink, NavItem, SocialLink } from '@andrew/ui/types';
import { SOCIAL_LINE_ICONS } from '@andrew/ui/icons';

const rawBase = import.meta.env.BASE_URL;
const base = rawBase === '/' ? '' : rawBase.replace(/\/$/, '');
export const homeUrl = base ? `${base}/` : '/';
const page = (slug: string) => `${base}/${slug}/`;

export const NAV_LINKS: NavItem[] = [
  {
    label: 'Home',
    href: homeUrl,
    section: 'home',
    subsections: [
      { label: 'Overview', href: `${homeUrl}#overview`, kicker: '01' },
      { label: 'Brands', href: `${homeUrl}#directory`, kicker: '02' },
      { label: 'Meet The Creator', href: `${homeUrl}#about`, kicker: '03' },
      { label: 'Work', href: page('work'), kicker: '04' },
      { label: 'Latest', href: page('latest'), kicker: '05' },
      { label: 'Goals', href: page('goals'), kicker: '06' },
      { label: 'What I do', href: page('services'), kicker: '07' },
      { label: 'Gear', href: page('gear'), kicker: '08' },
      { label: 'Now', href: page('now'), kicker: '09' },
    ],
  },
  {
    label: 'Build in Public',
    href: page('build'),
    section: 'build',
    subsections: [
      { label: 'Milestone Roadmap', href: `${page('build')}#brand-roadmap-dashboard`, kicker: '01' },
      { label: 'Core Engine', href: `${page('build')}#core-engine-heading`, kicker: '02' },
      { label: 'BE Unconventional HQ', href: `${page('build')}#be-heading`, kicker: 'BE' },
      { label: 'Capture Create Caffeinate', href: `${page('build')}#ccc-heading`, kicker: 'CCC' },
    ],
  },
  {
    // One label everywhere (nav, side panel, the home section, the page).
    label: 'Gear',
    href: page('gear'),
    section: 'gear',
    // The home page's Gear section IS this destination: the scrollspy lights
    // Gear there and nowhere else. No other item has a home section of its
    // own (Meet The Creator previews About; it does not light it).
    spy: ['gear'],
    subsections: [
      { label: 'Camera Bodies', href: `${page('gear')}#gear-bodies`, kicker: '01' },
      { label: 'Zoom Lenses', href: `${page('gear')}#gear-zooms`, kicker: '02' },
      { label: 'Prime Lenses', href: `${page('gear')}#gear-primes`, kicker: '03' },
      { label: 'Lighting & Flash', href: `${page('gear')}#gear-lighting`, kicker: '04' },
      { label: 'Audio Hardware', href: `${page('gear')}#gear-audio`, kicker: '05' },
      { label: 'Amazon Storefront', href: 'https://a.co/d/0i9uWbMj', kicker: 'AMZ' },
    ],
  },
  {
    label: 'The Cafe',
    href: page('cafe'),
    section: 'cafe',
    subsections: [
      { label: 'Espresso & Brew Bar', href: `${page('cafe')}#brew`, kicker: '01' },
      { label: 'Grinders & Scales', href: `${page('cafe')}#gear`, kicker: '02' },
      { label: '9:16 Reel Note', href: `${page('cafe')}#reels`, kicker: '03' },
      { label: 'James Coffee Co.', href: `${page('cafe')}#beans`, kicker: '04' },
    ],
  },
  {
    label: 'About',
    href: page('about'),
    section: 'about',
    subsections: [
      { label: 'About Andrew', href: page('about'), kicker: '01' },
      { label: 'Meet The Creator', href: `${homeUrl}#about`, kicker: '02' },
      { label: 'Press & Media Kit', href: page('press'), kicker: '03' },
      { label: 'What I do', href: page('services'), kicker: '04' },
    ],
  },
];

// The footer lists the top-level destinations only, in one row (the same
// five as the header and the phone menu). Every other page is reached from
// inside the site; Sitemap, which lists them all, sits in the legal row.
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
  // Cmd/Ctrl+K and / still open search (SiteSearch.astro); no visible hint.
  keyShortcuts: 'Meta+K Control+K /',
  mobileText: 'Search gear, milestones, projects...',
  mobileAria: 'Open search',
};
