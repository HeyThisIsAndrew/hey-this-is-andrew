/**
 * The homepage's Featured section: WHAT it features, and where it links.
 *
 * It mirrors /feed's featured shelf rather than naming a show itself (it used
 * to hardcode "Lanterns", which Andrew caught: the section must be the feed's
 * featured section, and fall back to plain featured content when there is
 * none). So it asks the feed's own functions, in src/lib/feed-rails.ts:
 *
 *   COLLECTION  selectCollections() picks the collection an editor flagged
 *               (`featuredSeries`), exactly as FeedGrid does for its first
 *               prestige shelf. Its members, its eyebrow ("FEATURED SERIES •
 *               DC"), its accent (seriesAccent, else the hub's brandColor,
 *               never white) and its anchor, `/feed#<seriesSlug>`, which
 *               FeedGrid's scrollToHashRow() lands on.
 *   SITE        No collection: the site's featured videos first, then the
 *               newest stories, under a plain "Featured on the HQ" and a link
 *               to /feed. No accent: the section keeps the site's red.
 *
 * Either way it skips anything the hero already shows (`exclude`), so no story
 * appears twice on the page. Items are feed records (getAllFeedItems), the
 * shape FeaturedHighlights renders.
 */
import { getAllFeedItems } from '../lib/feed-items';
import { selectCollections, inSeries, accentFor, byNewest, seriesSlug } from '../lib/feed-rails';
import { resolveEntity, hexToRgbTriple } from '../lib/entity-resolver';
import { getFeaturedBrandsLocal, getEventsLocal, urlFor } from '../lib/local-content';
import { rowArt } from '../lib/row-art';

export interface HomeFeatured {
  kind: 'collection' | 'site';
  /** The collection's name ("Lanterns"); null for the site fallback. */
  title: string | null;
  /** The show's own logo (src/assets/rows/<slug>-logo.*), shown instead of a
      typeset title. The feed's rule: only when its key art exists too. */
  logo: ImageMetadata | null;
  eyebrow: string;
  /** Where "Explore on the feed" goes. */
  href: string;
  /** Brand/IP accent, or null to keep the site's red. */
  accentHex: string | null;
  accentRgb: string | null;
  /** Whole collection size, hero-borrowed stories included. */
  total: number;
  items: any[];
}

const MAX_ITEMS = 4;

/** `video:<id>` for a video, its link for anything else. */
export const featuredKey = (item: any): string =>
  item?.youtubeId ? `video:${item.youtubeId}` : String(item?.link ?? '');

/* Videos first, so the box opens on something that plays, as production's
   does; then articles. Each group newest first. */
const videosFirst = (items: any[]) => [
  ...items.filter((i) => i?.type === 'video' || i?.youtubeId),
  ...items.filter((i) => !(i?.type === 'video' || i?.youtubeId)),
];

export async function getHomeFeatured(exclude: Set<string> = new Set()): Promise<HomeFeatured | null> {
  let all: any[] = [];
  try {
    all = await getAllFeedItems();
  } catch (err) {
    console.error('[homepage-featured] feed items unavailable:', err);
    return null;
  }
  const free = (i: any) => !exclude.has(featuredKey(i));

  const chosen = selectCollections(all)[0];
  if (chosen) {
    const members = all.filter((i) => inSeries(i, chosen.name)).sort(byNewest);
    const items = videosFirst(members.filter(free)).slice(0, MAX_ITEMS);
    if (items.length > 0) {
      const hub = members.reduce<ReturnType<typeof resolveEntity>>(
        (found, i) => found ?? resolveEntity(i, { brands: getFeaturedBrandsLocal(), events: getEventsLocal(), urlFor }),
        null,
      );
      /* The feed's own three rungs, minus the last: where it falls back to the
         site red, this leaves the accent null and the section keeps its red. */
      const rawHub = (hub as any)?.color;
      const hubHex = typeof rawHub === 'string' ? rawHub : rawHub?.hex ?? null;
      const usableHub = hubHex && hubHex.toLowerCase() !== '#ffffff' ? hubHex : null;
      const accentHex = accentFor(members) || usableHub || null;
      const slug = seriesSlug(chosen.name);
      return {
        kind: 'collection',
        title: chosen.name,
        logo: rowArt(`${slug}-key-art`) ? rowArt(`${slug}-logo`) : null,
        eyebrow: hub ? `Featured series • ${hub.title}` : 'Featured series',
        href: `/feed#${slug}`,
        accentHex,
        accentRgb: accentHex ? hexToRgbTriple(accentHex) : null,
        total: members.length,
        items,
      };
    }
  }

  /* No flagged collection (or the hero already shows all of it). */
  const pool = all.filter(free).sort(byNewest);
  let baseItems = [...pool.filter((i) => i?.featured === true), ...pool.filter((i) => i?.featured !== true)];
  
  if (baseItems.length > 0) {
    const leadSeries = baseItems[0]?.series;
    if (leadSeries) {
      baseItems = baseItems.filter((i) => inSeries(i, leadSeries));
    }
  }
  
  const items = baseItems.slice(0, MAX_ITEMS);
  if (items.length === 0) return null;
  return {
    kind: 'site',
    title: null,
    logo: null,
    eyebrow: 'Featured on the HQ',
    href: '/feed',
    accentHex: null,
    accentRgb: null,
    total: items.length,
    items: videosFirst(items),
  };
}
