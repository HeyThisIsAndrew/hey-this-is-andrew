/**
 * The site's search index, built once and read by three consumers.
 *
 * ─── WHY THIS IS A LIB AND NOT JUST A ROUTE ───────────────────────────────
 * It started as the body of `src/pages/api/search-index.json.ts`, which the
 * command palette fetches. Two more consumers now need the same rows: the
 * WebMCP tools in the browser (src/lib/webmcp.ts, via that same endpoint) and
 * the MCP endpoint at `/api/mcp`, which runs on the server and would
 * otherwise have to HTTP-fetch its own origin to read data it already has in
 * memory. Extracting the builder keeps ONE definition of what a searchable
 * row is; three copies of this mapping would drift within a release.
 *
 * The route is unchanged in behaviour: it calls this and serialises it.
 */

import { getVideosUnified } from './videos-source.ts';
import { getArticleItems } from './feed-items.ts';
import { getEventsLocal, getFeaturedBrandsLocal, urlFor } from './local-content.ts';
import { parseVideoId } from './platforms/youtube.ts';

/**
 * One row of the palette's index.
 *
 * `date` is OPTIONAL and that is the point. Videos and articles are dated
 * content and sort by it. Hubs and section pages are places, not posts: they
 * were stamped with `new Date()` (the build time), which floated all 18 hubs
 * above every real article and made the palette open on nothing but hubs.
 * Undated rows sort last here and the default view curates a mix instead.
 */
export interface SearchEntry {
  id: string;
  title: string;
  type: 'video' | 'article' | 'event' | 'hub' | 'page';
  url: string;
  image?: string | null;
  date?: string | null;
  /*
    Events only. The default view shows an event only while it is still ahead
    of us, and that decision has to be made in the BROWSER, not here: this
    file runs at build time, so an event that was upcoming when the site was
    built is still marked upcoming a month later. The client compares today
    against these two, so it needs the end as well as the start. A multi-day
    event is not over on its first morning.
  */
  endDate?: string | null;
  /*
    Kept out of the empty-query view, but still findable by typing. See the
    `pages` list below for why a given page is flagged.
  */
  excludeFromDefault?: boolean;
  /*
    Events only. The editorial override stored on the document, which
    `getEventStatus` honours over the calendar. Carried here because a
    consumer working from this index alone cannot otherwise tell a cancelled
    event from one that is still going ahead, and would happily present a
    cancelled event as upcoming. Added for the WebMCP `get_upcoming_events`
    tool (#192); the palette does not read it yet.
  */
  status?: 'scheduled' | 'cancelled' | 'postponed';
  tags?: string[];
  hubCategory?: string;
}

/** Build the index. Async only because `getVideosUnified()` is. */
export async function buildSearchIndex(): Promise<SearchEntry[]> {
  const videos = await getVideosUnified();
  const articles = getArticleItems();
  const events = getEventsLocal();
  const hubs = getFeaturedBrandsLocal();

  const resolveImage = (ref: any) => {
    if (!ref) return null;
    if (typeof ref === 'string') return ref;
    try {
      return urlFor(ref).width(200).auto('format').url();
    } catch {
      return null;
    }
  };

  /* Undated for the same reason as hubs: a section index is a place, not a
     post, and stamping it with the build time floated it above real content. */
  const pages: SearchEntry[] = [
    /*
      Intel is excluded from the empty-query view because the view already
      shows three articles, and Intel is the page those articles live on. It
      is not a result, it is the container of results that are already there.
      Still indexed, so typing "intel" finds it.
    */
    { id: 'intel', title: 'Intel', type: 'page', url: '/intel', excludeFromDefault: true },
    { id: 'featured', title: 'Featured Hubs', type: 'page', url: '/featured', excludeFromDefault: true },
    { id: 'events', title: 'Events', type: 'page', url: '/events', excludeFromDefault: true },
    /*
      The archive is a separate destination, not a tab of /events: it is the
      only route that lists every past event, and /events shows six of them
      behind a link. Without an entry here the palette could reach an
      individual past event by name but never the page that lists them all.
    */
    {
      id: 'events-archive',
      title: 'Past Event Archive',
      type: 'page',
      url: '/events/archive',
      excludeFromDefault: true,
    },
    { id: 'media-kit', title: 'Media Kit', type: 'page', url: '/media-kit', excludeFromDefault: true },
  ];

  const entries: SearchEntry[] = [
    ...videos.map((v: any): SearchEntry => ({
      id: v.youtubeId,
      title: v.title,
      type: 'video',
      url: v.link || '#',
      image: v.thumbnail || v.image || (v.link && parseVideoId(v.link) ? `https://i.ytimg.com/vi/${parseVideoId(v.link)}/mqdefault.jpg` : null),
      date: v.publishedAt || v.date,
      tags: [...(v.tags || []), ...(v.hubs || [])].filter(Boolean)
    })),
    ...articles.map((a: any): SearchEntry => ({
      id: a.slug,
      title: a.title,
      type: 'article',
      url: a.link || `/intel/${a.slug}`,
      image: a.thumbnail || a.image,
      date: a.date,
      tags: a.tags || []
    })),
    ...events.map((e: any): SearchEntry => ({
      id: e.slug?.current || e._id,
      title: e.title,
      type: 'event',
      url: `/events/${e.slug?.current}`,
      image: resolveImage(e.heroImage),
      date: e.startDate,
      endDate: e.endDate || e.startDate,
      status: e.status,
      tags: []
    })),
    ...hubs.map((h: any): SearchEntry => ({
      id: h.slug?.current || h._id,
      title: `${h.title} Hub`,
      type: 'hub',
      url: `/featured/${h.slug?.current}`,
      image: resolveImage(h.logo || h.heroImage),
      /*
        NO DATE. Hubs were stamped `new Date()`, i.e. the build time, so all 18
        of them sorted above every article and video and the palette's default
        view was nothing but hubs. A hub is not dated content; it is a place.
        The default view curates a mix instead of taking the top of this sort.
      */
      tags: h.youtubeSyncKeywords || [],
      hubCategory: h.hubCategory || 'other'
    })),
    ...pages
  ];

  /*
    Annotated on the literal above rather than on this chain: a type on the
    result of `.filter().sort()` does not flow backwards into the sort
    callback's parameters, so `a.date` would be checked against the inferred
    union instead — and that union has no `date` on the undated rows.

    Undated rows (hubs, section pages) fall to 0 and sort last. That is
    correct: they are places, not posts, and the palette's default view picks
    a mix rather than reading off the top of this sort.
  */
  const index = entries
    .filter((item) => item.title && item.url)
    .sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });

  return index;
}
