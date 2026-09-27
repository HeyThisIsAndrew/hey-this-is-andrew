/**
 * Parallax fallback for browsers without CSS `animation-timeline: view()`.
 *
 * The CSS path in parallax.css is preferred (compositor-driven, zero JS).
 * This module only activates when `CSS.supports('animation-timeline: view()')`
 * is false. It mirrors the CSS keyframes with a single rAF loop:
 *
 * Anti-jitter rules (the photo elevator taught us):
 * - One rAF loop total, not one per element.
 * - Read scrollY once per frame; skip all writes if it hasn't changed.
 * - IntersectionObserver gates work to on-screen elements only.
 * - Write only the `translate` property (composes with the reveal
 *   system's `transform`; never triggers layout).
 * - Passive scroll listener; nothing runs when the tab is hidden.
 */

const MEDIA_RANGE = 0.08; // ±4% of element height, matches parallax-hero
const HEAD_RANGE_PX = 40; // ±20px, matches parallax-head's ±1.25rem

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function initParallaxFallback(): void {
  if (typeof window === 'undefined') return;
  // Native CSS timelines handle it; stay out of the way.
  if (typeof CSS !== 'undefined' && CSS.supports('animation-timeline: view()')) return;
  if (prefersReducedMotion()) return;
  if (!('IntersectionObserver' in window) || !('requestAnimationFrame' in window)) return;

  document.documentElement.classList.add('parallax-js');

  const targets = Array.from(
    document.querySelectorAll<HTMLElement>('.slide-media, .sec-head')
  );
  if (targets.length === 0) return;

  const visible = new Set<HTMLElement>();
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        if (entry.isIntersecting) {
          visible.add(el);
        } else {
          visible.delete(el);
          el.style.translate = '';
        }
      }
      schedule();
    },
    { rootMargin: '10% 0px 10% 0px' }
  );
  targets.forEach((el) => io.observe(el));

  let raf = 0;
  let lastY = -1;

  const tick = () => {
    raf = 0;
    if (document.hidden) {
      schedule();
      return;
    }
    const y = window.scrollY;
    if (y === lastY || visible.size === 0) {
      // No scroll delta or nothing on screen: no writes, but keep the
      // loop warm so newly revealed elements pick up immediately.
      if (visible.size > 0) schedule();
      return;
    }
    lastY = y;
    const vh = window.innerHeight;

    for (const el of visible) {
      const rect = el.getBoundingClientRect();
      if (rect.height === 0) continue;
      // Progress 0→1 as the element travels from viewport bottom to top.
      const center = rect.top + rect.height / 2;
      const p = Math.max(
        0,
        Math.min(1, 1 - (center - vh / 2) / (vh / 2 + rect.height / 2))
      );
      let px: number;
      if (el.classList.contains('slide-media')) {
        px = (p - 0.5) * MEDIA_RANGE * rect.height;
      } else {
        px = (0.5 - p) * HEAD_RANGE_PX;
      }
      el.style.translate = `0px ${px.toFixed(1)}px`;
    }
    schedule();
  };

  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(tick);
  };

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', () => {
    lastY = -1;
    schedule();
  });
  schedule();
}
