/**
 * Table-of-contents builder for article pages.
 *
 * ─── WHY IT WORKS ON A STRING ─────────────────────────────────────────────
 * The article body is sanitized HTML stored in the snapshot. There is no DOM
 * at build time, so this reads the headings with a regular expression rather
 * than parsing. That is normally a bad idea for HTML — but this input is not
 * arbitrary: it has already been through sanitize-html against a strict
 * allowlist, so the heading tags are known-simple (`<h2>` / `<h3>`, no
 * attributes beyond what we add ourselves).
 *
 * ─── WHAT IT RETURNS ──────────────────────────────────────────────────────
 * Entries plus a rewritten body. Each heading gains an `id`, and each entry
 * points at it, so clicking a ToC link anchor-scrolls to that section. Ids are
 * de-duplicated because two sections can legitimately share a title.
 */

export interface TocEntry {
  /** The heading's anchor id. */
  id: string;
  /** The heading's visible text. */
  text: string;
  /** 2, 3 or 4 — anything past 2 is indented as a sub-entry. */
  level: number;
}

/** Strip tags and entities from a heading's inner HTML. */
function plain(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** URL-safe anchor id from heading text. */
function toId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function buildToc(bodyHtml: string): { entries: TocEntry[]; html: string } {
  if (!bodyHtml) return { entries: [], html: '' };

  const entries: TocEntry[] = [];
  const used = new Set<string>();

  /*
    ─── LEVEL NORMALISATION (accessibility: heading-order) ────────────────────
    The rendered page starts at <h1> (the article title), so the first heading
    inside the body has to be an <h2> or the outline skips a level. It did:
    Substack writes sections as <h3>, demoteHeadings() shifts those to <h4>,
    and the page went h1 -> h4. axe flags that as "Heading elements are not in
    a sequentially-descending order" and it cost the article page 2 points
    (a11y 98) — measured, not theoretical.

    Fixing it in the SYNC would only help posts imported after the change;
    every article already in articles.json would keep its baked-in h4 until a
    re-sync. Doing it here fixes the existing archive on the next build, and
    the document outline is a presentation concern anyway.

    Distinct levels are ranked and remapped onto consecutive levels starting at
    h2, so relative depth survives and no level is ever skipped:

        [4]        -> h4 becomes h2
        [2,3,4]    -> unchanged
        [2,4]      -> h2 stays h2, h4 becomes h3   (the gap is closed)
  */
  const present = [
    ...new Set(
      Array.from(bodyHtml.matchAll(/<h([234])\b[^>]*>([\s\S]*?)<\/h\1>/gi))
        .filter((m) => plain(m[2]))
        .map((m) => Number(m[1])),
    ),
  ].sort((a, b) => a - b);

  /** Original heading level -> the level it should render at. */
  const levelFor = new Map(present.map((lvl, index) => [lvl, Math.min(6, index + 2)]));

  /*
    ─── WHY THIS MATCHES h4 AS WELL AS h2/h3 ─────────────────────────────────
    This is the bug that made the Contents rail vanish on real articles while
    working perfectly on generated ones.

    demoteHeadings() (articles-transform.ts) shifts every imported heading down
    one level so the page's own <h1> stays unique: h1→h2, h2→h3, **h3→h4**.
    Substack's editor writes its section headings as <h3>, so by the time a real
    post reaches here every heading is an <h4> — and this pattern only looked
    for h2 and h3, so it found nothing and the rail was never rendered.

    The mock generator happens to write <h2>, which demotes to <h3> and matched.
    So the rail worked on every test article and on none of the real ones.

    Matching the full post-demotion range (h2–h4) means any heading level an
    author uses in Substack registers, which is the actual requirement.
  */
  const html = bodyHtml.replace(
    /<h([234])([^>]*)>([\s\S]*?)<\/h\1>/gi,
    (match, levelRaw: string, attrs: string, inner: string) => {
      const text = plain(inner);
      if (!text) return match;

      // De-duplicate: two sections may share a heading, and duplicate ids
      // would make the second anchor unreachable.
      const base = toId(text) || `section-${entries.length + 1}`;
      let id = base;
      let n = 2;
      while (used.has(id)) id = `${base}-${n++}`;
      used.add(id);

      /* Normalised level — see the note above. Falls back to the original if
         the heading somehow was not seen in the pre-scan. */
      const level = levelFor.get(Number(levelRaw)) ?? Number(levelRaw);

      entries.push({ id, text, level });

      // Don't clobber an id the body already carries, but still retag it so
      // the outline stays sequential.
      const keptAttrs = /\bid=/.test(attrs) ? attrs : `${attrs} id="${id}"`;
      return `<h${level}${keptAttrs}>${inner}</h${level}>`;
    },
  );

  return { entries, html };
}
