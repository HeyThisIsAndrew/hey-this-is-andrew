/*
  ─── BUILD ARTICLE IMAGE RENDITIONS, ONCE, AHEAD OF TIME ────────────────────

  Downloads the oversized images referenced by src/data/articles.json, resizes
  them into public/article-images/, and writes src/data/article-images.json
  mapping each source URL to its local `src` and `srcset`.

  WHY THIS EXISTS
  Substack article records carry the raw upload. Measured across the three
  articles in the store: 10 images totalling 22.54 MB, several 3840x2160,
  rendering into a ~720px column. Resized to WebP that is 0.55 MB — a 97.5%
  reduction, and all of it below-the-fold weight on a phone.

  WHY NOT A LIVE PROXY
  Because that was tried and reverted. Routing them through wsrv.nl made the
  page dramatically worse on a real phone: a cold cache meant fetching a 4K
  JPEG from S3, decoding, resizing and re-encoding per URL AND per width,
  while the reader watched an empty frame. The gallery lightbox reassigns
  `img.src` on every slide, so each swipe paid that cost again. A committed
  local file cannot be cold, cannot expire and cannot 403.

  WHAT IS SKIPPED, ON PURPOSE
  URLs already on substackcdn.com carry their own transforms
  (`w_1456,c_limit,f_auto,q_auto:good`). They are already renditions on a warm
  CDN and are not where the weight is: of 23 unique URLs, the 13 substackcdn
  ones are fine and the 10 raw S3 ones are the entire 22.54 MB. Downloading
  them would add repository weight to fix nothing. This list must stay in sync
  with ALREADY_OPTIMISED in src/lib/article-images.ts.

  NEVER-BREAK CONTRACT, same as the other syncs in this repo:
    * dry-run by default; --execute to write anything;
    * an image that cannot be fetched is SKIPPED, not failed — it keeps its
      original URL at render time and the run continues;
    * the manifest is merged, never truncated, so a run with no network
      cannot empty it;
    * a run that changes nothing writes nothing, so it cannot trigger a
      pointless rebuild.

  Usage:
    npm run sync:article-images                 # preview
    npm run sync:article-images -- --execute    # write
    npm run sync:article-images -- --execute --refresh   # refetch everything
*/
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import sharp from 'sharp';

const ARTICLES_PATH = new URL('../src/data/articles.json', import.meta.url);
const MANIFEST_PATH = new URL('../src/data/article-images.json', import.meta.url);
const MEDIA_DIR = new URL('../public/article-images/', import.meta.url);
const MEDIA_PUBLIC_PATH = '/article-images';

/*
  The reading column is ~720px, and the hero spans it. 1440 covers a 2x
  display at that width; beyond it the file grows for pixels no layout on the
  site can show. 480 is the phone case.
*/
const WIDTHS = [480, 720, 1080, 1440];
/** Width used for the plain `src` — the sensible single-rendition fallback. */
const SRC_WIDTH = 720;
const WEBP_QUALITY = 80;

/** Already a sized rendition on a warm CDN — see the header. */
const ALREADY_OPTIMISED = /substackcdn\.com\//i;

const isExecute = process.argv.includes('--execute');
const forceRefresh = process.argv.includes('--refresh');

/** Stable, short, filesystem-safe id for a source URL. */
function keyFor(url) {
  return crypto.createHash('sha256').update(url).digest('hex').slice(0, 16);
}

/** Every image URL an article page will actually request. */
function collectSourceUrls(articles) {
  const urls = new Set();
  for (const article of articles) {
    if (article?.image) urls.add(String(article.image));
    for (const tag of String(article?.bodyHtml ?? '').match(/<img\b[^>]*>/gi) || []) {
      const src = tag.match(/\ssrc=["']([^"']+)["']/i)?.[1];
      if (src) urls.add(src);
    }
  }
  return [...urls].filter((url) => /^https?:\/\//i.test(url) && !ALREADY_OPTIMISED.test(url));
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

/**
 * Write every rendition for one image.
 *
 * `withoutEnlargement` so an original narrower than a target width is passed
 * through at its own size rather than upscaled into a BIGGER file. A width
 * that would have been an upscale is dropped from the srcset entirely, so the
 * browser is never offered two identical candidates at different descriptors.
 */
async function buildRenditions(buffer, key) {
  const meta = await sharp(buffer).metadata();
  const intrinsic = meta.width || Math.max(...WIDTHS);
  const widths = WIDTHS.filter((w) => w <= intrinsic);
  if (widths.length === 0) widths.push(intrinsic);

  const written = [];
  for (const width of widths) {
    const out = await sharp(buffer)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
    const filename = `${key}-${width}.webp`;
    await fs.writeFile(new URL(filename, MEDIA_DIR), out);
    written.push({ width, filename, bytes: out.length });
  }

  const pick = written.find((w) => w.width === SRC_WIDTH) || written[written.length - 1];
  return {
    src: `${MEDIA_PUBLIC_PATH}/${pick.filename}`,
    srcset: written.map((w) => `${MEDIA_PUBLIC_PATH}/${w.filename} ${w.width}w`).join(', '),
    bytes: written.reduce((sum, w) => sum + w.bytes, 0),
  };
}

/** Files the manifest actually references — everything else is an orphan. */
async function pruneOrphans(manifest) {
  const keep = new Set();
  for (const entry of Object.values(manifest)) {
    for (const candidate of String(entry?.srcset ?? '').split(',')) {
      const file = candidate.trim().split(' ')[0]?.split('/').pop();
      if (file) keep.add(file);
    }
    const src = String(entry?.src ?? '').split('/').pop();
    if (src) keep.add(src);
  }
  let removed = 0;
  for (const file of await fs.readdir(MEDIA_DIR).catch(() => [])) {
    if (file.startsWith('.') || keep.has(file)) continue;
    await fs.unlink(new URL(file, MEDIA_DIR)).catch(() => {});
    removed++;
  }
  if (removed > 0) console.log(`[article-images] Pruned ${removed} orphaned file(s).`);
}

async function run() {
  const articles = JSON.parse(await fs.readFile(ARTICLES_PATH, 'utf8'));
  const list = Array.isArray(articles) ? articles : [];
  const urls = collectSourceUrls(list);

  let manifest = {};
  try {
    manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8')) || {};
  } catch {
    /* first run */
  }
  const before = JSON.stringify(manifest);

  console.log(
    `[article-images] ${list.length} article(s), ${urls.length} image(s) that are not ` +
      `already CDN renditions.`
  );

  if (!isExecute) {
    const missing = urls.filter((u) => !manifest[u]);
    console.log(`[article-images] [dry-run] ${missing.length} would be downloaded:`);
    for (const url of missing.slice(0, 20)) console.log(`   ${url.slice(0, 110)}`);
    console.log('[article-images] [dry-run] Pass --execute to write.');
    return;
  }

  await fs.mkdir(MEDIA_DIR, { recursive: true });

  let built = 0;
  let skipped = 0;
  let reused = 0;
  let totalBytes = 0;

  for (const url of urls) {
    if (manifest[url] && !forceRefresh) {
      reused++;
      continue;
    }
    try {
      const buffer = await fetchImage(url);
      const rendition = await buildRenditions(buffer, keyFor(url));
      manifest[url] = { src: rendition.src, srcset: rendition.srcset };
      totalBytes += rendition.bytes;
      built++;
      console.log(
        `[article-images]   ✓ ${(buffer.length / 1024 / 1024).toFixed(2)} MB → ` +
          `${(rendition.bytes / 1024).toFixed(0)} KB  ${url.slice(0, 70)}`
      );
    } catch (err) {
      /* Skipped, never fatal: the page falls back to the original URL, which
         is exactly what it renders today. One unreachable host must not fail
         a sync or empty a manifest. */
      skipped++;
      console.warn(`[article-images]   ! skipped (${err.message}) ${url.slice(0, 70)}`);
    }
  }

  await pruneOrphans(manifest);

  /*
    Sorted by REBUILDING the object, not by passing the key list as
    JSON.stringify's second argument. That argument is a property allowlist and
    it applies at EVERY level, so `JSON.stringify(manifest, keys, 2)` silently
    stripped the nested `src` and `srcset` and wrote `{}` for every entry. The
    manifest looked plausible, the file count was right, and every lookup
    returned null — so the page fell back to the originals and the whole
    feature was inert. Caught by checking the built HTML, not by review.
  */
  const sorted = Object.fromEntries(
    Object.keys(manifest)
      .sort()
      .map((key) => [key, manifest[key]])
  );
  const after = JSON.stringify(sorted, null, 2);

  if (before === JSON.stringify(sorted)) {
    console.log('[article-images] No change. Manifest left untouched.');
  } else {
    await fs.writeFile(MANIFEST_PATH, `${after}\n`);
    console.log('[article-images] ✓ Wrote src/data/article-images.json');
    console.log('[article-images]   Commit public/article-images/ along with it.');
  }

  console.log(
    `[article-images] ${built} built, ${reused} already present, ${skipped} skipped ` +
      `(those keep their original URL). ${(totalBytes / 1024 / 1024).toFixed(2)} MB written.`
  );
}

run().catch((err) => {
  console.error(`[article-images] Failed: ${err.message}`);
  process.exit(1);
});
