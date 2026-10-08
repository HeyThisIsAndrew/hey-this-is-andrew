/**
 * The standard article outro leaves the body, and leaves the contents rail.
 *
 * ─── WHAT THIS IS GUARDING ──────────────────────────────────────────────────
 * The outro is typed into every Substack post, so it arrives inside `bodyHtml`.
 * Three separate faults came from that: it rendered as article content, its
 * sign-off was authored as an <h4> and rendered at section size, and BOTH of
 * its headings were indexed into the contents rail by buildToc().
 *
 * The strip is matched on STRUCTURE — a trailing <hr>, a heading, and repeated
 * links to our own properties — precisely so an edit to the prose does not
 * silently stop it working. These assertions are written the same way: they
 * change the copy and expect the strip to hold.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripArticleOutro, hasArticleOutro } from '../src/lib/article-outro.ts';
import { buildToc } from '../src/lib/article-toc.ts';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const raw = JSON.parse(fs.readFileSync(path.join(repoRoot, 'src/data/articles.json'), 'utf8'));
const articles = Array.isArray(raw) ? raw : raw.articles || raw.items || [];

/** The real thing, as the sync delivers it. */
const OUTRO = `<hr />
<h4>Where Nerd Culture Gets Cinematic</h4>
<blockquote><p><strong><a href="https://beunconventionalhq.com/">BE Unconventional HQ</a></strong> is a publication for fans who love the craft behind the stories.</p></blockquote>
<p>Subscribe to our <a href="https://www.google.com/search?q=https://beunconventionalhq.substack.com">Substack publication</a>. Check out the <a href="https://www.google.com/search?q=https://youtube.com/%40BeUnconventionalHQ">YouTube channel</a>.</p>
<h4><strong>BE YOURSELF. BE PASSIONATE. BE UNCONVENTIONAL.</strong></h4>`;

const BODY = `<p>The author's first paragraph.</p>
<h2>A real section of the post</h2>
<p>The author's last paragraph.</p>`;

test('the outro is removed and the author’s copy is not', () => {
  const stripped = stripArticleOutro(`${BODY}\n${OUTRO}`);
  assert.ok(!stripped.includes('Where Nerd Culture Gets Cinematic'));
  assert.ok(!stripped.includes('BE YOURSELF'));
  assert.ok(stripped.includes("The author's last paragraph."));
  assert.ok(stripped.includes('A real section of the post'));
});

test('neither outro heading reaches the contents rail', () => {
  const { entries } = buildToc(stripArticleOutro(`${BODY}\n${OUTRO}`));
  const text = entries.map((e) => e.text.toLowerCase()).join(' | ');
  assert.ok(!text.includes('nerd culture'), `rail still lists the outro: ${text}`);
  assert.ok(!text.includes('be yourself'), `rail still lists the sign-off: ${text}`);
  assert.ok(text.includes('a real section'), `rail lost the author’s headings: ${text}`);
});

/*
  The whole reason the match is structural. If these fail, the strip has been
  re-anchored to the words and will break the next time an editor touches them.
*/
test('rewriting every sentence does not break the strip', () => {
  const rewritten = OUTRO
    .replace('Where Nerd Culture Gets Cinematic', 'Something Entirely Different')
    .replace('BE YOURSELF. BE PASSIONATE. BE UNCONVENTIONAL.', 'A NEW SIGN OFF ENTIRELY')
    .replace('is a publication for fans who love the craft behind the stories.', 'has changed its mind about everything.');
  const stripped = stripArticleOutro(`${BODY}\n${rewritten}`);
  assert.ok(!stripped.includes('Something Entirely Different'));
  assert.ok(!stripped.includes('A NEW SIGN OFF ENTIRELY'));
  assert.ok(stripped.includes("The author's last paragraph."));
});

test('a post written before the convention is returned untouched', () => {
  assert.equal(stripArticleOutro(BODY), BODY);
  assert.equal(hasArticleOutro(BODY), false);
});

/*
  A partial strip is the dangerous failure: it is not obvious on the page, where
  leaving the whole outro in place is. So anything that does not clearly match
  must come back whole.
*/
test('a trailing rule that is not the outro is left alone', () => {
  const ordinary = `${BODY}\n<hr />\n<h2>Afterword</h2>\n<p>Just a closing thought.</p>`;
  assert.equal(stripArticleOutro(ordinary), ordinary);

  const oneLink = `${BODY}\n<hr />\n<h2>Afterword</h2>\n<p>See <a href="https://beunconventionalhq.com/">the site</a>.</p>`;
  assert.equal(stripArticleOutro(oneLink), oneLink, 'one link to us is not an outro');

  const noHeading = `${BODY}\n<hr />\n<p>beunconventionalhq beunconventionalhq</p>`;
  assert.equal(stripArticleOutro(noHeading), noHeading, 'the outro leads with a heading');
});

test('only the LAST rule is treated as the divider', () => {
  const midRule = `<p>Intro.</p>\n<hr />\n<h2>Section</h2>\n<p>Body.</p>\n${OUTRO}`;
  const stripped = stripArticleOutro(midRule);
  assert.ok(stripped.includes('<h2>Section</h2>'), 'a mid-post rule must survive');
  assert.ok(stripped.includes('Body.'));
  assert.ok(!stripped.includes('BE YOURSELF'));
});

/*
  The page renders <ArticleOutro /> only where the strip matched, so a post from
  before the convention keeps the ending its author actually wrote. `hadOutro`
  on the page is derived from the strip, and this is the predicate behind it.
*/
test('only a post that carried the outro is flagged as having one', () => {
  assert.equal(hasArticleOutro(`${BODY}\n${OUTRO}`), true);
  assert.equal(hasArticleOutro(BODY), false, 'a pre-convention post must not be retro-fitted');
});

test('the page gates the component on the strip, not on a second check', () => {
  const page = fs.readFileSync(path.join(repoRoot, 'src/pages/intel/[slug].astro'), 'utf8');
  assert.match(
    page,
    /const hadOutro = bodyWithoutOutro !== dedupedBody/,
    'the flag must come from the strip so the two cannot disagree',
  );
  assert.match(page, /\{hadOutro && <ArticleOutro \/>\}/, 'the component must be gated');
});

test('an empty or missing body does not throw', () => {
  assert.equal(stripArticleOutro(''), '');
  assert.equal(stripArticleOutro(undefined), '');
  assert.equal(stripArticleOutro(null), '');
});

/*
  Against the real store rather than a fixture: the fixture above is my reading
  of the sync's output, and this is the check that the reading is right.
*/
test('the live post carrying the outro is stripped clean', () => {
  const withOutro = articles.filter((a) => hasArticleOutro(a.bodyHtml || ''));
  assert.ok(
    withOutro.length >= 1,
    'no article in the store carries the outro — has the sync changed its markup?',
  );

  for (const article of withOutro) {
    const stripped = stripArticleOutro(article.bodyHtml);
    assert.ok(
      !/Where Nerd Culture Gets Cinematic/i.test(stripped),
      `${article.slug}: heading survived the strip`,
    );
    assert.ok(
      !/BE YOURSELF\. BE PASSIONATE\./i.test(stripped),
      `${article.slug}: sign-off survived the strip`,
    );
    assert.ok(stripped.length > 0, `${article.slug}: the strip emptied the body`);

    const { entries } = buildToc(stripped);
    const text = entries.map((e) => e.text.toLowerCase()).join(' | ');
    assert.ok(!text.includes('nerd culture'), `${article.slug}: outro still in the rail`);
    assert.ok(!text.includes('be yourself'), `${article.slug}: sign-off still in the rail`);
  }
});
