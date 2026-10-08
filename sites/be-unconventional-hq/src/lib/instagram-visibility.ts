/*
  ─── WHICH INSTAGRAM POSTS BELONG IN THE HOMEPAGE CAROUSEL ──────────────────

  The rule, from the owner: "we only want front facing instagram posts to
  appear in the instagram feed carousel — if it's not present on my feed then
  it should not appear."

  A reel can be published to the Reels tab without going onto the profile
  feed. Nothing in the stored shape could tell the two apart: every reel has a
  `/reel/` permalink and `media_type: VIDEO` either way, and 41 of the 50
  posts in the feed are reels. So the sync records the Graph API's
  `is_shared_to_feed` and this module decides what that means.

  DELIBERATELY PURE, AND SEPARATE FROM instagram.ts, so the rule can be tested
  against real inputs instead of by matching source text. instagram.ts imports
  `src/data/*.json` statically, which makes it unloadable under plain `node`
  (JSON modules need an import attribute) — the offline suites run under plain
  node, so a rule living there could only ever be regex-asserted. This file
  imports nothing at all.
*/

export interface VisibilityCandidate {
  permalink?: string;
  /*
    Reels only, and only when the Graph API reported it. `true` = on the
    profile feed AND the Reels tab; `false` = Reels tab only; `undefined` =
    not reported, which is NOT the same as false.
  */
  isSharedToFeed?: boolean;
}

/** Shortcode from a post permalink: .../reel/<code>/ or .../p/<code>/ */
export function permalinkShortcode(permalink: unknown): string {
  const match = String(permalink ?? '').match(/\/(?:reels?|p|tv)\/([^/?#]+)/i);
  return match ? match[1] : '';
}

/*
  THE `undefined` CASE IS TREATED AS VISIBLE, ON PURPOSE.

  The field is absent for every record synced before it was requested, absent
  for anything that is not a reel, and absent if the media request had to fall
  back to the base field set. Treating "unknown" as "hide" would empty the
  carousel on the first build after this ships and keep it empty until a
  successful sync. Unknown means keep.
*/
export function isOnProfileFeed(post: VisibilityCandidate): boolean {
  return post?.isSharedToFeed !== false;
}

/**
 * Apply both visibility rules to a feed, in the order that makes each one safe.
 *
 * @param posts     the stored feed, newest first
 * @param excluded  shortcodes the owner has chosen to hide by hand
 */
export function selectVisiblePosts<T extends VisibilityCandidate>(
  posts: readonly T[],
  excluded: ReadonlySet<string> = new Set()
): T[] {
  const feed = Array.isArray(posts) ? posts : [];

  /*
    ─── THE FLOOR ────────────────────────────────────────────────────────────

    CinematicGallery renders NOTHING for an empty list — it is wrapped in
    `{items.length > 0 && (…)}` — so an over-eager automatic filter does not
    shorten the rail, it deletes the whole section from the homepage.

    That is a realistic failure rather than a hypothetical one: the behaviour
    of `is_shared_to_feed` varies by account type, and if it came back false
    for everything the homepage would quietly lose a section. So when the
    automatic rule leaves nothing at all, the unfiltered feed is used instead.
    A rail showing too much is cosmetic; a missing rail is a broken page.
  */
  const onFeed = feed.filter(isOnProfileFeed);
  const afterAutomatic = onFeed.length > 0 ? onFeed : feed;

  /*
    Manual exclusions are applied AFTER the floor and are never floored
    themselves. Hiding a post by hand is an explicit decision, not a
    malfunction, and it is honoured even if it empties the rail.
  */
  if (excluded.size === 0) return [...afterAutomatic];

  return afterAutomatic.filter((post) => {
    const code = permalinkShortcode(post?.permalink);
    /* An unparseable permalink yields '', which must never match a stray ''
       in the list — that would hide an arbitrary post. */
    return code === '' || !excluded.has(code);
  });
}

/** Normalise the raw `shortcodes` array from instagram-excluded.json. */
export function toShortcodeSet(raw: unknown): ReadonlySet<string> {
  if (!Array.isArray(raw)) return new Set();
  return new Set(
    raw
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
      /* Tolerate a pasted full URL rather than silently never matching it. */
      .map((value) => (/^https?:/i.test(value) ? permalinkShortcode(value) : value))
      .filter(Boolean)
  );
}
