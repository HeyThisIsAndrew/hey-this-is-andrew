/**
 * Offline unit tests for src/lib/videos.ts (Video Migration Phase A).
 *
 * Run:  node scripts/videos.test.mjs
 */
import assert from 'node:assert/strict';
import {
  mapSanityVideo,
  getUnifiedVideos,
  buildPublishedQuery,
} from '../src/lib/videos.ts';

let passed = 0;
const test = async (name, fn) => {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err.message}`);
    process.exitCode = 1;
  }
};

const DOC = {
  youtubeId: 'dQw4w9WgXcQ',
  title: 'SDCC 2026 Floor Tour',
  thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
  durationSeconds: 754,
  isShort: false,
  publishedAt: '2026-07-12T15:00:00Z',
  topics: ['film', 'conventions'],
  featured: true,
};

console.log('videos.ts');

await test('maps a full doc to the legacy shape + extras', () => {
  const v = mapSanityVideo(DOC);
  assert.equal(v.title, 'SDCC 2026 Floor Tour');
  assert.equal(v.link, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(v.thumbnail, DOC.thumbnailUrl);
  assert.equal(v.category, 'Film'); // editorial topic wins
  assert.equal(v.date, 'July 12, 2026'); // legacy long-form date
  assert.equal(v.isShort, false);
  assert.equal(v.youtubeId, 'dQw4w9WgXcQ');
  assert.equal(v.featured, true);
  assert.equal(v.source, 'sanity');
});

await test('Shorts keep the /shorts/ URL form', () => {
  const v = mapSanityVideo({ ...DOC, isShort: true });
  assert.equal(v.link, 'https://www.youtube.com/shorts/dQw4w9WgXcQ');
  assert.equal(v.isShort, true);
});

await test('topic that is not a site category → categorize fallback', () => {
  const v = mapSanityVideo(
    { ...DOC, topics: ['conventions'] },
    { categorize: () => 'Events' },
  );
  assert.equal(v.category, 'Events');
});

await test('no topics, no categorize → General', () => {
  assert.equal(mapSanityVideo({ ...DOC, topics: [] }).category, 'General');
});

await test('missing thumbnailUrl falls back to hqdefault, never maxres', () => {
  /*
    This used to synthesise `maxresdefault.jpg`, which is a GUESS: YouTube
    only generates that rendition for uploads at 720p or better, and asking
    for a missing one gets a 404 or a grey 120x90 placeholder. Worse, the
    guess is indistinguishable downstream from a real one — card-images.ts
    treats "the URL says maxresdefault" as proof the rendition exists and
    offers it in a srcset, and srcset has no fallback semantics, so the card
    dies rather than stepping down.

    hqdefault is generated for every video, so the fallback is now a fact
    rather than a guess. Asserted negatively too: the point is not the exact
    string, it is that nothing unverified reaches the srcset builder.
  */
  const v = mapSanityVideo({ ...DOC, thumbnailUrl: undefined });
  assert.equal(v.thumbnail, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  assert.ok(!v.thumbnail.includes('maxresdefault'), v.thumbnail);
});

await test('docs missing id or title are rejected (null)', () => {
  assert.equal(mapSanityVideo({ ...DOC, youtubeId: null }), null);
  assert.equal(mapSanityVideo({ ...DOC, title: '' }), null);
  assert.equal(mapSanityVideo(null), null);
});

await test('getUnifiedVideos: strictly queries using buildPublishedQuery', async () => {
  const client = { fetch: async (q) => {
    assert.equal(q, buildPublishedQuery('video'));
    return [DOC];
  }};
  
  const out = await getUnifiedVideos(client, {}, buildPublishedQuery('video'));
  assert.equal(out.length, 1);
  assert.equal(out[0].title, 'SDCC 2026 Floor Tour');
});

await test('getUnifiedVideos: Sanity failure correctly re-throws', async () => {
  const client = { fetch: async () => { throw new Error('egress blocked'); } };
  await assert.rejects(async () => await getUnifiedVideos(client), /egress blocked/);
});

await test('getUnifiedVideos: empty everywhere → empty list', async () => {
  const out = await getUnifiedVideos({ fetch: async () => [] });
  assert.deepEqual(out, []);
});

console.log(
  process.exitCode ? `FAILED (${passed} passed)` : `All ${passed} tests passed.`,
);
