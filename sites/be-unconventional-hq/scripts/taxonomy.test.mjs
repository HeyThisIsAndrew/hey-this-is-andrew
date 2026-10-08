/**
 * Offline unit tests for the Taxonomy-as-Code sync core (epic #34).
 * Updated for local JSON prototype.
 *
 * Run:  node scripts/taxonomy.test.mjs
 */
import assert from 'node:assert/strict';
import {
  normalizeTag,
  buildTaxonomyDictionary,
  matchVideoTags,
  planVideoSync,
  extractHubSeeds,
  TIER1_TOPIC_SEEDS,
  UNCATEGORIZED_TOPIC_ID,
} from './sync-youtube.mjs';

let passed = 0;
const test = (name, fn) => {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err.message}`);
    process.exitCode = 1;
  }
};

// Dictionary fixture: the seeds + one brand + one event with keywords.
const DICT = buildTaxonomyDictionary({
  topics: TIER1_TOPIC_SEEDS.map((s) => ({
    ...s,
    keywords: s.keywords,
  })),
  hubs: [
    { slug: 'marvel', keywords: ['marvel'] },
    { slug: 'sdcc-2026', keywords: ['san diego comic-con', 'sdcc'] },
  ],
});

const VIDEO = {
  id: 'dQw4w9WgXcQ',
  title: 'Spider-Man Brand New Day Trailer Breakdown',
  description: 'desc',
  thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
  durationSeconds: 600,
  isShort: false,
  viewCount: 100,
  publishedAt: '2026-07-12T15:00:00Z',
  tags: [],
};

console.log('taxonomy (sync-youtube.mjs)');

// ── normalizeTag ─────────────────────────────────────────────────────────────
test('normalizeTag: case + punctuation insensitive', () => {
  assert.equal(normalizeTag('San Diego Comic-Con'), 'san diego comic con');
  assert.equal(normalizeTag('SAN  DIEGO   comic_con'), 'san diego comic con');
  assert.equal(normalizeTag('  Apple TV+ '), 'apple tv');
  assert.equal(normalizeTag(''), '');
  assert.equal(normalizeTag(null), '');
});

// ── buildTaxonomyDictionary ──────────────────────────────────────────────────
test('dictionary: only Tier-1 topics contribute category keywords', () => {
  assert.equal(DICT.tier1.get('film'), 'film');
  assert.equal(DICT.tier1.get('movies'), 'film');
  assert.equal([...DICT.tier1.values()].includes(UNCATEGORIZED_TOPIC_ID), false);
});

test('dictionary: hub keywords normalize at build time', () => {
  assert.equal(DICT.hubs.get('san diego comic con'), 'sdcc-2026');
  assert.equal(DICT.hubs.get('marvel'), 'marvel');
});

test('dictionary: collisions keep first and are reported', () => {
  const d = buildTaxonomyDictionary({
    topics: [
      { slug: 'topic-a', isTier1Category: true, keywords: ['clash'] },
      { slug: 'topic-b', isTier1Category: true, keywords: ['Clash!'] },
    ],
    hubs: [],
  });
  assert.equal(d.tier1.get('clash'), 'topic-a');
  assert.equal(d.collisions.length, 1);
  assert.equal(d.collisions[0].ignored, 'topic-b');
});

// ── matchVideoTags ───────────────────────────────────────────────────────────
test('spec example 1: film + marvel → Film category + Marvel hub', () => {
  const m = matchVideoTags(['film', 'marvel', 'spiderman 4k reaction'], DICT);
  assert.deepEqual(m.topicIds, ['film']);
  assert.deepEqual(m.hubIds, ['marvel']);
  assert.equal(m.requiresReview, false);
});

test('spec example 2: film + marvel + SDCC → all three assignments', () => {
  const m = matchVideoTags(['Film', 'Marvel', 'San Diego Comic-Con'], DICT);
  assert.deepEqual(m.topicIds, ['film']);
  assert.deepEqual(m.hubIds.sort(), ['marvel', 'sdcc-2026']);
});

test('SEO pollution: 500 chars of junk tags are ignored, exact hits kept', () => {
  const m = matchVideoTags(
    ['spiderman 4k reaction', 'best trailer ever', 'GAMING', 'ps5 gameplay no commentary'],
    DICT,
  );
  assert.deepEqual(m.topicIds, ['gaming']);
  assert.deepEqual(m.hubIds, []);
});

test('fallback protocol: zero Tier-1 hits → uncategorized + requiresReview', () => {
  const m = matchVideoTags(['marvel', 'random seo'], DICT); // hub hit but no category
  assert.deepEqual(m.topicIds, ['uncategorized']);
  assert.deepEqual(m.hubIds, ['marvel']);
  assert.equal(m.requiresReview, true);
});

test('no tags at all → fallback protocol, never dropped', () => {
  const m = matchVideoTags(undefined, DICT);
  assert.deepEqual(m.topicIds, ['uncategorized']);
  assert.equal(m.requiresReview, true);
});

test('duplicate tags do not duplicate refs', () => {
  const m = matchVideoTags(['film', 'FILM', 'movie'], DICT);
  assert.deepEqual(m.topicIds, ['film']);
});

// ── planVideoSync ────────────────────────────────────────────────────────────
const cleanMatch = matchVideoTags(['film', 'marvel'], DICT);
const reviewMatch = matchVideoTags(['nothing useful'], DICT);

test('new video, clean match → created PUBLISHED with derived taxonomy (auto-publish)', () => {
  const p = planVideoSync(VIDEO, cleanMatch);
  assert.equal(p.contentStatus, 'published');
  assert.deepEqual(p.topics, ['film']);
  assert.deepEqual(p.hubs, ['marvel']);
});

test('new video, no match → created NEEDS-REVIEW as Uncategorized', () => {
  const p = planVideoSync(VIDEO, reviewMatch);
  assert.equal(p.contentStatus, 'needs-review');
  assert.deepEqual(p.topics, ['uncategorized']);
});

// ── extractHubSeeds ──────────────────────────────────────────────────────────
test('extractHubSeeds: pulls slug + youtubeSyncKeywords from featuredBrand/event docs', () => {
  const seeds = extractHubSeeds([
    { _type: 'featuredBrand', slug: { current: 'dc-comics' }, youtubeSyncKeywords: ['dc', 'dc comics'] },
    { _type: 'event', slug: { current: 'sdcc-2026' }, youtubeSyncKeywords: ['sdcc 2026'] },
    { _type: 'video', slug: { current: 'not-a-hub' }, youtubeSyncKeywords: ['ignored'] },
    { _type: 'featuredBrand', youtubeSyncKeywords: ['no slug, should be dropped'] },
  ]);
  assert.deepEqual(seeds, [
    { slug: 'dc-comics', keywords: ['dc', 'dc comics'] },
    { slug: 'sdcc-2026', keywords: ['sdcc 2026'] },
  ]);
});

test('extractHubSeeds: missing youtubeSyncKeywords defaults to empty array', () => {
  const seeds = extractHubSeeds([{ _type: 'event', slug: { current: 'no-keywords' } }]);
  assert.deepEqual(seeds, [{ slug: 'no-keywords', keywords: [] }]);
});

test('end-to-end: hub seeds from local docs feed matchVideoTags correctly', () => {
  const hubSeeds = extractHubSeeds([
    { _type: 'featuredBrand', slug: { current: 'dc-comics' }, youtubeSyncKeywords: ['dc', 'dc comics'] },
  ]);
  const dict = buildTaxonomyDictionary({ topics: TIER1_TOPIC_SEEDS, hubs: hubSeeds });
  const m = matchVideoTags(['film', 'DC Comics'], dict);
  assert.deepEqual(m.topicIds, ['film']);
  assert.deepEqual(m.hubIds, ['dc-comics']);
});

console.log(
  process.exitCode ? `FAILED (${passed} passed)` : `All ${passed} tests passed.`,
);
