/**
 * Canonical content categories. These exact labels are produced by
 * `categorize()` in src/data/categorize.js and used for filtering across the
 * Videos and Articles pages. That function's SIGNALS keys must stay in step
 * with this list: a label there with no entry here is a category nothing can
 * filter by.
 */
export const CATEGORIES = ['Film', 'TV', 'Games', 'Events', 'General'];

/*
  ─── WHY ALIASES EXIST ──────────────────────────────────────────────────────

  The category label doubles as a URL slug (/category/games) AND as the thing
  a piece of content is matched against. But content is not tagged by us: an
  article carries whatever tags the post was published with on Substack, and a
  video carries the topic slugs the YouTube sync derived. Both of those say
  "gaming", and they will keep saying "gaming" — a rename here cannot reach
  back into Substack's tags or YouTube's.

  So renaming Gaming to Games without this map would have left /category/games
  and the #games feed filter matching literally nothing, with no error: the
  page would build, render its empty state, and look like a content problem
  rather than a taxonomy one.

  Keys are the category slug (lowercase label). Values are every tag spelling
  that means it. `events`/`event` was already being special-cased inline in
  the category route before this map existed.
*/
export const CATEGORY_TAG_ALIASES = {
  film: ['film'],
  tv: ['tv'],
  games: ['games', 'gaming'],
  events: ['events', 'event'],
  general: ['general'],
};

/** Every tag spelling that resolves to `slug`, including the slug itself. */
export function categoryTagAliases(slug) {
  const key = String(slug ?? '').toLowerCase().trim();
  if (!key) return [];
  return CATEGORY_TAG_ALIASES[key] ?? [key];
}

/** Does one tag (in any of its spellings) belong to the category `slug`? */
export function tagMatchesCategory(slug, tag) {
  const value = typeof tag === 'string' ? tag.toLowerCase().trim() : '';
  if (!value) return false;
  return categoryTagAliases(slug).includes(value);
}
