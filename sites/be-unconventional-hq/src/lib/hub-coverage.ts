/**
 * ONE matcher for "what coverage belongs to this hub", shared by the two page
 * types that ask the question: /featured/[slug] (a featuredBrand) and
 * /events/[slug] (an event).
 *
 * ─── WHY THIS FILE EXISTS ──────────────────────────────────────────────────
 * The two pages answered it differently, and only one of them worked.
 *
 *   /featured/[slug]  exact match on NORMALIZED tags (article.tags,
 *                     article.category, video.youtubeTags, video.tags)
 *   /events/[slug]    substring match on article.title / article.excerpt
 *                     and video.title / video.description
 *
 * Substring matching is the leaky one: an event keyed "d23 2026" would claim
 * any article whose body happened to contain that run of characters, and,
 * far worse in practice, claimed nothing at all. Measured against the
 * shipped store, the event-page matcher returned ZERO articles for all 19
 * events, because it was searching prose for strings like "sdcc-2026" and
 * "paxwest26" that only ever appear as YouTube metadata.
 *
 * ─── WHY EVENTS NEED coverageTags AND BRANDS DO NOT ────────────────────────
 * Both document types already carry `youtubeSyncKeywords`, but they carry
 * very different things in it, because that field has one job: matching
 * YouTube tags during the sync (CLAUDE.md hard rule 5).
 *
 *   featuredBrand  ["marvel", "mcu", "marvel studios"]   <- brand names,
 *                  which are also what a writer tags an article with, so
 *                  brand hubs match articles by accident of vocabulary.
 *   event          ["sdcc 2026", "sdcc-2026", "sdcc2026"] <- year-scoped
 *                  sync tokens. No human tags an article "sdcc2026".
 *
 * Widening `youtubeSyncKeywords` to fix this would be actively wrong: those
 * keywords also drive `extractHubSeeds()` in scripts/sync-youtube.mjs, so
 * adding "marvel studios" to the Doomsday premiere would hub-tag every
 * Marvel video on the channel to one red-carpet night.
 *
 * `coverageTags` is therefore a separate, purely EDITORIAL field, read here
 * and nowhere else. The sync never writes it and never reads it.
 */

export type CoverageItem = Record<string, any> & { contentType: 'article' | 'video' };

/**
 * Tag comparison is case- and punctuation-insensitive but NOT fuzzy:
 * "Marvel Studios", "marvel studios" and "Marvel-Studios" are the same tag,
 * "marvel" is a different one. Substring containment is deliberately not a
 * match — see the header.
 */
export function normalizeTag(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * The tag vocabulary a hub document matches content against: its editorial
 * `coverageTags` first, then its `youtubeSyncKeywords`. Both are optional and
 * either may be missing, a non-array, or contain non-strings — hub documents
 * are hand-edited through the local CMS.
 */
export function getHubMatchTags(hub: any): string[] {
  const raw = [
    ...(Array.isArray(hub?.coverageTags) ? hub.coverageTags : []),
    ...(Array.isArray(hub?.youtubeSyncKeywords) ? hub.youtubeSyncKeywords : []),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of raw) {
    const tag = normalizeTag(value);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

/**
 * The same tag with its spaces closed up: "sdcc 2026" and "sdcc2026" are one
 * thing, and a person typing a tag on a phone will produce either.
 *
 * ─── WHY MATCHING COMPARES THIS FORM ───────────────────────────────────────
 * The site owner's rule for tagging event coverage is "SDCC 2026, with or
 * without a space". Both spellings therefore have to land on the same event
 * page, and requiring the hub to list every spelling is the kind of thing
 * that works until the one time somebody types only one of them. Ten of the
 * nineteen shipped events carry no keywords at all, so their whole
 * vocabulary will be hand-typed exactly once.
 *
 * This is a strict WIDENING of exact matching and nothing more: two tags
 * with equal normalized forms always have equal compact forms, so every
 * match that held before still holds, and the only new matches are
 * space-variants of one another. It does NOT reintroduce substring
 * matching — "marvel" still compacts to "marvel" and "marvel studios" to
 * "marvelstudios", which are still different tags.
 */
export function compactTag(value: unknown): string {
  return normalizeTag(value).replace(/\s+/g, '');
}

/** True when any of `candidates` is the same tag as one in `tags`. */
function hasAnyTag(candidates: unknown[], tags: string[]): boolean {
  const wanted = new Set(tags.map(compactTag).filter(Boolean));
  if (wanted.size === 0) return false;
  for (const candidate of candidates) {
    const compact = compactTag(candidate);
    if (compact && wanted.has(compact)) return true;
  }
  return false;
}

/**
 * Every string that identifies one piece of coverage, for the exclude list
 * below. Articles and videos are different shapes and neither has a single
 * stable id across both stores, so all the plausible handles are accepted
 * and an editor can paste whichever one they are looking at.
 */
export function coverageIdentity(item: any): string[] {
  const candidates = [
    item?.slug?.current,
    typeof item?.slug === 'string' ? item.slug : undefined,
    item?.guid,
    item?.youtubeId,
    item?._id,
  ];
  return candidates
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim().toLowerCase());
}

/**
 * ─── THE OVERRIDE ──────────────────────────────────────────────────────────
 *
 * `excludeCoverage` on a hub document drops named items from its coverage,
 * whatever the tags say. It is the escape hatch for the one case tagging
 * cannot solve on its own: a retrospective.
 *
 * A post about SDCC published in 2026 is almost certainly about SDCC 2026.
 * A post about SDCC published in 2027 might be about either, and nothing in
 * the data says which. Inferring the edition from the publish date would get
 * that wrong SILENTLY, and wrong coverage on an event page is worse than
 * none: nobody notices it. So the edition comes from the tag, and when a
 * loose tag pulls in something it should not, the item is named here.
 *
 * Paste an article slug, an article guid, a YouTube id, or a document _id.
 */
function applyExclusions(items: any[], hub: any): any[] {
  const raw = Array.isArray(hub?.excludeCoverage) ? hub.excludeCoverage : [];
  const excluded = new Set(
    raw
      .filter((value: unknown): value is string => typeof value === 'string')
      .map((value: string) => value.trim().toLowerCase())
      .filter(Boolean),
  );
  if (excluded.size === 0) return items;
  return items.filter((item) => !coverageIdentity(item).some((id) => excluded.has(id)));
}

export function matchArticlesByTags(articles: any[], tags: string[]): any[] {
  if (!tags.length) return [];
  return (articles ?? []).filter((article) =>
    hasAnyTag([...(article?.tags ?? []), article?.category], tags)
  );
}

export function matchVideosByTags(videos: any[], tags: string[]): any[] {
  if (!tags.length) return [];
  return (videos ?? []).filter((video) =>
    hasAnyTag([...(video?.youtubeTags ?? []), ...(video?.tags ?? []), video?.category], tags)
  );
}

/** Newest first, tolerating both the article (`date`) and video (`publishedAt`) field. */
export function coverageTimestamp(item: any): number {
  const value = item?.date ?? item?.publishedAt ?? item?.isoDate ?? 0;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

export interface CoverageInput {
  hub: any;
  videos: any[];
  articles: any[];
}

export interface CoverageResult {
  items: CoverageItem[];
  articleCount: number;
  videoCount: number;
  /** Both kinds present, so an ARTICLES/VIDEOS filter has something to do. */
  showFilters: boolean;
}

/**
 * Videos come from hub tagging first (`video.hubs` contains the hub slug —
 * deterministic and editor-controlled) and fall back to tag matching only
 * when nothing is hub-tagged yet. Articles have no `hubs` field at all (they
 * sync from Substack, which knows nothing about this site's hubs), so they
 * are always tag-matched.
 *
 * Shorts and live streams are excluded by the CALLER, by not passing them in.
 * Both page types now pass long-form video only: a hub page always did, an
 * event page used to merge shorts and live in, and one of the two had to
 * give. The coverage grid is the long-form reading list; shorts have their
 * own surfaces.
 */
export function collectHubCoverage({ hub, videos, articles }: CoverageInput): CoverageResult {
  const slug = hub?.slug?.current;
  const tags = getHubMatchTags(hub);

  const hubTagged = (videos ?? [])
    .filter((v: any) => slug && Array.isArray(v?.hubs) && v.hubs.includes(slug));

  /*
    Exclusions apply to hub-TAGGED videos too, not only to tag-matched ones.
    A curated list can carry a mistake as easily as a heuristic can, and an
    editor reaching for the override should not have to know which path put
    the item on the page.
  */
  /*
    A pinned item is coverage too. "This article belongs to this hub" has to
    mean both things or the override is half an answer: the card appears on
    the article but the article is missing from the hub it points at.

    Exclusions still run afterwards, so a pin and an exclusion on the same
    item resolves to excluded. That ordering is deliberate: the exclusion is
    the more specific instruction ("not this one"), and it is also the one an
    editor reaches for to undo a mistake.
  */
  const pinnedIds = new Set(
    (Array.isArray(hub?.pinnedCoverage) ? hub.pinnedCoverage : [])
      .filter((v: unknown): v is string => typeof v === 'string')
      .map((v: string) => v.trim().toLowerCase())
      .filter(Boolean),
  );
  const isPinned = (item: any) => coverageIdentity(item).some((id) => pinnedIds.has(id));

  const baseVideos = hubTagged.length > 0 ? hubTagged : matchVideosByTags(videos ?? [], tags);
  const pinnedVideos = pinnedIds.size
    ? (videos ?? []).filter((v: any) => isPinned(v) && !baseVideos.includes(v))
    : [];
  const matchedVideos = applyExclusions([...baseVideos, ...pinnedVideos], hub);
  const taggedArticles = matchArticlesByTags(articles ?? [], tags);
  const pinnedArticles = pinnedIds.size
    ? (articles ?? []).filter((a: any) => isPinned(a) && !taggedArticles.includes(a))
    : [];
  const matchedArticles = applyExclusions([...taggedArticles, ...pinnedArticles], hub);

  const items: CoverageItem[] = [
    ...matchedArticles.map((a: any) => ({ ...a, contentType: 'article' as const })),
    ...matchedVideos.map((v: any) => ({ ...v, contentType: 'video' as const })),
  ].sort((a, b) => coverageTimestamp(b) - coverageTimestamp(a));

  return {
    items,
    articleCount: matchedArticles.length,
    videoCount: matchedVideos.length,
    showFilters: matchedArticles.length > 0 && matchedVideos.length > 0,
  };
}

/**
 * How many coverage tiles a hub or event page shows before the rest moves to
 * its own paginated feed. Six, to match the "Past Event Archive" cap on
 * /events — the same display-cap-plus-overflow-route pattern, so the site
 * behaves the same way everywhere it has more than it wants to show.
 */
export const COVERAGE_PAGE_LIMIT = 6;

/** Page size for the overflow feed. 12 matches /intel, /feed and /events/archive. */
export const COVERAGE_FEED_PAGE_SIZE = 12;

/**
 * ─── THE SAME QUESTION, ASKED BACKWARDS ────────────────────────────────────
 *
 * collectHubCoverage answers "what belongs to this hub". An article page
 * needs the inverse: "which hub does this belong to", so it can offer the
 * reader the Official Streamer / Studio / Franchise Hub card that event
 * pages carry.
 *
 * An EVENT does not need this. It has `relatedBrandSlug`, an editorial
 * choice someone made in the CMS. Articles sync from Substack and have no
 * such field and never will, so the association is inferred from the
 * vocabulary the hubs already define.
 *
 * ─── WHY STRENGTH, NOT FIRST MATCH ─────────────────────────────────────────
 * Pieces routinely match more than one hub. The Spider-Man review is tagged
 * "Marvel Studios", "MCU", "Marvel" AND "Sony Pictures", and first-match
 * would hand it to whichever hub happened to sort first in the store.
 *
 * Counting matched tags picks the hub the piece is most ABOUT: four hits for
 * Marvel against one for Sony. Ties break on slug so the build is
 * deterministic; a build that reorders cards between runs for no reason is
 * its own bug.
 *
 * Returns null when nothing matches, which is the common case and is fine:
 * the card simply does not render.
 */
export function findHubForItem(item: any, hubs: any[]): any | null {
  /*
    ─── THE OVERRIDE WINS OUTRIGHT ──────────────────────────────────────────

    `pinnedCoverage` on a hub names items that hub owns, whatever the tags
    say. It is the answer to the one case scoring gets wrong by design:

      "A Generational Leap: Did Rockstar and Netflix Just Set a New Industry
      Standard?" is tagged Netflix, Gaming, PlayStation, GTA VI, Video Games
      and Xbox. It resolves to Netflix, because Netflix's vocabulary lists
      five variants and PlayStation's four. Netflix wins on the SIZE of its
      keyword list, not on being what the piece is about.

    Rather than tune the scoring, which would trade this case for a
    different one, the editor can name the piece on the hub they want. Pins
    are checked before any scoring happens, so nothing can outvote one.

    Two hubs pinning the same item is an editorial mistake, not a crash: the
    lower slug wins, so the build stays deterministic either way.
  */
  const pinned = (hubs ?? [])
    .filter((hub) => {
      if (!hub?.slug?.current) return false;
      const list = Array.isArray(hub.pinnedCoverage) ? hub.pinnedCoverage : [];
      if (list.length === 0) return false;
      const wanted = new Set(
        list
          .filter((v: unknown): v is string => typeof v === 'string')
          .map((v: string) => v.trim().toLowerCase())
          .filter(Boolean),
      );
      return coverageIdentity(item).some((id) => wanted.has(id));
    })
    .sort((a, b) => String(a.slug.current).localeCompare(String(b.slug.current)));

  if (pinned.length > 0) return pinned[0];

  let best: any = null;
  let bestScore = 0;

  for (const hub of hubs ?? []) {
    if (!hub?.slug?.current) continue;
    const tags = getHubMatchTags(hub);
    if (!tags.length) continue;

    /* One point per DISTINCT hub tag the item carries, so a hub cannot win
       by listing the same keyword in both coverageTags and sync keywords. */
    const score = tags.filter((tag) => matchArticlesByTags([item], [tag]).length > 0).length;
    if (score === 0) continue;

    if (
      score > bestScore ||
      (score === bestScore && best && hub.slug.current < best.slug.current)
    ) {
      best = hub;
      bestScore = score;
    }
  }

  return best;
}
