/**
 * SCROLL LOCK — one implementation, used by every overlay on the site.
 *
 * ─── THE BUG THIS REPLACES ────────────────────────────────────────────────
 * There were FOUR copies of this logic (the video modal in Layout.astro, the
 * contact modal, the mobile nav menu and the category overlay) and they had
 * drifted apart. The video modal's copy was broken in a way that produced the
 * worst UX bug on the site: it added the CSS lock class…
 *
 *     document.documentElement.classList.add('modal-open');
 *
 * …which pins `<body>` with `position: fixed` (see styles/modules/ios-lock.css)
 * but it never recorded the scroll offset, and never set the matching
 * `body.style.top = '-<scrollY>px'`. So:
 *
 *   • ON OPEN the body was pinned with no offset, so the page behind the modal
 *     silently jumped to the very top.
 *   • ON CLOSE the restore read `parseInt(document.body.style.top || '0')`,
 *     which was always the empty string → 0, and then never called
 *     `window.scrollTo()` at all. Where you ended up was whatever the browser
 *     happened to remember — hence "aggressively and inconsistently jumps".
 *
 * ─── WHY A COUNTER ────────────────────────────────────────────────────────
 * Overlays can nest — open the mobile menu, tap a video from it, close the
 * video. Naïvely locking and unlocking would release the page while the menu
 * was still open. The old code tried to paper over this with
 * `if (document.body.style.position !== 'fixed')`, which silently made the
 * SECOND overlay's close a no-op. Reference counting handles it correctly:
 * the page locks on 0 → 1 and unlocks on 1 → 0, and the scroll offset is
 * captured exactly once, by the first locker.
 *
 * ─── WHY THE SCROLLBAR GUTTER MATTERS ─────────────────────────────────────
 * Pinning the body removes the document scrollbar. On any desktop browser
 * with classic (space-consuming) scrollbars, the content underneath then gets
 * ~15px wider and everything visibly shifts sideways as the modal opens. We
 * measure that gutter before locking and pad it back on, so nothing moves.
 *
 * `--scrollbar-gutter` is also published on <html> so `position: fixed`
 * elements — which are laid out against the viewport and so do NOT inherit
 * body padding — can compensate too. The navbar uses it; see ios-lock.css.
 *
 * ─── WHY SCROLL BEHAVIOUR IS FORCED TO `auto` ─────────────────────────────
 * `html { scroll-behavior: smooth }` is set globally (styles/global-base.css).
 * Without overriding it, restoring the offset ANIMATES a scroll back to
 * position — which is the visible "aggressive scrolling" on close. The restore
 * has to be instant, so we swap the property, jump, and put it back.
 *
 * ─── USAGE ────────────────────────────────────────────────────────────────
 *     import { lockScroll, unlockScroll, releaseScrollLock } from '../lib/scroll-lock';
 *
 *     openOverlay()  → lockScroll();
 *     closeOverlay() → unlockScroll();
 *
 * And on `astro:before-swap`, where the page is being replaced underneath us
 * and counting no longer means anything:
 *
 *     releaseScrollLock();
 */
import { jumpTo } from './scroll-to.ts';

/** How many overlays currently want the page held still. */
let lockCount = 0;

/** Scroll offset captured by the FIRST locker, restored by the last unlocker. */
let savedScrollY = 0;

/** True while the body is pinned. Exported for tests and defensive callers. */
export function isScrollLocked(): boolean {
  return lockCount > 0;
}

/**
 * Width of the classic scrollbar, or 0 where scrollbars are overlaid (every
 * touch device, and macOS by default). Measured BEFORE the lock is applied —
 * afterwards the scrollbar is already gone and this always reads 0.
 */
function measureScrollbarGutter(): number {
  return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
}

/**
 * Hold the page still.
 *
 * Safe to call repeatedly: only the first call actually pins anything, so an
 * overlay does not need to know whether another one is already open.
 */
export function lockScroll(): void {
  lockCount += 1;
  if (lockCount > 1) return; // Already locked by someone else.

  savedScrollY = window.scrollY;

  const gutter = measureScrollbarGutter();
  const root = document.documentElement;
  const body = document.body;

  /*
    Published for fixed-position elements, which are positioned against the
    viewport and therefore never inherit the body padding below.
  */
  root.style.setProperty('--scrollbar-gutter', `${gutter}px`);

  /*
    The offset is the entire trick: `position: fixed` alone would snap the
    page to the top, so the body is shifted UP by exactly how far the reader
    had scrolled, leaving the same pixels on screen.
  */
  body.style.top = `-${savedScrollY}px`;
  body.style.position = 'fixed';
  body.style.left = '0';
  body.style.width = '100%';
  if (gutter > 0) body.style.paddingRight = `${gutter}px`;

  /*
    Also mirrored onto <body> as a data attribute. Nothing here reads it back
    — `savedScrollY` above is the source of truth — but it makes the locked
    state and its offset visible in devtools, which is how the original bug
    was finally pinned down.
  */
  body.dataset.scrollLock = String(savedScrollY);

  /* The CSS half of the lock — see styles/modules/ios-lock.css. `overflow:
     hidden` alone is not enough on iOS Safari, which rubber-bands the page
     behind a fixed overlay regardless. */
  root.classList.add('modal-open');
}

/**
 * Release the page and put the reader back exactly where they were.
 *
 * Only the last outstanding lock actually restores, so closing a video modal
 * that was opened from the mobile menu leaves the menu's lock intact.
 */
export function unlockScroll(): void {
  if (lockCount === 0) return; // Never locked, or already released.

  lockCount -= 1;
  if (lockCount > 0) return; // Another overlay still needs the lock.

  applyRelease(savedScrollY, true);
}

/**
 * Force the lock off, whatever the count, and WITHOUT restoring the scroll
 * position.
 *
 * This exists for `astro:before-swap`: the document is about to be replaced,
 * so the old offset is meaningless and scrolling to it would fight the router,
 * which does its own scroll handling on navigation. Resetting the counter also
 * stops a lock leaking across a client-side navigation and pinning the next
 * page permanently.
 */
export function releaseScrollLock(): void {
  lockCount = 0;
  applyRelease(0, false);
}

/** Strip every trace of the lock; optionally jump back to `scrollY`. */
function applyRelease(scrollY: number, restore: boolean): void {
  const root = document.documentElement;
  const body = document.body;

  body.style.position = '';
  body.style.top = '';
  body.style.left = '';
  body.style.width = '';
  body.style.paddingRight = '';
  /* Cleared because older copies of this logic set it; a stale `overflow-y:
     scroll` left on the body renders a dead scrollbar track after close. */
  body.style.overflowY = '';
  delete body.dataset.scrollLock;

  root.style.removeProperty('--scrollbar-gutter');
  root.classList.remove('modal-open');
  /* `menu-open` triggers the same CSS lock and is set by the mobile nav.
     Clearing both here means one release path covers every overlay. */
  root.classList.remove('menu-open');

  if (!restore) return;

  /*
    Instant, not smooth. `html { scroll-behavior: smooth }` is global, so a
    plain scrollTo() here animates — which is exactly the scrolling the reader
    sees on close. See src/lib/scroll-to.ts for why the obvious swap-it-out
    version of this silently did not work.
  */
  jumpTo(scrollY);

  savedScrollY = 0;
}

/**
 * ─── BRIDGE FOR `is:inline` SCRIPTS ───────────────────────────────────────
 *
 * An inline script is copied verbatim into the HTML and never goes through
 * the bundler, so it cannot `import`. Two overlays are written that way for
 * good reason — the contact modal and the mobile nav are plain untyped DOM
 * code, and converting them to bundled modules purely to reach this file
 * would mean type-annotating every query in two working components.
 *
 * So this module publishes itself. Any inline script can call:
 *
 *     window.__hqScrollLock.lock();
 *     window.__hqScrollLock.unlock();
 *
 * This is still ONE implementation — the bridge forwards to the exact
 * functions above, sharing the same counter and the same saved offset. That
 * matters: a global that kept its own state would reintroduce the bug this
 * file exists to fix.
 *
 * Registration happens as a side effect of importing this module, and
 * src/layouts/Layout.astro imports it on every page, so the object always
 * exists before any click can reach an overlay.
 */
declare global {
  interface Window {
    __hqScrollLock: {
      lock: () => void;
      unlock: () => void;
      release: () => void;
      isLocked: () => boolean;
      /** src/lib/scroll-to.ts — a scroll that jumps instead of animating. */
      jumpTo: (y?: number, x?: number) => void;
    };
  }
}

if (typeof window !== 'undefined') {
  window.__hqScrollLock = {
    lock: lockScroll,
    unlock: unlockScroll,
    release: releaseScrollLock,
    isLocked: isScrollLocked,
    jumpTo,
  };
}
