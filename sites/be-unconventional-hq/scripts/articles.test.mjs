/**
 * Offline tests for the Substack → local JSON article pipeline.
 *
 * No network, no credentials. The feed is a fixture, so the parse →
 * sanitize → merge path is exercised end to end exactly as it would run
 * against the real thing.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePostsResponse, planArticleSync } from './sync-articles.mjs';
import {
  demoteHeadings,
  sanitizeArticleHtml,
  mapCategory,
  toSlug,
  looksTruncated,
  toPlainText,
  buildArticleRecord,
  buildPreview,
  mergeSnapshot,
  liftPullQuotes,
} from '../src/lib/articles-transform.ts';
import { imageFingerprint, stripCoverImageFromBody } from '../src/lib/article-media.ts';
import { parseImageDimensions, labelImageLinks } from '../src/lib/article-images-transform.ts';
import { getCardImageSources, isSubstackFetchUrl } from '../src/lib/card-images.ts';
import {
  ALREADY_OPTIMISED,
  lookupRendition,
  rewriteBodyImages,
} from '../src/lib/article-images-transform.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed += 1;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed += 1;
    process.exitCode = 1;
  }
}

console.log('articles.test.mjs');

// ── Heading demotion ────────────────────────────────────────────────────────

test('in-body h1 is demoted so the article title stays the only h1', () => {
  assert.equal(demoteHeadings('<h1>Body</h1>'), '<h2>Body</h2>');
});

test('heading demotion shifts the whole hierarchy and closes tags', () => {
  assert.equal(
    demoteHeadings('<h1>A</h1><h2>B</h2><h3>C</h3>'),
    '<h2>A</h2><h3>B</h3><h4>C</h4>',
  );
});

test('heading demotion clamps at h4 rather than running to h5/h6', () => {
  assert.equal(demoteHeadings('<h4>D</h4><h5>E</h5><h6>F</h6>'), '<h4>D</h4><h4>E</h4><h4>F</h4>');
});

test('heading demotion preserves attributes', () => {
  assert.equal(demoteHeadings('<h2 id="x">T</h2>'), '<h3 id="x">T</h3>');
});

// ── Sanitization ────────────────────────────────────────────────────────────

test('scripts are stripped entirely', () => {
  const out = sanitizeArticleHtml('<p>ok</p><script>alert(1)</script>');
  assert.ok(!out.includes('script'), out);
  assert.ok(out.includes('ok'));
});

test('iframes and embeds are stripped', () => {
  const out = sanitizeArticleHtml('<p>a</p><iframe src="https://evil.test"></iframe>');
  assert.ok(!out.includes('iframe'), out);
});

test('inline styles, classes and ids are stripped from body markup', () => {
  const out = sanitizeArticleHtml('<p style="color:red" class="x" id="y">text</p>');
  assert.equal(out, '<p>text</p>');
});

test('event handlers are stripped', () => {
  const out = sanitizeArticleHtml('<p onclick="steal()">text</p>');
  assert.ok(!out.includes('onclick'), out);
});

test('semantic tags survive', () => {
  const html = '<p>a</p><h2>h</h2><ul><li>i</li></ul><blockquote>q</blockquote><strong>s</strong>';
  const out = sanitizeArticleHtml(html);
  for (const tag of ['<p>', '<h3>', '<ul>', '<li>', '<blockquote>', '<strong>']) {
    assert.ok(out.includes(tag), `${tag} missing from ${out}`);
  }
});

test('external anchors are forced to rel="noopener noreferrer"', () => {
  const out = sanitizeArticleHtml('<p><a href="https://example.test">x</a></p>');
  assert.ok(out.includes('rel="noopener noreferrer"'), out);
});

test('javascript: URLs do not survive', () => {
  const out = sanitizeArticleHtml('<p><a href="javascript:alert(1)">x</a></p>');
  assert.ok(!out.includes('javascript:'), out);
});

test('empty paragraphs are dropped but image-bearing ones are kept', () => {
  const out = sanitizeArticleHtml('<p>  </p><p><img src="https://x.test/a.png" alt="a"></p>');
  assert.ok(!out.includes('<p>  </p>'), out);
  assert.ok(out.includes('<img'), out);
});

// ── Category mapping ────────────────────────────────────────────────────────

test('exact tag match wins and uses the site label Film, not Movies', () => {
  assert.equal(mapCategory(['Film'], ''), 'Film');
  assert.equal(mapCategory(['Movies'], ''), 'Film');
});

test('tag matching is case and punctuation insensitive', () => {
  assert.equal(mapCategory(['comic-con'], ''), 'Events');
  assert.equal(mapCategory(['GAMING'], ''), 'Games');
});

test('tags beat body text', () => {
  assert.equal(mapCategory(['Gaming'], 'a movie review about cinema'), 'Games');
});

test('falls back to text scan when no tag is usable', () => {
  assert.equal(mapCategory([], 'our review of the new season episode'), 'TV');
});

test('unmappable content lands in General rather than guessing', () => {
  assert.equal(mapCategory([], 'thoughts on nothing in particular'), 'General');
});

// ── Slugs ───────────────────────────────────────────────────────────────────

test('slug is taken from the Substack permalink', () => {
  assert.equal(
    toSlug('https://x.substack.com/p/mortal-kombat-2-review', 'Whatever'),
    'mortal-kombat-2-review',
  );
});

test('slug falls back to the title when the link has no /p/ segment', () => {
  assert.equal(toSlug('', 'The Boys: Season 5!'), 'the-boys-season-5');
});

test('slug strips query strings and fragments', () => {
  assert.equal(toSlug('https://x.substack.com/p/abc?utm=1#top', 'T'), 'abc');
});

// ── Truncation safety net ───────────────────────────────────────────────────

test('a full-length body is not flagged as truncated', () => {
  assert.equal(looksTruncated(`<p>${'word '.repeat(200)}</p>`), false);
});

test('a short teaser is flagged', () => {
  assert.equal(looksTruncated('<p>Just a taste.</p>'), true);
});

test('a paywall marker is flagged even when long', () => {
  const body = `<p>${'word '.repeat(200)} Subscribe to keep reading</p>`;
  assert.equal(looksTruncated(body), true);
});

// ── Record building ─────────────────────────────────────────────────────────

const NOW = new Date('2026-07-26T12:00:00Z');

test('a well-formed item produces a complete record', () => {
  const record = buildArticleRecord(
    {
      title: 'Mortal Kombat 2 Review',
      link: 'https://x.substack.com/p/mortal-kombat-2-review',
      guid: 'guid-1',
      pubDate: 'Tue, 05 May 2026 02:08:53 GMT',
      description: 'A review.',
      contentEncoded: `<h1>Heading</h1><p>${'word '.repeat(200)}</p>`,
      categories: ['Film'],
    },
    NOW,
  );
  assert.equal(record.guid, 'guid-1');
  assert.equal(record.slug, 'mortal-kombat-2-review');
  assert.equal(record.category, 'Film');
  assert.equal(record.hasBody, true);
  assert.ok(record.bodyHtml.startsWith('<h2>'), 'in-body h1 should be demoted');
  /*
    May 4, not May 5. The fixture's post_date is 2026-05-05T02:08:53Z, which
    is 7:08pm Pacific on the 4th — the evening it was actually published.

    This assertion used to read 'May 5' because dates were formatted in UTC,
    so everything posted after ~5pm Pacific was dated a day into the future.
    The expectation was encoding the bug. See src/lib/publish-timezone.js.
  */
  assert.equal(record.date, 'May 4, 2026');
});

// ── The magazine lede (buildPreview) ────────────────────────────────────────
//
// This is what fills the centre feature on /intel. The failure it exists to
// prevent is a one-line preview under a large headline, leaving an obvious
// empty block above the fold — so these tests are mostly about SIZE.

const PARA = (n) =>
  `<p>${'This is a sentence of roughly forty characters. '.repeat(n).trim()}</p>`;

test('the lede is several paragraphs, not one line', () => {
  const preview = buildPreview(PARA(5) + PARA(5) + PARA(5) + PARA(5));
  assert.ok(preview.length >= 2, `expected multiple paragraphs, got ${preview.length}`);
  assert.ok(
    preview.join(' ').length > 600,
    `expected a substantial lede, got ${preview.join(' ').length} chars`,
  );
});

test('the lede stops at the character budget rather than dumping the article', () => {
  const preview = buildPreview(PARA(4).repeat(40));
  assert.ok(preview.join(' ').length < 1600, 'lede should not run past its budget');
});

test('the paragraph cap is respected even with very short paragraphs', () => {
  const short = `<p>${'A short but usable paragraph of text here. '.repeat(2).trim()}</p>`;
  assert.ok(buildPreview(short.repeat(20)).length <= 5);
});

test('headings, lists and figures are not treated as lede paragraphs', () => {
  const preview = buildPreview(`<h2>What Works</h2><ul><li>Direction</li></ul>${PARA(5)}`);
  assert.equal(preview.length, 1);
  assert.ok(!preview[0].includes('What Works'));
  assert.ok(!preview[0].includes('Direction'));
});

test('one-line furniture paragraphs are skipped', () => {
  // "Score: 8/10" style sign-offs read as noise at the top of a feature.
  const preview = buildPreview(`<p>Score: 8/10</p>${PARA(5)}`);
  assert.equal(preview.length, 1);
  assert.ok(!preview[0].startsWith('Score'));
});

test('a body with no paragraphs falls back to the supplied text', () => {
  assert.deepEqual(buildPreview('<h2>Only a heading</h2>', 'The fallback.'), ['The fallback.']);
});

test('a body with nothing usable and no fallback yields an empty lede, not a crash', () => {
  assert.deepEqual(buildPreview('', ''), []);
});

test('markup never survives into the lede', () => {
  const preview = buildPreview(`<p><strong>Bold</strong> ${'text here and more of it. '.repeat(4)}</p>`);
  assert.ok(!preview[0].includes('<'), 'lede must be plain text — it is rendered via textContent');
});

test('a single over-long paragraph is trimmed at a sentence boundary', () => {
  const giant = `<p>${'Sentence number one is here. '.repeat(120)}</p>`;
  const preview = buildPreview(giant);
  assert.equal(preview.length, 1);
  assert.ok(preview[0].length < 1600, `expected a trim, got ${preview[0].length} chars`);
  assert.ok(/[.…]$/.test(preview[0]), 'trimmed lede should end cleanly');
});

test('every built record carries a lede', () => {
  const record = buildArticleRecord(
    {
      title: 'Review',
      link: 'https://x.substack.com/p/review',
      guid: 'g',
      pubDate: 'Tue, 05 May 2026 02:08:53 GMT',
      contentEncoded: PARA(6) + PARA(6),
      categories: ['Film'],
    },
    NOW,
  );
  assert.ok(Array.isArray(record.preview) && record.preview.length >= 1);
});

test('an item with no title is rejected rather than half-imported', () => {
  assert.equal(buildArticleRecord({ link: 'https://x.test/p/a' }, NOW), null);
});

test('an item with no guid or link is rejected', () => {
  assert.equal(buildArticleRecord({ title: 'Orphan' }, NOW), null);
});

test('an unparseable pubDate does not throw and does not produce Invalid Date', () => {
  const record = buildArticleRecord(
    { title: 'T', link: 'https://x.test/p/t', pubDate: 'not-a-date' },
    NOW,
  );
  assert.equal(record.isoDate, NOW.toISOString());
  assert.ok(!record.date.includes('Invalid'));
});

test('a truncated body yields hasBody:false so no local page is generated', () => {
  const record = buildArticleRecord(
    { title: 'T', link: 'https://x.test/p/t', contentEncoded: '<p>teaser</p>' },
    NOW,
  );
  assert.equal(record.hasBody, false);
});

// ── Merge semantics (the archive-safety contract) ───────────────────────────

const older = {
  guid: 'a',
  slug: 'a',
  title: 'Old post',
  link: 'l',
  date: 'May 1, 2026',
  isoDate: '2026-05-01T00:00:00.000Z',
  excerpt: '',
  image: '',
  category: 'Film',
  tags: [],
  bodyHtml: '<p>full</p>',
  hasBody: true,
  firstSeen: '2026-05-01T00:00:00.000Z',
  lastUpdated: '2026-05-01T00:00:00.000Z',
};

test('a record that has aged out of the feed window is NEVER deleted', () => {
  const incoming = [{ ...older, guid: 'b', slug: 'b-slug', isoDate: '2026-06-01T00:00:00.000Z' }];
  const { merged } = mergeSnapshot([older], incoming);
  assert.equal(merged.length, 2);
  assert.ok(merged.some((r) => r.guid === 'a'), 'aged-out record was dropped');
});

test('an empty feed leaves the entire archive intact', () => {
  const { merged, added, updated } = mergeSnapshot([older], []);
  assert.equal(merged.length, 1);
  assert.equal(added, 0);
  assert.equal(updated, 0);
});

test('an existing GUID is updated in place, not duplicated', () => {
  const { merged, added, updated } = mergeSnapshot(
    [older],
    [{ ...older, title: 'Retitled' }],
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].title, 'Retitled');
  assert.equal(added, 0);
  assert.equal(updated, 1);
});

test('firstSeen survives an update', () => {
  const { merged } = mergeSnapshot(
    [older],
    [{ ...older, firstSeen: '2026-07-26T00:00:00.000Z' }],
  );
  assert.equal(merged[0].firstSeen, '2026-05-01T00:00:00.000Z');
});

test('a feed that stops returning bodies does not blank an archived body', () => {
  const { merged } = mergeSnapshot([older], [{ ...older, bodyHtml: '', hasBody: false }]);
  assert.equal(merged[0].bodyHtml, '<p>full</p>');
  assert.equal(merged[0].hasBody, true);
});

test('merged output is sorted newest first', () => {
  const newer = { ...older, guid: 'b', slug: 'b-slug', isoDate: '2026-06-01T00:00:00.000Z' };
  const { merged } = mergeSnapshot([older], [newer]);
  assert.equal(merged[0].guid, 'b');
});

// ── Posts API parsing, against a fixture ────────────────────────────────────

const FIXTURE = [
  {
    id: 196494656,
    title: 'Mortal Kombat 2 Review',
    slug: 'mortal-kombat-2-review',
    canonical_url: 'https://beunconventionalhq.substack.com/p/mortal-kombat-2-review',
    post_date: '2026-05-05T02:08:53.000Z',
    subtitle: 'A spoiler-free review.',
    postTags: [{ id: 1, name: 'Film', slug: 'film' }],
    body_html: `<h1>The Verdict</h1><p style="color:red">${'word '.repeat(200)}</p><script>bad()</script>`,
    cover_image: 'https://substackcdn.com/image/fetch/cover.jpg',
  },
  {
    // No id, slug, or canonical_url — nothing to build a guid/link from.
    title: 'Broken Post',
    post_date: 'garbage',
    body_html: '<p>short</p>',
  },
];

test('fixture response parses into raw items', () => {
  const items = parsePostsResponse(FIXTURE);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'Mortal Kombat 2 Review');
  assert.equal(items[0].guid, '196494656');
  assert.deepEqual(items[0].categories, ['Film']);
  assert.ok(items[0].contentEncoded.includes('<h1>'));
});

test('a bare-string postTags entry is tolerated', () => {
  const items = parsePostsResponse([{ ...FIXTURE[0], postTags: ['Film'] }]);
  assert.deepEqual(items[0].categories, ['Film']);
});

test('link falls back to publication/p/slug when canonical_url is missing', () => {
  const items = parsePostsResponse([{ id: 1, title: 'x', slug: 'x-slug' }]);
  assert.equal(items[0].link, 'https://beunconventionalhq.substack.com/p/x-slug');
});

test('a single-post response still parses as an array', () => {
  assert.equal(parsePostsResponse(FIXTURE[0]).length, 1);
});

test('a malformed item is skipped with a reason and the rest still import', () => {
  const { merged, skipped, parsed } = planArticleSync(parsePostsResponse(FIXTURE), [], NOW);
  assert.equal(parsed, 1, 'only the well-formed item should parse');
  assert.equal(skipped.length, 1);
  assert.match(skipped[0].reason, /guid|title/);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].slug, 'mortal-kombat-2-review');
});

test('end-to-end: fixture import sanitizes, demotes and categorises', () => {
  const { merged } = planArticleSync(parsePostsResponse(FIXTURE), [], NOW);
  const record = merged[0];
  assert.equal(record.category, 'Film');
  assert.equal(record.hasBody, true);
  assert.ok(!record.bodyHtml.includes('script'), 'script survived sanitization');
  assert.ok(!record.bodyHtml.includes('style='), 'inline style survived sanitization');
  assert.ok(record.bodyHtml.includes('<h2>The Verdict</h2>'), record.bodyHtml.slice(0, 120));
});

test('re-running the same response is idempotent', () => {
  const first = planArticleSync(parsePostsResponse(FIXTURE), [], NOW);
  const second = planArticleSync(parsePostsResponse(FIXTURE), first.merged, NOW);
  assert.equal(second.merged.length, first.merged.length);
  assert.equal(second.added, 0);
});


// ── Plain-text extraction across block boundaries ───────────────────────────

test('paragraph boundaries do not weld words together', () => {
  // The reported symptom: "(kind of)So yeah" with no space.
  const text = toPlainText('<p>Seth Rogen… RIP (kind of)</p><p>So yeah… he died.</p>');
  assert.equal(text, 'Seth Rogen… RIP (kind of) So yeah… he died.');
});

test('a figure caption does not run into the next sentence', () => {
  const text = toPlainText(
    '<p>Low expectations.</p><figure><img src="x.jpg"><figcaption>Johnny Cage Fight</figcaption></figure><p>I saw it early.</p>',
  );
  assert.equal(text, 'Low expectations. Johnny Cage Fight I saw it early.');
});

test('<br> is a word boundary too', () => {
  assert.equal(toPlainText('<p>one<br>two</p>'), 'one two');
  /* sanitize-html escapes its text output; plain text must not carry the
     escapes, or Astro escapes them again and readers see "Q&amp;A". */
  assert.equal(toPlainText('<p>a live Q&amp;A, 5 &lt; 6</p>'), 'a live Q&A, 5 < 6');
  assert.equal(toPlainText('<p>literal &amp;lt; stays</p>'), 'literal &lt; stays');
});

// ── Cover-image de-duplication ──────────────────────────────────────────────

const MK_UPLOAD =
  'https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fa5e65013-c01a-4445-b2cc-e706293c9e3e_2048x1152.jpeg';
const MK_COVER = `https://substackcdn.com/image/fetch/$s_!qfD6!,f_auto,q_auto:good,fl_progressive:steep/${MK_UPLOAD}`;
const MK_IN_BODY = `https://substackcdn.com/image/fetch/$s_!qfD6!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/${MK_UPLOAD}`;

test('the same asset fingerprints identically through different CDN transforms', () => {
  assert.equal(imageFingerprint(MK_COVER), imageFingerprint(MK_IN_BODY));
  assert.match(imageFingerprint(MK_COVER), /^image:a5e65013/);
});

test('a YouTube thumbnail fingerprints to its video id', () => {
  assert.equal(
    imageFingerprint('https://substackcdn.com/image/youtube/w_728,c_limit/oUT7clLVxhw'),
    'youtube:oUT7clLVxhw',
  );
});

test('different assets do not collide', () => {
  assert.notEqual(imageFingerprint(MK_COVER), imageFingerprint('.../public/images/other_100x100.jpeg'));
});

test('the duplicated cover figure is removed, caption and all', () => {
  const body = `<p>Intro.</p><figure><a href="${MK_COVER}"><img src="${MK_IN_BODY}" alt="Johnny Cage Fight"></a><figcaption>Johnny Cage Fight</figcaption></figure><p>Body.</p>`;
  const out = stripCoverImageFromBody(body, MK_COVER);
  assert.equal(out, '<p>Intro.</p><p>Body.</p>');
  assert.ok(!out.includes('figcaption'), 'caption was stranded');
});

test('only the first occurrence is removed', () => {
  const fig = `<figure><img src="${MK_IN_BODY}"></figure>`;
  const out = stripCoverImageFromBody(`${fig}<p>x</p>${fig}`, MK_COVER);
  assert.equal(out, `<p>x</p>${fig}`);
});

test('a body that does not repeat the cover is untouched', () => {
  // The Boys case: cover is a YouTube thumb, body's embed was sanitized away.
  const body = '<p>Seth Rogen… RIP</p><h3>Why it worked</h3><p>More.</p>';
  assert.equal(
    stripCoverImageFromBody(body, 'https://substackcdn.com/image/youtube/w_728,c_limit/oUT7clLVxhw'),
    body,
  );
});

test('a bare img with no figure wrapper is still removed', () => {
  const out = stripCoverImageFromBody(`<p>a</p><img src="${MK_IN_BODY}"><p>b</p>`, MK_COVER);
  assert.equal(out, '<p>a</p><p>b</p>');
});

test('no cover image means the body is returned unchanged', () => {
  const body = `<figure><img src="${MK_IN_BODY}"></figure>`;
  assert.equal(stripCoverImageFromBody(body, ''), body);
});

/*
  ─── ARTICLE-PAGE IMAGES MUST NOT GO THROUGH A LIVE PROXY ───────────────────

  THE INCIDENT
  A performance pass rewrote the article hero AND every body <img> to wsrv.nl
  renditions. Reported from a real phone on the preview deploy: the Spider-Man
  review's gallery images were blank, and STAYED blank while sliding through
  them.

  WHY IT WAS WORSE, NOT BETTER
    • wsrv.nl has a cold cache. A first request meant fetching a ~1 MB
      3840x2160 JPEG from S3, decoding, resizing and re-encoding — once per
      URL AND per srcset width.
    • SubstackGallery's lightbox sets `img.src` on every slide, with no srcset
      and no preloading, so each swipe triggered a fresh cold transcode.
    • The hero is eager and above the fold, so the wait landed on the masthead.

  WHAT IS ALLOWED NOW, AND WHY IT IS NOT THE SAME THING
  The images are rewritten again — but to renditions built ahead of time by
  scripts/sync-article-images.mjs and COMMITTED to public/article-images/. A
  local file cannot be cold, cannot expire, cannot rate-limit and cannot 403.
  The failure mode above requires a live third-party transcoder in the request
  path, and there no longer is one.

  So these guards pin the actual rule rather than the shape of the old code:
  an article image is either a committed local rendition or the URL Substack
  gave us. Never a proxy.
*/
/*
  Comments stripped before ANY of these match.

  The first version of this guard failed against correct code, because the
  explanation above the rewrite names wsrv.nl as the thing that was reverted —
  so the guard matched its own prose. That is not a small annoyance: a guard
  that reads comments is a guard that can be satisfied, or broken, by editing a
  sentence. The identical mistake was made once already in
  instagram-local-media.test.mjs and is called out in its header.
*/
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    /* `(?<![:/])` so `https://…` inside real code is not mistaken for a
       line comment and used to swallow the rest of the line. */
    .replace(/(?<![:/])\/\/[^\n]*/g, '');
}

const articlePage = stripComments(
  fs.readFileSync(path.join(ROOT, 'src/pages/intel/[slug].astro'), 'utf8')
);
const articleImagesLib = stripComments(
  fs.readFileSync(path.join(ROOT, 'src/lib/article-images.ts'), 'utf8')
) + stripComments(
  fs.readFileSync(path.join(ROOT, 'src/lib/article-images-transform.ts'), 'utf8')
);

test('no article-page image is routed through a live resizing proxy', () => {
  assert.ok(
    !/wsrv\.nl/.test(articlePage) && !/wsrv\.nl/.test(articleImagesLib),
    'wsrv.nl must not appear anywhere in the article-page path. It is a free\n' +
      '      shared proxy with a cold cache, and putting it behind the gallery\n' +
      '      lightbox is what produced "blank while sliding" on a phone.',
  );
  /*
    The blanket ban on getCardImageSources was replaced by a narrower one, and
    the reason matters.

    The ban existed because that helper has THREE branches and only one of them
    is safe here: substackcdn URLs get a transform on Substack's own warm CDN,
    YouTube URLs get a known rendition, and everything else — including a
    Substack S3 upload — gets wsrv.nl, the reverted proxy.

    The article hero needs the substackcdn branch. Cover images arrive from a
    different field of the posts API than body images and carry NO width
    transform, so without it the hero shipped a full-resolution source as the
    eager LCP element with no srcset.

    So the helper is allowed, but ONLY behind isSubstackFetchUrl(), which makes
    the wsrv.nl branch unreachable from this page. That gate is now the thing
    under guard: delete it and the reverted behaviour returns silently.
  */
  const usesCardHelper = /getCardImageSources\s*\(/.test(articlePage);
  if (usesCardHelper) {
    assert.ok(
      /isSubstackFetchUrl\s*\([^)]*\)\s*\?\s*getCardImageSources\s*\(/.test(articlePage),
      'getCardImageSources() may only be called behind isSubstackFetchUrl(). Ungated,\n' +
        '      a Substack S3 cover resolves to a wsrv.nl URL on the LCP element, which is\n' +
        '      exactly the behaviour that was reverted.',
    );
  }
});

test('the isSubstackFetchUrl gate actually excludes the proxy branch', () => {
  // The guard above reads source text. This one proves the claim it rests on
  // against the real helper, so the two cannot drift apart.
  const s3Cover = 'https://substack-post-media.s3.amazonaws.com/public/images/a_3840x2160.png';
  assert.equal(isSubstackFetchUrl(s3Cover), false, 'an S3 cover must not pass the gate');
  assert.match(
    getCardImageSources(s3Cover).src,
    /wsrv\.nl/,
    'if this stops being a proxy URL the gate is no longer load-bearing and this whole guard should be revisited',
  );

  const cdnCover =
    'https://substackcdn.com/image/fetch/$s_!Rj68!,f_auto,q_auto:good/https%3A%2F%2Fh%2Fa_1086x1609.png';
  assert.equal(isSubstackFetchUrl(cdnCover), true);
  assert.ok(!/wsrv\.nl/.test(getCardImageSources(cdnCover).src));
});

test('the hero falls back to the original when there is no local rendition', () => {
  const hero = articlePage.slice(
    articlePage.indexOf('class="article-hero"'),
    articlePage.indexOf('class="article-hero"') + 500
  );
  assert.ok(
    /heroImageSources\?\.src \|\| article\.image/.test(hero),
    'the hero `src` must be `local || article.image`. Without the fallback, an\n' +
      '      article published between syncs — or a checkout where the sync has never\n' +
      '      run — renders an empty src, which resolves to the page URL itself.',
  );
});

test('the body transform is applied to the html that is actually rendered', () => {
  /*
    Was an exact match on `localiseBodyImages(dedupedBody)`. The call has been
    wrapped twice since — first by labelImageLinks(), then by
    stripArticleOutro(), which removes the standard closing section before the
    contents rail is built from the body.

    So the literal keeps moving, but the invariant behind it does not: the body
    that reaches localiseBodyImages must descend from `dedupedBody`, never from
    `article.bodyHtml`, or the page renders the cover image twice. That chain is
    what is pinned here, one link at a time, rather than one brittle literal.
  */
  assert.ok(
    /const bodyWithoutOutro = stripArticleOutro\(dedupedBody\)/.test(articlePage),
    'the outro must be stripped from the DEDUPED body, not from article.bodyHtml',
  );
  assert.ok(
    /localiseBodyImages\(bodyWithoutOutro\)/.test(articlePage),
    'body images must be localised from that body, not from article.bodyHtml',
  );
  assert.ok(
    /const bodyWithLocalImages = [\s\S]{0,40}localiseBodyImages\(bodyWithoutOutro\)/.test(articlePage),
    'the localised, deduped, outro-free body must be what lands in bodyWithLocalImages',
  );
  assert.ok(
    !/localiseBodyImages\(article\.bodyHtml\)/.test(articlePage),
    'localising straight from article.bodyHtml renders the cover image twice',
  );
  assert.ok(
    /labelImageLinks\(localiseBodyImages\(bodyWithoutOutro\)\)/.test(articlePage),
    'image links must be given an accessible name. Substack wraps body images in\n' +
      '      a click-to-enlarge anchor around an alt-less image, which leaves the link\n' +
      '      with no accessible name at all — Lighthouse `link-name`, WCAG 2.4.4/4.1.2.',
  );
  assert.ok(
    /buildToc\(bodyWithLocalImages\)/.test(articlePage),
    'buildToc must receive the localised body, or the contents rail is built\n' +
      '      from different html than the page renders.',
  );
});

const FIXTURE_MANIFEST = {
  'https://s3.example/big_3840x2160.jpeg': {
    src: '/article-images/abc-720.webp',
    srcset: '/article-images/abc-480.webp 480w, /article-images/abc-720.webp 720w',
  },
};
const fixtureLookup = (url) => lookupRendition(FIXTURE_MANIFEST, url);

test('a known image is rewritten to its committed rendition', () => {
  const html = '<figure><img src="https://s3.example/big_3840x2160.jpeg" alt="x"></figure>';
  const out = rewriteBodyImages(html, fixtureLookup);
  assert.ok(out.includes('src="/article-images/abc-720.webp"'), 'src must be the local file');
  assert.ok(out.includes('srcset="/article-images/abc-480.webp 480w'), 'srcset must be added');
  assert.ok(out.includes('loading="lazy"'), 'body images are below the fold');
  assert.ok(!out.includes('s3.example'), 'the original URL must be gone');
  assert.ok(out.includes('alt="x"'), 'other attributes must survive');
});

test('a URL with no manifest entry keeps its SOURCE untouched', () => {
  /*
    Was "returned BYTE-IDENTICAL". The safety property is unchanged and still
    the whole point — this can make things faster, never broken — but the
    boundary moved deliberately: `src` and `srcset` are still never touched
    without a rendition, while `loading` and `decoding` are now ALWAYS added.

    They have to be. Every body image on a Substack article is a substackcdn
    URL and ALREADY_OPTIMISED skips those, so under the old rule the images
    that needed lazy loading MOST were exactly the ones that never got it:
    three eager, full-width fetches competing with the hero for the LCP.

    That is invisible in a sandbox with no route to substackcdn, where those
    images simply fail and the page scores 98. On a runner that can reach it,
    the same page scored 75.
  */
  for (const html of [
    '<figure><img src="https://unknown.example/a.jpg" alt="x"></figure>',
    '<img src="/local/a.png">',
    '<img src="data:image/png;base64,AA">',
  ]) {
    const out = rewriteBodyImages(html, fixtureLookup);
    assert.equal(
      out.match(/src="([^"]*)"/)?.[1],
      html.match(/src="([^"]*)"/)?.[1],
      `the source must not change without a rendition: ${html}`,
    );
    assert.ok(!/srcset=/.test(out), `no srcset without a rendition: ${html}`);
    assert.match(out, /loading="lazy"/);
    assert.match(out, /decoding="async"/);
    /* Every image carries an alt (axe image-alt); an author's own is kept. */
    assert.match(out, /\salt="/, `an image left with no alt: ${html}`);
    if (/alt="x"/.test(html)) assert.match(out, /alt="x"/, 'an existing alt must never be replaced');
  }

  // No `src` at all means there is nothing to do, so it stays byte-identical.
  assert.equal(rewriteBodyImages('<img alt="no src">', fixtureLookup), '<img alt="no src">');

  assert.equal(lookupRendition(FIXTURE_MANIFEST, 'https://unknown.example/a.jpg'), null);
  for (const bad of ['', null, undefined, 42]) {
    assert.equal(lookupRendition(FIXTURE_MANIFEST, bad), null);
  }
});

test('an existing loading or decoding attribute is still never overwritten', () => {
  const html = '<img src="https://unknown.example/a.jpg" loading="eager" decoding="sync">';
  const out = rewriteBodyImages(html, fixtureLookup);
  assert.match(out, /loading="eager"/);
  assert.match(out, /decoding="sync"/);
  assert.ok(!/loading="lazy"/.test(out));
});

test('the fallback supplies a rendition when the manifest cannot', () => {
  // This is the substackcdn path: no committed rendition, but the caller can
  // still reshape the URL. Without it every Substack body image shipped at
  // w_1456 with no srcset.
  const html = '<img src="https://cdn.example/x.jpg">';
  const out = rewriteBodyImages(html, () => null, undefined, () => ({
    src: '/renditions/x-600.webp',
    srcset: '/renditions/x-400.webp 400w, /renditions/x-600.webp 600w',
  }));
  assert.match(out, /src="\/renditions\/x-600\.webp"/);
  assert.match(out, /srcset="[^"]*400w/);
  assert.match(out, /loading="lazy"/);
});

test('a throwing fallback degrades to the original source', () => {
  const html = '<img src="https://cdn.example/x.jpg">';
  const out = rewriteBodyImages(html, () => null, undefined, () => {
    throw new Error('boom');
  });
  assert.match(out, /src="https:\/\/cdn\.example\/x\.jpg"/);
  assert.ok(!/srcset=/.test(out));
});

test('an already-optimised substackcdn URL is deliberately left alone', () => {
  /* Those carry w_1456,c_limit,f_auto,q_auto:good — already renditions on a
     warm CDN, and not where the weight is. Localising them would add repo
     weight to fix nothing. */
  const url =
    'https://substackcdn.com/image/fetch/$s_!QE3h!,w_1456,c_limit,f_auto,q_auto:good/https%3A%2F%2Fx.jpg';
  assert.ok(ALREADY_OPTIMISED.test(url));
  assert.equal(
    lookupRendition({ [url]: { src: '/article-images/x-720.webp' } }, url),
    null,
    'even WITH a manifest entry it must be skipped, or the sync and the lookup\n' +
      '      disagree and a downloaded file is never used',
  );
});

test('an existing srcset/loading/decoding is never overwritten', () => {
  const html =
    '<img src="https://s3.example/big_3840x2160.jpeg" loading="eager" srcset="already 1w">';
  const out = rewriteBodyImages(html, fixtureLookup);
  assert.ok(out.includes('loading="eager"'), 'an explicit loading must survive');
  assert.ok(out.includes('srcset="already 1w"'), 'an explicit srcset must survive');
  assert.ok(!out.includes('480w'), 'and must not be joined by a second one');
});

test('a throwing lookup leaves the SOURCE verbatim', () => {
  // Same narrowing as above: the source is untouched, loading/decoding still
  // applied. A lookup that explodes must never cost the reader an image.
  const html = '<img src="https://s3.example/big_3840x2160.jpeg">';
  for (const lookup of [() => { throw new Error('boom'); }, () => ({ src: '', srcset: '' })]) {
    const out = rewriteBodyImages(html, lookup);
    assert.match(out, /src="https:\/\/s3\.example\/big_3840x2160\.jpeg"/);
    assert.ok(!/srcset=/.test(out));
    assert.match(out, /loading="lazy"/);
  }
  assert.equal(rewriteBodyImages('', fixtureLookup), '');
  assert.equal(rewriteBodyImages(null, fixtureLookup), '');
});

test('image COUNT and order are preserved by the body transform', () => {
  const html =
    '<img src="https://s3.example/big_3840x2160.jpeg"><p>a</p><img src="/rel.png"><p>b</p>' +
    '<img src="https://unknown.example/2.jpg">';
  const out = rewriteBodyImages(html, fixtureLookup);
  assert.equal((out.match(/<img/g) || []).length, 3, 'no image may be dropped');
  assert.ok(out.indexOf('abc-720') < out.indexOf('rel.png'), 'order must be preserved');
  assert.equal((out.match(/<p>/g) || []).length, 2, 'surrounding markup is untouched');
});

test('every manifest entry points at a file that is actually committed', () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'src/data/article-images.json'), 'utf8')
  );
  /*
    Entries must be NON-EMPTY first. An earlier version of the sync wrote `{}`
    for every entry — JSON.stringify's second argument is a property allowlist
    applied at every level, so passing the sorted key list stripped the nested
    src/srcset. The manifest had the right number of entries, every file was on
    disk, and every lookup returned null, so the feature was completely inert
    while looking correct. This test passed too, vacuously: with no paths in
    the entries there was nothing to find missing.
  */
  const empty = Object.entries(manifest)
    .filter(([, entry]) => !entry || !String(entry.src || '').trim())
    .map(([source]) => source.slice(0, 60));
  assert.deepEqual(
    empty,
    [],
    `${empty.length} manifest entr(ies) have no usable \`src\`. Every lookup for\n` +
      '      them returns null, so the renditions are built and never served.',
  );

  const missing = [];
  for (const [source, entry] of Object.entries(manifest)) {
    const files = [
      entry.src,
      ...String(entry.srcset || '')
        .split(',')
        .map((c) => c.trim().split(' ')[0]),
    ].filter(Boolean);
    for (const file of files) {
      if (!fs.existsSync(path.join(ROOT, 'public', file))) missing.push(`${file} (${source.slice(0, 50)})`);
    }
  }
  assert.deepEqual(
    missing,
    [],
    `${missing.length} manifest entr(ies) reference a file that is not on disk.\n` +
      '      The manifest and public/article-images/ must be committed together, or\n' +
      '      the page serves 404s where the old URL used to work.',
  );
});

if (failed > 0) {
  console.error(`\n${failed} test(s) FAILED, ${passed} passed.`);
} else {
  console.log(`All ${passed} tests passed.`);
}

/*
  ─── INTRINSIC DIMENSIONS ───────────────────────────────────────────────────

  The article hero declared width="1456" height="816" for every cover. With
  `.article-hero { width: 100%; height: auto }` the browser reserves space from
  those attributes and reflows to the real ratio on load. Every cover was 16:9,
  so the wrong constant was invisible until a 1086x1609 PORTRAIT cover shipped:
  in a 720px column the reserved box is 404px and the real box is 1067px, a
  ~660px shift on the LCP element.
*/
console.log('\nparseImageDimensions');

test('reads dimensions off a substackcdn cover with no width transform', () => {
  const url =
    'https://substackcdn.com/image/fetch/$s_!Rj68!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F66b03785-c2cf-4153-96c6-81ed4c41fd05_1086x1609.png';
  assert.deepEqual(parseImageDimensions(url), { width: 1086, height: 1609 });
});

test('prefers the filename over anything earlier in the URL', () => {
  // The transform segment carries its own digits (w_1456). Reading the FIRST
  // match instead of the last would be a plausible and wrong implementation.
  const url =
    'https://substackcdn.com/image/fetch/$s_!x!,w_1456,c_limit/https%3A%2F%2Fhost%2Fa_100x200.png%2Fb_3840x2160.png';
  assert.deepEqual(parseImageDimensions(url), { width: 3840, height: 2160 });
});

test('handles every extension Substack emits', () => {
  for (const ext of ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif']) {
    assert.deepEqual(parseImageDimensions(`https://h/x_800x600.${ext}`), { width: 800, height: 600 });
  }
});

test('returns null rather than guessing', () => {
  for (const bad of ['', null, undefined, 42, {}, 'https://h/no-dimensions.jpg', '/article-images/abc-720.webp']) {
    assert.equal(parseImageDimensions(bad), null, `should decline ${JSON.stringify(bad)}`);
  }
});

test('does not match an id that merely contains x between digits', () => {
  assert.equal(parseImageDimensions('https://h/66b03785-c2cf-4153-96c6-81ed4c41fd05.png'), null);
});

test('every cover in the real store either parses or falls back safely', () => {
  const records = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/articles.json'), 'utf-8'));
  for (const record of records) {
    const dims = parseImageDimensions(record.image);
    if (dims === null) continue; // falls back to 1456x816, which is the old behaviour
    assert.ok(dims.width > 0 && dims.height > 0, `${record.slug} produced a nonsense ratio`);
  }
});

/*
  ─── PULL QUOTES ────────────────────────────────────────────────────────────

  Substack marks one with `<div class="pullquote">`. Neither `div` nor `class`
  is on the allowlist, so the wrapper was discarded and the quote arrived as an
  ordinary bold paragraph sitting directly above the sentence it repeats.

  The fixture below is the REAL markup, taken verbatim off
  /p/why-im-actually-hyped-for-avengers.
*/
console.log('\npull quotes');

const REAL_PULLQUOTE =
  '<div class="pullquote"><p><strong>I was one of the fans who did the 22-movie Marvel Marathon</strong></p></div>';

test('the real Substack pull quote survives sanitization as a blockquote', () => {
  const out = sanitizeArticleHtml(`${REAL_PULLQUOTE}<p>Body.</p>`);
  assert.ok(out.includes('<blockquote class="pullquote">'), out);
  assert.ok(out.includes('22-movie Marvel Marathon'), out);
  assert.ok(!out.includes('<div'), 'the div wrapper must not survive');
});

test('inner markup is passed through untouched', () => {
  assert.equal(
    liftPullQuotes('<div class="pullquote"><p><strong>a</strong> <em>b</em></p></div>'),
    '<blockquote class="pullquote"><p><strong>a</strong> <em>b</em></p></blockquote>',
  );
});

test('a div that is not a pull quote is returned byte-identical', () => {
  for (const html of [
    '<div class="captioned-image-container"><img src="https://h/a.png"></div>',
    '<div>plain</div>',
    '<div class="pullquotes-roundup"><p>not it</p></div>',
    '<div class="notapullquote"><p>nor this</p></div>',
  ]) {
    assert.equal(liftPullQuotes(html), html, html);
  }
});

test('an empty pull quote is left alone rather than becoming a stray rule', () => {
  const empty = '<div class="pullquote"><p>   </p></div>';
  assert.equal(liftPullQuotes(empty), empty);
});

test('a pull quote containing a nested div is not rewritten', () => {
  // The non-greedy matcher would end at the inner </div>, so rewriting would
  // move markup around. Declining is the safe answer.
  const nested = '<div class="pullquote"><div class="x"><p>q</p></div></div>';
  assert.equal(liftPullQuotes(nested), nested);
});

test('multiple pull quotes in one body are all lifted', () => {
  const out = liftPullQuotes(`${REAL_PULLQUOTE}<p>mid</p>${REAL_PULLQUOTE}`);
  assert.equal(out.match(/<blockquote class="pullquote">/g).length, 2);
});

test('a class attribute survives ONLY as pullquote, and only on blockquote', () => {
  // The allowlist widening is the security-relevant part of this change.
  assert.ok(!sanitizeArticleHtml('<p class="pullquote">x</p>').includes('class'));
  assert.ok(!sanitizeArticleHtml('<blockquote class="tracking-pixel">x</blockquote>').includes('class'));
  assert.ok(!sanitizeArticleHtml('<blockquote class="pullquote evil">x</blockquote>').includes('evil'));
  assert.ok(sanitizeArticleHtml('<blockquote class="pullquote">x</blockquote>').includes('class="pullquote"'));
});

test('a real block quotation is still a plain blockquote', () => {
  const out = sanitizeArticleHtml('<blockquote><p>Someone else said this.</p></blockquote>');
  assert.ok(out.includes('<blockquote>'), out);
  assert.ok(!out.includes('pullquote'), out);
});

test('liftPullQuotes survives junk input', () => {
  assert.equal(liftPullQuotes(''), '');
  assert.equal(liftPullQuotes(null), '');
  assert.equal(liftPullQuotes(undefined), '');
});

/*
  ─── IMAGE LINKS NEED AN ACCESSIBLE NAME ────────────────────────────────────

  Substack wraps body images in a click-to-enlarge anchor and supplies no alt
  text, so the link had no accessible name at all — a screen reader announced
  "link" and nothing else, 29 times across the current store. Lighthouse caught
  it as `link-name`: 97% accessibility on /intel/<slug> where every other
  audited page scores 100. WCAG 2.4.4 and 4.1.2.

  The fixture is the real markup, verbatim from articles.json.
*/
console.log('\nlabelImageLinks');

const REAL_IMAGE_LINK =
  '<a target="_blank" href="https://substackcdn.com/image/fetch/x" rel="noopener noreferrer"><img src="a.png" alt="" /></a>';

test('the real Substack image link becomes a named lightbox button, with no link left', () => {
  const out = labelImageLinks(REAL_IMAGE_LINK);
  assert.match(out, /^<button type="button" class="article-image-zoom" data-lightbox-image aria-label="View image full screen">/);
  assert.match(out, /<\/button>$/);
  /* No href at all: a same-tab link still opened Substack in a tab on
     Cmd/Ctrl-click, a middle click or the context menu (owner, 2026-10). */
  assert.doesNotMatch(out, /<a\b|href=|target=|substackcdn\.com\/image\/fetch\/x/);
  assert.match(out, /<img src="a\.png" alt="" \/>/, 'the image itself is untouched');
});

test('a click-to-enlarge image that already has a name keeps its own name', () => {
  const out = labelImageLinks(
    '<a target="_blank" href="https://substackcdn.com/image/fetch/x"><img src="a.png" alt="Hal and John"></a>',
  );
  assert.match(out, /^<button [^>]*data-lightbox-image[^>]*>/);
  assert.doesNotMatch(out, /aria-label=/, 'the alt already names it; a second name would override it');
});

test("Substack's Unsplash picker links are click-to-enlarge too", () => {
  const out = labelImageLinks(
    '<a target="_blank" href="https://images.unsplash.com/photo-1?crop=entropy&amp;fm=jpg"><img src="a.png" alt=""></a>',
  );
  assert.match(out, /^<button [^>]*data-lightbox-image/);
  assert.doesNotMatch(out, /href=/);
});

test('an image the author linked to a real page is never hijacked', () => {
  const out = labelImageLinks('<a target="_blank" href="https://www.axs.com/events/1"><img src="a.png" alt=""></a>');
  assert.doesNotMatch(out, /data-lightbox-image|<button/);
  assert.match(out, /^<a target="_blank" href="https:\/\/www\.axs\.com\/events\/1"/);
});

test('running it twice changes nothing the second time', () => {
  const once = labelImageLinks(REAL_IMAGE_LINK);
  assert.equal(labelImageLinks(once), once);
});

test('a link that already has a name is left alone', () => {
  for (const html of [
    '<a href="/x" aria-label="Already named"><img src="a.png" alt=""></a>',
    '<a href="/x" aria-labelledby="cap"><img src="a.png" alt=""></a>',
    '<a href="/x"><img src="a.png" alt="A film poster"></a>',
    '<a href="/x"><img src="a.png" alt="">Read the review</a>',
  ]) {
    assert.equal(labelImageLinks(html), html, html);
  }
});

test('a link with no image is never touched', () => {
  for (const html of ['<a href="/x">Words</a>', '<a href="/x"></a>', '<p>no links here</p>']) {
    assert.equal(labelImageLinks(html), html, html);
  }
});

test('the wording matches whether it really opens a new tab', () => {
  assert.match(labelImageLinks('<a href="/x"><img src="a.png" alt=""></a>'), /aria-label="Open image"/);
  assert.match(
    labelImageLinks('<a href="/x" target="_blank"><img src="a.png" alt=""></a>'),
    /aria-label="Open image in a new tab"/,
  );
});

test('every image link or lightbox button in the real store ends up named', () => {
  const records = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/articles.json'), 'utf-8'));
  let unnamed = 0;
  let total = 0;
  for (const record of records) {
    const out = labelImageLinks(record.bodyHtml || '');
    for (const [, , attrs, inner] of out.matchAll(/<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
      if (!/<img\b/i.test(inner)) continue;
      if (inner.replace(/<[^>]*>/g, '').trim()) continue;
      total += 1;
      const named =
        /aria-label\s*=/i.test(attrs) ||
        /aria-labelledby\s*=/i.test(attrs) ||
        /\balt\s*=\s*(["'])(?!\1)/i.test(inner);
      if (!named) unnamed += 1;
    }
  }
  assert.ok(total > 0, 'expected image-wrapping links or buttons in the store');
  assert.equal(unnamed, 0, `${unnamed} of ${total} image links/buttons still have no accessible name`);
});

test('no body image in the real store is a link any more', () => {
  const records = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/articles.json'), 'utf-8'));
  const offenders = [];
  let buttons = 0;
  for (const record of records) {
    const out = labelImageLinks(record.bodyHtml || '');
    buttons += (out.match(/<button [^>]*data-lightbox-image/g) || []).length;
    for (const [, , inner] of out.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
      if (/<img\b/i.test(inner) && !inner.replace(/<[^>]*>/g, '').trim()) offenders.push(record.slug);
    }
  }
  assert.ok(buttons > 0, 'expected lightbox buttons in the store');
  assert.deepEqual(offenders, [], 'every body image should open the lightbox, never a tab (owner, 2026-10)');
});

test('labelImageLinks survives junk input', () => {
  assert.equal(labelImageLinks(''), '');
  assert.equal(labelImageLinks(null), '');
  assert.equal(labelImageLinks(undefined), '');
});
