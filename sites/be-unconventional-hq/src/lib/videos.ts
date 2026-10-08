import { PUBLISH_TIME_ZONE } from './publish-timezone.js';
/**
 * Video read-path: Sanity `video` documents → the shape pages already render.
 *
 * This module fetches UnifiedVideo directly from Sanity.
 * The legacy caching system has been completely removed to ensure all videos
 * strictly adhere to the network-verified `isShort` tagging system.
 *
 * Editorial gate: only contentStatus == "published" docs are surfaced, so
 * ingesting the whole channel never floods the site — editors promote videos
 * deliberately.
 */

/** Sanity-sourced entries. */
export interface UnifiedVideo {
  title: string;
  description?: string;
  link: string;
  thumbnail: string;
  category: string;
  badge1?: string;
  badge2?: string;
  badge3?: string;
  /* The feed hero's editorial overrides. See the mapping below. */
  customHeroLogo?: string;
  customHeroBrandLabel?: string;
  tags?: string[];
  youtubeTags?: string[];
  date: string;
  isShort: boolean;
  isLive: boolean;
  isEvent: boolean;
  contentType: 'video';
  youtubeId?: string;
  durationSeconds?: number;
  featured?: boolean;
  /** Raw ISO publish timestamp (Sanity only) — the Dispatch Log needs a real
   *  instant, not the display-string `date`. */
  publishedAt?: string;
  /** Editorial ordering override. Changes row position, never the shown date. */
  sortDate?: string;
  /** Marks which pipeline produced the entry. */
  source: 'sanity';

  // Editorial & Taxonomy Extensions
  contentStatus?: string;
  manualTypeOverride?: string;
  franchises?: string[];
  characters?: string[];
  coverageType?: string;
  series?: string;
  /**
   * Puts this item's SERIES on the Feed as a curated collection of its own.
   *
   * Strictly scoped to that. It is NOT a second `featured`: `featured` says
   * this PIECE deserves elevated placement, this says this piece's SERIES
   * deserves a dedicated shelf. Coupling them would mean unflagging a video to
   * demote it silently killed a whole collection.
   *
   * Several series may be flagged at once; the Feed renders one collection per
   * flagged series, most recently updated first. With none flagged it falls
   * back to the most recently updated qualifying series, so the shelf is never
   * empty because nobody has been into the CMS this week.
   */
  featuredSeries?: boolean;
  /**
   * The collection's own accent colour, overriding the hub's `brandColor`.
   *
   * A show is not its studio. Lanterns is a DC property and DC is blue, but
   * the show's identity is emerald and the shelf is themed for the SHOW. Read
   * from any member of the series, so it survives the flagged item changing.
   */
  seriesAccent?: string;
  hubs?: string[];
  editorialNotes?: string;
  /**
   * Words written FOR this site, overriding anything the platform supplied.
   *
   * Articles have carried this since the Substack sync (src/lib/articles.ts);
   * videos had no equivalent, which is why every card and the hero fell back to
   * a YouTube description written for a different audience. Same field name and
   * same meaning on both, so `editorialPreview()` reads one path for either.
   *
   * Optional, and a video without one degrades to its title and metadata rather
   * than to somebody's gear list.
   */
  editorial?: {
    excerpt?: string;
  };
  requiresReview?: boolean;
  manualTaxonomyOverride?: boolean;
  relatedMedia?: { title: string; mediaType: string }[];
}

/** Published queries. Kept minimal: pages do their own slicing. */
export function buildPublishedQuery(docType: string = 'video') {
  return `*[_type == "${docType}" && contentStatus == "published"] | order(publishedAt desc) [0...1000] {
    youtubeId, title, description, thumbnailUrl, durationSeconds, isShort, isLive, isEvent, publishedAt,
    youtubeTags, "topics": topics[]->slug.current, featured
  }`;
}

/** The four site categories; topics outside this set fall through. */
const SITE_CATEGORIES: Record<string, string> = {
  film: 'Film',
  tv: 'TV',
  gaming: 'Games',
};

export interface MapOptions {
  categorize?: (text: string) => string;
}

/**
 * Map one Sanity `video` doc to the page-facing shape. Editorial topics win
 * over any heuristic: an editor tagging "gaming" beats title-regex guessing.
 */
export function mapSanityVideo(doc: any, { categorize }: MapOptions = {}): UnifiedVideo | null {
  const id: string | null = doc?.youtubeId ?? null;
  if (!id || !doc?.title) return null;

  const topicMatch = (doc.topics ?? [])
    .map((t: unknown) => SITE_CATEGORIES[String(t).toLowerCase()])
    .find(Boolean);

  const published = doc.publishedAt ? new Date(doc.publishedAt) : null;
  const date =
    published && !Number.isNaN(published.getTime())
      ? // Same long form the legacy cache stores ("July 12, 2026").
        published.toLocaleDateString('en-US', { timeZone: PUBLISH_TIME_ZONE, month: 'long', day: 'numeric', year: 'numeric' })
      : '';

  const effectiveType = doc.manualTypeOverride || doc._type || 'video';
  const isShort = effectiveType === 'short' || (doc.isShort ?? false);
  const isLive = effectiveType === 'live' || (doc.isLive ?? false);
  const isEvent = effectiveType === 'event' || (doc.isEvent ?? false);

  return {
    title: doc.title,
    description: doc.description,
    link: isShort
      ? `https://www.youtube.com/shorts/${id}`
      : `https://www.youtube.com/watch?v=${id}`,
    thumbnail: doc.thumbnailUrl || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    category: topicMatch ?? categorize?.(doc.title) ?? 'General',
    badge1: doc.badge1,
    badge2: doc.badge2,
    badge3: doc.badge3,
    tags: (doc.topics ?? []).map(String),
    youtubeTags: doc.youtubeTags ?? [],
    date,
    isShort,
    isLive,
    featured: doc.featured || false,
    isEvent,
    contentType: effectiveType as any,
    youtubeId: id,
    durationSeconds: doc.durationSeconds,
    publishedAt: doc.publishedAt ?? undefined,
    source: 'sanity',
    
    // Extensions
    contentStatus: doc.contentStatus,
    manualTypeOverride: doc.manualTypeOverride,
    franchises: doc.franchises ?? [],
    characters: doc.characters ?? [],
    coverageType: doc.coverageType,
    series: doc.series,
    /* Named here as well as carried by the sync: this mapping is an explicit
       whitelist, so a field missing from it never reaches the feed at all. */
    featuredSeries: doc.featuredSeries ?? false,
    seriesAccent: doc.seriesAccent,
    hubs: doc.hubs ?? [],
    editorialNotes: doc.editorialNotes,
    /*
      THE FEED HERO'S OVERRIDES, AND THEY HAVE NEVER ONCE WORKED.

      FeedSpotlightHero.astro has read `customHeroLogo` and
      `customHeroBrandLabel` for as long as they have existed, and this mapping
      has never passed them, so the cascade they sit at the top of could not
      fire whatever an editor put in the store. Not a regression: a path that
      was dead the whole time, and silent about it, because a hero falling back
      to the HQ crown looks exactly like a hero nobody has customised.

      This is the third field on this line to be caught by the same whitelist
      (see `editorial` and `sortDate` above), which is the argument for reading
      those notes before adding a field anywhere else in this pipeline.
    */
    customHeroLogo: doc.customHeroLogo,
    customHeroBrandLabel: doc.customHeroBrandLabel,
    /* The standfirst. Named here for the same whitelist reason as sortDate
       below: the sync can preserve it perfectly and it still never reaches a
       card unless this mapping copies it. */
    editorial: doc.editorial,
    /*
      Ordering override, and it has to be listed HERE as well as carried by the
      sync. This mapping is an explicit whitelist, so a field the sync preserves
      perfectly still never reaches the feed unless it is named on this line.
      That is exactly how the first attempt at this silently did nothing.
    */
    sortDate: doc.sortDate || undefined,
    requiresReview: doc.requiresReview ?? false,
    manualTaxonomyOverride: doc.manualTaxonomyOverride ?? false,
    relatedMedia: doc.relatedMedia ?? [],
  };
}

/**
 * Entry point: Sanity-only fetch. 
 */
export async function getUnifiedVideos(
  client: { fetch: (query: string) => Promise<any[]> },
  options: MapOptions = {},
  query: string = buildPublishedQuery('video'),
): Promise<UnifiedVideo[]> {
  try {
    const docs = (await client.fetch(query)) ?? [];
    if (!Array.isArray(docs)) {
      console.warn('[videos] Expected array from Sanity fetch, got:', typeof docs);
      return [];
    }
    return docs
      .map((d) => mapSanityVideo(d, options))
      .filter((v): v is UnifiedVideo => v !== null);
  } catch (e) {
    console.error('[videos] Sanity fetch failed.', e);
    throw e;
  }
}
