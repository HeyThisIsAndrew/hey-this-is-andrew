import { launchTestBrowser } from './e2e-browser.mjs';
import { startPreviewServer } from './e2e-server.mjs';
import assert from 'node:assert/strict';

async function runTests() {
  console.log('Starting Astro preview server for Category Modal E2E...');
  const { stop } = await startPreviewServer();

  console.log('Server is running. Launching Puppeteer...');
  const browser = await launchTestBrowser();
  let exitCode = 0;

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 375, height: 812 }); // Mobile viewport
    console.log('Navigating to a route that renders the filter row...');
    await page.goto('http://localhost:4321/category/film');
    
    await page.waitForSelector('#open-categories-btn', { timeout: 5000 });
    const trigger = await page.$('#open-categories-btn');
    assert.ok(trigger, 'Mobile filter trigger found');
    await page.evaluate(el => el.click(), trigger);

    const modalVisible = await page.waitForSelector('#category-fullscreen-overlay', { visible: true, timeout: 3000 });
    assert.ok(modalVisible, 'Category overlay should become visible');

    console.log('Closing overlay via close button...');
    const closeBtn = await page.$('#category-fullscreen-overlay .close-fullscreen-btn');
    assert.ok(closeBtn, 'the overlay must render a close button');
    await page.evaluate(el => el.click(), closeBtn);
    console.log('Waiting for overlay to hide...');
    const isHidden = await page.waitForFunction(() => {
      const modal = document.getElementById('category-fullscreen-overlay');
      return !modal || !modal.classList.contains('is-open');
    }, { timeout: 5000 });
    assert.ok(isHidden, 'Category overlay should be hidden after closing');

    /*
      REGRESSION GUARD: closing the overlay must not open the mobile nav menu.

      The overlay's close button is `class="close-fullscreen-btn nav-toggle
      menu-open"` — it borrows `.nav-toggle` purely to inherit the
      hamburger-to-X styling. While Navbar bound its handler to the element it
      got from `document.querySelector('.nav-toggle')` that was harmless,
      because that only ever resolved to the navbar's own button. When the
      handler moved to document-level delegation, a bare
      `closest('.nav-toggle')` started matching this button too: closing the
      categories overlay ALSO opened the mobile menu behind it and left the
      scroll lock held, so the page stayed pinned and the next tap on the real
      hamburger merely closed a menu the reader never opened — indistinguishable
      from a dead button.

      Nothing else in the suite catches this: the overlay does close, so every
      assertion above still passes. The fix is scoping the delegated selectors
      to `#navbar`, and this is what proves it stays scoped.
    */
    const afterClose = await page.evaluate(() => ({
      menuOpen: document.getElementById('navbar')?.classList.contains('menu-open'),
      locked: window.__hqScrollLock ? window.__hqScrollLock.isLocked() : false,
      bodyPosition: getComputedStyle(document.body).position,
    }));
    assert.equal(
      afterClose.menuOpen,
      false,
      'closing the categories overlay must not open the mobile nav menu',
    );
    assert.equal(
      afterClose.locked,
      false,
      'closing the categories overlay must release the scroll lock',
    );
    assert.notEqual(
      afterClose.bodyPosition,
      'fixed',
      'the page must not stay pinned after the overlay closes',
    );
    console.log('  \u2713 closing the overlay leaves the navbar and scroll lock alone');

    /*
      REGRESSION GUARD: Escape closes the overlay (#189).

      This used to be untestable here by accident. The close step above tried
      the button first and pressed Escape only as a fallback, and it always
      found the button, so the Escape path never once ran. That mattered,
      because Escape lived in CategoryOverlay's delegated block while
      QuadrantFilter carried a competing block guarded by the SAME window
      flag. Whichever chunk Vite emitted first won, and if the order had ever
      flipped, Escape would have vanished with nothing to catch it: the
      overlay still opens, and still closes by button, so every other
      assertion in this file would have stayed green while a keyboard user
      was left with a full-screen overlay they could not dismiss.

      So press Escape on its own terms, on both surfaces that share the
      component, and check the whole close contract rather than just the
      class: focus has to come back to the trigger, or a keyboard user is
      dropped at the top of the document.
    */
/*
      ─── THE FEED NO LONGER CARRIES THIS CONTROL; /category/<slug> DOES ────────
    
      These assertions used to run against /feed. The Feed's filter row was removed
      deliberately (FeedLayout's `showFilters={false}` on the three /feed routes) —
      its horizontal rows segment the same content by type and by brand, so the
      ARTICLE/VIDEO and FILM/TV/GAMES/EVENTS buttons were a second, flatter way to
      do the same job stacked on top of the first.
    
      /category/<slug> is the replacement rather than a deletion, and it has to be:
      it renders the SAME <QuadrantFilter /> the Feed used, so swapping the route
      keeps this suite covering both filter components — QuadrantFilter here and
      IntelFilters on /intel — which is the coverage the note below depends on.
    */
    for (const route of ['/category/film', '/intel']) {
      await page.goto(`http://localhost:4321${route}`, { waitUntil: 'networkidle0' });
      await page.waitForSelector('#open-categories-btn', { timeout: 5000 });
      await page.click('#open-categories-btn');
      await page.waitForFunction(
        () => document.getElementById('category-fullscreen-overlay')?.classList.contains('is-open'),
        { timeout: 3000 },
      );

      await page.keyboard.press('Escape');
      await page.waitForFunction(
        () => !document.getElementById('category-fullscreen-overlay')?.classList.contains('is-open'),
        { timeout: 3000 },
      ).catch(() => {
        throw new Error(`${route}: Escape did not close the category overlay`);
      });

      const afterEscape = await page.evaluate(() => {
        const overlay = document.getElementById('category-fullscreen-overlay');
        const openBtn = document.getElementById('open-categories-btn');
        return {
          ariaHidden: overlay?.getAttribute('aria-hidden'),
          ariaExpanded: openBtn?.getAttribute('aria-expanded'),
          focusReturned: document.activeElement === openBtn,
          locked: window.__hqScrollLock ? window.__hqScrollLock.isLocked() : false,
          bodyPosition: getComputedStyle(document.body).position,
        };
      });

      assert.equal(afterEscape.ariaHidden, 'true', `${route}: overlay must be aria-hidden after Escape`);
      assert.equal(afterEscape.ariaExpanded, 'false', `${route}: trigger must report collapsed after Escape`);
      assert.ok(afterEscape.focusReturned, `${route}: focus must return to the Categories button`);
      assert.equal(afterEscape.locked, false, `${route}: Escape must release the scroll lock`);
      assert.notEqual(afterEscape.bodyPosition, 'fixed', `${route}: the page must not stay pinned`);
      console.log(`  \u2713 ${route}: Escape closes the overlay and restores focus`);
    }

    /*
      REGRESSION GUARD: opening the overlay moves focus INTO it (#189).

      The other behaviour that lived only in the block that could have lost
      the race. Without it the overlay opens with focus still on the trigger
      behind it, so the first Tab walks the page underneath rather than the
      menu.
    */
    await page.goto('http://localhost:4321/category/film', { waitUntil: 'networkidle0' });
    await page.waitForSelector('#open-categories-btn', { timeout: 5000 });
    await page.click('#open-categories-btn');
    await page.waitForFunction(
      () => document.getElementById('category-fullscreen-overlay')?.classList.contains('is-open'),
      { timeout: 3000 },
    );
    const onOpen = await page.evaluate(() => ({
      focusInsideOverlay: document
        .getElementById('category-fullscreen-overlay')
        ?.contains(document.activeElement),
      ariaHidden: document.getElementById('category-fullscreen-overlay')?.getAttribute('aria-hidden'),
    }));
    assert.ok(onOpen.focusInsideOverlay, 'opening must move focus into the overlay');
    assert.equal(onOpen.ariaHidden, 'false', 'the open overlay must not be aria-hidden');
    console.log('  \u2713 opening moves focus into the overlay and clears aria-hidden');
    await page.keyboard.press('Escape');

    /*
      REGRESSION GUARD: the "Categories | Film" label updates on /category.

      This handler mutates the overlay's own button but used to live in
      QuadrantFilter. When #189 emptied QuadrantFilter's script of imports,
      Rollup folded what was left into FeedGrid's chunk, which
      /category/[category] never loads, so the label silently stopped
      updating on exactly the pages where a category IS active. Nothing
      caught it; the overlay still opened and closed correctly.
    */
    await page.goto('http://localhost:4321/category/film', { waitUntil: 'networkidle0' });
    await page.waitForSelector('#open-categories-btn', { timeout: 5000 });
    await page.waitForFunction(
      () => /Categories \|/.test(document.getElementById('open-categories-btn')?.textContent ?? ''),
      { timeout: 3000 },
    ).catch(() => {
      throw new Error('/category/film: the Categories button never picked up the active category');
    });
    const labelled = await page.evaluate(() => {
      const btn = document.getElementById('open-categories-btn');
      return { text: btn?.textContent?.trim(), active: btn?.classList.contains('active') };
    });
    assert.match(labelled.text, /^Categories \| /, 'the button must name the active category');
    assert.ok(labelled.active, 'the button must carry .active on a category page');
    console.log(`  \u2713 /category/film: button reads "${labelled.text}"`);

    /*
      And the other side of that guard: /intel shares this component but has
      no `.desktop-category-row`, so the handler must leave its label alone
      rather than stamping a default over it.
    */
    await page.goto('http://localhost:4321/intel', { waitUntil: 'networkidle0' });
    await page.waitForSelector('#open-categories-btn', { timeout: 5000 });
    const intelLabel = await page.evaluate(
      () => document.getElementById('open-categories-btn')?.textContent?.trim(),
    );
    assert.doesNotMatch(intelLabel, /\|/, `/intel: label should be untouched, got "${intelLabel}"`);
    console.log(`  \u2713 /intel: button label left alone ("${intelLabel}")`);

    /*
      REGRESSION GUARD: the overlay must actually cover the viewport.

      A `position: fixed` element resolves against the viewport ONLY when no
      ancestor has a transform, filter, perspective or containment. The Feed's
      filter wrapper once carried `.animate-on-scroll`, which sets both a
      transform and a filter — so the overlay became a 326x844 box offset
      230px down the page with its category buttons scrolled out of sight.
      Every assertion above still passed: the element existed, it was
      "visible", and it opened and closed correctly. Only its BOX was wrong.

      So measure the box, on both surfaces that share the component.

      That pair used to be /feed and /intel. The Feed no longer renders the
      filter row, so /category/film takes its place — it renders the same
      <QuadrantFilter />, which is what makes this a route swap rather than a
      loss of coverage.
    */
    for (const route of ['/category/film', '/intel']) {
      await page.goto(`http://localhost:4321${route}`, { waitUntil: 'networkidle0' });
      await page.waitForSelector('#open-categories-btn', { timeout: 5000 });
      await page.click('#open-categories-btn');
      await new Promise((r) => setTimeout(r, 400));

      const box = await page.evaluate(() => {
        const overlay = document.getElementById('category-fullscreen-overlay');
        const rect = overlay.getBoundingClientRect();
        const buttons = [...overlay.querySelectorAll('.cat-btn')];
        return {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          viewportW: window.innerWidth,
          viewportH: window.innerHeight,
          buttonCount: buttons.length,
          // Every category button must sit inside the viewport, not below it.
          allOnScreen: buttons.every((b) => {
            const r = b.getBoundingClientRect();
            return r.top >= 0 && r.bottom <= window.innerHeight && r.width > 0;
          }),
        };
      });

      assert.equal(box.x, 0, `${route}: overlay must start at the left viewport edge`);
      assert.equal(box.y, 0, `${route}: overlay must start at the top viewport edge`);
      assert.equal(box.width, box.viewportW, `${route}: overlay must span the viewport width`);
      assert.equal(box.height, box.viewportH, `${route}: overlay must span the viewport height`);
      assert.equal(box.buttonCount, 4, `${route}: all four categories must render`);
      assert.ok(box.allOnScreen, `${route}: every category button must be on screen`);
      console.log(`  ✓ ${route}: overlay fills the viewport with ${box.buttonCount} categories`);
    }

    console.log('✅ Category Modal E2E tests passed.');
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
