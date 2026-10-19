/* The published build. Facts from the app repo (reelay/__init__.py,
 * packaging/build_mac.sh, .github/workflows/release.yml: macos-14, arm64)
 * and from the owner (file size, checksum, download URL). */
export const RELEASE = {
  version: '0.12.0',
  label: 'v0.12.0 Beta',
  date: '2026-10-11',
  dateLabel: 'October 11, 2026',
  filename: 'Reelay-0.12.0-mac-arm64.dmg',
  href: 'https://github.com/reelay-studio/reelay/releases/latest/download/Reelay-0.12.0-mac-arm64.dmg',
  size: '105.4 MB',
  sizeBytes: 105_400_000,
  sha256: '25d314bff7a3bdecffa66c5ba2261e3c732b347401d1c2e881ccdcde3f2fdfa0',
  requirements: 'Apple silicon · macOS 12 or later',
  /* build_mac.sh with an Apple Development identity: signed with the
   * hardened runtime, not notarized (docs/release-signing.md). */
  notarized: false,
};

/* Release notes, newest first. Written from the app's commit history. */
export const CHANGELOG = [
  {
    version: '0.12.0',
    date: 'October 11, 2026',
    title: 'Reelay Studio',
    items: [
      'A media-first Library and Board: image-first grids with hover-scrub previews, tile sizes from Small to XL, and 24, 48, 96 or All per page, remembered.',
      'The side panel: select a video on the Board to play it above its readiness ring, platforms, captions and a Schedule button that says exactly what will happen.',
      'Download Sources by @username or link, one section per platform. Snapchat Spotlight links can be pasted too.',
      'Accounts as integration cards, with one-click sign-in first and your own developer keys under Advanced Setup. Disconnect revokes access where the platform allows.',
      'Snapchat joins TikTok and Instagram as a platform you post to by hand, with Prepare to Publish.',
      'Per-profile branding: each creator’s logo and colours, and a Custom theme built from them.',
      'Automations: quick-start recipes and Test this rule on a real video.',
      'Security: agent requests that publish, archive or bulk-edit wait for approval; edits by an AI assistant are marked; the agent API only answers on this Mac and checks the Host header; downloaded captions are kept out of instructions; data files are private to your user.',
      'Builds are signed with the hardened runtime.',
    ],
  },
  {
    version: '0.11.0',
    date: 'October 10, 2026',
    title: 'Automations and archive search',
    items: [
      'Automations: when, if, then rules that fill empty copy, add hashtags, choose platforms and schedule, once per video.',
      'Archive search over titles, captions, copy and what was said, with the quote on the card.',
      'Durable sends: an interrupted or missed post waits for your decision and is never posted twice.',
      'Prepare to Publish and the coverage map on every card.',
      'Video tools: remove or replace the sound, burn in captions, on your Mac.',
      'A shared database through a synced folder, one editor at a time.',
    ],
  },
  {
    version: '0.10.0',
    date: 'October 9, 2026',
    title: 'Custom columns',
    items: ['Rename, add, remove and reorder the Board’s columns per profile.', 'One clear choice per platform on every card.'],
  },
];
