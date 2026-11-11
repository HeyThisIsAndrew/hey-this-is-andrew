/** Dispose page-owned listeners and observers before Astro replaces their DOM. */
export function createPageScope(owner: HTMLElement) {
  const lifecycle = new AbortController();
  const stop = () => lifecycle.abort();
  document.addEventListener('astro:before-swap', stop, { once: true });
  const cleanup = (dispose: () => void) => lifecycle.signal.addEventListener('abort', dispose, { once: true });
  cleanup(() => document.removeEventListener('astro:before-swap', stop));
  const timers = new Set<number>();
  const timeout = (handler: () => void, delay = 0): number => {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      if (!lifecycle.signal.aborted) handler();
    }, delay);
    timers.add(timer);
    return timer;
  };
  cleanup(() => timers.forEach((timer) => window.clearTimeout(timer)));
  type Events = WindowEventMap & DocumentEventMap & { 'reveal:force': CustomEvent<Element | null>; 'andrew:view-pop': CustomEvent<{ owner: string }> };
  function on<K extends keyof Events>(target: EventTarget, type: K, listener: (event: Events[K]) => void, options: AddEventListenerOptions | boolean = {}) {
    target.addEventListener(type, listener as EventListener, {
      ...(typeof options === 'boolean' ? { capture: options } : options), signal: lifecycle.signal,
    });
  }
  return { on, cleanup, timeout, signal: lifecycle.signal, owner };
}
