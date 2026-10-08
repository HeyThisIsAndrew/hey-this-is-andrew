/**
 * /dispatch.xml, the newsletter feed Kit reads (issue #266), and the images
 * it points at. Offline: no network, no build.
 *
 * ─── WHAT THIS IS GUARDING ──────────────────────────────────────────────────
 *   1. NO IMAGE IS EVER CUT OFF (the owner's rule). The composer is handed a
 *      wide picture with a one-colour frame round its very edge, and every
 *      side of that frame has to survive into the 16:9 output.
 *   2. THE FEATURED BOX ALWAYS OPENS ON AN IMAGE. A story with no built art
 *      gets the branded fallback, never no image and never the raw original
 *      (which could be any shape, and the email's box would crop it).
 *   3. The item shape Kit's Post Template depends on: the image FIRST in
 *      content:encoded (Kit has no image variable), categories as
 *      [type, section], Video for a video, absolute slash-free links.
 *   4. The selection: articles and long-form videos together, newest first,
 *      capped, shorts and live streams out.
 *   5. The committed manifest only lists 1200x675 files that exist.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import sharp from 'sharp';
import {
  selectDispatchEntries,
  isDispatchVideoDoc,
  dispatchImageUrl,
  dispatchContentHtml,
  articleEntry,
  videoEntry,
  DISPATCH_FEED_LIMIT,
  DISPATCH_FALLBACK_IMAGE,
} from '../src/lib/dispatch-feed.ts';
import { composeDispatchImage, WIDTH, HEIGHT } from './dispatch-image.mjs';

const SITE = 'https://beunconventionalhq.com/';
const article = (over = {}) => ({
  slug: 'a-story',
  title: 'A Story',
  isoDate: '2026-09-10T12:00:00.000Z',
  excerpt: 'The standfirst.',
  image: 'https://example.com/a.jpg',
  category: 'TV',
  contentType: 'Review',
  ...over,
});
const video = (over = {}) => ({
  title: 'A Video',
  link: 'https://www.youtube.com/watch?v=abcdefghijk',
  youtubeId: 'abcdefghijk',
  publishedAt: '2026-09-12T12:00:00.000Z',
  description: 'What it covers.',
  thumbnail: 'https://i.ytimg.com/vi/abcdefghijk/maxresdefault.jpg',
  category: 'Film',
  ...over,
});

test('an article: absolute slash-free link, [type, section], its own summary', () => {
  const e = articleEntry(article(), SITE);
  assert.equal(e.link, 'https://beunconventionalhq.com/intel/a-story');
  assert.deepEqual(e.categories, ['Review', 'TV']);
  assert.equal(e.summary, 'The standfirst.');
  // No type falls back to Story; a "General" section says nothing, so it goes.
  assert.deepEqual(articleEntry(article({ contentType: '', category: 'General' }), SITE).categories, ['Story']);
});

test('a video: Video first (the Watch now button), then its section', () => {
  const e = videoEntry(video());
  assert.deepEqual(e.categories, ['Video', 'Film']);
  assert.equal(e.link, 'https://www.youtube.com/watch?v=abcdefghijk');
  assert.equal(videoEntry(video({ isShort: true })), null);
  assert.equal(videoEntry(video({ isLive: true })), null);
});

test('selection: newest first across both kinds, capped, bad dates dropped', () => {
  const articles = Array.from({ length: 15 }, (_, i) =>
    article({ slug: `a${i}`, title: `A${i}`, isoDate: `2026-08-${String(i + 1).padStart(2, '0')}T00:00:00Z` }),
  );
  const videos = Array.from({ length: 15 }, (_, i) =>
    video({ title: `V${i}`, publishedAt: `2026-09-${String(i + 1).padStart(2, '0')}T00:00:00Z` }),
  );
  const picked = selectDispatchEntries([...articles, article({ isoDate: 'not a date' })], videos, SITE);
  assert.equal(picked.length, DISPATCH_FEED_LIMIT);
  assert.equal(picked[0].title, 'V14');
  for (let i = 1; i < picked.length; i++) assert.ok(picked[i - 1].pubDate >= picked[i].pubDate);
});

test('the raw-doc predicate matches getVideosUnified plus the long-form rule', () => {
  const doc = { _type: 'video', youtubeId: 'abcdefghijk', title: 'T', contentStatus: 'published' };
  assert.equal(isDispatchVideoDoc(doc), true);
  assert.equal(isDispatchVideoDoc({ ...doc, contentStatus: undefined }), true);
  assert.equal(isDispatchVideoDoc({ ...doc, contentStatus: 'draft' }), false);
  assert.equal(isDispatchVideoDoc({ ...doc, _type: 'short' }), false);
  assert.equal(isDispatchVideoDoc({ ...doc, manualTypeOverride: 'live' }), false);
  assert.equal(isDispatchVideoDoc({ ...doc, isShort: true }), false);
});

test('image: the composed file when built, else the branded fallback, never the raw source', () => {
  const e = articleEntry(article(), SITE);
  const built = { 'https://example.com/a.jpg': { src: '/dispatch/images/abc.jpg', width: 1200, height: 675 } };
  assert.equal(dispatchImageUrl(e, built, SITE), 'https://beunconventionalhq.com/dispatch/images/abc.jpg');
  assert.equal(dispatchImageUrl(e, {}, SITE), `https://beunconventionalhq.com${DISPATCH_FALLBACK_IMAGE}`);
  // A manifest entry of the wrong size is not trusted.
  const wrong = { 'https://example.com/a.jpg': { src: '/x.jpg', width: 1200, height: 630 } };
  assert.equal(dispatchImageUrl(e, wrong, SITE), `https://beunconventionalhq.com${DISPATCH_FALLBACK_IMAGE}`);
  assert.equal(dispatchImageUrl(articleEntry(article({ image: '' }), SITE), built, SITE).endsWith(DISPATCH_FALLBACK_IMAGE), true);
});

test('content:encoded starts with the 1200x675 image, then the escaped summary', () => {
  const e = articleEntry(article({ excerpt: 'Tom & Jerry say "hi" > 3' }), SITE);
  const html = dispatchContentHtml(e, 'https://beunconventionalhq.com/dispatch/images/abc.jpg');
  assert.match(html, /^<img src="https:\/\/beunconventionalhq\.com\/dispatch\/images\/abc\.jpg" width="1200" height="675" alt="">/);
  assert.match(html, /<p>Tom &amp; Jerry say &quot;hi&quot; &gt; 3<\/p>$/);
});

test('the fallback art is committed and 16:9', async () => {
  const file = new URL(`../public${DISPATCH_FALLBACK_IMAGE}`, import.meta.url);
  assert.ok(existsSync(file));
  const meta = await sharp(file.pathname).metadata();
  assert.deepEqual([meta.width, meta.height], [1200, 675]);
});

test('the committed manifest lists only 1200x675 files that exist', async () => {
  const manifest = JSON.parse(readFileSync(new URL('../src/data/dispatch-images.json', import.meta.url), 'utf8'));
  for (const [source, entry] of Object.entries(manifest)) {
    assert.deepEqual([entry.width, entry.height], [1200, 675], source);
    const file = new URL(`../public${entry.src}`, import.meta.url);
    assert.ok(existsSync(file), `missing ${entry.src}`);
    const meta = await sharp(file.pathname).metadata();
    assert.deepEqual([meta.width, meta.height], [1200, 675], entry.src);
  }
});

/** A w x h image, mid grey, with a `border`px pure green frame at its very edge. */
async function framed(w, h, border = 6) {
  const inner = await sharp({ create: { width: w - 2 * border, height: h - 2 * border, channels: 3, background: '#808080' } })
    .png()
    .toBuffer();
  return sharp({ create: { width: w, height: h, channels: 3, background: '#00ff00' } })
    .composite([{ input: inner, left: border, top: border }])
    .png()
    .toBuffer();
}

async function pixel(buffer, x, y) {
  const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return [data[i], data[i + 1], data[i + 2]];
}
const isGreen = ([r, g, b]) => g > 180 && r < 90 && b < 90;

test('composer: a wide image keeps all four edges (nothing cut off)', async () => {
  // 2.4:1, wider than 16:9: cover would cut the left and right edges off.
  const out = await composeDispatchImage(await framed(1440, 600));
  const meta = await sharp(out).metadata();
  assert.deepEqual([meta.width, meta.height], [WIDTH, HEIGHT]);
  // Fitted to 1200x500, centred: rows 87..587. Sample just inside each edge.
  assert.ok(isGreen(await pixel(out, 2, 337)), 'left edge');
  assert.ok(isGreen(await pixel(out, 1197, 337)), 'right edge');
  assert.ok(isGreen(await pixel(out, 600, 90)), 'top edge');
  assert.ok(isGreen(await pixel(out, 600, 584)), 'bottom edge');
});

test('composer: a tall image keeps all four edges too', async () => {
  const out = await composeDispatchImage(await framed(800, 800));
  // Fitted to 675x675, centred: columns 262..937.
  assert.ok(isGreen(await pixel(out, 265, 337)), 'left edge');
  assert.ok(isGreen(await pixel(out, 934, 337)), 'right edge');
  assert.ok(isGreen(await pixel(out, 600, 2)), 'top edge');
  assert.ok(isGreen(await pixel(out, 600, 672)), 'bottom edge');
});

test("composer: a YouTube 4:3 rendition loses its baked-in bars and nothing else", async () => {
  // hqdefault shape: 480x360, a 480x270 frame with 45px black bars.
  const frame = await framed(480, 270, 4);
  const hq = await sharp({ create: { width: 480, height: 360, channels: 3, background: '#000000' } })
    .composite([{ input: frame, left: 0, top: 45 }])
    .png()
    .toBuffer();
  const out = await composeDispatchImage(hq, { sourceUrl: 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg' });
  // The frame now fills the whole 16:9 output: its edge is at the image edge.
  assert.ok(isGreen(await pixel(out, 600, 3)), 'top edge at the top');
  assert.ok(isGreen(await pixel(out, 600, 671)), 'bottom edge at the bottom');
  assert.ok(isGreen(await pixel(out, 3, 337)), 'left edge');
  // The same picture from anywhere else is treated as real 4:3 art: fitted, not trimmed.
  const other = await composeDispatchImage(hq, { sourceUrl: 'https://example.com/hq.jpg' });
  assert.ok(!isGreen(await pixel(other, 600, 3)));
});
