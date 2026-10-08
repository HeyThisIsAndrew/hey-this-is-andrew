import { launchTestBrowser } from './e2e-browser.mjs';
import { startPreviewServer } from './e2e-server.mjs';
import assert from 'node:assert/strict';

async function runTests() {
  console.log('Starting Astro preview server for Calendar Modal E2E...');
  const { stop } = await startPreviewServer();

  console.log('Server is running. Launching Puppeteer...');
  const browser = await launchTestBrowser();
  let exitCode = 0;

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 375, height: 812 }); // Mobile viewport
    console.log('Navigating to events page...');
    await page.goto('http://localhost:4321/events');

    await page.waitForSelector('.open-full-calendar-btn', { timeout: 5000 });
    const trigger = await page.$('.open-full-calendar-btn');
    assert.ok(trigger, 'Calendar modal trigger found');
    await page.evaluate(el => el.click(), trigger);

    const modalVisible = await page.waitForSelector('#spanning-calendar-modal', { visible: true, timeout: 3000 });
    assert.ok(modalVisible, 'Calendar modal should become visible');

    /*
      ─── EMPTY-SHELL REGRESSION ──────────────────────────────────────────────

      "The modal opened" is NOT the assertion that matters, and asserting only
      that is how this bug reached production twice (8314698, and again in the
      client:idle change this suite now guards). Both times the dialog opened
      perfectly — with nothing inside it but the close bar.

      DesktopCalendar renders a skeleton until it hydrates, and the skeleton is
      35 cells that all carry `.dc-calendar-cell.empty` and NO `.dc-day-number`.
      The real grid is the only thing that ever emits `.dc-day-number`, so its
      count is an exact discriminator between "hydrated" and "empty shell" —
      the same 0-day-cells signature the hotfix was verified against.
    */
    await page.waitForSelector('#spanning-calendar-modal .dc-day-number', { timeout: 5000 });
    const warmGrid = await page.evaluate(() => ({
      dayNumbers: document.querySelectorAll('#spanning-calendar-modal .dc-day-number').length,
      skeletons: document.querySelectorAll('#spanning-calendar-modal .dc-skeleton').length,
    }));
    assert.ok(
      warmGrid.dayNumbers >= 28,
      `Calendar must render a real month grid, got ${warmGrid.dayNumbers} day cells (0 = the empty-shell bug)`,
    );
    assert.equal(warmGrid.skeletons, 0, 'Skeleton must be replaced by the real grid once hydrated');

    console.log(`  ✓ real grid rendered (${warmGrid.dayNumbers} day cells)`);

    console.log('Closing modal via ESC...');
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 500));

    const afterEscape = await page.evaluate(() => ({
      open: document.getElementById('spanning-calendar-modal').open,
      bodyPosition: document.body.style.position,
    }));
    assert.equal(afterEscape.open, false, 'Calendar modal should be closed after ESC key');
    /*
      Escape closes a <dialog> natively — no click, so no close-button handler
      runs. While the scroll-lock release was bound to that button, this path
      left <body> at position:fixed and the page frozen behind the dismissed
      modal. The release now hangs off the dialog's own `close` event.
    */
    assert.equal(afterEscape.bodyPosition, '', 'ESC must also release the body scroll lock');

    /*
      ─── COLD-LOAD REGRESSION ────────────────────────────────────────────────

      The wiring for this button used to live inside an `astro:page-load`
      callback. On an initial pageview Astro's ClientRouter fires that event
      from the window `load` event, which waits for EVERY subresource. On a
      cold cache that is seconds of a painted, tappable, completely dead
      button — reported from production on iOS Safari, and gone after a
      refresh because the second load is served from cache.

      This reproduces it deterministically: hold the remote images open so
      `load` can never fire, then click. `waitUntil: 'domcontentloaded'`
      matters as much as the stalling — the default `goto` waits for `load`
      itself, which is exactly why the assertion above never caught this.
    */
    console.log('Cold-load: modal must open before the window load event...');
    const cold = await browser.newPage();
    await cold.setViewport({ width: 375, height: 812 });
    await cold.setRequestInterception(true);
    const stalled = [];
    cold.on('request', (req) => {
      // Never resolved and never aborted: the request stays in flight, so the
      // document stays in its loading state for the duration of the test.
      if (req.resourceType() === 'image') stalled.push(req);
      else req.continue().catch(() => {});
    });

    await cold.goto('http://localhost:4321/events', { waitUntil: 'domcontentloaded' });
    await cold.waitForSelector('.open-full-calendar-btn', { timeout: 5000 });

    const loadFired = await cold.evaluate(() => document.readyState === 'complete');
    assert.equal(loadFired, false, 'Precondition: the window load event must NOT have fired yet');

    await cold.click('.open-full-calendar-btn');
    await cold.waitForSelector('#spanning-calendar-modal[open]', { timeout: 3000 });
    console.log('  ✓ opened with the document still loading');

    /*
      And it must be a real calendar on the cold path too, not just an open
      dialog. This is the assertion that pins the island to client:load.

      The images above are still stalled, so the document cannot reach `load`.
      client:load hydrates off the module graph and does not care. client:idle
      would be waiting on requestIdleCallback on a page that is still fetching,
      animating a kenburns loop and running observers — precisely the starvation
      the directive comment in SpanningCalendarModal.astro describes. Same for
      client:visible, which never fires at all inside a closed <dialog>.
    */
    await cold.waitForSelector('#spanning-calendar-modal .dc-day-number', { timeout: 5000 });
    const coldDayCells = await cold.$$eval(
      '#spanning-calendar-modal .dc-day-number',
      (els) => els.length,
    );
    assert.ok(
      coldDayCells >= 28,
      `Calendar must hydrate before the load event, got ${coldDayCells} day cells`,
    );
    console.log(`  ✓ real grid rendered pre-load (${coldDayCells} day cells)`);

    for (const req of stalled) req.abort().catch(() => {});
    await cold.close();

    console.log('✅ Calendar Modal E2E tests passed.');
  } catch (error) {
    console.error('❌ E2E Test Failed:', error);
    exitCode = 1;
  } finally {
    await browser.close();
    stop();
    process.exit(exitCode);
  }
}
runTests();
