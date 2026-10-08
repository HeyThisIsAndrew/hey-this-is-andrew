/*
  Instagram topic qualification (src/lib/instagram-topic.ts).

  The rule under test: a hub page's carousel may only show posts that belong
  to that hub, and may only appear at all when enough of them exist to fill
  the row.

  The bug this locks out was a raw substring test — `caption.includes(title)`.
  On the real caption corpus the DC page ("DC") qualified 11 posts, 9 of which
  matched inside another word: S[DC]C, hollywoo[dc]onfidential, re[dc]arpet,
  westfiel[dc]enturycity. Those 9 unpacked into enough carousel tiles to clear
  the minimum, so the page shipped a "DC" rail of Comic-Con and Scary Movie
  photos. Marvel passed the same broken filter purely because no caption
  contains "marvel" inside another word — which is why the fixtures below
  assert the RULE on both, not just the page that visibly broke.

  Offline and pure: plain `node scripts/instagram-topic.test.mjs`.
*/
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  captionMatchesKeyword,
  extractTagTokens,
  getHubTopicKeywords,
  GLOBAL_CAROUSEL_MIN_TILES,
  HUB_CAROUSEL_MIN_TILES,
  normalizeText,
  postQualifiesForTopic,
  toCompactToken,
} from '../src/lib/instagram-topic.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

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

/* Verbatim fragments of real captions from src/data/instagram.json — these
   are the exact strings that produced the false matches. */
const CAPTIONS = {
  sdcc: 'Honest take: SDCC doesn’t treat its fans well. #SDCC2026 #SanDiegoComicCon #HallH',
  scaryMovie: 'On the big screen. @hollywoodconfidential @scarymovie #ScaryMovie #amc',
  redCarpet: '#netflixseries #animation #redcarpet #premiere',
  westfield: 'Went with @primevideo @westfieldcenturycity #Fallout #PrimeVideo',
  clayface:
    'Genuinely excited for what DC Studios is building under James Gunn. Emotional variety across the DC Universe. @dcofficial @clayfacemovie',
  clayfaceTeaser:
    'The Clayface teaser just dropped. As part of the new DC Universe under James Gunn. #ClayfaceMovie #DCUniverse #JamesGunn',
  thunderbolts:
    'Marvel delivered a film highlighting mental health. @marvelstudios @marvel #thunderbolts #marvel #mcu',
};

const DC_KEYWORDS = getHubTopicKeywords({
  title: 'DC',
  youtubeSyncKeywords: ['dc', 'dc comics', 'dcu', 'dc universe'],
});
const MARVEL_KEYWORDS = getHubTopicKeywords({
  title: 'Marvel',
  youtubeSyncKeywords: ['marvel', 'mcu', 'marvel studios'],
});
const SDCC_KEYWORDS = getHubTopicKeywords({
  title: 'San Diego Comic Con',
  youtubeSyncKeywords: ['sdcc 2026', 'san diego comic-con 2026', 'sdcc2026'],
});

console.log('\nNormalization primitives:');

test('normalizeText lowercases, strips punctuation, collapses whitespace', () => {
  assert.equal(normalizeText('  San Diego  Comic-Con!! '), 'san diego comic con');
});

test('toCompactToken folds a phrase into its hashtag form', () => {
  assert.equal(toCompactToken('sdcc 2026'), 'sdcc2026');
  assert.equal(toCompactToken('san diego comic-con 2026'), 'sandiegocomiccon2026');
});

test('extractTagTokens reads both #hashtags and @mentions', () => {
  assert.deepEqual(extractTagTokens('#SDCC2026 hi @dcofficial'), ['sdcc2026', 'dcofficial']);
});

console.log('\nThe false positives that shipped a wrong DC carousel:');

for (const [label, caption] of [
  ['SDCC (the "dc" inside "sdcc")', CAPTIONS.sdcc],
  ['hollywoodconfidential (spans a word boundary)', CAPTIONS.scaryMovie],
  ['redcarpet', CAPTIONS.redCarpet],
  ['westfieldcenturycity', CAPTIONS.westfield],
]) {
  test(`"dc" does NOT match ${label}`, () => {
    assert.equal(caption.toLowerCase().includes('dc'), true, 'fixture must contain the substring');
    assert.equal(postQualifiesForTopic({ caption }, DC_KEYWORDS), false);
  });
}

console.log('\nThe true positives it must keep:');

test('"DC Studios"/"DC Universe" prose qualifies for DC', () => {
  assert.equal(postQualifiesForTopic({ caption: CAPTIONS.clayface }, DC_KEYWORDS), true);
});

test('#DCUniverse hashtag qualifies for DC', () => {
  assert.equal(captionMatchesKeyword('nothing but #DCUniverse here', 'dc universe'), true);
});

test('Marvel posts still qualify for Marvel', () => {
  assert.equal(postQualifiesForTopic({ caption: CAPTIONS.thunderbolts }, MARVEL_KEYWORDS), true);
});

test('Marvel posts do NOT qualify for DC, and vice versa', () => {
  assert.equal(postQualifiesForTopic({ caption: CAPTIONS.thunderbolts }, DC_KEYWORDS), false);
  assert.equal(postQualifiesForTopic({ caption: CAPTIONS.clayface }, MARVEL_KEYWORDS), false);
});

test('#SDCC2026 qualifies the event whose TITLE never appears in any caption', () => {
  /* The old title-substring filter scored this 0 and hid the carousel
     forever; the hashtag form is how the captions actually write it. */
  assert.equal(CAPTIONS.sdcc.toLowerCase().includes('san diego comic con'), false);
  assert.equal(postQualifiesForTopic({ caption: CAPTIONS.sdcc }, SDCC_KEYWORDS), true);
});

console.log('\nKeyword assembly is data-driven:');

test('keywords come from the hub doc — title plus youtubeSyncKeywords', () => {
  assert.deepEqual(getHubTopicKeywords({ title: 'DC', youtubeSyncKeywords: ['dcu'] }), ['DC', 'dcu']);
});

test('a hub with no keywords yields nothing to match on', () => {
  assert.deepEqual(getHubTopicKeywords({}), []);
  assert.equal(postQualifiesForTopic({ caption: CAPTIONS.clayface }, []), false);
});

test('non-string keywords are discarded, not coerced', () => {
  assert.deepEqual(getHubTopicKeywords({ title: 'DC', youtubeSyncKeywords: [null, 7, '  ', 'dcu'] }), [
    'DC',
    'dcu',
  ]);
});

test('a post with no caption never qualifies', () => {
  assert.equal(postQualifiesForTopic({ caption: '' }, DC_KEYWORDS), false);
  assert.equal(postQualifiesForTopic(null, DC_KEYWORDS), false);
});

console.log('\nThe render threshold, counted on QUALIFYING tiles:');

/* Mirrors InstagramFeed.astro: qualify -> flatten -> valid -> limit -> compare.
   Kept in step with the component by construction, not by duplication of the
   matching rule itself. */
function tilesFor(posts, keywords, { limit = 10 } = {}) {
  const tiles = [];
  const seen = new Set();
  for (const post of posts) {
    if (!post?.displayUrl || !post.mediaType) continue;
    if (!postQualifiesForTopic(post, keywords)) continue;
    if (post.mediaType === 'CAROUSEL_ALBUM') {
      for (const child of post.children ?? []) {
        if (!child?.thumbnailUrl || seen.has(child.thumbnailUrl)) continue;
        seen.add(child.thumbnailUrl);
        tiles.push({ displayUrl: child.thumbnailUrl });
      }
    } else {
      if (seen.has(post.displayUrl)) continue;
      seen.add(post.displayUrl);
      tiles.push({ displayUrl: post.displayUrl });
    }
  }
  return tiles.slice(0, limit);
}

const renders = (posts, keywords, minItems = HUB_CAROUSEL_MIN_TILES) => tilesFor(posts, keywords).length >= minItems;

/** n single-image posts whose captions qualify for `caption`. */
const makePosts = (n, caption) =>
  Array.from({ length: n }, (_, i) => ({
    displayUrl: `https://cdn.example/${caption.slice(0, 4)}-${i}.jpg`,
    mediaType: 'IMAGE',
    caption,
  }));

test('exactly the minimum (7) qualifying tiles renders', () => {
  assert.equal(renders(makePosts(7, CAPTIONS.clayface), DC_KEYWORDS), true);
});

test('one below the minimum (6) does NOT render', () => {
  assert.equal(renders(makePosts(6, CAPTIONS.clayface), DC_KEYWORDS), false);
});

test('unrelated posts cannot top up a short row', () => {
  const posts = [...makePosts(6, CAPTIONS.clayface), ...makePosts(20, CAPTIONS.sdcc)];
  assert.equal(tilesFor(posts, DC_KEYWORDS).length, 6, 'only the DC posts may count');
  assert.equal(renders(posts, DC_KEYWORDS), false);
});

test('a carousel album contributes one tile per child', () => {
  const album = {
    displayUrl: 'https://cdn.example/album.jpg',
    mediaType: 'CAROUSEL_ALBUM',
    caption: CAPTIONS.clayface,
    children: Array.from({ length: 7 }, (_, i) => ({
      thumbnailUrl: `https://cdn.example/child-${i}.jpg`,
      mediaType: 'IMAGE',
    })),
  };
  assert.equal(tilesFor([album], DC_KEYWORDS).length, 7);
  assert.equal(renders([album], DC_KEYWORDS), true);
});

test('duplicate media is counted once, so it cannot pad the row', () => {
  const dupe = {
    displayUrl: 'https://cdn.example/album.jpg',
    mediaType: 'CAROUSEL_ALBUM',
    caption: CAPTIONS.clayface,
    children: Array.from({ length: 8 }, () => ({
      thumbnailUrl: 'https://cdn.example/same.jpg',
      mediaType: 'IMAGE',
    })),
  };
  assert.equal(tilesFor([dupe], DC_KEYWORDS).length, 1);
  assert.equal(renders([dupe], DC_KEYWORDS), false);
});

console.log('\nThe threshold is derived from the CSS, not chosen:');

/*
  HUB_CAROUSEL_MIN_TILES is "enough tiles to fill the widest row the layout
  can produce". Re-derive it here from the real CSS so that changing the tile
  width, the gap or the container cap fails loudly instead of silently
  leaving the threshold stale. See the derivation comment in
  src/lib/instagram-topic.ts.
*/
const gallery = fs.readFileSync(path.join(ROOT, 'src/components/CinematicGallery.astro'), 'utf8');
const layout = fs.readFileSync(path.join(ROOT, 'src/styles/modules/layout.css'), 'utf8');

test('tile width, gap and container cap are still what the derivation assumes', () => {
  assert.match(gallery, /\.ig-carousel-tile\s*\{[^}]*flex:\s*0\s+0\s+(?:220px|var\(--ig-card,\s*220px\))/s, 'tile basis is 220px');
  assert.match(gallery, /\.ig-carousel-track\s*\{[^}]*gap:\s*1\.25rem/s, 'track gap is 1.25rem');

  /*
    ─── THE CAP IS A LADDER NOW, AND THE BASE STEP IS WHAT THIS DERIVES FROM ──

    `.container` read a flat 1536px when this threshold was derived. It reads
    `--page-max` now, which is 1536px at its base step and rises to 2600px on a
    4K display, so "the widest row the layout can produce" is no longer one
    number.

    The base step stays the right one to derive from. Raising the threshold to
    fill a 2600px row would need 11 tiles, and a hub with 8 would then ship no
    carousel AT ANY WIDTH — trading a full row on the rare screen for an empty
    section on every other one. What the threshold is actually protecting
    against is a nearly-empty rail, and 7 tiles in a 2600px row is 60% full and
    still scrolls.
  */
  assert.match(layout, /\.container\s*\{[^}]*max-width:\s*var\(--page-max\)/s, 'container reads the ladder');
  assert.match(layout, /:root\s*\{[^}]*--page-max:\s*1536px/s, 'the ladder still starts at 1536px');
});

test('HUB_CAROUSEL_MIN_TILES fills the widest possible row', () => {
  const TILE = 220;
  const GAP = 1.25 * 12.8; // 1.25rem at the ≥768px root size of 80% (=16px)
  const MAX_ROW = 1536; // --page-max's BASE step; see the note above
  const tilesPerRow = (MAX_ROW + GAP) / (TILE + GAP);

  assert.ok(tilesPerRow > 6 && tilesPerRow < 7, `widest row holds ${tilesPerRow.toFixed(2)} tiles`);
  assert.equal(
    HUB_CAROUSEL_MIN_TILES,
    Math.ceil(tilesPerRow),
    'threshold must be the ceiling of the widest row, so the rail is never partially empty'
  );
});

test('the global rail keeps a lower bar than a hub carousel', () => {
  /* The homepage rail makes no topical claim, so it does not owe a full row —
     but it must still not ship a nearly-empty carousel. */
  assert.ok(GLOBAL_CAROUSEL_MIN_TILES < HUB_CAROUSEL_MIN_TILES);
  assert.ok(GLOBAL_CAROUSEL_MIN_TILES >= 3);
});

console.log(
  failed === 0 ? `\n✅ ${passed} passed, 0 failed.` : `\n❌ ${passed} passed, ${failed} failed.`
);
process.exit(failed === 0 ? 0 : 1);
