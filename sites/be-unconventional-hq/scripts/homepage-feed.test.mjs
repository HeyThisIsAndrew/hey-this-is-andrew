/**
 * The homepage content model (src/lib/homepage-feed.ts).
 *
 * The previous homepage attempt white-screened on date math over an empty
 * array. These assert the builder survives every empty or malformed input it
 * can be handed, never repeats a story, and only ever emits copy it was given.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildHomepageFeed,
  mapArticle,
  mapVideo,
  toTime,
  formatDuration,
  readTimeFromHtml,
  normalizeCategory,
  pickPullQuote,
  newUntil,
  NEW_FOR_MS,
} from '../src/lib/homepage-feed.ts';
import { pickFeaturedHighlights } from '../src/lib/featured-highlights.ts';

let passed = 0;
const test = (name, fn) => {
  try {
    fn();
    passed++;
  } catch (err) {
    process.exitCode = 1;
    console.error(`✗ ${name}\n  ${err.message}`);
  }
};

const deps = {
  timeZone: 'America/Los_Angeles',
  articleHref: (a) => (a.slug ? `/intel/${a.slug}` : ''),
  isExternalArticle: () => false,
  articleImage: (raw) => ({ src: raw, srcset: '' }),
  videoImage: (raw) => ({ src: raw, srcset: '' }),
};

const art = (n, over = {}) =>
  mapArticle(
    {
      guid: `g${n}`,
      slug: `a${n}`,
      title: `Article ${n}`,
      excerpt: `Deck ${n}`,
      image: `https://img/${n}.jpg`,
      category: 'Film',
      contentType: 'Review',
      isoDate: `2026-09-${String(10 + n).padStart(2, '0')}T12:00:00Z`,
      tags: [],
      bodyHtml: '<p>word</p>',
      ...over,
    },
    deps,
  );
const vid = (n, over = {}) =>
  mapVideo(
    {
      youtubeId: `v${n}`,
      title: `Video ${n}`,
      description: 'First line here. Second line.',
      thumbnail: `https://i.ytimg.com/vi/v${n}/hqdefault.jpg`,
      category: 'TV',
      publishedAt: `2026-08-${String(10 + n).padStart(2, '0')}T12:00:00Z`,
      durationSeconds: 768,
      ...over,
    },
    deps,
  );

test('hero chips carry the /feed metadata pair, never "Video"', () => {
  /* WHOSE and WHAT (getDisplayTagSlots, src/lib/tags.ts), as on /feed. The
     chips used to read FILM | VIDEO: the row label and the play button. */
  const v = vid(1, { badge1: 'SONY PICTURES', coverageType: 'REACTION' });
  assert.equal(v.brand, 'SONY PICTURES');
  assert.equal(v.kicker, 'REACTION');
  const tagged = vid(2, { youtubeTags: ['Lanterns', 'Lanterns Review'] });
  assert.equal(tagged.brand, 'DC');
  assert.equal(tagged.kicker, 'REVIEW');
  const bare = vid(3);
  assert.equal(bare.brand, '');
  assert.equal(bare.kicker, '', 'an unclassified video must not fall back to "Video"');
  assert.equal(art(4, { contentType: 'Review' }).kicker, 'REVIEW');
});

test('empty stores build an empty page, not a crash', () => {
  const feed = buildHomepageFeed([], [], { featured: { title: 'Lanterns', match: 'lanterns' } });
  assert.deepEqual(feed.hero, []);
  assert.equal(feed.intel.lead, null);
  assert.deepEqual(feed.intel.orbit, []);
  assert.equal(feed.featured, null);
  assert.equal(feed.quote, null);
  assert.deepEqual(feed.rail, []);
});

test('non-array and null inputs are tolerated', () => {
  assert.doesNotThrow(() => buildHomepageFeed(undefined, null));
  assert.doesNotThrow(() => buildHomepageFeed([null, undefined], [null]));
});

test('unparseable dates never produce Invalid Date', () => {
  assert.equal(toTime('not a date'), 0);
  assert.equal(toTime(undefined), 0);
  assert.equal(toTime(''), 0);
  const a = art(1, { isoDate: 'garbage' });
  assert.equal(a.publishDate, '');
  assert.equal(a.displayDate, '');
  assert.doesNotThrow(() => buildHomepageFeed([a], []));
});

test('mappers reject records with no title or no destination', () => {
  assert.equal(art(1, { title: '' }), null);
  assert.equal(art(1, { slug: '' }), null);
  assert.equal(vid(1, { youtubeId: '' }), null);
  assert.equal(vid(1, { isShort: true }), null, 'the rail is long-form only');
});

test('no story appears in two sections', () => {
  const articles = [1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
    art(n, { category: ['Film', 'TV', 'Games', 'Events'][n % 4], tags: n < 3 ? ['Lanterns'] : [] }),
  );
  const videos = [1, 2, 3, 4, 5, 6].map((n) => vid(n, { title: n < 3 ? `Lanterns ep ${n}` : `Video ${n}` }));
  const feed = buildHomepageFeed(articles, videos, { featured: { title: 'Lanterns', match: 'lanterns' } });
  const ids = [
    ...feed.hero.map((p) => p.story.id),
    feed.intel.lead?.id,
    ...feed.intel.orbit.map((s) => s.id),
    feed.featured?.lead.id,
    ...(feed.featured?.items ?? []).map((s) => s.id),
    ...feed.rail.map((s) => s.id),
  ].filter(Boolean);
  assert.equal(new Set(ids).size, ids.length, `duplicate in ${ids.join(', ')}`);
});

test('hero panels keep the fixed order; each takes its newest, LATEST the newest left', () => {
  const articles = [
    art(1, { category: 'Film' }),
    art(2, { category: 'TV' }),
    art(3, { category: 'Games' }),
    art(4, { category: 'Events' }),
    art(5, { category: 'Film' }),
  ];
  const feed = buildHomepageFeed(articles, []);
  assert.deepEqual(feed.hero.map((p) => p.key), ['film', 'tv', 'games', 'events', 'latest']);
  assert.equal(feed.hero[0].story.id, 'article:g5', 'FILM shows the newest Film story');
  const latest = feed.hero.at(-1);
  assert.equal(latest.story.id, 'article:g1', 'LATEST is the newest story the categories left');
  assert.equal('isNew' in latest, false, 'NEW is decided in the browser from newUntil(), not baked into the build');
});

test('a category takes its newest story whether article or video, even from the featured world', () => {
  /* Andrew's report: the TV panel showed an older article while the newest
     TV piece was a Lanterns video, because articles led every category and
     Featured claimed the whole Lanterns world before the hero picked. */
  const articles = [art(1, { category: 'TV' })];
  const videos = [vid(1, { category: 'TV', title: 'Lanterns Episode 9', publishedAt: '2026-09-20T12:00:00Z' })];
  const feed = buildHomepageFeed(articles, videos, { featured: { title: 'Lanterns', match: 'lanterns' } });
  const tv = feed.hero.find((p) => p.key === 'tv');
  assert.equal(tv.story.type, 'video');
  assert.equal(tv.story.id, 'video:v1');
  const ids = [...feed.hero.map((p) => p.story.id), ...(feed.featured ? [feed.featured.lead.id, ...feed.featured.items.map((s) => s.id)] : [])];
  assert.equal(new Set(ids).size, ids.length, 'the hero and Featured never repeat a story');
});

test('hero category panels open on heroPicks, and LATEST stays the newest story left', () => {
  /* Andrew's preferred mix is the production Featured Highlights pick. An
     older picked story beats a newer unpicked one in its category, and the
     newest unpicked story is what LATEST shows. */
  const articles = [art(1, { category: 'Events' })];
  const videos = [
    vid(1, { category: 'Film', title: 'Resident Evil We Were Wrong', publishedAt: '2026-09-01T12:00:00Z' }),
    vid(2, { category: 'Film', title: 'Coyote vs Acme', publishedAt: '2026-09-16T12:00:00Z' }),
  ];
  const feed = buildHomepageFeed(articles, videos, { heroPicks: ['video:v1', 'article:g1'] });
  assert.equal(feed.hero.find((p) => p.key === 'film').story.id, 'video:v1', 'the pick, not the newer Film video');
  assert.equal(feed.hero.find((p) => p.key === 'events').story.id, 'article:g1');
  assert.equal(feed.hero.find((p) => p.key === 'latest').story.id, 'video:v2', 'LATEST is the newest left');
});

test('pickFeaturedHighlights: featured first, distinct categories, best performer, newest article', () => {
  const v = (id, category, day, extra = {}) => ({ youtubeId: id, category, publishedAt: `2026-09-${day}T12:00:00Z`, ...extra });
  const videos = [
    v('new1', 'Film', '20'),
    v('new2', 'Film', '19'),
    v('tv', 'TV', '10', { featured: true }),
    v('games', 'Games', '05', { viewCount: 9000 }),
    v('filmHit', 'Film', '04', { viewCount: 99000 }),
  ];
  const articles = [{ slug: 'la', title: 'L.A. Comic Con', isoDate: '2026-09-15T12:00:00Z' }, { slug: 'old', isoDate: '2026-01-01T12:00:00Z' }];
  const picks = pickFeaturedHighlights(videos, articles, (a) => `/intel/${a.slug}`);
  const ids = picks.map((p) => p.youtubeId || p.slug);
  assert.deepEqual([...ids].sort(), ['games', 'la', 'new1', 'tv'].sort(), 'featured TV, newest Film, best Games (a new category beats a bigger Film hit), newest article');
  assert.equal(picks.find((p) => p.slug === 'la').link, '/intel/la');
  assert.deepEqual(pickFeaturedHighlights([], [], () => ''), [], 'empty stores, empty pick');
});

test('a category with no stories drops its panel instead of rendering empty', () => {
  const feed = buildHomepageFeed([art(1, { category: 'Film' }), art(2, { category: 'Film' })], []);
  assert.deepEqual(feed.hero.map((p) => p.key), ['film', 'latest']);
});

test('featured world matches whole words only and needs art for its lead', () => {
  /* g3 and g4 are newer, so the hero (which picks first) takes those and
     leaves the world's own article for Featured. */
  const articles = [art(1, { title: 'Lanternsmith weekly' }), art(2, { tags: ['Lanterns'] }), art(3), art(4)];
  const feed = buildHomepageFeed(articles, [], { featured: { title: 'Lanterns', match: 'lanterns' } });
  assert.equal(feed.featured.lead.id, 'article:g2');
  assert.equal(feed.featured.total, 1);
  const none = buildHomepageFeed([art(3)], [], { featured: { title: 'Lanterns', match: 'lanterns' } });
  assert.equal(none.featured, null, 'no matching story means no section');
});

test('pull quote is a verbatim sentence from the source, never with an em dash', () => {
  const long = 'This sentence is long enough to be a pull quote on the homepage for sure.';
  const s = art(1, { preview: [`Short. Here is one — with a dash that is long enough to qualify as a quote. ${long}`] });
  const q = pickPullQuote([s]);
  assert.equal(q.text, long);
  assert.ok(s.paragraphs[0].includes(q.text));
  assert.equal(pickPullQuote([art(2, { preview: ['Too short.'] })]), null);
});

test('formatting helpers', () => {
  assert.equal(formatDuration(768), '12:48');
  assert.equal(formatDuration(3723), '1:02:03');
  assert.equal(formatDuration(0), '');
  assert.equal(formatDuration('x'), '');
  assert.equal(readTimeFromHtml(''), '');
  assert.equal(readTimeFromHtml('<p>' + 'word '.repeat(460) + '</p>'), '2 min read');
  assert.equal(normalizeCategory('Gaming'), 'Games');
  assert.equal(normalizeCategory('General'), null);
});

test('the homepage sources its copy from the content module, not literals', () => {
  const page = fs.readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
  assert.match(page, /getHomepageFeed/, 'index.astro must read from src/data/homepage-feed.ts');
});

test('the homepage does not mount the splash hero', () => {
  const page = fs.readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /import Hero from/, 'the splash is sunset; Hero.astro stays on disk, unmounted');
});

test('NEW lasts 24 hours from the publish time, and needs a real date', () => {
  const t = Date.parse('2026-09-20T15:00:00.000Z');
  assert.equal(NEW_FOR_MS, 24 * 60 * 60 * 1000);
  assert.equal(newUntil('2026-09-20T15:00:00.000Z'), t + NEW_FOR_MS);
  assert.equal(newUntil(''), null);
  assert.equal(newUntil('not a date'), null);
});

console.log(process.exitCode ? `FAILED (${passed} passed)` : `All ${passed} tests passed.`);
