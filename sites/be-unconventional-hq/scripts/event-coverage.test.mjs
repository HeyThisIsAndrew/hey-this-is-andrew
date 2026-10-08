/*
  Event and hub coverage matching — src/lib/hub-coverage.ts and the two pages
  that call it.

  Offline. No browser, no network, no build step: the matcher is exercised
  directly and the pages are read as source, in the style of the other guards
  in this directory.

  ─── WHAT THIS FILE EXISTS TO STOP ─────────────────────────────────────────
  Two page types answered one question — "what coverage belongs to this
  hub?" — with two hand-written implementations, and only one of them worked.
  The event page's version searched article prose for strings like
  "sdcc-2026" and returned ZERO articles for all nineteen events. It was
  reported as "I'm actually surprised that you're saying articles don't
  currently appear", which is exactly the right reaction: nothing on the page
  said so, it just looked like there was no coverage.
*/
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';
import {
  findHubForItem,
  normalizeTag,
  compactTag,
  coverageIdentity,
  getHubMatchTags,
  matchArticlesByTags,
  matchVideosByTags,
  collectHubCoverage,
  coverageTimestamp,
  COVERAGE_PAGE_LIMIT,
  COVERAGE_FEED_PAGE_SIZE,
} from '../src/lib/hub-coverage.ts';

const here = dirname(fileURLToPath(import.meta.url));
const readSrc = (...parts) => readFileSync(join(here, '..', ...parts), 'utf8');

/* Comments explain the very bugs the negative assertions search for. Strip. */
const stripComments = (text) =>
  text
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed += 1;
  } catch (error) {
    console.log(`  ✗ ${name}\n    ${error.message}`);
    failed += 1;
  }
}

const article = (over = {}) => ({ title: 'a', date: '2026-01-02', tags: [], ...over });
const video = (over = {}) => ({ title: 'v', publishedAt: '2026-01-01', youtubeTags: [], ...over });

console.log('\nevent & hub coverage matching');

test('a tag match ignores case and punctuation, and nothing else', () => {
  assert.equal(normalizeTag('Marvel Studios'), 'marvel studios');
  assert.equal(normalizeTag('marvel-studios'), 'marvel studios');
  assert.equal(normalizeTag('  MARVEL   STUDIOS '), 'marvel studios');
  assert.equal(normalizeTag('San Diego Comic-Con'), 'san diego comic con');
  assert.equal(normalizeTag(undefined), '');
  assert.equal(normalizeTag(42), '');
  assert.equal(normalizeTag('   '), '');
});

test('a substring is NOT a match', () => {
  /*
    The whole reason the event page is being rewritten. Its matcher was

      a.title?.toLowerCase().includes(tag.toLowerCase())

    which claims any article whose prose happens to contain the run of
    characters. "Marvel" would take every article mentioning Marvel in a
    sentence, and "DC" would take "DCU", "abdication" and "Rockstar's
    DLC" alike.
  */
  const tags = ['dc'];
  assert.equal(matchArticlesByTags([article({ tags: ['DCU'] })], tags).length, 0,
    '"DCU" is a different tag from "DC" and must not match it');
  assert.equal(matchArticlesByTags([article({ title: 'All about DC Comics', tags: [] })], tags).length, 0,
    'prose is not a tag; matching it is what leaked');
  assert.equal(matchArticlesByTags([article({ tags: ['DC'] })], tags).length, 1,
    'the exact tag still matches');
});

test('spacing and punctuation do not split one tag in two, but the year does', () => {
  /*
    ─── THE OWNER'S TAGGING RULE, AS AN ASSERTION ──────────────────────────

    "I will make sure when I tag things for events that I actually put
    SDCC 2026, with or without a space."

    Both spellings have to land on the same event, so matching compares the
    tag with its spaces closed up. Ten of the nineteen events had no keyword
    vocabulary at all until it was hand-seeded, which means each one's
    spelling was typed exactly once: requiring the hub to list every variant
    is a rule that holds until the first time somebody types one of them.

    This is a strict WIDENING of exact matching. The things it must NOT do
    are the two below it: collapse two editions of the same event into one,
    or let a shorter tag swallow a longer one.
  */
  assert.equal(compactTag('SDCC 2026'), 'sdcc2026');
  assert.equal(compactTag('sdcc-2026'), 'sdcc2026');
  assert.equal(compactTag('SDCC2026'), 'sdcc2026');
  assert.equal(compactTag(undefined), '');

  const matches = (hubTag, articleTag) =>
    matchArticlesByTags([article({ tags: [articleTag] })], getHubMatchTags({ coverageTags: [hubTag] })).length === 1;

  assert.ok(matches('SDCC 2026', 'SDCC2026'), 'a missing space must not lose the match');
  assert.ok(matches('SDCC2026', 'SDCC 2026'), 'nor an added one');
  assert.ok(matches('SDCC 2026', 'sdcc-2026'), 'nor a hyphen');

  assert.ok(!matches('SDCC 2026', 'SDCC 2027'),
    'the YEAR is what separates one edition from the next. If this ever passes, every ' +
    'SDCC post lands on every SDCC page.');
  assert.ok(!matches('Marvel', 'Marvel Studios'),
    'closing up spaces must not become substring matching: "marvel" and "marvelstudios" ' +
    'are still different tags');
  assert.ok(!matches('Oscars 2027', 'Oscars'), 'an untagged year cannot pick an edition for itself');
});

test('an article matches on its tags or its category', () => {
  const tags = ['film'];
  assert.equal(matchArticlesByTags([article({ tags: ['Film'] })], tags).length, 1);
  assert.equal(matchArticlesByTags([article({ category: 'Film' })], tags).length, 1);
  assert.equal(matchArticlesByTags([article({ tags: ['TV'], category: 'TV' })], tags).length, 0);
});

test('a video matches on its YouTube tags, its own tags or its category', () => {
  const tags = ['marvel studios'];
  assert.equal(matchVideosByTags([video({ youtubeTags: ['Marvel Studios'] })], tags).length, 1);
  assert.equal(matchVideosByTags([video({ tags: ['marvel studios'] })], tags).length, 1);
  assert.equal(matchVideosByTags([video({ category: 'Marvel Studios' })], tags).length, 1);
  assert.equal(matchVideosByTags([video({ youtubeTags: ['Marvel'] })], tags).length, 0);
});

test('no tags means no match, never everything', () => {
  /*
    A hub with an empty vocabulary is the common case: ten of the nineteen
    shipped events carry no youtubeSyncKeywords at all. `[].some(...)` is
    false, so this holds by construction — but an "optimisation" that treats
    an empty filter as "match all" would silently put the entire catalogue
    on every one of those pages.
  */
  assert.equal(matchArticlesByTags([article({ tags: ['Film'] })], []).length, 0);
  assert.equal(matchVideosByTags([video({ youtubeTags: ['Film'] })], []).length, 0);
});

test('a hub\'s vocabulary is coverageTags plus youtubeSyncKeywords, deduped', () => {
  const tags = getHubMatchTags({
    coverageTags: ['Doomsday', 'Avengers', 'doomsday'],
    youtubeSyncKeywords: ['AVENGERS', 'sdcc-2026', null, 7, '   '],
  });
  assert.deepEqual(tags, ['doomsday', 'avengers', 'sdcc 2026']);

  assert.deepEqual(getHubMatchTags({}), []);
  assert.deepEqual(getHubMatchTags(null), []);
  assert.deepEqual(getHubMatchTags({ coverageTags: 'not-an-array' }), []);
});

test('hub-tagged videos win outright; tag matching is only the fallback', () => {
  /*
    `video.hubs` is the deterministic, editor-controlled path (the sync writes
    it, or a human does in the local CMS). Once anything is hub-tagged, the
    heuristic stops running entirely — otherwise a curated list would quietly
    grow a tail of things nobody chose.
  */
  const hub = { slug: { current: 'sdcc-2026' }, coverageTags: ['Film'] };
  const tagged = video({ title: 'chosen', hubs: ['sdcc-2026'], youtubeTags: [] });
  const merelyMatching = video({ title: 'guessed', youtubeTags: ['Film'] });

  const withTagging = collectHubCoverage({ hub, videos: [tagged, merelyMatching], articles: [] });
  assert.deepEqual(withTagging.items.map((i) => i.title), ['chosen']);

  const withoutTagging = collectHubCoverage({ hub, videos: [merelyMatching], articles: [] });
  assert.deepEqual(withoutTagging.items.map((i) => i.title), ['guessed']);
});

test('articles are always tag-matched, because they have no hubs field', () => {
  /*
    Articles sync from Substack, which knows nothing about this site's hubs.
    Not one of the shipped articles carries a `hubs` array, so there is no
    deterministic path for them and the tag vocabulary is the only path.
  */
  const raw = JSON.parse(readSrc('src', 'data', 'articles.json'));
  const articles = raw.articles || raw.items || raw;
  assert.ok(articles.length > 0, 'the article store must not be empty');
  const withHubs = articles.filter((a) => Array.isArray(a.hubs) && a.hubs.length > 0);
  assert.equal(withHubs.length, 0,
    'an article grew a hubs[] field. If that is deliberate, collectHubCoverage should use it.');
});

test('coverage is newest first across two different date fields', () => {
  /*
    Articles date on `date`, videos on `publishedAt`. The old unified sort
    read `new Date(a.date)` for both, so every video sorted as NaN and the
    order of the video half was whatever the engine did with a comparator
    that returns NaN. Which is: nothing reliable.
  */
  assert.equal(coverageTimestamp({ date: '2026-03-01' }), Date.parse('2026-03-01'));
  assert.equal(coverageTimestamp({ publishedAt: '2026-03-01' }), Date.parse('2026-03-01'));
  assert.equal(coverageTimestamp({}), 0);
  assert.equal(coverageTimestamp({ date: 'not a date' }), 0);

  const hub = { slug: { current: 'x' }, coverageTags: ['Film'] };
  const { items } = collectHubCoverage({
    hub,
    videos: [
      video({ title: 'video-older', youtubeTags: ['Film'], publishedAt: '2026-01-01' }),
      video({ title: 'video-newest', youtubeTags: ['Film'], publishedAt: '2026-05-01' }),
    ],
    articles: [article({ title: 'article-middle', tags: ['Film'], date: '2026-03-01' })],
  });
  assert.deepEqual(items.map((i) => i.title), ['video-newest', 'article-middle', 'video-older']);
});

test('every item is labelled with what it is, or the filter has nothing to read', () => {
  const hub = { slug: { current: 'x' }, coverageTags: ['Film'] };
  const { items, articleCount, videoCount } = collectHubCoverage({
    hub,
    videos: [video({ youtubeTags: ['Film'] })],
    articles: [article({ tags: ['Film'] })],
  });
  assert.deepEqual(items.map((i) => i.contentType).sort(), ['article', 'video']);
  assert.equal(articleCount, 1);
  assert.equal(videoCount, 1);
});

test('one tag list, and it is wired to something', () => {
  /*
    ─── WHY THERE IS ONE FIELD AND NOT TWO ─────────────────────────────────

    This was `youtubeSyncKeywords` (read by the sync) plus `coverageTags`
    (read only by the site). The split was real: widening the sync list
    changes what the YouTube sync pulls into a hub, and widening the site
    list does not.

    It was still the wrong shape. In practice a video and a post about
    SDCC 2026 get tagged the same words, so two fields only ever meant
    typing the same list twice and watching the two drift. They are merged.

    What still has to hold: the one list must actually match something, or
    it is shipped dead the same way the old event-page matcher was, with
    nothing on any page to say so.
  */
  const docs = JSON.parse(readSrc('src', 'data', 'videos.json'));
  const rawArticles = JSON.parse(readSrc('src', 'data', 'articles.json'));
  const articles = rawArticles.articles || rawArticles.items || rawArticles;
  const events = docs.filter((d) => d._type === 'event');
  assert.ok(events.length > 0, 'the event store must not be empty');

  for (const doc of [...events, ...docs.filter((d) => d._type === 'featuredBrand')]) {
    assert.equal(doc.coverageTags, undefined,
      `${doc.slug?.current} still carries coverageTags. The two lists were merged into ` +
        'youtubeSyncKeywords; a second one reintroduces the drift.');
  }

  const tagged = events.filter((e) => getHubMatchTags(e).length > 0);
  assert.equal(tagged.length, events.length,
    'every event needs a tag list, or its page can never show coverage');

  const matching = events.filter((e) => matchArticlesByTags(articles, getHubMatchTags(e)).length > 0);
  assert.ok(matching.length > 0,
    `none of the ${events.length} events matches an article. Tags are compared exactly after ` +
      'normalizing and closing up spaces, so check them against the article tags in the store.');
});

test('every recurring event names its year, now that the sync reads this list', () => {
  /*
    This mattered before and it matters more now. The merged list feeds
    extractHubSeeds(), so a tag without a year does not just pull every
    edition's ARTICLES onto one page, it pulls every edition's VIDEOS into
    one hub during the next sync.

    Premieres are exempt: they happen once, so "AVENGERS DOOMSDAY" is
    already unambiguous and a year would only make it harder to tag.

    TWO-DIGIT EDITIONS COUNT. Attendees and the channel both write "lacc26"
    and "paxwest26", not "lacc2026", and a short year separates one edition
    from the next exactly as well as a long one does: "paxwest26" and
    "paxwest27" are still two different tags to the matcher. What this guard
    is actually hunting is the tag with NO edition in it at all — a bare
    "pax", which claims every PAX that has ever happened.

    The short form has to sit on its own, though. `26` inside `2026` is not a
    second opinion, and a tag like "top 260 games" is not an edition, so the
    two-digit form only counts where it is not glued to another digit.
  */
  const docs = JSON.parse(readSrc('src', 'data', 'videos.json'));
  for (const event of docs.filter((d) => d._type === 'event')) {
    const tags = Array.isArray(event.youtubeSyncKeywords) ? event.youtubeSyncKeywords : [];
    if (tags.length === 0 || event.eventType === 'premiere') continue;
    const year = String(event.startDate ?? '').slice(0, 4);
    assert.match(year, /^\d{4}$/, `${event.slug?.current} has no usable start year`);
    const shortYear = new RegExp(`(?<!\\d)${year.slice(2)}(?!\\d)`);
    for (const tag of tags) {
      const text = String(tag);
      assert.ok(text.includes(year) || shortYear.test(text),
        `${event.slug?.current}: tag "${tag}" names neither ${year} nor ${year.slice(2)}, so it ` +
          'will claim other editions of the same event, on the site AND in the next YouTube sync');
    }
  }
});


test('a named item can be dropped from a hub whatever its tags say', () => {
  /*
    ─── WHY AN OVERRIDE EXISTS AT ALL ──────────────────────────────────────

    Tagging with the year settles almost everything: a post tagged
    "SDCC 2026" belongs to SDCC 2026 and to nothing else. The case it cannot
    settle is a retrospective. A post about SDCC written in 2027, tagged just
    "SDCC", might be about either edition, and nothing in the data says
    which.

    Inferring the edition from the publish date was considered and rejected.
    It reads plausibly (a post before the event is probably a preview) and
    then gets retrospectives backwards, SILENTLY. Wrong coverage on an event
    page is worse than none, because nobody notices it is wrong.

    So the edition comes from the tag, and when a loose tag pulls in
    something it should not, the item is named here.
  */
  const hub = {
    slug: { current: 'sdcc-2026' },
    youtubeSyncKeywords: ['SDCC'],
    excludeCoverage: ['retrospective-post'],
  };
  const keep = article({ title: 'keep', tags: ['SDCC'], slug: 'preview-post' });
  const drop = article({ title: 'drop', tags: ['SDCC'], slug: 'retrospective-post' });

  const { items } = collectHubCoverage({ hub, videos: [], articles: [keep, drop] });
  assert.deepEqual(items.map((i) => i.title), ['keep']);

  /* Without the list, both are coverage — so the list is what did the work. */
  const unfiltered = collectHubCoverage({
    hub: { slug: { current: 'sdcc-2026' }, youtubeSyncKeywords: ['SDCC'] },
    videos: [],
    articles: [keep, drop],
  });
  assert.equal(unfiltered.items.length, 2);
});

test('the override reaches hub-TAGGED videos too, not just matched ones', () => {
  /*
    A curated list carries a mistake as easily as a heuristic does, and an
    editor reaching for the override should not have to know which code path
    put the item on the page.
  */
  const hub = {
    slug: { current: 'sdcc-2026' },
    youtubeSyncKeywords: ['SDCC'],
    excludeCoverage: ['MOCKID123'],
  };
  const tagged = video({ title: 'hand-picked', hubs: ['sdcc-2026'], youtubeId: 'mockid123' });
  const { items } = collectHubCoverage({ hub, videos: [tagged], articles: [] });
  assert.equal(items.length, 0, 'a hub-tagged video must still be droppable, and case must not matter');
});

test('an item can be named by any of the handles an editor might be looking at', () => {
  assert.deepEqual(coverageIdentity({ slug: 'a-post' }), ['a-post']);
  assert.deepEqual(coverageIdentity({ slug: { current: 'a-video' } }), ['a-video']);
  assert.deepEqual(coverageIdentity({ guid: 'G1', youtubeId: 'Y1', _id: 'D1' }), ['g1', 'y1', 'd1']);
  assert.deepEqual(coverageIdentity({}), []);
  assert.deepEqual(coverageIdentity({ slug: '   ' }), [], 'whitespace is not an identity');
});

test('an article finds the hub it is most ABOUT, not the first one that matches', () => {
  /*
    ─── THE INVERSE QUESTION ───────────────────────────────────────────────

    collectHubCoverage answers "what belongs to this hub". An article page
    needs "which hub does this belong to", so it can show the Official
    Streamer / Studio / Franchise Hub card that event pages carry. An event
    is TOLD which brand it belongs to (relatedBrandSlug, set in the CMS); an
    article syncs from Substack and has no such field, so it is inferred.

    Pieces routinely match more than one hub. The shipped Spider-Man review
    carries "Marvel Studios", "MCU", "Marvel" AND "Sony Pictures", and
    first-match would hand it to whichever hub happened to sort first in the
    store. Counting matched tags picks the one the piece is most about.
  */
  const marvel = { slug: { current: 'marvel-comics' }, youtubeSyncKeywords: ['Marvel', 'MCU', 'Marvel Studios'] };
  const sony = { slug: { current: 'sony-pictures' }, youtubeSyncKeywords: ['Sony Pictures'] };

  const spiderMan = article({ tags: ['Marvel Studios', 'MCU', 'Marvel', 'Sony Pictures'] });
  assert.equal(findHubForItem(spiderMan, [sony, marvel])?.slug.current, 'marvel-comics');
  assert.equal(findHubForItem(spiderMan, [marvel, sony])?.slug.current, 'marvel-comics',
    'and the answer must not depend on the order the hubs arrive in');

  const sonyOnly = article({ tags: ['Sony Pictures'] });
  assert.equal(findHubForItem(sonyOnly, [sony, marvel])?.slug.current, 'sony-pictures');

  assert.equal(findHubForItem(article({ tags: ['Consumer Rights'] }), [sony, marvel]), null,
    'a piece about the industry rather than a brand has no hub, and the card just does not render');
});

test('a pin beats the score, which is the whole point of it', () => {
  /*
    ─── THE CASE SCORING GETS WRONG BY DESIGN ──────────────────────────────

    "A Generational Leap: Did Rockstar and Netflix Just Set a New Industry
    Standard?" is tagged Netflix, Gaming, PlayStation, GTA VI, Video Games,
    Xbox. It scores to Netflix, because Netflix's vocabulary lists five
    variants and PlayStation's four: Netflix wins on the SIZE of its keyword
    list, not on being what the piece is about.

    Tuning the scoring would trade this case for a different one. Naming the
    piece on the hub you want cannot be outvoted by anything.
  */
  const netflix = { slug: { current: 'netflix' }, youtubeSyncKeywords: ['Netflix', 'Netflix Film', 'Netflix Movie'] };
  const playstation = { slug: { current: 'playstation' }, youtubeSyncKeywords: ['PlayStation'], pinnedCoverage: ['gta-piece'] };
  const piece = article({ slug: 'gta-piece', tags: ['Netflix', 'Netflix Film', 'Netflix Movie', 'PlayStation'] });

  assert.equal(findHubForItem(piece, [netflix, playstation])?.slug.current, 'playstation',
    'a pin must beat a hub that matched three times as many tags');
  assert.equal(findHubForItem(piece, [playstation, netflix])?.slug.current, 'playstation',
    'and must not depend on the order the hubs arrive in');

  /* Without the pin, the scoring answer stands. */
  const unpinned = { slug: { current: 'playstation' }, youtubeSyncKeywords: ['PlayStation'] };
  assert.equal(findHubForItem(piece, [netflix, unpinned])?.slug.current, 'netflix');
});

test('a pin puts the item in that hub\'s coverage too', () => {
  /*
    "This article belongs to this hub" has to mean both things, or the
    override is half an answer: the card would appear on the article while
    the article stayed missing from the hub it points at.
  */
  const hub = { slug: { current: 'playstation' }, youtubeSyncKeywords: ['PlayStation'], pinnedCoverage: ['gta-piece'] };
  const piece = article({ slug: 'gta-piece', title: 'pinned', tags: ['Netflix'] });
  const onTags = article({ slug: 'other', title: 'tagged', tags: ['PlayStation'] });

  const { items } = collectHubCoverage({ hub, videos: [], articles: [piece, onTags] });
  assert.deepEqual(items.map((i) => i.title).sort(), ['pinned', 'tagged']);

  /* And it is not double-counted when it ALSO matches on tags. */
  const both = article({ slug: 'gta-piece', title: 'pinned', tags: ['PlayStation'] });
  const dedup = collectHubCoverage({ hub, videos: [], articles: [both] });
  assert.equal(dedup.items.length, 1, 'an item that is pinned AND tagged appears once');
});

test('exclude beats pin, because exclude is how you undo a mistake', () => {
  const hub = {
    slug: { current: 'playstation' },
    youtubeSyncKeywords: ['PlayStation'],
    pinnedCoverage: ['gta-piece'],
    excludeCoverage: ['gta-piece'],
  };
  const piece = article({ slug: 'gta-piece', tags: ['Netflix'] });
  assert.equal(collectHubCoverage({ hub, videos: [], articles: [piece] }).items.length, 0);
});

test('a tie breaks the same way on every build', () => {
  /*
    A build that reorders a card between runs for no reason is its own bug,
    and it is the kind that only shows up as a mystery diff.
  */
  const a = { slug: { current: 'aaa' }, youtubeSyncKeywords: ['Shared'] };
  const z = { slug: { current: 'zzz' }, youtubeSyncKeywords: ['Shared'] };
  const item = article({ tags: ['Shared'] });
  assert.equal(findHubForItem(item, [a, z])?.slug.current, 'aaa');
  assert.equal(findHubForItem(item, [z, a])?.slug.current, 'aaa');
});

test('a hub cannot win by listing the same keyword twice', () => {
  /*
    getHubMatchTags dedupes case- and punctuation-insensitively, and the
    score is built from that deduped list, so a hub that writes "Netflix",
    "netflix" and "NETFLIX" into its one box still counts Netflix once.

    This guarded against padding ACROSS the two fields when there were two.
    There is one now, but the property it asserts is the one that made
    merging them safe in the first place, so it stays: a hub wins on how
    much of the piece it matches, never on how long its list is.
  */
  const padded = {
    slug: { current: 'padded' },
    youtubeSyncKeywords: ['Netflix', 'netflix', 'NETFLIX', 'net-flix'],
  };
  const honest = { slug: { current: 'honest' }, youtubeSyncKeywords: ['Netflix', 'Netflix Film'] };
  const item = article({ tags: ['Netflix', 'Netflix Film'] });
  assert.equal(findHubForItem(item, [padded, honest])?.slug.current, 'honest');
});

test('every shipped article resolves to at most one hub, and most resolve to one', () => {
  const docs = JSON.parse(readSrc('src', 'data', 'videos.json'));
  const brands = docs.filter((d) => d._type === 'featuredBrand');
  const raw = JSON.parse(readSrc('src', 'data', 'articles.json'));
  const articles = raw.articles || raw.items || raw;

  const matched = articles.filter((a) => findHubForItem(a, brands) !== null);
  assert.ok(matched.length > articles.length / 2,
    `only ${matched.length} of ${articles.length} articles resolve to a hub. The card is the ` +
      'main reason an article page links onward, so a sharp drop here means the brand ' +
      'vocabularies have drifted from how posts are actually tagged.');
});

console.log('\nthe six-item cap and its overflow feed');

test('the cap is six, and the feed pages twelve', () => {
  /*
    Six matches the "Past Event Archive" cap on /events, twelve matches
    /intel, /feed and /events/archive. Both numbers are shared constants so
    the two ends of the same journey cannot drift apart.
  */
  assert.equal(COVERAGE_PAGE_LIMIT, 6);
  assert.equal(COVERAGE_FEED_PAGE_SIZE, 12);
});

test('the event page shows at most six, and counts the rest', () => {
  const page = stripComments(readSrc('src', 'pages', 'events', '[slug].astro'));

  assert.match(page, /const unifiedContent = coverage\.items\.slice\(0, COVERAGE_PAGE_LIMIT\)/,
    'the grid must be capped by the shared constant, not by a number typed here');
  assert.match(page, /const coverageTotal = coverage\.items\.length/,
    'the page must know the true total, or the overflow link cannot say how many are behind it');
  assert.match(page, /const coverageHref = `\/events\/\$\{event\.slug\?\.current\}\/coverage`/,
    'the overflow link must point at the per-event feed route');
});

test('the overflow link appears only when something is behind it', () => {
  for (const rel of ['EventAnnouncement.astro', 'EventFeatured.astro']) {
    const code = stripComments(readSrc('src', 'components', rel));
    assert.match(code, /\{coverageTotal > unifiedContent\.length && \(/,
      `${rel} must gate the "All coverage" link on there actually being more. A link to a ` +
        'page showing the same six items is a dead end with extra steps.');
    assert.match(code, /href=\{coverageHref\}/, `${rel} must use the href the page computed`);
  }
});

test('the overflow route exists, and is generated only where there is coverage', () => {
  const rel = join('src', 'pages', 'events', '[slug]', 'coverage', '[...page].astro');
  assert.ok(existsSync(join(here, '..', rel)), `${rel} is missing; every "All coverage" link 404s`);

  const route = stripComments(readSrc(rel));
  assert.match(route, /if \(items\.length === 0\) return \[\]/,
    'an event with no coverage must not build an empty, indexable page');
  assert.match(route, /pageSize: COVERAGE_FEED_PAGE_SIZE/,
    'the feed must page at the shared size');
  assert.match(route, /collectHubCoverage\(/,
    'the feed must list what the event page capped, via the same matcher');
  assert.match(route, /params: \{ slug \}/,
    'each event needs its own coverage feed, not one shared route');
});

console.log('\none matcher, two callers');

test('neither page hand-rolls its own matching any more', () => {
  const pages = [
    ['events/[slug].astro', join('src', 'pages', 'events', '[slug].astro')],
    ['featured/[slug].astro', join('src', 'pages', 'featured', '[slug].astro')],
  ];
  for (const [label, rel] of pages) {
    const code = stripComments(readSrc(rel));
    assert.match(code, /collectHubCoverage\(\{/, `${label} must use the shared matcher`);
    assert.ok(
      !/\.toLowerCase\(\)\.includes\(/.test(code),
      `${label} is substring-matching again. That is the leak: it claims any item whose prose ` +
        'happens to contain the tag, and it is why event pages showed zero articles.',
    );
  }
});

test('shorts and live streams are excluded at every call site, visibly', () => {
  /*
    The hub page always excluded them; the event page merged them in. One had
    to give, and the coverage grid is the long-form reading list. The
    exclusion lives at the CALL SITE rather than inside collectHubCoverage so
    it stays a visible decision — and so the overflow feed cannot quietly
    list something the page it overflows from would not have shown.
  */
  const sites = [
    ['featured/[slug].astro', join('src', 'pages', 'featured', '[slug].astro')],
    ['events/[slug].astro', join('src', 'pages', 'events', '[slug].astro')],
    ['events/[slug]/coverage/[...page].astro',
      join('src', 'pages', 'events', '[slug]', 'coverage', '[...page].astro')],
  ];

  /*
    The event page and its overflow feed MUST build the same list, or page 2
    of the feed starts in the wrong place: the page slices the first six off
    a set the feed then re-derives. Identical inputs is the only thing
    keeping those two derivations in step.
  */
  for (const [label, rel] of sites) {
    const code = stripComments(readSrc(rel));
    assert.match(code, /!v\.isShort && !v\.isLive/,
      `${label} must filter shorts and live streams out before matching`);
  }

  const eventPage = stripComments(readSrc('src', 'pages', 'events', '[slug].astro'));
  assert.ok(
    !/getShortsUnified|getLiveStreamsUnified/.test(eventPage),
    'the event page is merging shorts and live streams into coverage again, which is the ' +
      'inconsistency with /featured/[slug] this replaced',
  );
});

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
