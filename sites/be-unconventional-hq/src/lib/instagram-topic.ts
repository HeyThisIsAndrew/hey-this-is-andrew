/*
  Topic qualification for Instagram posts.

  ─── WHY THIS EXISTS ──────────────────────────────────────────────────────
  A hub page (a `featuredBrand` like DC, or an `event` like SDCC) may only
  show the Instagram carousel when enough posts genuinely belong to that hub.
  The first implementation qualified a post with

      post.caption.toLowerCase().includes(pageTitle.toLowerCase())

  which is a raw substring test, and on real data it is wrong in both
  directions:

    FALSE POSITIVES — the DC page's title is "DC", and "dc" appears inside
    "S[DC]C", "hollywoo[dc]onfidential", "re[dc]arpet" and
    "westfiel[dc]enturycity". 9 of the 11 posts it qualified were Comic-Con,
    Scary Movie and red-carpet posts with no DC connection at all. Marvel
    looked correct only because "marvel" is long enough that nothing else in
    the caption corpus contains it — same code path, luckier keyword.

    FALSE NEGATIVES — the SDCC event's title is "San Diego Comic Con", which
    appears in no caption: the posts write it as the hashtag
    "#SanDiegoComicCon" and as "#SDCC2026". Its carousel could never appear
    no matter how much Comic-Con content was published.

  So qualification is token-based, not substring-based, and it runs against
  the hub's own keyword list rather than its display title.

  ─── THE MATCHING RULE ────────────────────────────────────────────────────
  A post qualifies when ANY of its hub's keywords matches its caption as:

    1. a whole word or whole phrase in the prose — "the new DC Universe"
       matches "dc" and "dc universe"; "SDCC" does not match "dc"; or
    2. a hashtag or @mention written without separators — "#SDCC2026" matches
       the keyword "sdcc 2026", "#DCUniverse" matches "dc universe".

  Both sides are normalized the same way the Featured/Events pages already
  normalize YouTube tags (lowercase, punctuation to spaces, collapse runs),
  so the two filters on a page agree about what "matching a hub" means.

  Pure and dependency-free on purpose: no JSON import, so it is directly
  testable with plain `node` (scripts/instagram-topic.test.mjs).
*/

/*
  ─── THE RENDER THRESHOLD ─────────────────────────────────────────────────
  A hub carousel must never ship a half-empty row, so the minimum is "enough
  tiles to fill the widest row the layout can produce". That number is
  derived, not chosen:

    .container      max-width 1536px, padding-inline clamp(1.25rem, …, 3rem)
    .ig-carousel-tile   flex: 0 0 220px   (a fixed px basis, not rem)
    .ig-carousel-track  gap: 1.25rem      (= 16px; html is 80% ≥768px)

  The container caps at 1536px, so the row never gets wider than that no
  matter the viewport:

      (1536 + 16) / (220 + 16) = 6.58 tiles

  6 tiles leave a visible gap at ≥1440px; 7 covers the widest row with the
  7th tile partially cut, which is what makes the rail read as continuous.
  Hence 7. Below 1536px the row holds fewer, so 7 is a safe ceiling
  everywhere (2 tiles at 390px, 5 at 1280px).

  `scripts/instagram-topic.test.mjs` re-derives this from the real CSS and
  fails if the tile width, gap or container cap changes without the
  threshold being revisited — the number must not silently go stale.
*/

/** Fewest qualifying tiles a hub (Featured brand / Event) carousel may show. */
export const HUB_CAROUSEL_MIN_TILES = 7;

/**
 * Fewest tiles the global homepage rail may show. Lower because it is not
 * making a topical claim — it is "latest posts", and any post qualifies.
 */
export const GLOBAL_CAROUSEL_MIN_TILES = 5;

/** Lowercase, punctuation to spaces, collapse runs. Mirrors the tag
 *  normalization in `src/pages/featured/[slug].astro`. */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strip everything that is not a letter or digit: "sdcc 2026" -> "sdcc2026",
 *  matching how a hashtag concatenates a multi-word phrase. */
export function toCompactToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Every #hashtag and @mention in a caption, compacted for comparison. */
export function extractTagTokens(caption: string): string[] {
  const tokens: string[] = [];
  for (const match of caption.matchAll(/[#@]([A-Za-z0-9_.]+)/g)) {
    const token = toCompactToken(match[1]);
    if (token) tokens.push(token);
  }
  return tokens;
}

/**
 * Does this caption match this single keyword, as a whole word/phrase in the
 * prose or as a hashtag/mention?
 */
export function captionMatchesKeyword(caption: string, keyword: string): boolean {
  if (!caption || !keyword) return false;

  const needle = normalizeText(keyword);
  if (!needle) return false;

  /* Space-padded containment is the word-boundary test: " dc " is in
     " the new dc universe " but not in " sdcc 2026 " or " redcarpet ". */
  if (` ${normalizeText(caption)} `.includes(` ${needle} `)) return true;

  const compact = toCompactToken(keyword);
  if (!compact) return false;
  return extractTagTokens(caption).includes(compact);
}

/**
 * A post qualifies for a hub when any one of the hub's keywords matches.
 * An empty keyword list qualifies nothing — callers that want the unfiltered
 * feed (the homepage) must not go through topic qualification at all, so that
 * "no keywords configured" can never silently mean "show everything".
 */
export function postQualifiesForTopic(
  post: { caption?: string } | null | undefined,
  keywords: readonly string[]
): boolean {
  if (!post?.caption || !Array.isArray(keywords) || keywords.length === 0) return false;
  return keywords.some(
    (keyword) => typeof keyword === 'string' && captionMatchesKeyword(post.caption as string, keyword)
  );
}

/**
 * The keyword set that identifies a hub, assembled from the hub document
 * itself — its display title plus `youtubeSyncKeywords`, the list the
 * Featured/Events pages already use to match YouTube tags.
 *
 * Deliberately read from the data rather than hardcoded here: hub keywords are
 * editor-managed (CLAUDE.md hard rule 5 — "never hardcode hub keywords in the
 * script"), so a new Featured brand or Event starts qualifying Instagram posts
 * the moment its keywords are filled in, with no code change.
 */
export function getHubTopicKeywords(hub: {
  title?: string;
  youtubeSyncKeywords?: unknown;
}): string[] {
  const fromDoc = Array.isArray(hub?.youtubeSyncKeywords) ? hub.youtubeSyncKeywords : [];
  return [hub?.title, ...fromDoc].filter(
    (keyword): keyword is string => typeof keyword === 'string' && keyword.trim().length > 0
  );
}
