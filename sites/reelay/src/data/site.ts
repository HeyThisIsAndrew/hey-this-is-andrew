import type { FooterLink, NavItem, SocialLink } from '@andrew/ui/types';
import { RELEASE } from './release';
import { CONTACTS } from './operator';

const rawBase = import.meta.env.BASE_URL;
const base = rawBase === '/' ? '' : rawBase.replace(/\/$/, '');
export const homeUrl = base ? `${base}/` : '/';
export const href = (path: string) => `${base}${path}`;

/*
 * Every claim on this site has to be true of the shipping app
 * (github.com/HeyThisIsAndrew/reelay). Google, TikTok and Meta review read
 * this site, and an invented feature is a failed review. When the app
 * changes, change these facts first; the pages read them.
 */
export const SITE = {
  name: 'Reelay',
  fullName: 'Reelay Studio',
  tagline: 'Publish everywhere. Never lose control.',
  description:
    'Reelay is a Mac app for creators who post short-form video to more than one platform. Bring in the videos you own or manage, turn each one into a ticket with ready-to-paste copy for every platform, and only post what is actually ready. Your library, database and sign-ins stay on your Mac.',
  version: RELEASE.label,
  versionNumber: RELEASE.version,
  releaseDate: RELEASE.dateLabel,
  copyright: '© 2026 Reelay Studio. All rights reserved.',
  url: 'https://reelay.app',
  supportEmail: CONTACTS.support,
  complianceEmail: CONTACTS.reviewers,
  privacyEmail: CONTACTS.privacy,
};

/* Where the app keeps its data (reelay/paths.py: APP_ID = "Reelay"). */
export const DATA_PATHS = {
  mac: '~/Library/Application Support/Reelay',
  macDb: '~/Library/Application Support/Reelay/reelay.db',
  logs: '~/Library/Logs/Reelay',
  library: '~/Movies/Reelay',
  dbName: 'reelay.db',
  keychainService: 'Reelay',
};

/* The four columns every board starts with (reelay/gui/board_page.py). */
export const STAGES = ['Backlog', 'Staging', 'Scheduled', 'Published'] as const;

/* Copy limits (README, "Board (content tickets)"). Snapchat has no copy
 * block of its own: it uses the caption you copy from the ticket. */
export const PLATFORMS = [
  { key: 'youtube', name: 'YouTube', limitLabel: 'Title: 100 characters' },
  { key: 'tiktok', name: 'TikTok', limitLabel: '4,000 characters' },
  { key: 'instagram', name: 'Instagram', limitLabel: '2,200 characters, 30 hashtags' },
  { key: 'bluesky', name: 'Bluesky', limitLabel: '300 characters' },
  { key: 'threads', name: 'Threads', limitLabel: '500 characters' },
  { key: 'facebook', name: 'Facebook', limitLabel: '63,206 characters' },
] as const;

/*
 * "Works with": one row per platform, exactly as the app behaves at
 * 9f3a2fb (models.Platform.ALL / HAND_ONLY / NATIVE_SCHEDULING, oauth.py
 * PROVIDERS, sources.py, README "Platform status"). `state` drives the
 * glyph: yes, no, off (built, off by default), or partial.
 */
export type CapState = 'yes' | 'no' | 'off' | 'partial';
export interface Cap { state: CapState; label: string }
export interface CapRow {
  key: 'youtube' | 'tiktok' | 'instagram' | 'bluesky' | 'threads' | 'facebook' | 'snapchat';
  name: string;
  signIn: Cap;
  import: Cap;
  auto: Cap;
  schedule: Cap;
  byHand: Cap;
}
export const CAP_COLUMNS = [
  ['signIn', 'Sign in'],
  ['import', 'Import'],
  ['auto', 'Post automatically'],
  ['schedule', 'Schedule'],
  ['byHand', 'Posted by hand'],
] as const;
export const CAPABILITIES: CapRow[] = [
  {
    key: 'youtube', name: 'YouTube',
    signIn: { state: 'yes', label: 'Google sign-in' },
    import: { state: 'yes', label: 'Your channel, including private and scheduled videos' },
    auto: { state: 'yes', label: 'Upload, always available' },
    schedule: { state: 'yes', label: 'YouTube holds it and publishes on time' },
    byHand: { state: 'yes', label: 'Optional' },
  },
  {
    key: 'facebook', name: 'Facebook Pages',
    signIn: { state: 'yes', label: 'Facebook sign-in' },
    import: { state: 'no', label: 'No' },
    auto: { state: 'off', label: 'Built, off by default' },
    schedule: { state: 'off', label: 'When on, Facebook holds it' },
    byHand: { state: 'yes', label: 'Default' },
  },
  {
    key: 'threads', name: 'Threads',
    signIn: { state: 'yes', label: 'Threads sign-in' },
    import: { state: 'no', label: 'No' },
    auto: { state: 'off', label: 'Built, off by default' },
    schedule: { state: 'off', label: 'When on, Reelay posts at the time while running' },
    byHand: { state: 'yes', label: 'Default' },
  },
  {
    key: 'bluesky', name: 'Bluesky',
    signIn: { state: 'partial', label: 'App Password' },
    import: { state: 'no', label: 'No' },
    auto: { state: 'off', label: 'Built, off by default' },
    schedule: { state: 'off', label: 'When on, Reelay posts at the time while running' },
    byHand: { state: 'yes', label: 'Default' },
  },
  {
    key: 'tiktok', name: 'TikTok',
    signIn: { state: 'yes', label: 'Shows the connected account' },
    import: { state: 'yes', label: 'Profiles you own or manage' },
    auto: { state: 'no', label: 'No' },
    schedule: { state: 'no', label: 'No' },
    byHand: { state: 'yes', label: 'Prepare to Publish' },
  },
  {
    key: 'instagram', name: 'Instagram',
    signIn: { state: 'yes', label: 'Shows the connected account' },
    import: { state: 'partial', label: 'With your browser’s sign-in' },
    auto: { state: 'no', label: 'No' },
    schedule: { state: 'no', label: 'No' },
    byHand: { state: 'yes', label: 'Prepare to Publish' },
  },
  {
    key: 'snapchat', name: 'Snapchat',
    signIn: { state: 'no', label: 'No' },
    import: { state: 'partial', label: 'Paste your Spotlight links' },
    auto: { state: 'no', label: 'No' },
    schedule: { state: 'no', label: 'No' },
    byHand: { state: 'yes', label: 'Prepare to Publish' },
  },
];

export const AGENT_API = { host: '127.0.0.1', port: 8471, url: 'http://127.0.0.1:8471' };

/* The product sub-nav (Apple's second bar). */
export const PRODUCT_NAV = [
  { id: 'overview', label: 'Overview', href: `${homeUrl}`, match: ['/'] },
  { id: 'library', label: 'Library', href: href('/features/library'), match: ['/features/library'] },
  { id: 'board', label: 'Board', href: href('/features/pipeline'), match: ['/features/pipeline'] },
  { id: 'automations', label: 'Automations', href: href('/features/automations'), match: ['/features/automations'] },
  { id: 'agents', label: 'Agents', href: href('/ai'), match: ['/ai'] },
  { id: 'privacy', label: 'Privacy', href: `${homeUrl}#data-topology`, match: [] },
  { id: 'tech-specs', label: 'Tech Specs', href: `${homeUrl}#tech-specs`, match: [] },
];

export const NAV_LINKS: NavItem[] = [
  {
    label: 'Overview',
    href: `${homeUrl}#studio-preview`,
    section: 'studio-preview',
    spy: ['studio-preview'],
    subsections: [
      { label: 'The Studio', href: `${homeUrl}#studio-preview`, kicker: 'Tour' },
      { label: 'Works with', href: `${homeUrl}#works-with`, kicker: 'Platforms' },
      { label: 'Privacy by design', href: `${homeUrl}#data-topology`, kicker: 'Data' },
      { label: 'Tech Specs', href: `${homeUrl}#tech-specs`, kicker: 'Specs' },
    ],
  },
  {
    label: 'Features',
    href: href('/features'),
    section: 'features',
    spy: ['four-pillars'],
    subsections: [
      { label: 'Library and Player', href: href('/features/library'), kicker: 'Bring in' },
      { label: 'Board and Tickets', href: href('/features/pipeline'), kicker: 'Get ready' },
      { label: 'Automations', href: href('/features/automations'), kicker: 'Repeat' },
      { label: 'Agents', href: href('/ai'), kicker: 'Connect' },
    ],
  },
  { label: 'Download', href: href('/download'), section: 'download', subsections: [] },
  { label: 'Pricing', href: href('/pricing'), section: 'pricing', subsections: [] },
  {
    label: 'Support',
    href: href('/support'),
    section: 'support',
    subsections: [
      { label: 'Help and FAQ', href: href('/support'), kicker: 'Help' },
      { label: 'Security', href: href('/security'), kicker: 'Trust' },
      { label: 'Changelog', href: href('/changelog'), kicker: 'New' },
    ],
  },
];

export const FOOTER_EXPLORE: FooterLink[] = [
  { label: 'Library and Player', href: href('/features/library') },
  { label: 'Board and Tickets', href: href('/features/pipeline') },
  { label: 'Automations', href: href('/features/automations') },
  { label: 'Agents', href: href('/ai') },
  { label: 'Download', href: href('/download') },
  { label: 'Changelog', href: href('/changelog') },
  { label: 'Pricing', href: href('/pricing') },
  { label: 'Support', href: href('/support') },
];

export const UTILITY_LINKS: FooterLink[] = [
  { label: 'Terms of Service', href: href('/terms') },
  { label: 'Data Deletion', href: href('/data-deletion') },
  { label: 'Copyright', href: href('/copyright') },
  { label: 'Security', href: href('/security') },
  { label: 'Accessibility', href: href('/accessibility') },
  { label: 'For Reviewers', href: href('/reviewers') },
];

/* Reelay has no social accounts of its own yet; the footer hides the column. */
export const SOCIALS: SocialLink[] = [];

/* Where Reelay runs (reelay repo, README "Building the apps" and packaging/): a
   released .dmg for Apple silicon; on Windows, packaging/build_windows.ps1 builds
   dist\Reelay\Reelay.exe; on Linux there is no package, it runs from source. */
export const DOWNLOADS = {
  macArm: {
    ...RELEASE,
    label: 'Download for Mac',
    platform: 'macOS',
    arch: 'Apple Silicon (M1–M4)',
    badge: 'Release package',
  },
  windows: {
    platform: 'Windows',
    arch: 'Windows 10 / 11 (64-bit)',
    badge: 'Build script',
    requirements: 'Windows 10 / 11 (64-bit, Python 3.11+)',
    pipelineScript: 'packaging/build_windows.ps1',
    href: `${homeUrl}download#windows-setup`,
    label: 'Setup & Build Guide →',
  },
  linux: {
    platform: 'Linux',
    arch: 'Linux desktop',
    badge: 'Run from Source',
    requirements: 'Python 3.11+ and Qt 6, from source',
    pipelineScript: 'python run_app.py',
    href: `${homeUrl}download#linux-setup`,
    label: 'Source Instructions →',
  },
};
