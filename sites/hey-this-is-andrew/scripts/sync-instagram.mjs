#!/usr/bin/env node
/**
 * scripts/sync-instagram.mjs: self-host the "Shot on the Job" photos.
 *
 *   npm run sync:instagram
 *
 * Why: Instagram's CDN URLs are signed and expire (the `oe=` parameter). The
 * site used to hotlink them, so every photo would break without warning.
 * This script downloads each photo ONCE into src/assets/instagram/<id>.webp
 * and records `localImage` in src/data/instagram-feed.json. The build reads
 * only these local files (src/lib/instagram.ts) and runs them through
 * Astro's image pipeline (responsive sizes, width/height, lazy loading); no
 * remote Instagram URL ever reaches the page.
 *
 * Sources, in order:
 *   1. The Instagram Graph API, when CCC_INSTAGRAM_ACCESS_TOKEN is set (fresh,
 *      unexpired URLs for new posts and for any photo not yet downloaded).
 *      The photos are Capture Create Caffeinate's. CCC_INSTAGRAM_USER_ID is
 *      optional: without it the token's own account (`me`) is read.
 *   2. The URLs already cached in instagram-feed.json (valid until they
 *      expire; the current set expires 2026-10-05).
 *
 * Contract: loud but NON-FATAL. A blocked or failed fetch never blanks the
 * feed and never deletes a downloaded photo. Photos that could not be
 * downloaded are listed in src/data/instagram-media-todo.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FEED = path.join(root, 'src/data/instagram-feed.json');
const OUT_DIR = path.join(root, 'src/assets/instagram');
const TODO = path.join(root, 'src/data/instagram-media-todo.md');
// Reels are saved here at deploy time (gitignored) so the homepage elevator
// plays its own file instead of depending on Instagram's embed.
const REEL_DIR = path.join(root, 'public/reels');
const LIMIT = 35;

const token = (process.env.CCC_INSTAGRAM_ACCESS_TOKEN || '').trim();
const userId = (process.env.CCC_INSTAGRAM_USER_ID || '').trim() || 'me';

async function fetchWithTimeout(url, ms = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Flatten Graph API media into feed rows (one photo per post). */
function fromApi(items) {
  const rows = [];
  for (const item of items) {
    const caption = item.caption || '';
    const first = caption.split('\n')[0].trim() || 'Capture Create Caffeinate';
    let id = item.id;
    let url = item.media_type === 'VIDEO' ? item.thumbnail_url : item.media_url;
    let mediaType = item.media_type;
    if (item.children?.data?.length) {
      const primary = item.children.data.find((c) => c.media_url && c.media_type !== 'VIDEO') || item.children.data[0];
      if (!primary?.media_url) continue;
      id = primary.id;
      url = primary.media_url;
      mediaType = 'CAROUSEL_ITEM';
    }
    if (!url) continue;
    rows.push({
      id,
      url,
      // The reel's own MP4. Instagram omits media_url for a video with
      // copyrighted audio, which is then embed-only.
      videoUrl: item.media_type === 'VIDEO' && !item.children?.data?.length ? item.media_url : undefined,
      caption: first,
      fullCaption: caption,
      permalink: item.permalink,
      mediaType,
      timestamp: item.timestamp,
      orientation: 'vertical',
    });
  }
  return rows;
}

async function readApi() {
  if (!token) {
    console.log('[sync:instagram] No CCC_INSTAGRAM_ACCESS_TOKEN: using cached URLs only.');
    return null;
  }
  const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{id,media_url,media_type}';
  const url = `https://graph.instagram.com/${encodeURIComponent(userId)}/media?fields=${fields}&limit=${LIMIT}&access_token=${encodeURIComponent(token)}`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const data = Array.isArray(json.data) ? json.data : [];
    const rows = fromApi(data);
    // What the API page covers: every id it returned, back to its oldest
    // post. A cached post older than that is simply off the page, not gone.
    rows.apiIds = new Set(data.map((d) => d.id));
    rows.oldest = data.reduce((m, d) => (d.timestamp && (!m || d.timestamp < m) ? d.timestamp : m), '');
    console.log(`[sync:instagram] API returned ${rows.length} photos.`);
    return rows;
  } catch (err) {
    console.warn(`[sync:instagram] API fetch failed (${err.message}); keeping the cached feed.`);
    return null;
  }
}

/** Save a reel's MP4 (re-encoded small when ffmpeg is present). */
async function downloadReel(row) {
  const rel = `reels/${row.id}.mp4`;
  const file = path.join(REEL_DIR, `${row.id}.mp4`);
  if (fs.existsSync(file)) return rel;
  if (!row.videoUrl) return null;
  try {
    const res = await fetchWithTimeout(row.videoUrl, 60000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = path.join(REEL_DIR, `${row.id}.src.mp4`);
    fs.writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
    const ff = spawnSync('ffmpeg', [
      '-y', '-loglevel', 'error', '-i', raw,
      '-vf', "scale='min(720,iw)':-2", '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', file,
    ]);
    if (ff.status === 0 && fs.existsSync(file)) fs.rmSync(raw);
    else fs.renameSync(raw, file);
    return rel;
  } catch (err) {
    console.warn(`[sync:instagram] Could not download reel ${row.id} (${err.message}).`);
    return null;
  }
}

async function download(row) {
  const file = path.join(OUT_DIR, `${row.id}.webp`);
  const rel = `instagram/${row.id}.webp`; // relative to src/assets
  if (fs.existsSync(file)) {
    const meta = await sharp(file).metadata();
    return { localImage: rel, width: meta.width, height: meta.height };
  }
  if (!row.url) return null;
  try {
    const res = await fetchWithTimeout(row.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const out = await sharp(buf).rotate().resize({ width: 1440, withoutEnlargement: true }).webp({ quality: 90 }).toBuffer({ resolveWithObject: true });
    fs.writeFileSync(file, out.data);
    return { localImage: rel, width: out.info.width, height: out.info.height };
  } catch (err) {
    console.warn(`[sync:instagram] Could not download ${row.id} (${err.message}).`);
    return null;
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let cached = [];
  try {
    cached = JSON.parse(fs.readFileSync(FEED, 'utf8'));
  } catch {
    cached = [];
  }

  // Merge: API rows win for fields they carry (fresh URLs); cached rows keep
  // any hand-set fields (location, venue, event) and are never dropped.
  const byId = new Map(cached.map((r) => [r.id, r]));
  const apiRows = await readApi();
  const apiIds = apiRows ? new Set([...apiRows.apiIds, ...apiRows.map((r) => r.id)]) : null;
  const apiOldest = apiRows?.oldest || '';
  for (const row of apiRows || []) {
    byId.set(row.id, { ...(byId.get(row.id) || {}), ...row });
  }
  const rows = [...byId.values()].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));

  const missing = [];
  for (const row of rows) {
    const got = await download(row);
    if (got) Object.assign(row, got);
    else missing.push(row);
  }

  // Reels: save the file, and say plainly what state each one is in, so a
  // broken embed can be traced to a removed post, an embed-only reel
  // (copyrighted audio: no media_url) or a failed download.
  fs.mkdirSync(REEL_DIR, { recursive: true });
  const reelProblems = [];
  for (const row of rows.filter((r) => r.mediaType === 'VIDEO')) {
    if (apiIds) {
      if (apiIds.has(row.id)) delete row.removedFromInstagram;
      else if (apiOldest && String(row.timestamp) >= apiOldest) row.removedFromInstagram = true;
    }
    const localVideo = row.removedFromInstagram ? null : await downloadReel(row);
    if (localVideo) row.localVideo = localVideo;
    const state = row.removedFromInstagram
      ? 'NOT on the account any more (removed or private)'
      : localVideo
        ? `self-hosted (${localVideo})`
        : apiIds && !row.videoUrl
          ? 'on the account, but the API gives no file (copyrighted audio): embed only'
          : 'not downloaded (no token, or the download failed): embed only';
    console.log(`[sync:instagram] reel ${row.permalink}: ${state}`);
    if (!localVideo) reelProblems.push({ row, state });
    delete row.videoUrl; // signed, expiring: never kept
  }

  fs.writeFileSync(FEED, JSON.stringify(rows, null, 2) + '\n');
  const ok = rows.length - missing.length;
  console.log(`[sync:instagram] ${ok}/${rows.length} photos self-hosted in src/assets/instagram/.`);

  if (missing.length) {
    const lines = [
      '# TODO (Andrew): photos that could not be self-hosted',
      '',
      'The site shows only photos stored in `src/assets/instagram/`. These',
      'posts are in the feed but their image could not be downloaded. Run',
      '`npm run sync:instagram` from your machine (with `CCC_INSTAGRAM_ACCESS_TOKEN`',
      'set, or before the cached URLs expire), or save the image yourself as',
      '`src/assets/instagram/<id>.webp`.',
      '',
      '| id | post | shot |',
      '| --- | --- | --- |',
      ...missing.map((r) => `| ${r.id} | ${r.permalink || ''} | ${String(r.caption || '').replace(/\|/g, '/').slice(0, 90)} |`),
      '',
      ...(reelProblems.length
        ? [
            '## Reels without a self-hosted file',
            '',
            '| post | state |',
            '| --- | --- |',
            ...reelProblems.map(({ row, state }) => `| ${row.permalink} | ${state} |`),
            '',
          ]
        : []),
    ];
    fs.writeFileSync(TODO, lines.join('\n'));
    console.warn(`[sync:instagram] ${missing.length} photo(s) not downloaded: listed in src/data/instagram-media-todo.md`);
  } else if (fs.existsSync(TODO)) {
    fs.rmSync(TODO);
  }
}

main().catch((err) => {
  // Non-fatal by contract: a failed sync must never fail a deploy.
  console.error('[sync:instagram] Unexpected error:', err);
});
