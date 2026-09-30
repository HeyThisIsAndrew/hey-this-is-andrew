// Normalises text that arrives from a feed (YouTube, Substack, the BE
// Unconventional HQ RSS) before it reaches the page.
//
// Why it exists: the BE feed ships titles like "You&apos;re" (and sometimes
// the entity double-encoded as "&amp;apos;"). The old per-file decoders
// knew five entities and decoded &amp; LAST, so &apos; survived and the
// page printed it literally. Every feed string now goes through here.

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  hellip: '…', ndash: '–', mdash: '—', middot: '·',
};

function decodeOnce(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : whole;
    }
    return NAMED[body.toLowerCase()] ?? whole;
  });
}

/** Decode HTML/XML entities, including double-encoded ones. */
export function decodeEntities(input: string): string {
  let s = input;
  for (let i = 0; i < 3; i++) {
    const next = decodeOnce(s);
    if (next === s) break;
    s = next;
  }
  return s;
}

/** Strip CDATA wrappers and tags, decode entities, collapse whitespace.
 *  House style (no em dashes in visitor copy): an em dash becomes a comma. */
export function cleanFeedText(input: string | null | undefined): string {
  if (!input) return '';
  const s = decodeEntities(
    String(input)
      .replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1')
      .replace(/<[^>]*>/g, ' ')
  )
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}
