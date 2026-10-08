/**
 * Multi-provider live-stream detection (issue #20 foundation).
 *
 * Architecture:
 *
 *     platform adapters (youtube.ts, twitch.ts…)     ← platform-specific API calls
 *         └── LiveStatusProvider (this file)         ← one tiny common interface
 *                 └── checkLiveStatus()              ← aggregation + error isolation
 *                         └── /api/live-status.json  ← edge endpoint + cache policy
 *                                 └── Takeover Billboard (frontend consumer)
 *
 * Design rules:
 *  - Providers NEVER share failure: one platform erroring (quota, outage, bad
 *    key) must not stop another from reporting live. checkLiveStatus isolates
 *    every provider behind allSettled and reports failures as data.
 *  - This module is isomorphic and credential-free: keys are injected by the
 *    caller (the endpoint reads them from the runtime env), so it unit-tests
 *    offline with a stubbed fetch, same as the platform adapters.
 *  - Adding Twitch later = write createTwitchLiveProvider() wrapping a
 *    platforms/twitch.ts adapter, append it to the providers array in the
 *    endpoint. Nothing else changes.
 */
import type { PlatformName } from './platforms/types';
import type { YouTubeClient } from './platforms/youtube';
import type { TwitchClient } from './platforms/twitch';

/** One live stream, normalized across platforms. */
export interface LiveStreamInfo {
  platform: PlatformName;
  /** Platform-native id (YouTube videoId, Twitch stream id…). */
  videoId: string;
  title?: string;
  /** Direct watch URL, ready for the frontend to link/embed. */
  url: string;
}

/** A provider failure, reported as data instead of thrown. */
export interface LiveStatusError {
  platform: PlatformName;
  message: string;
}

/** The aggregate answer the endpoint returns. */
export interface LiveStatusResult {
  isLive: boolean;
  /** Every live stream found (usually 0 or 1; multi-platform simulcasts = 2+). */
  streams: LiveStreamInfo[];
  errors: LiveStatusError[];
  /** ISO-8601 — lets consumers show "as of" and reason about cache age. */
  checkedAt: string;
}

/** The one seam a platform must implement to participate in live detection. */
export interface LiveStatusProvider {
  platform: PlatformName;
  /** Resolve the platform's current live stream, or null when offline. */
  check(): Promise<LiveStreamInfo | null>;
}

export interface YouTubeLiveProviderOptions {
  /**
   * An already-constructed YouTube client (or anything satisfying its
   * getLiveStatus). Injected rather than built here so this module has zero
   * runtime coupling to the adapter — the endpoint composes the real client,
   * tests pass a stub.
   */
  client: Pick<YouTubeClient, 'getLiveStatus'>;
  channelId: string;
}

/**
 * YouTube provider — wraps the platform adapter's getLiveStatus().
 * ⚠️ QUOTA: the underlying search.list call costs 100 units (10k/day free
 * tier ≈ 100 checks/day). The caller owns caching; see the endpoint's
 * Cache-Control policy and scripts/live-status.md for the math.
 */
export function createYouTubeLiveProvider({
  client,
  channelId,
}: YouTubeLiveProviderOptions): LiveStatusProvider {
  return {
    platform: 'youtube',
    async check() {
      const status = await client.getLiveStatus(channelId);
      if (!status.isLive || !status.videoId) return null;
      return {
        platform: 'youtube',
        videoId: status.videoId,
        title: status.title,
        url: `https://www.youtube.com/watch?v=${status.videoId}`,
      };
    },
  };
}

export interface TwitchLiveProviderOptions {
  /** An already-constructed Twitch client (or a stub with getLiveStatus). */
  client: Pick<TwitchClient, 'getLiveStatus'>;
  /** The channel's login name, e.g. "beunconventionalhq". */
  channelLogin: string;
}

/**
 * Twitch provider — wraps the Twitch adapter's getLiveStatus(). No scarce
 * quota here (Helix limits are per-minute buckets); the endpoint's CDN cache
 * is still the effective rate limiter.
 */
export function createTwitchLiveProvider({
  client,
  channelLogin,
}: TwitchLiveProviderOptions): LiveStatusProvider {
  return {
    platform: 'twitch',
    async check() {
      const status = await client.getLiveStatus(channelLogin);
      if (!status.isLive || !status.streamId) return null;
      return {
        platform: 'twitch',
        videoId: status.streamId,
        title: status.title,
        url: `https://www.twitch.tv/${channelLogin}`,
      };
    },
  };
}

/**
 * Query every provider in parallel and merge. A provider that rejects becomes
 * an errors[] entry; it can never mask another provider's live signal.
 */
export async function checkLiveStatus(
  providers: LiveStatusProvider[],
): Promise<LiveStatusResult> {
  const settled = await Promise.allSettled(providers.map((p) => p.check()));

  const streams: LiveStreamInfo[] = [];
  const errors: LiveStatusError[] = [];

  settled.forEach((outcome, i) => {
    if (outcome.status === 'fulfilled') {
      if (outcome.value) streams.push(outcome.value);
    } else {
      errors.push({
        platform: providers[i].platform,
        message:
          outcome.reason instanceof Error
            ? outcome.reason.message
            : String(outcome.reason),
      });
    }
  });

  return {
    isLive: streams.length > 0,
    streams,
    errors,
    checkedAt: new Date().toISOString(),
  };
}
