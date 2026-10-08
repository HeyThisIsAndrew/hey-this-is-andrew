/**
 * Offline guards for scripts/notify-indexing-api.mjs.
 *
 * No network, no credentials. The two things worth pinning are:
 *   1. The URL validator refuses anything that is not a real article page on
 *      our own origin. It is the only thing standing between a hand-typed or
 *      workflow_dispatch input and a live call to Google.
 *   2. eligibleArticleUrls() agrees with the site's own idea of which
 *      articles have pages. If it drifts, we either submit URLs that 404 or
 *      silently stop submitting real ones.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertSubmittableUrl,
  eligibleArticleUrls,
  newUrls,
  parseCredentials,
} from './notify-indexing-api.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

/*
  src/lib/articles.ts cannot be imported here: it statically imports
  articles.json, and a bare `import x from './y.json'` is a hard error under
  plain node without an import attribute. Astro's bundler supplies one, plain
  `node scripts/*.test.mjs` does not.

  So the parity check reads the source TEXT and asserts the three rules the
  notifier copies are still written the way it copied them. That is a drift
  alarm, not a re-implementation: if someone changes what counts as a
  published article, this fails and points at the line to mirror. Same
  approach as scripts/sync-wiring.test.mjs.
*/
const articlesLib = fs.readFileSync(path.join(repoRoot, 'src/lib/articles.ts'), 'utf-8');
const intelRoute = fs.readFileSync(path.join(repoRoot, 'src/pages/intel/[slug].astro'), 'utf-8');
const RESERVED_SLUGS = new Set(['topic', 'page']);

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

function rejects(input, because) {
  assert.throws(() => assertSubmittableUrl(input), undefined, `should have refused ${JSON.stringify(input)} (${because})`);
}

console.log('indexing-api');

// ── The validator ───────────────────────────────────────────────────────────

test('accepts a well-formed article URL', () => {
  assert.equal(
    assertSubmittableUrl('https://beunconventionalhq.com/intel/mortal-kombat-2-review'),
    'https://beunconventionalhq.com/intel/mortal-kombat-2-review',
  );
});

test('refuses another origin', () => {
  rejects('https://evil.example.com/intel/x', 'wrong host');
  rejects('https://beunconventionalhq.com.evil.example/intel/x', 'suffix attack');
  rejects('https://www.beunconventionalhq.com/intel/x', 'www is not canonical here');
});

test('refuses non-https', () => {
  rejects('http://beunconventionalhq.com/intel/x', 'plain http');
  rejects('javascript:alert(1)//beunconventionalhq.com/intel/x', 'not a web URL');
});

test('refuses routes that are not article pages', () => {
  rejects('https://beunconventionalhq.com/', 'homepage');
  rejects('https://beunconventionalhq.com/feed', 'feed');
  rejects('https://beunconventionalhq.com/intel', 'section index, not an article');
  rejects('https://beunconventionalhq.com/intel/topic/film', 'topic route, two segments');
});

test('refuses reserved slugs that have no page', () => {
  for (const reserved of RESERVED_SLUGS) {
    rejects(`https://beunconventionalhq.com/intel/${reserved}`, 'reserved route segment');
  }
});

test('refuses query strings, fragments and traversal', () => {
  rejects('https://beunconventionalhq.com/intel/x?utm_source=nl', 'query string');
  rejects('https://beunconventionalhq.com/intel/x#top', 'fragment');
  rejects('https://beunconventionalhq.com/intel/../admin', 'traversal');
  rejects('https://beunconventionalhq.com/intel/Some-Slug', 'uppercase is not a slug we emit');
  rejects('https://beunconventionalhq.com/intel/', 'empty slug');
});

test('refuses junk', () => {
  rejects('', 'empty');
  rejects('not a url', 'not a url');
  rejects(undefined, 'undefined');
});

// ── Eligibility agrees with the site ────────────────────────────────────────

test('the site still decides page existence the way the notifier copies it', () => {
  // getAllArticles(): drops editorial.hidden
  assert.match(articlesLib, /ALL\.filter\(\(r\) => r && !r\.editorial\?\.hidden\)/);
  // getPublishedArticles(): body + slug
  assert.match(articlesLib, /getAllArticles\(\)\.filter\(\(r\) => r\.hasBody && r\.slug\)/);
  // RESERVED_SLUGS: the set the notifier hardcodes
  assert.match(articlesLib, /RESERVED_SLUGS = new Set\(\['topic', 'page'\]\)/);
  // The route really does build from getPublishedArticles minus reserved slugs
  assert.match(intelRoute, /getPublishedArticles\(\)/);
  assert.match(intelRoute, /RESERVED_SLUGS\.has\(article\.slug\)/);
});

test('eligibleArticleUrls reproduces that rule over the real snapshot', () => {
  const records = JSON.parse(fs.readFileSync(path.join(repoRoot, 'src/data/articles.json'), 'utf-8'));
  const fromNotifier = eligibleArticleUrls(records);

  const fromRule = [
    ...new Set(
      records
        .filter((r) => r && !r.editorial?.hidden && r.hasBody && r.slug && !RESERVED_SLUGS.has(r.slug))
        .map((r) => `https://beunconventionalhq.com/intel/${r.slug}`),
    ),
  ].sort();

  assert.deepEqual(fromNotifier, fromRule);
  assert.ok(fromNotifier.length > 0, 'the snapshot should contain at least one publishable article');
});

test('every eligible URL passes the validator', () => {
  const records = JSON.parse(fs.readFileSync(path.join(repoRoot, 'src/data/articles.json'), 'utf-8'));
  for (const url of eligibleArticleUrls(records)) {
    assert.equal(assertSubmittableUrl(url), url);
  }
});

test('eligibility excludes hidden, bodyless and slugless records', () => {
  const urls = eligibleArticleUrls([
    { slug: 'keeper', hasBody: true },
    { slug: 'hidden-one', hasBody: true, editorial: { hidden: true } },
    { slug: 'no-body', hasBody: false },
    { slug: '', hasBody: true },
    { hasBody: true },
    null,
    'not an object',
  ]);
  assert.deepEqual(urls, ['https://beunconventionalhq.com/intel/keeper']);
});

test('eligibility dedupes and sorts', () => {
  const urls = eligibleArticleUrls([
    { slug: 'b', hasBody: true },
    { slug: 'a', hasBody: true },
    { slug: 'b', hasBody: true },
  ]);
  assert.deepEqual(urls, [
    'https://beunconventionalhq.com/intel/a',
    'https://beunconventionalhq.com/intel/b',
  ]);
});

test('eligibility survives a garbage snapshot rather than throwing', () => {
  assert.deepEqual(eligibleArticleUrls(null), []);
  assert.deepEqual(eligibleArticleUrls({}), []);
});

// ── The diff ────────────────────────────────────────────────────────────────

test('newUrls returns only what appeared', () => {
  assert.deepEqual(newUrls(['a', 'b'], ['a', 'b', 'c']), ['c']);
  assert.deepEqual(newUrls(['a', 'b'], ['a', 'b']), []);
  assert.deepEqual(newUrls([], ['a']), ['a']);
});

test('newUrls does not report a REMOVED url as new', () => {
  // An article going hidden must never turn into a URL_UPDATED submission.
  assert.deepEqual(newUrls(['a', 'b'], ['a']), []);
});

// ── Credential parsing ──────────────────────────────────────────────────────

test('parseCredentials rejects anything that is not a service account key', () => {
  assert.throws(() => parseCredentials('nonsense'), /not valid JSON/);
  assert.throws(() => parseCredentials('{}'), /missing "client_email"/);
  assert.throws(() => parseCredentials('{"client_email":"a@b.iam.gserviceaccount.com"}'), /missing "private_key"/);
  assert.throws(
    () => parseCredentials('{"type":"authorized_user","client_email":"a","private_key":"b"}'),
    /expected "service_account"/,
  );
});

if (failures > 0) {
  console.error(`\nindexing-api: ${failures} failing test(s)`);
  process.exit(1);
}
console.log('indexing-api: all passed');
