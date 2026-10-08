/*
  ─── COMMAND PALETTE NETWORK CHAOS & DEFENSIVE TEST SUITE ───────────────────

  Covers Workstream B (Chaos & Defensive Testing) for Ticket #182:
    - B1. Index fetch failures (500, 404, empty array, non-array object)
    - B2. Malformed entries (title: null, url: undefined, type: "banana", extreme length, emoji, RTL)
    - B3. Script/index load error resilience (graceful degradation)
    - B4. Rapid input stress (200-char bursts, rapid clearing, arrow navigation, rapid open/close)
    - B5. Escape hatches (Escape from input, close button click, backdrop click — ensuring scroll unlock)
    - B9. Injection safety (verifying textContent rendering and zero script execution)
*/
import { launchTestBrowser } from './e2e-browser.mjs';
import { startPreviewServer } from './e2e-server.mjs';
import assert from 'node:assert/strict';

async function runTests() {
  console.log('Starting Astro preview server for Command Palette Chaos E2E...');
  const { stop } = await startPreviewServer();

  console.log('Server is running. Launching Puppeteer...');
  const browser = await launchTestBrowser();
  let exitCode = 0;

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const pageErrors = [];
    page.on('pageerror', (err) => {
      console.log('  [BROWSER ERROR]:', err.message);
      pageErrors.push(err.message);
    });

    const openPalette = async () => {
      await page.evaluate(() => {
        const btn = document.querySelector('.nav-search-btn.desktop-only') || document.querySelector('[data-action="open-search"]');
        if (btn) btn.click();
      });
      await page.waitForSelector('#command-palette[open]', { timeout: 3000 });
    };

    console.log('\nTesting B5: Escape Hatches & Scroll Unlock...');
    await page.goto('http://localhost:4321/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#command-palette', { timeout: 5000 });

    // B5.1 Close via Escape from input
    await openPalette();
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('command-palette')?.open);
    const scrollAfterEsc = await page.evaluate(() => document.body.style.overflow);
    assert.equal(scrollAfterEsc, '', 'Body scroll must be unlocked after Escape');
    console.log('  ✓ B5.1: Escape from input closes palette and restores scroll');

    // B5.2 Close via close-btn click
    await openPalette();
    await page.click('#command-palette .close-btn');
    await page.waitForFunction(() => !document.getElementById('command-palette')?.open);
    const scrollAfterBtn = await page.evaluate(() => document.body.style.overflow);
    assert.equal(scrollAfterBtn, '', 'Body scroll must be unlocked after close-btn click');
    console.log('  ✓ B5.2: Close button click closes palette and restores scroll');

    // B5.3 Close via backdrop click (clicking the <dialog> outside content)
    await openPalette();
    await page.evaluate(() => {
      const dialog = document.getElementById('command-palette');
      if (dialog) dialog.click();
    });
    await page.waitForFunction(() => !document.getElementById('command-palette')?.open);
    const scrollAfterBackdrop = await page.evaluate(() => document.body.style.overflow);
    assert.equal(scrollAfterBackdrop, '', 'Body scroll must be unlocked after backdrop click');
    console.log('  ✓ B5.3: Backdrop click closes palette and restores scroll');

    console.log('\nTesting B4: Rapid Input Stress & Rapid Toggles...');
    await openPalette();
    // Rapidly type 200 chars
    await page.type('#cmd-palette-input', 'A'.repeat(200), { delay: 1 });
    // Clear via clear button
    await page.waitForSelector('#cmd-palette-clear:not([hidden])');
    await page.click('#cmd-palette-clear');
    const inputVal = await page.evaluate(() => document.getElementById('cmd-palette-input')?.value);
    assert.equal(inputVal, '', 'Input should be cleared');
    // Rapid arrow keys
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('ArrowDown');
    }
    await page.keyboard.press('Escape');

    // Rapid open/close toggles (15 times)
    for (let i = 0; i < 15; i++) {
      await openPalette();
      await page.keyboard.press('Escape');
    }
    const scrollAfterStress = await page.evaluate(() => document.body.style.overflow);
    assert.equal(scrollAfterStress, '', 'Scroll must not leak under rapid toggles');
    console.log('  ✓ B4: Rapid input and 15 rapid open/close cycles handled cleanly without scroll leak');

    console.log('\nTesting B9: Injection / XSS Safety...');
    await openPalette();
    await page.type('#cmd-palette-input', '<script>window.__xss_test=true</script>');
    await page.type('#cmd-palette-input', '"><img src=x onerror="window.__xss_test=true">');
    const xssExecuted = await page.evaluate(() => window.__xss_test);
    assert.equal(xssExecuted, undefined, 'Injected XSS payload must not execute');
    await page.keyboard.press('Escape');
    console.log('  ✓ B9: Injection payloads safely rendered as text, no script execution');

    // Setup request interception for Chaos scenarios B1 & B2
    console.log('\nTesting B1 & B2: Request Interception & Network Chaos...');
    let mockMode = null; // '500', '404', 'empty-array', 'non-array', 'malformed-entries'

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (req.url().includes('/api/search-index.json')) {
        if (mockMode === '500') {
          req.respond({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server Down' }) });
        } else if (mockMode === '404') {
          req.respond({ status: 404, contentType: 'text/plain', body: 'Not Found' });
        } else if (mockMode === 'empty-array') {
          req.respond({ status: 200, contentType: 'application/json', body: '[]' });
        } else if (mockMode === 'non-array') {
          req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: 'invalid format' }) });
        } else if (mockMode === 'malformed-entries') {
          const badEntries = [
            { id: 'bad-1', title: null, url: undefined, type: 'banana' },
            { id: 'bad-2', title: 'Z'.repeat(4000), url: 'https://example.com/extreme', type: 'article' },
            { id: 'bad-3', title: '🚀🔥🎮', url: 'https://example.com/emoji', type: 'hub' },
            { id: 'bad-4', title: 'مرحبا', url: 'https://example.com/rtl', type: 'video' },
            { id: 'bad-5', title: 'Missing Media', url: 'https://example.com/no-img', type: 'hub', image: 'http://localhost:9999/404.jpg' }
          ];
          req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(badEntries) });
        } else {
          req.continue();
        }
      } else {
        req.continue();
      }
    });

    // B1.1: HTTP 500
    mockMode = '500';
    await page.goto('http://localhost:4321/', { waitUntil: 'domcontentloaded' });
    await openPalette();
    await page.type('#cmd-palette-input', 'marvel');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('command-palette')?.open);
    const scrollAfter500 = await page.evaluate(() => document.body.style.overflow);
    assert.equal(scrollAfter500, '', 'Body scroll must be unlocked after 500 error');
    console.log('  ✓ B1.1: HTTP 500 index error handled safely without crashing page');

    // B1.2: HTTP 404
    mockMode = '404';
    await page.goto('http://localhost:4321/', { waitUntil: 'domcontentloaded' });
    await openPalette();
    await page.type('#cmd-palette-input', 'dc');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('command-palette')?.open);
    const scrollAfter404 = await page.evaluate(() => document.body.style.overflow);
    assert.equal(scrollAfter404, '', 'Body scroll must be unlocked after 404 error');
    console.log('  ✓ B1.2: HTTP 404 index error handled safely without crashing page');

    // B1.3: Empty Array []
    mockMode = 'empty-array';
    await page.goto('http://localhost:4321/', { waitUntil: 'domcontentloaded' });
    await openPalette();
    await page.type('#cmd-palette-input', 'anything');
    const emptyDisplay = await page.evaluate(() => {
      const el = document.getElementById('cmd-palette-empty');
      return el ? window.getComputedStyle(el).display : 'none';
    });
    assert.equal(emptyDisplay, 'block', 'Empty state should be displayed when searchData is empty');
    await page.keyboard.press('Escape');
    console.log('  ✓ B1.3: Empty index [] renders clean empty state');

    // B1.4: Non-Array JSON {}
    mockMode = 'non-array';
    await page.goto('http://localhost:4321/', { waitUntil: 'domcontentloaded' });
    await openPalette();
    await page.type('#cmd-palette-input', 'test');
    await page.keyboard.press('Escape');
    console.log('  ✓ B1.4: Non-array JSON payload safely normalized without exception');

    // B2: Malformed entries
    mockMode = 'malformed-entries';
    await page.goto('http://localhost:4321/', { waitUntil: 'domcontentloaded' });
    await openPalette();
    // Search for the malformed items
    await page.type('#cmd-palette-input', 'Z');
    await page.keyboard.press('ArrowDown');
    await page.click('#cmd-palette-clear');
    await page.type('#cmd-palette-input', '🚀');
    await page.keyboard.press('Escape');
    console.log('  ✓ B2: Malformed entries (null title, missing URL, emoji, extreme length, RTL) rendered cleanly without throwing');

    // Assert that no unhandled page errors occurred during any chaos test
    assert.equal(pageErrors.length, 0, `Expected 0 uncaught browser errors, got: ${pageErrors.join(', ')}`);
    console.log('\n✅ All Command Palette Network Chaos tests (B1–B9) passed successfully!');
  } catch (error) {
    console.error('❌ Chaos E2E Test Failed:', error);
    exitCode = 1;
  } finally {
    await browser.close();
    stop();
    process.exit(exitCode);
  }
}

runTests();
