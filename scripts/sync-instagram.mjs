#!/usr/bin/env node
/**
 * scripts/sync-instagram.mjs: self-host the "Shot on the Job" photos.
 *
 *   npm run sync:instagram
 *
 * Why: Instagram's CDN URLs are signed and expire (the `oe=` parameter). The
 * site used to hotlink them, so every photo would break without warning.
 * This script downloads each photo ONCE into public/images/instagram/<id>.webp
 * and records `localImage` in src/data/instagram-feed.json. The build reads
 * only local files (src/lib/instagram.ts); no remote Instagram URL ever
 * reaches the page.
 *
 * Sources, in order:
 *   1. The Instagram Graph API, when INSTAGRAM_ACCESS_TOKEN is set (fresh,
 *      unexpired URLs for new posts and for any photo not yet downloaded).
 *   2. The URLs already cached in instagram-feed.json (valid until they
 *      expire; the current set expires 2026-10-05).
 *
 * Contract: loud but NON-FATAL. A blocked or failed fetch never blanks the
 * feed and never deletes a downloaded photo. Photos that could not be
 * downloaded are listed in src/data/instagram-media-todo.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FEED = path.join(root, 'src/data/instagram-feed.json');
const OUT_DIR = path.join(root, 'public/images/instagram');
const TODO = path.join(root, 'src/data/instagram-media-todo.md');
const LIMIT = 35;

const token = (process.env.INSTAGRAM_ACCESS_TOKEN || '').trim();

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
    console.log('[sync:instagram] No INSTAGRAM_ACCESS_TOKEN: using cached URLs only.');
    return [];
  }
  const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{id,media_url,media_type}';
  const url = `https://graph.instagram.com/me/media?fields=${fields}&limit=${LIMIT}&access_token=${encodeURIComponent(token)}`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const rows = fromApi(Array.isArray(json.data) ? json.data : []);
    console.log(`[sync:instagram] API returned ${rows.length} photos.`);
    return rows;
  } catch (err) {
    console.warn(`[sync:instagram] API fetch failed (${err.message}); keeping the cached feed.`);
    return [];
  }
}

async function download(row) {
  const file = path.join(OUT_DIR, `${row.id}.webp`);
  const rel = `images/instagram/${row.id}.webp`;
  if (fs.existsSync(file)) {
    const meta = await sharp(file).metadata();
    return { localImage: rel, width: meta.width, height: meta.height };
  }
  if (!row.url) return null;
  try {
    const res = await fetchWithTimeout(row.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const out = await sharp(buf).rotate().resize({ width: 1080, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
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
  for (const row of await readApi()) {
    byId.set(row.id, { ...(byId.get(row.id) || {}), ...row });
  }
  const rows = [...byId.values()].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));

  const missing = [];
  for (const row of rows) {
    const got = await download(row);
    if (got) Object.assign(row, got);
    else missing.push(row);
  }

  fs.writeFileSync(FEED, JSON.stringify(rows, null, 2) + '\n');
  const ok = rows.length - missing.length;
  console.log(`[sync:instagram] ${ok}/${rows.length} photos self-hosted in public/images/instagram/.`);

  if (missing.length) {
    const lines = [
      '# TODO (Andrew): photos that could not be self-hosted',
      '',
      'The site shows only photos stored in `public/images/instagram/`. These',
      'posts are in the feed but their image could not be downloaded. Run',
      '`npm run sync:instagram` from your machine (with `INSTAGRAM_ACCESS_TOKEN`',
      'set, or before the cached URLs expire), or save the image yourself as',
      '`public/images/instagram/<id>.webp`.',
      '',
      '| id | post | shot |',
      '| --- | --- | --- |',
      ...missing.map((r) => `| ${r.id} | ${r.permalink || ''} | ${String(r.caption || '').replace(/\|/g, '/').slice(0, 90)} |`),
      '',
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
