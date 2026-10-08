/**
 * The publication's own words for a piece, separated from the words its source
 * platform supplied.
 *
 * ─── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * Every card and the spotlight hero used to read straight from the raw source
 * text: `item.preview || item.excerpt || item.description`. That is a YouTube
 * description for a video and the article BODY for an article, and it was wrong
 * in three separate ways at once, all of them measured on the built /feed:
 *
 *   1. RAW YOUTUBE DESCRIPTIONS SHIPPED IN EVERY CARD. 160 `data-preview`
 *      attributes averaging 1,990 characters: ~318KB, 26% of a 1.20MB page.
 *      102 of them carried affiliate links, gear lists or subscribe CTAs, and
 *      `amzn.to` appeared 219 times in the HTML of one page.
 *
 *   2. 14 OF 29 VIDEOS OPEN WITH A HASHTAG BLOCK, inside the first 280
 *      characters, which is the window the hero actually displays.
 *
 *   3. ARTICLES PREFERRED THE BODY OVER THEIR OWN STANDFIRST. `preview` is an
 *      ARRAY of paragraphs, so `item.preview || item.excerpt` never reached
 *      `excerpt` — the real subtitle, and already a standfirst at 37-185
 *      characters. The array then stringified through the attribute, joining
 *      paragraphs on a bare comma: "...its own distinct identity.,One of the
 *      things I love most...". 49 cards on /feed shipped that.
 *
 * ─── ONE FUNCTION, BOTH SURFACES ────────────────────────────────────────────
 * ContentCard cleaned its text and FeedSpotlightHero did not, so the same item
 * read differently depending on whether you were looking at its tile or at the
 * hero the tile promotes. Both call `editorialPreview()` now. There is no
 * second copy of these rules to drift from this one.
 *
 * ─── THIS IS NORMALISATION, NOT CLASSIFICATION ──────────────────────────────
 * Nothing here decides what a piece IS. That is `coverageType` and the badge
 * fields, set by a human in the CMS and read by src/lib/tags.ts. This file only
 * decides which characters of somebody else's text are safe to reprint.
 */

/** How much of a fallback preview to keep. The hero clamps to 3-4 lines. */
export const EDITORIAL_PREVIEW_MAX = 280;

/**
 * Lines that mean "the description proper has ended".
 *
 * Checked as a WHOLE-LINE test, not a substring search, because the words are
 * ordinary English: a review that says "the gear on display" must not be cut
 * at that sentence. Every one of these was read off the real store, not
 * guessed — the horizontal rule alone appears 61 times across 29 descriptions.
 */
const BOILERPLATE_HEADING =
  /^[\s\p{Extended_Pictographic}\p{S}*•·⚬–—-]*(chapters?|timestamps?|time stamps?|gear|camera gear|my gear|my (youtube )?filming gear|filming gear|equipment|kit|subscribe|follow( me)?|socials?|social media|my links?|links?|affiliate( links?| disclosure)?|disclaimer|disclosures?|music|credits|business( inquiries)?|contact|sponsors?|support( the| this)?( channel)?|merch|patreon|shop|storefront|watch next|more videos?|playlists?)\b.*$/iu;

/** A rule drawn across the description. The junk starts here. */
const HORIZONTAL_RULE = /^[\s]*[▬━─—=_~*\-–]{3,}[\s]*$/u;

/** A line that is nothing but hashtags and/or @handles. */
const TAGS_ONLY_LINE = /^[\s]*(?:[#@][\w.'-]+[\s,]*)+$/u;

/** A line carrying a link. Boilerplate in this store is link-bearing without exception. */
const HAS_URL = /(https?:\/\/|www\.[a-z0-9-]+\.[a-z]{2,}|\b[a-z0-9-]+\.(?:com|net|org|io|to|me|co|tv|gg)\/\S)/i;

/** A line that is only decoration: emoji, bullets, punctuation, no words. */
const NO_WORDS = /^[^\p{L}\p{N}]*$/u;

/** A timestamp entry from a chapter list, in case the heading above it is missing. */
const TIMESTAMP_LINE = /^\s*\(?\d{1,2}:\d{2}(?::\d{2})?\)?\s*[-–—|:]?\s/;

/**
 * A call to action written as a SENTENCE rather than as a heading.
 *
 * "Hit subscribe and let me know your thoughts on the episode below." is the
 * common one, and the heading test above cannot see it: that test is anchored
 * to the start of the line, and this sentence starts with an ordinary verb.
 * It sits above the chapter list in most descriptions, so it survived the
 * boundary cut and only stayed out of sight because the 280-character clip
 * happened to land in front of it. A short editorial excerpt would have
 * surfaced it.
 *
 * LENGTH-GUARDED on purpose. "Subscribe" and "follow" are ordinary words in
 * entertainment writing — a piece about Netflix will discuss subscribers, and
 * one about a franchise will discuss what follows. The phrase has to be
 * addressed to the viewer AND be most of a short line before this drops it, so
 * a paragraph that merely mentions subscribers is left alone.
 */
const VIEWER_CTA = /\b(hit (that )?(subscribe|the bell|like)|(like and |please )?subscribe (to|for|if|and|below)|smash that|turn on (post )?notifications|let me know (what you|your|in the)|drop (it |a comment |your thoughts )?(in the )?comments?|(link|links) (are |is )?(in the description|below)|follow me on|join (the|my) (channel|discord|patreon))\b/i;
const CTA_LINE_MAX = 200;

/**
 * Everything the publication should never reprint, removed.
 *
 * Line-based and CUT-AT-FIRST-BOUNDARY rather than filter-everywhere: once a
 * description reaches its gear list it does not come back to the subject, so
 * keeping later lines that happen to look clean would splice unrelated
 * fragments onto the end of the editorial text. Lines BEFORE the boundary are
 * still filtered individually, which is what removes the leading hashtag block
 * without discarding the paragraphs under it.
 */
export function stripCreatorBoilerplate(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length === 0) return '';

  const lines = raw.replace(/\r\n?/g, '\n').split('\n');
  const kept: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    /* A boundary ends the description. Nothing after it is editorial. */
    if (
      HORIZONTAL_RULE.test(trimmed) ||
      HAS_URL.test(trimmed) ||
      BOILERPLATE_HEADING.test(trimmed) ||
      TIMESTAMP_LINE.test(trimmed)
    ) {
      break;
    }

    /* Not a boundary, just not worth reprinting. */
    if (trimmed === '' || TAGS_ONLY_LINE.test(trimmed) || NO_WORDS.test(trimmed)) continue;
    if (trimmed.length <= CTA_LINE_MAX && VIEWER_CTA.test(trimmed)) continue;

    /* A trailing hashtag run on an otherwise real sentence. */
    kept.push(trimmed.replace(/(?:\s+[#@][\w.'-]+)+\s*$/u, '').trim());
  }

  return kept.join(' ').replace(/\s+/g, ' ').trim();
}

/** HTML out, entities decoded, whitespace collapsed. Substack fields carry markup. */
function plainText(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/<[^>]*>?/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Cut to `max` on a SENTENCE boundary where there is one, a word boundary
 * otherwise. Never mid-word, and never a dangling half-thought where a full
 * stop was available.
 */
function clip(text: string, max: number): string {
  if (text.length <= max) return text;

  const window = text.slice(0, max + 1);
  const lastStop = Math.max(
    window.lastIndexOf('. '),
    window.lastIndexOf('! '),
    window.lastIndexOf('? '),
  );
  /* Only honour a sentence end that leaves a usable amount of text behind it. */
  if (lastStop >= max * 0.45) return window.slice(0, lastStop + 1).trim();

  const lastSpace = window.lastIndexOf(' ');
  return `${window.slice(0, lastSpace > 0 ? lastSpace : max).trim()}...`;
}

/**
 * The words to print for an item, in the order the publication trusts them.
 *
 *   1. `editorial.excerpt` — a human wrote it FOR this site. Returned whole and
 *      untruncated: clipping somebody's deliberate standfirst mid-sentence is
 *      worse than a long one, and they can see the length as they type it.
 *      Articles have this field today (src/lib/articles.ts); videos get it in
 *      Phase 1. Reading it here now means that phase is data and plumbing, with
 *      no second pass over the renderers.
 *   2. `excerpt` — for an article, the Substack subtitle. Already a standfirst.
 *   3. `preview` — the article BODY, an array of paragraphs. First paragraph
 *      only, and only because an article with no subtitle still needs a line.
 *   4. `description` — a YouTube description, boilerplate stripped.
 *
 * Returns '' when there is nothing safe to print, and every caller must render
 * nothing rather than a placeholder: a card with no words is honest, and a
 * video whose editorial excerpt has not been written yet says its title and its
 * metadata, which is what it actually knows.
 */
export function editorialPreview(item: any, max: number = EDITORIAL_PREVIEW_MAX): string {
  if (!item) return '';

  const authored = plainText(item?.editorial?.excerpt);
  if (authored) return authored;

  const excerpt = plainText(item.excerpt);
  if (excerpt) return clip(excerpt, max);

  /* `preview` is an array on articles and a string on anything that copied the
     field name. Take the first paragraph either way — never the whole body,
     which is how 49 cards came to ship a comma-joined article. */
  const firstParagraph = Array.isArray(item.preview)
    ? plainText(item.preview[0])
    : plainText(item.preview);
  if (firstParagraph) return clip(firstParagraph, max);

  const described = stripCreatorBoilerplate(item.description);
  if (described) return clip(described, max);

  return '';
}
