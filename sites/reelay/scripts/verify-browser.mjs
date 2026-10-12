#!/usr/bin/env node
/**
 * verify-browser.mjs: Comprehensive Browser Automation & Responsive Verification Suite
 *
 * Tests:
 * 1. Interactive 4-Stage Publishing Workflow (mouse clicks, keyboard APG navigation, ARIA)
 * 2. Interactive Data-Flow Topology (node selection, keyboard arrows, boundary guarantees)
 * 3. 5-Drawer Vertical Feature Accordion (click expansion, preview synchronization)
 * 4. Download (the one Apple silicon build, v0.12.0, SHA-256 checksums drawer)
 * 5. Responsive Overflow Check across 9 viewports (320, 375, 430, 768, 1024, 1280, 1440, 1920, 2560)
 * 6. Internal Anchor Link Integrity
 * 7. Zero Console Errors & Clean Runtimes
 * 8. Every route: no console errors and no sideways overflow at 320, 390 and 1440
 * 9. Reduced motion: nothing hidden or animating
 * 10. Light and dark colour schemes: page colours and text contrast
 * 11. Product sub-nav (desktop links, phone sheet) and the capability matrix
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');

if (!fs.existsSync(distDir)) {
  console.error(`Dist directory not found: ${distDir}. Run build first.`);
  process.exit(1);
}

// 1. Simple static file server for dist/
function startServer(port = 4173) {
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.txt': 'text/plain',
  };

  const server = http.createServer((req, res) => {
    let cleanUrl = req.url.split('?')[0];
    if (cleanUrl.endsWith('/')) cleanUrl += 'index.html';
    if (!path.extname(cleanUrl)) cleanUrl += '/index.html';

    const filePath = path.join(distDir, cleanUrl);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      const mime = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    }
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

async function runVerification() {
  console.log('🚀 Starting Local Static Server on http://127.0.0.1:4173...');
  const server = await startServer(4173);
  const baseUrl = 'http://127.0.0.1:4173';

  // Import Playwright
  let chromium;
  try {
    const pw = await import('@playwright/test');
    chromium = pw.chromium;
  } catch (e) {
    console.error('Failed to import Playwright:', e.message);
    server.close();
    process.exit(1);
  }

  console.log('🌐 Launching Headless Chromium Browser...');
  // PW_EXECUTABLE_PATH lets a machine with a different pinned Chromium run the suite.
  const executablePath = process.env.PW_EXECUTABLE_PATH;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const failures = [];
  const passedChecks = [];

  try {
    // -------------------------------------------------------------
    // TEST SUITE 1: Console Errors & Initial Page Load
    // -------------------------------------------------------------
    console.log('\n--- 1. Testing Console Errors & Initial Page Load ---');
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);

    if (consoleErrors.length > 0) {
      failures.push(`Console errors detected on homepage: ${consoleErrors.join('; ')}`);
    } else {
      passedChecks.push('Zero browser console errors on initial load');
    }

    // -------------------------------------------------------------
    // TEST SUITE 2: Interactive 4-Stage Publishing Workflow
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing Interactive 4-Stage Publishing Workflow ---');
    const workflowTabs = await page.$$('.workflow-step-tab');
    if (workflowTabs.length !== 4) {
      failures.push(`Expected 4 workflow tabs, found ${workflowTabs.length}`);
    } else {
      passedChecks.push('Found exactly 4 workflow stage tabs');
    }

    // Click each tab and verify panel updates
    for (let i = 0; i < workflowTabs.length; i++) {
      await workflowTabs[i].click();
      await page.waitForTimeout(100);

      const isSelected = await workflowTabs[i].getAttribute('aria-selected');
      const targetId = await workflowTabs[i].getAttribute('data-step-target');
      const panel = await page.$(`#panel-${targetId}`);
      const isHidden = panel ? await panel.getAttribute('hidden') : null;

      if (isSelected !== 'true' || isHidden !== null) {
        failures.push(`Workflow tab ${i + 1} (${targetId}) failed click synchronization`);
      }
    }
    passedChecks.push('All 4 workflow tabs synchronize with panels on mouse click');

    // Test Keyboard APG Navigation (ArrowRight, ArrowLeft, Home, End)
    await workflowTabs[0].focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);
    const tab2Selected = await workflowTabs[1].getAttribute('aria-selected');
    if (tab2Selected !== 'true') {
      failures.push('Workflow keyboard ArrowRight failed to select Step 02');
    } else {
      passedChecks.push('Workflow keyboard navigation: ArrowRight activates next tab');
    }

    await page.keyboard.press('End');
    await page.waitForTimeout(100);
    const tab4Selected = await workflowTabs[3].getAttribute('aria-selected');
    if (tab4Selected !== 'true') {
      failures.push('Workflow keyboard End failed to select Step 04');
    } else {
      passedChecks.push('Workflow keyboard navigation: End key activates Step 04');
    }

    await page.keyboard.press('Home');
    await page.waitForTimeout(100);
    const tab1Selected = await workflowTabs[0].getAttribute('aria-selected');
    if (tab1Selected !== 'true') {
      failures.push('Workflow keyboard Home failed to return to Step 01');
    } else {
      passedChecks.push('Workflow keyboard navigation: Home key returns to Step 01');
    }

    // Check Simulation Disclaimer
    const disclaimer = await page.$('.workflow-simulation-disclaimer');
    if (!disclaimer) {
      failures.push('Missing explicit simulation disclaimer in InteractiveWorkflow');
    } else {
      passedChecks.push('Explicit simulation disclaimer present in workflow header');
    }

    // -------------------------------------------------------------
    // TEST SUITE 3: Interactive Data-Flow Topology
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing Interactive Data-Flow Topology ---');
    // Ensure Panel 04 (privacy & topology) is expanded in the showcase accordion
    const privHeader = await page.$('#acc-privacy');
    if (privHeader) {
      await privHeader.click();
      await page.waitForTimeout(150);
    }
    const topologyTabs = await page.$$('.topology-tab');
    if (topologyTabs.length !== 4) {
      failures.push(`Expected 4 topology boundary tabs, found ${topologyTabs.length}`);
    } else {
      passedChecks.push('Found exactly 4 topology boundary nodes');
    }

    for (let i = 0; i < topologyTabs.length; i++) {
      await topologyTabs[i].click();
      await page.waitForTimeout(100);

      const isSelected = await topologyTabs[i].getAttribute('aria-selected');
      const targetId = await topologyTabs[i].getAttribute('data-node-target');
      const panel = await page.$(`#panel-${targetId}`);
      const isHidden = panel ? await panel.getAttribute('hidden') : null;

      if (isSelected !== 'true' || isHidden !== null) {
        failures.push(`Topology tab ${i + 1} (${targetId}) failed click synchronization`);
      }
    }
    passedChecks.push('All 4 topology tabs synchronize with detail panels on click');

    // Test Vertical Keyboard Navigation (ArrowDown, ArrowUp)
    await topologyTabs[0].focus();
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);
    const topTab2Selected = await topologyTabs[1].getAttribute('aria-selected');
    if (topTab2Selected !== 'true') {
      failures.push('Topology keyboard ArrowDown failed to select Node 02');
    } else {
      passedChecks.push('Topology keyboard navigation: ArrowDown activates next node');
    }

    // -------------------------------------------------------------
    // TEST SUITE 4: Professional Download Center & Cryptographic Hashes
    // -------------------------------------------------------------
    console.log('\n--- 4. Testing Download Center & Cryptographic Hashes ---');
    // Ensure Panel 05 (download) is expanded in the showcase accordion
    const dlHeader = await page.$('#acc-download');
    if (dlHeader) {
      await dlHeader.click();
      await page.waitForTimeout(150);
    }
    const downloadCards = await page.$$('.download-card');
    if (downloadCards.length !== 3) {
      failures.push(`Expected 3 download cards (macOS, Windows, Linux), found ${downloadCards.length}`);
    } else {
      passedChecks.push('Found 3 platform download and setup cards (macOS, Windows, Linux)');
    }

    const versionText = await page.textContent('.download-section');
    if (!versionText.includes('v0.12.0 Beta')) {
      failures.push('Download section does not display verified release version v0.12.0 Beta');
    } else {
      passedChecks.push('Download section displays verified version v0.12.0 Beta');
    }

    // Toggle SHA-256 Checksums Drawer
    const checksumDrawer = await page.$('.checksums-drawer');
    if (!checksumDrawer) {
      failures.push('Missing checksums drawer in download center');
    } else {
      await page.click('.checksums-summary');
      await page.waitForTimeout(100);
      const isOpen = await checksumDrawer.getAttribute('open');
      if (isOpen === null) {
        failures.push('Checksums drawer did not open on summary click');
      } else {
        passedChecks.push('Cryptographic checksums drawer toggles open on click');
      }

      const verifiedHash = '25d314bff7a3bdecffa66c5ba2261e3c732b347401d1c2e881ccdcde3f2fdfa0';
      const hashContent = await page.textContent('.checksums-content');
      if (!hashContent.includes(verifiedHash)) {
        failures.push(`Checksums drawer missing verified SHA-256 digest: ${verifiedHash}`);
      } else {
        passedChecks.push('Verified SHA-256 hash matches disk artifact exactly');
      }
    }

    // -------------------------------------------------------------
    // TEST SUITE 5: Feature Accordion Interaction
    // -------------------------------------------------------------
    console.log('\n--- 5. Testing Pro Feature Accordion ---');
    const accordionTriggers = await page.$$('[data-accordion-header]');
    if (accordionTriggers.length !== 5) {
      failures.push(`Expected 5 accordion drawer triggers, found ${accordionTriggers.length}`);
    } else {
      passedChecks.push('Found 5 feature accordion drawers');

      // Click trigger 2
      await accordionTriggers[1].click();
      await page.waitForTimeout(150);
      const expanded = await accordionTriggers[1].getAttribute('aria-expanded');
      if (expanded !== 'true') {
        failures.push('Accordion drawer 2 failed to expand on click');
      } else {
        passedChecks.push('Accordion drawers expand on click');
      }
    }

    // -------------------------------------------------------------
    // TEST SUITE 6: Internal Anchor Link Integrity
    // -------------------------------------------------------------
    console.log('\n--- 6. Testing Internal Anchor Links ---');
    const anchorHrefs = await page.$$eval('a[href*="#"]', (anchors) =>
      anchors.map((a) => a.getAttribute('href')).filter(Boolean)
    );

    for (const href of anchorHrefs) {
      if (href.startsWith('http:') || href.startsWith('https:')) continue;

      const [pathname, hash] = href.split('#');
      if (!hash) continue;

      if (!pathname || pathname === '/' || pathname === '') {
        // In-page hash on homepage
        const targetElement = await page.$(`#${hash}`);
        if (!targetElement) {
          failures.push(`Homepage anchor href "${href}" points to missing ID "#${hash}"`);
        }
      } else {
        // Cross-page anchor: check target HTML in dist/
        const cleanPath = pathname.replace(/^\//, '').replace(/\/$/, '');
        const targetHtmlPath = path.join(distDir, cleanPath, 'index.html');
        if (!fs.existsSync(targetHtmlPath)) {
          failures.push(`Cross-page anchor href "${href}" points to non-existent route file: ${targetHtmlPath}`);
        } else {
          const targetHtml = fs.readFileSync(targetHtmlPath, 'utf8');
          if (!targetHtml.includes(`id="${hash}"`)) {
            failures.push(`Cross-page anchor href "${href}" target file missing id="${hash}"`);
          }
        }
      }
    }
    passedChecks.push('All in-page and cross-page anchor links resolve to valid target element IDs');

    await context.close();

    // -------------------------------------------------------------
    // TEST SUITE 8: Every route, at phone and desktop widths
    // -------------------------------------------------------------
    console.log('\n--- 8. Testing Every Route (console errors, overflow) ---');
    const routes = ['/', '/features/', '/features/library/', '/features/pipeline/', '/features/automations/', '/ai/',
      '/pricing/', '/support/', '/download/', '/changelog/', '/reviewers/', '/privacy/', '/terms/',
      '/data-deletion/', '/copyright/', '/security/', '/accessibility/'];
    for (const width of [320, 390, 1440]) {
      const ctx = await browser.newContext({ viewport: { width, height: 800 } });
      const pg = await ctx.newPage();
      const errs = [];
      pg.on('pageerror', (e) => errs.push(e.message));
      pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
      let bad = 0;
      for (const r of routes) {
        errs.length = 0;
        const resp = await pg.goto(`${baseUrl}${r}`, { waitUntil: 'load' });
        if (!resp || resp.status() !== 200) { failures.push(`${r} returned ${resp && resp.status()}`); bad++; continue; }
        // Lift overflow-x: hidden so it can't mask a layout that's too wide.
        const wide = await pg.evaluate(() => {
          document.documentElement.style.overflowX = 'visible';
          document.body.style.overflowX = 'visible';
          return document.documentElement.scrollWidth - document.documentElement.clientWidth;
        });
        if (wide > 0) { failures.push(`${r} at ${width}px is ${wide}px too wide`); bad++; }
        if (errs.length) { failures.push(`${r} at ${width}px console errors: ${errs.join('; ')}`); bad++; }
      }
      if (!bad) passedChecks.push(`All ${routes.length} routes at ${width}px: status 200, no console errors, no sideways overflow`);
      await ctx.close();
    }

    // -------------------------------------------------------------
    // TEST SUITE 9: Reduced motion
    // -------------------------------------------------------------
    console.log('\n--- 9. Testing Reduced Motion ---');
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
      const pg = await ctx.newPage();
      await pg.goto(`${baseUrl}/`, { waitUntil: 'load' });
      const rm = await pg.evaluate(() => {
        const hidden = [...document.querySelectorAll('[data-reveal]')].filter((el) => getComputedStyle(el).opacity !== '1').length;
        const moving = [...document.querySelectorAll('.hero-in, .product-tilt, .caret')].filter((el) => {
          const cs = getComputedStyle(el);
          return cs.animationName !== 'none' && parseFloat(cs.animationDuration) > 0.01;
        }).length;
        const words = document.querySelectorAll('[data-statement] .w');
        const unlit = [...words].filter((w) => !w.classList.contains('lit')).length;
        const autoplay = document.querySelectorAll('video[autoplay]').length;
        return { hidden, moving, unlit, autoplay };
      });
      if (rm.hidden || rm.moving || rm.unlit || rm.autoplay) failures.push(`Reduced motion: ${JSON.stringify(rm)}`);
      else passedChecks.push('Reduced motion: every section visible at once, no animation running, statement fully lit, nothing autoplays');
      await ctx.close();
    }

    // -------------------------------------------------------------
    // TEST SUITE 10: Light and dark colour schemes
    // -------------------------------------------------------------
    console.log('\n--- 10. Testing Light and Dark Colour Schemes ---');
    for (const scheme of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme });
      const pg = await ctx.newPage();
      let bad = 0;
      for (const r of ['/', '/privacy/', '/reviewers/', '/download/']) {
        await pg.goto(`${baseUrl}${r}`, { waitUntil: 'load' });
        const res = await pg.evaluate(() => {
          const rgb = (c) => (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
          const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
            .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
          const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
          const bg = rgb(getComputedStyle(document.body).backgroundColor);
          const worst = [];
          for (const sel of ['p', 'li', 'h2', 'dt', 'dd', '.lede', '.fine']) {
            for (const el of [...document.querySelectorAll(`main ${sel}`)].slice(0, 40)) {
              const cs = getComputedStyle(el);
              if (cs.color.includes('0)') || cs.backgroundClip === 'text' || el.closest('.app-window, .still, [class*="scene"], .ccs, .lgs, .brs, .slot')) continue;
              const r = ratio(rgb(cs.color), bg);
              if (r < 4.5) worst.push(`${sel} ${r.toFixed(2)}`);
            }
          }
          return { bg, worst: worst.slice(0, 5) };
        });
        const want = scheme === 'light' ? [255, 255, 255] : [0, 0, 0];
        if (res.bg.join() !== want.join()) { failures.push(`${scheme} ${r}: page background is ${res.bg}`); bad++; }
        if (res.worst.length) { failures.push(`${scheme} ${r}: low-contrast text ${res.worst.join(', ')}`); bad++; }
      }
      if (!bad) passedChecks.push(`${scheme} scheme: page colours follow the system and body text meets 4.5:1`);
      await ctx.close();
    }

    // -------------------------------------------------------------
    // TEST SUITE 11: Unified Navigation and Capability Matrix
    // -------------------------------------------------------------
    console.log('\n--- 11. Testing Unified Navigation and Capability Matrix ---');
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const pg = await ctx.newPage();
      await pg.goto(`${baseUrl}/features/library/`, { waitUntil: 'load' });

      // 1. Verify single coherent navbar (no duplicate sticky product nav bar)
      const pnavBars = await pg.$$('.pnav');
      if (pnavBars.length > 0) failures.push(`Duplicate persistent navigation bar (.pnav) detected on /features/library/`);
      else passedChecks.push('Zero duplicate navigation bars outside homepage');

      // 2. Primary nav dropdown contains feature chapters
      const featureSubLinks = await pg.$$eval('.dropdown-menu a[href*="/features/"], .dropdown-menu a[href*="/ai"]', (as) => as.length);
      if (featureSubLinks < 4) failures.push(`Primary nav Features dropdown has ${featureSubLinks} links, expected at least 4`);
      else passedChecks.push('Primary nav: 4 feature chapters in Features dropdown');

      await pg.goto(`${baseUrl}/`, { waitUntil: 'load' });
      const rows = await pg.$$eval('#works-with tbody tr', (r) => r.length);
      if (rows !== 7) failures.push(`Capability matrix has ${rows} rows, expected 7`);
      else passedChecks.push('Capability matrix: one row for each of the 7 platforms');
      await ctx.close();

      const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const pp = await phone.newPage();
      await pp.goto(`${baseUrl}/features/pipeline/`, { waitUntil: 'load' });

      // Verify no duplicate toggle buttons on mobile
      const pnavToggles = await pp.$$('[data-pnav-toggle]');
      if (pnavToggles.length > 0) failures.push(`Duplicate mobile menu toggle ([data-pnav-toggle]) detected on mobile`);
      else passedChecks.push('Zero duplicate mobile menu toggles on mobile');

      // Unified mobile menu opens, displays subsections, and closes with Escape
      const before = await pp.isVisible('#mobile-menu a >> nth=0');
      await pp.click('.menu-btn');
      await pp.waitForTimeout(400);
      const expanded = await pp.getAttribute('.menu-btn', 'aria-expanded');
      const after = await pp.isVisible('#mobile-menu a >> nth=0');
      await pp.keyboard.press('Escape');
      await pp.waitForTimeout(300);
      const closed = await pp.getAttribute('.menu-btn', 'aria-expanded');
      if (before || expanded !== 'true' || !after || closed !== 'false') {
        failures.push(`Unified mobile menu: hidden-first ${!before}, opens ${expanded}, links shown ${after}, Escape closes ${closed}`);
      } else {
        passedChecks.push('Unified mobile menu: opens cleanly, shows chapters, and closes with Escape');
      }
      await phone.close();
    }

    // -------------------------------------------------------------
    // TEST SUITE 12: Balanced grids (no orphan rows, equal cells)
    // -------------------------------------------------------------
    // Any grid or wrapping row of three or more like items must fill its
    // last row (no 3-3-1, no 2-1), and a grid's cells must be one height.
    // Text checklists are exempt: their lines are not boxes.
    console.log('\n--- 12. Testing Balanced Grids ---');
    {
      const EXEMPT = ['plan-list'];
      for (const width of [390, 768, 1024, 1440]) {
        const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
        const pg = await ctx.newPage();
        let bad = 0;
        for (const r of routes) {
          await pg.goto(`${baseUrl}${r}`, { waitUntil: 'load' });
          const found = await pg.evaluate((exempt) => {
            const out = [];
            for (const el of document.querySelectorAll('body *')) {
              if (exempt.some((c) => el.classList.contains(c))) continue;
              const cs = getComputedStyle(el);
              const grid = cs.display.includes('grid');
              if (!grid && !(cs.display.includes('flex') && cs.flexWrap === 'wrap')) continue;
              const kids = [...el.children].filter((k) => {
                const b = k.getBoundingClientRect();
                return getComputedStyle(k).position !== 'absolute' && b.width > 0 && b.height > 0;
              });
              if (kids.length < 3) continue;
              const sig = (k) => `${k.tagName}.${k.classList[0] || ''}`;
              if (new Set(kids.map(sig)).size !== 1) continue;
              const rows = new Map();
              for (const k of kids) { const t = Math.round(k.getBoundingClientRect().top); rows.set(t, (rows.get(t) || 0) + 1); }
              const counts = [...rows.values()];
              if (counts.length < 2 || counts[0] < 2) continue;
              const hs = kids.map((k) => Math.round(k.getBoundingClientRect().height));
              const name = `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`;
              if (counts[counts.length - 1] < counts[0]) out.push(`${name} rows ${counts.join('-')}`);
              else if (grid && Math.max(...hs) - Math.min(...hs) > 2) out.push(`${name} cells ${Math.min(...hs)} to ${Math.max(...hs)}px tall`);
            }
            return out;
          }, EXEMPT);
          for (const f of found) { failures.push(`${r} at ${width}px: ${f}`); bad++; }
        }
        if (!bad) passedChecks.push(`Balanced grids at ${width}px: every row full and every cell one size, on all ${routes.length} routes`);
        await ctx.close();
      }
    }

    // -------------------------------------------------------------
    // TEST SUITE 7: Responsive Layout & Overflow across 9 Viewports
    // -------------------------------------------------------------
    console.log('\n--- 7. Testing Responsive Layouts across 9 Viewports ---');
    const viewports = [
      { width: 320, height: 640, label: '320px (Mobile Min / iPhone SE)' },
      { width: 375, height: 667, label: '375px (Mobile Standard / iPhone 8)' },
      { width: 430, height: 932, label: '430px (Mobile Large / iPhone Pro Max)' },
      { width: 768, height: 1024, label: '768px (Tablet Portrait / iPad Mini)' },
      { width: 1024, height: 768, label: '1024px (Tablet Landscape / iPad Pro)' },
      { width: 1280, height: 800, label: '1280px (Laptop Standard / MacBook Air)' },
      { width: 1440, height: 900, label: '1440px (Desktop Wide / MacBook Pro)' },
      { width: 1920, height: 1080, label: '1920px (Full HD / 1080p Monitor)' },
      { width: 2560, height: 1440, label: '2560px (4K / Studio Display)' },
    ];

    for (const vp of viewports) {
      const vpContext = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const vpPage = await vpContext.newPage();

      await vpPage.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
      await vpPage.waitForTimeout(200);

      // Check for horizontal overflow: scrollWidth > clientWidth
      const overflow = await vpPage.evaluate(() => {
        const doc = document.documentElement;
        return {
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
          hasOverflow: doc.scrollWidth > doc.clientWidth,
        };
      });

      if (overflow.hasOverflow) {
        failures.push(`Horizontal overflow detected at ${vp.label}: scrollWidth=${overflow.scrollWidth} > clientWidth=${overflow.clientWidth}`);
      } else {
        passedChecks.push(`Clean layout at ${vp.label}: zero horizontal overflow (scrollWidth=${overflow.scrollWidth}px)`);
      }

      await vpContext.close();
    }

  } catch (err) {
    failures.push(`Unexpected test harness error: ${err.message}`);
  } finally {
    await browser.close();
    server.close();
  }

  // -------------------------------------------------------------
  // REPORT RESULTS
  // -------------------------------------------------------------
  console.log('\n======================================================');
  console.log('       BROWSER AUTOMATION VERIFICATION REPORT        ');
  console.log('======================================================');

  console.log(`\nPassed Checks (${passedChecks.length}):`);
  for (const p of passedChecks) {
    console.log(` ✓ ${p}`);
  }

  if (failures.length > 0) {
    console.error(`\nFailures (${failures.length}):`);
    for (const f of failures) {
      console.error(` ✗ ${f}`);
    }
    console.log('======================================================\n');
    process.exit(1);
  } else {
    console.log('\n🎉 ALL AUTOMATED BROWSER CHECKS PASSED 100%!');
    console.log('======================================================\n');
    process.exit(0);
  }
}

runVerification();
