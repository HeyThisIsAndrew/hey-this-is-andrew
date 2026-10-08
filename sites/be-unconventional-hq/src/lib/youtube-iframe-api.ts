/**
 * Load YouTube's IFrame Player API once, and resolve with `window.YT` when its
 * `YT.Player` is usable (or `null` when the script is blocked).
 *
 * ─── A CALLBACK IS NOT A LOAD ────────────────────────────────────────────────
 * This used to live in FeaturedHighlights.astro and treated an existing
 * `window.onYouTubeIframeAPIReady` as proof that someone else had the API on
 * its way: it chained onto the callback and returned WITHOUT injecting the
 * script. On production that was never true. Google Tag Manager (injected by
 * Cloudflare's tag gateway, so it never runs in local dev) carries a YouTube
 * Video trigger, which defines that callback ~150ms into every page and then
 * waits for a jsapi player to appear before it loads the API itself. The
 * homepage Featured shelf was the player it was waiting for, and the shelf was
 * waiting for GTM: neither ever injected `iframe_api`, no player was built, no
 * preview started, and every tap fell through to the modal. Measured on
 * beunconventionalhq.com at commit 4264ddd: callback set by /nlsh at 158ms,
 * no `iframe_api` script in the document 12s later.
 *
 * So the evidence of a load in flight is the SCRIPT TAG, never the callback.
 * The callback is always chained (GTM's must keep firing, or its video
 * analytics stop) and the script is injected unless one is already present.
 * Two copies racing is harmless: iframe_api guards itself with `YT.loading`.
 *
 * `win` and `doc` are parameters only so scripts/youtube-iframe-api.test.mjs
 * can drive this with stubs under plain node.
 */

export const IFRAME_API_SRC = 'https://www.youtube.com/iframe_api';

export function loadYouTubeAPI(win: any = window, doc: Document = document): Promise<any> {
  return new Promise((resolve) => {
    if (win.YT && win.YT.Player) {
      resolve(win.YT);
      return;
    }

    const previous = win.onYouTubeIframeAPIReady;
    win.onYouTubeIframeAPIReady = () => {
      if (typeof previous === 'function') {
        /* A throwing third-party callback must not cost us the player. */
        try {
          previous();
        } catch (err) {
          console.warn('onYouTubeIframeAPIReady: an earlier callback threw', err);
        }
      }
      resolve(win.YT);
    };

    const inFlight = doc.querySelector('script[src*="youtube.com/iframe_api"]');
    if (inFlight) {
      inFlight.addEventListener('error', () => resolve(null));
      return;
    }

    const tag = doc.createElement('script');
    tag.src = IFRAME_API_SRC;
    tag.onerror = () => {
      console.warn('YouTube Iframe API blocked. Falling back to static carousel.');
      resolve(null);
    };
    const firstScriptTag = doc.getElementsByTagName('script')[0];
    if (firstScriptTag && firstScriptTag.parentNode) {
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    } else {
      doc.head.appendChild(tag);
    }
  });
}
