import {
  buildToc,
  createArticleStore,
  labelImageLinks,
  lookupRendition,
  parseImageDimensions,
  rewriteBodyImages,
  stripCoverImageFromBody,
  type ArticleImageManifest,
  type ArticleImageRendition,
  type ArticleRecord,
  type TocEntry,
} from '@andrew/content-pipeline';
import type { ArticleCardItem } from '@andrew/ui/types';
import articlesSnapshot from '../data/articles.json';
import imageManifestData from '../data/article-images.json';
import { cleanFeedText } from './feed-text';

export const SUBSTACK_PUBLICATION_URL = 'https://thisiscoffeetalk.substack.com';

const rawBase = import.meta.env.BASE_URL;
export const base = rawBase === '/' ? '' : rawBase.replace(/\/$/, '');

const store = createArticleStore(articlesSnapshot, {
  basePath: `${base}/writing`,
});

const MANIFEST: ArticleImageManifest =
  imageManifestData && typeof imageManifestData === 'object'
    ? (imageManifestData as ArticleImageManifest)
    : {};

export const {
  RESERVED_SLUGS,
  getAllArticles,
  getPublishedArticles,
  getArticleBySlug,
  articlePreview,
  isExternalArticle,
  getNextArticle,
  getRelatedArticles,
} = store;

export type { ArticleRecord, ArticleImageRendition, TocEntry };
export { parseImageDimensions };

/** Prefix a root-relative asset path with the site's Astro base path. */
export function prefixBase(url: string): string {
  const trimmed = String(url ?? '').trim();
  if (!trimmed || !base) return trimmed;
  if (/^(https?:|mailto:|tel:|data:|#|\/\/)/i.test(trimmed)) return trimmed;
  if (trimmed === base || trimmed.startsWith(`${base}/`)) return trimmed;
  return trimmed.startsWith('/') ? `${base}${trimmed}` : `${base}/${trimmed}`;
}

/** Resolve an article URL, adding a trailing slash to hosted internal article pages. */
export function articleHref(
  record: Pick<ArticleRecord, 'hasBody' | 'slug' | 'link'>,
): string {
  const href = store.articleHref(record);
  if (store.isExternalArticle(record)) return href;
  return href.endsWith('/') ? href : `${href}/`;
}

/** Look up the unprefixed local optimized WebP path for an image URL (e.g. for BaseLayout OG images). */
export function resolveLocalRenditionPath(rawUrl: unknown): string | undefined {
  return lookupRendition(MANIFEST, rawUrl)?.src;
}

/** Look up a local optimized WebP rendition for an image URL, prefixed with `base`. */
export function resolveLocalRendition(rawUrl: unknown): ArticleImageRendition | null {
  const hit = lookupRendition(MANIFEST, rawUrl);
  if (!hit) return null;
  const srcset = hit.srcset
    ? hit.srcset
        .split(',')
        .map((part) => {
          const [candidateUrl, descriptor] = part.trim().split(/\s+/);
          if (!candidateUrl) return '';
          const prefixed = prefixBase(candidateUrl);
          return descriptor ? `${prefixed} ${descriptor}` : prefixed;
        })
        .filter(Boolean)
        .join(', ')
    : '';
  return {
    src: prefixBase(hit.src),
    srcset,
  };
}

/** Normalize feed/article strings according to house copy rules (no em dashes). */
export function sanitizeVisibleCopy(text: string): string {
  return cleanFeedText(text);
}

/**
 * Prepare a Substack article's body HTML for rendering inside `<ArticleReader />`:
 *   1. Deduplicate the cover image from the opening body block.
 *   2. Rewrite raw S3 body images to local WebP renditions.
 *   3. Upgrade click-to-enlarge image anchors into lightbox buttons and name bare links.
 *   4. Normalize heading levels & generate ToC anchor IDs.
 *   5. Enforce house style (no em dashes in rendered copy).
 */
export function renderArticleBody(article: ArticleRecord): {
  html: string;
  entries: TocEntry[];
} {
  const deduped = stripCoverImageFromBody(article.bodyHtml, article.image);
  const localised = rewriteBodyImages(deduped, resolveLocalRendition);
  const labelled = labelImageLinks(localised);
  const { entries, html } = buildToc(labelled);
  return {
    html: html.replace(/\s*\u2014\s*/g, ', '),
    entries: entries.map((e) => ({ ...e, text: cleanFeedText(e.text) })),
  };
}

/** Map an ArticleRecord into `@andrew/ui`'s `ArticleCardItem` for `MagazineSpread`. */
export function toMagazineCard(article: ArticleRecord): ArticleCardItem {
  const localImg = resolveLocalRendition(article.image);
  const previewParagraphs = articlePreview(article)
    .map((p) => cleanFeedText(p))
    .filter(Boolean);
  return {
    slug: article.slug,
    title: cleanFeedText(article.title) || article.title,
    link: articleHref(article),
    date: article.date,
    excerpt: cleanFeedText(article.excerpt),
    preview: previewParagraphs,
    image: article.image || undefined,
    imageSrc: localImg?.src || article.image || undefined,
    imageSrcset: localImg?.srcset || undefined,
    tags: article.tags.map((t) => cleanFeedText(t)).filter(Boolean),
    category: article.category || undefined,
    isExternal: isExternalArticle(article),
  };
}
