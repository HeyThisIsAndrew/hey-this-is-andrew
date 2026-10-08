/**
 * Read-only access to the durable article snapshot (src/data/articles.json).
 *
 * Statically imported, not fetched, so pages render real content with zero
 * network access — same architecture as videos.json. Refreshing the snapshot
 * is `scripts/sync-articles.mjs`'s job, never a page's.
 *
 * Deliberately does NOT import articles-transform.ts: sanitization happens at
 * sync time and the snapshot stores the result, so `sanitize-html` never
 * reaches the site bundle.
 */
import snapshot from '../data/articles.json';
import { ARTICLE_SECTION, articlePath } from '../data/sections.js';

export interface ArticleRecord {
  guid: string;
  slug: string;
  title: string;
  /** The original Substack permalink. Kept for attribution and JSON-LD sameAs. */
  link: string;
  date: string;
  isoDate: string;
  excerpt: string;
  /**
   * The magazine lede — the article's opening paragraphs, one string each.
   *
   * Optional because snapshots written before this field existed do not carry
   * it; every consumer falls back to `excerpt`. Built by buildPreview() in
   * articles-transform.ts, which explains why it is separate from `excerpt`.
   */
  preview?: string[];
  image: string;
  category: string;
  /** What KIND of piece — Review, Analysis, Dispatch… (see articles-transform). */
  contentType?: string;
  /** Out-of-N score for reviews that state one. */
  score?: { value: number; best: number } | null;
  tags: string[];
  bodyHtml: string;
  /** False when the feed gave us no usable body — see articleHref(). */
  hasBody: boolean;
  firstSeen?: string;
  lastUpdated?: string;
  /** Optional human overrides, preserved across syncs. */
  editorial?: {
    title?: string;
    excerpt?: string;
    image?: string;
    category?: string;
    featured?: boolean;
    hidden?: boolean;
    sortWeight?: number;
  };
}

const ALL: ArticleRecord[] = Array.isArray(snapshot) ? (snapshot as ArticleRecord[]) : [];

/** Editorial overrides win over feed-derived values. A missing override is normal. */
function applyEditorial(record: ArticleRecord): ArticleRecord {
  const e = record.editorial;
  if (!e) return record;
  return {
    ...record,
    title: e.title ?? record.title,
    excerpt: e.excerpt ?? record.excerpt,
    image: e.image ?? record.image,
    category: e.category ?? record.category,
  };
}

function byDateDesc(a: ArticleRecord, b: ArticleRecord) {
  const weight = (r: ArticleRecord) => r.editorial?.sortWeight ?? 0;
  if (weight(b) !== weight(a)) return weight(b) - weight(a);
  return new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime();
}

/** Every non-hidden article, newest first. Includes ones with no local page. */
export function getAllArticles(): ArticleRecord[] {
  return ALL.filter((r) => r && !r.editorial?.hidden)
    .map(applyEditorial)
    .sort(byDateDesc);
}

/**
 * Articles that have a full body and therefore get a page on this site.
 *
 * A record without a body still exists and still appears in the Feed — it just
 * keeps pointing at Substack rather than producing a thin local page that
 * would read as broken and rank as duplicate content.
 */
export function getPublishedArticles(): ArticleRecord[] {
  return getAllArticles().filter((r) => r.hasBody && r.slug);
}

export function getArticleBySlug(slug: string): ArticleRecord | undefined {
  return getPublishedArticles().find((r) => r.slug === slug);
}

/** Distinct categories present in the archive, in the site's canonical order. */
export function getArticleCategories(): string[] {
  const present = new Set(getAllArticles().map((r) => r.category).filter(Boolean));
  return ['Film', 'TV', 'Games', 'Events', 'General'].filter((c) => present.has(c));
}

/**
 * Where an article card should link.
 *
 * THE integration point for this epic: an article we host resolves to its own
 * BUHQ page; one we don't yet have a body for still resolves to Substack, so
 * no link is ever dead. Feed cards, the section index and any future surface
 * all call this rather than deciding for themselves.
 */
export function articleHref(record: Pick<ArticleRecord, 'hasBody' | 'slug' | 'link'>): string {
  return record.hasBody && record.slug ? articlePath(record.slug) : record.link;
}

/**
 * The paragraphs to show in the magazine's centre feature.
 *
 * Call this rather than reading `record.preview` directly. Two reasons:
 *   1. `preview` is optional — snapshots written before the field existed do
 *      not have it, and neither does a record whose body never arrived.
 *   2. The fallback should be the same everywhere. One article rendering a
 *      single stubby line while the rest render four paragraphs is exactly the
 *      inconsistency this helper prevents.
 */
export function articlePreview(
  record: Pick<ArticleRecord, 'preview' | 'excerpt'>,
): string[] {
  const paragraphs = (record.preview ?? []).filter((p) => typeof p === 'string' && p.trim());
  if (paragraphs.length > 0) return paragraphs;
  return record.excerpt ? [record.excerpt] : [];
}

/** True when the href leaves the site, so callers know to add target/rel. */
export function isExternalArticle(record: Pick<ArticleRecord, 'hasBody' | 'slug'>): boolean {
  return !(record.hasBody && record.slug);
}

/**
 * The next article to read after this one.
 *
 * Returns the next-older published article, wrapping to the newest at the end
 * of the archive so the reader is never handed a dead end.
 */
export function getNextArticle(slug: string): ArticleRecord | undefined {
  const published = getPublishedArticles();
  if (published.length < 2) return undefined;
  const index = published.findIndex((a) => a.slug === slug);
  if (index === -1) return published[0];
  return published[(index + 1) % published.length];
}

/**
 * Other articles worth surfacing beside this one.
 *
 * Prefers the same category (a Film reader most likely wants more Film), then
 * tops up with the newest from anywhere so the rail is never half empty.
 */
export function getRelatedArticles(slug: string, category: string, limit = 4): ArticleRecord[] {
  const published = getPublishedArticles().filter((a) => a.slug !== slug);
  const sameCategory = published.filter((a) => a.category === category);
  const rest = published.filter((a) => a.category !== category);
  return [...sameCategory, ...rest].slice(0, limit);
}

/**
 * Category page path.
 *
 * Nested under `/topic/` so a category can never be confused with an article
 * slug — `/intel/<slug>` is the article route, and a post slugged "film"
 * would otherwise collide with the Film category page.
 */
export function topicPath(category: string): string {
  return `${ARTICLE_SECTION.path}/topic/${category.toLowerCase()}`;
}

/** Slugs that must never be used by an article, because a route already owns them. */
export const RESERVED_SLUGS = new Set(['topic', 'page']);

/**
 * Articles shaped as Feed items, with links already resolved.
 * Shared by the section index, its category pages, and the main Feed so all
 * three agree on where a given article lives.
 */
export function getArticleFeedItems(): Array<ArticleRecord & { link: string; isExternal: boolean; type: 'article' }> {
  return getAllArticles().map((a) => ({
    ...a,
    link: articleHref(a),
    isExternal: isExternalArticle(a),
    type: 'article' as const,
  }));
}
