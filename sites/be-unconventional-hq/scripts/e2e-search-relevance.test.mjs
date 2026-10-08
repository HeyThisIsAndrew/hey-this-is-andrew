/*
  ─── SEARCH RELEVANCE ───────────────────────────────────────────────────────

  THIS IS AN `e2e-*` SUITE BECAUSE IT READS BUILD OUTPUT, NOT SOURCE.

  It asserts against `dist/client/api/search-index.json`, which only exists
  after `astro build`. It shipped named `search-relevance.test.mjs` and wired
  into `npm test` AHEAD of every other suite, where it did not merely fail: the
  `npm test` chain is joined by `&&`, so its `process.exit(1)` on a missing
  index took all thirty offline suites down with it and CI's `test-and-build`
  job never got past the first line. `npm test` is contractually the offline
  unit suite (see CLAUDE.md) and cannot depend on a build.

  As an `e2e-*` file it is auto-discovered by scripts/e2e-run.mjs, which CI runs
  in the job that has already produced `dist/`.
*/
import fs from 'fs';
import path from 'path';
import test from 'node:test';
import assert from 'node:assert';
import Fuse from 'fuse.js';

const indexPath = path.resolve('dist/client/api/search-index.json');
if (!fs.existsSync(indexPath)) {
  console.error("search-index.json not found. Run 'npm run build' first.");
  process.exit(1);
}

const searchData = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
const indexedIds = new Set(searchData.map((d) => d.id));

/*
  Punctuation-insensitive comparison, so "spider-man" matches "Spider-Man" and
  the curly apostrophe in "Gunn's" cannot fail a word it does not appear in.
  Anything that is not a letter or a digit becomes a space.
*/
const normalise = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const tokenise = (value) => normalise(value).split(' ').filter(Boolean);

const fuse = new Fuse(searchData, {
  keys: [
    { name: 'title', weight: 2 },
    { name: 'tags', weight: 1 },
    { name: 'type', weight: 0.5 }
  ],
  threshold: 0.4,
  ignoreLocation: true,
});

test('Search Relevance', async (t) => {
  const queries = [
    // Branded Hubs (Priority 1 matches)
    { query: 'netflix', expectedTopId: 'netflix', expectedType: 'hub' },
    { query: 'marvel', expectedTopId: 'marvel-comics', expectedType: 'hub' },
    { query: 'star wars', expectedTopId: 'star-wars', expectedType: 'hub' },
    { query: 'disney', expectedTopId: 'disney', expectedType: 'hub' },
    { query: 'xbox', expectedTopId: 'xbox', expectedType: 'hub' },
    { query: 'playstation', expectedTopId: 'playstation', expectedType: 'hub' },
    { query: 'nintendo', expectedTopId: 'nintendo', expectedType: 'hub' },
    { query: 'hbo', expectedTopId: 'hbo-max', expectedType: 'hub' },
    { query: 'warner bros', expectedTopId: 'warner-bros', expectedType: 'hub' },
    { query: 'universal', expectedTopId: 'universal', expectedType: 'hub' },
    { query: 'dc', expectedTopId: 'dc-comics', expectedType: 'hub' },

    // Core Nav / Pages
    { query: 'intel', expectedTopId: 'intel', expectedType: 'page' },
    { query: 'featured', expectedTopId: 'featured', expectedType: 'page' },
    { query: 'events', expectedType: 'page' },
    { query: 'media kit', expectedTopId: 'media-kit', expectedType: 'page' },

    /*
      ─── CONTENT QUERIES ASSERT RELEVANCE, NOT IDENTITY ──────────────────

      These pinned an exact article id each, and that is not a testable
      property of a site whose content is synced. "lanterns" took this suite
      red on main when a SECOND Lanterns article was published: "Lanterns |
      The Grounded Blueprint for James Gunn's DCU" outranks "LANTERNS Premiere
      Review" because its title opens with the word. Fuse was right. Six items
      in the index now match that term, and which of them wins is an editorial
      fact that changes every time something is posted.

      The skip guard below already conceded this point for content that
      DISAPPEARS. A sibling outranking it is the same thing — a content change,
      not a code change — and it deserves the same treatment.

      So the assertion is what the suite actually exists to protect: the top
      hit has to be ABOUT the query. That still catches every real regression
      — a broken Fuse config returns nothing or returns something unrelated,
      and either fails here — while surviving publication.

      Hub and page queries above keep their exact ids. Those are defined in
      code, they are stable, and "a hub must beat an article for its own brand
      name" is precisely the ranking rule worth pinning.
    */
    { query: 'avengers', mustMatchQuery: true },
    { query: 'lanterns', mustMatchQuery: true },
    { query: 'god of war', mustMatchQuery: true },
    { query: 'mortal kombat', mustMatchQuery: true },
    { query: 'spider-man', mustMatchQuery: true },
    { query: 'the boys', mustMatchQuery: true },
  ];

  for (const { query, expectedTopId, expectedType, mustMatchQuery } of queries) {
    /*
      Hubs and pages are defined in code, so their ids are stable. Article and
      video ids are synced content: a post can be retitled, unpublished or
      simply age out of the index, and when that happens this suite was going
      red on main for a content change rather than a code one.

      So a missing expectation SKIPS, and a present one still has to rank
      first. That keeps the thing the suite exists to catch - a relevance
      regression - while dropping the failure mode that has nothing to do with
      the search code.
    */
    if (expectedTopId && !indexedIds.has(expectedTopId)) {
      await t.test(`Query "${query}"`, { skip: `"${expectedTopId}" is no longer in the search index` }, () => {});
      continue;
    }
    await t.test(`Query "${query}"`, () => {
      const results = fuse.search(query);
      assert.ok(results.length > 0, `Query "${query}" returned no results`);
      
      const top = results[0].item;
      if (expectedTopId) {
        assert.strictEqual(
          top.id,
          expectedTopId,
          `Expected top result id to be "${expectedTopId}", but got "${top.id}" (title: "${top.title}")`
        );
      }
      if (expectedType) {
        assert.strictEqual(
          top.type,
          expectedType,
          `Expected top result type to be "${expectedType}", but got "${top.type}" (id: "${top.id}")`
        );
      }
      if (mustMatchQuery) {
        const haystack = normalise([top.title, ...(top.tags ?? [])].join(' '));
        const missing = tokenise(query).filter((word) => !haystack.includes(word));
        assert.deepStrictEqual(
          missing,
          [],
          `Top result for "${query}" is not about it: "${top.title}" (id: "${top.id}") ` +
            `is missing ${JSON.stringify(missing)}`
        );
      }
    });
  }
});
