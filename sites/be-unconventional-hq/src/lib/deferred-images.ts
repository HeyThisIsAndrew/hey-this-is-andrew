/**
 * ─── IMAGES THAT MUST NOT COMPETE WITH THE LCP IMAGE ─────────────────────────
 *
 * An <img> rendered with `data-defer-src` / `data-defer-srcset` instead of
 * `src` / `srcset` is not requested until the page has finished loading, or
 * until it is actually on screen if the reader scrolls there first.
 *
 * WHY NOT `loading="lazy"`. It was already lazy. Chrome starts a lazy image
 * when it is within 1,250px of the viewport on a 4G connection, and the
 * homepage's Intel spread begins ~320px below the fold on a phone, so all
 * five of its images (~89 KiB from substackcdn.com, one a 46 KiB PNG) were
 * requested during the first second, on their own connection, while the hero
 * art (the page's LCP element) was still downloading. Measured under DevTools
 * throttling, holding them back moved real LCP 1.42s -> 1.31s, and PageSpeed's
 * worst simulated LCP 3.31s -> 3.01s.
 *
 * AFTER `load`, THEN NEAR THE VIEWPORT. Once the load event has fired the LCP
 * window is over, so anything within 800px is filled straight away and the
 * rest as the reader approaches it. Before `load`, only an image that is
 * genuinely in view is filled (a reader who flings down the page early).
 *
 * Layout.astro's broken-image sweep skips `[data-defer-src]`: an <img> with no
 * src is `complete` with `naturalWidth === 0`, which is its test for "broken".
 */

const SELECTOR = 'img[data-defer-src]';

/** Put the real sources in place. srcset first, so `src` never wins alone. */
export function fillDeferredImage(img: HTMLImageElement): void {
  const src = img.dataset.deferSrc;
  if (!src) return;
  const srcset = img.dataset.deferSrcset;
  if (srcset) img.srcset = srcset;
  img.src = src;
  delete img.dataset.deferSrc;
  delete img.dataset.deferSrcset;
}

/** Drop the pending sources without loading them (the image was repainted). */
export function cancelDeferredImage(img: HTMLImageElement): void {
  delete img.dataset.deferSrc;
  delete img.dataset.deferSrcset;
}

let observer: IntersectionObserver | null = null;

function observe(rootMargin: string): void {
  observer?.disconnect();
  const images = document.querySelectorAll<HTMLImageElement>(SELECTOR);
  if (images.length === 0) {
    observer = null;
    return;
  }
  if (!('IntersectionObserver' in window)) {
    images.forEach(fillDeferredImage);
    return;
  }
  observer = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        obs.unobserve(entry.target);
        fillDeferredImage(entry.target as HTMLImageElement);
      }
    },
    { rootMargin },
  );
  images.forEach((img) => observer!.observe(img));
}

export function initDeferredImages(): void {
  if (document.readyState === 'complete') {
    observe('800px 0px');
    return;
  }
  observe('0px');
  window.addEventListener('load', () => observe('800px 0px'), { once: true });
}
