import { cleanFeedText } from './feed-text.ts';

export const HQ_LATEST_DEV_URL =
  'https://feat-latest-posts-endpoint-beunconventionalhq.heythisisandrewb.workers.dev/api/latest-posts.json';

const rawLatestUrl =
  (typeof process !== 'undefined' && process.env?.HQ_LATEST_URL) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.PUBLIC_HQ_LATEST_URL);

export const HQ_LATEST_URL =
  typeof rawLatestUrl === 'string' && rawLatestUrl.trim()
    ? rawLatestUrl.trim()
    : 'https://beunconventionalhq.com/api/latest-posts.json';
export const HQ_FEED_URL = 'https://beunconventionalhq.com/feed#latest';
export const HQ_SEED_MAX_AGE = 24 * 60 * 60 * 1000;
const HQ_INDEX_URL = 'https://beunconventionalhq.com/api/search-index.json';

interface ImageCandidate {
  src: string;
  width: number;
}

export interface LatestPost {
  id: string;
  kind: 'article' | 'video';
  title: string;
  url: string;
  publishedAt: string;
  image: { src: string; candidates: ImageCandidate[] } | null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function httpsUrl(value: unknown, base?: string): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value, base);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function imageFrom(value: unknown): LatestPost['image'] {
  const image = record(value);
  const src = httpsUrl(image?.src);
  if (!src) return null;
  const candidates: ImageCandidate[] = [];
  if (Array.isArray(image?.candidates)) {
    for (const raw of image.candidates.slice(0, 10)) {
      const candidate = record(raw);
      const candidateSrc = httpsUrl(candidate?.src);
      const width = candidate?.width;
      if (candidateSrc && !/\s/.test(candidateSrc) && typeof width === 'number' &&
        Number.isInteger(width) && width > 0 && width <= 4096 &&
        !candidates.some((item) => item.width === width)) {
        candidates.push({ src: candidateSrc, width });
      }
    }
  }
  return { src, candidates };
}

function postFrom(value: unknown, now: number): LatestPost | null {
  const post = record(value);
  if (!post || (post.kind !== 'article' && post.kind !== 'video')) return null;
  const url = httpsUrl(post.url);
  if (!url || typeof post.id !== 'string' || !post.id.trim() || typeof post.title !== 'string') return null;
  const date = typeof post.publishedAt === 'string' ? post.publishedAt : '';
  const publishedTime = Date.parse(date);
  if (!Number.isFinite(publishedTime) || publishedTime > now + 60_000) return null;
  let title: string;
  try {
    title = cleanFeedText(post.title);
  } catch {
    return null;
  }
  if (!title) return null;
  const publishedAt = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date(publishedTime).toISOString();
  return { id: post.id, kind: post.kind, title, url, publishedAt, image: imageFrom(post.image) };
}

function newestPosts(posts: LatestPost[]): LatestPost[] {
  const ids = new Set<string>();
  const urls = new Set<string>();
  return posts
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .filter((post) => {
      if (ids.has(post.id) || urls.has(post.url)) return false;
      ids.add(post.id);
      urls.add(post.url);
      return true;
    })
    .slice(0, 2);
}

/** A valid empty response is authoritative; malformed responses leave the seed intact. */
export function parseLatestPosts(payload: unknown, now = Date.now()): LatestPost[] | null {
  const manifest = record(payload);
  if (manifest?.version !== 1 || !Array.isArray(manifest.items)) return null;
  const posts = manifest.items.map((item) => postFrom(item, now));
  if (posts.some((post) => post === null)) return null;
  return newestPosts(posts.filter((post) => post !== null));
}

function indexDate(value: unknown): string {
  if (typeof value !== 'string') return '';
  // The public index gives articles a display date and videos an exact timestamp.
  if (!/^[a-z]+ \d{1,2}, \d{4}$/i.test(value)) return value;
  const utcTime = Date.parse(`${value} UTC`);
  return Number.isFinite(utcTime) ? new Date(utcTime).toISOString().slice(0, 10) : '';
}

function parsePublicIndex(payload: unknown, now = Date.now()): LatestPost[] {
  if (!Array.isArray(payload)) return [];
  return newestPosts(payload.flatMap((raw) => {
    const row = record(raw);
    if (!row) return [];
    const url = httpsUrl(row.url, HQ_INDEX_URL);
    if (!url || (row.type === 'article' && ['/intel/page', '/intel/topic'].includes(new URL(url).pathname.replace(/\/$/, '')))) return [];
    const post = postFrom({
      id: row.id,
      kind: row.type,
      title: row.title,
      publishedAt: indexDate(row.date),
      url,
      image: { src: httpsUrl(row.image, HQ_INDEX_URL) },
    }, now);
    return post ? [post] : [];
  }));
}

async function fetchJson(url: string, timeout: number): Promise<unknown> {
  try {
    const response = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(timeout) });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

export async function fetchLiveLatestPosts(url = HQ_LATEST_URL): Promise<LatestPost[] | null> {
  const primary = parseLatestPosts(await fetchJson(url, 4000));
  if (primary) return primary;
  if (url !== HQ_LATEST_DEV_URL) {
    return parseLatestPosts(await fetchJson(HQ_LATEST_DEV_URL, 4000));
  }
  return null;
}

/** The live search index bridges builds until the publisher's compact endpoint is deployed. */
export async function getLatestPostsForBuild(): Promise<LatestPost[]> {
  return await fetchLiveLatestPosts() ?? parsePublicIndex(await fetchJson(HQ_INDEX_URL, 3000));
}

export function postImageSrcset(post: LatestPost): string {
  return post.image?.candidates.map(({ src, width }) => `${src} ${width}w`).join(', ') ?? '';
}
