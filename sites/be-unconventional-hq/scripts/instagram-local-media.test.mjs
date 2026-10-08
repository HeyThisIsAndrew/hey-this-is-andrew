/*
  INSTAGRAM MEDIA MUST NOT BE STORED AS A URL THAT EXPIRES.

  THE INCIDENT
  Reported from production with a screenshot: every tile in the Instagram rail
  was a broken image. Nothing in the site was broken — Instagram's CDN URLs are
  SIGNED and time-limited (the `oe=` query parameter is a hex expiry stamp),
  src/data/instagram.json stored those URLs verbatim at sync time, and they had
  simply reached their expiry. Measured on the day: 188 of 188 stored URLs
  already dead, the last of them a couple of hours before the report. It would
  have happened on that schedule whatever else was going on.

  THE FIX THIS PINS
  scripts/sync-instagram.mjs downloads each image to public/instagram/ and
  records it as `localImage`; the gallery prefers it. Local files do not
  expire and skip the /api/proxy round trip.

  WHY THIS IS A UNIT TEST AND NOT AN E2E ONE
  The sync needs META_ACCESS_TOKEN and live Graph API access, so it cannot run
  in CI or in the build sandbox. What IS checkable without either is the
  contract every part of this depends on: the preference order, and the
  guarantee that the change is inert until a sync has actually run. Those are
  the two things that would silently rot.
*/
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCardImageSources } from '../src/lib/card-images.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${error.message}`);
    failed++;
  }
}

const gallery = fs.readFileSync(
  path.join(ROOT, 'src/components/CinematicGallery.astro'),
  'utf8'
);
const sync = fs.readFileSync(path.join(ROOT, 'scripts/sync-instagram.mjs'), 'utf8');
const flatten = fs.readFileSync(path.join(ROOT, 'src/lib/instagram.ts'), 'utf8');

console.log('Instagram local media:');

test('the gallery prefers localImage over the expiring displayUrl', () => {
  assert.ok(
    /getCardImageSources\(\s*item\.localImage\s*\|\|\s*item\.displayUrl\s*\)/.test(gallery),
    'CinematicGallery must call getCardImageSources(item.localImage || item.displayUrl).\n' +
      '      Reading displayUrl directly puts the rail back on signed CDN URLs\n' +
      '      that expire within days — the production incident this replaced.',
  );
});

test('displayUrl is kept as the fallback, not removed', () => {
  assert.ok(
    /item\.displayUrl/.test(gallery),
    'displayUrl must remain as the fallback. Until a sync has run with\n' +
      '      --execute nothing has a localImage, and an item whose download\n' +
      '      failed should still render from the remote URL while it lives.',
  );
});

test('a local path is served directly, with no /api/proxy round trip', () => {
  const sources = getCardImageSources('/instagram/17900000000000000.jpg');
  assert.equal(sources.src, '/instagram/17900000000000000.jpg');
  assert.ok(
    !sources.src.includes('/api/proxy'),
    `a local path must not be proxied — got "${sources.src}"`,
  );
});

test('a raw cdninstagram URL still routes through our proxy', () => {
  const sources = getCardImageSources('https://scontent-lax3-1.cdninstagram.com/v/t51/x.jpg');
  assert.ok(
    sources.src.startsWith('/api/proxy?url='),
    `the remote fallback must still be proxied (Instagram 403s wsrv.nl) — got "${sources.src}"`,
  );
});

test('the sync downloads media before writing the JSON', () => {
  const localiseAt = sync.indexOf('await localiseMedia(');
  const writeAt = sync.indexOf('await fs.writeFile(outPath');
  assert.ok(localiseAt !== -1, 'sync-instagram.mjs no longer downloads media at all');
  assert.ok(
    localiseAt < writeAt,
    'localiseMedia() must run BEFORE the JSON is written, or the file can\n' +
      '      claim a localImage that is not on disk.',
  );
});

test('a failed download keeps the item rather than dropping it', () => {
  assert.ok(
    /return null/.test(sync) && /keeping remote URL/.test(sync),
    'downloadMedia() must return null and leave displayUrl in place when a\n' +
      '      fetch fails, so one bad image cannot empty the feed.',
  );
});

test('the sync is still dry-run by default', () => {
  assert.ok(
    /--execute/.test(sync) && /\[dry-run\]/.test(sync),
    'the sync must stay dry-run by default — it now writes image files as well\n' +
      '      as JSON, which makes an accidental run more expensive, not less.',
  );
});

test('the Instagram rail fallback outranks the component’s own background', () => {
  const css = fs.readFileSync(path.join(ROOT, 'src/styles/modules/home-cards.css'), 'utf8');
  /*
    The selector must carry a descendant, not just the class + attribute.
    CinematicGallery's scoped style sets `.ig-tile-frame { background: … }`,
    which Astro compiles to `.ig-tile-frame[data-astro-cid-…]` — the SAME
    (0,2,0) specificity a bare `.ig-tile-frame[data-img-failed]` would have,
    and injected later, so it won on source order and reset background-image
    to none. The first version of this fix painted nothing while looking
    correct in the diff; it was caught by reading computed style in a browser,
    not by review.
  */
  /* Comments stripped first — the explanation above the rule quotes the bare
     selector, and matching prose instead of code is how a guard starts lying. */
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const bare = code
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('.ig-tile-frame[data-img-failed]'));
  assert.equal(
    bare.length,
    0,
    `${bare.length} bare .ig-tile-frame[data-img-failed] selector(s) found. At\n` +
      '      (0,2,0) they tie with the component\'s own scoped rule and lose on\n' +
      '      source order, so the fallback silently paints nothing. Qualify them,\n' +
      '      e.g. `.ig-carousel-tile .ig-tile-frame[data-img-failed]`.',
  );
  const rules = code.match(/\.ig-carousel-tile \.ig-tile-frame\[data-img-failed\]/g) || [];
  assert.ok(
    rules.length >= 2,
    `.ig-tile-frame[data-img-failed] appears ${rules.length} time(s); it must be in\n` +
      '      BOTH fallback rules (the gradient panel and the brand-mark layer).\n' +
      '      Layout.astro already marks the container when an image fails — with\n' +
      '      no rule to match, the reader gets a raw broken-image glyph, which is\n' +
      '      exactly what was photographed in production.',
  );
});

test('an album contributes ONE tile, not one per slide', () => {
  assert.ok(
    !/for \(const child of post\.children\)/.test(flatten),
    'getGalleryPosts must not unpack CAROUSEL_ALBUM children into tiles.\n' +
      '      The rail holds ten tiles; one ten-image post would fill all of them\n' +
      '      and push every other post off the row. The feed already contains an\n' +
      '      18-slide album, so this is not hypothetical.',
  );
  assert.ok(
    /gallery\.push\(post\)/.test(flatten),
    'each qualifying post must be pushed once, as itself, so the tile shows the\n' +
      '      post cover (verified equal to the first slide on every album in the feed).',
  );
});

test('posts are deduped by id, not by image URL', () => {
  assert.ok(
    /const key = post\.id \|\| post\.displayUrl/.test(flatten),
    'dedupe must key on the post id. Keying on the image made an album\'s\n' +
      '      identity ambiguous, and a signed CDN URL is not stable across a\n' +
      '      re-sync anyway.',
  );
});

test('the sync downloads covers only, not every slide', () => {
  assert.ok(
    !/child\.localThumbnail/.test(sync),
    'carousel slides must not be downloaded — nothing renders them, and it\n' +
      '      would commit 106 files instead of 50 for this feed.',
  );
});

test('sharp is a DECLARED dependency, not a transitive accident', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const declared =
    (pkg.dependencies || {}).sharp ||
    (pkg.devDependencies || {}).sharp ||
    (pkg.optionalDependencies || {}).sharp;
  assert.ok(
    declared,
    'The sync imports sharp directly. It was previously only present because\n' +
      '      astro depends on it — an Astro upgrade that dropped or moved it would\n' +
      '      break the sync with a module-not-found, at a moment nobody was looking.',
  );
});

test('stored images are resized WebP, not originals', () => {
  assert.ok(
    /const STORED_EXTENSION = '\.webp'/.test(sync),
    'images must be stored as .webp',
  );
  const m = sync.match(/const TARGET_WIDTH = (\d+)/);
  assert.ok(m, 'TARGET_WIDTH not found');
  const width = Number(m[1]);
  assert.ok(
    width >= 400 && width <= 700,
    `TARGET_WIDTH is ${width}. The tile renders at 220 CSS px, so ~440 covers a\n` +
      '      2x display. Much smaller looks soft on retina; much larger goes back to\n' +
      '      shipping pixels the page cannot use.',
  );
  assert.ok(
    /withoutEnlargement: true/.test(sync),
    'withoutEnlargement, or a small original is upscaled into a BIGGER file',
  );
});

test('a legacy full-size file is reprocessed, not skipped forever', () => {
  assert.ok(
    /existing && existing\.endsWith\(STORED_EXTENSION\)/.test(sync),
    'the "already downloaded" shortcut must only skip files in the CURRENT\n' +
      '      stored format. Skipping on id alone would leave every pre-resize\n' +
      '      original in place permanently.',
  );
});

test('every committed Instagram image is webp and reasonably sized', () => {
  const dir = path.join(ROOT, 'public/instagram');
  if (!fs.existsSync(dir)) return; // nothing synced in this checkout
  const files = fs.readdirSync(dir).filter((f) => !f.startsWith('.'));
  const notWebp = files.filter((f) => !f.endsWith('.webp'));
  assert.deepEqual(
    notWebp,
    [],
    `${notWebp.length} committed image(s) are not .webp: ${notWebp.slice(0, 5).join(', ')}`,
  );
  const oversized = files.filter(
    (f) => fs.statSync(path.join(dir, f)).size > 120 * 1024
  );
  assert.deepEqual(
    oversized,
    [],
    `${oversized.length} committed image(s) exceed 120 KB. The whole set was 8.5 MB\n` +
      '      of unresized originals before this; a file that large means the resize\n' +
      '      silently fell back to storing the original.',
  );
});

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
