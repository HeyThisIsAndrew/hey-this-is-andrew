/*
  ─── BUILD THE NEWSLETTER'S IMAGES, ONCE, AHEAD OF TIME ─────────────────────

  For every story /dispatch.xml lists (THE HQ DISPATCH, issue #266), fetch its
  art, compose a 1200x675 JPEG with the whole picture inside
  (scripts/dispatch-image.mjs), write it to public/dispatch/images/, and
  record it in src/data/dispatch-images.json. The feed only ever points at
  an image recorded there, so an email never receives a raw, wrongly shaped
  original that its 16:9 box would have to crop.

  Same shape as scripts/sync-article-images.mjs, and ahead of time for the
  same reason: a committed file cannot be cold, expire or 403. It differs in
  ONE way that matters:

  NOTHING IS EVER PRUNED. A sent email keeps pointing at its images for as
  long as it sits in someone's inbox. The article-image sync deletes files
  its manifest no longer references, because a page is rebuilt; an email is
  not, so deleting a file here would blank the art in every past issue that
  used it. A story that leaves the feed keeps its image. At about 150 KB a
  story that is a few MB a year, which is the price of old issues working.

  NEVER-BREAK CONTRACT, as the other syncs:
    * dry-run by default; --execute to write anything;
    * an image that cannot be fetched is SKIPPED, not failed: the feed lists
      that story without art until a later run builds it;
    * the manifest is merged, never truncated;
    * a run that changes nothing writes nothing.

  Usage:
    npm run sync:dispatch-images                            # preview
    npm run sync:dispatch-images -- --execute               # write
    npm run sync:dispatch-images -- --execute --refresh     # rebuild all listed
*/
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { composeDispatchImage, WIDTH, HEIGHT } from './dispatch-image.mjs';
import {
  selectDispatchEntries,
  isDispatchVideoDoc,
  DISPATCH_IMAGE_PUBLIC_PATH,
} from '../src/lib/dispatch-feed.ts';
import { mapSanityVideo } from '../src/lib/videos.ts';
import { categorize } from '../src/data/categorize.js';
import { site } from '../src/data/site.js';

const ARTICLES_PATH = new URL('../src/data/articles.json', import.meta.url);
const VIDEOS_PATH = new URL('../src/data/videos.json', import.meta.url);
const MANIFEST_PATH = new URL('../src/data/dispatch-images.json', import.meta.url);
const MEDIA_DIR = new URL(`../public${DISPATCH_IMAGE_PUBLIC_PATH}/`, import.meta.url);

/* src/lib/articles.ts RESERVED_SLUGS. Restated because that module imports
   the JSON store, which plain node refuses without a type attribute. */
const RESERVED_SLUGS = new Set(['topic', 'page']);

const isExecute = process.argv.includes('--execute');
const forceRefresh = process.argv.includes('--refresh');

/** Stable, short, filesystem-safe id for a source URL. */
function keyFor(url) {
  return crypto.createHash('sha256').update(url).digest('hex').slice(0, 16);
}

async function fetchImage(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length === 0) throw new Error('empty body');
  return buffer;
}

/** The feed's own selection, from the same store the build reads. */
export function currentEntries(articles, videoDocs) {
  const published = articles.filter((a) => a?.hasBody && a?.slug && !RESERVED_SLUGS.has(a.slug));
  const videos = videoDocs
    .filter(isDispatchVideoDoc)
    .map((doc) => mapSanityVideo(doc, { categorize }))
    .filter(Boolean);
  return selectDispatchEntries(published, videos, site.url);
}

async function run() {
  const articles = JSON.parse(await fs.readFile(ARTICLES_PATH, 'utf8'));
  const videoDocs = JSON.parse(await fs.readFile(VIDEOS_PATH, 'utf8'));
  const entries = currentEntries(
    Array.isArray(articles) ? articles : [],
    Array.isArray(videoDocs) ? videoDocs : [],
  );
  const sources = [...new Set(entries.map((e) => e.imageSource).filter((u) => /^https?:\/\//i.test(u ?? '')))];

  let manifest = {};
  try {
    manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8')) || {};
  } catch {
    /* first run */
  }
  const before = JSON.stringify(manifest);

  console.log(`[dispatch-images] ${entries.length} stories in the feed, ${sources.length} with art.`);

  const todo = sources.filter((u) => forceRefresh || !manifest[u]);
  if (!isExecute) {
    console.log(`[dispatch-images] [dry-run] ${todo.length} would be built:`);
    for (const url of todo) console.log(`   ${url.slice(0, 110)}`);
    console.log('[dispatch-images] [dry-run] Pass --execute to write.');
    return;
  }

  await fs.mkdir(MEDIA_DIR, { recursive: true });
  let built = 0;
  let skipped = 0;
  for (const url of todo) {
    try {
      const out = await composeDispatchImage(await fetchImage(url), { sourceUrl: url });
      const filename = `${keyFor(url)}.jpg`;
      await fs.writeFile(new URL(filename, MEDIA_DIR), out);
      manifest[url] = { src: `${DISPATCH_IMAGE_PUBLIC_PATH}/${filename}`, width: WIDTH, height: HEIGHT };
      built++;
      console.log(`[dispatch-images]   ✓ ${(out.length / 1024).toFixed(0)} KB  ${url.slice(0, 80)}`);
    } catch (err) {
      skipped++;
      console.warn(`[dispatch-images]   ! skipped (${err.message}) ${url.slice(0, 80)}`);
    }
  }

  const sorted = Object.fromEntries(Object.keys(manifest).sort().map((k) => [k, manifest[k]]));
  if (before === JSON.stringify(sorted)) {
    console.log('[dispatch-images] No change. Manifest left untouched.');
  } else {
    await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
    console.log('[dispatch-images] ✓ Wrote src/data/dispatch-images.json');
    console.log(`[dispatch-images]   Commit public${DISPATCH_IMAGE_PUBLIC_PATH}/ along with it.`);
  }
  console.log(`[dispatch-images] ${built} built, ${sources.length - todo.length} already present, ${skipped} skipped.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((err) => {
    console.error(`[dispatch-images] Failed: ${err.message}`);
    process.exit(1);
  });
}
