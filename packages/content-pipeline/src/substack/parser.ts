/**
 * Substack HTML & posts API response parsers.
 * Reads embedded JSON data directly without evaluating any JavaScript.
 */

export interface SubstackPostTag {
  id?: string | number;
  name?: string;
  slug?: string;
}

export interface SubstackPostPayload {
  id?: string | number;
  slug?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  canonical_url?: string;
  link?: string;
  post_date?: string;
  pubDate?: string;
  body_html?: string;
  contentEncoded?: string;
  content?: string;
  cover_image?: string;
  enclosureUrl?: string;
  postTags?: Array<SubstackPostTag | string>;
  categories?: string[];
  [key: string]: unknown;
}

export interface ParsedPostsPage {
  posts: SubstackPostPayload[];
  nextCursor: string | null;
  pagination: 'cursor' | 'offset';
}

/**
 * Extract the embedded post payload from a public Substack article HTML document.
 * Supports both `<script id="preloads-json">` and legacy `window._preloads = JSON.parse("...")`.
 */
export function parsePostHtml(html: string): SubstackPostPayload {
  for (const [, attrs, contents] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (/\bid\s*=\s*(["'])preloads-json\1/i.test(attrs)) {
      const data = JSON.parse(contents) as { post?: SubstackPostPayload };
      if (!data?.post) throw new Error('preloads-json has no post');
      return data.post;
    }
  }

  // Older Substack pages embed a JSON string literal in JSON.parse("...").
  // Track escapes rather than guessing where that literal ends.
  const match = /window\._preloads\s*=\s*JSON\.parse\(\s*(")/.exec(html);
  if (match) {
    const start = match.index + match[0].length - 1;
    let escaped = false;
    for (let i = start + 1; i < html.length; i++) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (html[i] === '\\') {
        escaped = true;
        continue;
      }
      if (html[i] !== '"') continue;
      const data = JSON.parse(JSON.parse(html.slice(start, i + 1)) as string) as { post?: SubstackPostPayload };
      if (!data?.post) throw new Error('legacy preloads has no post');
      return data.post;
    }
  }

  throw new Error('No supported Substack post payload (expected script#preloads-json or legacy preloads)');
}

/**
 * Normalize a page returned by Substack's `/api/v1/posts` endpoint.
 * Handles both current cursor-paginated objects `{ posts, nextCursor }` and legacy offset arrays.
 */
export function parsePostsPage(value: unknown): ParsedPostsPage {
  if (Array.isArray(value)) {
    return { posts: value as SubstackPostPayload[], nextCursor: null, pagination: 'offset' };
  }
  const obj = value as Record<string, unknown> | null;
  if (
    !obj ||
    typeof obj !== 'object' ||
    !Array.isArray(obj.posts) ||
    !('nextCursor' in obj) ||
    (obj.nextCursor !== null && typeof obj.nextCursor !== 'string')
  ) {
    throw new Error('Posts API returned an unsupported page shape');
  }
  return {
    posts: obj.posts as SubstackPostPayload[],
    nextCursor: obj.nextCursor as string | null,
    pagination: 'cursor',
  };
}
