/** Direction rules shared by every site. All helpers stay local for the inline bootstrap. */
export function pageDirection(fromUrl, toUrl, options = {}) {
  const clean = (path) => path.replace(/\/+$/, '') || '/';
  const fromPath = clean(fromUrl.pathname);
  const toPath = clean(toUrl.pathname);
  if (fromPath === toPath) return 'none';
  if (options.navigationType === 'traverse') {
    if (fromUrl.hash && !toUrl.hash) return 'dive-up';
    if (!fromUrl.hash && toUrl.hash) return 'dive-down';
    return options.direction === 'back' ? 'slide-backward' : 'slide-forward';
  }
  if (fromPath.replace(/\/\d+$/, '') === toPath.replace(/\/\d+$/, '')) return 'page-rows';
  if (toUrl.hash) return 'dive-down';
  if (fromUrl.hash) return 'dive-up';
  if ((options.filterRoots || []).some((root) => {
    const within = (path) => path === root || path.startsWith(`${root}/topic/`);
    return within(fromPath) && within(toPath);
  })) return 'none';
  const routes = (options.routes || []).map(clean);
  const index = (path) => {
    const exact = routes.indexOf(path);
    if (exact !== -1) return exact;
    const parent = routes.map((route, i) => ({ route, i }))
      .filter(({ route, i }) => i > 0 && path.startsWith(`${route}/`))
      .sort((a, b) => b.route.length - a.route.length)[0];
    return parent?.i ?? routes.length;
  };
  const from = index(fromPath);
  const to = index(toPath);
  if (from === to) return fromPath.startsWith(`${toPath}/`) ? 'slide-backward' : 'slide-forward';
  return from < to ? 'slide-forward' : 'slide-backward';
}

/** Installed once by each site that opts into shared page transitions. */
export function installPageTransitions(options, chooseDirection) {
  if (window.__andrewPageTransitions) return;
  window.__andrewPageTransitions = true;
  // Installed inline before Astro's router: a view's Back entry stays local.
  window.addEventListener('popstate', (event) => {
    const owner = document.documentElement.dataset.historyView;
    if (!owner) return;
    event.stopImmediatePropagation();
    window.dispatchEvent(new CustomEvent('andrew:view-pop', { detail: { owner } }));
  }, { capture: true });
  let rowsPending = false;
  let generation = 0;
  document.addEventListener('astro:before-preparation', (event) => {
    generation++;
    const current = generation;
    document.querySelectorAll('dialog[open]').forEach((dialog) => dialog.close());
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenu && !mobileMenu.hidden) {
      mobileMenu.classList.remove('open');
      mobileMenu.hidden = true;
      const menuBtn = document.querySelector('.menu-btn');
      if (menuBtn) {
        menuBtn.setAttribute('aria-expanded', 'false');
        const label = menuBtn.querySelector('.menu-btn-label');
        if (label) label.textContent = menuBtn.getAttribute('data-menu-label') || 'Menu';
      }
    }
    if (event.from?.href !== event.to?.href) {
      document.documentElement.dataset.navPending = 'true';
      setTimeout(() => {
        if (current === generation) delete document.documentElement.dataset.navPending;
      }, 8000);
    }
    document.documentElement.dataset.pageTransition = chooseDirection(event.from, event.to, {
      ...options, navigationType: event.navigationType, direction: event.direction,
    });
  });
  document.addEventListener('astro:before-swap', (event) => {
    delete event.newDocument.documentElement.dataset.navPending;
    const direction = document.documentElement.dataset.pageTransition;
    if (direction) event.newDocument.documentElement.dataset.pageTransition = direction;
    rowsPending = direction === 'page-rows';
    // The Accordion's collapsed styles hang off html.acc-js. Its own script
    // restores the class on swaps, but only once a page with an accordion
    // has loaded it; arriving from a page without one (the homepage), the
    // rows painted open for a frame. The router is on every page.
    if (event.newDocument.querySelector('[data-accordion-group]')) {
      event.newDocument.documentElement.classList.add('acc-js');
    }
    if (window.matchMedia('(pointer: coarse)').matches) {
      event.newDocument.querySelectorAll('.reveal, .sec-head, .section-header').forEach((el) => {
        el.classList.add('is-in', 'is-revealed');
      });
    }
  });
  document.addEventListener('astro:after-swap', () => {
    delete document.documentElement.dataset.navPending;
    if (!rowsPending) return;
    rowsPending = false;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const target = document.querySelector('[data-rows-target]');
      if (target) target.scrollIntoView({ block: 'start', behavior: 'instant' });
      else window.scrollTo({ top: 0, behavior: 'instant' });
    }));
  });
  document.addEventListener('astro:page-load', () => {
    delete document.documentElement.dataset.navPending;
    const current = generation;
    setTimeout(() => {
      if (current === generation) delete document.documentElement.dataset.pageTransition;
    }, 500);
  });
}
