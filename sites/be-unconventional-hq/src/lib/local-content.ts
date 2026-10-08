/**
 * Local-JSON readers for the `event` and `featuredBrand` doc types that used
 * to be queried straight from Sanity. Mirrors the pattern in videos-source.ts:
 * one place pages get this data, backed by src/data/videos.json.
 *
 * Sanity is still used for image hosting - most existing docs carry real
 * Sanity asset references (logo/heroImage), so urlFor() below builds real
 * cdn.sanity.io URLs for those. That's a browser-side image fetch, not a
 * build-time API call, so it doesn't reintroduce the egress dependency this
 * pivot removes. Docs created in the Local CMS (no Sanity asset pipeline
 * available to it) instead store a plain image URL string - urlFor() below
 * accepts that too, as a pass-through.
 */
import { createImageUrlBuilder } from '@sanity/image-url';
import localVideos from '../data/videos.json';
import { SANITY_PROJECT } from './sanity-project.ts';


const builder = createImageUrlBuilder(SANITY_PROJECT);

/**
 * Sanity asset ids are self-describing: `image-<hash>-<W>x<H>-<ext>`. The
 * Local CMS's upload endpoint (astro.config.mjs) now uploads straight to
 * Sanity and stores this bare id string as the field value (not a resolved
 * URL, not a full asset-reference object) - keeps videos.json diffable and
 * ImageUploadField's value contract a plain string. Detecting the shape here
 * is what lets a bare ref resolve through urlFor() *and* keep CLS dimensions,
 * identical to how a real frozen-export Sanity asset reference object does.
 */
const SANITY_IMAGE_REF_RE = /^image-[a-f0-9]+-\d+x\d+-\w+$/i;

export function isSanityImageRef(value: unknown): value is string {
  return typeof value === 'string' && SANITY_IMAGE_REF_RE.test(value);
}

/**
 * Chainable no-op matching ImageUrlBuilder's fluent API, for plain URLs.
 *
 * A Proxy rather than a hand-listed set of methods: every transform the real
 * builder grows (`quality`, `fit`, `dpr`, …) has to be a silent no-op here or
 * the first caller to use one throws on an externally-hosted image. Listing
 * them by hand meant that failure was one new call site away — this cannot
 * drift. Only `url()` is real.
 */
function plainUrlBuilder(url: string) {
  const chain: any = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'url' || prop === 'toString') return () => url;
        return () => chain;
      },
    },
  );
  return chain;
}

export function urlFor(source: any) {
  if (isSanityImageRef(source)) return builder.image({ asset: { _ref: source } });
  if (typeof source === 'string') return plainUrlBuilder(source);
  return builder.image(source);
}

/**
 * Sanity image asset _refs are self-describing: `image-<hash>-<W>x<H>-<ext>`.
 * That lets us reserve the image box (CLS) without dereferencing
 * asset->metadata.dimensions the way the old GROQ projections did. Plain
 * URL strings (arbitrary external URLs) have no embedded dimensions - callers
 * fall back to an unconstrained box, same as any doc with no logo at all.
 */
function imageDimensions(source: any): { width: number; height: number; aspectRatio: number } | null {
  const ref = isSanityImageRef(source) ? source : source?.asset?._ref;
  if (typeof ref !== 'string') return null;
  const match = /-(\d+)x(\d+)-/.exec(ref);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!width || !height) return null;
  return { width, height, aspectRatio: width / height };
}

/** Public read of the dimensions encoded in a Sanity asset id. */
export function getImageDimensions(source: any) {
  return source?.dimensions ?? imageDimensions(source);
}

export interface ImageSet {
  /** Largest candidate — the `src` fallback for browsers ignoring srcset. */
  src: string;
  /** `srcset` with width descriptors, or '' for images with no known size. */
  srcset: string;
  /** Intrinsic box for the `src`, so the slot can be reserved (CLS). */
  width: number;
  height: number;
}

/**
 * Build a responsive image set from a Sanity asset, NEVER asking the CDN for
 * more pixels than the asset actually has.
 *
 * ─── WHY THE CAP IS THE POINT ─────────────────────────────────────────────
 * Sanity happily serves `?w=1600` for a 768px-wide original: it upsamples and
 * returns a genuinely 1600px-wide, genuinely blurry file. That is strictly
 * worse than asking for 768 — more bytes, less detail, and the softness reads
 * as "the site is low quality" rather than "this source image is small". The
 * events hero shipped exactly that (a 768x432 asset requested at 1600x900).
 * Capping at the native width cannot make an image sharper, but it stops us
 * paying to make it worse, and it makes the real ceiling visible in the
 * markup instead of hiding it behind an interpolated upscale.
 *
 * @param source   Sanity image field (object or bare `image-…` id string).
 * @param widths   Candidate CSS widths, ascending. Values above the asset's
 *                 native width are dropped and replaced by the native width.
 * @param aspect   Optional forced aspect ratio (w / h) for a cropped box.
 *                 Omit to keep the asset's own proportions.
 */
/**
 * The width ladder an asset can actually serve: every candidate below its
 * native width, plus the native width itself as the top rung.
 *
 * This is the capping rule `buildImageSet` documents above, pulled out so the
 * hero backdrops can use it too. They ship their own `srcset` rather than an
 * ImageSet, because their `src` is deliberately the SMALL candidate (a
 * mobile-first fallback) where buildImageSet's is the largest, and that is a
 * real difference rather than an oversight. Without this they asked for a flat
 * 2400 from assets that are 1920, which is the upscale the note above is
 * about, and they could never ask for more than 2400 from the two that are
 * 3840.
 *
 * An asset with no embedded dimensions (an arbitrary external URL) gets the
 * ladder back untouched: there is nothing to cap against, and inventing a
 * ceiling would be a guess.
 */
export function cappedWidths(source: any, widths: number[]): number[] {
  /*
    Two shapes reach this. A Sanity asset carries its size in its id, and
    Astro's own ImageMetadata (a local import or an import.meta.glob entry)
    carries a plain `.width`. The rule is the same for both and there is no
    reason for the homepage band to own a second copy of it.
  */
  const nativeWidth =
    typeof source?.width === 'number' ? source.width : getImageDimensions(source)?.width;
  if (!nativeWidth) return [...widths].sort((a, b) => a - b);
  const capped = Math.min(Math.max(...widths), nativeWidth);
  return [...new Set(widths.filter((w) => w < capped).concat(capped))].sort((a, b) => a - b);
}

export function buildImageSet(
  source: any,
  { widths, aspect, quality = 80 }: { widths: number[]; aspect?: number; quality?: number },
): ImageSet | null {
  if (!source) return null;

  const native = getImageDimensions(source);
  const ratio = aspect ?? native?.aspectRatio ?? 16 / 9;

  // No embedded dimensions (an arbitrary external URL) — hand back the plain
  // URL untouched rather than inventing a srcset the host cannot serve.
  if (!native) {
    const src = urlFor(source).url();
    return src ? { src, srcset: '', width: 0, height: 0 } : null;
  }

  const candidates = cappedWidths(source, widths);

  const at = (w: number) =>
    urlFor(source)
      .width(w)
      .height(Math.round(w / ratio))
      .auto('format')
      .quality(quality)
      .url();

  const largest = candidates[candidates.length - 1];
  return {
    src: at(largest),
    srcset: candidates.map((w) => `${at(w)} ${w}w`).join(', '),
    width: largest,
    height: Math.round(largest / ratio),
  };
}

function withDimensions(source: any): any {
  if (!source) return source;
  // Bare Sanity ref string from the Local CMS upload endpoint - promote to
  // the same {asset:{_ref}} shape a real frozen-export doc already has, so
  // urlFor() and .dimensions.aspectRatio work identically either way.
  if (isSanityImageRef(source)) return { asset: { _ref: source }, dimensions: imageDimensions(source) };
  // Arbitrary external URL string (hand-pasted, not uploaded) carries no
  // embedded dimensions - pass through unchanged rather than spreading
  // string characters as keys.
  if (typeof source === 'string') return source;
  return { ...source, dimensions: imageDimensions(source) };
}

function withImageDimensions<T extends { logo?: any; heroImage?: any }>(doc: T): T {
  return {
    ...doc,
    logo: withDimensions(doc.logo),
    heroImage: withDimensions(doc.heroImage),
  };
}

/** Equivalent to `*[_type == "event"] | order(startDate desc)`. */
/**
 * The standard closing section rendered under every article.
 *
 * ─── A SINGLETON, AND WHY IT LIVES HERE ─────────────────────────────────────
 * `src/data/articles.json` is owned by the Substack sync and must not be hand
 * edited, so the outro cannot live with the posts. `videos.json` is the file
 * the local CMS already writes, which makes `_type: 'articleOutro'` editable at
 * /local-cms alongside events and featured brands — the whole point of moving
 * this out of the body was that the copy can change without a code deploy.
 *
 * The DEFAULTS below are the live copy, not a placeholder. A missing or
 * half-filled document falls back field by field rather than rendering a gap:
 * this section appears on every article, so a blank one is worse than a stale
 * one. Delete the document and the site still reads correctly.
 *
 * Links are LABEL + HREF fields with `{brand}`, `{substack}` and `{youtube}`
 * tokens in the prose, rather than a rich-text blob. An editor can rewrite
 * every sentence without touching markup, and nothing here is rendered with
 * `set:html`.
 */
export interface ArticleOutro {
  heading: string;
  intro: string;
  cta: string;
  signOff: string;
  brandLabel: string;
  brandHref: string;
  substackLabel: string;
  substackHref: string;
  youtubeLabel: string;
  youtubeHref: string;
}

const ARTICLE_OUTRO_DEFAULTS: ArticleOutro = {
  heading: 'Where Nerd Culture Gets Cinematic',
  intro:
    '{brand} is a publication for fans who love the craft behind the stories. If we are talking cinema, our content should look like cinema. We skip the clickbait and artificial outrage to focus on genuine conversations, unfiltered honesty, and independent analysis across Film, TV, Games, and Events.',
  cta:
    'If you want our full convention coverage, event photos, and articles delivered straight to your inbox, subscribe to our {substack}. Don\u2019t forget to check out the {youtube} for our long-form videos and event recaps as well. I\u2019ll see you there.',
  signOff: 'BE YOURSELF. BE PASSIONATE. BE UNCONVENTIONAL.',
  brandLabel: 'BE Unconventional HQ',
  brandHref: 'https://beunconventionalhq.com/',
  substackLabel: 'Substack publication',
  substackHref: 'https://beunconventionalhq.substack.com/',
  youtubeLabel: 'BE Unconventional HQ YouTube channel',
  youtubeHref: 'https://www.youtube.com/@BeUnconventionalHQ',
};

export function getArticleOutro(): ArticleOutro {
  const doc = (localVideos as any[]).find((d) => d?._type === 'articleOutro') ?? {};
  const merged = { ...ARTICLE_OUTRO_DEFAULTS };
  for (const key of Object.keys(ARTICLE_OUTRO_DEFAULTS) as (keyof ArticleOutro)[]) {
    const value = doc[key];
    if (typeof value === 'string' && value.trim()) merged[key] = value;
  }
  return merged;
}

export function getEventsLocal(): any[] {
  const showHidden = import.meta.env.DEV;
  return (localVideos as any[])
    .filter((d) => d._type === 'event')
    /*
      RECURRING TEMPLATES ARE NOT EVENTS.

      A template ("PAX West", no year) is the reusable profile an edition is
      stamped from — logo, key art, brand colour, venue, sync keywords — and
      it is not something that happens on a date. It is excluded HERE, at the
      one function every public surface reads events through, rather than in
      each caller: a template usually carries the last edition's dates so the
      editor can see what they are duplicating, which means the
      `if (!e.startDate) return false` guards on the index would NOT have
      caught it, and /events/[slug] would have built a real page for a
      profile with no edition attached. The local CMS reads the JSON file
      directly through its own middleware, so templates stay editable there.
    */
    .filter((d) => d.isRecurringTemplate !== true)
    .filter((d) => showHidden || d.hidden !== true)
    .map(withImageDimensions)
    .sort((a, b) => String(b.startDate ?? '').localeCompare(String(a.startDate ?? '')));
}

/**
 * Every recurring-event TEMPLATE in the store — the opposite half of
 * `getEventsLocal()`'s filter. Templates are editorial furniture, not
 * schedule entries: they exist so a new edition of PAX West or SDCC can be
 * stamped out with its artwork, brand colour, venue and sync keywords intact
 * instead of being rebuilt from a blank document every year.
 */
export function getEventTemplatesLocal(): any[] {
  return (localVideos as any[])
    .filter((d) => d._type === 'event' && d.isRecurringTemplate === true)
    .map(withImageDimensions)
    .sort((a, b) => String(a.title ?? '').localeCompare(String(b.title ?? '')));
}

/**
 * Equivalent to
 * `*[_type == "featuredBrand" && defined(slug.current)] | order(title asc)`.
 */
/*
  HIDDEN HUBS ARE HIDDEN IN A BUILD, AND VISIBLE IN DEV.

  An unfinished hub should not be on the live site, but it must stay in front of
  the person finishing it — otherwise the only way to work on one is to keep
  toggling it back on. So `hidden` is honoured in a production build and ignored
  by `npm run dev`, where everything renders.

  The flag is EXPLICIT rather than inferred from whether a hub "has content".
  That was the other option and it is the wrong one: "no content" is ambiguous
  (no logo? no key art? no tagged videos?) and today almost every hub has
  artwork pending but zero tagged coverage, so an automatic rule would hide hubs
  that are perfectly ready. A checkbox says exactly what it does and cannot
  surprise anyone.

  An empty CATEGORY cannot result from this. /featured derives its rows from the
  hubs themselves — group by `hubCategory`, take the keys — so a category with
  every hub hidden has no key and never renders, and the accordion sizes itself
  from the row count that survives.

  This also removes the hub's PAGE: [slug].astro builds its routes from this
  same function, so a hidden hub stops generating one rather than shipping an
  unlinked empty page.
*/
export function getFeaturedBrandsLocal(): any[] {
  const showHidden = import.meta.env.DEV;
  return (localVideos as any[])
    .filter((d) => d._type === 'featuredBrand' && d.slug?.current)
    .filter((d) => showHidden || d.hidden !== true)
    .map(withImageDimensions)
    .sort((a, b) => String(a.title ?? '').localeCompare(String(b.title ?? '')));
}

/*
  ONE IMAGE, THE HUB'S OWN.

  This used to gather up to six stills and cross-fade them, pulling from the
  thumbnails of videos tagged to the hub and then from its category. It was a
  neat trick and it was the wrong call: those thumbnails are the channel's own
  video covers, which means they are frequently a photograph of the presenter.
  A hub is somebody else's brand — Marvel's backdrop cannot be a picture of the
  site owner, and "the top of my head behind the Marvel logo" is how it was
  actually spotted.

  So a hub's backdrop is a hub's own art and nothing else: whatever image has
  been chosen for it, blurred, with a slow drift. Borrowing footage from a
  neighbouring category was solving a content gap with someone else's face, and
  a hub with no art yet is better served by the brand-tinted ground it already
  falls back to.

  It is also far less machinery — no cycling timer, no staged hydration, no
  tiers, and one image per hub instead of six.
*/
export type HubBackdrop = { kind: 'sanity'; ref: any };

/**
 * The backdrop a hub was given ON PURPOSE — its `backdrops[0]`, and nothing
 * else.
 *
 * getHubBackdrop() below falls back to `heroImage`, which is right for a hub
 * PAGE (one image, used once). It is wrong for /featured, where `heroImage` is
 * already the deck card AND the nav rail thumbnail: falling back there painted
 * the same picture three times in one row at three sizes, reported as "way too
 * much repetition of the same damn image".
 *
 * So /featured asks for the override only, and falls through to the hub's mark
 * when there isn't one. Two callers, two different questions, rather than one
 * function quietly answering the wrong one.
 */
export function getHubBackdropOverride(slug: string): HubBackdrop | null {
  const brand = (localVideos as any[]).find(
    (d) => d._type === 'featuredBrand' && d.slug?.current === slug,
  );
  const override = (brand?.backdrops ?? []).find(Boolean);
  return override ? { kind: 'sanity', ref: override } : null;
}

/**
 * The single image behind a hub, or null if it has none yet.
 *
 *   1. `backdrops[0]` — an explicit override, for when the key art does not
 *      work blurred (a logo on flat white goes to nothing).
 *   2. `heroImage` — the hub's own key art, which is the normal case.
 *
 * Nothing else. A hub with neither falls through to the brand-tinted gradient
 * the page already draws, which reads as a deliberate title card rather than a
 * gap.
 */
export function getHubBackdrop(slug: string): HubBackdrop | null {
  const brand = (localVideos as any[]).find(
    (d) => d._type === 'featuredBrand' && d.slug?.current === slug,
  );
  if (!brand) return null;

  const override = (brand.backdrops ?? []).find(Boolean);
  if (override) return { kind: 'sanity', ref: override };
  if (brand.heroImage) return { kind: 'sanity', ref: brand.heroImage };
  return null;
}

/*
  The hub taxonomy labels moved to ./hub-labels.ts so the offline suites can
  import them: this file statically imports videos.json, and plain `node`
  refuses a JSON import without a type attribute. Re-exported here so every
  existing `from '../lib/local-content'` keeps working.
*/
export { HUB_CATEGORY_LABELS, HUB_KIND_LABELS, getHubKindHeading } from './hub-labels.ts';
