import rawSnapshot from '../data/social-latest.json';

export interface SocialLatestItem {
  title: string | null;
  url: string | null;
  published_at: string | null;
  views: number | null;
}

export interface SocialPlatformSnapshot {
  handle: string | null;
  followers: number | null;
  views_28d: number | null;
  watch_hours_12mo: number | null;
  latest: SocialLatestItem[];
}

export type SocialPlatformKey = 'youtube' | 'instagram' | 'tiktok' | 'facebook';

export interface SocialLatestSnapshot {
  site: string;
  updated_at: string;
  platforms: Record<SocialPlatformKey, SocialPlatformSnapshot | null>;
}

export const SOCIAL_LATEST_STALE_DAYS = 7;

export function getSocialLatest(): SocialLatestSnapshot {
  return rawSnapshot as SocialLatestSnapshot;
}

export function isSocialSnapshotStale(
  snapshot: Pick<SocialLatestSnapshot, 'updated_at'>,
  now: Date = new Date(),
  staleDays: number = SOCIAL_LATEST_STALE_DAYS,
): boolean {
  const updatedMs = Date.parse(snapshot.updated_at);
  if (!Number.isFinite(updatedMs)) return true;
  const ageMs = now.getTime() - updatedMs;
  return ageMs > staleDays * 24 * 60 * 60 * 1000;
}
