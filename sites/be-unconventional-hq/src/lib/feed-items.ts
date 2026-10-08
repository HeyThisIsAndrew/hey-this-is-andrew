/**
 * Shared item-shaping for the feed routes.
 *
 * Every feed surface previously rebuilt this merge/normalise/sort inline —
 * and twice per file, since `getStaticPaths()` runs in its own isolated scope
 * and cannot see frontmatter helpers. Keeping it here means the feed's notion
 * of "an item" is defined once.
 *
 * The shape is deliberately generic — `{ title, link, date, image, category }`
 * plus a `type` discriminator — which is why articles already slot into the
 * same <ContentCard /> as videos with no visual variant.
 */
import { getAllArticles, articleHref, isExternalArticle } from './articles.ts';
import { getVideosUnified } from './videos-source.ts';

export interface FeedItem {
  title: string;
  link: string;
  date: string;
  image?: string;
  category?: string;
  tags?: string[];
  /** Editorial ordering override. See sortTime() below. Never shown to a reader. */
  sortDate?: string;
  type: 'article' | 'video';
  [key: string]: any;
}

/**
 * The date an item SORTS by, which is not always the date it was published.
 *
 * ─── WHY AN OVERRIDE EXISTS AT ALL ──────────────────────────────────────────
 * Publish order and episode order are different things. The Lanterns episode 2
 * review went up on 2026-09-02 and the episode 3 review on 2026-09-01, because
 * that is the order they were finished in. By publish date the row read
 * 5, 4, 2, 3 — the reviews out of sequence with the show they are about.
 *
 * `sortDate` is the editorial answer: order this as if it went out on that day.
 * It changes ORDER ONLY. The date shown on the card, in the metadata and in the
 * feeds is still `date`, because that is when the thing was actually published
 * and claiming otherwise in public would be a lie rather than a preference.
 *
 * It is an EDITORIAL field in the sense CLAUDE.md hard rule 5 means: seeded by
 * a human, never written by the sync, and explicitly carried forward in
 * scripts/sync-youtube.mjs so a sync run cannot drop it.
 */
function sortTime(item: FeedItem): number {
  const raw = item.sortDate || item.date;
  const t = new Date(raw).getTime();
  /* A malformed override must not send the item to the top of the feed, and
     must not throw: fall back to the real date, then to "sorts last". */
  if (Number.isNaN(t)) {
    const fallback = new Date(item.date).getTime();
    return Number.isNaN(fallback) ? 0 : fallback;
  }
  return t;
}

/**
 * The same rule, exported, because more than one surface has to agree with it.
 *
 * `/feed`'s own hero used to pick `videos[0]`, the first document in the store,
 * while the homepage banner sorted by this. The two agreed only for as long as
 * the sync happened to write the newest item first, and they were one
 * `sortDate` away from disagreeing — which is this field's whole purpose.
 */
export function feedSortTime(item: { sortDate?: string; date?: string }): number {
  return sortTime(item as FeedItem);
}

/** Newest first. Items with unparseable dates sort last rather than throwing. */
function byNewest(a: FeedItem, b: FeedItem) {
  return sortTime(b) - sortTime(a);
}

/**
 * Articles as Feed items.
 *
 * `link` is resolved through articleHref(), so an article we host locally
 * points at its BUHQ page and one we have no body for still points at
 * Substack. That single substitution is the whole of this epic's Feed
 * integration — the card component, its markup and its styling are untouched,
 * because the Feed-item contract was already generic enough to carry articles
 * (see scripts/epic-000-audit.md §4).
 */
export function getArticleItems(): FeedItem[] {
  return getAllArticles()
    .map((a) => ({
      ...a,
      link: articleHref(a),
      isExternal: isExternalArticle(a),
      type: 'article' as const,
    }))
    .sort(byNewest);
}

export async function getVideoItems(): Promise<FeedItem[]> {
  const videos = await getVideosUnified();
  return videos
    .map((v: any) => ({ ...v, type: 'video' as const, image: v.thumbnail }))
    .sort(byNewest);
}

/** Articles and videos interleaved by date — the main `/feed`. */
export async function getAllFeedItems(): Promise<FeedItem[]> {
  const [articles, videos] = [getArticleItems(), await getVideoItems()];
  return [...articles, ...videos].sort(byNewest);
}
