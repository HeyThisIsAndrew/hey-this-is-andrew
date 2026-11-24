import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePostHtml, parsePostsPage } from '../src/substack/parser.ts';

test('parsePostHtml extracts post from script#preloads-json', () => {
  const html = `<!doctype html><html><head>
    <script id="preloads-json" type="application/json">{"post":{"id":42,"title":"Hello","slug":"hello","post_date":"2026-10-01T12:00:00Z","postTags":[],"body_html":"<p>Body</p>"}}</script>
  </head><body></body></html>`;

  const post = parsePostHtml(html);
  assert.equal(post.id, 42);
  assert.equal(post.title, 'Hello');
  assert.equal(post.slug, 'hello');
});

test('parsePostHtml extracts post from legacy window._preloads with escaped quotes and backslashes', () => {
  const payload = JSON.stringify({
    post: {
      id: 99,
      title: 'Quote "Test" \\ Path',
      slug: 'quote-test',
      post_date: '2026-09-01T00:00:00Z',
      postTags: [],
      body_html: '<p>Escaped \\\\ and "quotes"</p>',
    },
  });
  const escapedLiteral = JSON.stringify(payload);
  const html = `<script>window._preloads = JSON.parse(${escapedLiteral});</script>`;

  const post = parsePostHtml(html);
  assert.equal(post.id, 99);
  assert.equal(post.title, 'Quote "Test" \\ Path');
  assert.equal(post.body_html, '<p>Escaped \\\\ and "quotes"</p>');
});

test('parsePostHtml throws when payload is missing or lacks post', () => {
  assert.throws(
    () => parsePostHtml('<html><body>no payload</body></html>'),
    /No supported Substack post payload/,
  );
  assert.throws(
    () => parsePostHtml('<script id="preloads-json" type="application/json">{}</script>'),
    /preloads-json has no post/,
  );
});

test('parsePostsPage handles cursor object and legacy offset array', () => {
  const cursorPage = parsePostsPage({ posts: [{ id: 1 }], nextCursor: 'abc' });
  assert.equal(cursorPage.pagination, 'cursor');
  assert.equal(cursorPage.nextCursor, 'abc');
  assert.equal(cursorPage.posts.length, 1);

  const offsetPage = parsePostsPage([{ id: 2 }]);
  assert.equal(offsetPage.pagination, 'offset');
  assert.equal(offsetPage.nextCursor, null);
  assert.equal(offsetPage.posts.length, 1);
});

test('parsePostsPage throws on invalid shape', () => {
  assert.throws(() => parsePostsPage({ posts: 'bad', nextCursor: null }), /unsupported page shape/);
  assert.throws(() => parsePostsPage({ posts: [] }), /unsupported page shape/);
  assert.throws(() => parsePostsPage(null), /unsupported page shape/);
});
