/*
  PHANTOM OVERLAYS — a closed overlay must not be able to receive a tap.

  THE BUG CLASS THIS EXISTS FOR
  `visibility: hidden` is not enough on iOS Safari. A viewport-covering
  `position: fixed` element becomes a composited layer, and Safari keeps
  routing touches to that layer while it is invisible. Because these overlays
  sit at z-index 300 — above the navbar at 100 — an invisible one covers the
  entire page and silently eats every tap.

  It has now bitten this site twice:

    1. `.nav-container` (the mobile menu) — reported as a phone stuck in
       landscape: close button, nav, categories and the article gallery all
       dead. Fixed with `pointer-events: none` when closed.
    2. `#video-modal`, which Layout.astro mounts on EVERY route, and
       `#qr-modal` on /links — reported as "the entire nav bar is difficult to
       tap" on iPad Pro. Same cause, and invisible to Chromium, which
       hit-tests these correctly.

  Chromium cannot reproduce the underlying Safari behaviour, so testing the
  symptom is not an option. This asserts the INVARIANT instead: no hidden,
  fixed, viewport-covering element may have `pointer-events` other than
  `none`. That is checkable in any engine and it is what makes the Safari bug
  impossible rather than merely absent.

  Add a new full-screen overlay and this test tells you to guard it.
*/
import { launchTestBrowser } from './e2e-browser.mjs';
import { startPreviewServer } from './e2e-server.mjs';
import assert from 'node:assert/strict';

const ROUTES = [
  '/',
  '/about',
  '/feed',
  '/events',
  '/events/sdcc-2026',
  '/featured',
  '/featured/marvel-comics',
  '/intel',
  '/intel/mortal-kombat-2-review',
  '/collaborations',
  '/links',
  '/privacy',
];

async function runTests() {
  console.log('Starting Astro preview server for Phantom Overlay E2E...');
  const { stop } = await startPreviewServer();

  console.log('Server is running. Launching Puppeteer...');
  const browser = await launchTestBrowser();
  let exitCode = 0;

  try {
    /*
      VIEWPORT COVERAGE IS THE WHOLE TEST.

      This ran only at 1024x1366 tablet portrait, and that is where it was
      blind. `.nav-container` — the overlay this test exists for — is only
      fixed and full-screen inside
      `@media (max-width: 768px), (orientation: landscape) and (max-height: 500px)`.
      At 1024 wide in portrait neither clause matches, so the menu is a
      `position: static` 498x53 strip and the sweep finds nothing to check.

      Measured: with `.nav-container` deliberately set back to
      `pointer-events: auto`, this file still reported "no phantom overlays
      across 12 routes" — while the same page at 390x844 and 956x440 had a
      hidden, viewport-covering, tap-swallowing overlay on every route. A test
      that cannot see the bug it was written for is worse than none.

      Phone portrait AND phone landscape are both required: landscape is where
      it was originally reported, and it is a different media clause.
    */
    const offenders = new Map();

    const VIEWPORTS = [
      { width: 390, height: 844, label: 'phone portrait' },
      { width: 956, height: 440, label: 'phone landscape' },
      { width: 844, height: 390, label: 'small phone landscape' },
      { width: 1024, height: 1366, label: 'tablet portrait' },
    ];

    for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height, hasTouch: true, isMobile: false });

    for (const route of ROUTES) {
      await page.goto(`http://localhost:4321${route}`, { waitUntil: 'networkidle2' });

      const hits = await page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll('body *')) {
          const cs = getComputedStyle(el);
          if (cs.position !== 'fixed') continue;

          const r = el.getBoundingClientRect();
          // Only elements big enough to blanket the page can cause this.
          if (r.width < innerWidth * 0.8 || r.height < innerHeight * 0.5) continue;

          const hidden =
            cs.visibility === 'hidden' || cs.opacity === '0' || cs.display === 'none';
          if (!hidden) continue;

          // The guard itself.
          if (cs.pointerEvents === 'none') continue;

          out.push(
            `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}` +
              `.${(el.className || '').toString().trim().split(/\s+/)[0] || ''} (z-index ${cs.zIndex})`
          );
        }
        return out;
      });

      for (const hit of hits) {
        const key = `${hit} @ ${vp.label}`;
        if (!offenders.has(key)) offenders.set(key, []);
        offenders.get(key).push(route);
      }
    }
    await page.close();
    }

    if (offenders.size) {
      const detail = [...offenders.entries()]
        .map(([el, routes]) => `\n    ${el} on ${routes.length} route(s): ${routes.join(', ')}`)
        .join('');
      assert.fail(
        `Hidden, viewport-covering fixed overlays still accept pointer events. ` +
          `On iOS Safari these swallow every tap on the page beneath them. ` +
          `Add \`pointer-events: none\` to the closed state and \`pointer-events: auto\` ` +
          `to the open state:${detail}`
      );
    }

    console.log(
      `  ✓ no phantom overlays across ${ROUTES.length} routes x ${VIEWPORTS.length} viewports`
    );
    console.log('\n✅ Phantom Overlay E2E tests passed.');
  } catch (error) {
    console.error('\n❌ Phantom Overlay E2E failed:', error.message);
    exitCode = 1;
  } finally {
    await browser.close();
    stop();
    process.exit(exitCode);
  }
}

runTests();
