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
  status: string;
  tone?: 'ready' | 'needs' | 'sched' | 'live' | 'muted';
}

const c = (yt: Cover, tt: Cover, ig: Cover, bs: Cover, th: Cover, fb: Cover) =>
  ({ youtube: yt, tiktok: tt, instagram: ig, bluesky: bs, threads: th, facebook: fb });

export const CREATOR = { name: 'Juniper Lane', initials: 'JL', handle: '@juniperlane' };

export const DEMO_CARDS: DemoCard[] = [
  { id: 'v1', title: 'Three knife skills that changed my cooking', still: 'kitchen', length: '0:48', stage: 'Backlog', coverage: c('needs', 'needs', 'needs', 'off', 'off', 'off'), status: 'Needs copy for 3 platforms', tone: 'needs' },
  { id: 'v2', title: 'Leg day, no excuses', still: 'gym', length: '0:31', stage: 'Backlog', coverage: c('needs', 'ready', 'needs', 'off', 'off', 'off'), status: 'Needs work: YouTube title', tone: 'needs' },
  { id: 'v3', title: 'Golden hour at Big Sur', still: 'dusk', length: '0:22', stage: 'Staging', coverage: c('ready', 'ready', 'ready', 'off', 'ready', 'off'), status: 'Ready for 4 platforms', tone: 'ready' },
  { id: 'v4', title: 'Tokyo after midnight', still: 'neon', length: '0:57', stage: 'Staging', coverage: c('ready', 'ready', 'needs', 'off', 'off', 'off'), status: 'Needs work: Instagram caption', tone: 'needs' },
  { id: 'v5', title: 'Desert road trip, day four', still: 'desert', length: '0:39', stage: 'Scheduled', coverage: c('sched', 'ready', 'ready', 'off', 'sched', 'off'), status: 'YouTube · Tue 9:00 AM', tone: 'sched' },
  { id: 'v6', title: 'First snow in the Alps', still: 'snow', length: '0:18', stage: 'Scheduled', coverage: c('sched', 'sched', 'sched', 'off', 'off', 'off'), status: 'All going platforms scheduled', tone: 'sched' },
  { id: 'v7', title: 'Surf check at dawn', still: 'ocean', length: '0:26', stage: 'Published', coverage: c('live', 'live', 'live', 'off', 'live', 'off'), status: 'Live on 4 platforms', tone: 'live' },
  { id: 'v8', title: 'Sixty seconds of forest', still: 'forest', length: '1:00', stage: 'Published', coverage: c('live', 'live', 'off', 'off', 'off', 'off'), status: 'Live on 2 platforms', tone: 'live' },
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
