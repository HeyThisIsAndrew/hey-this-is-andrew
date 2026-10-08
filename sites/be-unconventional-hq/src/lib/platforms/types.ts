/**
 * Platform-agnostic concepts shared across creator platforms.
 *
 * Architecture intent (per the #21 roadmap):
 *
 *     Platform APIs → platform adapters → unified analytics layer → Media Kit
 *
 * YouTube is a CONTENT source: its rich per-video model (YouTubeVideo) is
 * deliberately platform-specific and lives in ./youtube.ts, because only
 * YouTube feeds videos into Sanity. Instagram and TikTok will be
 * ANALYTICS-only — they never become CMS content sources.
 *
 * The one thing every platform DOES share is account-level stats. Each future
 * adapter (youtube.ts, instagram.ts, tiktok.ts) exposes a `getChannelStats()`
 * that returns the SAME normalized `ChannelStats` shape below, so the eventual
 * unified analytics layer and the Media Kit consume every platform through one
 * interface instead of N bespoke ones. This file is intentionally tiny — we are
 * establishing the seam, not building the multi-platform system yet.
 */

export type PlatformName = 'youtube' | 'instagram' | 'tiktok' | 'twitch';

/**
 * Normalized cross-platform account stats. Field names are the shared concept,
 * not the platform's wording (e.g. YouTube "subscribers" and TikTok/Instagram
 * "followers" both map to `followers`).
 */
export interface ChannelStats {
  platform: PlatformName;
  /** Subscribers (YouTube) / followers (Instagram, TikTok). */
  followers: number;
  /** Lifetime views, where the platform exposes it (YouTube does). */
  totalViews?: number;
  /** Count of published items (videos), where available. */
  itemCount?: number;
  /** ISO-8601 timestamp of when these numbers were fetched. */
  fetchedAt: string;
}
