/*
  WHICH INSTAGRAM POSTS REACH THE HOMEPAGE CAROUSEL.

  THE RULE, from the owner: "we only want front facing instagram posts to
  appear in the instagram feed carousel — if it's not present on my feed then
  it should not appear."

  A reel can be published to the Reels tab without going onto the profile
  feed. Nothing in the stored shape could tell those apart — every reel has a
  `/reel/` permalink and `media_type: VIDEO` either way, and 41 of the 50
  posts in the feed are reels — so the sync now records the Graph API's
  `is_shared_to_feed` and src/lib/instagram-visibility.ts decides on it.

  TWO REQUIREMENTS THAT PULL IN OPPOSITE DIRECTIONS:

    1. a reels-tab-only post must not render;
    2. the carousel must never end up empty by ACCIDENT. CinematicGallery is
       wrapped in `{items.length > 0 && (…)}`, so an empty list does not thin
       the rail — it removes the whole section from the homepage. Every
       "unknown" case has to fall on the side of showing the post.

  The rule is exercised directly, with real inputs. That is the reason it
  lives in its own import-free module: src/lib/instagram.ts imports JSON
  statically and cannot be loaded by plain `node`, so a rule kept there could
  only ever be asserted by matching source text — which is how a guard starts
  passing while proving nothing.
*/
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isOnProfileFeed,
  permalinkShortcode,
  selectVisiblePosts,
  toShortcodeSet,
} from '../src/lib/instagram-visibility.ts';

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

const sync = fs.readFileSync(path.join(ROOT, 'scripts/sync-instagram.mjs'), 'utf8');
const excluded = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/data/instagram-excluded.json'), 'utf8')
);
const feed = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/instagram.json'), 'utf8'));

/** A post as the sync stores it, with only what the rule looks at. */
const post = (code, isSharedToFeed) => ({
  permalink: `https://www.instagram.com/reel/${code}/`,
  ...(isSharedToFeed === undefined ? {} : { isSharedToFeed }),
});

console.log('Instagram feed visibility:');

/* ─── the shortcode parser, which the manual list is keyed on ─────────────── */

test('a shortcode is read from /reel/, /reels/, /p/ and /tv/ permalinks', () => {
  assert.equal(permalinkShortcode('https://www.instagram.com/reel/DcBzZENuTrU/'), 'DcBzZENuTrU');
  assert.equal(permalinkShortcode('https://www.instagram.com/reels/AbC/'), 'AbC');
  assert.equal(permalinkShortcode('https://www.instagram.com/p/ABC123xyz/'), 'ABC123xyz');
  assert.equal(permalinkShortcode('https://www.instagram.com/tv/XyZ/'), 'XyZ');
  assert.equal(permalinkShortcode('https://www.instagram.com/reel/DcBzZENuTrU'), 'DcBzZENuTrU');
});

test('the share suffix Copy link adds is not part of the shortcode', () => {
  assert.equal(
    permalinkShortcode('https://www.instagram.com/reel/DcBzZENuTrU/?igsh=MXY5NmZ4'),
    'DcBzZENuTrU',
    'Copy link produces ?igsh=… — if that ended up in the code, nothing would match',
  );
});

test('an unparseable permalink yields no shortcode rather than a wrong one', () => {
  for (const bad of ['', undefined, null, 'https://instagram.com/', 'not a url', 42]) {
    assert.equal(permalinkShortcode(bad), '', `expected '' for ${JSON.stringify(bad)}`);
  }
});

/* ─── the automatic rule ──────────────────────────────────────────────────── */

test('a reels-tab-only post is hidden', () => {
  assert.equal(isOnProfileFeed({ isSharedToFeed: false }), false);
  const out = selectVisiblePosts([post('keep', true), post('hide', false)]);
  assert.deepEqual(out.map((p) => permalinkShortcode(p.permalink)), ['keep']);
});

test('a post shared to the feed is kept', () => {
  assert.equal(isOnProfileFeed({ isSharedToFeed: true }), true);
});

test('an UNKNOWN visibility is kept, not hidden', () => {
  assert.equal(isOnProfileFeed({}), true, 'a record with no field at all must render');
  assert.equal(isOnProfileFeed({ isSharedToFeed: undefined }), true);
  const out = selectVisiblePosts([post('a'), post('b'), post('c')]);
  assert.equal(
    out.length,
    3,
    'No stored record carries this field until a sync runs with the new fields.\n' +
      '      If unknown meant hidden, the homepage would lose its Instagram section\n' +
      '      the moment this shipped and stay that way until the next sync.',
  );
});

/*
  ─── AGAINST THE REAL STORED FEED ───────────────────────────────────────────

  An earlier version of this block asserted that the whole stored feed renders,
  on the reasoning that no record carried `isSharedToFeed` yet. That was a
  SNAPSHOT, not an invariant: it described the data on the day it was written
  and was guaranteed to fail the first time a sync populated the field and the
  feature did its job. It duly did — 47 of 50, with 3 reels-tab-only posts
  correctly hidden — and reported working code as a failure.

  What follows asserts the properties that stay true whatever the feed
  contains: nothing is hidden except for a stated reason, and a post the API
  said nothing about is never hidden.
*/
test('every post the API said nothing about still renders', () => {
  /* THE safety property. `is_shared_to_feed` is a reels-only field, so albums
     and images never carry it — 9 of the 50 today. If "unknown" were ever
     treated as "hidden", every non-reel would silently vanish from the rail. */
  const unknown = feed.filter((p) => typeof p.isSharedToFeed !== 'boolean');
  const shown = new Set(selectVisiblePosts(feed).map((p) => p.id));
  const dropped = unknown.filter((p) => !shown.has(p.id));
  assert.deepEqual(
    dropped.map((p) => p.permalink),
    [],
    `${dropped.length} post(s) with no isSharedToFeed were filtered out. Unknown\n` +
      '      must always mean visible.',
  );
});

test('nothing is filtered except for a stated reason', () => {
  /* The complement of the test above: not just "the right ones survive" but
     "no others were removed". A filter that quietly drops posts for some
     unrelated reason would otherwise pass unnoticed. */
  const excludedSet = toShortcodeSet(excluded.shortcodes);
  const expected = feed.filter(
    (p) =>
      p.isSharedToFeed !== false &&
      !excludedSet.has(permalinkShortcode(p.permalink))
  );
  const actual = selectVisiblePosts(feed, excludedSet);
  assert.deepEqual(
    actual.map((p) => p.id),
    expected.map((p) => p.id),
    'the rendered set must be exactly: everything minus reels-tab-only posts\n' +
      '      minus manual exclusions — same posts, same order.',
  );
});

test('the real stored feed still fills the rail', () => {
  /* A floor on the outcome rather than an exact count: the rail holds ten
     tiles, and the point of the whole feature is that it keeps showing
     content while hiding the posts that do not belong on the feed. */
  const out = selectVisiblePosts(feed, toShortcodeSet(excluded.shortcodes));
  const hidden = feed.length - out.length;
  assert.ok(
    out.length >= 10,
    `only ${out.length} of ${feed.length} posts would render (${hidden} hidden).\n` +
      '      The carousel shows ten tiles, so this is no longer enough to fill it —\n' +
      '      check whether is_shared_to_feed is being reported as expected.',
  );
});

/* ─── the floor: an accident must not delete the rail ─────────────────────── */

test('if EVERY post is reels-tab-only, the rail falls back to showing them', () => {
  const all = [post('a', false), post('b', false), post('c', false)];
  const out = selectVisiblePosts(all);
  assert.equal(
    out.length,
    3,
    'CinematicGallery renders nothing for an empty list, so this case would\n' +
      '      delete the whole homepage section rather than shorten it. A rail showing\n' +
      '      too much is cosmetic; a missing rail is a broken page.',
  );
});

test('a partial filter is NOT floored — it just shows fewer', () => {
  const out = selectVisiblePosts([post('a', false), post('b', true), post('c', false)]);
  assert.deepEqual(
    out.map((p) => permalinkShortcode(p.permalink)),
    ['b'],
    'the floor must only engage at zero, or the feature never takes effect',
  );
});

test('an empty or malformed feed does not throw', () => {
  assert.deepEqual(selectVisiblePosts([]), []);
  assert.deepEqual(selectVisiblePosts(null), []);
  assert.deepEqual(selectVisiblePosts(undefined), []);
});

/* ─── the manual list ─────────────────────────────────────────────────────── */

test('an excluded shortcode is removed', () => {
  const out = selectVisiblePosts(
    [post('keep', true), post('drop', true)],
    toShortcodeSet(['drop'])
  );
  assert.deepEqual(out.map((p) => permalinkShortcode(p.permalink)), ['keep']);
});

test('manual exclusions are honoured even down to zero', () => {
  /* Unlike the automatic rule, this is an explicit decision — not a
     malfunction to protect the page from. */
  const out = selectVisiblePosts([post('a', true)], toShortcodeSet(['a']));
  assert.deepEqual(out, [], 'an explicit choice to hide everything must be obeyed');
});

test('a pasted full URL still matches, instead of silently never matching', () => {
  const set = toShortcodeSet(['https://www.instagram.com/reel/DcBzZENuTrU/?igsh=x']);
  assert.ok(set.has('DcBzZENuTrU'), 'the likeliest paste mistake should just work');
});

test('a post with an unparseable permalink is not hidden by a blank entry', () => {
  const set = toShortcodeSet(['', '   ', 'real']);
  assert.ok(!set.has(''), 'blank entries must be dropped from the set');
  const out = selectVisiblePosts([{ permalink: 'nonsense', isSharedToFeed: true }], set);
  assert.equal(out.length, 1, 'a post whose shortcode is "" must never match an exclusion');
});

test('the shipped exclusion file has the shape the code reads', () => {
  assert.ok(Array.isArray(excluded.shortcodes), 'shortcodes must be an array');
  for (const code of excluded.shortcodes) {
    assert.equal(typeof code, 'string', `${JSON.stringify(code)} is not a string`);
  }
});

test('the sync never writes the exclusion file', () => {
  assert.ok(
    !/instagram-excluded/.test(sync),
    'src/data/instagram-excluded.json must be invisible to the sync. It runs four\n' +
      '      times a day and overwrites src/data/instagram.json wholesale; anything it\n' +
      '      touches is not a durable place to record an editorial decision.',
  );
});

/* ─── what the sync must provide for any of this to work ──────────────────── */

test('the sync requests the field the filter depends on', () => {
  assert.ok(
    /is_shared_to_feed/.test(sync),
    'sync-instagram.mjs must request is_shared_to_feed, or isSharedToFeed is never\n' +
      '      populated and the whole filter is permanently inert.',
  );
  assert.ok(
    /typeof item\.is_shared_to_feed === 'boolean'/.test(sync),
    'the stored value must come from a boolean check, so a missing field stays\n' +
      '      undefined rather than becoming false and hiding the post.',
  );
});

test('a rejected optional field degrades instead of failing the sync', () => {
  assert.ok(
    /Retrying without them/.test(sync) && /mediaUrl\(BASE_FIELDS\)/.test(sync),
    'an unrecognised field is a 400 for the WHOLE request. The sync must retry with\n' +
      '      the base fields, so a schedule that works today cannot be broken by an\n' +
      '      enhancement — it simply does not filter that run.',
  );
});

test('--refresh-media forces a refetch of covers already on disk', () => {
  assert.ok(
    /--refresh-media/.test(sync),
    'the flag must exist: a reel cover CAN be changed after publishing, and the\n' +
      '      "already downloaded" shortcut otherwise pins the original forever. That is\n' +
      '      how a reel published without a cover stayed a near-black tile.',
  );
  assert.ok(
    /const existing = forceRefresh \? undefined : existingByIchId\?\.get\(String\(id\)\)/.test(sync),
    'the flag has to bypass the on-disk lookup itself — anything else still returns\n' +
      '      the stale file.',
  );
  assert.ok(
    !/const forceRefresh = true/.test(sync),
    'it must stay opt-in: refetching 50 covers on every scheduled run is 200\n' +
      '      needless downloads a day.',
  );
});

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
