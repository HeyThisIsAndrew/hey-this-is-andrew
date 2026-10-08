/*
  Load Turnstile when someone actually touches a form, not on every page view.

  ─── WHY ──────────────────────────────────────────────────────────────────
  The API was requested from <head> on every page. Measured from the
  Lighthouse gate's own diagnostics on /events:

      104kB  343ms  challenges.cloudflare.com/.../turnstile/f/av0/rch/...
      104kB  187ms  challenges.cloudflare.com/.../turnstile/f/av0/rch/...
       26kB  119ms  challenges.cloudflare.com/turnstile/v0/api.js

  ~234 KB of third-party script on every visit, for a widget that only
  matters to the small fraction of readers who submit the contact or
  subscribe form. On a throttled connection it took bandwidth directly from
  the LCP image. (Note for anyone who tries the "always passes" test key to
  avoid this: it does NOT avoid the download — the challenge platform is
  fetched with the test key sitting in the request URL.)

  ─── WHY EXPLICIT RENDERING ───────────────────────────────────────────────
  Turnstile's implicit renderer scans the DOM exactly once, when its script
  loads. That was already a known bug here: with Astro's ClientRouter a
  client-side navigation replaces the forms with fresh, unrendered elements
  and the widgets never come back until a full reload.

  Deferring the load makes that worse — after the first load the script is
  cached and no scan ever runs again — so this renders every widget
  explicitly instead, which fixes the navigation bug rather than inheriting
  it. `?render=explicit` disables the implicit scan globally, which is what
  we want now that nothing depends on it.

  The existing widgets keep their markup and their `data-callback` contract:
  this reads the same `data-*` attributes the implicit renderer would have
  and dispatches to the same window globals the components already define.
  That is deliberate: it kept the form components untouched when this moved
  to explicit rendering, and it is why NewsletterForm still carries plain
  `data-*` attributes rather than renderer-specific wiring.
*/

/**
 * `render=explicit` needs a global onload callback name, and the global has
 * to exist before the script runs. We inject the tag ourselves, so we set it
 * first and the ordering is guaranteed.
 */
const READY_CALLBACK = '__beuhqTurnstileReady';
const API_SRC = `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=${READY_CALLBACK}`;

/** Containers the components render as implicit-style widgets. */
const WIDGET_SELECTOR = '.cf-turnstile';

/** Anything on a form that means "this form needs a bot check". */
const NEEDS_TURNSTILE = '.cf-turnstile, #newsletter-turnstile';

let loadPromise: Promise<any> | null = null;

/** Resolves with `window.turnstile`, injecting the script on first call. */
export function requestTurnstile(): Promise<any> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Turnstile requested outside the browser'));
  }

  const w = window as any;
  if (w.turnstile) return Promise.resolve(w.turnstile);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    w[READY_CALLBACK] = () => resolve(w.turnstile);

    const script = document.createElement('script');
    script.src = API_SRC;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      /*
        Null the cache so a later interaction can retry — a transient failure
        should not permanently disable the form. The rejection is what lets
        NewsletterForm say "your ad blocker" honestly instead of guessing.
      */
      loadPromise = null;
      reject(new Error('Turnstile script failed to load'));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

/** Run `onReady` once Turnstile is loaded, whenever that turns out to be. */
export function whenTurnstileReady(
  onReady: (turnstile: any) => void,
  onFailure?: (error: unknown) => void,
): void {
  readyWaiters.push({ onReady, onFailure });
  if ((window as any).turnstile) flushWaiters((window as any).turnstile);
}

const readyWaiters: Array<{ onReady: (t: any) => void; onFailure?: (e: unknown) => void }> = [];

function flushWaiters(turnstile: any) {
  while (readyWaiters.length) readyWaiters.shift()!.onReady(turnstile);
}

function failWaiters(error: unknown) {
  while (readyWaiters.length) readyWaiters.shift()!.onFailure?.(error);
}

/**
 * Render any widget container that does not have a widget yet.
 *
 * Idempotent by way of a `data-ts-rendered` marker: re-running after a
 * client-side navigation picks up only the fresh elements, and re-running on
 * the same page does nothing.
 */
export function renderPendingWidgets(turnstile: any): number {
  let rendered = 0;

  document.querySelectorAll<HTMLElement>(WIDGET_SELECTOR).forEach((el) => {
    if (el.dataset.tsRendered === '1') return;

    const sitekey = el.getAttribute('data-sitekey');
    if (!sitekey) return; // Unconfigured environment — nothing to mount.

    // The components define these as window globals, which is exactly what
    // the implicit renderer would have looked up.
    const globalFn = (name: string | null) => {
      if (!name) return undefined;
      const fn = (window as any)[name];
      return typeof fn === 'function' ? fn : undefined;
    };

    try {
      turnstile.render(el, {
        sitekey,
        size: el.getAttribute('data-size') || undefined,
        theme: el.getAttribute('data-theme') || undefined,
        callback: globalFn(el.getAttribute('data-callback')),
        'error-callback': globalFn(el.getAttribute('data-error-callback')),
        'expired-callback': globalFn(el.getAttribute('data-expired-callback')),
      });
      el.dataset.tsRendered = '1';
      rendered += 1;
    } catch {
      // A double-render or a torn-down container. Leave it unmarked so a
      // later pass can retry rather than silently giving up on the widget.
    }
  });

  return rendered;
}

/** True when the event happened inside a form that needs a bot check. */
function isTurnstileForm(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== 'function') return false;

  const scope = el.closest('form') ?? el.closest('dialog');
  return !!scope?.querySelector(NEEDS_TURNSTILE);
}

/**
 * Wire the first-interaction trigger.
 *
 * `focusin` and `pointerdown` together cover keyboard tabbing, clicking, and
 * touch, and both fire well before anyone can finish typing an email — the
 * widget has a head start measured in whole seconds. `capture` matters for
 * `focusin` inside a <dialog>.
 *
 * Also re-renders on `astro:page-load`: after a client-side navigation the
 * script is already loaded, so nothing else would ever mount the new page's
 * widgets.
 */
export function initTurnstileLazyLoading(): void {
  if (typeof document === 'undefined') return;

  const w = window as any;
  if (w.__beuhqTurnstileLazyInit) return;
  w.__beuhqTurnstileLazyInit = true;

  const start = () => {
    requestTurnstile()
      .then((turnstile) => {
        renderPendingWidgets(turnstile);
        flushWaiters(turnstile);
      })
      .catch((error) => failWaiters(error));
  };

  const onInteraction = (event: Event) => {
    if (!isTurnstileForm(event.target)) return;
    document.removeEventListener('focusin', onInteraction, true);
    document.removeEventListener('pointerdown', onInteraction, true);
    start();
  };

  document.addEventListener('focusin', onInteraction, true);
  document.addEventListener('pointerdown', onInteraction, true);

  document.addEventListener('astro:page-load', () => {
    if (w.turnstile) renderPendingWidgets(w.turnstile);
  });
}
