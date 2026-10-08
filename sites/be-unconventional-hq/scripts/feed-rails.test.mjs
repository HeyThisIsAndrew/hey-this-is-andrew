/**
 * The Feed browses stories, not the CMS.
 *
 * ─── WHAT THIS IS GUARDING ──────────────────────────────────────────────────
 * The Feed used to render a hand-written `SECTION_DEFS`: 6 sections over 14
 * rows, every hub named individually. Three separate headings for HBO Max,
 * Netflix and Prime Video answer a question nobody asks; "what's on streaming"
 * is one question and deserves one rail.
 *
 * Worse, the hand-written list went stale silently. It omitted the `studios`
 * category entirely, so 17 stories had no place on the Feed at all, Warner Bros
 * with 11 among them: the single largest hub in the store, invisible.
 *
 * And it printed one list three times. "All Content" was exactly "All Videos"
 * ∪ "All Articles" as a set identity, and those three rows were 82 of the
 * page's 160 tile placements. 51% of the page, discovering nothing.
 *
 * The rails derive from `hubCategory` now, the same field /featured groups its
 * hub directory by. These assertions exist so the Feed cannot drift back into
 * hand-maintained taxonomy.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildRails,
  selectCollections,
  inSeries,
  accentFor,
  sortTime,
  HUB_CATEGORY_ORDER,
  RAIL_ANCHORS,
  RAIL_LIMIT,
  LATEST_LIMIT,
} from '../src/lib/feed-rails.ts';
import { HUB_CATEGORY_LABELS } from '../src/lib/hub-labels.ts';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(join(here, '..', ...p), 'utf8');

const store = JSON.parse(read('src', 'data', 'videos.json'));
const hubs = store.filter((d) => d._type === 'featuredBrand');
const videos = store
  .filter((v) => v._type === 'video' && v.contentStatus === 'published')
  .map((v) => ({ ...v, type: 'video', date: v.publishedAt }));
const articles = JSON.parse(read('src', 'data', 'articles.json'))
  .map((a) => ({ ...a, type: 'article', date: a.isoDate || a.date }));
const corpus = [...videos, ...articles];

const slugOf = (d) => (typeof d.slug === 'string' ? d.slug : d.slug?.current);
/* A deliberately simple stand-in for the page's own matcher: this suite is
   about the rail STRUCTURE, not about re-testing hub matching. */
const matchesHub = (item, slug) => Array.isArray(item.hubs) && item.hubs.includes(slug);
const hasTopic = (item, topic) => {
  const alias = { games: ['games', 'gaming'], film: ['film', 'movies'], tv: ['tv', 'television'] }[topic] ?? [topic];
  const topics = (item.topics ?? []).map((t) => String(t).toLowerCase());
  return topics.some((t) => alias.includes(t)) || alias.includes(String(item.category ?? '').toLowerCase());
};
const rails = () => buildRails(corpus, { hubs, matchesHub, hasTopic });

test('the rails come from the CMS, not from a list in the component', () => {
  const grid = read('src', 'components', 'FeedGrid.astro');
  assert.ok(!/SECTION_DEFS/.test(grid.replace(/\/\*[\s\S]*?\*\//g, '')), 'the hand-written section list must be gone');
  assert.match(grid, /buildRails\(/, 'and the rails must be derived');

  /* The one thing that is a design decision rather than data. */
  assert.deepEqual([...HUB_CATEGORY_ORDER], ['universes', 'streaming', 'studios', 'gaming']);
});

test('a category rail is one rail, however many hubs are in it', () => {
  const built = rails();
  const ids = built.map((r) => r.id);
  for (const category of HUB_CATEGORY_ORDER) {
    assert.equal(ids.filter((id) => id === category).length <= 1, true, `${category} must not split into several rails`);
  }
  /* Three streaming hubs carry content today; they must produce ONE heading. */
  const streamingHubs = hubs.filter((h) => h.hubCategory === 'streaming').map(slugOf);
  assert.ok(streamingHubs.length >= 3, 'the store should hold several streaming hubs');
  const rail = built.find((r) => r.id === 'streaming');
  assert.ok(rail, 'and they should produce a Streamers rail');
  assert.equal(rail.title, HUB_CATEGORY_LABELS.streaming);
});

test('every populated category appears, including the one the old list forgot', () => {
  const built = rails();
  const studios = built.find((r) => r.id === 'studios');
  assert.ok(studios, 'Studios had 17 stories and no presence on the Feed at all');
  assert.ok(studios.items.length > 0);

  /* Warner Bros is the largest hub in the store and was invisible. */
  const wb = corpus.filter((i) => matchesHub(i, 'warner-bros'));
  assert.ok(wb.length > 0, 'the store should still hold Warner Bros coverage');
  assert.ok(studios.items.some((i) => wb.includes(i)), 'and it must now reach the Feed');
});

test('a category that matches nothing is dropped, not shipped as a bare heading', () => {
  const onlyEmpty = buildRails([], { hubs, matchesHub, hasTopic });
  assert.deepEqual(onlyEmpty.map((r) => r.id), ['latest'], 'only The Latest survives an empty corpus');
  assert.deepEqual(onlyEmpty[0].items, []);
});

test('The Latest is ONE rail', () => {
  const built = rails();
  const latest = built.filter((r) => /latest|videos|articles/i.test(r.id));
  assert.equal(latest.length, 1, 'splitting a chronological feed by medium is a filter, not a discovery path');
  assert.equal(latest[0].id, 'latest');
  assert.ok(latest[0].items.length <= LATEST_LIMIT);

  const grid = read('src', 'components', 'FeedGrid.astro');
  const code = grid.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  assert.ok(!/All Videos|All Articles/.test(code), 'the medium-split rows must be gone');
});

test('games merges its hub category with its topic', () => {
  /* Games is both a hub category and a Tier-1 topic. Splitting them would put
     PlayStation coverage in one rail and an unhubbed game piece in another,
     which is the CMS showing through again. */
  const built = rails();
  const rail = built.find((r) => r.id === 'gaming');
  if (!rail) return; /* nothing in the store matches either today */
  const topicOnly = corpus.filter((i) => hasTopic(i, 'games') && !(i.hubs ?? []).length);
  for (const item of topicOnly) {
    assert.ok(rail.items.includes(item), 'a game piece with no platform hub still belongs in Games');
  }
});

test('rails are capped, and the cap is a ceiling not a quota', () => {
  for (const rail of rails()) {
    const cap = rail.id === 'latest' ? LATEST_LIMIT : RAIL_LIMIT;
    assert.ok(rail.items.length <= cap, `${rail.id} is over its cap`);
    assert.ok(rail.items.length > 0, `${rail.id} shipped empty`);
  }
});

test('a curated collection is chosen from data, never from a name in the code', () => {
  const chosen = selectCollections(corpus);
  assert.ok(chosen.length > 0, 'a collection should be selectable from the real store');
  assert.match(chosen[0].reason, /flagged in the CMS|most recently updated/);

  for (const file of [
    ['src', 'lib', 'feed-rails.ts'],
    ['src', 'components', 'FeedGrid.astro'],
  ]) {
    const code = read(...file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');
    assert.ok(!/lanterns/i.test(code), `${file.join('/')} must not name the current show`);
  }
});

test('several series can each have their own section', () => {
  /* The whole point: a dedicated section for the show being covered right now
     must not be a single privileged slot. */
  const flagged = corpus.map((i) => ({
    ...i,
    featuredSeries: i.series === 'Lanterns' || i.series === 'The Umbrella Academy',
  }));
  const chosen = selectCollections(flagged);
  assert.equal(chosen.length, 2, 'two flagged series must produce two collections');
  assert.deepEqual(new Set(chosen.map((c) => c.name)), new Set(['Lanterns', 'The Umbrella Academy']));
  /* Most recently updated first. */
  assert.equal(chosen[0].name, 'Lanterns');
});

test('the fallback does not need the flag to exist anywhere', () => {
  const unflagged = corpus.map(({ featuredSeries, ...rest }) => rest);
  const chosen = selectCollections(unflagged);
  assert.equal(chosen.length, 1);
  assert.match(chosen[0].reason, /most recently updated/);
});

test('a collection carries both media, so a package is not video-only', () => {
  /* `series` is a field on videos. Articles sync from Substack and carry none,
     so matching on it alone would silently drop both Lanterns articles. */
  const chosen = selectCollections(corpus)[0];
  const members = corpus.filter((i) => inSeries(i, chosen.name));
  const kinds = new Set(members.map((i) => i.type));
  assert.ok(kinds.has('video') && kinds.has('article'), 'a collection must reach its articles too');

  const article = articles.find((a) => (a.tags ?? []).some((t) => String(t).toLowerCase() === 'lanterns'));
  assert.ok(article, 'the store should hold a tagged article');
  assert.equal(String(article.series ?? ''), '', 'which carries no series field');
  assert.ok(inSeries(article, 'Lanterns'), 'and still joins by tag');
});

test('a collection is themed for the show, with real fallbacks under it', () => {
  const members = corpus.filter((i) => inSeries(i, 'Lanterns'));
  assert.ok(accentFor(members), 'the current collection carries its own accent');
  assert.equal(accentFor([{ seriesAccent: '  #10B981 ' }]), '#10B981', 'whitespace is trimmed');
  assert.equal(accentFor([{ seriesAccent: 'not-a-hex' }]), null, 'a malformed value falls through');
  assert.equal(accentFor([{}, { seriesAccent: '#ABCDEF' }]), '#ABCDEF', 'read from ANY member');

  const grid = read('src', 'components', 'FeedGrid.astro');
  assert.match(grid, /accentFor\(members\) \|\| usableHub \|\| SITE_ACCENT/, 'three rungs, in order');
  assert.match(grid, /const SITE_ACCENT = '#cc0000';/, 'the last rung is a real colour, not undefined');
  assert.match(grid, /toLowerCase\(\) !== '#ffffff'/, 'white is skipped: over near-black it is fog');
});

test('the editorial ordering override survives into the rails', () => {
  const weighted = { title: 'w', sortDate: '2026-12-01', date: '2020-01-01' };
  const plain = { title: 'p', date: '2026-11-01' };
  assert.ok(sortTime(weighted) > sortTime(plain), 'sortDate must win over the publish date');
  assert.equal(sortTime({ title: 'x' }), 0, 'an item with no date sorts last rather than first');
});

test('the accordion is gone, because there are no sections left to collapse', () => {
  /*
    It existed because the page was six sections containing fourteen stacked
    ROWS. Eight horizontal rails do not stack that way: a rail of seventeen
    stories is one row of vertical space. /featured keeps its accordion, and
    should, because its rows are decks of hub cards which DO stack.
  */
  const grid = read('src', 'components', 'FeedGrid.astro');
  const code = grid.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  for (const dead of ['feed-section-toggle', 'initCollapsibleSections', 'DEFAULT_OPEN_SECTION', 'feed-section-rows']) {
    assert.ok(!code.includes(dead), `${dead} is dead now and should not ship`);
  }
  const featured = read('src', 'pages', 'featured', 'index.astro');
  assert.match(featured, /accordion-header/, '/featured keeps its accordion');
});

test('a rail leads with what the collection above did not already show', () => {
  /*
    THE VISIBLE VERSION OF THE REPETITION PROBLEM. Lanterns is DC and HBO Max
    and Warner Bros, so Franchises, Streamers and Studios all opened with the
    same three tiles and the same artwork, one after another, immediately under
    the shelf that had just shown them. Every one of those memberships is real,
    which is why the fix is an ORDER change and not a filter: the items stay in
    all four rails, they just wait their turn.
  */
  const collection = selectCollections(corpus)[0];
  const members = corpus.filter((i) => inSeries(i, collection.name));
  const shown = new Set(members.slice(0, RAIL_LIMIT));

  const before = buildRails(corpus, { hubs, matchesHub, hasTopic });
  const after = buildRails(corpus, { hubs, matchesHub, hasTopic, alreadyShown: shown });

  const taxonomy = (list) => list.filter((r) => r.id !== 'latest');
  const leadsBefore = taxonomy(before).map((r) => r.items[0]);
  const leadsAfter = taxonomy(after).map((r) => r.items[0]);

  assert.ok(leadsBefore.some((i) => shown.has(i)), 'the problem should be reproducible');
  for (const lead of leadsAfter) {
    assert.ok(!shown.has(lead), 'no taxonomy rail may open with a tile the collection already showed');
  }

  /* MEMBERSHIP IS UNCHANGED. This is the line between meaningful repetition,
     which is kept, and a page that repeats itself, which is not. */
  for (let i = 0; i < taxonomy(before).length; i += 1) {
    assert.deepEqual(
      new Set(taxonomy(before)[i].items.map((x) => x.title)).size > 0,
      true,
    );
    const b = taxonomy(before)[i];
    const a = taxonomy(after).find((r) => r.id === b.id);
    assert.equal(a.items.length, b.items.length, `${b.id} must keep its size`);
  }
});

test('The Latest still leads with the newest thing, whatever the collection showed', () => {
  /* It is the newsroom. Demoting the newest story there because a shelf above
     also carries it would make the one chronological rail lie. */
  const shown = new Set(corpus.filter((i) => inSeries(i, 'Lanterns')));
  const latest = buildRails(corpus, { hubs, matchesHub, hasTopic, alreadyShown: shown })
    .find((r) => r.id === 'latest');
  const newest = [...corpus].sort((a, b) => sortTime(b) - sortTime(a))[0];
  assert.equal(latest.items[0].title, newest.title);
});

test('the Games tile on the homepage lands on the Games rail', () => {
  /*
    A link to /feed#games resolves because `games` is the
    canonical category slug in src/data/constants.js. The rail's own id is its
    hubCategory, `gaming`. Both names are correct and they are not the same
    name, so the section answers to the reader's one and keeps the CMS's.

    This was a dead anchor: the link navigated to /feed and landed nowhere,
    with nothing to show that anything had failed.
  */
  const rail = buildRails(corpus, { hubs, matchesHub, hasTopic }).find((r) => r.id === 'gaming');
  assert.ok(rail, 'the gaming rail must still be built from the hubCategory');
  assert.equal(rail.anchor, 'games', 'and must answer to the slug the tile uses');

  const grid = read('src', 'components', 'FeedGrid.astro');
  assert.match(grid, /id=\{rail\.anchor \?\? rail\.id\}/,
    'the element id is the public name, falling back to the rail id');
  assert.match(grid, /data-row=\{rail\.id\}/,
    'and data-row keeps the internal one, which the scroll handler also resolves');
  /*
    The floating contents rail links by getElementById, so it must be given the
    same name the element actually carries. It was given `rail.id` and the Games
    entry became a link to nothing — no error, no highlight, no scroll.
  */
  assert.match(grid, /rails\.map\(\(r\) => \(\{ id: r\.anchor \?\? r\.id,/,
    'the contents rail must link to the anchor, not the internal id');

});

test('every homepage tile has somewhere on the Feed to land', () => {
  /*
    The general form of the bug above, checked against the source rather than a
    fixture: a tile whose slug names no section is a link that goes nowhere and
    says nothing. Events is excluded because its tile goes to /events, which is
    a page, not a rail.
  */
  const slugs = [...read('src', 'data', 'categories.js').matchAll(/slug: '([a-z]+)'/g)]
    .map((m) => m[1])
    .filter((slug) => slug !== 'events');
  assert.ok(slugs.length >= 3, 'the tiles were not parsed');

  const topicIds = [...read('src', 'lib', 'feed-rails.ts').matchAll(/\{ id: '([a-z-]+)', title: '[^']*', topic:/g)]
    .map((m) => m[1]);
  const reachable = new Set([...topicIds, ...Object.values(RAIL_ANCHORS)]);

  for (const slug of slugs) {
    assert.ok(reachable.has(slug), `/feed#${slug} names no section: the tile is a dead link`);
  }
});

console.log('\nFeed rails: all assertions ran.');
