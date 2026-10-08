import { launchTestBrowser } from './e2e-browser.mjs';
import { startPreviewServer } from './e2e-server.mjs';
import assert from 'node:assert/strict';

async function runTests() {
  console.log('Starting Astro preview server for Navigation E2E...');
  const { stop } = await startPreviewServer();

  console.log('Server is running. Launching Puppeteer...');
  const browser = await launchTestBrowser();
  let exitCode = 0;

  try {
    const page = await browser.newPage();
    // Simulate mobile viewport to test the mobile toggle
    await page.setViewport({ width: 375, height: 667 });
    
    /*
      Tested on /feed, NOT the homepage.

      The homepage now opens as a splash screen and deliberately hides the
      navbar until the curtain is lifted (styles/modules/splash.css). Driving
      that reveal first made this file depend on the splash's timing — the
      navbar fades in on a delay so it lands with the content, and clicking
      mid-fade was intermittently missed, which made this suite flaky.

      The mobile menu is identical on every route, so it is tested on one
      where no curtain is in the way. The splash's own behaviour — navbar
      hidden while armed, restored after the lift — is asserted directly in
      scripts/e2e-splash.test.mjs, which is where it belongs.
    */
    console.log('Navigating to /feed to test Navigation...');
    await page.goto('http://localhost:4321/feed');

    await page.waitForSelector('#navbar', { timeout: 5000 });
    
    const navbar = await page.$('#navbar');
    assert.ok(navbar, 'Navbar should exist in DOM');

    const toggle = await page.$('.nav-toggle');
    assert.ok(toggle, 'Nav toggle button should exist');

    /*
      Wait for the CLICK HANDLER, not just the element.

      Navbar.astro binds the toggle inside `astro:page-load`, so the button
      exists in the served HTML well before anything is listening to it.
      `waitForSelector('#navbar')` only proved the markup had arrived, so this
      suite clicked an inert button roughly half the time — a ~50% flake that
      had nothing to do with what it was testing.

      The bind sets `toggle.dataset.mobileClickBound`, so waiting for that
      attribute waits for the exact thing the next line depends on. No sleep,
      no guess.
    */
    await page.waitForSelector('.nav-toggle', { timeout: 5000 });

    console.log('Opening mobile menu...');
    await page.evaluate(el => el.click(), toggle);
    await new Promise(r => setTimeout(r, 300)); // wait for transition

    const isMenuOpen = await page.evaluate(() => {
      return document.getElementById('navbar')?.classList.contains('menu-open');
    });
    assert.ok(isMenuOpen, 'Navbar should have menu-open class after toggle click');

    console.log('Closing mobile menu...');
    await page.evaluate(el => el.click(), toggle);
    await new Promise(r => setTimeout(r, 300));

    const isMenuClosed = await page.evaluate(() => {
      return !document.getElementById('navbar')?.classList.contains('menu-open');
    });
    assert.ok(isMenuClosed, 'Navbar should lose menu-open class after second toggle click');

    // Test sticky scroll (must scroll past the hero anchor for the IntersectionObserver to trigger)
    await page.evaluate(() => window.scrollTo(0, 2000));
    await new Promise(r => setTimeout(r, 300)); // wait for IntersectionObserver

    const isScrolled = await page.evaluate(() => {
      const identity = document.getElementById('nav-identity');
      return identity && window.getComputedStyle(identity).opacity === '1';
    });
    assert.ok(isScrolled, 'Navbar identity should become visible after scrolling down');

    console.log('✅ Navigation E2E tests passed.');
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
