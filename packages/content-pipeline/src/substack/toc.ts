/**
 * Table-of-contents builder for sanitized article HTML.
 * Normalizes heading levels sequentially starting at h2 and injects deduplicated anchor IDs.
 */

export interface TocEntry {
  id: string;
  text: string;
  level: number;
}

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

function toId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Scan h2–h4 headings in sanitized HTML, normalize levels sequentially from h2,
 * ensure every heading has a unique `id`, and return `{ entries, html }`.
 */
export function buildToc(bodyHtml: string): { entries: TocEntry[]; html: string } {
  if (!bodyHtml) return { entries: [], html: '' };

  const entries: TocEntry[] = [];
  const used = new Set<string>();

  const present = [
    ...new Set(
      Array.from(bodyHtml.matchAll(/<h([234])\b[^>]*>([\s\S]*?)<\/h\1>/gi))
        .filter((m) => plain(m[2]))
        .map((m) => Number(m[1])),
    ),
  ].sort((a, b) => a - b);

  const levelFor = new Map(present.map((lvl, index) => [lvl, Math.min(6, index + 2)]));

  const html = bodyHtml.replace(
    /<h([234])([^>]*)>([\s\S]*?)<\/h\1>/gi,
    (match, levelRaw: string, attrs: string, inner: string) => {
      const text = plain(inner);
      if (!text) return match;

      const existingIdMatch = attrs.match(/\bid\s*=\s*(["'])([^"']+)\1/i);
      const base = existingIdMatch?.[2] || toId(text) || `section-${entries.length + 1}`;
      let id = base;
      if (!existingIdMatch) {
        let n = 2;
        while (used.has(id)) id = `${base}-${n++}`;
      }
      used.add(id);

      const level = levelFor.get(Number(levelRaw)) ?? Number(levelRaw);
      entries.push({ id, text, level });

      const keptAttrs = existingIdMatch ? attrs : `${attrs} id="${id}"`;
      return `<h${level}${keptAttrs}>${inner}</h${level}>`;
    },
  );

  return { entries, html };
}
