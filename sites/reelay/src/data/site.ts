import type { FooterLink, NavItem, SocialLink } from '@andrew/ui/types';

const rawBase = import.meta.env.BASE_URL;
const base = rawBase === '/' ? '' : rawBase.replace(/\/$/, '');
export const homeUrl = base ? `${base}/` : '/';
export const href = (path: string) => `${base}${path}`;

/*
 * Every claim on this site has to be true of the shipping app
 * (github.com/HeyThisIsAndrew/reelay, v0.12.0). Google and Meta app review
 * read this site, and an invented feature is a failed review. When the app
 * changes, change these facts here first; the pages read them.
 */
export const SITE = {
  name: 'Reelay',
  fullName: 'Reelay Studio',
  tagline: 'Publish everywhere. Never lose control.',
  description:
    'Reelay is a native desktop app for creators who post short-form video to more than one platform. Bring your videos in, turn each one into a ticket with ready-to-paste copy for every platform, and only post what is actually ready. Your library, database and sign-ins stay on your computer.',
  version: 'v0.12.0 Beta',
  versionNumber: '0.12.0',
  releaseDate: 'October 2026',
  copyright: '© 2026 Reelay Studio. All rights reserved.',
  supportEmail: 'support@reelay.app',
  complianceEmail: 'compliance@reelay.app',
  privacyEmail: 'privacy@reelay.app',
};

/* Where the app keeps its data (reelay/paths.py: APP_ID = "Reelay"). */
export const DATA_PATHS = {
  mac: '~/Library/Application Support/Reelay',
  macDb: '~/Library/Application Support/Reelay/reelay.db',
  windows: '%APPDATA%\\Reelay',
  windowsPs: '$env:APPDATA\\Reelay',
  linux: '~/.local/share/reelay',
  dbName: 'reelay.db',
};

/* The four columns every board starts with (reelay/gui/board_page.py). */
export const STAGES = ['Backlog', 'Staging', 'Scheduled', 'Published'] as const;

/* The six platforms a ticket carries, in the app's fixed coverage order,
 * with each one's real copy limit (README, "Board (content tickets)") and
 * how Reelay posts there today (README, "Platform status"). */
export const PLATFORMS = [
  { key: 'youtube', name: 'YouTube', limit: 100, limitLabel: 'Title: 100 characters', publish: 'Uploads and schedules on YouTube', mode: 'auto' },
  { key: 'tiktok', name: 'TikTok', limit: 4000, limitLabel: '4,000 characters', publish: 'Prepare to Publish, then you post', mode: 'handoff' },
  { key: 'instagram', name: 'Instagram', limit: 2200, limitLabel: '2,200 characters, 30 hashtags', publish: 'Prepare to Publish, then you post', mode: 'handoff' },
  { key: 'bluesky', name: 'Bluesky', limit: 300, limitLabel: '300 characters', publish: 'Copy and paste, or automatic when you turn it on', mode: 'optional' },
  { key: 'threads', name: 'Threads', limit: 500, limitLabel: '500 characters', publish: 'Copy and paste, or automatic when you turn it on', mode: 'optional' },
  { key: 'facebook', name: 'Facebook', limit: 63206, limitLabel: '63,206 characters', publish: 'Copy and paste, or automatic when you turn it on', mode: 'optional' },
] as const;

export const AGENT_API = {
  host: '127.0.0.1',
  port: 8471,
  url: 'http://127.0.0.1:8471',
};

export const NAV_LINKS: NavItem[] = [
  {
    label: 'Overview',
    href: `${homeUrl}#studio-preview`,
    section: 'studio-preview',
    spy: ['studio-preview'],
    subsections: [
      { label: 'The Studio', href: `${homeUrl}#studio-preview`, kicker: 'Tour' },
      { label: 'How it works', href: `${homeUrl}#interactive-workflow`, kicker: 'Board' },
      { label: 'Privacy by design', href: `${homeUrl}#data-topology`, kicker: 'Data' },
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
    ],
  },
  {
    label: 'Agents',
    href: href('/ai'),
    section: 'ai',
    subsections: [
      { label: 'Agent API', href: href('/ai'), kicker: 'Connect' },
      { label: 'Approvals', href: href('/ai#security-boundary'), kicker: 'Safety' },
    ],
  },
  { label: 'Pricing', href: href('/pricing'), section: 'pricing', subsections: [] },
  {
    label: 'Support',
    href: href('/support'),
    section: 'support',
    subsections: [
      { label: 'Help and FAQ', href: href('/support'), kicker: 'Help' },
      { label: 'App Review', href: href('/support#demo-verification'), kicker: 'Reviewers' },
    ],
  },
];

export const FOOTER_EXPLORE: FooterLink[] = [
  { label: 'Library and Player', href: href('/features/library') },
  { label: 'Board and Tickets', href: href('/features/pipeline') },
  { label: 'Automations', href: href('/features/automations') },
  { label: 'Agent API', href: href('/ai') },
  { label: 'Pricing', href: href('/pricing') },
  { label: 'Download', href: `${homeUrl}#download` },
];

export const UTILITY_LINKS: FooterLink[] = [
  { label: 'Terms of Service', href: href('/terms') },
  { label: 'User Data Deletion', href: href('/data-deletion') },
  { label: 'Google Limited Use', href: href('/privacy#google-limited-use') },
  { label: 'App Review', href: href('/support#demo-verification') },
];

/* Reelay has no social accounts of its own yet; the footer hides the column. */
export const SOCIALS: SocialLink[] = [];

/* Builds come from packaging/build_mac.sh (one .dmg per machine
 * architecture, LSMinimumSystemVersion 12.0) and packaging/build_windows.ps1
 * (a zipped folder, not an installer). Builds are not notarized yet, so the
 * first launch on a Mac goes through Control-click → Open. */
export const DOWNLOADS = {
  macArm: {
    label: 'Download for Mac',
    platform: 'Mac',
    arch: 'Apple silicon',
    filename: 'Reelay-0.12.0-mac-arm64.dmg',
    href: 'https://github.com/reelay-studio/reelay/releases/latest/download/Reelay-0.12.0-mac-arm64.dmg',
    size: '105.4 MB',
    status: 'available',
    statusLabel: 'Available',
    requirements: 'macOS 12 Monterey or later, Apple silicon (M1 or later)',
    sha256: '25d314bff7a3bdecffa66c5ba2261e3c732b347401d1c2e881ccdcde3f2fdfa0',
  },
  macIntel: {
    label: 'Mac with Intel',
    platform: 'Mac',
    arch: 'Intel',
    filename: 'Reelay-0.12.0-mac-x86_64.dmg',
    href: 'https://github.com/reelay-studio/reelay/releases',
    size: 'Not built yet',
    status: 'pipeline',
    statusLabel: 'Not built yet',
    requirements: 'macOS 12 Monterey or later, Intel processor',
    sha256: 'Published with the build',
  },
  windows: {
    label: 'Windows',
    platform: 'Windows',
    arch: '64-bit',
    filename: 'Reelay-0.12.0-windows-x64.zip',
    href: 'https://github.com/reelay-studio/reelay/releases',
    size: 'Not published yet',
    status: 'pipeline',
    statusLabel: 'Not published yet',
    requirements: 'Windows 10 or 11, 64-bit',
    sha256: 'Published with the build',
  },
};
