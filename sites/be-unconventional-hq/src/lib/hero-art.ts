/**
 * The pieces of `/img/yt/<id>/<w>.webp` (src/pages/img/yt/[id]/[w].ts) that
 * can be tested under plain `node`: what is allowed, where it comes from, and
 * how a YouTube "no thumbnail" placeholder is recognised.
 * Why the route exists: firstPartyHeroSrcset() in ./homepage-feed.ts.
 */
import { HERO_ART_WIDTHS, HERO_STRIP_WIDTH } from './homepage-feed.ts';

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** `{ id, width }` for an allowed request, or null. Never an open proxy. */
export function parseHeroArtParams(id: unknown, file: unknown): { id: string; width: number } | null {
  if (typeof id !== 'string' || !VIDEO_ID.test(id)) return null;
  const m = typeof file === 'string' ? /^(\d{3,4})\.webp$/.exec(file) : null;
  const width = m ? Number(m[1]) : NaN;
  if (!(HERO_ART_WIDTHS as readonly number[]).includes(width)) return null;
  return { id, width };
}

/**
 * The exact wsrv.nl URL the page used to request itself (same query, same
 * order), so this shares wsrv's already-warm cache rather than starting a
 * cold one. The strip rung is the exception: q=50, because it is only ever
 * shown blurred (HERO_STRIP_WIDTH in ./homepage-feed.ts).
 */
export function heroArtUpstream(id: string, width: number): string {
  const quality = width === HERO_STRIP_WIDTH ? 50 : 85;
  return `https://wsrv.nl/?url=i.ytimg.com%2Fvi%2F${id}%2Fmaxresdefault.jpg&w=${width}&output=webp&q=${quality}&we`;
}

/**
 * If wsrv.nl cannot be reached from the Worker, YouTube's own WebP of the
 * original. Heavier (1280px), but the right shape: failing outright would put
 * the panel on the recovery's 4:3 hqdefault, letterbox bars and all.
 */
export function heroArtFallback(id: string): string {
  return `https://i.ytimg.com/vi_webp/${id}/maxresdefault.webp`;
}

/**
 * Width of a WebP image from its header, or null if it is not one.
 * A video without a maxres thumbnail yields YouTube's 120x90 placeholder, and
 * with `we` (never enlarge) wsrv passes it through at 120px. The browser
 * cannot tell that from a real image, so the route answers 404 for it and the
 * page's thumbnail recovery (Layout.astro) steps down to hqdefault.
 */
export function webpWidth(bytes: Uint8Array): number | null {
  if (bytes.length < 30) return null;
  const tag = (o: number, s: string) => [...s].every((c, i) => bytes[o + i] === c.charCodeAt(0));
  if (!tag(0, 'RIFF') || !tag(8, 'WEBP')) return null;
  if (tag(12, 'VP8X')) return 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
  if (tag(12, 'VP8L')) return 1 + (bytes[21] | ((bytes[22] & 0x3f) << 8));
  if (tag(12, 'VP8 ')) return (bytes[26] | (bytes[27] << 8)) & 0x3fff;
  return null;
}

/** YouTube's missing-thumbnail placeholder is 120x90; nothing real is that small. */
export const PLACEHOLDER_MAX_WIDTH = 120;
