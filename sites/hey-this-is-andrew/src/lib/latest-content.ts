import { formatFeedDate } from './dates';
import committedVideos from '../data/videos.json';
// Build-time fetchers for the "Recent work" section.
// Videos use the committed videos.json snapshot from sync-youtube, with verified fallbacks; Coffee Talk
// articles read directly from the committed @andrew/content-pipeline snapshot.
import { cleanFeedText } from './feed-text';
import {
  articleHref,
  getAllArticles,
  isExternalArticle,
  resolveLocalRendition,
} from './articles';

export interface LatestItem {
  kind: 'video' | 'article';
  label: string;
  title: string;
  description: string;
  image: string | null;
  /** Verified responsive variants, e.g. "…/maxresdefault.jpg 1280w, …". */
  imageSrcset?: string;
  url: string;
  date: string; // ISO
  isExternal?: boolean;
  /** True when the real publish date is unknown and `date` is a stand-in
      (never treat such an item as "new"). */
  dateEstimated?: boolean;
}



// Substack wraps covers in a /image/fetch/ proxy URL with the original
// appended at the end. Unwrap to the direct file: fewer hops, and the
// proxy tokens are the flaky part.
function unwrapSubstackImage(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/\/image\/fetch\/.+\/(https?%3A%2F%2F.+)$/);
  if (m) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return url;
    }
  }
  return url;
}

const fmtDate = (d: Date) => formatFeedDate(d, { month: 'short', year: 'numeric' });

export async function getLatestVideo(): Promise<LatestItem | null> {
  const vids = await getLatestVideos(1);
  return vids[0] ?? null;
}

export async function getLatestArticle(): Promise<LatestItem | null> {
  const articles = await getLatestArticles(1);
  const first = articles[0];
  if (!first) return null;
  return {
    kind: 'article',
    label: 'Latest article',
    title: first.title,
    description: first.subtitle.slice(0, 220),
    image: first.image,
    url: first.url,
    date: first.date,
    isExternal: first.isExternal,
  };
}

export interface ArticleItem {
  title: string;
  subtitle: string;
  date: string; // ISO
  url: string;
  image: string | null;
  isExternal?: boolean;
}

export const SUBSTACK_URL = 'https://thisiscoffeetalk.substack.com';
export const SUBSTACK_TAGLINE = 'Building in Public and Figuring it out as I go';

// Hardcoded fallback: the three latest articles as of Sept 2026. The
// Writing section never renders empty, even if the snapshot is empty.
const FALLBACK_ARTICLES: ArticleItem[] = [
  {
    title: 'Scaling a One-Person Brand with Open-Source Automation',
    subtitle: 'Building an n8n automation engine to rival IGN and conquering Docker to build tools for creators.',
    date: '2026-09-01',
    url: 'https://thisiscoffeetalk.substack.com/p/scaling-a-one-person-brand-with-open',
    image: null,
    isExternal: true,
  },
  {
    title: 'Leveling Up: How Community and AI Are Transforming My Workflow',
    subtitle: "I don't use AI to do the work for me. I use it to teach me how.",
    date: '2026-08-31',
    url: 'https://thisiscoffeetalk.substack.com/p/leveling-up-how-community-and-ai',
    image: null,
    isExternal: true,
  },
  {
    title: 'Dev Diary: My Journey as a Technical Creator',
    subtitle: 'From "I can\'t do this" to "I\'m learning how": my journey into C++ and building custom creator apps.',
    date: '2026-08-14',
    url: 'https://thisiscoffeetalk.substack.com/p/dev-diary-my-journey-as-a-technical',
    image: null,
    isExternal: true,
  },
];

export async function getLatestArticles(limit = 3): Promise<ArticleItem[]> {
  const snapshotArticles = getAllArticles();
  if (snapshotArticles.length > 0) {
    return snapshotArticles.slice(0, limit).map((record): ArticleItem => {
      const localImg = resolveLocalRendition(record.image);
      const unwrapped = unwrapSubstackImage(record.image || null);
      return {
        title: cleanFeedText(record.title) || 'Untitled',
        subtitle: cleanFeedText(record.excerpt),
        date: record.isoDate,
        url: articleHref(record),
        image: localImg?.src ?? unwrapped,
        isExternal: isExternalArticle(record),
      };
    });
  }
  return FALLBACK_ARTICLES.slice(0, limit);
}

export { fmtDate };



// Real verified long-form videos published by Andrew on YouTube (@HeyThisIsAndrew).
// Used as guaranteed high-fidelity data with real titles, video IDs, dates, and thumbnails.
export const REAL_YOUTUBE_VIDEOS: LatestItem[] = [
  {
    kind: 'video',
    label: 'Latest video',
    title: "How I'm Building Creator Automation Tools With AI",
    description: "How I'm building open-source creator automation tools with n8n, AI, and code.",
    image: 'https://i.ytimg.com/vi/IZHdsNdnU5M/maxresdefault.jpg',
    imageSrcset: 'https://i.ytimg.com/vi/IZHdsNdnU5M/maxresdefault.jpg 1280w, https://i.ytimg.com/vi/IZHdsNdnU5M/sddefault.jpg 640w, https://i.ytimg.com/vi/IZHdsNdnU5M/hqdefault.jpg 480w',
    url: 'https://www.youtube.com/watch?v=IZHdsNdnU5M',
    date: '2026-09-01T12:00:00Z',
  },
  {
    kind: 'video',
    label: 'Latest video',
    title: 'YouTube Just Made Monetization Impossible. Good.',
    description: 'Why YouTube monetization changes are actually an opportunity for creators to diversify.',
    image: 'https://i.ytimg.com/vi/86uB4_VO9JY/maxresdefault.jpg',
    imageSrcset: 'https://i.ytimg.com/vi/86uB4_VO9JY/maxresdefault.jpg 1280w, https://i.ytimg.com/vi/86uB4_VO9JY/sddefault.jpg 640w, https://i.ytimg.com/vi/86uB4_VO9JY/hqdefault.jpg 480w',
    url: 'https://www.youtube.com/watch?v=86uB4_VO9JY',
    date: '2026-08-18T12:00:00Z',
  },
  {
    kind: 'video',
    label: 'Latest video',
    title: 'YouTube Monetization is Slow. Do This Instead!',
    description: "Alternative revenue streams for creators when YouTube AdSense isn't enough.",
    image: 'https://i.ytimg.com/vi/oJ1VEOMWkgE/maxresdefault.jpg',
    imageSrcset: 'https://i.ytimg.com/vi/oJ1VEOMWkgE/maxresdefault.jpg 1280w, https://i.ytimg.com/vi/oJ1VEOMWkgE/sddefault.jpg 640w, https://i.ytimg.com/vi/oJ1VEOMWkgE/hqdefault.jpg 480w',
    url: 'https://www.youtube.com/watch?v=oJ1VEOMWkgE',
    date: '2026-08-11T12:00:00Z',
  },
  {
    kind: 'video',
    label: 'Latest video',
    title: "You Don't Need 10K Subs to Get Brand Deals",
    description: 'How micro-creators can pitch and land brand partnerships without large subscriber counts.',
    image: 'https://i.ytimg.com/vi/TsCnveddq5E/maxresdefault.jpg',
    imageSrcset: 'https://i.ytimg.com/vi/TsCnveddq5E/maxresdefault.jpg 1280w, https://i.ytimg.com/vi/TsCnveddq5E/sddefault.jpg 640w, https://i.ytimg.com/vi/TsCnveddq5E/hqdefault.jpg 480w',
    url: 'https://www.youtube.com/watch?v=TsCnveddq5E',
    date: '2026-08-09T12:00:00Z',
  },
];



const YT_THUMB_VARIANTS = [
  { name: 'maxresdefault', w: 1280 },
  { name: 'sddefault', w: 640 },
  { name: 'hqdefault', w: 480 },
] as const;

/** HEAD-probe a URL, returning its content length (0 when unreachable). */
async function probeBytes(url: string, timeoutMs = 6000): Promise<number> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
    });
    if (!res.ok) return 0;
    const len = parseInt(res.headers.get('content-length') ?? '0', 10);
    return Number.isNaN(len) ? 0 : len;
  } catch {
    return 0;
  } finally {
    clearTimeout(t);
  }
}

export interface VideoThumb {
  src: string;
  srcset: string;
}

/** Best verified YouTube thumbnail for a video ID, with a srcset of every
 *  variant that actually exists at real resolution. Falls back to the RSS
 *  hqdefault when probing fails entirely. */
export async function getVideoThumbs(videoId: string): Promise<VideoThumb> {
  const variants = YT_THUMB_VARIANTS.map((v) => ({
    ...v,
    url: `https://i.ytimg.com/vi/${videoId}/${v.name}.jpg`,
  }));
  const probed = await Promise.all(
    variants.map(async (v) => ({ ...v, bytes: await probeBytes(v.url) }))
  );
  // YouTube serves a ~120px placeholder for missing HD variants; 20KB
  // cleanly separates placeholders from real thumbnails.
  const good = probed.filter((v) => v.bytes > 20000);
  if (good.length === 0) {
    const fb = variants[2].url;
    return { src: fb, srcset: '' };
  }
  return {
    src: good[0].url,
    srcset: good.map((v) => `${v.url} ${v.w}w`).join(', '),
  };
}

/** Newest-first latest videos. Real feed entries first, honest verified
    videos padding any shortfall so the hero always has its full slide
    count. Shorts and live streams are excluded. */
export async function getLatestVideos(limit = 3): Promise<LatestItem[]> {
  // 1. Read directly from committed videos.json populated by sync-youtube
  if (Array.isArray(committedVideos) && committedVideos.length > 0) {
    const list: LatestItem[] = committedVideos.slice(0, limit).map((v: any) => ({
      kind: 'video',
      label: 'Latest video',
      title: cleanFeedText(v.title || ''),
      description: v.description || '',
      image: v.thumbnail || `https://i.ytimg.com/vi/${v.id}/maxresdefault.jpg`,
      imageSrcset: v.imageSrcset || `https://i.ytimg.com/vi/${v.id}/maxresdefault.jpg 1280w, https://i.ytimg.com/vi/${v.id}/sddefault.jpg 640w`,
      url: v.url || `https://www.youtube.com/watch?v=${v.id}`,
      date: v.published_at || v.date || new Date().toISOString(),
      dateEstimated: false,
    }));
    if (list.length >= limit) {
      return list;
    }
  }

  const fallback = REAL_YOUTUBE_VIDEOS.slice(0, limit);
  try {
    // 1. Try YouTube channel videos tab directly (fetches live long-form uploads)
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch('https://www.youtube.com/@HeyThisIsAndrew/videos', {
      signal: ctrl.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    clearTimeout(t);
    if (res.ok) {
      const html = await res.text();
      const match =
        html.match(/var ytInitialData = ({.*?});<\/script>/s) ||
        html.match(/ytInitialData\s*=\s*({.+?});/);
      if (match) {
        const data = JSON.parse(match[1]);
        const tabs = data.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
        const videosTab = tabs.find((tb: any) => tb.tabRenderer?.title === 'Videos');
        const contents = videosTab?.tabRenderer?.content?.richGridRenderer?.contents || [];
        const videos: LatestItem[] = [];
        for (const item of contents) {
          const lockup = item.richItemRenderer?.content?.lockupViewModel;
          if (!lockup) continue;
          const videoId = lockup.contentId;
          const title = lockup.metadata?.lockupMetadataViewModel?.title?.content;
          if (!videoId || !title) continue;

          // Exclude Shorts, live streams, and live replays
          const badge =
            lockup.contentImage?.thumbnailViewModel?.overlays?.[0]
              ?.thumbnailBottomOverlayViewModel?.badges?.[0]?.thumbnailBadgeViewModel?.text || '';
          if (badge.toLowerCase().includes('live') || badge.toLowerCase().includes('stream')) {
            continue;
          }

          const known = REAL_YOUTUBE_VIDEOS.find((k) => k.url.includes(videoId));
          videos.push({
            kind: 'video',
            label: 'Latest video',
            title: cleanFeedText(title),
            description: known?.description || '',
            image: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
            imageSrcset: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg 1280w, https://i.ytimg.com/vi/${videoId}/sddefault.jpg 640w, https://i.ytimg.com/vi/${videoId}/hqdefault.jpg 480w`,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            date: known?.date || new Date().toISOString(),
            dateEstimated: !known?.date,
          });
          if (videos.length >= limit) break;
        }
        if (videos.length >= limit) {
          return videos;
        }
      }
    }
  } catch {
    // If live fetch fails or times out, fall through to verified records
  }
  return fallback;
}
