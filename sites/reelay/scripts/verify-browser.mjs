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
    // TEST SUITE 2: The workflow story (scroll-driven, never scroll-jacked)
    // -------------------------------------------------------------
    // Wide, with motion: the steps scroll beside one sticky frame, and the
    // step crossing the middle of the screen decides what the frame shows.
    // The page must scroll exactly as usual (no wheel handling), and the
    // step links must work. Reduced motion, and phones: nothing pinned,
    // every step's own picture visible.
    console.log('\n--- 2. Testing the Workflow Story ---');
    {
      const expect = ['library-grid', 'board', 'command-center', 'command-center', 'board'];
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const pg = await ctx.newPage();
      await pg.goto(`${baseUrl}/`, { waitUntil: 'load' });
      const pinned = await pg.$eval('[data-story]', (s) => s.hasAttribute('data-pinned'));
      const sticky = await pg.$eval('.story-stage', (el) => getComputedStyle(el).position);
      if (!pinned || sticky !== 'sticky') failures.push(`Story at 1440: pinned ${pinned}, stage position ${sticky}`);
      let bad = 0;
      for (let i = 1; i <= 5; i++) {
        await pg.evaluate((i) => {
          const r = document.querySelector(`.story-step[data-step="${i}"]`).getBoundingClientRect();
          window.scrollTo(0, r.top + window.scrollY + r.height / 2 - window.innerHeight / 2);
        }, i);
        await pg.waitForTimeout(700);
        const st = await pg.evaluate(() => {
          const s = document.querySelector('[data-story]');
          const stage = document.querySelector('.story-stage').getBoundingClientRect();
          return {
            stage: s.dataset.stage,
            shot: [...s.querySelectorAll('.frame--stage .shot.is-on')].map((x) => x.dataset.shot).join(),
            status: s.querySelector('[data-status].is-on')?.dataset.status,
            link: s.querySelector('[data-story-link][aria-current="step"]')?.dataset.storyLink,
            stageOnScreen: stage.top >= 0 && stage.bottom <= window.innerHeight,
          };
        });
        if (st.stage !== String(i) || st.shot !== expect[i - 1] || st.status !== String(i) || st.link !== String(i) || !st.stageOnScreen) {
          failures.push(`Story step ${i}: ${JSON.stringify(st)}`); bad++;
        }
      }
      if (!bad) passedChecks.push('Workflow story at 1440: each step, scrolled to the middle, shows its own screen, status and index mark; the frame stays on screen');

      // Natural scrolling: every wheel turn moves the page by about its delta.
      // The site scrolls smoothly, so jump there instantly and let it settle:
      // a smooth scroll still running would be counted against the wheel.
      await pg.evaluate(() => window.scrollTo({ top: document.querySelector('[data-story]').getBoundingClientRect().top + window.scrollY, behavior: 'instant' }));
      await pg.waitForTimeout(400);
      await pg.mouse.move(700, 450);
      const moves = [];
      for (let i = 0; i < 6; i++) {
        const before = await pg.evaluate(() => window.scrollY);
        await pg.mouse.wheel(0, 300);
        await pg.waitForTimeout(350);
        moves.push(Math.round((await pg.evaluate(() => window.scrollY)) - before));
      }
      if (moves.some((m) => m < 240 || m > 360)) failures.push(`Wheel scrolling through the story isn't natural: ${moves.join(', ')}px per 300px turn`);
      else passedChecks.push(`Wheel scrolling through the story is untouched: ${moves.join(', ')}px per 300px turn`);

      // The index links take you to the step, and the frame follows.
      await pg.click('[data-story-link="4"]');
      // It scrolls smoothly: wait for it to land (up to 3s), then let it settle.
      await pg.waitForFunction(() => document.querySelector('[data-story]').dataset.stage === '4', null, { timeout: 3000 }).catch(() => {});
      await pg.waitForTimeout(400);
      const viaLink = await pg.$eval('[data-story]', (s) => s.dataset.stage);
      if (viaLink !== '4') failures.push(`Story index link 04 left the frame at stage ${viaLink}`);
      else passedChecks.push('Story index: the 04 link scrolls to Approval and the frame shows it');
      await ctx.close();

      // A phone pins too. Held upright, the frame sticks under the nav and
      // the steps scroll up beneath it, each taking over the frame as it
      // reaches the space below. On its side, the frame sticks beside the
      // steps, as on a wide screen, small enough to fit under the nav. The
      // page still scrolls exactly as usual.
      // An iPad Pro is 1024 to 1366 wide: it takes the wide layout but scrolls
      // like an iPhone, so it gets the same treatment.
      for (const [label, width, height] of [['a 390px phone', 390, 844], ['a phone on its side (844 x 390)', 844, 390],
        ['an iPad Pro on its side (1366 x 1024)', 1366, 1024], ['an iPad Pro upright (1024 x 1366)', 1024, 1366]]) {
        const side = width > height || width >= 1024;
        const c = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true });
        const p2 = await c.newPage();
        await p2.goto(`${baseUrl}/`, { waitUntil: 'load' });
        const res = [];
        for (let i = 1; i <= 5; i++) {
          await p2.evaluate((i) => {
            // the step's middle on the anchor line (the middle of the room left for reading)
            const band = parseFloat(document.querySelector('[data-story]').style.getPropertyValue('--anchor')) || 0.5;
            const r = document.querySelector(`.story-step[data-step="${i}"]`).getBoundingClientRect();
            window.scrollTo({ top: r.top + window.scrollY + r.height / 2 - window.innerHeight * band, behavior: 'instant' });
          }, i);
          await p2.waitForTimeout(700);
          res.push(await p2.evaluate((side) => {
            const s = document.querySelector('[data-story]');
            const g = document.querySelector('.story-stage').getBoundingClientRect();
            const nav = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-bar-h')) || 0;
            return {
              pinned: s.hasAttribute('data-pinned'),
              stage: s.dataset.stage,
              shot: [...s.querySelectorAll('.frame--stage .shot.is-on')].map((x) => x.dataset.shot).join(),
              // Pinned under the sticky header (or, at step 1, not yet reached
              // it), and upright in the top half, leaving the bottom half for
              // the step; beside the steps wholly on screen, in the right-hand column.
              stuck: g.top >= document.querySelector('[data-story-top]').getBoundingClientRect().bottom - 2 && (side
                ? g.bottom <= window.innerHeight && g.left > window.innerWidth * 0.4
                : g.bottom < window.innerHeight * 0.55),
            };
          }, side));
        }
        // Nothing between the pinned frame and the page may clip, isolate or
        // transform: inside such a box iPhone Safari moves a sticky element
        // a frame late, and the frame shook while scrolling. Chrome shows
        // nothing wrong, so it's checked here. (The root may clip: that's
        // the viewport.)
        const boxes = await p2.evaluate(() => {
          const out = [];
          for (const sticky of ['.story-stage', '[data-story-top]']) {
            for (let el = document.querySelector(sticky).parentElement; el && el !== document.documentElement; el = el.parentElement) {
              const cs = getComputedStyle(el);
              const bad = [cs.overflowX, cs.overflowY].some((v) => v !== 'visible') || cs.isolation === 'isolate'
                || cs.transform !== 'none' || cs.filter !== 'none' || cs.contain !== 'none' || cs.willChange !== 'auto'
                || cs.backdropFilter !== 'none';
              if (bad) out.push(`${sticky} in ${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`);
            }
          }
          return [...new Set(out)];
        });
        if (boxes.length) failures.push(`Story on ${label}: a sticky part sits inside clipping or isolating boxes (${boxes.join(', ')}), which makes it shake on iPhone and iPad`);
        else passedChecks.push(`Story on ${label}: nothing between the sticky header or frame and the page clips, isolates or transforms them`);
        // In the middle of its pinned stretch the frame is held with
        // position: fixed (iPhone Safari wobbles sticky boxes; fixed ones it
        // holds still), and the switches in and out must not move the frame
        // or the text: scroll through in small steps and compare.
        const seam = await p2.evaluate(async () => {
          const grid = document.querySelector('.story-grid');
          const stage = document.querySelector('.story-stage');
          const top = document.querySelector('[data-story-top]');
          const bar = top.querySelector('.story-index');
          const frame = document.querySelector('.frame--stage');
          const probe = document.querySelector('.story-step[data-step="3"] .step-title');
          const a = grid.getBoundingClientRect().top + scrollY - 300, z = grid.getBoundingClientRect().bottom + scrollY;
          const frameOf = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          let prev = null; let fixedSeen = 0; const issues = [];
          for (let y = a; y < z; y += 15) {
            window.scrollTo({ top: y, behavior: 'instant' });
            await frameOf();
            const f = frame.getBoundingClientRect();
            const b = bar.getBoundingClientRect();
            const cur = { fixed: stage.classList.contains('is-fixed'), held: top.classList.contains('is-fixed'), top: f.top, left: f.left, w: f.width,
              bt: b.top, bl: b.left, bw: b.width, text: probe.getBoundingClientRect().top + scrollY };
            if (cur.fixed) fixedSeen++;
            if (cur.fixed !== cur.held) issues.push(`header and frame held apart at ${Math.round(y)}`);
            if (prev) {
              if (Math.abs(cur.text - prev.text) > 0.5) issues.push(`text moved ${(cur.text - prev.text).toFixed(2)}px at ${Math.round(y)}`);
              if (prev.fixed !== cur.fixed && (Math.abs(cur.top - prev.top) > 0.5 || Math.abs(cur.left - prev.left) > 0.5 || Math.abs(cur.w - prev.w) > 0.5)) issues.push(`frame moved switching at ${Math.round(y)}`);
              if (prev.held !== cur.held && (Math.abs(cur.bt - prev.bt) > 0.5 || Math.abs(cur.bl - prev.bl) > 0.5 || Math.abs(cur.bw - prev.bw) > 0.5)) issues.push(`header moved switching at ${Math.round(y)}`);
            }
            prev = cur;
          }
          return { fixedSeen, issues: issues.slice(0, 4) };
        });
        if (!seam.fixedSeen || seam.issues.length) failures.push(`Story on ${label}: fixed hold ${JSON.stringify(seam)}`);
        else passedChecks.push(`Story on ${label}: the header and frame are held fixed together through the middle of the story (${seam.fixedSeen} of the sampled positions), and switching in and out moves neither them nor the text`);
        const wrong = res.map((r, i) => (r.pinned && r.stage === String(i + 1) && r.shot === expect[i] && r.stuck ? null : `${i + 1}: ${JSON.stringify(r)}`)).filter(Boolean);
        if (wrong.length) failures.push(`Story on ${label} isn't pinned right: ${wrong.join('; ')}`);
        else passedChecks.push(`Story on ${label}: the frame stays pinned ${side ? 'beside the steps, wholly on screen' : 'under the header'}, and each step, scrolled onto the anchor line, shows its own screen`);
        await c.close();
      }

      for (const [label, opts] of [['reduced motion at 1440', { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }], ['a 390px phone with reduced motion', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' }], ['a phone on its side with reduced motion', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' }]]) {
        const c = await browser.newContext(opts);
        const p2 = await c.newPage();
        await p2.goto(`${baseUrl}/`, { waitUntil: 'load' });
        const r = await p2.evaluate(() => {
          const s = document.querySelector('[data-story]');
          const figs = [...s.querySelectorAll('.step-figure')];
          return {
            pinned: s.hasAttribute('data-pinned'),
            stageShown: getComputedStyle(s.querySelector('.story-stage')).display !== 'none',
            figures: figs.filter((f) => f.getBoundingClientRect().height > 100).length,
            alts: figs.filter((f) => (f.querySelector('img')?.alt || '').length > 10).length,
          };
        });
        if (r.pinned || r.stageShown || r.figures !== 5 || r.alts !== 5) failures.push(`Story on ${label}: ${JSON.stringify(r)}`);
        else passedChecks.push(`Story on ${label}: nothing pinned, all 5 steps with their own picture and alt text`);
        await c.close();
      }
      // The sticky header: under the nav for the whole story and the same
      // height stuck or not (so sticking moves nothing), its one-line title
      // shown only once stuck and never cut off. The bar above each step
      // fills as you read through it; with reduced motion it snaps to the
      // current step. And no step repeats its label above its own text.
      for (const [label, opts] of [
        ['1440', { viewport: { width: 1440, height: 900 } }],
        ['1024 x 768 touch', { viewport: { width: 1024, height: 768 }, isMobile: true, hasTouch: true }],
        ['768 x 1024 touch', { viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true }],
        ['a 390px phone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }],
        ['a 320px phone', { viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true }],
        ['1440 with reduced motion', { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }],
        ['a 390px phone with reduced motion', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' }],
      ]) {
        const reduced = opts.reducedMotion === 'reduce';
        const c = await browser.newContext(opts);
        const p2 = await c.newPage();
        await p2.goto(`${baseUrl}/`, { waitUntil: 'load' });
        await p2.waitForTimeout(400);
        const read = () => p2.evaluate(() => {
          const s = document.querySelector('[data-story]');
          const top = s.querySelector('[data-story-top]');
          const t = top.getBoundingClientRect();
          const sm = s.querySelector('.sm-t');
          return {
            nav: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-bar-h')),
            top: +t.top.toFixed(1), h: +t.height.toFixed(1),
            stuck: top.hasAttribute('data-stuck'),
            mini: +getComputedStyle(s.querySelector('.story-mini')).opacity,
            fits: sm.scrollWidth <= sm.clientWidth + 1,
            bars: [...s.querySelectorAll('.si-bar i')].map((i) => +new DOMMatrix(getComputedStyle(i).transform).a.toFixed(3)),
            sideways: document.documentElement.scrollWidth > innerWidth,
            kickers: s.querySelectorAll('.step-k').length + [...s.querySelectorAll('.story-step')].filter((a) => a.firstElementChild?.tagName !== 'H3').length,
          };
        });
        const problems = [];
        const rest = await read();
        if (rest.stuck || rest.mini !== 0) problems.push(`the one-line title shows before the header is stuck (${JSON.stringify(rest)})`);
        if (rest.kickers) problems.push(`${rest.kickers} steps carry a label above their text`);
        for (const [n, f] of [[2, 0.5], [4, 0.25], [5, 0.85]]) {
          await p2.evaluate(([n, f]) => {
            const a = parseFloat(document.querySelector('[data-story]').style.getPropertyValue('--anchor')) || 0.5;
            const r = document.querySelector(`.story-step[data-step="${n}"]`).getBoundingClientRect();
            window.scrollTo({ top: r.top + window.scrollY + r.height * f - window.innerHeight * a, behavior: 'instant' });
          }, [n, f]);
          await p2.waitForTimeout(650);
          const r = await read();
          const want = r.bars.map((_, i) => (reduced ? (i < n ? 1 : 0) : i < n - 1 ? 1 : i === n - 1 ? f : 0));
          const off = r.bars.some((b, i) => Math.abs(b - want[i]) > (reduced ? 0.001 : 0.06));
          if (Math.abs(r.top - r.nav) > 0.5 || Math.abs(r.h - rest.h) > 0.5) problems.push(`step ${n}: header at ${r.top} (nav ${r.nav}), height ${r.h} (at rest ${rest.h})`);
          if (!r.stuck || r.mini < 0.99 || !r.fits) problems.push(`step ${n}: one-line title stuck ${r.stuck}, opacity ${r.mini}, fits ${r.fits}`);
          if (off) problems.push(`step ${n} at ${f}: bars ${r.bars.join(' ')}, expected ${want.join(' ')}`);
          if (r.sideways) problems.push(`step ${n}: the page scrolls sideways`);
        }
        if (problems.length) failures.push(`Story header on ${label}: ${problems.join('; ')}`);
        else passedChecks.push(`Story header on ${label}: sticky under the nav at one height, one-line title once stuck and whole, and the step bars ${reduced ? 'snap to the current step' : 'fill continuously as each step is read'}; no repeated step labels`);
        await c.close();
      }
    }
    // -------------------------------------------------------------
    // TEST SUITE 3: Interactive Data-Flow Topology
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing Interactive Data-Flow Topology ---');
    // Ensure Panel 04 (privacy & topology) is expanded in the showcase accordion
    const privHeader = await page.$('#pillar-privacy-header');
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
    const dlHeader = await page.$('#pillar-download-header');
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
        const moving = [...document.querySelectorAll('.hero-in, .product-settle, .detail, .hero-light, .panel-visual > .ws, .shotframe img, .caret')].filter((el) => {
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
    // TEST SUITE 13: Vertical accordions and deep links
    // -------------------------------------------------------------
    // The homepage's five chapters are full-width rows stacked top to
    // bottom (never side-by-side strips), one open at a time, and a link to
    // anything inside a row opens that row: the nav's #works-with,
    // #data-topology, #tech-specs, and a feature page's #transcripts.
    console.log('\n--- 13. Testing Vertical Accordions and Deep Links ---');
    for (const width of [1440, 390]) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const pg = await ctx.newPage();
      await pg.goto(`${baseUrl}/`, { waitUntil: 'load' });
      const boxes = await pg.$$eval('.pillars [data-accordion-header]', (hs) => hs.map((h) => {
        const b = h.getBoundingClientRect();
        return { top: b.top, bottom: b.bottom, left: b.left, width: b.width, open: h.getAttribute('aria-expanded') };
      }));
      const stacked = boxes.length === 5 && boxes.every((b, i) => i === 0
        || (b.top >= boxes[i - 1].bottom - 1 && Math.abs(b.left - boxes[0].left) < 2 && Math.abs(b.width - boxes[0].width) < 2));
      const wide = boxes.length && boxes[0].width >= Math.min(width - 64, 900);
      if (!stacked || !wide) failures.push(`Homepage accordion at ${width}px is not 5 full-width stacked rows: ${JSON.stringify(boxes.map((b) => [Math.round(b.top), Math.round(b.left), Math.round(b.width)]))}`);
      else passedChecks.push(`Homepage accordion at ${width}px: 5 full-width rows stacked vertically`);
      if (boxes.map((b) => b.open).join() !== 'true,false,false,false,false') failures.push(`Homepage accordion at ${width}px should open on row 01 only`);

      await pg.click('#pillar-tools-header');
      await pg.waitForTimeout(100);
      const state = await pg.$$eval('.pillars [data-accordion-header]', (hs) => hs.map((h) => h.getAttribute('aria-expanded')).join());
      const body = await pg.$eval('#pillar-tools-content', (el) => el.getBoundingClientRect().height);
      const below = await pg.evaluate(() => document.querySelector('#pillar-tools-content').getBoundingClientRect().top
        >= document.querySelector('#pillar-tools-header').getBoundingClientRect().bottom - 1);
      if (state !== 'false,false,true,false,false' || body < 100 || !below) failures.push(`Opening row 03 at ${width}px: ${state}, body ${Math.round(body)}px, below header ${below}`);
      else passedChecks.push(`Homepage accordion at ${width}px: a row opens downward and closes the others`);
      await ctx.close();
    }
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
      const pg = await ctx.newPage();
      const checks = [['/#works-with', 'pillar-platforms'], ['/#data-topology', 'pillar-privacy'], ['/#tech-specs', 'pillar-download'], ['/features/library/#transcripts', 'transcripts']];
      let bad = 0;
      for (const [url, row] of checks) {
        await pg.goto(`${baseUrl}${url}`, { waitUntil: 'load' });
        const open = await pg.getAttribute(`#${row}-header`, 'aria-expanded');
        if (open !== 'true') { failures.push(`Deep link ${url} did not open #${row}`); bad++; }
      }
      await pg.goto(`${baseUrl}/`, { waitUntil: 'load' });
      await pg.evaluate(() => { location.hash = 'data-topology'; });
      await pg.waitForTimeout(150);
      if (await pg.getAttribute('#pillar-privacy-header', 'aria-expanded') !== 'true') { failures.push('A hashchange to #data-topology did not open its row'); bad++; }
      const dupes = await pg.evaluate(() => {
        const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
        return ids.filter((id, i) => ids.indexOf(id) !== i);
      });
      if (dupes.length) { failures.push(`Duplicate ids on the homepage: ${dupes.join(', ')}`); bad++; }
      if (!bad) passedChecks.push('Deep links (on load and on hashchange) open the row that holds their target; no duplicate ids');
      await ctx.close();
    }

    // -------------------------------------------------------------
    // TEST SUITE 14: The page ends at the footer, and only the page scrolls
    // -------------------------------------------------------------
    // On a phone the homepage once scrolled past its footer into ~850px of
    // black and stalled when scrolled back up: overflow-x: hidden on both
    // html and body made the body its own scroller, and a collapsed row's
    // absolutely positioned labels escaped the row's clip to fill it.
    console.log('\n--- 14. Testing Page End and Single Scroller (phone) ---');
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const pg = await ctx.newPage();
      let bad = 0;
      for (const r of routes) {
        await pg.goto(`${baseUrl}${r}`, { waitUntil: 'load' });
        const m = await pg.evaluate(() => {
          const foot = document.querySelector('.site-footer');
          return {
            bodyScrolls: ['auto', 'scroll'].includes(getComputedStyle(document.body).overflowY),
            doc: document.documentElement.scrollHeight,
            body: document.body.scrollHeight,
            footer: Math.round(foot.getBoundingClientRect().bottom + scrollY),
          };
        });
        if (m.bodyScrolls || m.body > m.doc + 1 || m.doc > m.footer + 1) {
          failures.push(`${r} at 390px: body scrolls ${m.bodyScrolls}, body ${m.body}px, page ${m.doc}px, footer ends ${m.footer}px`);
          bad++;
        }
      }
      if (!bad) passedChecks.push(`Phone: on all ${routes.length} routes only the page scrolls, and it ends at the footer`);
      await ctx.close();
    }

    // -------------------------------------------------------------
    // TEST SUITE 15: Touch scrolling never stalls (phone homepage)
    // -------------------------------------------------------------
    // Real touch swipes, down the whole homepage and back up. Every swipe
    // must carry the page about as far as the others. The Statement once gave
    // each word a colour fade restarted on every scroll frame; the repaints
    // cut the scroll's momentum under the app preview, and on an iPhone the
    // page stalled and bounced there.
    console.log('\n--- 15. Testing Touch Scrolling (phone homepage) ---');
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
      const pg = await ctx.newPage();
      await pg.goto(`${baseUrl}/`, { waitUntil: 'load' });
      await pg.waitForTimeout(2000); // let the hero's entrance finish
      const cdp = await ctx.newCDPSession(pg);
      const swipe = async (dy) => {
        let y = dy < 0 ? 600 : 300;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y }] });
        for (let i = 0; i < 12; i++) {
          y += dy / 12;
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y }] });
          await new Promise((r) => setTimeout(r, 16));
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await pg.waitForTimeout(300);
        return pg.evaluate(() => scrollY);
      };
      const max = await pg.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      const steps = [];
      const mids = [];
      let at = 0;
      for (let dir of [-300, 300]) {
        for (let i = 0; i < 20; i++) {
          const next = await swipe(dir);
          const moved = Math.abs(next - at);
          const mid = (at + next) / 2; // the stretch of page this swipe covered
          at = next;
          const edge = dir < 0 ? next >= max - 2 : next <= 2;
          if (edge) break;          // the last swipe into an end is short by design
          steps.push(moved);
          mids.push(mid);
        }
      }
      const sorted = [...steps].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const shortAt = steps.map((s, i) => (s < median * 0.85 ? mids[i] : null)).filter((m) => m !== null);
      // This emulator drops a swipe's momentum now and then on its own: on a
      // blank page of the same height, 3 of 238 swipes (1.3%); on this
      // homepage 1.9%, and 2% on the shorter one before it. So the allowance
      // is a rate, one short swipe per 20, which is the "one per run" this
      // check began with when the page took 20 swipes.
      // A real stall is at a PLACE, and comes back every time: the one this
      // guards against cut 2 to 5 swipes a run under the app preview. So a
      // run with two or more short swipes (which this check used to fail
      // outright) swipes through each of those places 16 more times. Noise
      // gives 0 or 1 there (measured: 1 to 2 in 96); a stall gives most of
      // them, and fails. More than twice the allowance fails outright.
      const allowed = Math.ceil(steps.length / 20);
      const where = shortAt.map((m) => `~${Math.round(m)}px`).join(', ');
      const retests = [];
      if (shortAt.length >= 2 && shortAt.length <= 2 * allowed) {
        for (const place of shortAt) {
          await pg.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), Math.max(0, place - 600));
          await pg.waitForTimeout(400);
          let pos = await pg.evaluate(() => scrollY);
          let dir = -300;
          let n = 0;
          for (let i = 0; i < 16; i++) {
            if (pos > place + 600) dir = 300;
            else if (pos < place - 600) dir = -300;
            const next = await swipe(dir);
            const atEnd = next >= max - 2 || next <= 2;
            if (!atEnd && Math.abs(next - pos) < median * 0.85) n++;
            pos = next;
          }
          retests.push([Math.round(place), n]);
        }
      }
      const reproduced = retests.filter(([, n]) => n >= 3);
      const retold = retests.map(([p, n]) => `~${p}px ${n}/16`).join(', ');
      if (!steps.length || shortAt.length > 2 * allowed || reproduced.length) {
        failures.push(`Touch scrolling stalls on the phone homepage: ${shortAt.length} of ${steps.length} swipes short of the median (${Math.round(median)}px) at ${where}${retests.length ? `; swiped again there: ${retold}` : ''}; swipes moved ${steps.map(Math.round).join(', ')}px`);
      } else {
        passedChecks.push(`Touch scrolling on the phone homepage: ${steps.length} swipes down and up, ${shortAt.length} short of the median (${Math.round(median)}px)${retests.length ? `; swiped 16 more times at each of those places, it didn't recur (${retold})` : ''}`);
      }
      await ctx.close();
    }

    // -------------------------------------------------------------
    // TEST SUITE 16: Nothing cut off at the screen edge
    // -------------------------------------------------------------
    // Sections clip sideways overflow, so a too-wide box never makes the page
    // scroll sideways (suite 8 can't see it): it just loses its right side.
    // That is how the Windows install steps on /download ran off a phone.
    // With every accordion row and <details> open, no visible text, code,
    // table, image or control may cross the screen edge, unless it sits in
    // a box that scrolls and that box fits. And outside tables (which
    // scroll sideways on purpose, with an edge cue), nothing may hide
    // content behind a sideways scroll.
    console.log('\n--- 16. Testing Nothing Cut Off at the Screen Edge ---');
    for (const width of [280, 390, 1024]) {
      const ctx = await browser.newContext({ viewport: { width, height: 800 }, isMobile: width < 800, hasTouch: width < 800, reducedMotion: 'reduce' });
      const pg = await ctx.newPage();
      let bad = 0;
      for (const r of routes) {
        await pg.goto(`${baseUrl}${r}`, { waitUntil: 'load' });
        await pg.evaluate(() => {
          document.querySelectorAll('[data-accordion-row]').forEach((row) => {
            row.classList.add('is-expanded', 'is-settled');
            const body = row.querySelector('.accordion-body');
            if (body) body.inert = false;
          });
          document.querySelectorAll('details').forEach((d) => { d.open = true; });
        });
        await pg.waitForTimeout(100);
        const found = await pg.evaluate((vw) => {
          const out = new Set();
          const skip = (el) => el.closest('[aria-hidden="true"], .sr-only, svg, .mobile-menu, [hidden]');
          const scrollerOf = (el) => {
            for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
              if (['auto', 'scroll'].includes(getComputedStyle(a).overflowX)) return a;
            }
            return null;
          };
          for (const el of document.querySelectorAll('body *')) {
            if (skip(el)) continue;
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
            const rect = el.getBoundingClientRect();
            if (!rect.width || !rect.height) continue;
            const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
            const media = ['IMG', 'VIDEO', 'PRE', 'TABLE', 'INPUT', 'BUTTON'].includes(el.tagName);
            if ((ownText || media) && (rect.right > vw + 1 || rect.left < -1)) {
              // A deliberate crop (a zoomed screenshot in its frame) is fine
              // as long as the frame itself is on screen. Opt-in only: every
              // section clips too, and that clipping is what this catches.
              const crop = el.closest('[data-crop]');
              const cr = crop && crop !== el && crop.getBoundingClientRect();
              if (cr && cr.right <= vw + 1 && cr.left >= -1) continue;
              const sc = scrollerOf(el);
              const sr = sc && sc.getBoundingClientRect();
              if (!sr || sr.right > vw + 1 || sr.left < -1) out.add(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} runs to ${Math.round(rect.left)}..${Math.round(rect.right)}px`);
            }
            if (['auto', 'scroll'].includes(cs.overflowX) && el.scrollWidth > el.clientWidth + 2 && !el.querySelector('table')) {
              out.add(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} hides ${el.scrollWidth - el.clientWidth}px behind a sideways scroll`);
            }
          }
          return [...out].slice(0, 5);
        }, width);
        for (const f of found) { failures.push(`${r} at ${width}px: ${f}`); bad++; }
      }
      if (!bad) passedChecks.push(`Nothing cut off at ${width}px: every route, every row and drawer open`);
      await ctx.close();
    }

    // -------------------------------------------------------------
    // TEST SUITE 19: Opening a row never moves the page away (phone)
    // -------------------------------------------------------------
    // The homepage rows open one at a time, so opening a lower row closes
    // the open one above it. On an iPhone the page then jumped by that row's
    // height and left the reader near the footer: Safari has no scroll
    // anchoring, which in Chrome hid it. So anchoring is switched off here,
    // as on Safari, and the row tapped must stay where it was on screen.
    console.log('\n--- 19. Testing Accordion Rows Stay Put (phone) ---');
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const pg = await ctx.newPage();
      await pg.goto(`${baseUrl}/`, { waitUntil: 'load' });
      await pg.addStyleTag({ content: 'html, body { overflow-anchor: none !important; }' });
      const moved = [];
      for (const id of ['pillar-platforms-header', 'pillar-tools-header', 'pillar-download-header']) {
        await pg.evaluate((id) => {
          const r = document.getElementById(id).getBoundingClientRect();
          window.scrollTo({ top: r.top + window.scrollY - 300, behavior: 'instant' });
        }, id);
        await pg.waitForTimeout(300);
        const before = await pg.evaluate((id) => document.getElementById(id).getBoundingClientRect().top, id);
        await pg.tap(`#${id}`);
        await pg.waitForTimeout(1100);
        const after = await pg.evaluate((id) => ({
          top: document.getElementById(id).getBoundingClientRect().top,
          open: document.getElementById(id).getAttribute('aria-expanded'),
        }), id);
        moved.push({ id, by: Math.round(after.top - before), open: after.open });
      }
      const bad = moved.filter((m) => Math.abs(m.by) > 4 || m.open !== 'true');
      if (bad.length) failures.push(`Opening a homepage row moved the page (phone, no scroll anchoring): ${JSON.stringify(bad)}`);
      else passedChecks.push('Homepage rows on a phone: opening a row (closing the open one above) leaves the tapped row where it was, even without scroll anchoring');
      await ctx.close();
    }

    // -------------------------------------------------------------
    // TEST SUITE 19b: Switching rows on an iPad: no whipsaw, no jitter
    // -------------------------------------------------------------
    // Rows open one at a time, so tapping the next row closes the open one
    // above it. Rows used to animate their heights while a frame loop chased
    // the tapped header, a frame behind: on an iPad the header shook up and
    // down. Now the switch happens in one step before any paint. Tapped with
    // its header in the upper part of the screen, the header must not move
    // at all; tapped low (its content would open below the fold), the page
    // may bring it up, but only one way, and it ends in view. Sampled at 0,
    // 50, 150, 300 and 500ms after the tap, and every frame in between for
    // reversals. Scroll anchoring is off, as on Safari.
    console.log('\n--- 19b. Testing Accordion Switching (iPad) ---');
    for (const [w, h] of [[1024, 768], [768, 1024]]) {
      for (const route of ['/', '/features/library/']) {
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
        const pg = await ctx.newPage();
        await pg.goto(`${baseUrl}${route}`, { waitUntil: 'load' });
        await pg.addStyleTag({ content: 'html, body { overflow-anchor: none !important; }' });
        const ids = await pg.evaluate(() => [...document.querySelector('[data-accordion-group]').querySelectorAll(':scope > [data-accordion-row] [data-accordion-header]')].slice(0, 5).map((b) => b.id));
        const bad = [];
        // Row 01 open first, then 02, 03, 04 and 05 in turn: held mid-screen,
        // then the same again tapped low on the screen.
        for (const [where, frac] of [['mid', 0.35], ['low', 0.7]]) {
          // Each pass from a fresh page (feature pages' rows open independently).
          await pg.goto(`${baseUrl}${route}`, { waitUntil: 'load' });
          await pg.addStyleTag({ content: 'html, body { overflow-anchor: none !important; }' });
          for (const [n, id] of ids.entries()) {
            const open = await pg.evaluate((id) => document.getElementById(id).getAttribute('aria-expanded') === 'true', id);
            if (n === 0) {
              if (!open) { await pg.evaluate((id) => document.getElementById(id).click(), id); await pg.waitForTimeout(600); }
              continue;
            }
            await pg.evaluate(([id, frac]) => {
              const r = document.getElementById(id).getBoundingClientRect();
              window.scrollTo({ top: r.top + window.scrollY - innerHeight * frac, behavior: 'instant' });
            }, [id, frac]);
            await pg.waitForTimeout(250);
            // Sample every frame from the tap on (the tap's own click starts the clock).
            await pg.evaluate((id) => {
              const el = document.getElementById(id);
              const w = window;
              w.__acc = { before: el.getBoundingClientRect().top, samples: [] };
              el.addEventListener('click', () => {
                const t0 = performance.now();
                w.__acc.samples.push([0, el.getBoundingClientRect().top]);
                const tick = () => {
                  const t = performance.now() - t0;
                  w.__acc.samples.push([t, el.getBoundingClientRect().top]);
                  if (t < 560) requestAnimationFrame(tick);
                };
                requestAnimationFrame(tick);
              }, { once: true, capture: false });
            }, id);
            await pg.tap(`#${id}`);
            await pg.waitForTimeout(700);
            const r = await pg.evaluate((id) => ({ ...window.__acc, open: document.getElementById(id).getAttribute('aria-expanded'), vh: innerHeight }), id);
            const at = (ms) => (r.samples.find(([t]) => t >= ms) || r.samples.at(-1))[1];
            const marks = [0, 50, 150, 300, 500].map((ms) => Math.round(at(ms)));
            let rev = 0, dir = 0, prev = r.before;
            for (const [, y] of r.samples) { const d = y - prev; if (Math.abs(d) > 0.5) { const sgn = Math.sign(d); if (dir && sgn !== dir) rev++; dir = sgn; } prev = y; }
            const end = at(500);
            const still = r.samples.every(([, y]) => Math.abs(y - r.before) <= 1);
            const ok = r.open === 'true' && rev === 0 && end >= 0 && end < r.vh && (where === 'mid' ? still : r.samples[0][1] - r.before <= 1);
            if (!ok) bad.push(`${where} row ${n + 1}: before ${Math.round(r.before)}, at 0/50/150/300/500ms ${marks.join('/')}, reversals ${rev}, open ${r.open}`);
          }
        }
        if (bad.length) failures.push(`Accordion switching on ${route} at ${w}x${h}: ${bad.join('; ')}`);
        else passedChecks.push(`Accordion switching on ${route} at ${w}x${h}: rows 01 to 05 in turn, the tapped header holds still (mid-screen) or rises one way into view (low), never back and forth`);
        await ctx.close();
      }
    }

    // Tab switchers keep one height: every panel shares one grid cell, so
    // switching tabs never moves the page below (/ai's examples moved it by
    // up to 265px, the homepage's data map by up to 43px on a phone).
    console.log('\n--- 19c. Testing Tab Switchers Keep Their Height ---');
    for (const [w, h] of [[1024, 768], [390, 844]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const pg = await ctx.newPage();
      const moved = [];
      for (const route of ['/', '/ai/']) {
        await pg.goto(`${baseUrl}${route}`, { waitUntil: 'load' });
        await pg.evaluate(() => document.querySelectorAll('[data-accordion-row]').forEach((row) => {
          row.classList.add('is-expanded', 'is-settled');
          const body = row.querySelector('.accordion-body');
          if (body) body.inert = false;
        }));
        for (const list of await pg.$$('[role="tablist"]')) {
          const heights = [];
          for (const tab of await list.$$('[role="tab"]')) {
            if (!(await tab.isVisible())) continue;
            await tab.click();
            await pg.waitForTimeout(150);
            heights.push(await pg.evaluate(() => document.documentElement.scrollHeight));
          }
          if (new Set(heights).size > 1) moved.push(`${route} [${await list.getAttribute('aria-label')}] ${heights.join('/')}`);
        }
      }
      if (moved.length) failures.push(`Tab switchers change the page height at ${w}px: ${moved.join('; ')}`);
      else passedChecks.push(`Tab switchers at ${w}px: switching tabs never changes the page's height (homepage data map, /ai examples)`);
      await ctx.close();
    }

    // -------------------------------------------------------------
    // TEST SUITE 17: Phone menu is top level; sections live in the pane
    // -------------------------------------------------------------
    // The phone menu lists the five sections and fits the screen without
    // scrolling. A page's own sections are in the side pane, titled with
    // the page's name; picking an entry opens that accordion row.
    console.log('\n--- 17. Testing Phone Menu and Side Pane ---');
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
      const pg = await ctx.newPage();
      await pg.goto(`${baseUrl}/features/library/`, { waitUntil: 'load' });
      await pg.click('.menu-btn');
      await pg.waitForTimeout(300);
      const menu = await pg.evaluate(() => {
        const m = document.querySelector('#mobile-menu');
        return {
          top: m.querySelectorAll('.mobile-main-link').length,
          sub: m.querySelectorAll('.mobile-sub-list, .mobile-sub-link').length,
          scrolls: m.scrollHeight > m.clientHeight + 1,
        };
      });
      if (menu.top !== 5 || menu.sub || menu.scrolls) failures.push(`Phone menu: ${menu.top} top-level links, ${menu.sub} sub-links, scrolls ${menu.scrolls}`);
      else passedChecks.push('Phone menu: the 5 sections only, no sub-lists, fits the screen without scrolling');
      await pg.click('.menu-btn');
      await pg.waitForTimeout(200);
      const pane = await pg.evaluate(() => {
        const n = document.querySelector('[data-page-nav]');
        return { hidden: n.hidden, name: n.getAttribute('aria-label'), entries: [...n.querySelectorAll('.pn-label')].map((l) => l.textContent) };
      });
      await pg.click('[data-pn-handle]');
      await pg.waitForTimeout(300);
      await pg.click('[data-pn-link="transcripts"]');
      await pg.waitForTimeout(600);
      const opened = await pg.getAttribute('#transcripts-header', 'aria-expanded');
      const top = await pg.evaluate(() => document.getElementById('transcripts').getBoundingClientRect().top);
      if (pane.hidden || pane.name !== 'Library and Player' || !pane.entries.includes('Transcripts') || opened !== 'true' || top < 0 || top > 300) {
        failures.push(`Side pane on /features/library: ${JSON.stringify({ ...pane, opened, top: Math.round(top) })}`);
      } else passedChecks.push(`Side pane: titled "${pane.name}", ${pane.entries.length} entries; picking Transcripts opens its row and scrolls to it`);
      await ctx.close();
    }

    // A phone on its side is the same phone: the Menu button (not the
    // desktop links, whose menus open on hover; a Pro Max on its side is 932
    // wide), the section button in the corner (not a tab on the left edge,
    // over the headlines), and headlines sized for the short screen.
    for (const [w, h] of [[844, 390], [932, 430]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
      const pg = await ctx.newPage();
      const wrong = [];
      for (const route of ['/', '/features/library/', '/pricing/', '/support/']) {
        await pg.goto(`${baseUrl}${route}`, { waitUntil: 'load' });
        const r = await pg.evaluate(() => {
          const shown = (el) => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
          const pn = document.querySelector('.page-nav');
          const pr = pn && !pn.hidden ? pn.getBoundingClientRect() : null;
          return {
            menu: shown(document.querySelector('.menu-btn')),
            links: shown(document.querySelector('.desktop-nav')),
            corner: pr ? pr.top > innerHeight * 0.6 && pr.width <= 46 : true,
            h1: parseFloat(getComputedStyle(document.querySelector('h1')).fontSize) <= innerHeight * 0.14,
          };
        });
        if (!r.menu || r.links || !r.corner || !r.h1) wrong.push(`${route} ${JSON.stringify(r)}`);
      }
      if (wrong.length) failures.push(`Phone on its side (${w} x ${h}): ${wrong.join('; ')}`);
      else passedChecks.push(`Phone on its side (${w} x ${h}): Menu button, section button in the corner, headlines sized to the short screen, as upright`);
      await ctx.close();
    }

    // -------------------------------------------------------------
    // TEST SUITE 18: The hero (layered depth, Download in the first screen)
    // -------------------------------------------------------------
    console.log('\n--- 18. Testing the Hero ---');
    for (const [w, h] of [[1440, 900], [1280, 800]]) {
      const c = await browser.newContext({ viewport: { width: w, height: h } });
      const p2 = await c.newPage();
      await p2.goto(`${baseUrl}/`, { waitUntil: 'load' });
      await p2.waitForTimeout(1600);
      const r = await p2.evaluate(() => {
        const btn = document.querySelector('.hero .btn-primary');
        const b = btn.getBoundingClientRect();
        const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        const tf = (sel) => getComputedStyle(document.querySelector(sel)).transform;
        return { bottom: Math.round(b.bottom), inView: b.bottom <= window.innerHeight, hits: btn.contains(hit), detail: tf('.detail--ready'), product: tf('.product-settle') };
      });
      await p2.evaluate(() => window.scrollTo(0, 500));
      await p2.waitForTimeout(500);
      const moved = await p2.evaluate(() => [getComputedStyle(document.querySelector('.detail--ready')).transform, getComputedStyle(document.querySelector('.product-settle')).transform]);
      if (!r.inView || !r.hits) failures.push(`Hero at ${w}px: Download button bottom ${r.bottom}px of ${h}, clickable ${r.hits}`);
      else passedChecks.push(`Hero at ${w}x${h}: Download for Mac is in the first screen and nothing covers it`);
      if (moved[0] === r.detail || moved[1] === r.product) failures.push(`Hero at ${w}px: the layers didn't move with the scroll (${r.detail} -> ${moved[0]})`);
      else passedChecks.push(`Hero at ${w}px: the preview and its details move at their own speeds as the page scrolls`);
      await c.close();
    }
    {
      const c = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
      const p2 = await c.newPage();
      await p2.goto(`${baseUrl}/`, { waitUntil: 'load' });
      await p2.evaluate(() => window.scrollTo(0, 500));
      await p2.waitForTimeout(300);
      const still = await p2.evaluate(() => ['.detail--ready', '.product-settle', '.hero-light'].map((s) => getComputedStyle(document.querySelector(s)).transform));
      if (still.some((t) => t !== 'none')) failures.push(`Hero with reduced motion still moves: ${still.join(' | ')}`);
      else passedChecks.push('Hero with reduced motion: every layer at rest, details shown in place');
      await c.close();
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
