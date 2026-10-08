/**
 * GET /img/yt/<videoId>/<width>.webp — the homepage hero's art, from our own
 * origin. Why: firstPartyHeroSrcset() in src/lib/homepage-feed.ts. What is
 * allowed and how a missing thumbnail is caught: src/lib/hero-art.ts.
 *
 * On-demand at the edge (prerender=false). A good response is cached by
 * Cloudflare for a week (`cache.set` below, through the cacheCloudflare
 * provider), so the Worker fetches each rendition from wsrv.nl once per edge
 * location, not per visit. It is set per response rather than as a route rule
 * because a rule would cache the 404s too.
 *
 * If wsrv.nl is unreachable it serves YouTube's own WebP original instead
 * (same shape, heavier). If THAT fails too, a 404 with no-store: the srcset's
 * top rung is still YouTube's maxresdefault.jpg and `src` is hqdefault.jpg,
 * so the page's thumbnail recovery (Layout.astro) takes over exactly as it did
 * when the browser called wsrv.nl directly.
 */
import type { APIRoute } from 'astro';
import { heroArtFallback, heroArtUpstream, parseHeroArtParams, PLACEHOLDER_MAX_WIDTH, webpWidth } from '../../../../lib/hero-art';

export const prerender = false;

const notFound = () =>
  new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

export const GET: APIRoute = async ({ params, cache }) => {
  /* Nothing is edge-cached unless it turns out to be a real image. */
  cache.set(false);

  const parsed = parseHeroArtParams(params.id, params.w);
  if (!parsed) return notFound();

  /* The resized rendition first; YouTube's own WebP original if wsrv.nl is
     unreachable (heroArtFallback). Either must be a real image, not the
     120x90 "no thumbnail" placeholder. */
  let body: Uint8Array<ArrayBuffer> | null = null;
  let resized = false;
  for (const url of [heroArtUpstream(parsed.id, parsed.width), heroArtFallback(parsed.id)]) {
    try {
      const upstream = await fetch(url, { headers: { Accept: 'image/webp,image/*' } });
      if (!upstream.ok) continue;
      const bytes = new Uint8Array<ArrayBuffer>(await upstream.arrayBuffer());
      const width = webpWidth(bytes);
      if (width === null || width <= PLACEHOLDER_MAX_WIDTH) continue;
      body = bytes;
      resized = url.startsWith('https://wsrv.nl/');
      break;
    } catch {
      /* try the next source */
    }
  }
  if (!body) return notFound();

  /* A fallback original is served but not kept at the edge for a week: the
     next request should get the resized rendition once wsrv answers again. */
  cache.set(resized ? { maxAge: 604800, swr: 86400 } : { maxAge: 3600 });
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'image/webp',
      /* A browser keeps it a day; the edge keeps it a week (routeRules). A
         re-uploaded thumbnail therefore reaches readers within a day. */
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
