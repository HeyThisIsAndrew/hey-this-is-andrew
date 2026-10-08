/**
 * The standard closing section every Substack post now ends with.
 *
 * ─── IT IS FURNITURE, NOT CONTENT ───────────────────────────────────────────
 * "Where Nerd Culture Gets Cinematic", the publication blurb, the two calls to
 * action and the BE YOURSELF sign-off are the same on every post. They arrive
 * inside `bodyHtml` because the author types them into Substack, but they are
 * the site's furniture: identical everywhere, owned by us, and editable without
 * republishing a post.
 *
 * So the body is stripped of them at RENDER time and <ArticleOutro /> renders
 * the real thing underneath. Three problems go away together:
 *
 *   1. The copy stops being article content and becomes one component.
 *   2. The sign-off stops being an <h4> — it is authored at the same heading
 *      level as the section title above it, which is why it rendered at
 *      section size and wrapped onto two lines instead of sitting on one.
 *   3. Both <h4>s stop appearing in the Contents rail, because buildToc()
 *      indexes the body's headings and the strip runs before it.
 *
 * ─── RENDER TIME, NOT SYNC TIME ─────────────────────────────────────────────
 * `src/data/articles.json` is owned by the Substack sync, whose contract is
 * never-delete (CLAUDE.md). Nothing here edits it. Stripping on the way to the
 * page keeps the source post intact and makes this reversible the day Substack
 * changes its markup: delete the call, and the body renders as it always did.
 *
 * This is the same shape as `stripCoverImageFromBody()` in article-media.ts,
 * which is called from the same place for the same reason, and the same note
 * about regex applies: the body has already been through sanitize-html, so the
 * markup is well-formed and the tag set is a known allowlist. This is not
 * parsing arbitrary HTML from the wild.
 */

/**
 * How many of the site's own destinations a trailing block must link to before
 * it is treated as the outro.
 *
 * ─── WHY THIS IS THE ANCHOR, AND NOT THE WORDS ──────────────────────────────
 * The obvious match is the prose — "Where Nerd Culture Gets Cinematic", or the
 * BE YOURSELF line. That breaks the first time the copy is edited, and it
 * breaks SILENTLY: the outro simply reappears in the body and in the contents
 * rail, looking like a regression in something else.
 *
 * What does not change when the copy does is that this block is the only place
 * in a post that links to our own properties three times over — the site, the
 * Substack publication and the YouTube channel. Substack rewrites those hrefs
 * through `google.com/search?q=…`, so the URLs are not stable either, but the
 * string `beunconventionalhq` survives inside every one of them.
 *
 * Two is the threshold rather than three so an outro that drops one of its
 * links still matches, while a body paragraph that happens to link to the site
 * once does not.
 */
const MIN_OWN_LINKS = 2;

const OWN_DOMAIN = /beunconventionalhq/gi;

/** Trailing whitespace and empty paragraphs the strip can leave behind. */
const TRAILING_EMPTY = /(?:\s|<p>\s*<\/p>|<p>&nbsp;<\/p>)+$/gi;

/**
 * Remove the standard outro from an article body.
 *
 * Returns the body unchanged when nothing matches — a post written before the
 * convention, or one whose markup has drifted far enough that this can no
 * longer identify the block. That is the deliberate failure mode: the outro
 * renders twice, once from the body and once from the component, which is
 * visible and reportable. A partial strip is not, so this never removes a
 * fragment: either the whole trailing block goes, or none of it does.
 *
 * @param bodyHtml sanitized article body
 */
export function stripArticleOutro(bodyHtml: string): string {
  const body = String(bodyHtml ?? '');
  if (!body) return body;

  /*
    The outro is the LAST horizontal rule and everything after it. Substack
    emits that rule as the divider above the section, and it is the only
    structural boundary the block reliably has.

    Searching from the end matters: a long post can use <hr> between its own
    sections, and only the final one can be the divider above a trailing block.
  */
  const rules = [...body.matchAll(/<hr\b[^>]*\/?>/gi)];
  if (rules.length === 0) return body;

  const lastRule = rules[rules.length - 1];
  const cutAt = lastRule.index ?? -1;
  if (cutAt < 0) return body;

  const tail = body.slice(cutAt);

  /* A divider with nothing meaningful after it is just a divider. */
  const ownLinks = tail.match(OWN_DOMAIN)?.length ?? 0;
  if (ownLinks < MIN_OWN_LINKS) return body;

  /*
    And it has to look like the section rather than a closing sentence that
    happens to link to us: the outro leads with a heading.
  */
  if (!/<h[1-6]\b/i.test(tail)) return body;

  return body.slice(0, cutAt).replace(TRAILING_EMPTY, '');
}

/**
 * Whether a body still carries the outro.
 *
 * Exported for the tests and for anywhere that needs to reason about a post
 * without rewriting it.
 */
export function hasArticleOutro(bodyHtml: string): boolean {
  const body = String(bodyHtml ?? '');
  return body.length > 0 && stripArticleOutro(body) !== body;
}
