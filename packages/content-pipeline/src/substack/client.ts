/**
 * Public Substack post ingestion client.
 * No I/O on import; transports and publication configuration are injectable.
 */
import { XMLParser } from 'fast-xml-parser';
import { parsePostHtml, parsePostsPage, type SubstackPostPayload } from './parser.ts';

export interface HttpError extends Error {
  httpStatus?: number;
}

export type RequestFn = (url: string, opts?: { timeoutMs?: number }) => Promise<string>;

export interface FetchTextOptions {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  userAgent?: string;
}

export interface SubstackSourceOptions {
  publicationUrl: string;
  feedUrl?: string;
  relayUrl?: string;
  userAgent?: string;
  pageSize?: number;
  maxPages?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  request?: RequestFn;
  warn?: (msg: string) => void;
}

export interface FetchPostsResult {
  posts: SubstackPostPayload[];
  pages: number;
  source: string;
}

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_MAX_PAGES = 250;
const DEFAULT_USER_AGENT = 'ContentPipeline-SubstackSync/1.0';

function requirePublicationUrl(publicationUrl: unknown): string {
  if (typeof publicationUrl !== 'string' || !publicationUrl.trim()) {
    throw new Error('publicationUrl is required');
  }
  const parsed = new URL(publicationUrl.trim());
  return parsed.origin;
}

function validatePost(post: SubstackPostPayload): SubstackPostPayload {
  if (
    !post ||
    typeof post !== 'object' ||
    !post.title?.trim() ||
    !(post.id || post.canonical_url || post.slug) ||
    !Number.isFinite(Date.parse(String(post.post_date ?? ''))) ||
    !Array.isArray(post.postTags) ||
    typeof post.body_html !== 'string'
  ) {
    throw new Error('Incomplete post payload: expected title, identity, date, postTags and body_html');
  }
  return post;
}

/**
 * Fetch text from a URL with bounded retries on 429, 5xx, and network errors.
 * Permanent 403 challenges fail immediately without retrying.
 */
export async function fetchText(
  url: string,
  {
    fetchImpl = fetch,
    sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    timeoutMs = 20000,
    userAgent = DEFAULT_USER_AGENT,
  }: FetchTextOptions = {},
): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'User-Agent': userAgent,
          Accept: 'application/json,application/rss+xml,application/xml,text/html;q=0.9',
        },
      });
      const body = await response.text();
      if (response.ok) return body;
      if (attempt < 2 && (response.status === 429 || response.status >= 500)) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      let detail = '';
      try {
        detail = String((JSON.parse(body) as { error?: unknown }).error ?? '')
          .replace(/\s+/g, ' ')
          .slice(0, 200);
      } catch {
        // never log challenge HTML
      }
      const error: HttpError = new Error(
        `HTTP ${response.status} from ${new URL(url).pathname}${detail ? `: ${detail}` : ''}`,
      );
      error.httpStatus = response.status;
      throw error;
    } catch (error: unknown) {
      const err = error as HttpError;
      if (err.httpStatus || attempt === 2) throw err;
      await sleep(2000 * (attempt + 1));
    }
  }
  throw new Error(`Exhausted retries fetching ${url}`);
}

function makeRequest(options: SubstackSourceOptions): RequestFn {
  if (options.request) return options.request;
  return (url, reqOpts) =>
    fetchText(url, {
      fetchImpl: options.fetchImpl,
      sleep: options.sleep,
      timeoutMs: reqOpts?.timeoutMs ?? options.timeoutMs,
      userAgent: options.userAgent,
    });
}

/** Tier 1: Paginate Substack's `/api/v1/posts` JSON endpoint directly. */
export async function fetchPostsApi(options: SubstackSourceOptions): Promise<FetchPostsResult> {
  const pubOrigin = requirePublicationUrl(options.publicationUrl);
  const request = makeRequest(options);
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;

  const posts: SubstackPostPayload[] = [];
  const seen = new Set<string>();
  const cursors = new Set<string>();
  let pagination: 'cursor' | 'offset' | undefined;
  let cursor: string | null = null;

  for (let page = 0; page < maxPages; page++) {
    const url = new URL('/api/v1/posts', pubOrigin);
    url.searchParams.set('limit', String(pageSize));
    if (pagination === 'cursor' && cursor) url.searchParams.set('cursor', cursor);
    if (pagination === 'offset') url.searchParams.set('offset', String(page * pageSize));

    const result = parsePostsPage(JSON.parse(await request(url.toString())));
    if (pagination && pagination !== result.pagination) {
      throw new Error('Posts API changed pagination during sync');
    }
    pagination = result.pagination;
    const batch = result.posts;
    if (!batch.length && !page) throw new Error('Posts API returned zero posts');

    for (const post of batch) {
      validatePost(post);
      const key = String(post.id || post.canonical_url || post.slug);
      if (seen.has(key)) throw new Error('Posts API repeated a post; pagination may be ignoring offset');
      seen.add(key);
      posts.push(post);
    }

    if (pagination === 'cursor') {
      if (!result.nextCursor) return { posts, pages: page + 1, source: 'posts API' };
      if (cursors.has(result.nextCursor)) {
        throw new Error('Posts API repeated a cursor; refusing an incomplete sync');
      }
      cursors.add(result.nextCursor);
      cursor = result.nextCursor;
    } else if (batch.length < pageSize) {
      return { posts, pages: page + 1, source: 'posts API' };
    }
  }

  throw new Error(`Posts API exceeded ${maxPages} pages; refusing an incomplete sync`);
}

/** Tier 2: Fetch through a configured Cloudflare Worker relay using the same pagination contract. */
export async function fetchPostsRelay(options: SubstackSourceOptions): Promise<FetchPostsResult> {
  requirePublicationUrl(options.publicationUrl);
  const relayUrl =
    options.relayUrl ?? (typeof process !== 'undefined' ? process.env?.SUBSTACK_RELAY_URL : undefined) ?? '';
  if (!relayUrl || !relayUrl.trim()) {
    throw new Error('No relay configured for this publication');
  }
  const baseRequest = makeRequest(options);
  const result = await fetchPostsApi({
    ...options,
    request: (url) => {
      const relay = new URL(relayUrl.trim());
      const source = new URL(url);
      for (const name of ['offset', 'cursor']) {
        const val = source.searchParams.get(name);
        if (val !== null) relay.searchParams.set(name, val);
      }
      return baseRequest(relay.toString(), { timeoutMs: 90000 });
    },
  });
  return { ...result, source: 'Cloudflare relay' };
}

/** Tier 3: Discover article URLs from public RSS and extract full post payloads from HTML. */
export async function fetchPostsHtml(options: SubstackSourceOptions): Promise<FetchPostsResult> {
  const pubOrigin = requirePublicationUrl(options.publicationUrl);
  const feedUrl = options.feedUrl?.trim() || `${pubOrigin}/feed`;
  const request = makeRequest(options);

  const xml = await request(feedUrl);
  const doc = new XMLParser({ ignoreAttributes: false, parseTagValue: false }).parse(xml) as {
    rss?: { channel?: { item?: unknown } };
  };
  const items = doc.rss?.channel?.item;
  const list = items ? (Array.isArray(items) ? items : [items]) : [];
  if (!list.length) throw new Error('RSS returned no items');

  const posts: SubstackPostPayload[] = [];
  for (const item of list) {
    const rawLink = (item as { link?: unknown })?.link;
    const link = new URL(String(rawLink ?? ''));
    if (link.origin !== pubOrigin || !link.pathname.startsWith('/p/')) {
      throw new Error('RSS contained an unexpected article URL');
    }
    posts.push(validatePost(parsePostHtml(await request(link.toString()))));
  }
  return { posts, pages: 1, source: 'RSS + post HTML' };
}

/**
 * Attempt ingestion across all three tiers in order:
 *   1. Direct Substack posts API
 *   2. Configured Cloudflare relay (if provided)
 *   3. Public RSS discovery + post HTML payload scraping
 */
export async function fetchAllPosts(options: SubstackSourceOptions): Promise<FetchPostsResult> {
  requirePublicationUrl(options.publicationUrl);
  const warn = options.warn ?? console.warn;
  const failures: string[] = [];

  for (const source of [fetchPostsApi, fetchPostsRelay, fetchPostsHtml]) {
    try {
      return await source(options);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      failures.push(msg);
      warn(`[articles] ${source.name} failed: ${msg}`);
    }
  }

  throw new Error(`All article sources failed: ${failures.join('; ')}`);
}
