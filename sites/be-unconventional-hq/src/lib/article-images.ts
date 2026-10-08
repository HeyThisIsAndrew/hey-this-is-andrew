/*
  ─── ARTICLE IMAGES, SERVED FROM OUR OWN ORIGIN ─────────────────────────────

  THE PROBLEM, AND THE ONE THIS REFUSES TO REINTRODUCE.

  Substack article records frequently carry the RAW upload. Measured across the
  three articles in src/data/articles.json: 10 images totalling 22.54 MB,
  several of them 3840x2160, rendering into a column about 720 px wide.

  An earlier attempt fixed that by rewriting those `src` attributes to a
  resizing proxy (wsrv.nl). It was reverted, because it made the page
  dramatically WORSE on a real phone: wsrv.nl has a cold cache, so serving one
  meant fetching a 4K JPEG from S3, decoding, resizing and re-encoding — per
  URL and per srcset width — while the reader watched an empty frame.
  SubstackGallery's lightbox reassigns `img.src` on every slide, so each swipe
  triggered a fresh cold transcode. Reported as "blank, and still blank as I
  slid".

  So the renditions are built ONCE, ahead of time, by
  scripts/sync-article-images.mjs and committed to public/article-images/. A
  local file cannot be cold, cannot expire, cannot rate-limit and cannot 403.
  That is the entire difference between this and the thing that was reverted.

  This module is only the binding of the rule in ./article-images-transform.ts
  to the committed manifest — the rule lives there so it can be tested under
  plain `node`, which cannot load a module that statically imports JSON.
*/
import manifestData from '../data/article-images.json';
import {
  lookupRendition,
  rewriteBodyImages,
  type ArticleImageManifest,
  type ArticleImageRendition,
} from './article-images-transform.ts';
import { getCardImageSources, isSubstackFetchUrl } from './card-images.ts';

export type { ArticleImageRendition };

const MANIFEST: ArticleImageManifest =
  manifestData && typeof manifestData === 'object'
    ? (manifestData as ArticleImageManifest)
    : {};

/** The committed rendition for a source image URL, or `null` for the original. */
export function localArticleImage(rawUrl: unknown): ArticleImageRendition | null {
  return lookupRendition(MANIFEST, rawUrl);
}

/**
 * Rewrite article body `<img>` tags to committed renditions where they exist.
 *
 * The fallback is the same one the hero uses, and gated the same way: a
 * substackcdn URL gets a width cap and a srcset on Substack's own warm CDN,
 * and anything else is left alone so it can never reach the wsrv.nl branch of
 * getCardImageSources() — the cold third-party transcode this module's header
 * exists to keep out of the article path.
 *
 * Without it, every body image on a Substack article shipped at w_1456 with no
 * srcset, because ALREADY_OPTIMISED skips substackcdn by design.
 */
export function localiseBodyImages(bodyHtml: string, sizes?: string): string {
  return rewriteBodyImages(
    bodyHtml,
    (url) => lookupRendition(MANIFEST, url),
    sizes,
    (url) => (isSubstackFetchUrl(url) ? getCardImageSources(url) : null),
  );
}
