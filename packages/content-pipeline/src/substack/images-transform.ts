/**
 * Pure image rewrite, dimension parsing, and lightbox-trigger helpers for Substack article HTML.
 * Zero I/O or JSON module imports so both Astro SSR and Node tests can execute it directly.
 */

export interface ArticleImageRendition {
  src: string;
  srcset: string;
}

export type ArticleImageManifest = Record<string, { src?: unknown; srcset?: unknown }>;

export interface ImageDimensions {
  width: number;
  height: number;
}

export const ALREADY_OPTIMISED = /substackcdn\.com\//i;
export const LIGHTBOX_ATTR = 'data-lightbox-image';

/** Look up a local optimized rendition for `rawUrl`, returning `null` for CDN URLs or missing entries. */
export function lookupRendition(
  manifest: ArticleImageManifest,
  rawUrl: unknown,
): ArticleImageRendition | null {
  const url = String(rawUrl ?? '').trim();
  if (!url || ALREADY_OPTIMISED.test(url)) return null;

  const entry = manifest?.[url];
  if (!entry) return null;

  const src = String(entry.src ?? '').trim();
  if (!src) return null;

  return { src, srcset: String(entry.srcset ?? '') };
}

/**
 * Rewrite `<img>` tags in sanitized article body HTML to local renditions where available,
 * adding `loading="lazy"`, `decoding="async"`, and empty `alt=""` fallbacks conservatively.
 */
export function rewriteBodyImages(
  bodyHtml: string,
  lookup: (url: string) => ArticleImageRendition | null,
  sizes = '(max-width: 900px) 92vw, 720px',
  fallback?: (url: string) => ArticleImageRendition | null,
): string {
  const body = String(bodyHtml ?? '');
  if (!body) return body;

  return body.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = tag.match(/\ssrc=["']([^"']+)["']/i)?.[1];
    if (!src) return tag;

    let local: ArticleImageRendition | null = null;
    try {
      local = lookup(src);
    } catch {
      local = null;
    }

    if (!local?.src && fallback) {
      try {
        local = fallback(src);
      } catch {
        local = null;
      }
    }

    let out = tag;

    if (local?.src) {
      out = out.replace(/(\ssrc=["'])[^"']+(["'])/i, `$1${local.src}$2`);
      if (local.srcset && !/\ssrcset=/i.test(out)) {
        out = out.replace(/<img\b/i, `<img srcset="${local.srcset}" sizes="${sizes}"`);
      }
    }

    if (!/\sloading=/i.test(out)) out = out.replace(/<img\b/i, '<img loading="lazy"');
    if (!/\sdecoding=/i.test(out)) out = out.replace(/<img\b/i, '<img decoding="async"');
    if (!/\salt=/i.test(out)) out = out.replace(/<img\b/i, '<img alt=""');

    return out;
  });
}

const DIMENSIONS_IN_FILENAME = /_(\d{2,5})x(\d{2,5})\.(?:png|jpe?g|webp|gif|avif)\b/gi;

/** Parse intrinsic pixel dimensions encoded in Substack upload filenames (`_<W>x<H>.<ext>`). */
export function parseImageDimensions(rawUrl: unknown): ImageDimensions | null {
  const url = String(rawUrl ?? '').trim();
  if (!url) return null;

  DIMENSIONS_IN_FILENAME.lastIndex = 0;
  let last: RegExpExecArray | null = null;
  for (let match = DIMENSIONS_IN_FILENAME.exec(url); match; match = DIMENSIONS_IN_FILENAME.exec(url)) {
    last = match;
  }
  if (!last) return null;

  const width = Number(last[1]);
  const height = Number(last[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return null;

  return { width, height };
}

const IMAGE_HREF =
  /\shref\s*=\s*(["'])(?:https?:\/\/(?:substackcdn\.com\/image\/|substack-post-media\.s3\.amazonaws\.com\/|images\.unsplash\.com\/)|[^"']*\.(?:png|jpe?g|webp|gif|avif)(?:[?#][^"']*)?\1)/i;
const ANCHOR = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
const ALT_WITH_TEXT = /\balt\s*=\s*(["'])(?!\1)[^"']*\1/i;
const ALREADY_NAMED = /\s(?:aria-label|aria-labelledby)\s*=/i;

/**
 * Give accessible names to image-only anchors and upgrade direct click-to-enlarge
 * image links into `<button class="article-image-zoom" data-lightbox-image>` triggers.
 */
export function labelImageLinks(html: unknown): string {
  const source = String(html ?? '');
  if (!source) return '';

  return source.replace(ANCHOR, (match: string, attrs: string, inner: string) => {
    if (!/<img\b/i.test(inner)) return match;
    if (inner.replace(/<[^>]*>/g, '').trim()) return match;

    const named =
      ALREADY_NAMED.test(attrs) || ALT_WITH_TEXT.test(attrs) || ALT_WITH_TEXT.test(inner);

    if (IMAGE_HREF.test(attrs)) {
      const label = named ? '' : ' aria-label="View image full screen"';
      return `<button type="button" class="article-image-zoom" ${LIGHTBOX_ATTR}${label}>${inner}</button>`;
    }

    if (named) return match;

    const opensNewTab = /\starget\s*=\s*(["'])_blank\1/i.test(attrs);
    const label = opensNewTab ? 'Open image in a new tab' : 'Open image';
    return `<a${attrs} aria-label="${label}">${inner}</a>`;
  });
}
