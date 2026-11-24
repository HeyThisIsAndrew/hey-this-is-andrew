/**
 * Cover-image de-duplication for imported Substack articles.
 * Removes the first matching cover image from sanitized body HTML so the hero
 * and opening figure do not render the same photo twice.
 */

/** Reduce an image URL to a stable upstream asset identity independent of CDN transforms. */
export function imageFingerprint(url: string): string {
  if (!url) return '';

  let decoded = String(url);
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Malformed escapes — keep raw string
  }

  const youtube = decoded.match(/\/image\/youtube\/[^/]*\/([\w-]{6,})/i);
  if (youtube) return `youtube:${youtube[1]}`;

  const upload = decoded.match(/\/public\/images\/([^/?#]+)/i);
  if (upload) return `image:${upload[1]}`;

  const tail = decoded.split(/[?#]/)[0].split('/').filter(Boolean).pop() ?? '';
  return tail ? `url:${tail}` : '';
}

/**
 * Remove the article's cover image from its body if the body repeats it.
 * Strips only the first matching `<figure>`, linked `<img>`, or bare `<img>`.
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
