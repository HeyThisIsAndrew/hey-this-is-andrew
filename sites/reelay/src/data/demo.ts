/*
 * The fictional creator and board that every product rendering on the site
 * shows. One source, so the hero, the workflow and the feature pages all
 * describe the same tickets. Nothing here is a real person or account.
 */
export type Cover = 'live' | 'sched' | 'ready' | 'needs' | 'off';
export type PlatformKey = 'youtube' | 'tiktok' | 'instagram' | 'bluesky' | 'threads' | 'facebook';
// The app's fixed coverage order (reelay/coverage.py ORDER).
export const PLATFORM_ORDER: PlatformKey[] = ['tiktok', 'instagram', 'youtube', 'facebook', 'threads', 'bluesky'];

export interface DemoCard {
  id: string;
  title: string;
  still: string;
  length: string;
  stage: 'Backlog' | 'Staging' | 'Scheduled' | 'Published';
  coverage: Record<PlatformKey, Cover>;
  /* Where it came from (the logo badge on its cover), and what it is, said in the badge's hover text. */
  source: 'youtube' | 'tiktok' | 'instagram';
  kind: string;
  date: string;
  views: string;
  /* The status line in the app's own words (board_page._status). */
  status: string;
  tone?: 'ready' | 'needs' | 'sched' | 'live' | 'muted';
}

const c = (yt: Cover, tt: Cover, ig: Cover, bs: Cover, th: Cover, fb: Cover) =>
  ({ youtube: yt, tiktok: tt, instagram: ig, bluesky: bs, threads: th, facebook: fb });

export const CREATOR = { name: 'Juniper Lane', initials: 'JL', handle: '@juniperlane', tagline: 'Travel, slowly' };

export const DEMO_CARDS: DemoCard[] = [
  { id: 'v1', source: 'tiktok', title: 'Three knife skills that changed my cooking', still: 'kitchen', length: '0:48', stage: 'Backlog', kind: 'Short · 1080p', date: 'Sep 28', views: '8.1K', coverage: c('off', 'off', 'off', 'off', 'off', 'off'), status: '✓ Ready · not started', tone: 'muted' },
  { id: 'v2', source: 'instagram', title: 'Leg day, no excuses', still: 'gym', length: '0:31', stage: 'Backlog', kind: 'Short · 1080p', date: 'Sep 30', views: '5.6K', coverage: c('needs', 'ready', 'off', 'off', 'off', 'off'), status: '⚠ Needs work: YouTube', tone: 'needs' },
  { id: 'v3', source: 'tiktok', title: 'Golden hour at Big Sur', still: 'dusk', length: '0:22', stage: 'Staging', kind: 'Short · 1080p', date: 'Oct 2', views: '12.4K', coverage: c('ready', 'ready', 'ready', 'off', 'ready', 'off'), status: '✓ Ready · Juniper Lane', tone: 'ready' },
  { id: 'v4', source: 'tiktok', title: 'Tokyo after midnight', still: 'neon', length: '0:57', stage: 'Staging', kind: 'Short · 1080p', date: 'Oct 4', views: '21K', coverage: c('ready', 'ready', 'needs', 'off', 'off', 'off'), status: '⚠ Needs work: Instagram', tone: 'needs' },
  { id: 'v5', source: 'youtube', title: 'Desert road trip, day four', still: 'desert', length: '0:39', stage: 'Scheduled', kind: 'Short · 1080p', date: 'Oct 6', views: '9.3K', coverage: c('sched', 'ready', 'ready', 'off', 'sched', 'off'), status: '2 scheduled · 2 ready', tone: 'sched' },
  { id: 'v6', source: 'instagram', title: 'First snow in the Alps', still: 'snow', length: '0:18', stage: 'Scheduled', kind: 'Short · 1080p', date: 'Oct 8', views: '4.2K', coverage: c('sched', 'off', 'off', 'off', 'off', 'off'), status: 'Goes live Thu 6:30 PM', tone: 'sched' },
  { id: 'v7', source: 'tiktok', title: 'Surf check at dawn', still: 'ocean', length: '0:26', stage: 'Published', kind: 'Short · 1080p', date: 'Sep 21', views: '38K', coverage: c('live', 'live', 'live', 'off', 'live', 'off'), status: '✓ Live on all 4', tone: 'live' },
  { id: 'v8', source: 'youtube', title: 'Sixty seconds of forest', still: 'forest', length: '1:00', stage: 'Published', kind: 'Short · 1080p', date: 'Sep 17', views: '15K', coverage: c('live', 'live', 'off', 'off', 'off', 'off'), status: '✓ Live on all 2', tone: 'live' },
];

/* The ticket the inspector shows open. */
export const OPEN_TICKET = {
  card: DEMO_CARDS[2],
  caption:
    'The last ten minutes of light on the Big Sur coast. Shot handheld from the turnout at mile 45. #bigsur #goldenhour #roadtrip',
  transcript: [
    { t: '0:02', text: 'Okay, we made it with about ten minutes of light left.' },
    { t: '0:09', text: 'This turnout is the one everybody drives past.' },
    { t: '0:15', text: 'Look at the water, it is completely gold right now.' },
  ],
};
