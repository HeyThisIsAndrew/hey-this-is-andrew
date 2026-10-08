/**
 * Refreshes src/data/cache/channel-stats.json from the YouTube Data +
 * Analytics APIs. Deliberately its own `npm run refresh-analytics` command,
 * NOT chained into `dev` or `build` - it used to hang off `refresh-content`,
 * which those commands ran, and which has since been deleted along with the
 * dead cache it refreshed. The Analytics half needs an OAuth token exchange plus 7
 * parallel report queries per run, and running that on every local dev
 * server start or every build would burn quota fast for no benefit, since
 * the result is a committed file the build just reads statically. Run this
 * on demand (locally, or via the "Update YouTube Analytics" GitHub Action's
 * workflow_dispatch) and commit the result - that's the only trigger.
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, '../src/data/cache');
const STATS_FILE = path.join(CACHE_DIR, 'channel-stats.json');

const {
  YOUTUBE_API_KEY,
  YOUTUBE_CHANNEL_ID,
  YOUTUBE_CLIENT_ID,
  YOUTUBE_CLIENT_SECRET,
  YOUTUBE_REFRESH_TOKEN,
} = process.env;

const channelId = YOUTUBE_CHANNEL_ID || 'UC6P1J3z1jW7kU_y_XWjK2Q';

async function fetchStats() {
  if (!YOUTUBE_API_KEY) {
    throw new Error('YOUTUBE_API_KEY is missing');
  }

  console.log('[channel-stats] Fetching public channel statistics...');
  const statsRes = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${YOUTUBE_API_KEY}`
  );
  if (!statsRes.ok) throw new Error('Failed to fetch public stats');
  const statsData = await statsRes.json();
  const s = statsData.items?.[0]?.statistics ?? {};
  
  let result = {
    followers: Number(s.subscriberCount ?? 0),
    totalViews: Number(s.viewCount ?? 0),
    itemCount: Number(s.videoCount ?? 0),
    fetchedAt: new Date().toISOString(),
  };

  // If OAuth creds are present, fetch analytics
  if (YOUTUBE_CLIENT_ID && YOUTUBE_CLIENT_SECRET && YOUTUBE_REFRESH_TOKEN) {
    console.log('[channel-stats] Fetching private analytics...');
    try {
      const authRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: YOUTUBE_CLIENT_ID,
          client_secret: YOUTUBE_CLIENT_SECRET,
          refresh_token: YOUTUBE_REFRESH_TOKEN,
          grant_type: 'refresh_token',
        }),
      });
      if (!authRes.ok) {
        throw new Error(`Auth failed: ${authRes.status} ${await authRes.text()}`);
      }
      const authData = await authRes.json();
      const access_token = authData.access_token;
  
      if (access_token) {
        const todayDate = new Date();
        const todayStr = todayDate.toISOString().split('T')[0];
        const thirtyDaysAgo = new Date(todayDate.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const startDateLifetime = '2020-01-01';
  
        const fetchAnalytics = async (params, overrideStart, overrideEnd) => {
          const url = new URL('https://youtubeanalytics.googleapis.com/v2/reports');
          url.searchParams.append('ids', 'channel==MINE');
          url.searchParams.append('startDate', overrideStart || startDateLifetime);
          url.searchParams.append('endDate', overrideEnd || todayStr);
          for (const [k, v] of Object.entries(params)) {
            url.searchParams.append(k, v);
          }
          const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${access_token}` } });
          if (!res.ok) {
            const body = await res.text();
            throw new Error(`Analytics API error: ${res.status} - ${body}`);
          }
          return res.json();
        };
  
        const [retentionData, demoData, geoData, views30DayData, deviceData, trafficData, subData] = await Promise.all([
          fetchAnalytics({ metrics: 'averageViewPercentage' }),
          fetchAnalytics({ dimensions: 'ageGroup,gender', metrics: 'viewerPercentage' }),
          fetchAnalytics({ dimensions: 'country', metrics: 'views', sort: '-views', maxResults: '3' }),
          fetchAnalytics({ metrics: 'views' }, thirtyDaysAgo, todayStr),
          fetchAnalytics({ dimensions: 'deviceType', metrics: 'views' }, thirtyDaysAgo, todayStr),
          fetchAnalytics({ dimensions: 'insightTrafficSourceType', metrics: 'views' }, thirtyDaysAgo, todayStr),
          fetchAnalytics({ dimensions: 'subscribedStatus', metrics: 'views' }, thirtyDaysAgo, todayStr),
        ]);
  
        let retentionPercent = retentionData?.rows?.[0]?.[0] || 0;
        
        let age18to34Percent = 0;
        let malePercent = 0;
        let femalePercent = 0;
        if (demoData?.rows) {
          for (const row of demoData.rows) {
            const pct = row[2] || 0;
            if (row[0] === 'age18-24' || row[0] === 'age25-34') age18to34Percent += pct;
            if (row[1] === 'male') malePercent += pct;
            if (row[1] === 'female') femalePercent += pct;
          }
        }
  
        const topGeos = geoData?.rows?.map(row => row[0]) || [];
        const views30Days = views30DayData?.rows?.[0]?.[0] || 0;
  
        let totalDeviceViews = 0;
        let tvViews = 0;
        if (deviceData?.rows) {
          for (const row of deviceData.rows) {
            totalDeviceViews += row[1] || 0;
            if (row[0] === 'TV') tvViews += row[1] || 0;
          }
        }
        const tvViewershipPercent = totalDeviceViews > 0 ? (tvViews / totalDeviceViews) * 100 : 0;
  
        let totalTrafficViews = 0;
        let searchViews = 0;
        if (trafficData?.rows) {
          for (const row of trafficData.rows) {
            totalTrafficViews += row[1] || 0;
            if (row[0] === 'YT_SEARCH') searchViews += row[1] || 0;
          }
        }
        const searchTrafficPercent = totalTrafficViews > 0 ? (searchViews / totalTrafficViews) * 100 : 0;
  
        let totalSubViews = 0;
        let unsubViews = 0;
        if (subData?.rows) {
          for (const row of subData.rows) {
            totalSubViews += row[1] || 0;
            if (row[0] === 'UNSUBSCRIBED') unsubViews += row[1] || 0;
          }
        }
        const unsubscribedPercent = totalSubViews > 0 ? (unsubViews / totalSubViews) * 100 : 0;
  
        const impressions = 0; // YouTube Analytics API v2 does not support channel-level thumbnail impressions
  
        result.analytics = {
          retentionPercent,
          age18to34Percent,
          malePercent,
          femalePercent,
          topGeos,
          views30Days,
          tvViewershipPercent,
          searchTrafficPercent,
          unsubscribedPercent,
          impressions,
        };
      } else {
        console.warn('[channel-stats] Auth failed, skipping analytics');
      }
    } catch (err) {
      console.warn(`[channel-stats] Private analytics failed: ${err.message}`);
    }
  } else {
    console.warn('[channel-stats] No OAuth credentials, skipping analytics');
  }

  return result;
}

async function run() {
  await fs.mkdir(CACHE_DIR, { recursive: true });

  // Last known good cache, used to avoid regressing it on a PARTIAL failure.
  let previous = null;
  try {
    previous = JSON.parse(await fs.readFile(STATS_FILE, 'utf8'));
  } catch {
    // No readable cache yet — nothing to preserve.
  }

  try {
    const stats = await fetchStats();

    // fetchStats() only throws when the PUBLIC stats call fails. The analytics
    // leg can fail on its own (OAuth refresh rejected, a single Analytics API
    // call erroring) and is merely warned about, returning a result with no
    // `analytics` block at all. Writing that straight out would erase
    // demographics that were previously fetched successfully — and this file
    // is auto-committed every Monday by update-analytics.yml, so the loss
    // would be permanent. media-kit.astro renders 'XX%' for every missing
    // analytics field, so the visible symptom is the whole media kit
    // reverting to placeholders after one transient auth blip.
    if (!stats.analytics && previous?.analytics) {
      stats.analytics = previous.analytics;
      console.warn(
        '[channel-stats] Analytics unavailable this run — kept the previously cached analytics block rather than dropping it.'
      );
    }

    await fs.writeFile(STATS_FILE, JSON.stringify(stats, null, 2));
    console.log(`[channel-stats] Successfully cached channel stats to ${STATS_FILE}`);
  } catch (error) {
    console.error(`[channel-stats] Ingestion failed: ${error.message}`);
    try {
      await fs.access(STATS_FILE);
      console.log('[channel-stats] Kept existing cache');
    } catch {
      const safeFallback = {
        followers: 0, totalViews: 0, itemCount: 0, fetchedAt: new Date().toISOString(),
        analytics: {
          retentionPercent: 0, age18to34Percent: 0, malePercent: 0, femalePercent: 0,
          topGeos: [], views30Days: 0, tvViewershipPercent: 0, searchTrafficPercent: 0,
          unsubscribedPercent: 0, impressions: 0
        }
      };
      await fs.writeFile(STATS_FILE, JSON.stringify(safeFallback, null, 2));
      console.log('[channel-stats] Wrote safe fallback cache object to prevent NaN crashes');
    }
    process.exit(1);
  }
}

run();
