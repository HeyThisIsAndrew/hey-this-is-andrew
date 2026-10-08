/**
 * ─── JUMP THE PAGE. DO NOT ANIMATE IT. ──────────────────────────────────────
 *
 * `src/styles/global-base.css` sets `html { scroll-behavior: smooth }` for the
 * whole site, so a bare `window.scrollTo(x, y)` never jumps — it animates from
 * wherever the document currently is. Every correction that has to be
 * invisible (restoring the offset after a modal closes, undoing a scroll the
 * browser restored on refresh) has to opt out of that.
 *
 * ─── THE TRAP THIS FILE EXISTS TO CLOSE ─────────────────────────────────────
 *
 * The obvious opt-out is to swap the property out, scroll, and put it back:
 *
 *     root.style.scrollBehavior = 'auto';
 *     window.scrollTo(0, y);
 *     root.style.scrollBehavior = previous;
 *
 * That was used in six places in this codebase and it DOES NOT WORK. Setting
 * an inline style only marks style as dirty; it does not recalculate it. With
 * no recalc in between, `scrollTo()` still reads the old computed value —
 * `smooth` — and animates, and then the property is reverted before any later
 * recalc could ever see `auto`. It appears to work only when something else
 * happens to force a recalc first, which is why it survived review: it is
 * correct roughly half the time.
 *
 * Measured on the homepage (Chromium, jumping from 390 to 0,
 * reading scrollY on the very next animation frame):
 *
 *     pin html only ............ 390   ← still animating
 *     pin html + body .......... 390   ← still animating
 *     pin html + FLUSH ..........  0   ← a real jump
 *     behavior: 'instant' .......  0   ← a real jump
 *
 * So: read a layout property after setting the inline style, which forces the
 * recalc, and only then scroll.
 *
 * `behavior: 'instant'` measures identically and is shorter — but `instant`
 * only entered the `ScrollBehavior` enum in Safari 15.4, and an unrecognised
 * enum value throws a TypeError rather than degrading. On the older iOS Safari
 * this site is repeatedly bitten by, that would turn every one of these
 * corrections into an exception. The flush works everywhere.
 *
 * `scripts/reload-top-guard.test.mjs` fails the build if a call site goes
 * back to scrolling without either a stated behavior or this pin-and-flush.
 */
export function jumpTo(y = 0, x = 0): void {
  const root = document.documentElement;
  const previousBehavior = root.style.scrollBehavior;

  root.style.scrollBehavior = 'auto';
  /* Forces the style recalc. Without this line the assignment above has not
     been applied yet and scrollTo() still sees `smooth`. Do not remove it as
     a redundant read — it is the entire point of this function. */
  void root.offsetHeight;

  window.scrollTo(x, y);
  root.style.scrollBehavior = previousBehavior;
}
