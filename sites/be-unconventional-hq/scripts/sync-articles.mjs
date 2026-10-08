/**
 * Substack posts API → local JSON article sync.
 *
 * Counterpart to sync-youtube.mjs, and follows the same contract: dry-run by
 * default, `--execute` to write, pure functions exported for offline tests,
 * zero I/O on import.
 *
 * ─── WHY THE JSON API INSTEAD OF THE RSS FEED ─────────────────────────────
 * `/feed` (Substack's public RSS) does not carry the post's tags/keywords —
 * only the one or two categories the RSS `<category>` element happens to
 * repeat. The site's category/content-type mapping (articles-transform.ts)
 * and the "More From" related-article matching both key off tags, so a
 * source that drops most of them silently degrades both. Substack's own
 * front end loads posts from `/api/v1/posts`, an internal (undocumented, not
 * versioned, not supported) JSON endpoint — this is publication data the HQ
 * account owns, fetched the same way the public post page itself does, just
 * without rendering the page first. There is no public/stable contract here:
 * Substack can change or remove this route without notice, which is exactly
 * why every failure mode below is loud-but-non-fatal, same as the RSS path
 * it replaces — a broken endpoint must never blank the archive or fail the
 * build, only leave the snapshot exactly as it was.
 *
 * The critical behaviour is the merge. The posts endpoint returns a page of
 * recent posts (see LIMIT below), not the full history, so deriving the
 * article list from a live fetch alone would silently delete the archive on
 * the next deploy — live URLs 404, rankings die. Instead this merges into a
 * durable, version-controlled snapshot (src/data/articles.json) where
 * records are never removed. See mergeSnapshot() in
 * src/lib/articles-transform.ts.
 *
 * Deliberately does NOT touch buildArticleRecord()/mergeSnapshot(): those
 * operate on the same RawFeedItem shape regardless of source, so the
 * sanitize → categorize → merge pipeline is identical to the RSS era. Only
 * the fetch and the raw-shape mapping changed.
 *
 * Usage:
 *   node scripts/sync-articles.mjs              # dry run, prints the plan
 *   node scripts/sync-articles.mjs --execute    # writes src/data/articles.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { withFileLock } from './file-lock.mjs';
import { buildArticleRecord, mergeSnapshot } from '../src/lib/articles-transform.ts';
import { XMLParser } from 'fast-xml-parser';

const PUBLICATION_URL = process.env.SUBSTACK_PUBLICATION_URL ?? 'https://beunconventionalhq.substack.com';
const SUBSTACK_FEED = process.env.SUBSTACK_FEED_URL ?? `${PUBLICATION_URL}/feed`;
const SNAPSHOT_FILE = path.join(process.cwd(), 'src', 'data', 'articles.json');

/**
 * Posts requested per request, and the// Fetch limit from RSS. Substack's RSS usually returns 20 items.
// We only fetch HTML pages for posts we haven't seen yet to avoid rate limits.
const PAGE_SIZE = 20;

/** Coerce a possibly-singular API response into an array. */
function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * A post's keywords, normalized to plain strings.
 *
 * The posts endpoint carries these as `postTags`: an array of `{ id, name,
 * slug }` objects, not plain strings — RSS's flat `<category>` text is the
 * thing this replaces. Tolerates a bare string too, in case a future
 * response shape simplifies it.
 */
function mapTags(post) {
  return asArray(post?.postTags)
    .map((tag) => (typeof tag === 'string' ? tag : tag?.name))
    .map((tag) => String(tag ?? '').trim())
    .filter(Boolean);
}

/**
 * Parse the posts API's JSON body into raw feed items — the same shape
 * `buildArticleRecord()` has always consumed, so nothing downstream needs to
 * know the source changed.
 *
 * Field mapping, undocumented API → RawFeedItem:
 *   title          title
 *   canonical_url  link            (falls back to `${pub}/p/${slug}`)
 *   id             guid            (a stable numeric post id, unlike RSS's
 *                                    permalink-as-guid — a post's URL can be
 *                                    edited, its id cannot)
 *   post_date      pubDate
 *   subtitle       description     (Substack's own dek/teaser text)
 *   body_html      contentEncoded
 *   postTags       categories      (see mapTags())
 *   cover_image    enclosureUrl
 */
export function parsePostsResponse(json) {
  const safeStr = (val) => (typeof val === 'string' || typeof val === 'number') ? String(val).trim() : '';

  return asArray(json).map((post) => {
    if (!post || typeof post !== 'object') return {};
    
    const slug = safeStr(post.slug);
    const link = safeStr(post.canonical_url ?? post.link) || (slug ? `${PUBLICATION_URL}/p/${slug}` : '');

    return {
      title: safeStr(post.title),
      link,
      guid: safeStr(post.id ?? post.guid) || link,
      pubDate: safeStr(post.post_date ?? post.pubDate),
      description: safeStr(post.subtitle ?? post.description),
      contentEncoded: safeStr(post.body_html ?? post.contentEncoded ?? post.content),
      categories: mapTags(post).length ? mapTags(post) : (Array.isArray(post.categories) ? post.categories.filter(c => typeof c === 'string') : []),
      enclosureUrl: safeStr(post.cover_image ?? post.enclosureUrl),
    };
  });
}

/**
 * Turn raw feed items into records, skipping anything malformed.
 * Returns the records plus the skip reasons, so the caller can log loudly
 * without the whole run failing on one bad post.
 */
export function planArticleSync(rawItems, existing = [], now = new Date()) {
  const records = [];
  const skipped = [];

  for (const [index, raw] of rawItems.entries()) {
    let record = null;
    try {
      record = buildArticleRecord(raw, now);
    } catch (err) {
      skipped.push({ index, title: raw?.title ?? '(untitled)', reason: err.message });
      continue;
    }
    if (!record) {
      skipped.push({
        index,
        title: raw?.title ?? '(untitled)',
        reason: 'missing title or guid/link',
      });
      continue;
    }
    records.push(record);
  }

  const { merged, added, updated } = mergeSnapshot(existing, records);
  return { merged, added, updated, skipped, parsed: records.length };
}

function readSnapshot() {
  try {
    const raw = fs.readFileSync(SNAPSHOT_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    /*
      Drop anything generated by scripts/mock-articles.mjs.

      This matters because mergeSnapshot() is never-delete by design — real
      posts must survive ageing out of the API's rolling window. Without
      this filter, test content written during development would inherit
      that protection and live in the snapshot permanently.
    */
    const real = parsed.filter((record) => !record?.isMock);
    const dropped = parsed.length - real.length;
    if (dropped > 0) {
      console.warn(`[articles] Ignoring ${dropped} mock record(s) — a real sync always clears them.`);
      console.warn('[articles] (Use `npm run mock-articles -- --restore` to get your real snapshot back.)');
    }
    return real;
  } catch {
    return [];
  }
}

/**
 * Fetch the publication's RSS feed, then fetch the HTML page for each post
 * to extract the `window._preloads` JSON object, bypassing Cloudflare's bot block.
 */
async function fetchAllPosts() {
  const collected = [];

  // 1. Fetch RSS feed to get the latest posts
  let xml = '';
  try {
    const response = await fetch(SUBSTACK_FEED, {
      signal: AbortSignal.timeout(15000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/rss+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    xml = await response.text();
  } catch (err) {
    console.warn(`[articles] ⚠ Direct RSS fetch failed (${err.message}), falling back to proxy...`);
    const apiUrl = `${PUBLICATION_URL}/api/v1/posts?limit=50`;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(apiUrl)}`;
    const proxyRes = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
    if (!proxyRes.ok) throw new Error(`HTTP ${proxyRes.status} from proxy`);
    
    // Check if proxy actually returned JSON
    const contentType = proxyRes.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(`Proxy did not return JSON. Content-Type: ${contentType}`);
    }
    
    const proxyJson = await proxyRes.json();
    
    // allorigins returns the response body as a string in the "contents" field
    let collected;
    try {
      collected = JSON.parse(proxyJson.contents);
    } catch (e) {
      throw new Error(`Failed to parse proxy contents: ${e.message}`);
    }
    
    if (!Array.isArray(collected)) throw new Error('Proxy did not return an array of posts');
    
    // Return early since we can't scrape HTML via proxy anyway
    return { posts: collected, pages: 1 };
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
  });
  const doc = parser.parse(xml);
  const items = doc.rss?.channel?.item ? asArray(doc.rss.channel.item) : [];
  
  if (items.length === 0) throw new Error('No items in RSS feed');
  // 2. Fetch HTML for each item
  for (const item of items) {
    const link = item.link;
    if (!link) continue;

    // To prevent updating every old post every run and getting rate limited,
    // we could skip fetching if it hasn't changed. But Substack's JSON endpoint
    // updated *everything*. We'll fetch the HTML for all RSS items since it's only ~20 max.
    try {
      const htmlRes = await fetch(link, {
        signal: AbortSignal.timeout(15000),
        headers: {
          // Real Chrome always ends `Safari/537.36`, whatever the Chrome
          // version — that trailing token is a compatibility relic, not a
          // version number. This had been changed to `Safari/122.0.0.0`,
          // which no real browser sends, so it made the request MORE
          // fingerprintable as automation. That is backwards for the one
          // code path whose entire purpose is not being turned away by
          // Cloudflare. Matches the five other UA strings in scripts/.
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
        },
      });
      if (!htmlRes.ok) {
        console.warn(`[articles] ⚠ Failed to fetch HTML for ${link}: HTTP ${htmlRes.status}`);
        continue;
      }
      const html = await htmlRes.text();
      
      // Safely extract window._preloads without vulnerable regex
      const preloadsMatch = html.match(/window\._preloads\s*=\s*JSON\.parse\("/);
      let match = null;
      
      if (preloadsMatch) {
        const startIdx = preloadsMatch.index + preloadsMatch[0].length;
        let endIdx = -1;
        for (let i = startIdx; i < html.length; i++) {
          // Look for an unescaped closing quote followed by parenthesis
          if (html[i] === '"' && html[i+1] === ')' && html[i-1] !== '\\') {
            endIdx = i;
            break;
          }
        }
        if (endIdx !== -1) {
          match = [null, '"' + html.substring(startIdx, endIdx) + '"'];
        }
      }
      
      if (match) {
        const parsed = JSON.parse(JSON.parse(match[1]));
        if (parsed.post) {
          collected.push(parsed.post);
        } else {
          console.warn(`[articles] ⚠ No post object in preloads for ${link}`);
        }
      } else {
        console.warn(`[articles] ⚠ Could not find window._preloads in HTML for ${link}`);
      }
    } catch (err) {
      console.warn(`[articles] ⚠ Error fetching HTML for ${link}: ${err.message}`);
    }
  }

  // We consider it 1 "page" of RSS items
  return { posts: collected, pages: 1 };
}

async function run() {
  const execute = process.argv.includes('--execute');
  const existing = readSnapshot();

  console.log(`[articles] Snapshot holds ${existing.length} record(s).`);
  console.log(`[articles] Fetching RSS ${SUBSTACK_FEED} and scraping HTML pages to bypass blocks`);

  let posts;
  let pages;
  try {
    ({ posts, pages } = await fetchAllPosts());
  } catch (err) {
    // Loud, but never fatal — the snapshot is the source of truth for the build.
    console.error(`[articles] ✗ POSTS FETCH FAILED: ${err.message}`);
    console.error('[articles] Snapshot left untouched; the build will use the last good copy.');
    console.error('[articles] No records were removed. Re-run when the endpoint is reachable.');
    process.exitCode = existing.length > 0 ? 0 : 1;
    return;
  }

  const rawItems = parsePostsResponse(posts);
  const { merged, added, updated, skipped, parsed } = planArticleSync(rawItems, existing);

  console.log(
    `[articles] API returned ${posts.length} post(s) across ${pages} page(s); ${parsed} parsed cleanly.`,
  );
  for (const skip of skipped) {
    console.warn(`[articles] ⚠ skipped item ${skip.index} "${skip.title}": ${skip.reason}`);
  }
  console.log(`[articles] ${added} new, ${updated} updated, ${merged.length} total after merge.`);

  const withoutBody = merged.filter((r) => !r.hasBody);
  if (withoutBody.length > 0) {
    console.warn(
      `[articles] ⚠ ${withoutBody.length} record(s) have no full body and will NOT get a local page ` +
        '(their cards keep linking to Substack):',
    );
    for (const r of withoutBody) console.warn(`[articles]     - ${r.title}`);
  }

  if (!execute) {
    console.log('[dry-run] Nothing written. Pass --execute to write src/data/articles.json.');
    return;
  }

  await withFileLock(SNAPSHOT_FILE, async () => {
    fs.writeFileSync(SNAPSHOT_FILE, `${JSON.stringify(merged, null, 2)}\n`);
  });
  console.log(`[articles] ✓ Wrote ${merged.length} record(s) to src/data/articles.json`);
}

// Only run when invoked directly, so importing this module for tests does no I/O.
if (process.argv[1] && process.argv[1].endsWith('sync-articles.mjs')) {
  run();
}
