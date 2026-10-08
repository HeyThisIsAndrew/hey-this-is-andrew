/**
 * What rails the Feed shows, and what goes in them.
 *
 * ─── WHAT THIS REPLACES ─────────────────────────────────────────────────────
 * A hand-written `SECTION_DEFS` array inside FeedGrid.astro: 6 sections over 14
 * rows, every hub named individually. It had three problems, all measured
 * against the real store:
 *
 *   1. IT EXPOSED THE CMS DIRECTLY. Three headings for HBO Max, Netflix and
 *      Prime Video answer a question nobody asks. "What's on streaming" is one
 *      question and it deserves one rail.
 *
 *   2. IT WENT STALE SILENTLY. The list omitted the `studios` category
 *      entirely, so 17 stories had no presence on the Feed at all, including
 *      Warner Bros with 11 — the single largest hub in the store. Adding a hub
 *      in the CMS did nothing until somebody edited this file.
 *
 *   3. IT PRINTED ONE LIST THREE TIMES. "All Content" was exactly
 *      "All Videos" ∪ "All Articles", a set identity, and those three rows were
 *      82 of the page's 160 tile placements. 51% of the page, discovering
 *      nothing.
 *
 * ─── THE TAXONOMY IS ALREADY IN THE CMS ─────────────────────────────────────
 * `hubCategory` is a field on every hub document and it already groups the 18
 * hubs into four buckets that /featured already renders and HUB_CATEGORY_LABELS
 * already names: Franchises, Streamers, Studios, Games. The Feed just was not
 * reading it.
 *
 * So the rails derive from the same field the hub directory uses. Re-categorise
 * a hub in the CMS and both pages follow. Add a hub and it joins its rail with
 * no code change. No new taxonomy was invented for this.
 *
 * ─── WHAT CONSOLIDATION DOES AND DOES NOT DO ────────────────────────────────
 * It does NOT de-duplicate. Measured: the hubs inside a category barely overlap
 * (universes 13 placements -> 13 stories, streaming 17 -> 17, studios 17 -> 17).
 * Merging them is close to lossless, which is the argument FOR doing it, but
 * the win is fewer headings and a Feed that stops reading like a database, not
 * a lower repetition count.
 *
 * A story appearing in Lanterns AND Franchises AND Streamers is MEANINGFUL
 * repetition: three different questions, three different answers, same story.
 * That is how a browse surface is supposed to work and it is left alone.
 */
import { HUB_CATEGORY_LABELS } from './hub-labels.ts';
import { compactTag } from './hub-coverage.ts';

/**
 * The order the hub categories appear in, and the only thing about the rail set
 * that is a design decision rather than data.
 *
 * Matches /featured's own `desiredOrder`, deliberately: the row a reader opens
 * on the hub directory and the rail they scroll on the Feed should be the same
 * set in the same order, or the two pages are telling different stories about
 * the same content.
 */
export const HUB_CATEGORY_ORDER = ['universes', 'streaming', 'studios', 'gaming'] as const;

/**
 * Topic rails, which are a different axis from the hub categories.
 *
 * A hub rail answers "whose is it" and a topic rail answers "what kind of thing
 * is it". They overlap heavily on purpose: TV overlaps Streamers on 13 of 17
 * stories, because a prestige drama on HBO Max is genuinely both. Medium is how
 * a lot of people browse entertainment and dropping it would cost more than the
 * duplication it saves.
 *
 * Games is NOT here. It is a hub category AND a topic, and splitting it across
 * both would put PlayStation coverage in one rail and "a game piece with no
 * platform hub" in another. They merge in `buildRails()`.
 */
export const TOPIC_RAILS = [
  { id: 'film', title: 'Film', topic: 'film' },
  { id: 'tv', title: 'TV', topic: 'tv' },
] as const;

/** How many tiles a rail carries before it stops. */
export const RAIL_LIMIT = 12;

/** The Latest carries more: it is the newsroom and the reason most people came. */
export const LATEST_LIMIT = 18;

export interface Rail {
  id: string;
  title: string;
  items: any[];
  /** Where "explore" goes, when the rail maps to a real destination. */
  href?: string | null;
  /**
   * The name this rail answers to in a URL, when that differs from its `id`.
   * See RAIL_ANCHORS.
   */
  anchor?: string;
}

/*
  ─── THE RAIL'S INTERNAL NAME AND ITS PUBLIC ONE ARE NOT ALWAYS THE SAME ────

  A hub-category rail's `id` is its `hubCategory` verbatim, because that is the
  CMS's word for it and the rest of this file reasons in those terms. But the
  category a READER browses by has its own canonical slug, declared once in
  `src/data/constants.js`, and for this one category the two disagree: the CMS
  says `gaming`, the site's category taxonomy says `games` with `gaming` listed
  as a tag spelling that means it.

  That is not a naming quibble, it was a dead link. The homepage's Games tile
  pointed at `/feed#games`, and so does the note in
  Layout.astro that gives such a link its downward transition, while the
  section on the page was `id="gaming"` — so the tile navigated to /feed and
  then landed nowhere, silently, which looks like the anchor feature being
  broken rather than one name being spelled two ways.

  Renaming the CATEGORY to match the rail was the other option and is the wrong
  one: `constants.js` documents that this rename was already made once in the
  other direction, `/category/games` is a built and indexed route, and
  `CATEGORY_TAG_ALIASES` has no `gaming` key, so a slug of `gaming` would fall
  through to matching the literal tag and quietly drop everything tagged
  `games`.

  So the id stays the CMS's, the anchor becomes the reader's. FeedGrid renders
  the anchor as the element's `id` and keeps the rail's own id on `data-row`,
  and its scroll handler already resolves either one.
*/
export const RAIL_ANCHORS: Record<string, string> = {
  gaming: 'games',
};

export interface CuratedCollection {
  id: string;
  /** The series name, exactly as an editor typed it. */
  name: string;
  accent: string | null;
  items: any[];
  /** Why this collection is on the page. Reported, never rendered. */
  reason: string;
}

/**
 * Whether an item belongs to a named series.
 *
 * TWO SOURCES, AND THE SECOND IS NOT A SHORTCUT. `series` is an editorial field
 * on a video. Articles sync from Substack and carry no such field, so matching
 * on it alone would make every collection video-only — the Lanterns package
 * would silently lose both of its articles, which is the same defect the hub
 * rows had before they learned to read article tags.
 *
 * So an article joins its collection through its own tags, compared with the
 * site's `compactTag` normalisation like every other tag match here. Checked in
 * that order, so setting `series` on an item is always the stronger statement.
 */
export function inSeries(item: any, name: string): boolean {
  const wanted = compactTag(name);
  if (!wanted) return false;
  if (compactTag(item?.series) === wanted) return true;
  const pools = [item?.youtubeTags, item?.tags];
  return pools.some((pool) => Array.isArray(pool) && pool.some((t: any) => compactTag(t) === wanted));
}

/** Newest first, honouring the editorial ordering override. */
export function sortTime(item: any): number {
  for (const raw of [item?.sortDate, item?.isoDate, item?.date, item?.publishedAt]) {
    if (!raw) continue;
    const t = new Date(raw).getTime();
    if (!Number.isNaN(t)) return t;
  }
  /* Unparseable sorts last rather than to the top of the Feed. */
  return 0;
}

export function byNewest(a: any, b: any): number {
  return sortTime(b) - sortTime(a);
}

/**
 * Which series get a dedicated collection, and in what order.
 *
 * EXPLICIT FIRST, like `forceSpotlightHero` on the events page: an editor flags
 * an item and its series takes a shelf. SEVERAL may be flagged, and each gets
 * its own — that is the point, because a dedicated section for the show being
 * covered right now should not be a single privileged slot.
 *
 * The fallback exists so the shelf is never empty: with nothing flagged, the
 * most recently updated series that has a real run behind it (two pieces or
 * more) takes the position.
 */
export function selectCollections(items: any[]): Array<{ name: string; reason: string }> {
  const seriesOf = (i: any) => String(i?.series ?? '').trim();

  const flagged = [...new Set(items.filter((i) => i?.featuredSeries === true).map(seriesOf).filter(Boolean))];
  if (flagged.length > 0) {
    return flagged
      .map((name) => ({
        name,
        newest: Math.max(...items.filter((i) => inSeries(i, name)).map(sortTime), 0),
      }))
      .sort((a, b) => b.newest - a.newest)
      .map(({ name }) => ({ name, reason: 'flagged in the CMS as a featured collection' }));
  }

  const names = [...new Set(items.map(seriesOf).filter(Boolean))];
  const best = names
    .map((name) => {
      const members = items.filter((i) => inSeries(i, name));
      return { name, count: members.length, newest: Math.max(...members.map(sortTime), 0) };
    })
    .filter((s) => s.count >= 2)
    .sort((a, b) => b.newest - a.newest)[0];

  return best ? [{ name: best.name, reason: 'nothing is flagged, so the most recently updated series was used' }] : [];
}

/** The collection's accent, read from ANY member so it outlives one document. */
/**
 * A collection's row id on /feed, and so its anchor: `/feed#<seriesSlug>`
 * scrolls to that shelf (FeedGrid's scrollToHashRow). Shared with the
 * homepage's Featured section, which links there, so the two cannot drift.
 */
export function seriesSlug(name: string): string {
  return String(name)
    .toLowerCase()
    .replace(/[\u2018\u2019']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function accentFor(members: any[]): string | null {
  const hex = members
    .map((i: any) => (typeof i?.seriesAccent === 'string' ? i.seriesAccent.trim() : ''))
    .find((h: string) => /^#[0-9a-f]{6}$/i.test(h));
  return hex || null;
}

export interface BuildOptions {
  /** Hub documents, for the category rails. */
  hubs: any[];
  /** Does this item belong to the hub with this slug? Supplied by the caller,
   *  which already owns the tag/slug matching the rest of the page uses. */
  matchesHub: (item: any, slug: string) => boolean;
  /** Does this item carry this Tier-1 topic? Same reason. */
  hasTopic: (item: any, topic: string) => boolean;
  /** Where a category rail's explore link points. */
  hrefForCategory?: (category: string) => string | null;
  /**
   * Items already shown in a curated collection at the top of the page.
   *
   * They are NOT removed from the rails below. They are sorted to the BACK of
   * each one, which is a different thing and the distinction is the whole point:
   * a Lanterns review genuinely belongs in Franchises, Streamers, Studios and
   * TV, and cutting it out of all four would be the rigid de-duplication that
   * makes a browse surface feel thin.
   *
   * What it must not do is LEAD all four. Lanterns is DC and HBO Max and Warner
   * Bros, so without this the next four rails opened with the same three tiles
   * and the same artwork, one after another, immediately under the shelf that
   * had just shown them. That reads as the page repeating itself even though
   * every one of those memberships is real.
   */
  alreadyShown?: Set<any>;
}

const slugOf = (doc: any) =>
  typeof doc?.slug === 'string' ? doc.slug : doc?.slug?.current ?? null;

/**
 * The full rail set, in render order.
 *
 * Rails that match nothing are dropped, so an empty category never ships as a
 * bare heading over nothing. That matters more than it sounds: six of the
 * eighteen hubs currently match no content at all (Star Wars, Harry Potter,
 * Peacock, Apple TV+, Nintendo, Disney). Consolidated they simply contribute
 * nothing until they do, rather than each needing to be special-cased.
 */
export function buildRails(items: any[], options: BuildOptions): Rail[] {
  const { hubs, matchesHub, hasTopic, hrefForCategory, alreadyShown } = options;
  const all = [...items].sort(byNewest);

  /*
    Newest first, EXCEPT that anything already shown in a collection above waits
    its turn. Within each group the order is still chronological, so a rail
    reads normally; it just does not open with the tile the reader has scrolled
    past three times already.
  */
  const leadWithUnseen = (list: any[]) => {
    if (!alreadyShown || alreadyShown.size === 0) return list;
    const fresh = list.filter((i) => !alreadyShown.has(i));
    const seen = list.filter((i) => alreadyShown.has(i));
    return [...fresh, ...seen];
  };

  const rails: Rail[] = [];

  /*
    THE LATEST IS ONE RAIL.

    It was three — All Content, All Videos, All Articles — and the first was
    exactly the union of the other two. Splitting a chronological feed by medium
    is a filter, not a discovery path, and it cost 41 duplicate placements to
    say nothing.
  */
  rails.push({ id: 'latest', title: 'The Latest', items: all.slice(0, LATEST_LIMIT), href: null });

  const byCategory = new Map<string, any[]>();
  for (const hub of hubs) {
    const category = hub?.hubCategory;
    if (!category) continue;
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category)!.push(hub);
  }

  for (const category of HUB_CATEGORY_ORDER) {
    const members = byCategory.get(category) ?? [];
    if (members.length === 0) continue;
    const slugs = members.map(slugOf).filter(Boolean) as string[];

    let matched = all.filter((item) => slugs.some((slug) => matchesHub(item, slug)));

    /*
      GAMES IS BOTH A HUB CATEGORY AND A TOPIC, so it is the one rail built from
      both. A piece about a game with no platform hub attached is still games
      coverage, and splitting those across two rails would be the CMS showing
      through again.
    */
    if (category === 'gaming') {
      const seen = new Set(matched);
      for (const item of all) {
        if (!seen.has(item) && hasTopic(item, 'games')) matched.push(item);
      }
      matched = matched.sort(byNewest);
    }

    if (matched.length === 0) continue;
    rails.push({
      id: category,
      title: HUB_CATEGORY_LABELS[category] ?? category,
      items: leadWithUnseen(matched).slice(0, RAIL_LIMIT),
      href: hrefForCategory?.(category) ?? null,
      anchor: RAIL_ANCHORS[category],
    });
  }

  for (const rail of TOPIC_RAILS) {
    const matched = all.filter((item) => hasTopic(item, rail.topic));
    if (matched.length === 0) continue;
    rails.push({ id: rail.id, title: rail.title, items: leadWithUnseen(matched).slice(0, RAIL_LIMIT), href: null });
  }

  return rails;
}
