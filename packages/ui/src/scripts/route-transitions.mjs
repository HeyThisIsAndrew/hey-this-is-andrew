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
    document.querySelectorAll('dialog[open]').forEach((dialog) => dialog.close());
    document.documentElement.dataset.pageTransition = chooseDirection(event.from, event.to, {
      ...options, navigationType: event.navigationType, direction: event.direction,
    });
  });
  document.addEventListener('astro:before-swap', (event) => {
    const direction = document.documentElement.dataset.pageTransition;
    if (direction) event.newDocument.documentElement.dataset.pageTransition = direction;
    rowsPending = direction === 'page-rows';
  });
  document.addEventListener('astro:after-swap', () => {
    if (!rowsPending) return;
    rowsPending = false;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const target = document.querySelector('[data-rows-target]');
      if (target) target.scrollIntoView({ block: 'start', behavior: 'instant' });
      else window.scrollTo({ top: 0, behavior: 'instant' });
    }));
  });
  document.addEventListener('astro:page-load', () => {
    const current = generation;
    setTimeout(() => {
      if (current === generation) delete document.documentElement.dataset.pageTransition;
    }, 500);
  });
}
