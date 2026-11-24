/**
 * Substack feed/API item → durable, sanitized ArticleRecord transformation pipeline.
 *
 * Sync/build-time only for HTML sanitization (`sanitize-html`).
 * Pure functions with configurable taxonomy/timezone so any site in the monorepo can share them.
 */
import sanitizeHtml from 'sanitize-html';
import type { SubstackPostPayload } from './parser.ts';

const ALLOWED_TAGS = [
  'p',
  'h2',
  'h3',
  'h4',
  'ul',
  'ol',
  'li',
  'blockquote',
  'hr',
  'a',
  'img',
  'figure',
  'figcaption',
  'em',
  'strong',
  'code',
  'pre',
  'br',
  'substack-gallery',
  'youtube-embed',
  'instagram-embed',
];

const ALLOWED_ATTRS: Record<string, string[]> = {
  a: ['href', 'title', 'rel', 'target'],
  img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
  'substack-gallery': [],
  'youtube-embed': ['video-id'],
  'instagram-embed': ['instagram-id', 'thumbnail-url', 'title', 'author-name'],
};

export interface ArticleEditorialOverrides {
  title?: string;
  excerpt?: string;
  newsletterBlurb?: string;
  image?: string;
  category?: string;
  featured?: boolean;
  hidden?: boolean;
  sortWeight?: number;
}

export interface RawFeedItem {
  title?: string;
  link?: string;
  guid?: string;
  pubDate?: string;
  description?: string;
  contentEncoded?: string;
  categories?: string[];
  enclosureUrl?: string;
}

export interface ArticleRecord {
  guid: string;
  slug: string;
  title: string;
  link: string;
  date: string;
  isoDate: string;
  excerpt: string;
  preview: string[];
  image: string;
  category: string;
  contentType: string;
  score: { value: number; best: number } | null;
  tags: string[];
  bodyHtml: string;
  hasBody: boolean;
  firstSeen: string;
  lastUpdated: string;
  featured?: boolean;
  isMock?: boolean;
  editorial?: ArticleEditorialOverrides;
}

export interface TransformConfig {
  /** Ordered canonical categories for this publication. */
  categories?: string[];
  /** Map category name -> tag aliases that resolve to it. */
  categoryAliases?: Record<string, string[]>;
  /** Map category name -> keyword tokens matched in tags or text. */
  categoryKeywords?: Record<string, string[]>;
  /** Fallback category when no rule matches. Default: 'General'. */
  fallbackCategory?: string;
  /** Ordered content types checked before fallback. */
  contentTypes?: readonly string[];
  /** Map contentType -> keyword tokens. */
  contentTypeKeywords?: Record<string, string[]>;
  /** Fallback contentType when no rule matches. Default: 'Analysis'. */
  fallbackContentType?: string;
  /** IANA timezone for display date formatting. Default: 'UTC'. */
  timeZone?: string;
  /** Character budget for card/meta excerpt. Default: 420. */
  excerptLimit?: number;
  /** Character budget for magazine preview paragraphs. Default: 1000. */
  previewLimit?: number;
  /** Maximum paragraphs for magazine preview. Default: 5. */
  previewMaxParagraphs?: number;
}

const DEFAULT_CATEGORIES: string[] = [];
const DEFAULT_CONTENT_TYPES = [
  'Review',
  'Analysis',
  'Dispatch',
  'Announcement',
  'Interview',
  'Commentary',
  'Reaction',
  'News',
  'Event Coverage',
] as const;

const DEFAULT_CONTENT_TYPE_KEYWORDS: Record<string, string[]> = {
  Review: ['review', 'reviewed', 'verdict', 'rating'],
  Commentary: ['commentary', 'comments', 'thoughts'],
  Reaction: ['reaction', 'reacts', 'first impression'],
  Dispatch: ['dispatch', 'onlocation', 'hallh', 'sdcc', 'd23', 'nycc', 'premiere', 'recap', 'coverage'],
  Announcement: ['announced', 'announcement', 'revealed', 'confirms', 'confirmed', 'trailer', 'release date'],
  Interview: ['interview', 'sitdown', 'conversation with', 'talks'],
  News: ['news', 'update', 'breaking'],
  Analysis: ['analysis', 'why', 'explained', 'breakdown', 'deepdive', 'essay', 'the case for'],
};

const BLOCK_BOUNDARY =
  /<\/(?:p|h[1-6]|li|ul|ol|blockquote|figure|figcaption|div|pre|tr|td|th|section|article)\s*>/gi;

const MIN_BODY_CHARS = 400;

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeToken(value: string): string {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function mapPostTags(post: SubstackPostPayload): string[] {
  return asArray(post?.postTags)
    .map((tag) => (typeof tag === 'string' ? tag : tag?.name))
    .map((tag) => String(tag ?? '').trim())
    .filter(Boolean);
}

/**
 * Convert Substack API/HTML post payloads into RawFeedItems consumed by `buildArticleRecord`.
 */
export function parsePostsResponse(
  posts: SubstackPostPayload | SubstackPostPayload[],
  publicationUrl = '',
): RawFeedItem[] {
  const safeStr = (val: unknown) =>
    typeof val === 'string' || typeof val === 'number' ? String(val).trim() : '';
  const pubBase = publicationUrl.replace(/\/$/, '');

  return asArray(posts).map((post) => {
    if (!post || typeof post !== 'object') return {};

    const slug = safeStr(post.slug);
    const link = safeStr(post.canonical_url ?? post.link) || (slug && pubBase ? `${pubBase}/p/${slug}` : '');
    const tags = mapPostTags(post);

    return {
      title: safeStr(post.title),
      link,
      guid: safeStr(post.id ?? post.guid) || link,
      pubDate: safeStr(post.post_date ?? post.pubDate),
      description: safeStr(post.subtitle ?? post.description),
      contentEncoded: safeStr(post.body_html ?? post.contentEncoded ?? post.content),
      categories: tags.length
        ? tags
        : Array.isArray(post.categories)
          ? post.categories.filter((c): c is string => typeof c === 'string')
          : [],
      enclosureUrl: safeStr(post.cover_image ?? post.enclosureUrl),
    };
  });
}

/**
 * Demote in-body headings by one level (`h1->h2`, `h2->h3`, `h3->h4`, clamped at `h4`)
 * so the page's own `<h1>` article title remains unique.
 */
export function demoteHeadings(html: string): string {
  if (!html) return '';
  return html.replace(
    /<(\/?)h([1-6])\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi,
    (_m, slash: string, level: string, rest: string) => {
      const demoted = Math.min(Number(level) + 1, 4);
      return `<${slash}h${demoted}${rest}>`;
    },
  );
}

/**
 * Extract Substack `image-gallery-embed` JSON payloads into `<substack-gallery>` tags
 * containing native `<img>` elements before sanitization strips custom divs.
 */
export function extractSubstackGalleries(html: string): string {
  if (!html) return '';
  return html.replace(
    /<div\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/div>/gi,
    (match, attrs: string) => {
      if (!attrs.includes('image-gallery-embed') || !attrs.includes('data-attrs=')) {
        return match;
      }
      const dataMatch = attrs.match(/data-attrs=(["'])(.*?)\1/);
      if (!dataMatch) return match;

      try {
        const jsonStr = dataMatch[2].replace(/&quot;/g, '"');
        const parsed = JSON.parse(jsonStr) as { gallery?: { images?: Array<{ src?: unknown }> } };
        const urls: string[] = [];
        if (parsed?.gallery?.images && Array.isArray(parsed.gallery.images)) {
          for (const img of parsed.gallery.images) {
            if (img?.src && typeof img.src === 'string') {
              urls.push(img.src);
            }
          }
        }
        if (urls.length === 0) return match;

        const imgTags = urls.map((url) => {
          let width = '';
          let height = '';
          const dimMatch = url.match(/_(\d+)x(\d+)\.[a-z0-9]+$/i);
          if (dimMatch) {
            width = ` width="${dimMatch[1]}"`;
            height = ` height="${dimMatch[2]}"`;
          }
          return `<img src="${url}"${width}${height} loading="lazy" />`;
        });
        return `<substack-gallery>${imgTags.join('')}</substack-gallery>`;
      } catch {
        return '';
      }
    },
  );
}

/** Convert YouTube iframe embeds into `<youtube-embed video-id="...">` before sanitization. */
export function extractYouTubeEmbeds(html: string): string {
  if (!html) return '';
  return html.replace(
    /<iframe\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/iframe>/gi,
    (match, attrs: string) => {
      const srcMatch = attrs.match(
        /src=["'](?:https?:)?\/\/(?:www\.)?(?:youtube\.com|youtube-nocookie\.com)\/embed\/([A-Za-z0-9_-]+)[^"']*["']/i,
      );
      if (srcMatch) {
        return `<youtube-embed video-id="${srcMatch[1]}"></youtube-embed>`;
      }
      return match;
    },
  );
}

/** Convert Substack Instagram wraps, blockquotes, and iframes into `<instagram-embed>` before sanitization. */
export function extractInstagramEmbeds(html: string): string {
  if (!html) return '';

  let out = html.replace(
    /<div\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/div>/gi,
    (match, attrs: string) => {
      if (!attrs.includes('instagram-embed-wrap') && !attrs.includes('InstagramToDOM')) {
        return match;
      }
      const dataMatch = attrs.match(/data-attrs=(["'])(.*?)\1/);
      if (!dataMatch) return match;
      try {
        const jsonStr = dataMatch[2].replace(/&quot;/g, '"');
        const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
        const id = parsed?.instagram_id || parsed?.id;
        if (!id) return match;

        const safeId = String(id).replace(/[^A-Za-z0-9_-]/g, '');
        if (!safeId) return match;

        const thumb = parsed?.thumbnail_url
          ? ` thumbnail-url="${String(parsed.thumbnail_url).replace(/"/g, '&quot;')}"`
          : '';
        const title = parsed?.title
          ? ` title="${String(parsed.title).replace(/"/g, '&quot;')}"`
          : '';
        const author = parsed?.author_name
          ? ` author-name="${String(parsed.author_name).replace(/"/g, '&quot;')}"`
          : '';

        return `<instagram-embed instagram-id="${safeId}"${thumb}${title}${author}></instagram-embed>`;
      } catch {
        return match;
      }
    },
  );

  out = out.replace(
    /<blockquote\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/blockquote>/gi,
    (match, attrs: string, inner: string) => {
      if (!attrs.includes('instagram-media') && !attrs.includes('data-instgrm-permalink')) {
        return match;
      }
      const permalinkMatch = `${attrs} ${inner}`.match(
        /https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/i,
      );
      if (permalinkMatch) {
        return `<instagram-embed instagram-id="${permalinkMatch[1]}"></instagram-embed>`;
      }
      return match;
    },
  );

  out = out.replace(
    /<iframe\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/iframe>/gi,
    (match, attrs: string) => {
      const srcMatch = attrs.match(
        /src=["'](?:https?:)?\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)[^"']*["']/i,
      );
      if (srcMatch) {
        return `<instagram-embed instagram-id="${srcMatch[1]}"></instagram-embed>`;
      }
      return match;
    },
  );

  return out;
}

/** Promote Substack `<div class="pullquote">...</div>` blocks to `<blockquote class="pullquote">` before sanitization. */
export function liftPullQuotes(html: string): string {
  if (!html) return '';
  return html.replace(
    /<div\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/div>/gi,
    (match: string, attrs: string, inner: string) => {
      if (!/class\s*=\s*(["'])[^"']*\bpullquote\b[^"']*\1/i.test(attrs)) return match;
      if (/<div\b/i.test(inner)) return match;
      if (!inner.replace(/<[^>]*>/g, '').trim()) return match;
      return `<blockquote class="pullquote">${inner}</blockquote>`;
    },
  );
}

/** Sanitize imported Substack HTML down to the semantic allowlist. */
export function sanitizeArticleHtml(html: string): string {
  if (!html) return '';
  const processedHtml = extractInstagramEmbeds(
    extractYouTubeEmbeds(extractSubstackGalleries(liftPullQuotes(demoteHeadings(html)))),
  );

  return sanitizeHtml(processedHtml, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRS,
    allowedClasses: { blockquote: ['pullquote'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href ?? '';
        const isExternal = /^https?:\/\//i.test(href);
        return {
          tagName,
          attribs: isExternal ? { ...attribs, rel: 'noopener noreferrer', target: '_blank' } : attribs,
        };
      },
    },
    exclusiveFilter: (frame) =>
      frame.tag === 'p' && !frame.text.trim() && !frame.mediaChildren.length,
  }).trim();
}

/** Strip tags and decode HTML entities to plain text for excerpts, scoring, and alt fallbacks. */
export function toPlainText(html: string): string {
  const spaced = String(html ?? '')
    .replace(BLOCK_BOUNDARY, ' ')
    .replace(/<br\s*\/?>/gi, ' ');
  return sanitizeHtml(spaced, { allowedTags: [], allowedAttributes: {} })
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstImage(html: string): string {
  const match = String(html ?? '').match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : '';
}

/** True when the imported body is too short or appears to be a subscriber paywall teaser. */
export function looksTruncated(bodyHtml: string): boolean {
  const text = toPlainText(bodyHtml);
  if (text.length < MIN_BODY_CHARS) return true;
  return /subscribe to (keep reading|read more)|this post is for (paid|paying)|upgrade to continue/i.test(text);
}

/** Map post tags and text to a configured category, falling back to `fallbackCategory`. */
export function mapCategory(
  tags: string[] = [],
  text = '',
  config: TransformConfig = {},
): string {
  const categories = config.categories ?? DEFAULT_CATEGORIES;
  const categoryAliases = config.categoryAliases ?? {};
  const categoryKeywords = config.categoryKeywords ?? {};
  const fallback = config.fallbackCategory ?? 'General';
  const normalizedTags = tags.map(normalizeToken).filter(Boolean);

  for (const category of categories) {
    const aliases = [category, ...(categoryAliases[category] ?? categoryAliases[category.toLowerCase()] ?? [])].map(
      normalizeToken,
    );
    if (normalizedTags.some((t) => aliases.includes(t))) return category;
  }

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    const normalizedKeywords = keywords.map(normalizeToken);
    if (normalizedTags.some((t) => normalizedKeywords.includes(t))) {
      return category;
    }
  }

  const haystack = ` ${String(text).toLowerCase()} `;
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((k) => haystack.includes(` ${k.toLowerCase()} `))) return category;
  }

  return fallback;
}

/** Map post tags and text to a content type (Review, Analysis, Dispatch, etc.). */
export function mapContentType(
  tags: string[] = [],
  text = '',
  category?: string,
  config: TransformConfig = {},
): string {
  const contentTypes = config.contentTypes ?? DEFAULT_CONTENT_TYPES;
  const contentTypeKeywords = config.contentTypeKeywords ?? DEFAULT_CONTENT_TYPE_KEYWORDS;
  const fallback = config.fallbackContentType ?? 'Analysis';
  const normalizedTags = tags.map(normalizeToken).filter(Boolean);

  for (const type of contentTypes) {
    if (normalizedTags.includes(normalizeToken(type))) return type;
  }

  for (const [type, keywords] of Object.entries(contentTypeKeywords)) {
    const normalizedKeywords = keywords.map(normalizeToken);
    if (normalizedTags.some((t) => normalizedKeywords.includes(t))) {
      return type;
    }
  }

  const haystack = ` ${String(text).toLowerCase()} `;
  for (const type of contentTypes) {
    const keywords = contentTypeKeywords[type] ?? [];
    if (keywords.some((k) => haystack.includes(` ${k} `) || haystack.includes(k))) {
      return type;
    }
  }

  if (category === 'Events') return 'Event Coverage';
  return fallback;
}

/** Extract an out-of-10 or out-of-5 rating from review text, or null if none is present. */
export function extractScore(html: string): { value: number; best: number } | null {
  const text = toPlainText(html);
  const match = text.match(/(?:score|rating)?\s*:?\s*\b(\d{1,2}(?:\.\d)?)\s*\/\s*(10|5)\b/i);
  if (!match) return null;
  const value = Number(match[1]);
  const best = Number(match[2]);
  if (!Number.isFinite(value) || value < 0 || value > best) return null;
  return { value, best };
}

/** Derive a URL-safe slug from the Substack permalink or article title. */
export function toSlug(link: string, title: string): string {
  const fromLink = String(link ?? '').match(/\/p\/([^/?#]+)/);
  const raw = fromLink ? fromLink[1] : String(title ?? '');
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Build a sentence-bounded plain-text excerpt for cards and meta descriptions. */
export function buildExcerpt(description: string, body: string, limit = 420): string {
  const source = description || body;
  if (source.length <= limit) return source;

  const clipped = source.slice(0, limit);
  const lastStop = Math.max(
    clipped.lastIndexOf('. '),
    clipped.lastIndexOf('! '),
    clipped.lastIndexOf('? '),
  );
  if (lastStop > limit * 0.5) return clipped.slice(0, lastStop + 1);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, lastSpace > 0 ? lastSpace : limit)}…`;
}

/** Build the opening paragraphs array used by magazine spread previews. */
export function buildPreview(
  bodyHtml: string,
  fallback = '',
  limit = 1000,
  maxParagraphs = 5,
): string[] {
  const blocks = String(bodyHtml ?? '').match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) ?? [];
  const paragraphs: string[] = [];
  let used = 0;

  for (const block of blocks) {
    const text = toPlainText(block);
    if (text.length < 40) continue;

    paragraphs.push(text);
    used += text.length;

    if (paragraphs.length >= maxParagraphs || used >= limit) break;
  }

  if (paragraphs.length === 0) {
    const plain = toPlainText(fallback);
    return plain ? [plain] : [];
  }

  const last = paragraphs[paragraphs.length - 1];
  if (used > limit * 1.4 && last.length > 200) {
    const allowance = Math.max(200, limit - (used - last.length));
    const clipped = last.slice(0, allowance);
    const stop = Math.max(
      clipped.lastIndexOf('. '),
      clipped.lastIndexOf('! '),
      clipped.lastIndexOf('? '),
    );
    paragraphs[paragraphs.length - 1] =
      stop > allowance * 0.5
        ? clipped.slice(0, stop + 1)
        : `${clipped.slice(0, Math.max(clipped.lastIndexOf(' '), 0))}…`;
  }

  return paragraphs;
}

function formatDisplayDate(iso: string, timeZone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone,
  });
}

/** Build a durable ArticleRecord from one normalized feed/API item. */
export function buildArticleRecord(
  item: RawFeedItem,
  now = new Date(),
  config: TransformConfig = {},
): ArticleRecord | null {
  const title = toPlainText(item.title ?? '');
  const link = String(item.link ?? '').trim();
  const guid = String(item.guid ?? link).trim();

  if (!title || !guid) return null;

  const parsedDate = new Date(item.pubDate ?? '');
  const isoDate = Number.isNaN(parsedDate.getTime()) ? now.toISOString() : parsedDate.toISOString();

  const bodyHtml = sanitizeArticleHtml(item.contentEncoded ?? '');
  const rawCategories = item.categories ?? [];
  const categoriesArray = Array.isArray(rawCategories) ? rawCategories : [rawCategories];
  const tags = categoriesArray.map((t) => String(t).trim()).filter(Boolean);
  const excerptSource = item.description ?? bodyHtml;
  const classificationText = `${title} ${toPlainText(item.description ?? '')}`;
  const category = mapCategory(tags, classificationText, config);

  return {
    guid,
    slug: toSlug(link, title),
    title,
    link,
    date: formatDisplayDate(isoDate, config.timeZone ?? 'UTC'),
    isoDate,
    excerpt: buildExcerpt(toPlainText(excerptSource), toPlainText(bodyHtml), config.excerptLimit),
    preview: buildPreview(
      bodyHtml,
      excerptSource,
      config.previewLimit,
      config.previewMaxParagraphs,
    ),
    image: item.enclosureUrl || firstImage(item.contentEncoded ?? ''),
    category,
    contentType: mapContentType(tags, classificationText, category, config),
    score: extractScore(bodyHtml),
    tags,
    bodyHtml,
    hasBody: Boolean(bodyHtml) && !looksTruncated(bodyHtml),
    firstSeen: now.toISOString(),
    lastUpdated: now.toISOString(),
  };
}
