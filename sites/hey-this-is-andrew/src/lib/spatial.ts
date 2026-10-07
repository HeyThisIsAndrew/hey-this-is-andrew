/**
 * spatial.ts — Site-wide spatial transition system for Hey This Is Andrew.
 *
 * The core principle: when a user selects something that represents a
 * destination or expanded state, the transition into that destination
 * feels spatially connected to the selected element.
 *
 *   tap → zoom into selected thing → content expands/morphs → destination
 *
 * NOT: tap → fade out → new page.
 *
 * Techniques: FLIP-style measurements, clip-path, CSS transforms,
 * and the View Transitions API where appropriate. No animation library.
 *
 * Motion character (per Andrew's direction):
 * - Fast, deliberate, tactile, readable, causally tied to the action
 * - Controlled spring-like deceleration, little or no overshoot
 * - No cheesy bounce, no particles, no glows, no gratuitous gradients
 * - No slow cinematic fades, no dead time
 */

export const EASING = {
  /** Standard: fast out, smooth land. Default for most transitions. */
  standard: "cubic-bezier(0.22, 0.61, 0.36, 1)",
  /** Zoom expand: accelerates out of the source, settles into destination. */
  zoomOut: "cubic-bezier(0.32, 0.72, 0, 1)",
  /** Zoom return: smooth re-entry to the source rect. */
  zoomIn: "cubic-bezier(0.22, 0.61, 0.36, 1)",
  /** Subtle overshoot — ONLY for small settle moments (photo landing in viewer). */
  settle: "cubic-bezier(0.34, 1.18, 0.64, 1)",
  /** Micro-interactions: quick and tactile. */
  snap: "cubic-bezier(0.2, 0.9, 0.25, 1)",
} as const;

export const DURATION = {
  /** Micro: button press, link underline, menu link stagger step. */
  micro: 180,
  /** Quick: mobile menu, small overlays. */
  quick: 280,
  /** Standard: panel switches, slide changes. */
  standard: 380,
  /** Spatial: zoom expansions (desktop). Matches BrandZoom's 550ms. */
  spatial: 550,
  /** Spatial on small screens — shorter distance, shorter time. */
  spatialMobile: 400,
} as const;

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function isMobileWidth(): boolean {
  return typeof window !== "undefined" && window.innerWidth <= 767;
}

export function spatialDuration(): number {
  return isMobileWidth() ? DURATION.spatialMobile : DURATION.spatial;
}

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function rectOf(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/** Convert a viewport rect to a CSS clip-path inset() string. */
export function insetOf(r: Rect): string {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const top = Math.max(0, Math.round(r.top));
  const left = Math.max(0, Math.round(r.left));
  const right = Math.max(0, Math.round(vw - (r.left + r.width)));
  const bottom = Math.max(0, Math.round(vh - (r.top + r.height)));
  return `inset(${top}px ${right}px ${bottom}px ${left}px)`;
}

/**
 * Jump the page without animating.
 *
 * `html { scroll-behavior: smooth }` is global, so a bare window.scrollTo()
 * animates. Setting the inline style alone does not recalculate in time —
 * a layout read (void offsetHeight) forces the recalc before scrolling.
 * Adapted from BE Unconventional HQ's scroll-to.ts.
 */
export function jumpTo(y = 0, x = 0): void {
  const root = document.documentElement;
  const previousBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = "auto";
  void root.offsetHeight; // force recalc; do not remove
  window.scrollTo(x, y);
  root.style.scrollBehavior = previousBehavior;
}

/**
 * Lock body scroll while a fullscreen overlay is open.
 * Returns an unlock function. Reference-counted so nested overlays are safe.
 *
 * Ported from BE Unconventional HQ's scroll-lock.ts:
 * - The FIRST locker captures scrollY and pins the body with
 *   `position: fixed` + `top: -scrollY`, so the page never jumps to top.
 * - The scrollbar gutter is measured before locking and padded back, so
 *   desktop content does not shift sideways when the scrollbar disappears.
 * - The LAST unlock restores the exact offset with an instant jumpTo
 *   (not a smooth scroll), and clears every trace of the lock.
 * - `modal-open` on <html> drives the iOS CSS half of the lock
 *   (see global.css), which matters on iOS Safari rubber-banding.
 */
let lockCount = 0;
let savedScrollY = 0;
export function lockBody(): () => void {
  lockCount += 1;
  if (lockCount === 1) {
    savedScrollY = window.scrollY;
    const gutter = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    const root = document.documentElement;
    const body = document.body;
    // Published for fixed-position elements (the navbar) which do not
    // inherit body padding.
    root.style.setProperty("--scrollbar-gutter", `${gutter}px`);
    body.style.top = `-${savedScrollY}px`;
    body.style.position = "fixed";
    body.style.left = "0";
    body.style.width = "100%";
    if (gutter > 0) body.style.paddingRight = `${gutter}px`;
    body.dataset.spatialLock = String(savedScrollY);
    root.classList.add("modal-open");
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount > 0) return; // another overlay still holds the lock
    const root = document.documentElement;
    const body = document.body;
    body.style.position = "";
    body.style.top = "";
    body.style.left = "";
    body.style.width = "";
    body.style.paddingRight = "";
    body.style.overflowY = "";
    delete body.dataset.spatialLock;
    root.style.removeProperty("--scrollbar-gutter");
    root.classList.remove("modal-open");
    root.classList.remove("menu-open");
    jumpTo(savedScrollY);
    savedScrollY = 0;
  };
}

/** True while any overlay holds the scroll lock. */
export function isScrollLocked(): boolean {
  return lockCount > 0;
}

/**
 * Simple focus trap for modal overlays.
 * Returns a release function. Handles Tab/Shift+Tab cycling.
 */
export function trapFocus(container: HTMLElement): () => void {
  const FOCUSABLE =
    'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

  function focusables(): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => {
        if (el.getAttribute("aria-hidden") === "true") return false;
        const r = el.getBoundingClientRect();
        // Geometry/visibility check: skip zero-area or offscreen elements.
        return r.width > 0 && r.height > 0;
      }
    );
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key !== "Tab") return;
    const items = focusables();
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  container.addEventListener("keydown", onKeydown);
  return () => container.removeEventListener("keydown", onKeydown);
}

/**
 * FLIP-zoom an overlay open from a source element's rect.
 *
 * The overlay is a fixed fullscreen element. It starts clipped to the
 * source rect (via clip-path inset) and expands to fullscreen, so the
 * destination visibly grows OUT OF the thing the user tapped.
 *
 * Options:
 * - source: element the user interacted with (measured at call time)
 * - overlay: the fullscreen overlay element to animate
 * - duration: ms (defaults to spatial duration for this viewport)
 * - onDone: called after the expand completes
 *
 * Returns a `close` function that reverses the animation back to the
 * source's CURRENT rect (re-measured, so moving sources still land).
 */
export function flipZoomOpen(opts: {
  source: Element;
  overlay: HTMLElement;
  duration?: number;
  easing?: string;
  instant?: boolean;
  onDone?: () => void;
}): () => void {
  const { source, overlay } = opts;
  const duration = opts.duration ?? spatialDuration();
  const easing = opts.easing ?? EASING.zoomOut;
  const reduced = prefersReducedMotion() || opts.instant;

  const startInset = insetOf(rectOf(source));

  // Start state: clipped to the source.
  overlay.style.visibility = "visible";
  overlay.style.pointerEvents = "auto";
  overlay.setAttribute("aria-hidden", "false");

  if (reduced) {
    overlay.style.clipPath = "inset(0px 0px 0px 0px)";
    opts.onDone?.();
    return closeFn;
  }

  overlay.style.clipPath = startInset;
  // Force reflow so the start state commits before we transition.
  void overlay.offsetWidth;
  overlay.style.transition = `clip-path ${duration}ms ${easing}`;
  overlay.style.clipPath = "inset(0px 0px 0px 0px)";

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    overlay.style.transition = "";
    opts.onDone?.();
  };
  const onEnd = (e: TransitionEvent) => {
    if (e.propertyName === "clip-path") finish();
  };
  overlay.addEventListener("transitionend", onEnd, { once: true });
  window.setTimeout(finish, duration + 120);

  function closeFn(): void {
    close();
  }

  function close(): void {
    overlay.removeEventListener("transitionend", onEnd);
    const endInset = insetOf(rectOf(source));
    const reducedClose = prefersReducedMotion();

    if (reducedClose) {
      overlay.style.clipPath = endInset;
      hide();
      return;
    }

    overlay.style.transition = `clip-path ${duration}ms ${EASING.zoomIn}`;
    // Ensure we're at fullscreen before reversing.
    overlay.style.clipPath = "inset(0px 0px 0px 0px)";
    void overlay.offsetWidth;
    overlay.style.clipPath = endInset;

    let closed = false;
    const finishClose = () => {
      if (closed) return;
      closed = true;
      overlay.style.transition = "";
      hide();
    };
    overlay.addEventListener("transitionend", function h(e: TransitionEvent) {
      if (e.propertyName === "clip-path") {
        overlay.removeEventListener("transitionend", h);
        finishClose();
      }
    });
    window.setTimeout(finishClose, duration + 120);
  }

  function hide(): void {
    overlay.hidden = true;
    overlay.style.visibility = "hidden";
    overlay.style.pointerEvents = "none";
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.clipPath = "";
  }

  return closeFn;
}

/**
 * FLIP-morph an element from one viewport rect to another.
 *
 * The element must already be laid out at the `to` rect (its resting
 * state). The animation starts it looking like `from` and lands it at
 * `to`. The caller sets transform-origin on the element (usually `0 0`).
 *
 * Used by the immersive photo viewer: the photograph itself travels
 * from the tapped thumbnail's rect to fullscreen (and back), so the
 * camera appears to move INTO the photo rather than opening a modal.
 * No animation library; WAAPI with a timeout safety net.
 */
export async function flipRect(
  el: HTMLElement,
  from: Rect,
  to: Rect,
  opts?: { duration?: number; easing?: string; uniform?: boolean }
): Promise<void> {
  const duration = opts?.duration ?? spatialDuration();
  const easing = opts?.easing ?? EASING.zoomOut;
  if (prefersReducedMotion()) return Promise.resolve();
  const dx = from.left - to.left;
  const dy = from.top - to.top;
  let sx = from.width / to.width;
  let sy = from.height / to.height;
  // Uniform scale for camera-like movement: the image itself is never
  // stretched or warped. The scale is uniform, maintaining aspect ratio.
  // The inner img uses object-fit: contain, so letterboxing is handled.
  if (opts?.uniform) {
    const s = Math.max(sx, sy);
    sx = s;
    sy = s;
  }
  const anim = el.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
      { transform: "translate(0px, 0px) scale(1, 1)" },
    ],
    { duration, easing, fill: "both" }
  );
  // Safety: WAAPI `finished` can hang if the tab is backgrounded.
  const p1 = anim.finished.catch(() => {});
  const p2 = new Promise<void>((resolve) => window.setTimeout(resolve, duration + 200));
  return Promise.race([p1, p2]).then(() => {});
}

/**
 * Route transitions: tap → zoom into the selected element → new page.
 *
 * Outgoing: intercept clicks on same-origin route links. Expand a veil
 * from the clicked element's rect to fullscreen, then navigate.
 * Incoming: the destination page checks sessionStorage for a pending
 * transition and plays a settle animation on its main content.
 *
 * Usage:
 *   initRouteTransitions('a[data-route-zoom]')  — call once per page.
 *   handleRouteEnter() — call on DOMContentLoaded of every page.
 */
const ROUTE_KEY = "htia-route-transition";

interface PendingRoute {
  url: string;
  rect: Rect;
  label: string;
  at: number;
}

export function initRouteTransitions(selector = "a[data-route-zoom]"): void {
  document.addEventListener("click", (e) => {
    const link = (e.target as Element).closest?.(selector) as HTMLAnchorElement | null;
    if (!link) return;
    // Only plain left-clicks on same-origin URLs.
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    )
      return;
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    if (url.pathname === window.location.pathname && url.hash) return; // anchor on same page

    e.preventDefault();

    const rect = rectOf(link);
    const pending: PendingRoute = {
      url: url.pathname + url.search + url.hash,
      rect,
      label: link.getAttribute("aria-label") || link.textContent?.trim() || "page",
      at: Date.now(),
    };
    try {
      sessionStorage.setItem(ROUTE_KEY, JSON.stringify(pending));
    } catch {
      /* storage unavailable — navigate plainly */
      window.location.href = pending.url;
      return;
    }

    if (prefersReducedMotion()) {
      window.location.href = pending.url;
      return;
    }

    // Expand a veil from the clicked element to fullscreen, then go. The
    // veil is a plain black box, so it grows by transform alone (scale from
    // the link's box to the screen): compositor-only, no clip-path repaint.
    const veil = document.createElement("div");
    veil.setAttribute("aria-hidden", "true");
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    veil.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:9999",
      "background:#0a0a0a",
      "pointer-events:none",
      "transform-origin:0 0",
      `transform:translate(${rect.left}px, ${rect.top}px) scale(${Math.max(rect.width, 1) / vw}, ${Math.max(rect.height, 1) / vh})`,
    ].join(";");
    document.body.appendChild(veil);
    void veil.offsetWidth;
    const dur = Math.min(DURATION.standard, 340);
    veil.style.transition = `transform ${dur}ms ${EASING.zoomOut}`;
    veil.style.transform = "none";
    window.setTimeout(() => {
      window.location.href = pending.url;
    }, dur * 0.82);
  });
}

/**
 * Call on page load. If the previous page stored a pending route
 * transition, play the enter settle on <main> (or the given selector).
 */
export function handleRouteEnter(contentSelector = "main"): void {
  let pending: PendingRoute | null = null;
  try {
    const raw = sessionStorage.getItem(ROUTE_KEY);
    if (raw) pending = JSON.parse(raw) as PendingRoute;
    sessionStorage.removeItem(ROUTE_KEY);
  } catch {
    return;
  }
  if (!pending) return;
  // Stale (older than 10s) — ignore.
  if (Date.now() - pending.at > 10000) return;

  const main = document.querySelector<HTMLElement>(contentSelector);
  if (!main || prefersReducedMotion()) return;

  // The new view settles in from a slight zoom — the tail of the
  // "zoom into the selected thing" motion from the previous page. Transform
  // only: the page is never hidden (it used to start at opacity 0, which
  // held back the first paint of the arriving page, and its LCP).
  const startScale = 1.035;
  main.style.transform = `scale(${startScale})`;
  main.style.transformOrigin = "50% 18%";
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      main.style.transition = `transform ${DURATION.standard}ms ${EASING.standard}`;
      main.style.transform = "scale(1)";
      const cleanup = () => {
        main.style.transition = "";
        main.style.transform = "";
        main.style.transformOrigin = "";
      };
      main.addEventListener("transitionend", cleanup, { once: true });
      window.setTimeout(cleanup, DURATION.standard + 120);
    });
  });
}

function playReceiveAnimation(target: HTMLElement): void {
  if (prefersReducedMotion()) return;
  const header =
    target.querySelector<HTMLElement>(".section-header, header, h1, h2");
  const el = (header ?? target) as HTMLElement;
  el.style.transition = "none";
  el.style.opacity = "0.55";
  el.style.transform = "translateY(10px) scale(0.995)";
  // Wait for smooth scroll to mostly complete before landing.
  window.setTimeout(() => {
    el.style.transition = `opacity ${DURATION.quick}ms ${EASING.snap}, transform ${DURATION.quick}ms ${EASING.snap}`;
    el.style.opacity = "1";
    el.style.transform = "none";
    window.setTimeout(() => {
      el.style.transition = "";
      el.style.opacity = "";
      el.style.transform = "";
    }, DURATION.quick + 60);
  }, 450);
}

/**
 * Anchor navigation with spatial awareness.
 *
 * Smooth-scrolls to the target section with sticky navigation offset,
 * handles section permalink copying, and plays a short "receive"
 * animation on the section header so arrival feels connected.
 */
export function initAnchorTransitions(
  selector = 'a[href*="#"]'
): void {
  // Handle initial page load with hash
  if (typeof window !== "undefined" && window.location.hash) {
    const handleInitialHash = () => {
      const hash = window.location.hash;
      const target = document.querySelector<HTMLElement>(hash);
      if (target) {
        window.setTimeout(() => {
          const navOffset = 76;
          const targetTop = target.getBoundingClientRect().top + window.scrollY - navOffset;
          window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
          playReceiveAnimation(target);
        }, 150);
      }
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", handleInitialHash);
    } else {
      handleInitialHash();
    }
  }

  document.addEventListener("click", (e) => {
    const link = (e.target as Element).closest?.(selector) as HTMLAnchorElement | null;
    if (!link) return;
    const href = link.getAttribute("href") || "";
    if (!href.includes("#")) return;

    // Check if the link points to the current page or is a pure hash
    const [pathPart, hashPart] = href.split("#");
    const hash = hashPart ? `#${hashPart}` : "";
    if (!hash || hash === "#") return;

    const currentPath = window.location.pathname.replace(/\/$/, "");
    const cleanPath = pathPart.replace(/\/$/, "");
    const isSamePage =
      !pathPart ||
      href.startsWith("#") ||
      (currentPath === "" && cleanPath === "") ||
      cleanPath === currentPath ||
      (cleanPath === "/" && currentPath === "");

    if (!isSamePage) return; // Allow normal browser navigation to different pages

    const target = document.querySelector<HTMLElement>(hash);
    if (!target) return;

    e.preventDefault();
    const reduced = prefersReducedMotion();

    // If clicking a section anchor permalink, copy URL to clipboard
    const isAnchorBtn = link.classList.contains("section-anchor") || Boolean(link.closest(".section-anchor"));
    if (isAnchorBtn) {
      const fullUrl = `${window.location.origin}${window.location.pathname}${hash}`;
      try {
        navigator.clipboard?.writeText(fullUrl).then(() => {
          link.classList.add("is-copied");
          window.setTimeout(() => link.classList.remove("is-copied"), 1800);
        });
      } catch {
        // clipboard access restricted
      }
    }

    // Update URL hash without jump
    history.pushState(null, "", hash);

    // Smooth scroll with sticky navbar offset (76px)
    const isTop = hash === "#top" || hash === "#overview" || target.id === "overview" || target.id === "top";
    const navOffset = 76;
    const targetTop = isTop ? 0 : Math.max(0, target.getBoundingClientRect().top + window.scrollY - navOffset);
    window.scrollTo({
      top: targetTop,
      behavior: reduced ? "auto" : "smooth",
    });

    if (reduced) return;

    playReceiveAnimation(target);

    // Move keyboard focus for a11y (without scrolling again)
    if (target instanceof HTMLElement && !target.hasAttribute("tabindex")) {
      target.setAttribute("tabindex", "-1");
    }
    window.setTimeout(() => {
      (target as HTMLElement).focus?.({ preventScroll: true });
    }, 550);
  });
}

/**
 * Restrained scroll reveals. One IntersectionObserver adds `.is-in` to
 * `.sec-head` and `.reveal` elements as they enter the viewport.
 *
 * The `js` class gates the hidden pre-state: if this script never runs,
 * everything stays visible (no-JS safe). Stagger comes from `--rd`
 * (reveal delay), set inline per element where a sequence matters.
 * Reduced-motion users get content with no animation.
 */
const REVEAL_SELECTOR = '.sec-head, .reveal, .section-header';

function markRevealed(el: Element): void {
  el.classList.add('is-in', 'is-revealed');
}

/**
 * Force every reveal inside (and including) `scope` visible right now.
 * Used for in-page jumps and tab switches: content the reader was sent to
 * must never wait for a scroll event to become readable (audit defect 7).
 */
export function forceReveal(scope: Element | null): void {
  if (!scope) return;
  if (scope.matches(REVEAL_SELECTOR)) markRevealed(scope);
  scope.querySelectorAll(REVEAL_SELECTOR).forEach(markRevealed);
  // Also reveal the section headers of the enclosing section.
  scope.closest('section')?.querySelectorAll(REVEAL_SELECTOR).forEach(markRevealed);
}

/** Reveal anything currently inside the viewport. The safety net under the
 *  IntersectionObserver: runs after every scroll settles. */
function sweepVisible(): void {
  const vh = window.innerHeight;
  document.querySelectorAll(`${REVEAL_SELECTOR}`).forEach((el) => {
    if (el.classList.contains('is-in')) return;
    const r = el.getBoundingClientRect();
    if (r.bottom > 0 && r.top < vh && (r.width > 0 || r.height > 0)) markRevealed(el);
  });
}

export function initReveals(): void {
  const root = document.documentElement;
  root.classList.add('js');
  const els = document.querySelectorAll(REVEAL_SELECTOR);
  if (prefersReducedMotion() || !('IntersectionObserver' in window) || els.length === 0) {
    // No animation, no hiding: content simply appears.
    els.forEach(markRevealed);
    return;
  }
  // threshold 0: any visible pixel reveals. A proportional threshold never
  // fired for elements taller than the viewport (the gear manifest).
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          markRevealed(entry.target);
          io.unobserve(entry.target);
        }
      }
    },
    { threshold: 0, rootMargin: '0px 0px -8% 0px' }
  );
  els.forEach((el) => io.observe(el));

  // In-page jumps: reveal the destination before the scroll lands.
  const revealHash = () => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) forceReveal(document.getElementById(id));
  };
  window.addEventListener('hashchange', revealHash);
  revealHash();
  document.addEventListener('click', (e) => {
    const a = (e.target as Element | null)?.closest?.('a[href*="#"]');
    const hash = a?.getAttribute('href')?.split('#')[1];
    if (hash) forceReveal(document.getElementById(decodeURIComponent(hash)));
  });
  // Components (e.g. gear tabs) ask for a reveal after changing content.
  document.addEventListener('reveal:force', (e) => {
    forceReveal(((e as CustomEvent).detail as Element | null) ?? null);
  });

  // Fallback sweep once scrolling settles.
  let t = 0;
  const settle = () => {
    window.clearTimeout(t);
    t = window.setTimeout(sweepVisible, 120);
  };
  window.addEventListener('scroll', settle, { passive: true });
  window.addEventListener('resize', settle, { passive: true });
  if ('onscrollend' in window) window.addEventListener('scrollend', sweepVisible);
  window.addEventListener('load', sweepVisible, { once: true });
}
