/*
  THE HERO MUST BE THE HEIGHT THE READER ACTUALLY HAS.

  THE REPORT
  "Load the homepage and then rotate your phone" — the hero comes back the
  wrong height in landscape: its centred content sits out of position and the
  next section's header shows underneath.

  WHY NO VIEWPORT UNIT FIXES THIS
  Every static unit is a guess about the browser chrome, and each is wrong in
  one of its two states. Both were tried on the device and both were
  photographed failing:

    100svh — smallest, chrome expanded. Arrive with the chrome RETRACTED
             (after scrolling on the previous page, or after a rotation) and
             the hero is shorter than the screen; "EXPLORE THE HQ / WHAT WE
             COVER" shows under it.
    100lvh — largest, chrome retracted. Arrive with the chrome EXPANDED and
             the hero is taller than the screen; the flex-centred content is
             pushed down out of position.
    100dvh — always correct, but re-resolves during scroll, resizing the hero
             and re-rasterizing the blurred .hero-bg. That is the jitter
             hero.css rejects at length.

  So the hero is MEASURED. `--vv-height` is the real `visualViewport.height`:
  seeded inline in Layout.astro before first paint, republished by
  src/lib/viewport-anchor.ts once a rotation settles, and never touched on
  scroll — constant per orientation like svh/lvh, but the right constant.

  WHAT THIS TESTS, AND ITS ONE LIMIT
  Chromium's visualViewport.height always equals innerHeight because it has no
  retracting chrome, so the svh-vs-lvh divergence itself is not reproducible
  here — that is exactly why the unit was got wrong twice. What IS checkable,
  and is the whole contract, is: the value is published before the hero could
  paint, the hero exactly fills the viewport, a rotation republishes it and
  the hero exactly fills the NEW viewport, and a burst of chrome-collapse
  events resizes the hero zero times.
*/
/*
  ─── THE HOMEPAGE HERO CHANGED (feat/homepage-v4) ─────────────────────────
  The full-viewport `.hero` this suite measured is no longer mounted: the
  homepage opens on the hero accordion, which is not viewport-tall. What it
  inherits is the same contract in the one place it applies: from 768px up
  its height is CAPPED by the measured viewport, `--vv-height`, not by a
  guessed unit. So "the hero exactly fills the viewport" became "the hero's
  cap is exactly the measured viewport, minus the navbar clearance and its
  bottom breathing room", in every orientation, after a rotation, after a
  client-side navigation, and never moved by a chrome collapse. The
  --vv-height publishing contract itself is asserted unchanged.

  UPDATED: desktop is now a fixed share of the viewport (75vh, so the
  spotlight band fits under it), and it is PHONE LANDSCAPE, a short landscape
  viewport, where the hero is sized from --vv-height: the open story plus
  its stack of four fill the screen under the navbar exactly, `height:
  calc(var(--vv-height) - var(--home-top) - 8px)`. That is what `cap` reads.
*/
import { launchTestBrowser } from './e2e-browser.mjs';
import { startPreviewServer } from './e2e-server.mjs';
import assert from 'node:assert/strict';

const PORTRAIT = { width: 390, height: 844, hasTouch: true, isMobile: true };
const LANDSCAPE = { width: 844, height: 390, hasTouch: true, isMobile: true };

async function measure(page) {
  return page.evaluate(() => {
    const track = document.querySelector('.hero-acc-track');
    const home = document.querySelector('.home-v4');
    const vvRaw = document.documentElement.style.getPropertyValue('--vv-height');
    const homeTop = parseFloat(getComputedStyle(home).getPropertyValue('--home-top'));
    const cs = getComputedStyle(track);
    return {
      vh: window.innerHeight,
      vvHeight: vvRaw,
      /* What the cap SHOULD be if it reads the measured viewport. */
      expectedCap: Math.round(parseFloat(vvRaw || String(window.innerHeight)) - homeTop - 8),
      cap: Math.round(parseFloat(cs.height)),
      trackHeight: Math.round(track.getBoundingClientRect().height),
    };
  });
}

async function runTests() {
  console.log('Starting Astro preview server for Hero Viewport E2E...');
  const { stop } = await startPreviewServer();

  console.log('Server is running. Launching Puppeteer...');
  const browser = await launchTestBrowser();
  let exitCode = 0;
  let passed = 0;
  const pass = (msg) => {
    console.log(`  ✓ ${msg}`);
    passed++;
  };

  try {
    /* ─── 1. PUBLISHED BEFORE THE HERO COULD PAINT ────────────────────────── */
    {
      const page = await browser.newPage();
      await page.setViewport(LANDSCAPE);
      /* `domcontentloaded`, not networkidle2: the point is that the value is
         there from the inline script, without waiting for modules. */
      await page.goto('http://localhost:4321/', { waitUntil: 'domcontentloaded' });
      const vv = await page.evaluate(() =>
        document.documentElement.style.getPropertyValue('--vv-height')
      );
      assert.notEqual(
        vv,
        '',
        '--vv-height was not set at DOMContentLoaded. It is seeded by an inline ' +
          'script in Layout.astro precisely so the hero never paints once at the ' +
          'fallback height and then resizes. If it only appears later, that ' +
          'inline seed has been removed or deferred.'
      );
      pass(`--vv-height is seeded before modules load (${vv})`);
      await page.close();
    }

    /* ─── 2. THE REPORTED REPRO: LOAD, THEN ROTATE ────────────────────────── */
    {
      const page = await browser.newPage();
      await page.setViewport(PORTRAIT);
      await page.goto('http://localhost:4321/', { waitUntil: 'networkidle2' });
      await new Promise((r) => setTimeout(r, 900));

      /* Portrait phones stack the accordion (no cap below 768px), so the
         cap is asserted once the page has rotated into the desktop layout. */

      await page.setViewport(LANDSCAPE);
      await page.evaluate(() => window.dispatchEvent(new Event('orientationchange')));
      /* Past the 600ms settle — a rotation is animated, so an early read is a
         layout still in motion. */
      await new Promise((r) => setTimeout(r, 900));

      const after = await measure(page);

      assert.equal(
        after.vvHeight,
        `${after.vh}px`,
        `After rotating, --vv-height is "${after.vvHeight}" but the viewport is ` +
          `${after.vh}px. viewport-anchor.ts must republish it once the rotation ` +
          `settles, or the hero keeps a height belonging to the orientation it ` +
          `no longer has — which is the reported bug: "load the homepage and ` +
          `then rotate your phone".`
      );

      assert.equal(
        after.cap,
        after.expectedCap,
        `After rotating to landscape the hero's cap is ${after.cap}px but the ` +
          `measured viewport gives ${after.expectedCap}px. It is reading a ` +
          `guessed or stale height, not --vv-height.`
      );
      pass(`rotation portrait -> landscape: hero cap follows the measured viewport (${after.cap}px)`);
      await page.close();
    }

    /* ─── 3. AND BACK, SO IT IS NOT ONE-WAY ───────────────────────────────── */
    {
      const page = await browser.newPage();
      await page.setViewport(LANDSCAPE);
      await page.goto('http://localhost:4321/', { waitUntil: 'networkidle2' });
      await new Promise((r) => setTimeout(r, 900));

      for (const [label, vp] of [
        ['portrait', PORTRAIT],
        ['landscape', LANDSCAPE],
      ]) {
        await page.setViewport(vp);
        await page.evaluate(() => window.dispatchEvent(new Event('orientationchange')));
        await new Promise((r) => setTimeout(r, 900));
        const m = await measure(page);
        assert.equal(m.vvHeight, `${m.vh}px`, `Rotating to ${label}: --vv-height is ${m.vvHeight}, viewport is ${m.vh}.`);
        if (vp.width >= 768) {
          assert.equal(m.cap, m.expectedCap, `Rotating to ${label}: cap ${m.cap}px, measured viewport gives ${m.expectedCap}px.`);
        }
      }
      pass('rotating back and forth republishes the measured height, and the cap follows it');
      await page.close();
    }

    /*
      ─── 3b. CLIENT-SIDE NAVIGATION MUST NOT WIPE IT ──────────────────────────

      `--vv-height` is an inline style on <html>, and ClientRouter swaps that
      element's attributes on every client-side navigation. Measured before the
      fix: seeded `390px` on first load, `""` after navigating to /feed, still
      `""` after navigating back to the homepage — so the hero fell back to
      `100svh`, the guessed height this whole mechanism exists to replace, on
      any reader who pressed a nav link before rotating.

      `keepFixedControlsTappable()` could not cover this: its "already bound"
      guard returns before the publish on every page load after the first.
    */
    {
      const page = await browser.newPage();
      await page.setViewport(LANDSCAPE);
      await page.goto('http://localhost:4321/', { waitUntil: 'networkidle2' });
      await new Promise((r) => setTimeout(r, 900));

      const onLoad = await measure(page);
      assert.notEqual(onLoad.vvHeight, '', '--vv-height missing on first load.');

      /* Away, then back — "press the home button" in the report. */
      await page.evaluate(() => {
        const a = document.querySelector('a[href="/feed"], a[href^="/feed"]');
        if (a) a.click();
        else location.href = '/feed';
      });
      await new Promise((r) => setTimeout(r, 1500));
      const away = await page.evaluate(() => ({
        vvHeight: document.documentElement.style.getPropertyValue('--vv-height'),
        path: location.pathname,
      }));
      assert.notEqual(
        away.vvHeight,
        '',
        `--vv-height was wiped by the client-side navigation to ${away.path}. ` +
          `ClientRouter swaps <html>'s attributes, so it must be re-seeded on ` +
          `astro:page-load — and not via keepFixedControlsTappable(), whose ` +
          `"already bound" guard returns before the publish on every load after ` +
          `the first.`
      );

      await page.evaluate(() => {
        const a = document.querySelector('a[href="/"]');
        if (a) a.click();
        else location.href = '/';
      });
      await new Promise((r) => setTimeout(r, 1500));
      const back = await measure(page);
      assert.notEqual(
        back.vvHeight,
        '',
        '--vv-height was wiped by navigating back to the homepage.'
      );
      assert.equal(
        back.cap,
        back.expectedCap,
        `After navigating back home the hero's cap is ${back.cap}px but the ` +
          `measured viewport gives ${back.expectedCap}px.`
      );
      pass('--vv-height survives client-side navigation away and back');
      await page.close();
    }

    /*
      ─── 4. A *SIMULATED* CHROME COLLAPSE — THE ONLY HONEST WAY TO TEST THIS ─

      An earlier version of this block just dispatched visualViewport events
      and asserted the hero did not resize. It passed — and it also passed
      when the fix was deliberately broken to republish on every scroll,
      because Chromium's `visualViewport.height` never actually moves, so the
      republish wrote the SAME number and nothing resized. A guard that cannot
      fail is not a guard.

      So the collapse is simulated properly: `visualViewport.height` is
      overridden to report a shorter viewport, exactly as iOS does when its
      chrome retracts, and THEN the events are fired. Now the two behaviours
      are distinguishable — republishing on scroll changes `--vv-height` and
      resizes the hero; republishing on rotation only does not.
    */
    {
      const page = await browser.newPage();
      await page.setViewport(LANDSCAPE);
      await page.goto('http://localhost:4321/', { waitUntil: 'networkidle2' });
      await new Promise((r) => setTimeout(r, 900));

      const before = await measure(page);

      const result = await page.evaluate(async () => {
        const vv = window.visualViewport;
        const real = vv.height;
        /* iOS reports a SHORTER visual viewport while the chrome overlays. */
        Object.defineProperty(vv, 'height', {
          configurable: true,
          get: () => real - 60,
        });

        const hero = document.querySelector('.hero-acc-track');
        let resizes = 0;
        let last = getComputedStyle(hero).height;
        for (let i = 0; i < 25; i++) {
          vv.dispatchEvent(new Event('scroll'));
          vv.dispatchEvent(new Event('resize'));
          /* iOS ALSO fires a window resize when its toolbar collapses (every
             scroll, in landscape). Republishing on it was the reported
             jitter: the hero stack jumped and nearly doubled mid-scroll. */
          window.dispatchEvent(new Event('resize'));
          await new Promise((r) => requestAnimationFrame(r));
          const h = getComputedStyle(hero).height;
          if (h !== last) resizes++;
          last = h;
        }

        const afterScroll = document.documentElement.style.getPropertyValue('--vv-height');

        /* Now rotate with the same override in place: the value MUST follow. */
        window.dispatchEvent(new Event('orientationchange'));
        await new Promise((r) => setTimeout(r, 900));
        const afterRotate = document.documentElement.style.getPropertyValue('--vv-height');

        delete vv.height;
        return { resizes, afterScroll, afterRotate, expectedAfterRotate: `${Math.round(real - 60)}px` };
      });

      assert.equal(
        result.resizes,
        0,
        `The hero resized ${result.resizes} time(s) across 25 chrome-collapse ` +
          `events (visualViewport.height reporting 60px shorter). Resizing the ` +
          `hero on those is the exact jitter ` +
          `100dvh was rejected for, reintroduced by hand. --vv-height must be ` +
          `republished on rotation ONLY.`
      );
      assert.equal(
        result.afterScroll,
        before.vvHeight,
        `--vv-height changed from "${before.vvHeight}" to "${result.afterScroll}" ` +
          `during a chrome collapse. It must stay constant per orientation.`
      );
      pass('a simulated chrome collapse resizes the hero 0 times (no jitter)');

      assert.equal(
        result.afterRotate,
        result.expectedAfterRotate,
        `After a rotation --vv-height is "${result.afterRotate}" but the visual ` +
          `viewport reports "${result.expectedAfterRotate}". The value must ` +
          `follow a rotation even though it ignores a scroll — that asymmetry ` +
          `IS the fix, and this asserts both halves of it.`
      );
      pass('...but a rotation still republishes it (both halves of the asymmetry)');
      await page.close();
    }

    console.log(`\n✅ Hero Viewport E2E tests passed (${passed} checks).`);
  } catch (error) {
    console.error('\n❌ Hero Viewport E2E failed:', error.message);
    exitCode = 1;
  } finally {
    await browser.close();
    stop();
    process.exit(exitCode);
  }
}

runTests();
