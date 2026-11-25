import rawSnapshot from '../data/social-latest.json';

export interface SocialLatestItem {
  id: string;
  title: string | null;
  published_at: string | null;
  url: string | null;
  thumbnail: string | null;
  views: number | null;
}

export interface SocialYouTubeTotals {
  subscribers: number | null;
  total_views: number | null;
  videos: number | null;
  watch_hours_12mo: number | null;
  views_28d: number | null;
}

export interface SocialInstagramTotals {
  followers: number | null;
  posts: number | null;
}

export interface SocialFacebookTotals {
  followers: number | null;
}

export interface SocialTikTokTotals {
  followers: number | null;
  posts: number | null;
}

export interface SocialLatestSnapshot {
  brand: string;
  generated_at: string;
  totals: {
    youtube: SocialYouTubeTotals | null;
    instagram: SocialInstagramTotals | null;
    facebook: SocialFacebookTotals | null;
    tiktok: SocialTikTokTotals | null;
  };
  latest: {
    youtube: SocialLatestItem[];
    youtube_shorts: SocialLatestItem[];
    instagram_reels: SocialLatestItem[];
    facebook: SocialLatestItem[];
    tiktok: SocialLatestItem[];
  };
}

export const SOCIAL_LATEST_STALE_DAYS = 7;

export function getSocialLatest(): SocialLatestSnapshot {
  return rawSnapshot as SocialLatestSnapshot;
}

/**
 * Resolve a snapshot thumbnail for the current deploy.
 * Absolute https URLs (YouTube) pass through. Cached `/social-thumbs/...` paths get the site base
 * prefixed, so they work on Cloudflare Workers (base `/`) and GitHub Pages (base `/hey-this-is-andrew/`).
 */
export function resolveSocialThumbnailUrl(
  thumbnail: string | null,
  baseUrl: string = import.meta.env?.BASE_URL ?? '/',
): string | null {
  if (!thumbnail) return null;
  if (/^https?:\/\//i.test(thumbnail)) return thumbnail;
  const base = baseUrl.replace(/\/$/, '');
  return `${base}${thumbnail.startsWith('/') ? '' : '/'}${thumbnail}`;
}

export function isSocialSnapshotStale(
  snapshot: Pick<SocialLatestSnapshot, 'generated_at'>,
  now: Date = new Date(),
  staleDays: number = SOCIAL_LATEST_STALE_DAYS,
): boolean {
  const updatedMs = Date.parse(snapshot.generated_at);
  if (!Number.isFinite(updatedMs)) return true;
  const ageMs = now.getTime() - updatedMs;
  return ageMs > staleDays * 24 * 60 * 60 * 1000;
}
