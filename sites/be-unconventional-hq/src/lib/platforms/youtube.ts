/**
 * YouTube Data API v3 adapter — the reusable YouTube data layer for #21.
 *
 * ISOMORPHIC BY DESIGN. It uses only `fetch`, `URL`, and `URLSearchParams`,
 * which exist in BOTH runtimes this project targets:
 *   • Node (build-time ingestion/sync scripts → Sanity)
 *   • Cloudflare Workers edge (the /api/live-status endpoint for #20)
 * The API key is INJECTED by the caller (not read from process.env in here), so
 * the same module works in a Node script (process.env.YOUTUBE_API_KEY) and in
 * an edge handler (locals.runtime.env.YOUTUBE_API_KEY) with zero duplication.
 *
 * Caching is intentionally NOT built in — it belongs to each caller: build
 * scripts use the cache-preserve pattern; the edge endpoint uses Cache-Control
 * (see the quota note on getLiveStatus). This keeps the client thin and pure.
 */
import type { ChannelStats } from './types';

const API_BASE = 'https://www.googleapis.com/youtube/v3';

export interface YouTubeClientOptions {
  apiKey: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  /**
   * Injectable fetch — defaults to the global. Lets tests run offline with a
   * stub, and lets an edge handler pass its runtime fetch if needed.
   */
  fetchImpl?: typeof fetch;
}

export interface YouTubeAnalytics {
  retentionPercent: number;
  age18to34Percent: number;
  malePercent: number;
  femalePercent: number;
  topGeos: string[];
  views30Days: number;
  tvViewershipPercent: number;
  searchTrafficPercent: number;
  unsubscribedPercent: number;
}

/** Rich, YouTube-specific video model (this is a CONTENT type, not shared). */
export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string; // ISO-8601
  durationSeconds: number;
  viewCount: number;
  tags: string[];
  /** Heuristic: <= 60s. True Shorts detection needs a URL probe; documented. */
  isShort: boolean;
  isLive: boolean;
  isEvent: boolean;
}

export interface LiveStatus {
  isLive: boolean;
  videoId: string | null;
  title?: string;
}

export class YouTubeApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'YouTubeApiError';
    this.status = status;
  }
}

// ── Pure helpers (exported for unit testing; zero I/O) ───────────────────────

/*
  `youtube-nocookie.com` is matched too, and it is not a nicety: every embed on
  this site is served from that host, so the canonical parser did not recognise
  a single URL the site actually puts in an iframe. Anything reading an id back
  off a live player had to hand-roll a regex, which is the exact scattering this
  helper was written to end.

  The host is ANCHORED to the start of the string, a `//` or a subdomain dot.
  Without it the pattern matched anywhere in the input, so `evil-youtube.com`
  and `notyoutube.com` parsed as YouTube and handed back an id. Nothing here
  feeds a fetch, but this function's answer decides what gets embedded and what
  a "Watch on YouTube" link points a visitor at.
*/
const VIDEO_ID_RE =
  /(?:^|\/\/|\.)(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|shorts\/|live\/|watch\?(?:.*&)?v=))([A-Za-z0-9_-]{11})/;

/**
 * Canonical 11-char video ID from any YouTube URL/ID form (watch, youtu.be,
 * embed, shorts, live, bare id, with extra query params), else null. This is
 * the single validated replacement for the ~5 hand-rolled regexes scattered
 * across the components.
 */
export function parseVideoId(input: string | null | undefined): string | null {
  if (typeof input !== 'string') return null;
  const s = input.trim();
  if (!s) return null;
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s; // already a bare id
  const m = s.match(VIDEO_ID_RE);
  return m ? m[1] : null;
}

/** ISO-8601 duration ("PT1H2M3S") → seconds. Returns 0 for anything unparseable. */
export function parseISO8601Duration(iso: string | null | undefined): number {
  if (typeof iso !== 'string') return 0;
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  const [, h, min, sec] = m;
  return (Number(h) || 0) * 3600 + (Number(min) || 0) * 60 + (Number(sec) || 0);
}

/** Best available thumbnail URL from a snippet.thumbnails object. */
export function pickThumbnail(thumbnails: any): string {
  if (!thumbnails) return '';
  return normalizeThumbnailUrl(
    thumbnails.maxres?.url ||
      thumbnails.standard?.url ||
      thumbnails.high?.url ||
      thumbnails.medium?.url ||
      thumbnails.default?.url ||
      ''
  );
}

/**
 * Strip YouTube's `_live` thumbnail variant.
 *
 * While a broadcast is running, the API returns `maxresdefault_live.jpg` and
 * friends. Those URLs are only valid FOR THE DURATION OF THE STREAM — once it
 * ends they stop resolving and the browser paints YouTube's grey placeholder.
 * Because the sync stores whatever it was handed, a stream synced while live
 * leaves a permanently broken image in `videos.json`. That is exactly what
 * happened to the FUTURAMA broadcast.
 *
 * The suffix-free URL is the stable one: it points at the VOD's own thumbnail
 * once the stream ends. Callers get a normal rendition name too, which lets
 * `card-images.ts` do its usual downgrade to `hqdefault` — the one rendition
 * YouTube generates for every video, live or not.
 */
export function normalizeThumbnailUrl(url: string): string {
  if (!url) return '';
  return url.replace(/_live\.jpg(\?|$)/, '.jpg$1');
}

/**
 * Whether YouTube considers this video a broadcast — live now, scheduled, or
 * long since ended.
 *
 * This used to be inferred from the creator's own tags (`live`, `live stream`,
 * `lives`), which is a guess about editorial habit rather than a fact about
 * the video. The FUTURAMA broadcast carried the tags Movies/Film/TV/Gaming/
 * Events and no `live` tag, so it came back `isLive: false`, was typed
 * `video`, and appeared in Recent Videos where live content is never meant to
 * show. Anyone who forgets the tag gets the same result.
 *
 * Two authoritative signals replace it:
 *   - `snippet.liveBroadcastContent` is `live` or `upcoming` right now
 *   - `liveStreamingDetails` exists at all, which YouTube keeps forever on
 *     anything that was ever streamed, so ENDED broadcasts are caught too
 *
 * The old tag check is kept as an additional OR rather than dropped: it can
 * only ever add to the result, so nothing a human previously marked live can
 * silently become a normal video.
 */
export function detectIsLive(item: any): boolean {
  const state = item?.snippet?.liveBroadcastContent ?? 'none';
  if (state === 'live' || state === 'upcoming') return true;
  if (item?.liveStreamingDetails) return true;

  const tags: string[] = Array.isArray(item?.snippet?.tags) ? item.snippet.tags : [];
  return tags.some((t) => {
    const normalized = String(t).toLowerCase();
    return normalized === 'live' || normalized === 'live stream' || normalized === 'lives';
  });
}

/**
 * When the video actually reached an audience.
 *
 * For an ordinary upload that is `snippet.publishedAt`. For a broadcast it is
 * simply not trustworthy, and the evidence is stronger than any theory about
 * why:
 *
 *   A stream was started from the YouTube phone app — plus button, Live,
 *   straight on air, nothing scheduled. It entered src/data/videos.json for
 *   the first time in the 2026-08-01T03:38:53Z sync, minutes after it ended
 *   (git log -S on the record confirms that sync ADDED it, and added nothing
 *   else). YouTube reported its snippet.publishedAt as 2026-07-10T21:58:39Z.
 *
 *   Twenty-one days early, on a broadcast that was never scheduled.
 *
 * The likely mechanism is that mobile "go live now" reuses a persistent
 * broadcast resource on the channel rather than minting one per stream, so
 * publishedAt reports when that resource first existed. That is a guess and is
 * labelled as one — an earlier version of this comment asserted the stream had
 * been scheduled in advance, which the channel owner corrected: it had not.
 * What is NOT a guess is that publishedAt was 21 days wrong for a stream that
 * happened that afternoon, so it cannot be the field we date broadcasts by.
 *
 * `actualStartTime` is when the stream actually began, which is true no matter
 * which resource YouTube reused to run it. `scheduledStartTime` is the fallback
 * for a stream that has not aired yet — an unscheduled mobile live has no such
 * field, which is why it is second and not first. Ordinary uploads have neither
 * and fall through to `publishedAt` unchanged.
 */
export function pickPublishedAt(item: any): string {
  const live = item?.liveStreamingDetails;
  return (
    live?.actualStartTime || live?.scheduledStartTime || item?.snippet?.publishedAt || ''
  );
}

// ── Client factory ───────────────────────────────────────────────────────────

export function createYouTubeClient(opts: YouTubeClientOptions) {
  const { apiKey, fetchImpl } = opts;
  if (!apiKey) throw new Error('createYouTubeClient: apiKey is required');
  const doFetch = fetchImpl || fetch;

  async function apiGet(resource: string, params: Record<string, string>): Promise<any> {
    const url = new URL(`${API_BASE}/${resource}`);
    url.search = new URLSearchParams({ ...params, key: apiKey }).toString();
    const res = await doFetch(url.toString(), { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      let reason = res.statusText;
      try {
        const body = await res.json();
        reason = body?.error?.message || reason;
      } catch {
        /* non-JSON error body */
      }
      throw new YouTubeApiError(`YouTube API ${resource} failed: ${reason}`, res.status);
    }
    try {
      return await res.json();
    } catch (err) {
      throw new YouTubeApiError(`YouTube API ${resource} returned invalid JSON`, res.status);
    }
  }

  return {
    parseVideoId,

    async getVideoDetails(ids: string[]): Promise<YouTubeVideo[]> {
      const clean = [...new Set(ids.map(parseVideoId).filter((x): x is string => !!x))];
      const out: YouTubeVideo[] = [];
      for (let i = 0; i < clean.length; i += 50) {
        const batch = clean.slice(i, i + 50);
        /*
          `liveStreamingDetails` is requested because it is the only reliable
          way to know a video was ever a broadcast. It costs nothing extra —
          videos.list is 1 quota unit regardless of how many parts you ask
          for — and it is absent entirely on ordinary uploads, so its mere
          presence is the signal.
        */
        const data = await apiGet('videos', {
          part: 'snippet,contentDetails,statistics,liveStreamingDetails',
          id: batch.join(','),
        });

        const verifiedItems = await Promise.all(
          (Array.isArray(data.items) ? data.items : []).map(async (item: any) => {
            let isShort = false;
            try {
              const checkShortUrl = `https://www.youtube.com/shorts/${item.id}`;
              const response = await doFetch(checkShortUrl, { method: 'HEAD', redirect: 'manual' });
              // YouTube returns 200 for Shorts, 303 for standard videos redirecting to /watch
              isShort = response.status === 200;
            } catch (err) {
              console.error(`Short network check failed for ${item.id}`, err);
            }
            
            // Fallback heuristic: If network check fails or says false, but it looks like a short
            const durationSecs = parseISO8601Duration(item.contentDetails?.duration);
            const title = item.snippet?.title || '';
            if (!isShort && (durationSecs > 0 && durationSecs <= 61 || title.toLowerCase().includes('#shorts'))) {
              isShort = true;
            }
            
            return { item, isShort };
          })
        );

        for (const { item, isShort } of verifiedItems) {
          const durationSeconds = parseISO8601Duration(item.contentDetails?.duration);
          const tags = Array.isArray(item.snippet?.tags) ? item.snippet.tags : [];
          
          const isLive = detectIsLive(item);

          const isEvent = tags.some((t: string) => {
            const normalized = t.toLowerCase();
            return normalized === 'event' || normalized === 'events' || normalized === 'con' || normalized === 'panel';
          });

          out.push({
            id: item.id,
            title: item.snippet?.title ?? '',
            description: item.snippet?.description ?? '',
            thumbnail: pickThumbnail(item.snippet?.thumbnails),
            publishedAt: pickPublishedAt(item),
            durationSeconds,
            viewCount: Number(item.statistics?.viewCount ?? 0),
            tags,
            isShort,
            isLive,
            isEvent,
          });
        }
      }
      return out;
    },

    /**
     * channels.list — 1 quota unit per call. Returns the NORMALIZED,
     * cross-platform ChannelStats shape (subscribers → followers), so future
     * Instagram/TikTok adapters return the same shape for the Media Kit.
     */
    async getChannelStats(channelId: string): Promise<ChannelStats> {
      const data = await apiGet('channels', { part: 'statistics', id: channelId });
      const s = data.items?.[0]?.statistics ?? {};
      return {
        platform: 'youtube',
        followers: Number(s.subscriberCount ?? 0),
        totalViews: Number(s.viewCount ?? 0),
        itemCount: Number(s.videoCount ?? 0),
        fetchedAt: new Date().toISOString(),
      };
    },

    /**
     * List a channel's uploads (for ingestion). ~1 unit for the channel lookup
     * + 1 unit per page of playlistItems. Paginate with the returned token.
     */
    async getUploads(
      channelId: string,
      pageToken?: string
    ): Promise<{ videos: { id: string; title: string; publishedAt: string }[]; nextPageToken?: string }> {
      const ch = await apiGet('channels', { part: 'contentDetails', id: channelId });
      const uploads = ch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
      if (!uploads) return { videos: [] };
      const params: Record<string, string> = {
        part: 'snippet,contentDetails',
        maxResults: '50',
        playlistId: uploads,
      };
      if (pageToken) params.pageToken = pageToken;
      const data = await apiGet('playlistItems', params);
      const videos = (Array.isArray(data.items) ? data.items : [])
        .map((it: any) => ({
          id: it.contentDetails?.videoId,
          title: it.snippet?.title ?? '',
          publishedAt: it.contentDetails?.videoPublishedAt ?? it.snippet?.publishedAt ?? '',
        }))
        .filter((v: any) => v.id);
      return { videos, nextPageToken: data.nextPageToken };
    },

    /**
     * Live-status check for #20's takeover billboard.
     *
     * ⚠️ QUOTA: search.list costs 100 units/call (vs 1 for the others). Free
     * tier is 10,000 units/day, so this is ~100 checks/day of headroom. The
     * CALLER must cache aggressively — a naive 5-min poll = 288 calls/day =
     * 28,800 units, ~3× over quota. The /api/live-status endpoint caches at the
     * edge accordingly (and can gate this behind a 0-quota RSS/scrape signal).
     */
    async getLiveStatus(channelId: string): Promise<LiveStatus> {
      const data = await apiGet('search', {
        part: 'snippet',
        channelId,
        eventType: 'live',
        type: 'video',
        maxResults: '1',
      });
      const item = data.items?.[0];
      if (item?.id?.videoId) {
        return { isLive: true, videoId: item.id.videoId, title: item.snippet?.title };
      }
      return { isLive: false, videoId: null };
    },

    /**
     * Fetch private channel analytics like retention, demographics, and top geos.
     * Requires OAuth parameters to be passed in YouTubeClientOptions.
     */
    async getAnalytics(): Promise<YouTubeAnalytics | null> {
      if (!opts.clientId || !opts.clientSecret || !opts.refreshToken) return null;
      try {
        const authRes = await doFetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: opts.clientId,
            client_secret: opts.clientSecret,
            refresh_token: opts.refreshToken,
            grant_type: 'refresh_token'
          })
        });
        const authData = await authRes.json();
        const access_token = authData.access_token;
        if (!access_token) return null;

        const todayDate = new Date();
        const todayStr = todayDate.toISOString().split('T')[0];
        const thirtyDaysAgo = new Date(todayDate.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const startDateLifetime = '2020-01-01'; // Safe baseline for lifetime stats

        const fetchAnalytics = async (params: Record<string, string>, overrideStart?: string, overrideEnd?: string) => {
          const url = new URL('https://youtubeanalytics.googleapis.com/v2/reports');
          url.searchParams.append('ids', 'channel==MINE');
          url.searchParams.append('startDate', overrideStart || startDateLifetime);
          url.searchParams.append('endDate', overrideEnd || todayStr);
          for (const [k, v] of Object.entries(params)) {
             url.searchParams.append(k, v);
          }
          const res = await doFetch(url.toString(), { headers: { Authorization: `Bearer ${access_token}` } });
          return res.json();
        };

        const [
          retentionData, 
          demoData, 
          geoData, 
          views30DayData, 
          deviceData, 
          trafficData, 
          subData
        ] = await Promise.all([
          fetchAnalytics({ metrics: 'averageViewPercentage' }),
          fetchAnalytics({ dimensions: 'ageGroup,gender', metrics: 'viewerPercentage' }),
          fetchAnalytics({ dimensions: 'country', metrics: 'views', sort: '-views', maxResults: '3' }),
          fetchAnalytics({ metrics: 'views' }, thirtyDaysAgo, todayStr),
          fetchAnalytics({ dimensions: 'deviceType', metrics: 'views' }, thirtyDaysAgo, todayStr),
          fetchAnalytics({ dimensions: 'insightTrafficSourceType', metrics: 'views' }, thirtyDaysAgo, todayStr),
          fetchAnalytics({ dimensions: 'subscribedStatus', metrics: 'views' }, thirtyDaysAgo, todayStr)
        ]);

        let retentionPercent = 0;
        if (retentionData?.rows?.[0]?.[0]) {
           retentionPercent = retentionData.rows[0][0];
        }

        let age18to34Percent = 0;
        let malePercent = 0;
        let femalePercent = 0;
        if (demoData?.rows) {
           for (const row of demoData.rows) {
               const age = row[0];
               const gender = row[1];
               const pct = row[2] || 0;
               if (age === 'age18-24' || age === 'age25-34') {
                   age18to34Percent += pct;
               }
               if (gender === 'male') malePercent += pct;
               if (gender === 'female') femalePercent += pct;
           }
        }

        const topGeos = [];
        if (geoData?.rows) {
           for (const row of geoData.rows) {
               topGeos.push(row[0]);
           }
        }

        let views30Days = 0;
        if (views30DayData?.rows?.[0]?.[0]) {
           views30Days = views30DayData.rows[0][0];
        }

        let totalDeviceViews = 0;
        let tvViews = 0;
        if (deviceData?.rows) {
           for (const row of deviceData.rows) {
               const views = row[1] || 0;
               totalDeviceViews += views;
               if (row[0] === 'TV') tvViews += views;
           }
        }
        const tvViewershipPercent = totalDeviceViews > 0 ? (tvViews / totalDeviceViews) * 100 : 0;

        let totalTrafficViews = 0;
        let searchViews = 0;
        if (trafficData?.rows) {
           for (const row of trafficData.rows) {
               const views = row[1] || 0;
               totalTrafficViews += views;
               if (row[0] === 'YT_SEARCH') searchViews += views;
           }
        }
        const searchTrafficPercent = totalTrafficViews > 0 ? (searchViews / totalTrafficViews) * 100 : 0;

        let totalSubViews = 0;
        let unsubViews = 0;
        if (subData?.rows) {
           for (const row of subData.rows) {
               const views = row[1] || 0;
               totalSubViews += views;
               if (row[0] === 'UNSUBSCRIBED') unsubViews += views;
           }
        }
        const unsubscribedPercent = totalSubViews > 0 ? (unsubViews / totalSubViews) * 100 : 0;

        return {
           retentionPercent,
           age18to34Percent,
           malePercent,
           femalePercent,
           topGeos,
           views30Days,
           tvViewershipPercent,
           searchTrafficPercent,
           unsubscribedPercent,
        };
      } catch (err) {
        console.error("Failed to fetch YouTube analytics", err);
        return null;
      }
    },
  };
}

export type YouTubeClient = ReturnType<typeof createYouTubeClient>;
