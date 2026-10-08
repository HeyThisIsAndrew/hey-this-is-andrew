/*
  THE LOGO AND THE WORDMARK DO DIFFERENT THINGS.

  They sit next to each other in the navbar and both carry `href="/"`, and the
  navbar's click handler used to bind every `a[href="/"]` and, on the homepage,
  swallow the click and jump to the top. So the logo stopped being a link.

  Reported: "the logo is now causing site to scroll to the top when clicked
  from the home page. It must remain as Logo is immediate home button and be
  unconventional hq text is the scroll to the top button for the page it is
  clicked from."

  Worth stating because it was assumed otherwise: this was NOT a regression
  from the QA branch. main binds the same selector on the same line. What
  changed is that the jump used to be written with a `scroll-behavior` pin
  that never took effect, so it animated rather than jumped and read as
  ordinary smooth scrolling. Making the jump real made the wrong behaviour
  visible. Nothing guarded the distinction, which is why it could drift at all.

  THE CONTRACT
    .nav-logo     — navigation is NEVER prevented, on any page.
    #nav-identity — navigation is ALWAYS prevented and the page goes to the
                    top, on every page, not just the homepage.
*/
import { launchTestBrowser } from './e2e-browser.mjs';
import { startPreviewServer } from './e2e-server.mjs';
import assert from 'node:assert/strict';

const VIEWPORT = { width: 1280, height: 900 };

/** Put the page in the state where both controls are live and visible. */
async function settle(page) {
  await page.evaluate(async () => {
    const root = document.documentElement;
    root.classList.remove('splash-armed', 'splash-lifting', 'splash-dropping');
    window.__hqScrollLock?.release?.();
    await new Promise((r) => setTimeout(r, 50));
    /* Past 100px so #nav-identity is revealed and interactive. */
    window.scrollTo(0, 600);
    await new Promise((r) => setTimeout(r, 500));
  });
}

/**
 * Click a selector and report whether the click was SWALLOWED before it could
 * reach the router.
 *
 * Note what is deliberately NOT asserted: `defaultPrevented`. Astro's
 * ClientRouter calls `preventDefault()` on every internal link — that is how
 * client-side navigation works — so a navigating logo and a swallowed one look
 * identical by that measure. An earlier version of this test used it and
 * reported a passing fix as broken.
 *
 * The discriminator is `stopPropagation()`. Hero.astro's brand intercept is a
 * CAPTURE-phase listener on `document` that stops the event dead, so a
 * bubble-phase listener on `document` receives the click only when the element
 * was left alone.
 */
function clickAndReport(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { missing: true };

    let reachedRouter = false;
    const spy = () => {
      reachedRouter = true;
    };
    document.addEventListener('click', spy);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    el.dispatchEvent(event);
    document.removeEventListener('click', spy);

    return {
      missing: false,
      reachedRouter,
      defaultPrevented: event.defaultPrevented,
      href: el.getAttribute('href'),
    };
  }, selector);
}

async function runTests() {
  console.log('Starting Astro preview server for Brand Controls E2E...');
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
    /* The homepage is where the two used to behave identically, and interior
       routes are where the wordmark used to navigate away instead of
       scrolling. Both matter. */
    for (const route of ['/', '/feed', '/intel']) {
      /* ─── THE LOGO NAVIGATES ─────────────────────────────────────────── */
      {
        const page = await browser.newPage();
        await page.setViewport(VIEWPORT);
        await page.goto(`http://localhost:4321${route}`, { waitUntil: 'networkidle2' });
        await settle(page);

        const logo = await clickAndReport(page, '.nav-logo');
        assert.equal(logo.missing, false, `${route}: no .nav-logo in the navbar.`);
        assert.equal(
          logo.href,
          '/',
          `${route}: .nav-logo points at "${logo.href}" rather than the homepage.`
        );
        assert.equal(
          logo.reachedRouter,
          true,
          `${route}: the click on .nav-logo was swallowed by a capture-phase ` +
            `stopPropagation() and never reached the router, so the logo is ` +
            `being used as a scroll-to-top button instead of navigating. The ` +
            `logo is a home button on every page; only #nav-identity scrolls. ` +
            `Check Hero.astro's brand intercept — it must match #nav-identity, ` +
            `not "#navbar a[href=\\"/\\"]", which is both controls.`
        );
        pass(`${route}: the logo's click reaches the router (not swallowed)`);
        await page.close();
      }

      /* ─── THE WORDMARK SCROLLS THIS PAGE TO THE TOP ──────────────────── */
      {
        const page = await browser.newPage();
        await page.setViewport(VIEWPORT);
        await page.goto(`http://localhost:4321${route}`, { waitUntil: 'networkidle2' });
        await settle(page);

        const before = await page.evaluate(() => window.scrollY);
        assert.ok(
          before > 100,
          `${route}: could not scroll far enough to reveal #nav-identity ` +
            `(scrollY ${before}). The wordmark only appears past 100px.`
        );

        const identity = await clickAndReport(page, '#nav-identity');
        assert.equal(identity.missing, false, `${route}: no #nav-identity in the navbar.`);
        assert.equal(
          identity.defaultPrevented,
          true,
          `${route}: clicking #nav-identity was allowed to navigate to ` +
            `"${identity.href}". It is the scroll-to-top control for the page ` +
            `it is clicked from — sending the reader to the homepage from ` +
            `halfway down an interior page is the bug.`
        );

        /* Wait for the scroll to SETTLE rather than for a fixed delay. The
           homepage path animates (Hero.astro uses `behavior: 'smooth'`, the
           motion being the feedback that the press registered) while interior
           pages jump instantly via Navbar.astro. A single short delay reads
           the homepage mid-animation and reports a phantom failure — it
           reported 88px on the first run of this test. */
        const after = await page.evaluate(async () => {
          const deadline = Date.now() + 3000;
          let stable = 0;
          let last = -1;
          while (Date.now() < deadline) {
            const y = window.scrollY;
            stable = y === last ? stable + 1 : 0;
            last = y;
            if (y === 0 && stable >= 3) break;
            await new Promise((r) => setTimeout(r, 50));
          }
          return { y: window.scrollY, path: location.pathname };
        });
        assert.equal(
          after.y,
          0,
          `${route}: after clicking #nav-identity the page is at ${after.y}, not the top.`
        );
        assert.equal(
          after.path,
          route,
          `${route}: clicking #nav-identity navigated to ${after.path}. It must ` +
            `stay on the page it was clicked from.`
        );
        pass(`${route}: the wordmark scrolls to top and stays put`);
        await page.close();
      }
    }

    console.log(`\n✅ Brand Controls E2E tests passed (${passed} checks).`);
  } catch (error) {
    console.error('\n❌ Brand Controls E2E failed:', error.message);
    exitCode = 1;
  } finally {
    await browser.close();
    stop();
    process.exit(exitCode);
  }
}

runTests();
