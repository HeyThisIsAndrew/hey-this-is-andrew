import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchAllPosts,
  fetchPostsApi,
  fetchPostsHtml,
  fetchPostsRelay,
  fetchText,
} from '../src/substack/client.ts';

function makePost(id, slug = `post-${id}`) {
  return {
    id,
    slug,
    title: `Title ${id}`,
    canonical_url: `https://example.substack.com/p/${slug}`,
    post_date: '2026-10-01T12:00:00.000Z',
    postTags: [{ name: 'Essay' }],
    body_html: '<p>Full body content for testing.</p>',
  };
}

test('requires publicationUrl', async () => {
  await assert.rejects(() => fetchPostsApi({}), /publicationUrl is required/);
  await assert.rejects(() => fetchAllPosts({}), /publicationUrl is required/);
  await assert.rejects(() => fetchPostsRelay({ publicationUrl: 'https://example.substack.com' }), /No relay configured/);
});

test('fetchText fails fast on 403 without retrying and retries on 429', async () => {
  let calls403 = 0;
  await assert.rejects(
    () =>
      fetchText('https://example.substack.com/api/v1/posts', {
        sleep: async () => {},
        fetchImpl: async () => {
          calls403++;
          return new Response('Forbidden', { status: 403 });
        },
      }),
    /HTTP 403/,
  );
  assert.equal(calls403, 1);

  let calls429 = 0;
  const ok = await fetchText('https://example.substack.com/api/v1/posts', {
    sleep: async () => {},
    fetchImpl: async () => {
      calls429++;
      if (calls429 < 3) return new Response('Slow down', { status: 429 });
      return new Response('ok', { status: 200 });
    },
  });
  assert.equal(ok, 'ok');
  assert.equal(calls429, 3);
});

test('fetchPostsApi detects repeated cursor loops', async () => {
  await assert.rejects(
    () =>
      fetchPostsApi({
        publicationUrl: 'https://example.substack.com',
        request: async () => JSON.stringify({ posts: [makePost(1)], nextCursor: 'loop' }),
      }),
    /repeated a cursor|repeated a post/i,
  );

  let page = 0;
  await assert.rejects(
    () =>
      fetchPostsApi({
        publicationUrl: 'https://example.substack.com',
        request: async () => {
          page++;
          return JSON.stringify({ posts: [makePost(page)], nextCursor: 'same-cursor' });
        },
      }),
    /repeated a cursor/,
  );
});

test('fetchAllPosts falls back from API -> relay -> RSS + post HTML', async () => {
  const seenUrls = [];
  const warnings = [];
  const post = makePost(7, 'cinema-notes');
  const rss = `<?xml version="1.0"?><rss><channel><item><link>https://example.substack.com/p/cinema-notes</link></item></channel></rss>`;
  const html = `<html><script id="preloads-json" type="application/json">${JSON.stringify({ post })}</script></html>`;

  const result = await fetchAllPosts({
    publicationUrl: 'https://example.substack.com',
    relayUrl: 'https://relay.example.com/posts',
    warn: (m) => warnings.push(m),
    request: async (url) => {
      seenUrls.push(url);
      if (url.startsWith('https://example.substack.com/api/v1/posts')) {
        const err = new Error('HTTP 403');
        err.httpStatus = 403;
        throw err;
      }
      if (url.startsWith('https://relay.example.com/posts')) {
        const err = new Error('HTTP 502');
        err.httpStatus = 502;
        throw err;
      }
      if (url === 'https://example.substack.com/feed') return rss;
      if (url === 'https://example.substack.com/p/cinema-notes') return html;
      throw new Error(`Unexpected URL ${url}`);
    },
  });

  assert.equal(result.source, 'RSS + post HTML');
  assert.equal(result.posts.length, 1);
  assert.equal(result.posts[0].id, 7);
  assert.equal(warnings.length, 2);
  assert.ok(seenUrls.some((u) => u.startsWith('https://relay.example.com/posts')));
});

test('fetchPostsHtml rejects foreign article URLs', async () => {
  const rss = `<?xml version="1.0"?><rss><channel><item><link>https://evil.example.com/p/phish</link></item></channel></rss>`;
  await assert.rejects(
    () =>
      fetchPostsHtml({
        publicationUrl: 'https://example.substack.com',
        request: async () => rss,
      }),
    /unexpected article URL/,
  );
});
