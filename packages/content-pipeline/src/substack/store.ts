/**
 * Read-only runtime store wrapper over a committed article snapshot JSON array.
 * Deliberately imports only types from `transform.ts` so `sanitize-html` stays out of SSR bundles.
 */
import type { ArticleRecord } from './transform.ts';

export interface ArticleStoreOptions {
  /** Base route path for the article section, e.g. `'/intel'` or `'/articles'`. */
  basePath: string;
  /** Optional canonical category ordering for `getArticleCategories()`. */
  categories?: string[];
  /** Slugs reserved for sibling route segments (default: `'topic'`, `'page'`). */
  reservedSlugs?: Set<string>;
}

export interface ArticleFeedItem extends ArticleRecord {
  link: string;
  isExternal: boolean;
  type: 'article';
}

export interface ArticleStore {
  RESERVED_SLUGS: Set<string>;
  getAllArticles: () => ArticleRecord[];
  getPublishedArticles: () => ArticleRecord[];
  getArticleBySlug: (slug: string) => ArticleRecord | undefined;
  getArticleCategories: () => string[];
  articleHref: (record: Pick<ArticleRecord, 'hasBody' | 'slug' | 'link'>) => string;
  articlePreview: (record: Pick<ArticleRecord, 'preview' | 'excerpt'>) => string[];
  isExternalArticle: (record: Pick<ArticleRecord, 'hasBody' | 'slug'>) => boolean;
  getNextArticle: (slug: string) => ArticleRecord | undefined;
  getRelatedArticles: (slug: string, category: string, limit?: number) => ArticleRecord[];
  topicPath: (category: string) => string;
  getArticleFeedItems: () => ArticleFeedItem[];
}

function applyEditorial(record: ArticleRecord): ArticleRecord {
  const e = record.editorial;
  if (!e) return record;
  return {
    ...record,
    title: e.title ?? record.title,
    excerpt: e.excerpt ?? record.excerpt,
    image: e.image ?? record.image,
    category: e.category ?? record.category,
    featured: e.featured ?? record.featured,
  };
}

function byDateDesc(a: ArticleRecord, b: ArticleRecord): number {
  const weight = (r: ArticleRecord) => r.editorial?.sortWeight ?? 0;
  if (weight(b) !== weight(a)) return weight(b) - weight(a);
  return new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime();
}

/** Create a site-configured, read-only query API over an imported `articles.json` snapshot. */
export function createArticleStore(
  snapshot: unknown,
  options: ArticleStoreOptions,
): ArticleStore {
  const rawBase = String(options.basePath || '/articles').trim();
  const normalizedBase = rawBase === '/' ? '' : rawBase.replace(/\/+$/, '');
  const articlePath = (slug: string) => `${normalizedBase}/${slug}`;
  const RESERVED_SLUGS = options.reservedSlugs ?? new Set(['topic', 'page']);
  const all: ArticleRecord[] = Array.isArray(snapshot) ? (snapshot as ArticleRecord[]) : [];

  const getAllArticles = (): ArticleRecord[] =>
    all
      .filter((r) => r && !r.editorial?.hidden)
      .map(applyEditorial)
      .sort(byDateDesc);

  const getPublishedArticles = (): ArticleRecord[] =>
    getAllArticles().filter((r) => r.hasBody && r.slug);

  const getArticleBySlug = (slug: string): ArticleRecord | undefined =>
    getPublishedArticles().find((r) => r.slug === slug);

  const getArticleCategories = (): string[] => {
    const present = new Set(getAllArticles().map((r) => r.category).filter(Boolean));
    if (options.categories?.length) {
      return options.categories.filter((c) => present.has(c));
    }
    return [...present];
  };

  const articleHref = (record: Pick<ArticleRecord, 'hasBody' | 'slug' | 'link'>): string =>
    record.hasBody && record.slug ? articlePath(record.slug) : record.link;

  const articlePreview = (record: Pick<ArticleRecord, 'preview' | 'excerpt'>): string[] => {
    const paragraphs = (record.preview ?? []).filter((p) => typeof p === 'string' && p.trim());
    if (paragraphs.length > 0) return paragraphs;
    return record.excerpt ? [record.excerpt] : [];
  };

  const isExternalArticle = (record: Pick<ArticleRecord, 'hasBody' | 'slug'>): boolean =>
    !(record.hasBody && record.slug);

  const getNextArticle = (slug: string): ArticleRecord | undefined => {
    const published = getPublishedArticles();
    if (published.length < 2) return undefined;
    const index = published.findIndex((a) => a.slug === slug);
    if (index === -1) return published[0];
    return published[(index + 1) % published.length];
  };

  const getRelatedArticles = (slug: string, category: string, limit = 4): ArticleRecord[] => {
    const published = getPublishedArticles().filter((a) => a.slug !== slug);
    const sameCategory = published.filter((a) => a.category === category);
    const rest = published.filter((a) => a.category !== category);
    return [...sameCategory, ...rest].slice(0, limit);
  };

  const topicPath = (category: string): string =>
    `${normalizedBase}/topic/${category.toLowerCase()}`;

  const getArticleFeedItems = (): ArticleFeedItem[] =>
    getAllArticles().map((a) => ({
      ...a,
      link: articleHref(a),
      isExternal: isExternalArticle(a),
      type: 'article' as const,
    }));

  return {
    RESERVED_SLUGS,
    getAllArticles,
    getPublishedArticles,
    getArticleBySlug,
    getArticleCategories,
    articleHref,
    articlePreview,
    isExternalArticle,
    getNextArticle,
    getRelatedArticles,
    topicPath,
    getArticleFeedItems,
  };
}
