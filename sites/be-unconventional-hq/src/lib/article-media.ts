/**
 * Cover-image de-duplication for imported Substack articles.
 *
 * ─── THE BUG THIS EXISTS FOR ──────────────────────────────────────────────
 * A post's cover image is delivered twice by the posts API: once as
 * `cover_image` (which becomes `article.image`, rendered as the page hero) and
 * again as the first `<figure>` inside `body_html`, because the author placed
 * it at the top of the post. Rendering both shows the same photo twice.
 *
 * ─── WHY IT ONLY AFFECTED *SOME* POSTS ────────────────────────────────────
 * It depends on what the cover actually is:
 *
 *   • "Mortal Kombat 2 Review" — cover is an uploaded photo, and the body
 *     opens with that same photo in a <figure>. Both survive sanitization,
 *     so the reader sees it twice.
 *   • "The Boys Season 5 Episode 5" — cover is a YouTube thumbnail
 *     (`/image/youtube/w_728,c_limit/<videoId>`) and the body opens with a
 *     YouTube <iframe> embed, which is NOT on the sanitizer's allowlist and
 *     is dropped entirely. There is no second <img> left to collide with.
 *
 * That asymmetry is why the duplicate looked arbitrary rather than systematic.
 *
 * ─── WHY MATCHING NEEDS A FINGERPRINT ─────────────────────────────────────
 * The two URLs are never byte-identical. Substack rewrites the same asset
 * through its image CDN with different transform parameters, and nests the
 * real upstream URL percent-encoded inside the path:
 *
 *   cover: …/image/fetch/$s_!qfD6!,f_auto,…/https%3A%2F%2F…%2Fa5e6…_2048x1152.jpeg
 *   body:  …/image/fetch/$s_!qfD6!,w_1456,c_limit,f_auto,…/https%3A%2F%2F…%2Fa5e6…_2048x1152.jpeg
 *                                  ^^^^^^^^^^^^^^ only the transform differs
 *
 * So identity is the upstream asset, not the URL. Pure functions, no I/O, so
 * this is testable offline — see scripts/articles.test.mjs.
 */

/**
 * Reduce an image URL to a stable identity for the asset behind it.
 *
 * Two URLs that render the same underlying image return the same string,
 * regardless of the CDN transform applied to either.
 */
export function imageFingerprint(url: string): string {
  if (!url) return '';

  let decoded = String(url);
  try {
    /* Substack nests the upstream URL percent-encoded inside the transform
       path, so decoding is what makes both variants comparable. */
    decoded = decodeURIComponent(decoded);
  } catch {
    /* Malformed escapes — keep the raw string rather than throwing. */
  }

  /* A YouTube thumbnail's identity is the video id, not the frame size. */
  const youtube = decoded.match(/\/image\/youtube\/[^/]*\/([\w-]{6,})/i);
  if (youtube) return `youtube:${youtube[1]}`;

  /* An uploaded asset's identity is its filename in substack-post-media. */
  const upload = decoded.match(/\/public\/images\/([^/?#]+)/i);
  if (upload) return `image:${upload[1]}`;

  /* Anything else: the last path segment with query/fragment removed. */
  const tail = decoded.split(/[?#]/)[0].split('/').filter(Boolean).pop() ?? '';
  return tail ? `url:${tail}` : '';
}

/**
 * Remove the article's cover image from its body, if the body repeats it.
 *
 * Removes the FIRST matching occurrence only. A whole `<figure>` is preferred
 * over a bare `<img>` so stripping the photo never strands its `<figcaption>`
 * as a caption with nothing above it.
 *
 * Regex over parsed HTML is safe here for the same reason buildPreview() gives:
 * the body has already been through sanitize-html, so the markup is
 * well-formed and the tag set is a known allowlist — this is not parsing
 * arbitrary HTML from the wild.
 *
 * @param bodyHtml sanitized article body
 * @param coverUrl the article's cover image URL (`article.image`)
 */
export function stripCoverImageFromBody(bodyHtml: string, coverUrl: string): string {
  const body = String(bodyHtml ?? '');
  const target = imageFingerprint(coverUrl);
  if (!body || !target) return body;

  const figures = body.match(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi) ?? [];
  for (const figure of figures) {
    const src = figure.match(/<img\b[^>]+src=["']([^"']+)["']/i)?.[1];
    if (src && imageFingerprint(src) === target) {
      return body.replace(figure, '');
    }
  }

  /* No <figure> wrapper — drop the bare <img>, plus a link wrapping only it. */
  const linked = body.match(/<a\b[^>]*>\s*<img\b[^>]*>\s*<\/a>/gi) ?? [];
  for (const anchor of linked) {
    const src = anchor.match(/<img\b[^>]+src=["']([^"']+)["']/i)?.[1];
    if (src && imageFingerprint(src) === target) {
      return body.replace(anchor, '');
    }
  }

  const images = body.match(/<img\b[^>]*>/gi) ?? [];
  for (const image of images) {
    const src = image.match(/src=["']([^"']+)["']/i)?.[1];
    if (src && imageFingerprint(src) === target) {
      return body.replace(image, '');
    }
  }

  return body;
}
