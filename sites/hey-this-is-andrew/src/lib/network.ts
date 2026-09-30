// THE NETWORK — unified content layer for the Andrew ecosystem.
//
// Principle: Andrew creates something -> a source publishes it ->
// Hey, This Is Andrew pulls it in at build time -> the right part of
// the site surfaces it. Nothing here is hand-duplicated; every remote
// entry comes from a real feed with a graceful fallback.
//
// Content model (kept light on purpose — grow only when a second
// consumer needs the field):
export type NetworkBrandId = 'htia' | 'be' | 'ccc' | 'build';

export const NETWORK_BRANDS: Record<NetworkBrandId, string> = {
  htia: 'Hey, This Is Andrew',
  be: 'BE Unconventional HQ',
  ccc: 'Capture Create Caffeinate',
  build: 'The Build',
};

export type NetworkKind =
  | 'video'
  | 'article'
  | 'note'
  | 'project'
  | 'photos'
  | 'deck'
  | 'product'
  | 'resource'
  | 'milestone';

export const NETWORK_KIND_LABELS: Record<NetworkKind, string> = {
  video: 'Video',
  article: 'Article',
  note: 'Note',
  project: 'Project',
  photos: 'Photos',
  deck: 'Deck',
  product: 'Product',
  resource: 'Resource',
  milestone: 'Milestone',
};

export interface NetworkItem {
  brand: NetworkBrandId;
  kind: NetworkKind;
  title: string;
  excerpt?: string;
  /** ISO date string. */
  date: string;
  url: string;
  image?: string | null;
  /** Opens off-site (new tab, rel=noopener). */
  external?: boolean;
}

// ---- Future content models (architecture only — no UI until real items exist) ----
export interface Product {
  id: string;
  name: string;
  kind: 'preset' | 'guide' | 'template' | 'workflow' | 'resource' | 'course';
  status: 'draft' | 'live';
  blurb: string;
  url?: string;
}

export interface Resource {
  id: string;
  title: string;
  kind: 'deck' | 'template' | 'guide' | 'download';
  url: string;
  note?: string;
}

/** Live products. Empty on purpose: BUILD ONCE, ADD PRODUCTS LATER.
 *  Nothing renders from this until an item has status: 'live'. */
export const PRODUCTS: Product[] = [];

/** Downloadable resources (decks, templates, guides). Same rule. */
export const RESOURCES: Resource[] = [];

import { getLatestVideos, getLatestArticles } from './latest-content';
import { getCollection } from 'astro:content';
import { cleanFeedText } from './feed-text';

// ---- BE Unconventional HQ: build-time RSS ingestion ----
const BE_RSS = 'https://beunconventionalhq.com/rss.xml';

async function fetchText(url: string, timeoutMs = 10000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function rssTag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? m[1].trim() : null;
}



/** og:image from an article page, so BE entries can carry imagery.
 *  Best-effort: null when the page can't be reached. */
async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const html = await fetchText(url, 8000);
    const m =
      html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/) ||
      html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export async function getBEArticles(limit = 3): Promise<NetworkItem[]> {
  try {
    const xml = await fetchText(BE_RSS);
    const raws = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
      .slice(0, limit)
      .map((m) => m[1]);
    const items = await Promise.all(
      raws.map(async (entry) => {
        const title = rssTag(entry, 'title');
        const url = rssTag(entry, 'link');
        const pubDate = rssTag(entry, 'pubDate');
        if (!title || !url) return null;
        const excerpt = rssTag(entry, 'description');
        const image = await fetchOgImage(url);
        return {
          brand: 'be' as NetworkBrandId,
          kind: 'article' as NetworkKind,
          title: cleanFeedText(title),
          excerpt: excerpt ? cleanFeedText(excerpt).slice(0, 160) : undefined,
          date: pubDate ? new Date(pubDate).toISOString() : new Date(0).toISOString(),
          url,
          image,
          external: true,
        } satisfies NetworkItem;
      })
    );
    const live = items.filter((i): i is NetworkItem => i !== null);
    return live.length > 0 ? live : BE_FALLBACKS.slice(0, limit);
  } catch {
    return BE_FALLBACKS.slice(0, limit);
  }
}

// Hardcoded fallbacks: real entries from the live feed (Sept 2026).
// The section never renders empty and the build never breaks on a feed outage.
const BE_FALLBACKS: NetworkItem[] = [
  {
    brand: 'be',
    kind: 'article',
    title: 'L.A. Comic Con 2026',
    excerpt: 'Why Downtown Los Angeles Holds the Blueprint for Convention Culture',
    date: new Date('2026-09-15T16:42:35Z').toISOString(),
    url: 'https://beunconventionalhq.com/intel/la-comic-con-2026',
    image: null,
    external: true,
  },
  {
    brand: 'be',
    kind: 'article',
    title: 'Lanterns | The Grounded Blueprint for James Gunn’s DCU',
    excerpt: 'Halfway through its first season, this detective-driven series proves that restrained power scaling and character-focused storytelling are exactly what the new cinematic universe needs.',
    date: new Date('2026-09-08T19:16:40Z').toISOString(),
    url: 'https://beunconventionalhq.com/intel/lanterns-the-grounded-blueprint-for',
    image: null,
    external: true,
  },
];

// ---- Feed assembly ----
const timeOf = (iso: string): number => {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/** The live activity stream: newest first across every source.
 *  Any source that fails simply contributes nothing. */
export async function getNetworkFeed(limit = 8): Promise<NetworkItem[]> {
  const [videos, articles, beArticles, projects] = await Promise.all([
    getLatestVideos(3).catch(() => []),
    getLatestArticles(3).catch(() => []),
    getBEArticles(3).catch(() => []),
    getCollection('projects').catch(() => []),
  ]);

  const items: NetworkItem[] = [
    ...videos.map(
      (v): NetworkItem => ({
        brand: 'htia',
        kind: 'video',
        title: v.title,
        excerpt: v.description || undefined,
        date: v.date,
        url: v.url,
        image: v.image,
        external: true,
      })
    ),
    ...articles.map(
      (a): NetworkItem => ({
        brand: 'build',
        kind: a.image ? 'article' : 'note',
        title: a.title,
        excerpt: a.subtitle || undefined,
        date: a.date,
        url: a.url,
        image: a.image,
        external: true,
      })
    ),
    ...beArticles,
    ...projects.map(
      (p): NetworkItem => ({
        brand: (p.data.brand as NetworkBrandId | undefined) ?? 'htia',
        kind: 'project',
        title: p.data.title,
        excerpt: p.data.description,
        date:
          p.data.date instanceof Date
            ? p.data.date.toISOString()
            : new Date(p.data.date).toISOString(),
        url: p.data.link ?? '#projects',
        image: p.data.image ?? null,
        external: p.data.link ? true : false,
      })
    ),
  ];

  return items
    .map((i) => ({ ...i, title: cleanFeedText(i.title), excerpt: i.excerpt ? cleanFeedText(i.excerpt) : undefined }))
    .sort((a, b) => timeOf(b.date) - timeOf(a.date))
    .slice(0, limit);
}
