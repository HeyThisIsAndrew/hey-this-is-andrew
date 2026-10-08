/**
 * SEO ROUTING, PINNED.
 *
 * THE INCIDENT — Google Search Console, export 2026-08-26.
 * Twenty-seven URLs across five problem buckets traced back to two route
 * moves that were made correctly in the code and never finished at the edge:
 *
 *   1. src/pages/category/[slug].astro used to be a redirect stub:
 *
 *        return Astro.redirect(`/feed?category=${Astro.params.slug}`);
 *
 *      In a static Astro build that does not emit a 301. It emits an HTML
 *      file, and Astro's template for it carries BOTH a
 *      `<meta name="robots" content="noindex">` and a `<link rel="canonical">`
 *      pointing at the redirect target. So Google recorded /category/tv,
 *      /category/tv/, /category/events and /category/gaming as "Excluded by
 *      noindex", and learned about /feed?category=tv, ?category=gaming and
 *      ?category=events as canonical URLs in their own right. The stub was
 *      deleted in 87c450d; the URLs it taught Google are still in the index.
 *
 *   2. The same commit renamed src/pages/feed/[category]/ to
 *      src/pages/category/[category]/ without leaving a redirect, so
 *      /feed/film, /feed/tv and /feed/film/2 became unforwarded 404s while
 *      still sitting in Google's known-URL list.
 *
 * WHAT THIS TEST CAN AND CANNOT DO
 * It reads configuration, not a served response. It cannot prove Cloudflare
 * serves a 301, and it cannot prove Google re-crawled. What it CAN do is fail
 * the moment this repo grows another route that is advertised in the sitemap
 * and redirected at the same time, or loses the forwarding for a path Google
 * still holds. Both are silent in every other check.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const config = fs.readFileSync(path.join(repoRoot, 'astro.config.mjs'), 'utf-8');

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

console.log('seo-routing');

/** The legacy paths Google still lists as known URLs for this site. */
const LEGACY_FEED_CATEGORY_PATHS = [
  '/feed/film',
  '/feed/film/2',
  '/feed/tv',
  '/feed/gaming',
  '/feed/events',
];

test('every legacy /feed/<category> path still forwards somewhere', () => {
  for (const legacy of LEGACY_FEED_CATEGORY_PATHS) {
    assert.ok(
      new RegExp(`'${legacy}':\\s*'/category/`).test(config),
      `${legacy} has no redirect in astro.config.mjs. Google still lists it; removing the redirect turns it back into a dead 404.`,
    );
  }
});

test('no redirected path is also advertised in the sitemap', () => {
  // Pull the redirect sources and the sitemap exclusion list out of the config
  // and assert the first is a subset of the second. A redirect in the sitemap
  // is the exact shape of the "Page with redirect" bucket in Search Console.
  const redirectBlock = config.slice(config.indexOf('redirects: {'), config.indexOf('prefetch:'));
  const redirectSources = [...redirectBlock.matchAll(/^\s*'(\/[^']*)':\s*'\/[^']*',/gm)].map((m) => m[1]);

  const excludedBlock = config.slice(config.indexOf('const excludedPaths = ['), config.indexOf('return !excludedPaths'));
  const excluded = new Set([...excludedBlock.matchAll(/'(\/[^']*)'/g)].map((m) => m[1]));

  assert.ok(redirectSources.length >= 9, `expected to find the redirect map, parsed ${redirectSources.length} entries`);

  for (const source of redirectSources) {
    assert.ok(
      excluded.has(source),
      `${source} is a redirect but is not in the sitemap's excludedPaths. A sitemap must never advertise a URL that immediately redirects.`,
    );
  }
});

/*
  ─── AN EMPTY SECTION PAGE IS A SOFT 404 ────────────────────────────────────

  Search Console, 2026-08-28, on /intel/topic/events:

    "Page cannot be indexed: Soft 404"

  Google fetched it fine and found nothing on it. That category had zero
  articles, the page carried no robots directive, and it was in our own
  sitemap — so we were advertising a destination with nothing at it. Same rule
  the redirect test above enforces, different cause.

  The page must keep rendering: IntelFilters shows every canonical category
  whether or not it has articles, so deleting it turns a visible button into a
  404, which is worse for a reader than an honest empty state. The fix is that
  it exists for humans and is invisible to crawlers, and BOTH halves have to
  hold or it comes back.

  Both lift automatically on that category's first article, which is exactly
  why this needs a test: the bug disappears on its own and can be "fixed" by
  publishing, leaving the real defect in place for the next empty category.
*/
test('an article section with no articles is noindexed and unadvertised', () => {
  const intelLayout = fs.readFileSync(path.join(repoRoot, 'src/layouts/IntelLayout.astro'), 'utf-8');
  const feedLayout = fs.readFileSync(path.join(repoRoot, 'src/layouts/FeedLayout.astro'), 'utf-8');

  assert.match(
    intelLayout,
    /noindex=\{isEmpty\}/,
    'IntelLayout must pass noindex when a section is empty. Without it an empty category page ' +
      'invites Google to index a "no items found" screen, which Search Console reports as a soft 404.',
  );
  assert.match(
    feedLayout,
    /noindex=\{noindex\}/,
    'FeedLayout must forward noindex to Layout, or IntelLayout is setting a prop nothing reads.',
  );

  assert.match(
    config,
    /function emptyArticleTopicPaths\(\)/,
    'the sitemap no longer computes which article-section pages are empty',
  );
  assert.match(
    config,
    /\.\.\.EMPTY_ARTICLE_TOPIC_PATHS/,
    'emptyArticleTopicPaths() is computed but not spread into excludedPaths, so empty pages are ' +
      'still advertised in the sitemap',
  );
});

/*
  The config cannot import src/data/constants.js — it is plain Node and that
  module statically imports JSON — so the canonical category list is duplicated
  there. Duplicated lists drift; this is the alarm.
*/
test('the config\'s category list still matches the real one', () => {
  const constants = fs.readFileSync(path.join(repoRoot, 'src/data/constants.js'), 'utf-8');
  const real = /CATEGORIES = (\[[^\]]*\])/.exec(constants);
  const copy = /CANONICAL_ARTICLE_CATEGORIES = (\[[^\]]*\])/.exec(config);
  assert.ok(real, 'could not parse CATEGORIES out of src/data/constants.js');
  assert.ok(copy, 'could not parse CANONICAL_ARTICLE_CATEGORIES out of astro.config.mjs');
  assert.equal(
    copy[1].replace(/\s+/g, ''),
    real[1].replace(/\s+/g, ''),
    'astro.config.mjs carries a stale copy of the category list. A category missing from the copy ' +
      'can never be excluded from the sitemap when it empties.',
  );
});

test('the sitemap stamps lastmod on article pages', () => {
  assert.match(config, /ARTICLE_LASTMOD/, 'the lastmod map is gone; the sitemap is back to carrying no lastmod at all');
  assert.match(config, /lastmod \? \{ \.\.\.item/, 'serialize() no longer attaches lastmod');
});

test('lastmod is derived only from dates an article actually carries', () => {
  // Guard against the tempting "just use Date.now()" regression. A lastmod
  // that changes on every build is a lie a crawler learns to ignore.
  const builder = config.slice(config.indexOf('function buildArticleLastmod'), config.indexOf('const ARTICLE_LASTMOD'));
  assert.match(builder, /record\.lastUpdated \|\| record\.isoDate/);
  assert.ok(!/Date\.now\(\)/.test(builder), 'lastmod must never be built from the current time');
});

/*
  ─── A MIXED PAGE CANNOT BE DATED FROM ARTICLES ALONE ──────────────────────

  / and /feed show videos and shorts alongside articles, but their lastmod was
  taken from the newest ARTICLE. A YouTube sync runs every six hours and
  changes both pages; on any day one landed after the last post, the sitemap
  said they had not changed since that post.

  Wrong in the "nothing happened" direction is the worse error: it tells a
  crawler to skip a page that did change, which is the opposite of why lastmod
  was added at all. /intel and /feed/articles are article-only and are
  correctly dated from articles alone.
*/
test('mixed surfaces take the newest of articles OR media', () => {
  const builder = config.slice(config.indexOf('function buildArticleLastmod'), config.indexOf('const ARTICLE_LASTMOD'));

  assert.match(builder, /videos\.json/, 'the media snapshot is no longer read; / and /feed are back to article-only dates');
  assert.match(builder, /\['video', 'short', 'live'\]/, 'only dated doc types may contribute; hubs carry no date');
  assert.match(builder, /Math\.max\(maxGlobal, maxMedia\)/, 'mixed surfaces must take the newer of the two sources');

  const mixed = builder.slice(builder.indexOf('const maxMixed'));
  for (const route of ["'/'", "'/feed'"]) {
    assert.ok(mixed.includes(`map.set(${route}`), `${route} must be dated from the mixed maximum`);
  }
});

test('article-only surfaces stay dated from articles alone', () => {
  const builder = config.slice(config.indexOf('function buildArticleLastmod'), config.indexOf('const ARTICLE_LASTMOD'));
  const articleOnly = builder.slice(builder.indexOf('if (maxGlobal > 0)'), builder.indexOf('let maxMedia'));
  assert.ok(articleOnly.includes("map.set('/intel'"), '/intel lists only articles and should be dated from them');
  assert.ok(
    !articleOnly.includes("map.set('/'"),
    'the homepage must NOT be dated from the article-only maximum — it shows media too',
  );
});

test('an unreadable media snapshot degrades instead of failing the build', () => {
  const builder = config.slice(config.indexOf('let maxMedia'), config.indexOf('const maxMixed'));
  assert.match(builder, /catch\s*\{/, 'reading videos.json must be wrapped; a missing snapshot cannot fail a build');
});

test('no page route returns Astro.redirect (that emits a noindex stub, not a 301)', () => {
  // This is the incident above, made un-repeatable. Config `redirects` are
  // fine — the Cloudflare adapter turns those into real 301s in _redirects.
  // `Astro.redirect()` inside a prerendered page is NOT: it writes an HTML
  // file carrying `<meta name="robots" content="noindex">`.
  const pagesDir = path.join(repoRoot, 'src/pages');
  const offenders = [];

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.astro')) continue;
      const source = fs.readFileSync(full, 'utf-8');
      const frontmatter = source.startsWith('---') ? source.slice(3, source.indexOf('\n---', 3)) : '';
      if (/\bAstro\.redirect\s*\(/.test(frontmatter)) {
        offenders.push(path.relative(repoRoot, full));
      }
    }
  };
  walk(pagesDir);

  assert.deepEqual(
    offenders,
    [],
    `These pages call Astro.redirect() in frontmatter, which prerenders to a noindex HTML stub rather than a 301:\n  ${offenders.join('\n  ')}\nUse the \`redirects\` map in astro.config.mjs instead.`,
  );
});

/*
  ─── THE FEED MUST AGREE WITH THE CANONICAL TAG ─────────────────────────────

  @astrojs/rss defaults `trailingSlash` to true, so a relative item link comes
  out as `/intel/<slug>/`. This site's canonical form is the bare one, set by
  `assets.html_handling: "drop-trailing-slash"` in wrangler.jsonc and matched
  by Layout.astro's canonical tag and the sitemap's serialize().

  So the default shipped a feed whose every item pointed at a URL that 301s,
  disagreeing with the canonical tag on the page it named — on the one surface
  whose entire job is handing Google a list of URLs. Caught before it reached
  Publisher Center; this stops it coming back.
*/
test('the RSS feed emits canonical, slash-free article URLs', () => {
  const feed = fs.readFileSync(path.join(repoRoot, 'src/pages/rss.xml.ts'), 'utf-8');
  assert.match(
    feed,
    /trailingSlash:\s*false/,
    'rss() must set trailingSlash: false. The default is true, which emits /intel/<slug>/ — a URL that immediately redirects.',
  );
  assert.ok(
    !/link:\s*`\/intel\//.test(feed),
    'build the item link with articlePath(), not a hand-written /intel/ template string',
  );
});

test('the RSS feed is discoverable from every page', () => {
  const layout = fs.readFileSync(path.join(repoRoot, 'src/layouts/Layout.astro'), 'utf-8');
  assert.match(layout, /rel="alternate"[^>]*application\/rss\+xml/);
});

if (failures > 0) {
  console.error(`\nseo-routing: ${failures} failing test(s)`);
  process.exit(1);
}
console.log('seo-routing: all passed');
