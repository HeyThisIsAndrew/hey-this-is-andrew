/**
 * Browser/SSR-safe barrel exports for `@andrew/content-pipeline`.
 * Deliberately excludes Node/heavy build-time dependencies (`sharp`, `fs`, `sanitize-html`)
 * so Astro site bundles never absorb sync-only tooling.
 */
export {
  createArticleStore,
  type ArticleFeedItem,
  type ArticleStore,
  type ArticleStoreOptions,
} from './substack/store.ts';
export { imageFingerprint, stripCoverImageFromBody } from './substack/media.ts';
export { buildToc, type TocEntry } from './substack/toc.ts';
export {
  ALREADY_OPTIMISED,
  LIGHTBOX_ATTR,
  labelImageLinks,
  lookupRendition,
  parseImageDimensions,
  rewriteBodyImages,
  type ArticleImageManifest,
  type ArticleImageRendition,
  type ImageDimensions,
} from './substack/images-transform.ts';
export type {
  ArticleEditorialOverrides,
  ArticleRecord,
  RawFeedItem,
  TransformConfig,
} from './substack/transform.ts';
export type { SubstackPostPayload, SubstackPostTag } from './substack/parser.ts';
