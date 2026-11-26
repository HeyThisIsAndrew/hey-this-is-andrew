#!/usr/bin/env node
/**
 * YouTube -> Local JSON ingestion sync for hey-this-is-andrew.
 *
 * Pulls the channel's long-form uploads from YouTube's public Atom playlist feed:
 * https://www.youtube.com/feeds/videos.xml?playlist_id=UULFNn5badDO7pbspeS6noInCw
 *
 * Excludes YouTube Shorts and live streams automatically (the UULF playlist only contains
 * long-form videos). Probes HD thumbnails and upserts records into
 * sites/hey-this-is-andrew/src/data/videos.json.
 *
 * Dry-run by default; pass --execute to write src/data/videos.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CHANNEL_ID = 'UCNn5badDO7pbspeS6noInCw';
export const LONGFORM_PLAYLIST_ID = 'UULFNn5badDO7pbspeS6noInCw';
export const FEED_URL = `https://www.youtube.com/feeds/videos.xml?playlist_id=${LONGFORM_PLAYLIST_ID}`;

export const YT_THUMB_VARIANTS = [
  { name: 'maxresdefault', w: 1280 },
  { name: 'sddefault', w: 640 },
  { name: 'hqdefault', w: 480 },
];

/**
 * Parses Atom XML feed entries into video records.
 */
export function parseYouTubeAtomFeed(xmlText) {
  if (!xmlText || typeof xmlText !== 'string') return [];
  const entries = [];
  const entryMatches = xmlText.matchAll(/<entry>([\s\S]*?)<\/entry>/g);

  for (const match of entryMatches) {
    const block = match[1];
    const idMatch = block.match(/<yt:videoId>(.*?)<\/yt:videoId>/) || block.match(/<id>yt:video:(.*?)<\/id>/);
    const titleMatch = block.match(/<title>(.*?)<\/title>/);
    const pubMatch = block.match(/<published>(.*?)<\/published>/);
    const descMatch = block.match(/<media:description>([\s\S]*?)<\/media:description>/);
    const thumbMatch = block.match(/<media:thumbnail[^>]+url="([^"]+)"/);

    if (idMatch && idMatch[1]) {
      const id = idMatch[1].trim();
      const rawTitle = titleMatch ? titleMatch[1].trim() : '';
      const title = rawTitle
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

      const published = pubMatch ? pubMatch[1].trim() : new Date().toISOString();
      const rawDesc = descMatch ? descMatch[1].trim() : '';
      const description = rawDesc
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .slice(0, 300);

      const defaultThumb = thumbMatch ? thumbMatch[1] : `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

      entries.push({
        id,
        title,
        description,
        published_at: published,
        url: `https://www.youtube.com/watch?v=${id}`,
        thumbnail: defaultThumb,
      });
    }
  }

  return entries;
}

/**
 * HEAD-probe thumbnail URLs to build responsive srcset.
 */
export async function probeThumbnailVariants(videoId, fetchFn = fetch) {
  const variants = YT_THUMB_VARIANTS.map((v) => ({
    ...v,
    url: `https://i.ytimg.com/vi/${videoId}/${v.name}.jpg`,
  }));

  const probed = await Promise.all(
    variants.map(async (v) => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 4000);
        const res = await fetchFn(v.url, { method: 'HEAD', signal: ctrl.signal });
        clearTimeout(t);
        if (!res.ok) return { ...v, bytes: 0 };
        const len = parseInt(res.headers.get('content-length') ?? '0', 10);
        return { ...v, bytes: Number.isNaN(len) ? 0 : len };
      } catch {
        return { ...v, bytes: 0 };
      }
    })
  );

  // YouTube serves a ~120px 1097-byte placeholder image for missing HD variants.
  // 20,000 bytes cleanly filters placeholders out.
  const good = probed.filter((v) => v.bytes > 20000);
  if (good.length === 0) {
    const fallback = variants[2].url;
    return {
      thumbnail: fallback,
      imageSrcset: `${fallback} 480w`,
    };
  }

  return {
    thumbnail: good[0].url,
    imageSrcset: good.map((v) => `${v.url} ${v.w}w`).join(', '),
  };
}

/**
 * Merge newly fetched videos into existing video snapshot without dropping old records.
 */
export function mergeVideos(existingVideos, newVideos) {
  const map = new Map();
  for (const v of existingVideos) {
    if (v && v.id) map.set(v.id, v);
  }
  for (const v of newVideos) {
    if (!v || !v.id) continue;
    const prev = map.get(v.id) || {};
    map.set(v.id, {
      ...prev,
      ...v,
      thumbnail: v.thumbnail || prev.thumbnail,
      imageSrcset: v.imageSrcset || prev.imageSrcset,
    });
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.published_at || b.date).getTime() - new Date(a.published_at || a.date).getTime()
  );
}

export async function runSync(options = {}) {
  const execute = options.execute ?? process.argv.includes('--execute');
  const feedUrl = options.feedUrl ?? FEED_URL;
  const dataPath = options.dataPath ?? path.resolve(__dirname, '../src/data/videos.json');

  console.log(`[sync-youtube] Fetching long-form feed: ${feedUrl}`);
  const res = await fetch(feedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; HeyThisIsAndrewContentSync/1.0)',
    },
  });

  if (!res.ok) {
    throw new Error(`[sync-youtube] Failed to fetch feed: ${res.status} ${res.statusText}`);
  }

  const xmlText = await res.text();
  const parsed = parseYouTubeAtomFeed(xmlText);
  console.log(`[sync-youtube] Parsed ${parsed.length} long-form videos from feed.`);

  // Probe thumbnails for new videos
  for (const item of parsed) {
    try {
      const thumbs = await probeThumbnailVariants(item.id);
      item.thumbnail = thumbs.thumbnail;
      item.imageSrcset = thumbs.imageSrcset;
    } catch (err) {
      console.warn(`[sync-youtube] Thumbnail probe failed for ${item.id}:`, err);
    }
  }

  let existing = [];
  if (fs.existsSync(dataPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      if (!Array.isArray(existing)) existing = [];
    } catch {
      existing = [];
    }
  }

  const merged = mergeVideos(existing, parsed);
  console.log(`[sync-youtube] Total merged videos: ${merged.length}`);

  if (execute) {
    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.writeFileSync(dataPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
    console.log(`[sync-youtube] Successfully written to ${dataPath}`);
  } else {
    console.log('[sync-youtube] Dry-run complete. Pass --execute to write to disk.');
  }

  return merged;
}

// Run CLI directly if invoked from command line
if (process.argv[1] === __filename) {
  runSync().catch((err) => {
    console.error('[sync-youtube] Fatal error:', err);
    process.exit(1);
  });
}
