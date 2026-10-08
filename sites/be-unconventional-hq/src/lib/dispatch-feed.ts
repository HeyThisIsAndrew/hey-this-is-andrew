/**
 * THE HQ DISPATCH feed: what /dispatch.xml carries and which images the
 * newsletter needs (issue #266). The route (src/pages/dispatch.xml.ts) and
 * the image sync (scripts/sync-dispatch-images.mjs) both select through
 * selectDispatchEntries(), so the sync always builds images for exactly the
 * stories the feed will list.
 *
 * Plain module, no JSON imports, so it runs under `node` in
 * scripts/dispatch-feed.test.mjs. Callers hand it the data.
 *
 * ─── WHY A SECOND FEED ────────────────────────────────────────────────────
 * /rss.xml is the Google News feed (see the note at the top of that route).
 * It lists articles only, with no image and no category, and it is not to be
 * reshaped for an email. Kit, which sends the newsletter, reads THIS one.
 *
 * ─── WHAT KIT NEEDS FROM AN ITEM ──────────────────────────────────────────
 * Kit's RSS Liquid exposes title, url, summary, categories and content, and
 * has NO image variable. So the image is the FIRST element of
 * content:encoded, and the Kit Post Template
 * (email/hq-dispatch/post-template.liquid.html) reads the first `src="`.
 * Categories are [content type, section]: "Review", "TV" renders REVIEW | TV,
 * and a "Video" type turns the button into Watch now.
 *
 * ─── IMAGES ARE NEVER CUT OFF ─────────────────────────────────────────────
 * The owner's rule. An item's image is the committed 1200x675 JPEG the sync
 * composed (the whole picture fitted inside a 16:9 frame over a blurred copy
 * of itself), never the raw source: a raw one could be any shape, and the
 * email's 16:9 box would have to crop or distort it. An item whose image was
 * not built yet gets the branded fallback (DISPATCH_FALLBACK_IMAGE), so the
 * FEATURED box always opens on a full-width image.
 */
import { articlePath } from '../data/sections.js';
import { editorialPreview } from './editorial-text.ts';

/** How many stories the feed lists. Kit takes the ones new since its last
 *  send; twenty covers a week of articles and videos with room to spare. */
export const DISPATCH_FEED_LIMIT = 20;

/** Every newsletter image is this size: 16:9, 2x the email's 550px box. */
export const DISPATCH_IMAGE_WIDTH = 1200;
export const DISPATCH_IMAGE_HEIGHT = 675;

/** Where the composed images are served from, under public/. */
export const DISPATCH_IMAGE_PUBLIC_PATH = '/dispatch/images';

/** The masthead (3:1), and the 16:9 art a story gets when it has none of its
 *  own. Both built by scripts/build-dispatch-art.mjs and committed. */
export const DISPATCH_HEADER_IMAGE = '/dispatch/header-1200x400.png';
export const DISPATCH_FALLBACK_IMAGE = '/dispatch/fallback-1200x675.jpg';

/** Section names that say nothing, so the label shows the type alone. */
const NON_SECTIONS = new Set(['', 'general']);

export interface DispatchArticleInput {
  slug: string;
  title: string;
  isoDate: string;
  excerpt?: string;
  preview?: string[];
  image?: string;
  category?: string;
  contentType?: string;
  editorial?: unknown;
}

export interface DispatchVideoInput {
  title: string;
  link: string;
  youtubeId?: string;
  publishedAt?: string;
  description?: string;
  thumbnail?: string;
  category?: string;
  isShort?: boolean;
  isLive?: boolean;
  editorial?: unknown;
}

export interface DispatchEntry {
  kind: 'article' | 'video';
  title: string;
  /** Absolute URL. */
  link: string;
  /** Plain-text summary. */
  summary: string;
  pubDate: Date;
  /** [content type, section?] */
  categories: string[];
  /** The ORIGINAL image URL. The sync composes it; the feed looks it up. */
  imageSource: string | null;
}

/** One manifest entry, keyed by the source URL. */
export interface DispatchImage {
  src: string;
  width: number;
  height: number;
}
export type DispatchImageManifest = Record<string, DispatchImage>;

/**
 * Is this raw videos.json doc a long-form, published video? The same test
 * getVideosUnified() (src/lib/videos-source.ts) applies, restated here because
 * that module imports the JSON store and the sync runs under plain node.
 * Shorts and live streams are left out, as on the event coverage pages.
 */
export function isDispatchVideoDoc(doc: any): boolean {
  const type = doc?.manualTypeOverride || doc?._type;
  if (type !== 'video') return false;
  if (doc.contentStatus && doc.contentStatus !== 'published') return false;
  return Boolean(doc.youtubeId && doc.title && !doc.isShort && !doc.isLive);
}

function section(category: unknown): string | null {
  const s = String(category ?? '').trim();
  return NON_SECTIONS.has(s.toLowerCase()) ? null : s;
}

function validDate(value: unknown): Date | null {
  const d = new Date(String(value ?? ''));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Absolute site URL, with a slash-free canonical path (see rss.xml.ts). */
function absolute(siteUrl: string, pathname: string): string {
  return new URL(pathname, siteUrl).toString().replace(/\/$/, '');
}

export function articleEntry(article: DispatchArticleInput, siteUrl: string): DispatchEntry | null {
  const pubDate = validDate(article.isoDate);
  if (!article.slug || !article.title || !pubDate) return null;
  const type = String(article.contentType ?? '').trim() || 'Story';
  return {
    kind: 'article',
    title: article.title,
    /* Never hand-build this path: articlePath() is the one place that knows
       where an article lives. */
    link: absolute(siteUrl, articlePath(article.slug)),
    summary: editorialPreview(article),
    pubDate,
    categories: [type, section(article.category)].filter(Boolean) as string[],
    imageSource: article.image ? String(article.image) : null,
  };
}

export function videoEntry(video: DispatchVideoInput): DispatchEntry | null {
  const pubDate = validDate(video.publishedAt);
  if (!video.title || !video.link || !pubDate || video.isShort || video.isLive) return null;
  return {
    kind: 'video',
    title: video.title,
    /* The watch page. There is no per-video page on the site; the reader
       asked to watch, and YouTube is where the video plays. */
    link: video.link,
    summary: editorialPreview(video),
    pubDate,
    categories: ['Video', section(video.category)].filter(Boolean) as string[],
    imageSource: video.thumbnail ? String(video.thumbnail) : null,
  };
}

/**
 * The stories the newsletter feed lists: articles and long-form videos
 * together, newest first, capped at `limit`. Kit makes the first new one
 * FEATURED. Ties break on title so two builds never disagree.
 */
export function selectDispatchEntries(
  articles: readonly DispatchArticleInput[],
  videos: readonly DispatchVideoInput[],
  siteUrl: string,
  limit: number = DISPATCH_FEED_LIMIT,
): DispatchEntry[] {
  const entries = [
    ...articles.map((a) => articleEntry(a, siteUrl)),
    ...videos.map((v) => videoEntry(v)),
  ].filter((e): e is DispatchEntry => e !== null);
  entries.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime() || a.title.localeCompare(b.title));
  return entries.slice(0, limit);
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The image for an entry, as an absolute URL: its composed art, or the
 * branded fallback when it has none built yet. NEVER null, so every box,
 * the FEATURED one above all, opens on a full-width 16:9 image (owner's
 * call). Never the raw source either: see the header.
 */
export function dispatchImageUrl(
  entry: DispatchEntry,
  manifest: DispatchImageManifest,
  siteUrl: string,
): string {
  const image = entry.imageSource ? manifest[entry.imageSource] : undefined;
  const built =
    image?.src && image.width === DISPATCH_IMAGE_WIDTH && image.height === DISPATCH_IMAGE_HEIGHT;
  return absolute(siteUrl, built ? image.src : DISPATCH_FALLBACK_IMAGE);
}

/**
 * content:encoded for one item. The image MUST come first: it is the only way
 * Kit's Post Template can find it (see the header).
 */
export function dispatchContentHtml(entry: DispatchEntry, imageUrl: string): string {
  const img = `<img src="${escapeHtml(imageUrl)}" width="${DISPATCH_IMAGE_WIDTH}" height="${DISPATCH_IMAGE_HEIGHT}" alt="">`;
  const summary = entry.summary ? `<p>${escapeHtml(entry.summary)}</p>` : '';
  return img + summary;
}
