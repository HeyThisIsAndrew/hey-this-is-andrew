/**
 * Resolve a feed item to the hub it belongs to — a `featuredBrand` OR an `event`.
 *
 * ─── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * ContentCard and FeedSpotlightHero each had their own copy of this lookup, and
 * both searched `getFeaturedBrandsLocal()` ONLY. Conventions are stored as
 * `_type: 'event'`, so an L.A. Comic Con item could never resolve to anything:
 * the card shipped an empty `data-brand`, the hero fell back to the BE
 * Unconventional HQ crown, and nothing looked broken enough to notice.
 *
 * One function now, used by both, and it searches both document types.
 *
 * ─── IT IS PURE, AND THAT IS DELIBERATE ─────────────────────────────────────
 * Hubs and `urlFor` are passed IN rather than imported. `local-content.ts`
 * statically imports `videos.json`, which plain `node` refuses without a type
 * attribute, so anything importing it cannot be unit-tested by the offline
 * suites (the same reason `hub-labels.ts` is a separate file). Injecting the
 * dependencies keeps `scripts/entity-resolver.test.mjs` able to run this.
 */
import { getDisplayTags } from './tags.ts';
import { findHubForItem } from './hub-coverage.ts';

export interface ResolvedEntity {
  type: 'brand' | 'event';
  slug: string;
  url: string;
  title: string;
  logo: string | null;
  hero: string | null;
  color: string;
}

export interface ResolveDeps {
  brands?: any[];
  events?: any[];
  /** `urlFor` from local-content. Injected so this module stays testable. */
  urlFor?: (source: any) => { url: () => string };
}

const DEFAULT_COLOR = '#CC0000';

/**
 * A hex colour as the `R, G, B` triple an `rgba(var(--x), a)` needs.
 *
 * Lives here because this module is already the place that normalises a hub's
 * colour (a brand stores `brandColor.hex`, an event sometimes a bare string).
 *
 * NOTE: seven components carry their own private copy of this function. They
 * are not touched here — that is its own change — but new callers should import
 * this one rather than make it eight.
 */
export function hexToRgbTriple(hex: string | null | undefined, fallback = '204, 0, 0'): string {
  if (!hex) return fallback;
  const clean = String(hex).replace('#', '').trim();
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  if (full.length !== 6) return fallback;
  const num = Number.parseInt(full, 16);
  if (Number.isNaN(num)) return fallback;
  return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
}

const slugOf = (doc: any): string | null => {
  const slug = doc?.slug;
  if (typeof slug === 'string') return slug || null;
  return slug?.current || null;
};

const hexOf = (doc: any): string => {
  const raw = doc?.brandColor;
  const hex = typeof raw === 'string' ? raw : raw?.hex;
  return hex || DEFAULT_COLOR;
};

/**
 * Shape a matched document into the contract both components consume.
 *
 * An event's mark prefers `heroLogo` over `logo`, matching the event hero's own
 * precedence (see the THREE mark slots note in CLAUDE.md). A brand has one.
 */
function shape(doc: any, kind: 'brand' | 'event', urlFor?: ResolveDeps['urlFor']): ResolvedEntity | null {
  const slug = slugOf(doc);
  if (!slug) return null;

  const mark = kind === 'event' ? doc.heroLogo || doc.logo : doc.logo;

  /*
    ─── ASK SANITY FOR A SIZE, ALWAYS ────────────────────────────────────────

    A bare `urlFor(src).url()` returns the ORIGINAL asset. For a hub's
    heroImage that is a 3840x2160 PNG — 3 MB — and it was being loaded as the
    Feed hero's backdrop on every page view. Lighthouse measured /feed at
    LCP 19.6s against it, with that single request the heaviest on the page by
    a factor of twenty-four.

    The backdrop is `.hero-backdrop-plate`, which is blurred 9px and overscanned
    12%, so almost none of that detail can survive to the screen. CLAUDE.md
    states the convention outright: a blurred plate is deliberately requested
    SMALL, because the blur destroys more than the upsample costs. 1280 is
    generous for a plate nobody can focus on.

    `auto('format')` lets Sanity serve WebP where the browser takes it, which
    is most of the remaining weight on the logo too.

    Both chains are safe on either branch of `urlFor`: a non-Sanity string goes
    through `plainUrlBuilder`, a Proxy that returns itself for any method and
    the original URL from `.url()`.
  */
  const safeUrl = (source: any, size: (b: any) => any): string | null => {
    if (!source || !urlFor) return null;
    try {
      return size(urlFor(source)).url();
    } catch {
      /* A malformed asset ref must not take a card or the hero down with it. */
      return null;
    }
  };

  return {
    type: kind,
    slug,
    url: kind === 'brand' ? `/featured/${slug}` : `/events/${slug}`,
    title: doc.title || '',
    /* 320 tall matches HubCard and the event heroes — this mark renders small. */
    logo: safeUrl(mark, (b) => b.height(320).auto('format')),
    /*
      2560, raised from 1280. The plate is blurred and overscanned so it is
      deliberately asked for SMALL — the note above is still the reasoning, and
      a 3 MB original was the LCP problem it solved. But 1280 was chosen when
      the hero was at most ~1536 wide. The page steps up on wide screens now and
      the plate renders ~4200px on a 4K display, where a 1280 source came back a
      3.28x upscale.

      MEASURED, with a real browser's Accept header rather than curl's default —
      `auto('format')` serves AVIF/WebP, and reading the PNG figures instead
      makes this look ~30x more expensive than it is:

        1280   9.8 KB (avif)   3.28x
        1920  27.0 KB (webp)   2.19x
        2560  53.1 KB (webp)   1.64x

      53 KB is 1.7% of the original that caused the LCP regression, so the
      trade the old note describes is still being honoured — it was never
      "small at any cost", it was "not the 3 MB original".
    */
    hero: safeUrl(doc.heroImage, (b) => b.width(2560).auto('format')),
    color: hexOf(doc),
  };
}

const bySlug = (docs: any[], slug: string) => docs.find((d) => slugOf(d) === slug) || null;

/**
 * Resolve `item` to its hub, or null when nothing claims it.
 *
 * ─── THE ORDER, AND WHY EACH STEP IS WHERE IT IS ────────────────────────────
 *
 *   1. `relatedBrandSlug` — an editor said so outright. Nothing outvotes it.
 *
 *   2. `item.hubs` — the taxonomy the YouTube sync writes. This is how VIDEOS
 *      carry their hub, and it is exact: no guessing, no scoring.
 *
 *   3. `findHubForItem()` — how ARTICLES carry theirs. Articles sync from
 *      Substack and have no `hubs` field at all, so their hub is inferred by
 *      scoring the hub's own keyword list against the piece's tags. That
 *      function is the site's ONE tag matcher (CLAUDE.md is explicit that
 *      coverage matching must not be reimplemented) and its `compactTag`
 *      normalisation is what makes this work: L.A. Comic Con's keyword
 *      "lacc2026" matches the article's tag "LACC2026", which an exact
 *      title-to-tag comparison would have missed entirely.
 *
 * Brands are searched before events at every step, so a title that exists as
 * both resolves to the brand.
 */
export function resolveEntity(item: any, deps: ResolveDeps = {}): ResolvedEntity | null {
  if (!item) return null;
  const brands = deps.brands ?? [];
  const events = deps.events ?? [];
  const { urlFor } = deps;

  // 1. Explicit editorial pointer.
  if (item.relatedBrandSlug) {
    const brand = bySlug(brands, item.relatedBrandSlug);
    if (brand) return shape(brand, 'brand', urlFor);
    const event = bySlug(events, item.relatedBrandSlug);
    if (event) return shape(event, 'event', urlFor);
  }

  // 2. The sync's own taxonomy.
  const hubs: string[] = Array.isArray(item.hubs) ? item.hubs.filter(Boolean) : [];
  if (hubs.length > 0) {
    /*
      ─── AMONG SEVERAL HUBS, THE ITEM'S OWN HEADLINE TAG DECIDES ────────────

      A Lanterns review carries `hubs: ["hbo-max", "dc-comics", "warner-bros"]`
      — all three are true, and taking the first would have made every Lanterns
      item an HBO Max item. The hero has shown the DC roundel for these all
      along, because the previous lookup matched on the card's own display tag,
      and switching it to HBO Max would be a visible regression nobody asked
      for.

      `getDisplayTags()` is the same function that prints "DC | REVIEW" under
      the card, so this picks whichever hub the item already says it is about,
      and falls back to array order when none of them is named.
    */
    const named = new Set(getDisplayTags(item).map((t) => t.toUpperCase()));
    const candidates = [
      ...hubs.map((slug) => ({ doc: bySlug(brands, slug), kind: 'brand' as const })),
      ...hubs.map((slug) => ({ doc: bySlug(events, slug), kind: 'event' as const })),
    ].filter((c) => c.doc);

    const preferred =
      candidates.find((c) => named.has(String(c.doc.title || '').toUpperCase())) || candidates[0];

    if (preferred) return shape(preferred.doc, preferred.kind, urlFor);
  }

  // 3. Tag inference, for anything with no hubs of its own.
  const inferred = findHubForItem(item, [...brands, ...events]);
  if (inferred) {
    const kind = inferred._type === 'event' ? 'event' : 'brand';
    return shape(inferred, kind, urlFor);
  }

  return null;
}
