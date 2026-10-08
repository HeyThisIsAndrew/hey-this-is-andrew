/**
 * Substack RSS → article record pipeline.
 *
 * Build-time only. Imported by `scripts/sync-articles.mjs` and its test suite,
 * never by a page — the snapshot stores already-sanitized HTML, so
 * `sanitize-html` stays out of the site bundle entirely.
 *
 * Every function here is pure so the whole pipeline is testable offline
 * against a fixture feed, with no network.
 */
import { PUBLISH_TIME_ZONE } from './publish-timezone.js';
import sanitizeHtml from 'sanitize-html';
import { CATEGORIES } from '../data/constants.js';

/** Semantic tags only. No styling, no embeds, no scripts. */
const ALLOWED_TAGS = [
  'p', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'hr',
  'a', 'img', 'figure', 'figcaption', 'em', 'strong', 'code', 'pre', 'br',
  'substack-gallery', 'youtube-embed'
];

const ALLOWED_ATTRS: Record<string, string[]> = {
  a: ['href', 'title', 'rel', 'target'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  'substack-gallery': [],
  'youtube-embed': ['video-id'],
};

/**
 * Demote in-body headings by one level.
 *
 * The page's own <h1> is the article title, so a Substack body that opens with
 * an h1 would produce two. h1→h2, h2→h3, h3→h4; h4 and below are clamped at
 * h4 rather than pushed to h5/h6, which keeps the outline shallow and valid.
 *
 * Runs BEFORE sanitization so the allowlist (which has no h1) sees the
 * already-demoted markup rather than silently dropping the heading text.
 */
export function demoteHeadings(html: string): string {
  if (!html) return '';
  return html.replace(
    // Safely match attributes even if they contain >, by skipping over quoted strings
    /<(\/?)h([1-6])\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi,
    (_m, slash: string, level: string, rest: string) => {
      const demoted = Math.min(Number(level) + 1, 4);
      return `<${slash}h${demoted}${rest}>`;
    },
  );
}

/**
 * Extracts Substack image gallery JSON payloads and replaces them with a custom
 * <substack-gallery> element containing native <img> tags for SEO/No-JS fallback.
 * Must run BEFORE sanitization so the payload is not stripped.
 */
export function extractSubstackGalleries(html: string): string {
  if (!html) return '';
  return html.replace(
    // Safely match attributes even if they contain >, by skipping over quoted strings
    /<div\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/div>/gi,
    (match, attrs) => {
      // Must have the class and data attributes
      if (!attrs.includes('image-gallery-embed') || !attrs.includes('data-attrs=')) {
        return match;
      }
      
      // Safely extract data-attrs using a backreference for the quote type
      const dataMatch = attrs.match(/data-attrs=(["'])(.*?)\1/);
      if (!dataMatch) return match;
      
      try {
        // Substack HTML-entity encodes the JSON
        const jsonStr = dataMatch[2].replace(/&quot;/g, '"');
        const parsed = JSON.parse(jsonStr);
        
        // Extract URLs specifically from the images array to avoid the static collage
        const urls: string[] = [];
        if (parsed?.gallery?.images && Array.isArray(parsed.gallery.images)) {
          for (const img of parsed.gallery.images) {
            if (img?.src && typeof img.src === 'string') {
              urls.push(img.src);
            }
          }
        }
        
        if (urls.length === 0) return match;
        
        const imgTags = urls.map(url => {
          let width = '';
          let height = '';
          
          // Try to extract dimensions from filename (e.g. ..._3840x2160.jpeg)
          const dimMatch = url.match(/_(\d+)x(\d+)\.[a-z0-9]+$/i);
          if (dimMatch) {
            width = ` width="${dimMatch[1]}"`;
            height = ` height="${dimMatch[2]}"`;
          }
          
          return `<img src="${url}"${width}${height} loading="lazy" />`;
        });
        
        return `<substack-gallery>${imgTags.join('')}</substack-gallery>`;
      } catch (e) {
        // Gracefully fail and let the sanitizer strip the malformed gallery div
        return ''; 
      }
    }
  );
}

/**
 * Extracts YouTube iframes (Substack's standard embed method) and replaces
 * them with a custom <youtube-embed> element.
 * Must run BEFORE sanitization so the iframe is not stripped.
 */
export function extractYouTubeEmbeds(html: string): string {
  if (!html) return '';
  return html.replace(
    // Safely match attributes even if they contain >, by skipping over quoted strings
    /<iframe\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/iframe>/gi,
    (match, attrs) => {
      // Find a YouTube src attribute
      const srcMatch = attrs.match(/src=["'](?:https?:)?\/\/(?:www\.)?(?:youtube\.com|youtube-nocookie\.com)\/embed\/([A-Za-z0-9_-]+)[^"']*["']/i);
      if (srcMatch) {
        return `<youtube-embed video-id="${srcMatch[1]}"></youtube-embed>`;
      }
      return match;
    }
  );
}

/** Sanitize imported HTML down to the semantic allowlist. */
/*
  ─── PULL QUOTES SURVIVE SANITIZATION ───────────────────────────────────────

  Substack marks a pull quote with a DIV:

    <div class="pullquote"><p><strong>...</strong></p></div>

  `div` is not in ALLOWED_TAGS and `class` is not in ALLOWED_ATTRS, so
  sanitize-html discarded the wrapper and kept the contents. A pull quote
  therefore arrived as an ordinary bold paragraph, indistinguishable from body
  text and sitting directly above the sentence it quotes — which reads as a
  duplicated line rather than a design element. Reported against
  /intel/why-im-actually-hyped-for-avengers.

  Promoting it to a <blockquote> BEFORE sanitizing is what preserves it:
  blockquote is already allowed and already styled, so the meaning survives
  the allowlist instead of being deleted by it.

  The `pullquote` class rides along so the stylesheet can tell a pull quote
  (an excerpt lifted from THIS article for emphasis) from a real block
  quotation (words from somewhere else). sanitizeArticleHtml allows that one
  literal class name on that one tag, and nothing else.

  DELIBERATELY CONSERVATIVE, like every other transform in this file. Inner
  markup is passed through untouched, a wrapper containing another div is left
  alone rather than guessed at, and anything that does not match is returned
  byte-identical.
*/
export function liftPullQuotes(html: string): string {
  if (!html) return '';

  return html.replace(
    /* Same attribute-safe div matcher extractSubstackGalleries() uses: skipping
       over quoted strings means a `>` inside an attribute value cannot end the
       tag early. Non-greedy body, so the match stops at the FIRST </div>. */
    /<div\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/div>/gi,
    (match: string, attrs: string, inner: string) => {
      if (!/class\s*=\s*(["'])[^"']*\bpullquote\b[^"']*\1/i.test(attrs)) return match;

      /* A nested div means the non-greedy match above ended at the INNER
         closing tag, so `inner` is not the whole quote. Rewriting it would
         move markup around. Leave it exactly as it is. */
      if (/<div\b/i.test(inner)) return match;

      /* An empty wrapper is not a quote, and emitting <blockquote></blockquote>
         would render as a stray rule with nothing in it. */
      if (!inner.replace(/<[^>]*>/g, '').trim()) return match;

      return `<blockquote class="pullquote">${inner}</blockquote>`;
    },
  );
}

export function sanitizeArticleHtml(html: string): string {
  if (!html) return '';
  
  const processedHtml = extractYouTubeEmbeds(extractSubstackGalleries(liftPullQuotes(demoteHeadings(html))));
  
  return sanitizeHtml(processedHtml, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRS,
    /* The ONLY class allowed to survive anywhere in article markup, and only
       on the element liftPullQuotes() emits. `allowedClasses` restricts by
       literal name, so this cannot become a general "classes are fine" hole:
       every other class on every other tag is still stripped. */
    allowedClasses: { blockquote: ['pullquote'] },
    // Strip Substack's tracking/CDN query junk but keep the URL usable.
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      // Force safe rel on every anchor that leaves the site.
      a: (tagName, attribs) => {
        const href = attribs.href ?? '';
        const isExternal = /^https?:\/\//i.test(href);
        return {
          tagName,
          attribs: isExternal
            ? { ...attribs, rel: 'noopener noreferrer', target: '_blank' }
            : attribs,
        };
      },
    },
    // Drop empty paragraphs Substack leaves behind between blocks.
    exclusiveFilter: (frame) =>
      frame.tag === 'p' && !frame.text.trim() && !frame.mediaChildren.length,
  }).trim();
}

/**
 * Map a post to one of the site's canonical categories.
 *
 * Tag-driven by design: the owner tags Substack posts with matching keywords,
 * so this reads tags first and only falls back to title/description text when
 * a post carries no usable tag. Note the site's film category is `Film`, not
 * `Movies` — see src/data/constants.js.
 */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  // Deliberately excludes 'review' and 'trailer': TV and games get reviewed and
  // trailered too, so those words carry no category signal and, being checked
  // first, would have swallowed everything into Film.
  Film: ['film', 'films', 'movie', 'movies', 'cinema', 'boxoffice'],
  TV: ['tv', 'television', 'series', 'season', 'episode', 'streaming', 'show'],
  Games: ['gaming', 'game', 'games', 'videogame', 'playstation', 'xbox', 'nintendo', 'steam'],
  Events: ['event', 'events', 'convention', 'con', 'comiccon', 'comic-con', 'sdcc', 'd23', 'premiere', 'expo'],
};

const FALLBACK_CATEGORY = 'General';

function normalizeToken(value: string): string {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function mapCategory(tags: string[] = [], text = ''): string {
  const normalizedTags = tags.map(normalizeToken).filter(Boolean);

  // 1. Exact tag match against a canonical category name (Film, TV, ...).
  for (const category of CATEGORIES) {
    if (normalizedTags.includes(normalizeToken(category))) return category;
  }

  // 2. Tag match against that category's keyword set.
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (normalizedTags.some((t) => keywords.map(normalizeToken).includes(t))) {
      return category;
    }
  }

  // 3. Last resort: keyword scan of title/description. Weakest signal, which
  //    is exactly why tagging posts is the documented workflow.
  const haystack = ` ${String(text).toLowerCase()} `;
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => haystack.includes(` ${k} `))) return category;
  }

  return FALLBACK_CATEGORY;
}

/**
 * CONTENT TYPE — what KIND of article this is, as distinct from its subject.
 *
 * `category` answers "what is it about" (Film / TV / Games / Events).
 * `contentType` answers "what is it" (a Review, an Analysis, a Dispatch...).
 *
 * Both are needed. Search engines treat a review very differently from a news
 * piece — a Review can carry a rating and appear in rich results, while news
 * belongs in NewsArticle. See the schema selection in src/pages/intel/[slug].
 *
 * Detection order mirrors mapCategory(): explicit tag first, then keywords in
 * the title. Tagging a Substack post `Review` is the reliable path; the title
 * scan is a fallback so untagged posts still get something sensible.
 */
export const CONTENT_TYPES = ['Review', 'Analysis', 'Dispatch', 'Announcement', 'Interview', 'Commentary', 'Reaction', 'News', 'Event Coverage'] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

const CONTENT_TYPE_KEYWORDS: Record<string, string[]> = {
  Review: ['review', 'reviewed', 'verdict', 'rating'],
  Commentary: ['commentary', 'comments', 'thoughts'],
  Reaction: ['reaction', 'reacts', 'first impression'],
  // "Dispatch" is on-the-ground reporting: conventions, premieres, set visits.
  Dispatch: ['dispatch', 'onlocation', 'hallh', 'sdcc', 'd23', 'nycc', 'premiere', 'recap', 'coverage'],
  Announcement: ['announced', 'announcement', 'revealed', 'confirms', 'confirmed', 'trailer', 'release date'],
  Interview: ['interview', 'sitdown', 'conversation with', 'talks'],
  News: ['news', 'update', 'breaking'],
  // Analysis is the default for opinion/essay pieces, so its keywords are the
  // broadest and it is checked last.
  Analysis: ['analysis', 'why', 'explained', 'breakdown', 'deepdive', 'essay', 'the case for'],
};

/** Default when nothing matches — most editorial writing is analysis. */
const FALLBACK_CONTENT_TYPE: ContentType = 'Analysis';

export function mapContentType(tags: string[] = [], text = '', category?: string): ContentType {
  const normalizedTags = tags.map(normalizeToken).filter(Boolean);

  // 1. An explicit tag naming the type outright.
  for (const type of CONTENT_TYPES) {
    if (normalizedTags.includes(normalizeToken(type))) return type;
  }

  // 2. A tag matching that type's keyword set.
  for (const [type, keywords] of Object.entries(CONTENT_TYPE_KEYWORDS)) {
    if (normalizedTags.some((t) => keywords.map(normalizeToken).includes(t))) {
      return type as ContentType;
    }
  }

  // 3. Title/description scan. Checked in CONTENT_TYPES order so the more
  //    specific types win over the broad Analysis keywords.
  const haystack = ` ${String(text).toLowerCase()} `;
  for (const type of CONTENT_TYPES) {
    const keywords = CONTENT_TYPE_KEYWORDS[type] ?? [];
    if (keywords.some((k) => haystack.includes(` ${k} `) || haystack.includes(k))) {
      return type as ContentType;
    }
  }

  if (category === 'Events') {
    return 'Event Coverage';
  }

  return FALLBACK_CONTENT_TYPE;
}

/**
 * Pull an out-of-10 (or out-of-5) score from a review body, if present.
 *
 * Reviews that state a score can carry it into Review schema, which is what
 * makes a rating eligible for rich results. Matches "8.5/10", "Score: 9/10",
 * "4/5". Returns null when there is no score — most posts.
 */
export function extractScore(html: string): { value: number; best: number } | null {
  const text = toPlainText(html);
  const match = text.match(/(?:score|rating)?\s*:?\s*\b(\d{1,2}(?:\.\d)?)\s*\/\s*(10|5)\b/i);
  if (!match) return null;
  const value = Number(match[1]);
  const best = Number(match[2]);
  if (!Number.isFinite(value) || value < 0 || value > best) return null;
  return { value, best };
}

/** URL-safe slug. Derived from the Substack permalink when possible. */
export function toSlug(link: string, title: string): string {
  const fromLink = String(link ?? '').match(/\/p\/([^/?#]+)/);
  const raw = fromLink ? fromLink[1] : String(title ?? '');
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Block elements whose boundary is a word boundary once the tags are gone.
 *
 * Stripping `</p><p>` without putting anything in its place welds the last
 * word of one paragraph to the first word of the next — the real, visible
 * symptom was a standfirst reading "…RIP 😔 (kind of)So yeah… Seth Rogen"
 * and "…low expectations.Johnny Cage FightI saw Mortal Kombat 2", where a
 * figure caption had also been swallowed into the sentence. `sanitize-html`
 * has no option for this, so the separator is inserted before stripping.
 */
const BLOCK_BOUNDARY =
  /<\/(?:p|h[1-6]|li|ul|ol|blockquote|figure|figcaption|div|pre|tr|td|th|section|article)\s*>/gi;

/**
 * Strip tags/entities down to plain text, for excerpts and alt fallbacks.
 *
 * sanitize-html returns HTML, not text: with every tag stripped it still
 * ESCAPES the text, so "Q&A" came back as "Q&amp;A". Astro escapes plain text
 * again when it renders it, and /intel showed readers "Q&amp;A". The escapes
 * are undone here, `&amp;` LAST, so an author's literal "&amp;lt;" stays text
 * rather than decoding twice. The result is plain text: never pass it to
 * `set:html`.
 */
export function toPlainText(html: string): string {
  const spaced = String(html ?? '')
    .replace(BLOCK_BOUNDARY, ' ')
    .replace(/<br\s*\/?>/gi, ' ');
  return sanitizeHtml(spaced, { allowedTags: [], allowedAttributes: {} })
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstImage(html: string): string {
  const match = String(html ?? '').match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : '';
}

/**
 * Substack sometimes truncates a paid post's `content:encoded` to a teaser.
 * This is a safety net against that, NOT a paywall feature — every article is
 * meant to render in full. A record that trips this keeps its metadata (so it
 * still appears in the Feed, linking out to Substack) but is not given a local
 * page, rather than publishing a stub that reads as broken.
 */
const MIN_BODY_CHARS = 400;

export function looksTruncated(bodyHtml: string): boolean {
  const text = toPlainText(bodyHtml);
  if (text.length < MIN_BODY_CHARS) return true;
  return /subscribe to (keep reading|read more)|this post is for (paid|paying)|upgrade to continue/i.test(text);
}

export interface RawFeedItem {
  title?: string;
  link?: string;
  guid?: string;
  pubDate?: string;
  description?: string;
  contentEncoded?: string;
  categories?: string[];
  enclosureUrl?: string;
}

export interface ArticleRecord {
  guid: string;
  slug: string;
  title: string;
  link: string;
  date: string;
  isoDate: string;
  excerpt: string;
  /**
   * The magazine lede: the article's opening paragraphs, as an array of plain
   * strings (one entry per paragraph).
   *
   * This is SEPARATE from `excerpt` on purpose. `excerpt` is a single short
   * sentence-or-two used in card grids and — critically — as the page's meta
   * description, where search engines truncate anything past ~160 characters.
   * The magazine's centre feature is a different job: it is a full editorial
   * block with several paragraphs of room beneath the headline, and a
   * one-paragraph teaser left most of that space empty. Overloading `excerpt`
   * to fill it would have made every meta description a wall of text.
   */
  preview: string[];
  image: string;
  category: string;
  /** What KIND of piece this is — Review, Analysis, Dispatch… */
  contentType: string;
  /** Out-of-N score for reviews that state one, else null. */
  score: { value: number; best: number } | null;
  tags: string[];
  bodyHtml: string;
  hasBody: boolean;
  firstSeen: string;
  lastUpdated: string;
}

/**
 * Build the preview excerpt.
 *
 * Prefers the feed's own description, but falls back to the article's opening
 * paragraphs when that description is too short to fill the preview block.
 * Trimmed at a sentence boundary where possible so it never ends mid-word.
 */
function buildExcerpt(description: string, body: string, limit = 420): string {
  /*
    The author's own dek wins whenever there is one.

    This used to require `description.length >= 160` before trusting it, which
    made sense against RSS where `<description>` was often a machine-truncated
    stub. The posts API gives us `subtitle` — a real, hand-written standfirst —
    so length is no longer a signal of quality. Under the old rule a deliberate
    one-line dek ("One job… be everything the first Mortal Kombat was not.")
    was discarded in favour of scraped body text, which is how a figure caption
    ended up mid-sentence in the standfirst.
  */
  const source = description || body;
  if (source.length <= limit) return source;

  const clipped = source.slice(0, limit);
  // Prefer to end on a sentence; otherwise the last whole word.
  const lastStop = Math.max(clipped.lastIndexOf('. '), clipped.lastIndexOf('! '), clipped.lastIndexOf('? '));
  if (lastStop > limit * 0.5) return clipped.slice(0, lastStop + 1);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, lastSpace > 0 ? lastSpace : limit)}…`;
}

/**
 * Build the magazine lede — the opening paragraphs of the article.
 *
 * ─── WHY THIS IS SEPARATE FROM buildExcerpt() ─────────────────────────────
 * `excerpt` is one short block, reused as the meta description. This is the
 * long form: several real paragraphs, so the centre feature on /intel fills
 * the editorial space beneath its headline instead of leaving a void under
 * the "Read More" link.
 *
 * ─── WHY IT RETURNS AN ARRAY, NOT HTML ────────────────────────────────────
 * Paragraph text only, with the tags stripped. The component turns each entry
 * into its own <p>. Keeping it as data rather than markup means the swap
 * script can rebuild the block with `textContent` and never touch innerHTML —
 * no HTML from the feed is ever re-parsed in the browser.
 *
 * ─── HOW MUCH IT TAKES ────────────────────────────────────────────────────
 * Whole paragraphs until `limit` characters are reached, capped at
 * `maxParagraphs`. Whole paragraphs, never a partial one, so the block always
 * ends on a finished thought — except for the final safety trim below, which
 * only fires when a single paragraph is longer than the whole budget.
 *
 * The 1000-character default is not arbitrary. Measured against the built
 * page at 1440px: the centre column is ~583px of text width, so 1000
 * characters sets about 17 lines, which brings the feature column to roughly
 * the same height as the four-tile rails beside it. Raise it and the feature
 * outgrows the rails; lower it and the empty space under "Read More" comes
 * back.
 *
 * @param bodyHtml  sanitized article body
 * @param fallback  used when the body has no usable paragraphs (e.g. a feed
 *                  item that only gave us a description)
 */
export function buildPreview(
  bodyHtml: string,
  fallback = '',
  limit = 1000,
  maxParagraphs = 5,
): string[] {
  /*
    Match <p>…</p> blocks. A regex is enough here because the body has already
    been through sanitize-html, so the markup is well-formed and the tag set is
    a known allowlist — this is not parsing arbitrary HTML from the wild.
  */
  const blocks = String(bodyHtml ?? '').match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) ?? [];

  const paragraphs: string[] = [];
  let used = 0;

  for (const block of blocks) {
    const text = toPlainText(block);

    // Skip furniture: empty paragraphs, and the one-line "Score: 8/10" style
    // sign-offs, which read as noise at the top of a feature.
    if (text.length < 40) continue;

    paragraphs.push(text);
    used += text.length;

    if (paragraphs.length >= maxParagraphs || used >= limit) break;
  }

  if (paragraphs.length === 0) {
    const plain = toPlainText(fallback);
    return plain ? [plain] : [];
  }

  /*
    Safety trim. If one paragraph blew past the budget on its own, cut the last
    entry at a sentence boundary so the block does not run to a thousand words.
  */
  const last = paragraphs[paragraphs.length - 1];
  if (used > limit * 1.4 && last.length > 200) {
    const allowance = Math.max(200, limit - (used - last.length));
    const clipped = last.slice(0, allowance);
    const stop = Math.max(
      clipped.lastIndexOf('. '),
      clipped.lastIndexOf('! '),
      clipped.lastIndexOf('? '),
    );
    paragraphs[paragraphs.length - 1] =
      stop > allowance * 0.5
        ? clipped.slice(0, stop + 1)
        : `${clipped.slice(0, Math.max(clipped.lastIndexOf(' '), 0))}…`;
  }

  return paragraphs;
}

/** Display date in the format the existing cache and cards already use. */
function formatDisplayDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: PUBLISH_TIME_ZONE,
  });
}

/**
 * Build a durable record from one feed item.
 * Returns null for items too malformed to be useful (no title, or no
 * guid/link to key on) so the caller can skip and log them.
 */
export function buildArticleRecord(item: RawFeedItem, now = new Date()): ArticleRecord | null {
  const title = toPlainText(item.title ?? '');
  const link = String(item.link ?? '').trim();
  const guid = String(item.guid ?? link).trim();

  if (!title || !guid) return null;

  const parsedDate = new Date(item.pubDate ?? '');
  const isoDate = Number.isNaN(parsedDate.getTime())
    ? now.toISOString()
    : parsedDate.toISOString();

  const bodyHtml = sanitizeArticleHtml(item.contentEncoded ?? '');
  const rawCategories = item.categories ?? [];
  const categoriesArray = Array.isArray(rawCategories) ? rawCategories : [rawCategories];
  const tags = categoriesArray.map((t) => String(t).trim()).filter(Boolean);
  const excerptSource = item.description ?? bodyHtml;

  return {
    guid,
    slug: toSlug(link, title),
    title,
    link,
    date: formatDisplayDate(isoDate),
    isoDate,
    /*
      A real preview, not a teaser. The section page shows up to six lines, so
      280 characters left the block half empty. If the feed's own description
      is short, fall back to the opening of the body — that is the hook.
    */
    excerpt: buildExcerpt(toPlainText(excerptSource), toPlainText(bodyHtml)),
    /* The long form, for the magazine centre feature. See buildPreview(). */
    preview: buildPreview(bodyHtml, excerptSource),
    image: item.enclosureUrl || firstImage(item.contentEncoded ?? ''),
    category: mapCategory(tags, `${title} ${toPlainText(item.description ?? '')}`),
    contentType: mapContentType(tags, `${title} ${toPlainText(item.description ?? '')}`, mapCategory(tags, `${title} ${toPlainText(item.description ?? '')}`)),
    score: extractScore(bodyHtml),
    tags,
    bodyHtml,
    hasBody: Boolean(bodyHtml) && !looksTruncated(bodyHtml),
    firstSeen: now.toISOString(),
    lastUpdated: now.toISOString(),
  };
}

/**
 * Merge freshly parsed records into the durable snapshot.
 *
 * Semantics, per the epic: new GUIDs are appended, existing GUIDs are updated
 * in place, and **records are never deleted**. Substack's /feed returns only a
 * rolling window, so anything that ages out of it must survive here or its
 * live URL 404s on the next deploy.
 *
 * Editorial fields a human may have set (`editorial`) are preserved across
 * updates; feed-derived fields are refreshed.
 */
export function mergeSnapshot(
  existing: ArticleRecord[],
  incoming: ArticleRecord[],
): { merged: ArticleRecord[]; added: number; updated: number } {
  const byGuid = new Map<string, ArticleRecord>();
  const bySlug = new Map<string, string>(); // slug -> guid

  for (const record of (Array.isArray(existing) ? existing : [])) {
    if (record?.guid) {
      byGuid.set(record.guid, record);
      if (record?.slug) bySlug.set(record.slug, record.guid);
    }
  }

  let added = 0;
  let updated = 0;

  for (const record of (Array.isArray(incoming) ? incoming : [])) {
    // try finding by guid first, then fallback to slug
    const priorGuid = byGuid.has(record.guid) ? record.guid : bySlug.get(record.slug ?? '');
    const prior = priorGuid ? byGuid.get(priorGuid) : null;
    
    if (!prior) {
      byGuid.set(record.guid, record);
      if (record?.slug) bySlug.set(record.slug, record.guid);
      added += 1;
      continue;
    }
    
    // Update the existing record using its ORIGINAL guid to keep it stable
    byGuid.set(priorGuid!, {
      ...prior,
      ...record,
      guid: prior.guid, // preserve the original stable guid
      // Never let a re-sync rewrite when we first saw a post.
      firstSeen: prior.firstSeen ?? record.firstSeen,
      // A feed that stops returning bodies must not blank an archived one.
      bodyHtml: record.bodyHtml || prior.bodyHtml,
      hasBody: record.hasBody || prior.hasBody,
      // Allow feed to clear tags if the user removed them
      tags: record.tags || [],
      category: record.category || prior.category || '',
      contentType: record.contentType || prior.contentType || '',
      // Editorial overrides win over anything the feed says.
      ...(prior as any).editorial ? { editorial: (prior as any).editorial } : {},
    });
    updated += 1;
  }

  return {
    merged: [...byGuid.values()].sort(
      (a, b) => new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime(),
    ),
    added,
    updated,
  };
}
