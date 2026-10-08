/**
 * Twitch platform adapter (Epic #26) — same isomorphic pattern as youtube.ts:
 * credentials injected, fetch injectable, zero module-level I/O, so it
 * unit-tests offline and runs identically in Node scripts and the edge worker.
 *
 * Auth model: Twitch's Helix API requires an app access token (client
 * credentials grant). The client fetches one lazily and reuses it until close
 * to expiry — callers never see token plumbing.
 *
 * Quota: Helix rate limits are generous (800 req/min bucket) — unlike
 * YouTube's search.list there is no scarce-unit economics here; the CDN cache
 * in front of /api/live-status.json is still the effective rate limiter.
 */

const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const HELIX_BASE = 'https://api.twitch.tv/helix';
/** Refresh this many seconds before the token actually expires. */
const TOKEN_EXPIRY_MARGIN_S = 60;

export interface TwitchClientOptions {
  clientId: string;
  clientSecret: string;
  /** Injectable fetch — stubbed in tests, native elsewhere. */
  fetchImpl?: typeof fetch;
  /** Injectable clock (ms) for token-expiry tests. */
  nowImpl?: () => number;
}

export interface TwitchLiveStatus {
  isLive: boolean;
  /** Helix stream id (platform-native id for the live session). */
  streamId: string | null;
  title?: string;
}

export class TwitchApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'TwitchApiError';
    this.status = status;
  }
}

export function createTwitchClient({
  clientId,
  clientSecret,
  fetchImpl = fetch,
  nowImpl = Date.now,
}: TwitchClientOptions) {
  let token: string | null = null;
  let tokenExpiresAt = 0; // epoch ms

  async function getToken(): Promise<string> {
    if (token && nowImpl() < tokenExpiresAt) return token;
    const res = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
      }).toString(),
    });
    if (!res.ok) {
      throw new TwitchApiError(`Twitch token request failed (${res.status})`, res.status);
    }
    let data: any;
    try {
      data = await res.json();
    } catch (err) {
      throw new TwitchApiError('Twitch token response JSON parse failed', 500);
    }
    token = data.access_token;
    tokenExpiresAt = nowImpl() + Math.max(0, (data.expires_in ?? 0) - TOKEN_EXPIRY_MARGIN_S) * 1000;
    if (!token) throw new TwitchApiError('Twitch token response missing access_token', 500);
    return token;
  }

  async function helixGet(path: string, params: Record<string, string>): Promise<any> {
    const url = new URL(`${HELIX_BASE}/${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetchImpl(url.toString(), {
      headers: { 'Client-ID': clientId, Authorization: `Bearer ${await getToken()}` },
    });
    if (!res.ok) {
      throw new TwitchApiError(`Twitch API error on ${path} (${res.status})`, res.status);
    }
    try {
      return await res.json();
    } catch (err) {
      throw new TwitchApiError(`Twitch API JSON parse error on ${path}`, 500);
    }
  }

  return {
    /**
     * Is this channel live right now? Helix /streams returns the stream object
     * while live and an empty data array while offline — no scarce quota.
     */
    async getLiveStatus(userLogin: string): Promise<TwitchLiveStatus> {
      const data = await helixGet('streams', { user_login: userLogin });
      const stream = data.data?.[0];
      if (stream && stream.type === 'live') {
        return { isLive: true, streamId: stream.id, title: stream.title };
      }
      return { isLive: false, streamId: null };
    },
  };
}

export type TwitchClient = ReturnType<typeof createTwitchClient>;
