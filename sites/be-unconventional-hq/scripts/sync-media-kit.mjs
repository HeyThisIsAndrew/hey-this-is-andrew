/**
 * Media Kit Stats Sync — Action Edition
 * 
 * Fetches YouTube, TikTok, and Instagram followers.
 * Patches the result into Sanity (mediaKitStats), and saves it locally
 * to src/data/cache/social-stats.json as a fallback.
 */

import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { config } from 'dotenv';
import { withFileLock } from './file-lock.mjs';

config();

async function run() {
  const {
    YOUTUBE_API_KEY,
    YOUTUBE_CHANNEL_ID,
    RAPIDAPI_KEY,
    META_ACCESS_TOKEN,
    SANITY_WRITE_TOKEN,
  } = process.env;

  const SANITY_PROJECT_ID = '38nhxsib';
  const SANITY_DATASET = 'production';

  if (!YOUTUBE_API_KEY || !YOUTUBE_CHANNEL_ID || !RAPIDAPI_KEY || !META_ACCESS_TOKEN || !SANITY_WRITE_TOKEN) {
    console.error('Missing required environment variables. Ensure YOUTUBE_API_KEY, YOUTUBE_CHANNEL_ID, RAPIDAPI_KEY, META_ACCESS_TOKEN, and SANITY_WRITE_TOKEN are set.');
    process.exit(1);
  }

  const outPath = fileURLToPath(new URL('../src/data/cache/social-stats.json', import.meta.url));

  // Seed from the last known good values, NOT from zeros. Every fetch below
  // is caught and swallowed, so on failure the platform keeps whatever it
  // had rather than reporting 0 followers — a zero here would be patched
  // into Sanity via `set` and committed over social-stats.json by the
  // workflow, destroying real data because of one transient 429. The
  // fallback file is the safety net; it must survive the outage it exists
  // to cover.
  let previous = {};
  try {
    previous = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  } catch {
    console.warn('No readable social-stats.json yet — starting from zeros.');
  }

  let youtubeStats = previous.youtube ?? { followerCount: 0, viewCount: 0, videoCount: 0 };
  let tiktokStats = previous.tiktok ?? { followerCount: 0, heartCount: 0, videoCount: 0 };
  let instagramStats = previous.instagram ?? { followerCount: 0, mediaCount: 0 };

  // Track which sources actually returned data this run.
  const fetched = { youtube: false, tiktok: false, instagram: false };

  console.log('Fetching YouTube stats...');
  try {
    const ytRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${YOUTUBE_CHANNEL_ID}&key=${YOUTUBE_API_KEY}`);
    if (ytRes.ok) {
      const ytData = await ytRes.json();
      const stats = ytData.items?.[0]?.statistics;
      if (stats) {
        youtubeStats = {
          followerCount: parseInt(stats.subscriberCount || '0', 10),
          viewCount: parseInt(stats.viewCount || '0', 10),
          videoCount: parseInt(stats.videoCount || '0', 10),
        };
        fetched.youtube = true;
      }
    } else {
      console.error('YouTube fetch failed:', ytRes.status);
    }
  } catch (e) {
    console.error('YouTube error:', e);
  }

  console.log('Fetching TikTok stats...');
  try {
    const tikRes = await fetch('https://tiktok-scraper7.p.rapidapi.com/user/info?unique_id=beunconventionalhq', {
      headers: {
        'x-rapidapi-host': 'tiktok-scraper7.p.rapidapi.com',
        'x-rapidapi-key': RAPIDAPI_KEY,
      }
    });
    if (tikRes.ok) {
      const tikData = await tikRes.json();
      const stats = tikData.data?.stats;
      if (stats) {
        tiktokStats = {
          followerCount: stats.followerCount || 0,
          heartCount: stats.heartCount || 0,
          videoCount: stats.videoCount || 0,
        };
        fetched.tiktok = true;
      }
    } else {
      console.error('TikTok fetch failed:', tikRes.status);
    }
  } catch (e) {
    console.error('TikTok error:', e);
  }

  console.log('Fetching Instagram stats...');
  try {
    const fbRes = await fetch(`https://graph.facebook.com/v20.0/me/accounts?fields=instagram_business_account{followers_count,media_count}&access_token=${META_ACCESS_TOKEN}`);
    if (fbRes.ok) {
      const fbData = await fbRes.json();
      const igAccount = fbData.data?.[0]?.instagram_business_account;
      if (igAccount) {
        instagramStats = {
          followerCount: igAccount.followers_count || 0,
          mediaCount: igAccount.media_count || 0,
        };
        fetched.instagram = true;
      }
    } else {
      console.error('Instagram fetch failed:', fbRes.status);
    }
  } catch (e) {
    console.error('Instagram error:', e);
  }

  const stale = Object.entries(fetched)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);

  // If nothing came back, there is nothing to sync — writing here would just
  // republish the existing values with a fresh lastSyncedAt, making a totally
  // failed run look successful. Fail loudly instead so the Action surfaces it.
  if (stale.length === 3) {
    console.error('All three stat sources failed — leaving Sanity and social-stats.json untouched.');
    process.exit(1);
  }

  if (stale.length > 0) {
    console.warn(`Kept last known good values for: ${stale.join(', ')} (fetch failed this run).`);
  }

  const payload = {
    youtube: youtubeStats,
    tiktok: tiktokStats,
    instagram: instagramStats,
    lastSyncedAt: new Date().toISOString(),
  };

  console.log('Updating Sanity...');
  try {
    const mutations = [
      {
        createIfNotExists: {
          _id: 'mediaKitStats',
          _type: 'mediaKitStats',
          ...payload
        }
      },
      {
        patch: {
          id: 'mediaKitStats',
          set: payload
        }
      }
    ];

    const sanityUrl = `https://${SANITY_PROJECT_ID}.api.sanity.io/v2024-03-01/data/mutate/${SANITY_DATASET}`;
    const sanityRes = await fetch(sanityUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SANITY_WRITE_TOKEN}`,
      },
      body: JSON.stringify({ mutations }),
    });

    if (!sanityRes.ok) {
      console.error('Sanity patch failed:', sanityRes.status, await sanityRes.text());
    } else {
      console.log('Successfully synced Media Kit stats to Sanity.');
    }
  } catch (e) {
    console.error('Sanity patch error:', e);
  }

  console.log('Writing fallback JSON to src/data/cache/social-stats.json...');

  await withFileLock(outPath, async () => {
    const tmpPath = `${outPath}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2));
    fs.renameSync(tmpPath, outPath);
    console.log(`✔ Synced social stats locally to ${outPath}.`);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  run().catch((err) => {
    console.error('Sync failed:', err?.message || err);
    process.exit(1);
  });
}
