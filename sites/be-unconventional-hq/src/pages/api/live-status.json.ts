/**
 * GET /api/live-status.json — is the channel live right now? (issue #20)
 *
 * Runs on-demand at the Cloudflare edge (prerender=false; in Astro 5+ the old
 * `output: 'hybrid'` mode is folded into 'static' + per-route opt-out, so no
 * global config change is needed). The static site stays static; only this
 * route executes per-request.
 *
 * Quota protection (the whole game — see scripts/live-status.md):
 * YouTube live detection uses search.list at 100 units/call against a 10,000
 * unit/day free quota → hard ceiling of ~100 checks/day. The CDN is our rate
 * limiter: s-maxage=900 means Cloudflare serves everyone from cache and asks
 * this endpoint at most ~96×/day (9,600 units worst case). Visitors always get
 * an instant cached answer; "going live" appears within ≤15 minutes.
 *
 * Failure posture: this endpoint never 500s for expected conditions. Missing
 * credentials or provider errors return isLive:false with the reason in
 * errors[], so the frontend billboard simply stays dormant.
 */
import type { APIRoute } from 'astro';
// @ts-ignore - virtual module provided by @astrojs/cloudflare (the adapter
// shims it in `astro dev` too). Astro 6 removed Astro.locals.runtime.env —
// accessing it THROWS — so this import is the only supported way to read
// Workers secrets/vars.
import { env as workerEnv } from 'cloudflare:workers';
import {
  checkLiveStatus,
  createYouTubeLiveProvider,
  createTwitchLiveProvider,
  type LiveStatusProvider,
  type LiveStatusResult,
} from '../../lib/live-status';
import { createYouTubeClient } from '../../lib/platforms/youtube';
import { createTwitchClient } from '../../lib/platforms/twitch';

export const prerender = false;

/** BE Unconventional HQ — same channel scripts/sync-youtube.mjs syncs from. */
const DEFAULT_CHANNEL_ID = 'UCXqU6781pQgYXDExLvMw2Og';

function json(body: LiveStatusResult, cacheControl: string): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheControl,
    },
  });
}

export const GET: APIRoute = async () => {

  // Production: secrets live on the Workers env (cloudflare:workers).
  // Local `astro dev`: a plain .env file surfaces via import.meta.env.
  const env = (workerEnv ?? {}) as Record<string, string | undefined>;
  const apiKey = env.YOUTUBE_API_KEY ?? import.meta.env.YOUTUBE_API_KEY;
  const channelId =
    env.YOUTUBE_CHANNEL_ID ?? import.meta.env.YOUTUBE_CHANNEL_ID ?? DEFAULT_CHANNEL_ID;

  if (!apiKey) {
    // Deployed before credentials exist: answer "not live" cheaply and
    // re-check soon, so adding the key later takes effect within a minute.
    return json(
      {
        isLive: false,
        streams: [],
        errors: [{ platform: 'youtube', message: 'not_configured' }],
        checkedAt: new Date().toISOString(),
      },
      'public, max-age=60',
    );
  }

  const providers: LiveStatusProvider[] = [
    createYouTubeLiveProvider({ client: createYouTubeClient({ apiKey }), channelId }),
  ];

  // Twitch joins the check only when its credentials exist — fully inert
  // otherwise. Configure TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET /
  // TWITCH_CHANNEL_LOGIN to activate (see scripts/live-status.md).
  const twitchClientId = env.TWITCH_CLIENT_ID ?? import.meta.env.TWITCH_CLIENT_ID;
  const twitchClientSecret = env.TWITCH_CLIENT_SECRET ?? import.meta.env.TWITCH_CLIENT_SECRET;
  const twitchChannelLogin = env.TWITCH_CHANNEL_LOGIN ?? import.meta.env.TWITCH_CHANNEL_LOGIN;
  if (twitchClientId && twitchClientSecret && twitchChannelLogin) {
    providers.push(
      createTwitchLiveProvider({
        client: createTwitchClient({ clientId: twitchClientId, clientSecret: twitchClientSecret }),
        channelLogin: twitchChannelLogin,
      }),
    );
  }

  const result = await checkLiveStatus(providers);

  // max-age=0: browsers revalidate against the edge (no stale tabs after a
  // stream starts); s-maxage=900: the edge is the quota gate; SWR keeps
  // responses instant while the edge refreshes in the background.
  const finalResponse = json(result, 'public, max-age=0, s-maxage=900, stale-while-revalidate=300');

  return finalResponse;
};
