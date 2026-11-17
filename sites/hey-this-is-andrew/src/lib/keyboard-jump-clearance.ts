import { createPageScope } from '@andrew/ui/scripts/page-scope.ts';

/** Native paging ignores scroll-margin. Correct only a heading caught behind the fixed chrome. */
export function initKeyboardJumpClearance(root: HTMLElement) {
  const { on, timeout } = createPageScope(root);
  let pending = false;
  let version = 0;
  let lastKeyTime = 0;

  const clearOverlap = () => {
    if (!pending) return;
    pending = false;
    if (document.documentElement.matches('.menu-open, .modal-open, .photo-zoom-open')) return;
    const header = document.querySelector<HTMLElement>('#site-header');
    if (!header) return;
    let edge = header.getBoundingClientRect().bottom;
    const dock = document.querySelector<HTMLElement>('.ccc-dock-row--hero, .hq-dock-row--hero');
    if (dock) {
      const box = dock.getBoundingClientRect();
      if (box.top <= edge + 2 && box.bottom > edge) edge = box.bottom;
    }
    const heading = Array.from(root.querySelectorAll<HTMLElement>('h1, h2, h3')).find((el) => {
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const visible = !el.checkVisibility || el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
      return visible && !el.classList.contains('vh') && style.visibility !== 'hidden' && style.display !== 'none' && box.top < edge && box.bottom > 0 && box.height > 1;
    });
    if (!heading) return;
    window.scrollTo({ top: Math.max(0, window.scrollY + heading.getBoundingClientRect().top - edge - 24), behavior: 'instant' });
  };

  on(window, 'keydown', (event) => {
    if (event.defaultPrevented || !['PageDown', 'End'].includes(event.key)) return;
    if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    pending = true;
    lastKeyTime = performance.now();
    const current = ++version;
    timeout(() => { if (current === version) clearOverlap(); }, 450);
  });
  on(window, 'scrollend', () => {
    // Ignore a preceding anchor/instant scroll that finishes in the key event's frame.
    if (performance.now() - lastKeyTime >= 100) clearOverlap();
  });
  // A wheel or touch takes control away from the keyboard; ordinary scrolling stays native.
  on(window, 'wheel', () => { pending = false; }, { passive: true });
  on(window, 'touchstart', () => { pending = false; }, { passive: true });
}
