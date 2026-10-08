import instagramData from '../data/instagram.json';
import excludedData from '../data/instagram-excluded.json';
/* Explicit .ts extensions, per the repo convention. */
import { postQualifiesForTopic } from './instagram-topic.ts';
import { selectVisiblePosts, toShortcodeSet } from './instagram-visibility.ts';

export interface InstagramMediaChild {
  id: string;
  mediaType: 'IMAGE' | 'VIDEO';
  url: string;
  thumbnailUrl: string;
}

export interface InstagramPost {
  id: string;
  caption: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  displayUrl: string;
  videoUrl?: string;
  permalink: string;
  timestamp: string;
  children: InstagramMediaChild[];
  /*
    Reels only, and only when the Graph API reported it. `true` = the reel is
    on the profile feed AND the Reels tab; `false` = Reels tab only.
    `undefined` = the API did not say, which is NOT the same as false — see
    isOnProfileFeed().
  */
  isSharedToFeed?: boolean;
  /** FEED | REELS | AD | STORY, when reported. Diagnostic only. */
  mediaProductType?: string;
}

/*
  The visibility RULE lives in ./instagram-visibility.ts, which imports
  nothing — this module statically imports JSON and so cannot be loaded by
  plain `node`, which is what the offline suites run under. Keeping the rule
  separate is what lets it be tested against real inputs rather than by
  matching source text.
*/
const EXCLUDED_SHORTCODES = toShortcodeSet(
  (excludedData as { shortcodes?: unknown }).shortcodes
);

/**
 * Returns the cached Instagram feed from the build-time sync.
 */
export function getInstagramFeed(): InstagramPost[] {
  // @ts-ignore - Asserting structure from JSON
  return Array.isArray(instagramData) ? (instagramData as InstagramPost[]) : [];
}

/**
 * Flattens the Instagram feed to just a list of images/videos,
 * perfect for a continuous cinematic gallery.
 * Carousels are unpacked into individual slides, deduplicated by media URL.
 *
 * `topicKeywords` restricts the feed to posts that qualify for a hub — see
 * `postQualifiesForTopic` in ./instagram-topic for the matching rule and for
 * why this is no longer a `caption.includes(pageTitle)` substring test.
 * Omit it (the homepage) to get the whole feed; passing an EMPTY array
 * qualifies nothing, so a hub with no keywords configured shows no carousel
 * rather than the global feed.
 *
 * Note that one carousel post yields many tiles, so a caller counting tiles is
 * counting media, not posts.
 */
/**
 * One tile per POST, never one per media item.
 *
 * ─── WHY ALBUMS ARE NOT UNPACKED ────────────────────────────────────────────
 *
 * This used to explode a CAROUSEL_ALBUM into one tile per slide. That reads
 * fine with the albums in the feed today and falls apart with the ones that
 * are coming: the owner's point, verbatim — "I will do a post where it'll just
 * be like 10 different images in a single, so all we would be showing is like
 * one" post. The row holds ten tiles. One ten-slide album fills all ten and
 * every other post disappears from the rail.
 *
 * The feed already contains an 18-slide album and a 14-slide album, so this is
 * not hypothetical — it is only hidden by which posts happen to be recent.
 *
 * So an album contributes exactly one tile, showing its cover. Verified
 * against the stored feed: the post's own `displayUrl` equals its first
 * slide's `thumbnailUrl` on all six albums, so the cover IS the first image
 * rather than an arbitrary one.
 *
 * DEDUPED BY POST ID, not by image URL. Keying on the image was what made an
 * album's identity ambiguous in the first place — a post is the thing being
 * shown, so a post is the thing being counted. It is also stable across a
 * re-sync, which a signed CDN URL is not.
 *
 * The knock-on this changes deliberately: tiles now count posts, so the
 * minimums in instagram-topic.ts are counted against posts too. A hub that
 * only cleared its minimum because one album unpacked into seven tiles will
 * now correctly render nothing rather than a row of near-identical slides
 * from a single post.
 */
export function getGalleryPosts(topicKeywords?: readonly string[]) {
  const feed = getInstagramFeed();

  /* Reels-tab-only posts and hand-excluded posts are dropped here — including
     the floor that stops an over-eager filter deleting the whole rail. See
     selectVisiblePosts in ./instagram-visibility.ts. */
  const visible = selectVisiblePosts(feed, EXCLUDED_SHORTCODES);

  const gallery = [];
  const seen = new Set<string>();

  const qualify = topicKeywords !== undefined;

  for (const post of visible) {
    if (!post || !post.displayUrl || !post.mediaType) continue; // Skip corrupt posts

    if (qualify && !postQualifiesForTopic(post, topicKeywords)) continue;

    /* By post id — see the note above. Falls back to the image only for a
       record old enough to predate ids, which should not exist but costs
       nothing to tolerate. */
    const key = post.id || post.displayUrl;
    if (seen.has(key)) continue;
    seen.add(key);

    gallery.push(post);
  }

  return gallery;
}

