// Guard: BE Unconventional HQ latest endpoint parser and fetcher.
// Run: node scripts/hq-latest.test.mjs (npm test)
import assert from 'node:assert/strict';
import {
  parseLatestPosts,
  postImageSrcset,
  fetchLiveLatestPosts,
  getLatestPostsForBuild,
  HQ_LATEST_DEV_URL,
} from '../src/lib/hq-latest.ts';

// 1. Version validation
assert.equal(parseLatestPosts({ version: 2, items: [] }), null, 'rejects version 2');
assert.equal(parseLatestPosts({ items: [] }), null, 'rejects missing version');
assert.equal(parseLatestPosts(null), null, 'rejects null payload');
assert.equal(parseLatestPosts('not json'), null, 'rejects string payload');

// 2. Empty authoritative response
assert.deepEqual(parseLatestPosts({ version: 1, items: [] }), [], 'accepts valid empty items list');

// 3. Rejects invalid item structures
assert.equal(
  parseLatestPosts({
    version: 1,
    items: [{ id: 'test', kind: 'podcast', title: 'Invalid kind', url: 'https://beunconventionalhq.com/p/1', publishedAt: '2026-11-01T00:00:00Z' }],
  }),
  null,
  'rejects invalid kind'
);

assert.equal(
  parseLatestPosts({
    version: 1,
    items: [{ id: 'test', kind: 'article', title: 'Insecure URL', url: 'http://beunconventionalhq.com/p/1', publishedAt: '2026-11-01T00:00:00Z' }],
  }),
  null,
  'rejects insecure http url'
);

// 4. Parses clean titles without raw HTML entities and cleans em dashes
const samplePayload = {
  version: 1,
  items: [
    {
      id: 'item-video',
      kind: 'video',
      title: 'Godzilla Minus Zero LA Premiere Reaction &amp; Review &#8212; More Heart Than Action?',
      url: 'https://beunconventionalhq.com/feed?play=twsiOG7P1jk',
      publishedAt: '2026-10-29T16:49:04.000Z',
      image: {
        src: 'https://i.ytimg.com/vi/twsiOG7P1jk/hqdefault.jpg',
        candidates: [
          { src: 'https://wsrv.nl/?url=i.ytimg.com/vi/twsiOG7P1jk/maxresdefault.jpg&w=400', width: 400 },
          { src: 'https://wsrv.nl/?url=i.ytimg.com/vi/twsiOG7P1jk/maxresdefault.jpg&w=800', width: 800 },
        ],
      },
    },
    {
      id: 'item-article',
      kind: 'article',
      title: 'Avengers: Doomsday | When Cinematic Hype Meets &quot;Toy-Grade&quot; Merchandise',
      url: 'https://beunconventionalhq.com/intel/avengers-doomsday-when-cinematic',
      publishedAt: '2026-11-06T18:03:44.784Z',
      image: {
        src: 'https://wsrv.nl/?url=substackcdn.com/cover.jpg&w=600',
        candidates: [
          { src: 'https://wsrv.nl/?url=substackcdn.com/cover.jpg&w=400', width: 400 },
          { src: 'https://wsrv.nl/?url=substackcdn.com/cover.jpg&w=1200', width: 1200 },
        ],
      },
    },
  ],
};

const parsedSample = parseLatestPosts(samplePayload);
assert.ok(parsedSample, 'sample payload parsed');
assert.equal(parsedSample.length, 2, 'parsed 2 items');

// Chronologically descending: article (Nov 6) before video (Oct 29)
assert.equal(parsedSample[0].id, 'item-article');
assert.equal(parsedSample[0].kind, 'article');
assert.equal(parsedSample[0].title, 'Avengers: Doomsday | When Cinematic Hype Meets "Toy-Grade" Merchandise');
assert.equal(parsedSample[1].id, 'item-video');
assert.equal(parsedSample[1].kind, 'video');
assert.equal(parsedSample[1].title, 'Godzilla Minus Zero LA Premiere Reaction & Review, More Heart Than Action?');

// Responsive image candidates and srcset
assert.equal(parsedSample[0].image?.src, 'https://wsrv.nl/?url=substackcdn.com/cover.jpg&w=600');
assert.equal(parsedSample[0].image?.candidates.length, 2);
assert.equal(
  postImageSrcset(parsedSample[0]),
  'https://wsrv.nl/?url=substackcdn.com/cover.jpg&w=400 400w, https://wsrv.nl/?url=substackcdn.com/cover.jpg&w=1200 1200w'
);

// 5. Test live workers dev endpoint
const liveDev = await fetchLiveLatestPosts(HQ_LATEST_DEV_URL);
assert.ok(liveDev, 'live workers dev endpoint returns parsed items');
assert.equal(liveDev.length, 2, 'live endpoint returns 2 newest posts');

const kinds = new Set(liveDev.map((item) => item.kind));
assert.ok(kinds.has('article'), 'includes latest article');
assert.ok(kinds.has('video'), 'includes latest video');

// Verify chronological ordering
const time0 = Date.parse(liveDev[0].publishedAt);
const time1 = Date.parse(liveDev[1].publishedAt);
assert.ok(time0 >= time1, 'items are in chronologically descending order');

// Verify clean titles without raw HTML entities
for (const item of liveDev) {
  assert.ok(!/&[a-z0-9#]+;/i.test(item.title), `title "${item.title}" contains no unescaped entities`);
  assert.ok(!item.title.includes('\u2014'), `title "${item.title}" contains no em dashes`);
  assert.ok(item.image?.src, `item "${item.id}" has valid image src`);
  assert.ok(Array.isArray(item.image?.candidates) && item.image.candidates.length > 0, `item "${item.id}" has responsive candidates`);
}

// 6. Test build helper: must use the live endpoint without falling back to
// the search index. Compare it with the endpoint the build itself reads
// (production, falling back to the workers.dev preview), never with the
// preview alone: the two are separate deployments, and the preview went
// stale the first time the HQ published after it.
const buildPosts = await getLatestPostsForBuild();
const live = await fetchLiveLatestPosts();
assert.ok(buildPosts, 'getLatestPostsForBuild succeeds');
assert.ok(live, 'live endpoint returns parsed items');
assert.equal(buildPosts.length, 2, 'build posts return 2 items');
assert.equal(buildPosts[0].id, live[0].id, 'build posts match live endpoint first item');
assert.equal(buildPosts[1].id, live[1].id, 'build posts match live endpoint second item');

console.log('hq-latest: ok');
