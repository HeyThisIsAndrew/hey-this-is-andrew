/**
 * Multi-publication Substack relay Worker for GitHub Actions runners.
 * Serves only public posts from an explicit publication allowlist — no credentials,
 * cookies, or caller-controlled upstream URLs.
 */
import { XMLParser } from 'fast-xml-parser';
import { parsePostHtml, parsePostsPage } from '../src/substack/parser.ts';

export const PUBLICATIONS = {
  thisiscoffeetalk: 'https://thisiscoffeetalk.substack.com',
};

const PAGE_SIZE = 20;
const REQUEST_TIMEOUT_MS = 15000;
const CACHE_CONTROL = 'public, max-age=300';
const API_USER_AGENT = 'ContentPipeline-SubstackRelay/1.0';
const WEB_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

/** Decode Chrome's `<pre>`-wrapped JSON/XML response once without evaluating markup. */
export function browserTextDocument(html) {
  const pre = String(html ?? '').match(/<pre\b[^>]*>([\s\S]*?)<\/pre>/i);
  if (!pre) return String(html ?? '');
  const value = new XMLParser({ parseTagValue: false }).parse(`<pre>${pre[1]}</pre>`).pre;
  if (typeof value !== 'string') {
    throw new Error('Browser source returned an invalid text document');
  }
  return value;
}

/** Fetch an allowlisted `/api/v1/posts` URL via Cloudflare Browser Rendering. */
export async function renderPublicSubstack(browser, url, allowedOrigin) {
  const target = new URL(url);
  const offset = target.searchParams.get('offset');
  const cursor = target.searchParams.get('cursor');
  const validApi =
    target.origin === allowedOrigin &&
    target.pathname === '/api/v1/posts' &&
    target.searchParams.get('limit') === String(PAGE_SIZE) &&
    [...target.searchParams.keys()].every((k) => ['limit', 'cursor', 'offset'].includes(k)) &&
    ['limit', 'cursor', 'offset'].every((k) => target.searchParams.getAll(k).length <= 1) &&
    (!cursor || /^[A-Za-z0-9+/=_-]{1,512}$/.test(cursor)) &&
    (!offset || (/^(0|[1-9]\d*)$/.test(offset) && Number(offset) <= 5000 && Number(offset) % PAGE_SIZE === 0));

  if (!validApi) {
    throw new Error('Browser source only accepts allowlisted Substack /api/v1/posts queries');
  }
  if (!browser?.quickAction) {
    throw new Error('Substack browser source is not configured');
  }

  const response = await browser.quickAction('content', {
    url: target.toString(),
    rejectResourceTypes: ['image', 'media', 'font', 'stylesheet', 'script'],
    gotoOptions: { waitUntil: 'domcontentloaded', timeout: REQUEST_TIMEOUT_MS },
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Substack browser source failed: HTTP ${response.status}`);
  }

  let html;
  try {
    const payload = JSON.parse(raw);
    if (payload.success === false) {
      throw new Error('Browser source did not return successful content');
    }
    html = payload.result;
  } catch (err) {
    if (!(err instanceof SyntaxError)) throw err;
    html = raw;
  }

  if (typeof html !== 'string' || !html.trim()) {
    throw new Error('Browser source returned empty content');
  }
  return html;
}

function validatePost(post, publicationOrigin) {
  if (
    !post ||
    typeof post !== 'object' ||
    typeof post.title !== 'string' ||
    !post.title.trim() ||
    !(post.id || post.canonical_url || post.slug) ||
    !Number.isFinite(Date.parse(String(post.post_date ?? ''))) ||
    typeof post.body_html !== 'string' ||
    !Array.isArray(post.postTags)
  ) {
    throw new Error('Substack returned an incomplete post payload');
  }

  const rawLink =
    typeof post.canonical_url === 'string' && post.canonical_url.trim()
      ? post.canonical_url.trim()
      : typeof post.slug === 'string' && post.slug.trim()
        ? `${publicationOrigin}/p/${post.slug.trim()}`
        : '';

  if (!rawLink) {
    throw new Error('Substack post lacks a canonical URL or slug');
  }

  const link = new URL(rawLink);
  if (link.origin !== publicationOrigin || !link.pathname.startsWith('/p/')) {
    throw new Error(`Substack API returned a foreign or invalid article URL: ${link.origin}${link.pathname}`);
  }

  return post;
}

function validatePostsBatch(posts, publicationOrigin, { requireNonEmpty = false } = {}) {
  if (!Array.isArray(posts) || posts.length > PAGE_SIZE || (requireNonEmpty && posts.length === 0)) {
    throw new Error('Substack API returned an invalid article page');
  }
  const seen = new Set();
  for (const post of posts) {
    validatePost(post, publicationOrigin);
    const key = String(post.id || post.canonical_url || post.slug);
    if (seen.has(key)) {
      throw new Error('Substack API returned a duplicate article in page');
    }
    seen.add(key);
  }
}

async function fetchUpstreamText(fetchUpstream, url, headers) {
  const response = await fetchUpstream(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    redirect: 'manual',
    headers,
  });
  if (!response.ok) {
    throw new Error(`Substack returned HTTP ${response.status} from ${new URL(url).pathname}`);
  }
  return response.text();
}

function jsonSuccess(payload, cacheKey, cache, waitUntil) {
  const response = Response.json(payload, {
    headers: {
      'Cache-Control': CACHE_CONTROL,
      'X-Content-Type-Options': 'nosniff',
    },
  });
  if (cache) {
    waitUntil(Promise.resolve(cache.put(cacheKey, response.clone())).catch(() => {}));
  }
  return response;
}

/** Handle GET /health and GET /posts/:handle relay requests. */
export async function relayPosts(
  request,
  { publications = PUBLICATIONS, fetchUpstream = fetch, browser, cache, waitUntil = () => {} } = {},
) {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } });
  }

  const url = new URL(request.url);
  if (url.pathname === '/health') {
    return Response.json(
      { ok: true, publications: Object.keys(publications) },
      { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } },
    );
  }

  const match = url.pathname.match(/^\/posts\/([a-z0-9-]+)$/);
  if (!match) {
    return new Response('Not found', { status: 404 });
  }

  const handle = match[1];
  const publicationOrigin = publications[handle];
  if (!publicationOrigin) {
    return new Response('Not found', { status: 404 });
  }

  const offset = url.searchParams.get('offset');
  const cursor = url.searchParams.get('cursor');
  if (
    [...url.searchParams.keys()].some((k) => k !== 'offset' && k !== 'cursor') ||
    url.searchParams.getAll('offset').length > 1 ||
    url.searchParams.getAll('cursor').length > 1 ||
    (offset !== null && (!/^(0|[1-9]\d*)$/.test(offset) || Number(offset) > 5000 || Number(offset) % PAGE_SIZE !== 0)) ||
    (cursor !== null && !/^[A-Za-z0-9+/=_-]{1,512}$/.test(cursor)) ||
    (offset !== null && cursor !== null)
  ) {
    return new Response('Expected one optional cursor or offset=0,20,...,5000', { status: 400 });
  }

  const normalizedQuery = cursor
    ? `?cursor=${encodeURIComponent(cursor)}`
    : offset !== null
      ? `?offset=${offset}`
      : '';
  const cacheKey = new Request(`https://andrew-substack-relay.internal/posts/${handle}${normalizedQuery}`);
  const cached = await cache?.match(cacheKey);
  if (cached) return cached;

  const apiUrl = new URL('/api/v1/posts', publicationOrigin);
  apiUrl.searchParams.set('limit', String(PAGE_SIZE));
  if (cursor) apiUrl.searchParams.set('cursor', cursor);
  if (offset !== null) apiUrl.searchParams.set('offset', offset);

  const isFirstPage = !cursor && (!offset || offset === '0');
  const failures = [];

  // Attempt 1: Native edge /api/v1/posts fetch
  try {
    const body = await fetchUpstreamText(fetchUpstream, apiUrl.toString(), {
      Accept: 'application/json',
      'User-Agent': API_USER_AGENT,
    });
    const parsed = parsePostsPage(JSON.parse(body));
    validatePostsBatch(parsed.posts, publicationOrigin, { requireNonEmpty: isFirstPage });
    return jsonSuccess({ posts: parsed.posts, nextCursor: parsed.nextCursor }, cacheKey, cache, waitUntil);
  } catch (err) {
    failures.push(`native API: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Attempt 2: Cloudflare Browser Rendering fallback for /api/v1/posts
  if (browser?.quickAction) {
    try {
      const rendered = await renderPublicSubstack(browser, apiUrl.toString(), publicationOrigin);
      const parsed = parsePostsPage(JSON.parse(browserTextDocument(rendered)));
      validatePostsBatch(parsed.posts, publicationOrigin, { requireNonEmpty: isFirstPage });
      return jsonSuccess({ posts: parsed.posts, nextCursor: parsed.nextCursor }, cacheKey, cache, waitUntil);
    } catch (err) {
      failures.push(`browser API: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Attempt 3: Public RSS + post HTML scraping fallback
  try {
    const rssXml = await fetchUpstreamText(fetchUpstream, `${publicationOrigin}/feed`, {
      Accept: 'application/rss+xml,application/xml,text/xml;q=0.9',
      'User-Agent': WEB_USER_AGENT,
    });
    const doc = new XMLParser({ parseTagValue: false }).parse(rssXml);
    const rawItems = doc.rss?.channel?.item;
    const feed = rawItems ? (Array.isArray(rawItems) ? rawItems : [rawItems]) : [];
    if (!feed.length) {
      throw new Error('Substack RSS returned no items');
    }

    const start = Number(offset ?? 0);
    const windowItems = feed.slice(start, start + PAGE_SIZE);
    const posts = new Array(windowItems.length);
    let next = 0;

    await Promise.all(
      Array.from({ length: Math.min(4, windowItems.length) }, async () => {
        while (next < windowItems.length) {
          const index = next++;
          const link = new URL(String(windowItems[index]?.link ?? ''));
          if (link.origin !== publicationOrigin || !link.pathname.startsWith('/p/')) {
            throw new Error(`Unexpected article URL in Substack RSS: ${link.origin}${link.pathname}`);
          }
          const postHtml = await fetchUpstreamText(fetchUpstream, link.toString(), {
            Accept: 'text/html,application/xhtml+xml;q=0.9',
            'User-Agent': WEB_USER_AGENT,
          });
          posts[index] = validatePost(parsePostHtml(postHtml), publicationOrigin);
        }
      }),
    );

    validatePostsBatch(posts, publicationOrigin, { requireNonEmpty: isFirstPage });
    return jsonSuccess(posts, cacheKey, cache, waitUntil);
  } catch (err) {
    failures.push(`RSS + HTML: ${err instanceof Error ? err.message : String(err)}`);
  }

  return Response.json(
    { error: failures.join('; ') },
    { status: 502, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } },
  );
}

export default {
  async fetch(request, env, ctx) {
    return relayPosts(request, {
      browser: env?.BROWSER,
      cache: globalThis.caches?.default,
      waitUntil: (promise) => ctx?.waitUntil?.(promise),
    });
  },
};
