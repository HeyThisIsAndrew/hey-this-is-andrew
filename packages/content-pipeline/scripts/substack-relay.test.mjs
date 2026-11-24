import assert from 'node:assert/strict';
import test from 'node:test';
import { relayPosts } from '../worker/substack-relay.mjs';

function makePost(overrides = {}) {
  return {
    id: 101,
    slug: 'sample-post',
    title: 'Sample Coffee Talk Post',
    canonical_url: 'https://thisiscoffeetalk.substack.com/p/sample-post',
    post_date: '2026-08-31T12:00:00.000Z',
    body_html: '<p>Hello builders.</p>',
    postTags: [{ name: 'Build' }],
    ...overrides,
  };
}

function makeMemoryCache() {
  const store = new Map();
  return {
    async match(req) {
      const hit = store.get(req.url);
      return hit ? hit.clone() : undefined;
    },
    async put(req, res) {
      store.set(req.url, res.clone());
    },
  };
}

test('GET /health returns allowlisted publications', async () => {
  const res = await relayPosts(new Request('https://relay.example/health'));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.deepEqual(body.publications, ['thisiscoffeetalk']);
});

test('relay rejects non-GET, unknown handles, and malformed pagination params', async () => {
  const methodRes = await relayPosts(new Request('https://relay.example/posts/thisiscoffeetalk', { method: 'POST' }));
  assert.equal(methodRes.status, 405);
  assert.equal(methodRes.headers.get('Allow'), 'GET');

  const notFoundRes = await relayPosts(new Request('https://relay.example/posts/unknown-pub'));
  assert.equal(notFoundRes.status, 404);

  const badOffset = await relayPosts(new Request('https://relay.example/posts/thisiscoffeetalk?offset=5'));
  assert.equal(badOffset.status, 400);

  const bothParams = await relayPosts(
    new Request('https://relay.example/posts/thisiscoffeetalk?offset=0&cursor=abc'),
  );
  assert.equal(bothParams.status, 400);

  const badCursor = await relayPosts(new Request('https://relay.example/posts/thisiscoffeetalk?cursor=bad!cursor'));
  assert.equal(badCursor.status, 400);
});

test('native /api/v1/posts path returns posts and caches repeat hits', async () => {
  let upstreamCalls = 0;
  const cache = makeMemoryCache();
  const fetchUpstream = async (url) => {
    upstreamCalls++;
    assert.equal(url, 'https://thisiscoffeetalk.substack.com/api/v1/posts?limit=20');
    return new Response(JSON.stringify({ posts: [makePost()], nextCursor: 'next-1' }), { status: 200 });
  };

  const pendingWaits = [];
  const res1 = await relayPosts(new Request('https://relay.example/posts/thisiscoffeetalk'), {
    fetchUpstream,
    cache,
    waitUntil: (p) => pendingWaits.push(p),
  });
  await Promise.all(pendingWaits);
  assert.equal(res1.status, 200);
  assert.equal(res1.headers.get('Cache-Control'), 'public, max-age=300');
  const data1 = await res1.json();
  assert.equal(data1.posts.length, 1);
  assert.equal(data1.nextCursor, 'next-1');

  const res2 = await relayPosts(new Request('https://relay.example/posts/thisiscoffeetalk'), {
    fetchUpstream,
    cache,
  });
  assert.equal(res2.status, 200);
  assert.equal(upstreamCalls, 1);
});

test('browser rendering fallback decodes <pre> JSON when native API returns 403', async () => {
  const fetchUpstream = async () => new Response('Forbidden', { status: 403 });
  const browser = {
    async quickAction(action, opts) {
      assert.equal(action, 'content');
      assert.equal(opts.url, 'https://thisiscoffeetalk.substack.com/api/v1/posts?limit=20');
      const payload = JSON.stringify({ posts: [makePost()], nextCursor: null })
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return new Response(
        JSON.stringify({
          success: true,
          result: `<html><body><pre>${payload}</pre></body></html>`,
        }),
        { status: 200 },
      );
    },
  };

  const res = await relayPosts(new Request('https://relay.example/posts/thisiscoffeetalk'), {
    fetchUpstream,
    browser,
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.posts.length, 1);
  assert.equal(body.posts[0].slug, 'sample-post');
});

test('RSS + post HTML fallback succeeds when native API returns 403 and no browser binding exists', async () => {
  const postPayload = makePost({ id: 202, slug: 'from-html', canonical_url: 'https://thisiscoffeetalk.substack.com/p/from-html' });
  const fetchUpstream = async (url) => {
    if (url.includes('/api/v1/posts')) return new Response('Blocked', { status: 403 });
    if (url === 'https://thisiscoffeetalk.substack.com/feed') {
      return new Response(
        `<?xml version="1.0"?><rss><channel><item><link>https://thisiscoffeetalk.substack.com/p/from-html</link></item></channel></rss>`,
        { status: 200 },
      );
    }
    if (url === 'https://thisiscoffeetalk.substack.com/p/from-html') {
      return new Response(
        `<!doctype html><html><head><script id="preloads-json" type="application/json">${JSON.stringify({ post: postPayload })}</script></head><body></body></html>`,
        { status: 200 },
      );
    }
    throw new Error(`Unexpected upstream URL: ${url}`);
  };

  const res = await relayPosts(new Request('https://relay.example/posts/thisiscoffeetalk'), { fetchUpstream });
  assert.equal(res.status, 200);
  const posts = await res.json();
  assert.equal(Array.isArray(posts), true);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].slug, 'from-html');
});

test('foreign-origin post URLs are rejected across all tiers with 502', async () => {
  const evilPost = makePost({ canonical_url: 'https://evil.example.com/p/phish' });
  const fetchUpstream = async (url) => {
    if (url.includes('/api/v1/posts')) {
      return new Response(JSON.stringify({ posts: [evilPost], nextCursor: null }), { status: 200 });
    }
    if (url.endsWith('/feed')) {
      return new Response(
        `<?xml version="1.0"?><rss><channel><item><link>https://evil.example.com/p/phish</link></item></channel></rss>`,
        { status: 200 },
      );
    }
    return new Response('Not found', { status: 404 });
  };

  const res = await relayPosts(new Request('https://relay.example/posts/thisiscoffeetalk'), { fetchUpstream });
  assert.equal(res.status, 502);
  const body = await res.json();
  assert.match(body.error, /foreign|Unexpected article URL/i);
});
