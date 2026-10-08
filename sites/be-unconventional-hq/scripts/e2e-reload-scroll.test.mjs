/*
  REFRESH MUST LAND AT THE TOP, WITHOUT A JOURNEY.

  THE REGRESSION THIS EXISTS FOR — reported four times, on every device class
  Scroll down the homepage (or press ENTER THE HQ, which leaves the page
  scrolled to the content), then hit browser refresh. The page lurches DOWN to
  where the reader used to be and then back UP to the top. In landscape it is
  worse than portrait, because the hero parallax is only disabled on portrait
  touch — so the same excursion also drags the background by its full 150px cap.

  WHY ONE-SHOT RESETS CANNOT FIX IT
  `history.scrollRestoration = 'manual'` is supposed to stop the engine
  restoring the offset at all. iOS Safari restores anyway, once, at a moment
  that moves with load timing. Hero.astro answered that with three resets —
  immediate, next frame, and on pageshow — and a restore that lands between
  any two of them wins. Measured before the fix, walking the restore across the
  startup window: EVERY timing painted 8-16 frames at the restored offset, and
  one timing was never corrected at all.

  WHAT THIS ASSERTS
  Not "it ends up at the top" — that was already true and the bug was still
  visible. It asserts the page NEVER PAINTS a frame away from the top, at every
  restore timing, which is the only version of the property the reader can see.

  It also asserts the opposite failure: the guard that holds the top must let
  go the instant the reader touches the screen. A page that fights a real
  scroll is a worse bug than the one being fixed.
*/
import { launchTestBrowser } from './e2e-browser.mjs';
import { startPreviewServer } from './e2e-server.mjs';
import assert from 'node:assert/strict';

/* Where the reader was before refreshing. Deep enough that a restore is
   unmissable and the hero parallax would be at its cap. */
const RESTORE_TO = 390;

/* The restore lands somewhere in the startup window and the exact moment moves
   with load timing, so walk it rather than picking one and hoping. */
const DELAYS = [0, 30, 60, 120, 200, 350, 600];

const VIEWPORTS = [
  { width: 844, height: 390, label: 'iPhone landscape' },
  { width: 390, height: 844, label: 'iPhone portrait' },
  { width: 1366, height: 1024, label: 'iPad Pro landscape' },
];

/* Emulates iOS Safari restoring the previous offset around first paint:
   INSTANT, not a smooth scroll, and once. Also records the worst scroll
   position and hero transform that any frame actually showed. */
const instrument = (restoreTo, delay) => `
  window.__peakScroll = 0;
  window.__framesOffTop = 0;
  window.__peakHeroShift = 0;
  (function () {
    var t0 = performance.now();
    function tick() {
      var y = Math.round(window.scrollY);
      if (Math.abs(y) > Math.abs(window.__peakScroll)) window.__peakScroll = y;
      if (y !== 0) window.__framesOffTop++;
      var bg = document.querySelector('.hero-bg');
      if (bg) {
        var t = getComputedStyle(bg).transform;
        if (t && t !== 'none') {
          var m = new DOMMatrixReadOnly(t);
          if (Math.abs(m.m42) > Math.abs(window.__peakHeroShift)) {
            window.__peakHeroShift = Math.round(m.m42);
          }
        }
      }
      if (performance.now() - t0 < 1400) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })();
  addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      var r = document.documentElement;
      var p = r.style.scrollBehavior;
      r.style.scrollBehavior = 'auto';
      void r.offsetHeight;
      window.scrollTo(0, ${restoreTo});
      r.style.scrollBehavior = p;
    }, ${delay});
  });
`;

async function runTests() {
  console.log('Starting Astro preview server for Reload Scroll E2E...');
  const { stop } = await startPreviewServer();

  console.log('Server is running. Launching Puppeteer...');
  const browser = await launchTestBrowser();
  let exitCode = 0;
  let passed = 0;

  try {
    for (const vp of VIEWPORTS) {
      for (const delay of DELAYS) {
        const page = await browser.newPage();
        await page.setViewport({
          width: vp.width,
          height: vp.height,
          hasTouch: true,
          isMobile: true,
        });
        await page.goto('http://localhost:4321/', { waitUntil: 'networkidle2' });

        await page.evaluateOnNewDocument(instrument(RESTORE_TO, delay));
        await page.reload({ waitUntil: 'networkidle2' });
        await new Promise((r) => setTimeout(r, 1600));

        const seen = await page.evaluate(() => ({
          peak: window.__peakScroll,
          frames: window.__framesOffTop,
          hero: window.__peakHeroShift,
          final: Math.round(window.scrollY),
        }));
        await page.close();

        const where = `${vp.label}, restore at +${delay}ms`;

        assert.equal(
          seen.frames,
          0,
          `${where}: the page painted ${seen.frames} frame(s) away from the top ` +
            `(worst offset ${seen.peak}px, worst hero parallax ${seen.hero}px). ` +
            `That excursion IS the reported jarring up/down on refresh. The reset ` +
            `must hold the top for the whole window in which the browser may ` +
            `restore, not fire a fixed number of times — see the guard in ` +
            `Hero.astro's inline script.`
        );
        assert.equal(seen.final, 0, `${where}: settled at ${seen.final}px instead of the top`);

        console.log(`  ✓ ${where}: never left the top`);
        passed++;
      }
    }

    /*
      The other direction. Holding the top is only acceptable because the very
      first real input gives it up — otherwise a reader who flicks the moment
      the page appears would be fighting the page.
    */
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
      await page.goto('http://localhost:4321/', { waitUntil: 'networkidle2' });
      await page.reload({ waitUntil: 'networkidle2' });

      const stuck = await page.evaluate(async () => {
        const root = document.documentElement;
        // A real gesture, then a real scroll, immediately after reload.
        window.dispatchEvent(new Event('touchstart'));
        root.classList.remove('splash-armed', 'splash-lifting', 'splash-dropping');
        await new Promise((r) => requestAnimationFrame(r));

        const p = root.style.scrollBehavior;
        root.style.scrollBehavior = 'auto';
        void root.offsetHeight;
        window.scrollTo(0, 500);
        root.style.scrollBehavior = p;

        await new Promise((r) => setTimeout(r, 400));
        return Math.round(window.scrollY);
      });
      await page.close();

      assert.ok(
        stuck > 400,
        `after a real gesture the reader scrolled to 500 and the page pulled them ` +
          `back to ${stuck}. The top-guard must release on the first input — a page ` +
          `that fights a deliberate scroll is worse than the bug it is guarding.`
      );
      console.log('  ✓ the top-guard releases on the first real gesture');
      passed++;
    }

    console.log(`\n✅ Reload Scroll E2E tests passed (${passed} checks).`);
  } catch (error) {
    console.error('\n❌ Reload Scroll E2E failed:', error.message);
    exitCode = 1;
  } finally {
    await browser.close();
    stop();
    process.exit(exitCode);
  }
}

runTests();
