/**
 * THE CONTENT CATEGORY TAXONOMY, PINNED.
 *
 * THE FAILURE THIS EXISTS FOR — issue #146, renaming `Gaming` to `Games`.
 *
 * The category label is three things at once: the badge on a card, the slug in
 * /category/<slug>, and the value stored on every article record. What it is
 * NOT is the thing content is tagged with. An article carries the tags its
 * Substack post was published with; a video carries the topic slugs the
 * YouTube sync derived. Both of those say "gaming" and will keep saying it,
 * because a rename in this repo cannot reach back into Substack or YouTube.
 *
 * So comparing the renamed label against a tag literally builds /category/games
 * with nothing in it, and NOTHING REPORTS THAT. The route's getStaticPaths
 * succeeds, the page renders its own empty state, and the result reads like a
 * content problem rather than a taxonomy one. There is no error in the build
 * log, no failing type, and no visual difference from a category that is
 * genuinely quiet that week.
 *
 * WHAT THIS TEST CAN AND CANNOT DO
 * It reads the snapshots and the route source, not a served page. It cannot
 * prove Cloudflare serves the 301s. What it CAN do is fail the moment a
 * category is renamed again without its alias, or a stored record is left
 * pointing at a category name that no longer exists.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CATEGORIES,
  CATEGORY_TAG_ALIASES,
  categoryTagAliases,
  tagMatchesCategory,
} from '../src/data/constants.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const read = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf-8');
const readJson = (rel) => JSON.parse(read(rel));

/*
  src/data/categories.js imports .PNG files, so plain node cannot load it the
  way it loads constants.js. The slug/label pairs are read out of the source
  instead. That is weaker than importing the module, so the count is asserted
  too: a parse that silently found nothing would otherwise pass every loop
  below by iterating over an empty list.
*/
const pillars = [...read('src/data/categories.js').matchAll(/slug: '([^']+)',\s*\n\s*label: '([^']+)',/g)]
  .map(([, slug, label]) => ({ slug, label }));

assert.equal(
  pillars.length,
  4,
  `parsed ${pillars.length} pillars out of src/data/categories.js, expected 4. The shape of that file changed and this test is no longer reading it.`,
);

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`  FAIL ${name}`);
    console.error(`       ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log('category-taxonomy');

test('the renamed category is Games, and Gaming is gone from the canonical list', () => {
  assert.ok(CATEGORIES.includes('Games'), 'CATEGORIES no longer contains Games');
  assert.ok(!CATEGORIES.includes('Gaming'), 'CATEGORIES still contains the pre-#146 name');
});

/*
  The pillar's slug IS its label lowercased, because QuadrantFilter builds its
  hrefs that way (`c.toLowerCase()`) while Categories.astro and the route use
  `cat.slug`. If those two ever disagree, the homepage tile and the filter chip
  point at different URLs and one of them 404s.
*/
test('every pillar slug is exactly its label lowercased', () => {
  for (const pillar of pillars) {
    assert.equal(
      pillar.slug,
      pillar.label.toLowerCase(),
      `${pillar.label} has slug "${pillar.slug}". QuadrantFilter derives its href from the label, the route from the slug; they must agree.`,
    );
  }
});

test('every pillar has an alias entry', () => {
  for (const pillar of pillars) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(CATEGORY_TAG_ALIASES, pillar.slug),
      `${pillar.slug} has no entry in CATEGORY_TAG_ALIASES. Without one it matches only tags spelled exactly like the slug.`,
    );
    assert.ok(
      categoryTagAliases(pillar.slug).includes(pillar.slug),
      `${pillar.slug} is missing from its own alias list`,
    );
  }
});

test('the pre-rename tag spelling still resolves (this is the whole point)', () => {
  assert.ok(tagMatchesCategory('games', 'Gaming'), 'a post tagged Gaming no longer reaches /category/games');
  assert.ok(tagMatchesCategory('games', 'gaming'), 'lowercase gaming no longer reaches /category/games');
  assert.ok(tagMatchesCategory('events', 'event'), 'the singular Event tag regressed');
  assert.ok(!tagMatchesCategory('film', 'gaming'), 'aliases are leaking across categories');
});

/*
  ─── THE ONE THAT WOULD HAVE CAUGHT IT ──────────────────────────────────────

  Shaped the way src/pages/category/[category]/[...page].astro shapes it: an
  article's `tags`, a video's `topics`. The route is pinned separately below so
  this cannot drift into testing a shape the route stopped using.
*/
const articles = readJson('src/data/articles.json');
const media = readJson('src/data/videos.json');

function tagPool() {
  const pool = [];
  for (const record of articles) {
    if (!record || record.editorial?.hidden) continue;
    pool.push(Array.isArray(record.tags) ? record.tags : [record.category || 'general']);
  }
  for (const doc of media) {
    const effectiveType = doc?.manualTypeOverride || doc?._type;
    if (effectiveType !== 'video') continue;
    pool.push((doc.topics ?? []).map(String));
  }
  return pool;
}

test('no browsable category resolves to an empty page', () => {
  const pool = tagPool();
  for (const pillar of pillars) {
    const matches = pool.filter((tags) => tags.some((t) => tagMatchesCategory(pillar.slug, t)));
    assert.ok(
      matches.length > 0,
      `/category/${pillar.slug} matches nothing in the snapshots. Either the alias for "${pillar.slug}" is missing, or the content really is empty — check src/data/constants.js first, because a missing alias looks exactly like this.`,
    );
  }
});

test('no stored article is stranded in a category that no longer exists', () => {
  const stranded = articles
    .filter((r) => r?.category && !CATEGORIES.includes(r.category))
    .map((r) => `${r.slug}: ${r.category}`);
  assert.deepEqual(
    stranded,
    [],
    `These records carry a category that is not in CATEGORIES, so they will never appear under any filter:\n  ${stranded.join('\n  ')}`,
  );
});

/*
  ─── THE SYNC CAN QUIETLY UNDO THE RENAME ────────────────────────────────────

  Caught on a real merge. While this branch sat open, the scheduled YouTube
  sync ran twice on main and rewrote videos.json from a tree that predates the
  rename, so main's copy of the `topic-gaming` document still said
  "Gaming". Merging main in resolved that field back to the old value.

  It resolved silently because the merge driver classifies `title` as FACTUAL
  (a YouTube fact, synced every run, newer copy wins) — which is right for a
  video document and wrong for a TOPIC document, whose title is our own
  taxonomy label seeded by TIER1_TOPIC_SEEDS in scripts/sync-youtube.mjs. The
  driver does not distinguish the two, so the newer side won on a field no
  sync should have opinions about.

  Nothing a visitor sees was affected: the site derives its category label from
  the topic SLUG through SITE_CATEGORIES in src/lib/videos.ts, and the topic
  title is read only by the dev-only Local CMS. It also self-corrects on the
  first sync run after the merge, because the seed now says Games. But
  "invisible and self-correcting eventually" is exactly how a value flip-flops
  for weeks without anyone noticing, so it is pinned here instead.
*/
test('the sync has not reverted the topic document title', () => {
  const topic = media.find((d) => d?._id === 'topic-gaming');
  assert.ok(topic, 'the topic-gaming document is gone from the snapshot');
  assert.equal(
    topic.title,
    'Games',
    'the topic title is back to the pre-rename value. A sync running from a tree without the ' +
      'rename wrote it, and the merge driver treats `title` as a YouTube fact even on a topic ' +
      'document, whose title is ours. Fix the snapshot; the seed in scripts/sync-youtube.mjs ' +
      'already says Games, so it will hold.',
  );
  assert.equal(topic.slug?.current, 'gaming', 'the topic SLUG must not move — URLs and tags depend on it');
});

test('the category route still matches through the alias map', () => {
  const route = read('src/pages/category/[category]/[...page].astro');
  assert.match(
    route,
    /tagMatchesCategory\(cat\.slug, t\)/,
    'the route stopped using tagMatchesCategory. Comparing the label to a tag directly is what empties a renamed category silently.',
  );
});

test('the card filter attribute is alias-expanded, not raw tags', () => {
  const card = read('src/components/ContentCard.astro');
  assert.match(
    card,
    /'data-categories': filterAttr,/,
    'data-categories went back to raw tags. The Feed #hash filter reads this attribute, so the renamed slug would match nothing.',
  );
  assert.ok(
    !/'data-categories': lowerTags\.join/.test(card),
    'a raw-tag data-categories is still present on one of the two card wrappers',
  );
});

/*
  ─── AND THE URLs THE RENAME MOVED ──────────────────────────────────────────

  Both were generated from the category list and both were in the sitemap.
  /category/gaming is additionally a URL Search Console already holds for this
  site — see the incident note at the top of scripts/seo-routing.test.mjs.
  That test enforces the general rule (nothing redirected is advertised); this
  one pins the specific pair, so deleting them is a deliberate act.
*/
test('both renamed URLs still forward', () => {
  const config = read('astro.config.mjs');
  for (const [from, to] of [
    ['/category/gaming', '/category/games'],
    ['/intel/topic/gaming', '/intel/topic/games'],
  ]) {
    assert.ok(
      config.includes(`'${from}': '${to}'`),
      `${from} no longer redirects to ${to}. Removing it turns a URL Google already knows into a 404.`,
    );
  }
});

test('the legacy /feed/gaming redirect does not chain through the old slug', () => {
  const config = read('astro.config.mjs');
  assert.ok(
    config.includes("'/feed/gaming': '/category/games'"),
    '/feed/gaming points at /category/gaming, which itself redirects. That is a two-hop chain for every crawler that follows it.',
  );
});

if (failures > 0) {
  console.error(`\ncategory-taxonomy: ${failures} failing`);
  process.exit(1);
}
console.log('category-taxonomy: all passing\n');
