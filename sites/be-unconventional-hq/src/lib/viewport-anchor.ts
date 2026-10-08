/**
 * ─── KEEP FIXED CONTROLS TAPPABLE WHEN SAFARI RESIZES THE WEB VIEW ──────────
 *
 * THE REPORT THAT PINNED THIS DOWN
 * "In landscape the hamburger and the X are difficult to press… at the moment
 * that I closed all the tabs, it stopped happening." iPhone, iOS Safari.
 *
 * That detail is the whole diagnosis. With more than one tab open, Safari on
 * iPhone shows a tab bar in landscape, and that tab bar COLLAPSES as you
 * scroll down and expands again as you scroll up. Each collapse resizes the
 * web view. With a single tab there is no tab bar, nothing resizes, and the
 * buttons behave — which is exactly what was observed.
 *
 * iOS Safari does not reliably re-hit-test `position: fixed` elements after
 * that resize. They are PAINTED in the right place and their touch region is
 * left at the old one, so the reader presses what they can see and nothing
 * happens. Every control this was reported against is fixed or fixed-anchored:
 * #navbar (and the hamburger/X inside it), .modal-close in landscape, and
 * .close-fullscreen-btn inside the viewport-fixed category overlay.
 *
 * WHAT THIS DOES
 * `visualViewport` fires `resize`/`scroll` exactly when the browser chrome
 * changes — that is the signal, and it is the only reliable one; a window
 * `resize` does not fire for a chrome collapse. On each one:
 *
 *   1. Publishes the visual viewport's top offset as `--vv-top`, so any
 *      control that needs to sit below overlaying chrome can use it in CSS.
 *   2. Forces each fixed control's box to be recomputed, and with it its hit
 *      region, by writing a genuine sub-pixel layout mutation and reverting it
 *      on the NEXT frame.
 *
 * WHY THE MUTATION HAS TO BE REAL, AND REVERTED A FRAME LATER
 * The first version of this wrote each element's own computed `top` back onto
 * it and read `offsetHeight`, then restored the value in the same tick. That
 * is very likely a no-op: writing a property its used value already equals,
 * and reverting before the frame ends, gives the engine nothing to invalidate,
 * so the stale hit region survives. Credit to the Antigravity audit for
 * catching it.
 *
 * The mutation is `pointer-events`, toggled off and straight back with a
 * layout read between the two writes. That is the property the hit-test tree
 * is built from, so flipping it is exactly what makes WebKit rebuild it, and
 * it touches no visual geometry at all — nothing can transition, shift or
 * repaint as a side effect. An earlier version wrote `padding-bottom: 0.1px`
 * instead, which did dirty layout and fired `transition: all 0.4s` on
 * `.modal-overlay` on every call.
 *
 * NOT a transform: #navbar's transform drives its show/hide transition
 * (hero-cta.css), and stamping `translateZ(0)` over it would break that.
 *
 * NOT VERIFIABLE HERE. Chromium hit-tests fixed elements correctly, so neither
 * version can be shown to fix the WebKit symptom from this sandbox. What the
 * test asserts is that the correction runs, is bound to the right signal, and
 * leaves every control's geometry and inline styles exactly as it found them.
 *
 * COST, AND THE GATE THAT KEEPS IT DOWN
 * `visualViewport.scroll` fires continuously while a phone scrolls, and a
 * layout write per frame during scrolling is the exact thrash this is meant to
 * avoid — an earlier version had no gate, and with `.modal-overlay` still in
 * the list (it carries `transition: all 0.4s`) each write also started a 400ms
 * transition. Both found by the Antigravity audit.
 *
 * So the nudge only runs when the viewport GEOMETRY actually changed — size,
 * offset or scale. Those are the only things that stale a hit region; if none
 * of them moved there is nothing to invalidate and the pass is a string
 * compare. Hidden controls are skipped for the same reason: a closed overlay
 * has no hit region to fix, and writing to it can only start animations nobody
 * asked for.
 *
 * VERIFIED BY `scripts/e2e-viewport-anchor.test.mjs`, which fires the same
 * events and asserts every control keeps its exact position and inline styles.
 * Chromium cannot reproduce the stale-hit-region behaviour itself, so what is
 * testable here is that the correction runs, is bound to the right signals,
 * and disturbs nothing.
 */

/**
 * Controls that are fixed, or fixed-anchored, and were reported as untappable.
 *
 * `.modal-overlay` is deliberately NOT here. It carries
 * `transition: all 0.4s` (modal.css), so the 0.1px padding write below would
 * start a 400ms transition on it every time this runs — on an element that is
 * usually closed and invisible, from a handler bound to scroll. Found by the
 * Antigravity audit. It is the backdrop, not a control; `.modal-close` is the
 * button that was actually reported, and it is still covered.
 *
 * Before adding anything here, check what it transitions.
 */
const FIXED_CONTROLS = '#navbar, .nav-toggle, .modal-close, .close-fullscreen-btn';

let bound = false;

/**
 * Publish the viewport height the hero is sized from.
 *
 * ─── WHY THIS IS EXPORTED AND CALLED ON EVERY PAGE LOAD ─────────────────────
 *
 * `--vv-height` is an inline style on `<html>`, and Astro's ClientRouter swaps
 * that element's attributes on every client-side navigation — which WIPES it.
 * Measured: seeded `390px` on first load, `""` immediately after navigating to
 * /feed, still `""` after navigating back to the homepage. The hero then falls
 * back to `100svh`, i.e. silently back to the bug this replaced, until
 * something else happens to republish.
 *
 * `keepFixedControlsTappable()` cannot cover this: it is guarded by `bound` so
 * that its listeners are only attached once, so on the second and later
 * `astro:page-load` it returns immediately without reaching the publish.
 *
 * So this is its own export, and Layout.astro calls it on every
 * `astro:page-load` — cheap (one property read, one write), idempotent, and it
 * is the only thing standing between a client-side navigation and the hero
 * quietly reverting to a guessed height.
 *
 * Reads `visualViewport.height` rather than `innerHeight`: the two disagree
 * precisely when the browser chrome is overlaying, which is the case that
 * matters. Falls back to `innerHeight` where visualViewport is unavailable.
 */
export function publishViewportHeight(): void {
  const vv = window.visualViewport;
  const height = Math.round((vv && vv.height) || window.innerHeight);
  const value = `${height}px`;
  /* Same rule as --vv-top: an unchanged value is not rewritten, because any
     write to a custom property on <html> restyles the whole document. */
  if (height > 0 && document.documentElement.style.getPropertyValue('--vv-height') !== value) {
    document.documentElement.style.setProperty('--vv-height', value);
  }
}

export function keepFixedControlsTappable(): void {
  if (bound) return;
  const vv = window.visualViewport;
  if (!vv) return;
  bound = true;

  let queued = false;
  /* The viewport geometry the hit regions were last corrected for. Seeded
     with the geometry the page LOADED at: the controls were laid out against
     it moments ago, so there is nothing stale to correct yet. Starting empty
     made the first (idle) pass run the full nudge, a getComputedStyle() and
     a forced layout per control at page load (PageSpeed "Forced reflow",
     this module), for a viewport that had not changed. */
  let lastGeometry = `${vv.width}x${vv.height}@${vv.offsetTop},${vv.offsetLeft},${vv.scale}`;

  const refresh = () => {
    queued = false;

    /*
      ONLY NUDGE WHEN THE VIEWPORT ACTUALLY CHANGED.

      `visualViewport.scroll` fires continuously while the page moves on a
      phone, and a layout write per frame during scrolling is exactly the
      thrash this is supposed to avoid. But hit regions only go stale when the
      viewport GEOMETRY changes — a chrome collapse, a rotation, a pinch. If
      none of those numbers moved, there is nothing to invalidate, so the
      whole pass is a string compare.
    */
    const geometry = `${vv.width}x${vv.height}@${vv.offsetTop},${vv.offsetLeft},${vv.scale}`;
    const geometryChanged = geometry !== lastGeometry;
    lastGeometry = geometry;

    /* Publish the offset even when it is 0 — a stylesheet reading
       `var(--vv-top)` should get a real length rather than falling back.

       ONLY WHEN IT CHANGED. This runs on every visualViewport event, which
       on iOS arrives continuously while Safari's toolbar animates during a
       scroll, and a custom property written on <html> invalidates the style
       of every element on the page, even when the value is the same. That
       is a whole-document style pass per scroll frame for a number that is
       almost always 0 (reported: landscape iPhone, jittery through the
       entire homepage). */
    /* Compared with what is actually on <html>, not a cached copy: a
       ClientRouter navigation wipes <html>'s inline style, and a cache would
       then never rewrite it. Reading an inline property is free (no style
       recalc), unlike writing one. */
    const offsetTop = `${Math.max(0, Math.round(vv.offsetTop))}px`;
    const rootStyle = document.documentElement.style;
    if (rootStyle.getPropertyValue('--vv-top') !== offsetTop) {
      rootStyle.setProperty('--vv-top', offsetTop);
    }

    if (!geometryChanged) return;

    /*
      Toggle `pointer-events` and read layout back. That is precisely the
      property the hit-test tree is built from, so flipping it is what forces
      WebKit to rebuild it — and it touches NO visual geometry, so it cannot
      start a transition, shift a box, or cost a paint. Credit to the
      Antigravity audit, which proposed this after correctly identifying that
      the previous 0.1px padding write fired `transition: all 0.4s` on
      `.modal-overlay` every time it ran.

      Skips anything not currently rendered: a closed overlay has no hit region
      worth correcting.
    */
    for (const el of document.querySelectorAll<HTMLElement>(FIXED_CONTROLS)) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;

      const previous = el.style.pointerEvents;
      el.style.pointerEvents = 'none';
      void el.offsetHeight; // synchronous layout read, between the two writes
      el.style.pointerEvents = previous;
    }
  };

  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(refresh);
  };

  /* `resize` is the chrome collapsing or expanding; `scroll` on the visual
     viewport fires when it is panned independently of the layout viewport,
     which is the other way these two fall out of step. */
  vv.addEventListener('resize', schedule);
  vv.addEventListener('scroll', schedule);

  /*
    ─── ROTATION, WHICH IS THE SAME BUG WITH A DIFFERENT TRIGGER ─────────────

    Reported: load the site, press ENTER THE HQ, THEN rotate to landscape —
    the navbar and the X stop responding. Starting in landscape is fine. The
    difference is not the orientation, it is that the viewport was resized
    after the controls were laid out, which is exactly the condition that
    leaves fixed elements hit-tested at their old coordinates.

    Two things were missing:

    1. `orientationchange` and window `resize` were not listened to at all.
       `visualViewport.resize` is documented to cover this, but it is the same
       engine that is failing to re-hit-test in the first place — relying on
       one signal from it, for a bug in it, is optimistic. These are cheap.

    2. A rotation is ANIMATED, roughly 300ms on iOS. A correction that runs on
       the first event runs against a layout that is still moving, and the
       final geometry never gets a pass. So the refresh is repeated across the
       settling window rather than fired once.

    The repeats are idempotent — each is a 0.1px padding write on a handful of
    elements, reverted on the next frame — so an extra one costs nothing and a
    missed one costs the reader a dead button.
  */
  /*
    ─── AND THE HERO'S HEIGHT, WHICH ROTATION ALSO STALES ────────────────────

    Reported: load the homepage, then rotate the phone, and the hero is the
    wrong height — its centred content sits out of position and the section
    below can show through. Same trigger as the dead buttons above, same
    cause: the viewport changed after layout.

    `--vv-height` is seeded inline in Layout.astro before first paint (see the
    long note there for why the hero is measured rather than sized in
    svh/lvh/dvh — every static unit is a guess about the browser chrome and is
    wrong in one of its two states). This republishes it after a rotation.

    ONLY ON ROTATION. Deliberately NOT on `visualViewport.resize`/`scroll`,
    which is where a chrome collapse arrives. Updating there would resize the
    hero mid-scroll and re-rasterize the blurred `.hero-bg` — exactly the
    jitter `dvh` was rejected for, reintroduced by hand. Not updating there
    means the value behaves like a constant per orientation, which is the
    property that makes it safe.

    Read from `visualViewport.height` and not `innerHeight`: the two disagree
    precisely when the chrome is overlaying, which is the case that matters.
  */
  const SETTLE_MS = [0, 120, 320, 600];
  const refreshUntilSettled = () => {
    for (const delay of SETTLE_MS) {
      if (delay === 0) {
        schedule();
        publishViewportHeight();
      } else {
        setTimeout(() => {
          schedule();
          publishViewportHeight();
        }, delay);
      }
    }
  };

  /*
    ─── A WINDOW RESIZE IS NOT A ROTATION ───────────────────────────────────
    iOS Safari fires window `resize` whenever its toolbar collapses or
    expands, and in landscape it does that on every scroll. Listening to
    `resize` unconditionally republished --vv-height mid-scroll, which is the
    exact jitter the note above rules out: reported on an iPhone in
    landscape, the hero stack jumped and nearly doubled in height as the
    reader scrolled. A rotation (or a desktop window resize) changes the
    WIDTH; a chrome collapse changes only the height. So a resize republishes
    only when the width moved, and otherwise just re-hit-tests the fixed
    controls, which is what a collapse actually needs.
  */
  let lastWidth = window.innerWidth;
  const onWindowResize = () => {
    const width = window.innerWidth;
    if (width === lastWidth) {
      schedule();
      return;
    }
    lastWidth = width;
    refreshUntilSettled();
  };

  window.addEventListener('orientationchange', refreshUntilSettled);
  window.addEventListener('resize', onWindowResize);

  publishViewportHeight();
  
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(() => refresh());
  } else {
    setTimeout(refresh, 200);
  }
}
