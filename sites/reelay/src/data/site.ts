import type { FooterLink, NavItem, SocialLink } from '@andrew/ui/types';
import { SOCIAL_LINE_ICONS } from '@andrew/ui/icons';

const rawBase = import.meta.env.BASE_URL;
const base = rawBase === '/' ? '' : rawBase.replace(/\/$/, '');
export const homeUrl = base ? `${base}/` : '/';

export const SITE = {
  name: 'Reelay',
  fullName: 'Reelay Studio',
  tagline: 'Publish everywhere. Never lose control.',
  description: 'The local-first content operations studio for modern video creators. Download, organize, edit, and schedule video across YouTube, TikTok, and Instagram—directly from your desktop.',
  version: 'v0.12.0 Beta',
  releaseDate: 'October 2026',
  copyright: '© 2026 Reelay Studio. All rights reserved.',
  supportEmail: 'compliance@reelay.app',
  dpoEmail: 'privacy@reelay.app',
  githubUrl: 'https://github.com/reelay-studio/reelay',
};

export const HOME_SECTIONS = [
  { id: 'interactive-workflow', label: 'Workflow' },
  { id: 'studio-preview', label: 'Studio Preview' },
  { id: 'four-pillars', label: 'Pro Architecture' },
  { id: 'data-topology', label: 'Trust & Privacy' },
  { id: 'silicon-architecture', label: 'Silicon & Hardware' },
  { id: 'download', label: 'Downloads' },
];

export const NAV_LINKS: NavItem[] = [
  {
    label: 'Studio',
    href: `${homeUrl}#studio-preview`,
    section: 'studio-preview',
    spy: ['studio-preview'],
    subsections: [
      { label: 'Player & Scrubbing', href: `${homeUrl}#studio-preview`, kicker: '01' },
      { label: 'Whisper Transcripts', href: `${base}/features/library#transcripts`, kicker: '02' },
    ],
  },
  {
    label: 'Features',
    href: `${base}/features`,
    section: 'features',
    spy: ['four-pillars'],
    subsections: [
      { label: 'Studio & In-App Player', href: `${base}/features/library`, kicker: 'Pillar 01' },
      { label: 'Cross-Platform Pipeline', href: `${base}/features/pipeline`, kicker: 'Pillar 02' },
      { label: 'Rules & Automations', href: `${base}/features/automations`, kicker: 'Pillar 03' },
    ],
  },
  {
    label: 'AI & MCP',
    href: `${base}/ai`,
    section: 'ai',
    subsections: [
      { label: 'Model Context Protocol', href: `${base}/ai`, kicker: 'MCP' },
      { label: 'ScopedPipeline Security', href: `${base}/ai#security-boundary`, kicker: 'Safety' },
    ],
  },
  {
    label: 'Pricing',
    href: `${base}/pricing`,
    section: 'pricing',
    subsections: [],
  },
  {
    label: 'Support',
    href: `${base}/support`,
    section: 'support',
    subsections: [
      { label: 'Help & FAQ', href: `${base}/support`, kicker: 'Docs' },
      { label: 'Reviewer Verification', href: `${base}/support#demo-verification`, kicker: 'Audit' },
    ],
  },
];

export const FOOTER_EXPLORE: FooterLink[] = [
  { label: 'Studio Player', href: `${base}/features/library` },
  { label: 'Kanban Pipeline', href: `${base}/features/pipeline` },
  { label: 'Rules Engine', href: `${base}/features/automations` },
  { label: 'AI & MCP Protocol', href: `${base}/ai` },
  { label: 'Pricing & Licenses', href: `${base}/pricing` },
  { label: 'Download Desktop App', href: `${homeUrl}#download` },
];

export const UTILITY_LINKS: FooterLink[] = [
  { label: 'Terms of Service', href: `${base}/terms` },
  { label: 'User Data Deletion', href: `${base}/data-deletion` },
  { label: 'Google Limited Use', href: `${base}/privacy#google-limited-use` },
  { label: 'Reviewer Portal', href: `${base}/support#demo-verification` },
];

export const SOCIALS: SocialLink[] = [
  { label: 'YouTube', href: 'https://www.youtube.com/', icon: SOCIAL_LINE_ICONS.YouTube },
  { label: 'TikTok', href: 'https://www.tiktok.com/', icon: SOCIAL_LINE_ICONS.TikTok },
  { label: 'Instagram', href: 'https://www.instagram.com/', icon: SOCIAL_LINE_ICONS.Instagram },
  { label: 'Threads', href: 'https://www.threads.net/', icon: SOCIAL_LINE_ICONS.Threads },
];

export const DOWNLOADS = {
  macArm: {
    label: 'Download for macOS (Apple Silicon)',
    arch: 'Apple Silicon (M1 / M2 / M3 / M4)',
    filename: 'Reelay-0.12.0-mac-arm64.dmg',
    href: 'https://github.com/reelay-studio/reelay/releases/latest/download/Reelay-0.12.0-mac-arm64.dmg',
    size: '105.4 MB',
    status: 'available',
    statusLabel: 'Verified Artifact',
    requirements: 'macOS 13.0 Ventura or later (Apple Silicon)',
    signature: 'Developer Signed • Hardened Runtime Configured',
    sha256: '25d314bff7a3bdecffa66c5ba2261e3c732b347401d1c2e881ccdcde3f2fdfa0',
  },
  macIntel: {
    label: 'macOS (Intel)',
    arch: 'Intel x86_64 Architecture',
    filename: 'Reelay-0.12.0-mac-x64.dmg',
    href: 'https://github.com/reelay-studio/reelay/releases',
    size: 'Pending Build',
    status: 'pipeline',
    statusLabel: 'In Build Pipeline',
    requirements: 'macOS 13.0 Ventura or later (Intel Core i5/i7/i9)',
    signature: 'Packaging Script: packaging/build_mac.sh',
    sha256: 'Pending release pipeline build',
  },
  windows: {
    label: 'Windows 64-bit',
    arch: 'Windows 10 / 11 (64-bit)',
    filename: 'Reelay-0.12.0-Windows-Setup-x64.exe',
    href: 'https://github.com/reelay-studio/reelay/releases',
    size: 'Pending Build',
    status: 'pipeline',
    statusLabel: 'In Build Pipeline',
    requirements: 'Windows 10 / 11 (64-bit, Build 19041+)',
    signature: 'PowerShell Script: packaging/build_windows.ps1',
    sha256: 'Pending release pipeline build',
  },
};
