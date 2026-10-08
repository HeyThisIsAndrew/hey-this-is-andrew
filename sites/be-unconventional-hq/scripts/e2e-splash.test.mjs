/**
 * E2E: the homepage splash / curtain reveal.
 *
 * ─── WHAT THIS PROTECTS ───────────────────────────────────────────────────
 * The curtain is the hero itself, lifted by a transform on #app-wrapper and
 * then swapped for a real scroll offset. Two things can go wrong invisibly:
 *
 *   1. The swap at the end leaves the page at the wrong scroll offset, or
 *      leaves a stray transform on the wrapper — the page looks fine until
 *      you scroll and everything is shifted.
 *   2. The splash arms somewhere it shouldn't (an interior page, a deep link)
 *      and hides the navbar on a page with no curtain to lift, which would
 *      strand the reader with no navigation at all.
 *
 * Both end states look plausible in a screenshot, so they are measured here.
 *
 * ─── THE SPLASH IS GONE (feat/homepage-v4) ────────────────────────────────
 * The homepage no longer mounts Hero.astro, and the curtain went with it:
 * a decision Andrew approved, not a regression. Every assertion about the
 * lift itself (its travel, its easing, the CTA, re-arming at the top) was
 * about a feature that no longer ships, so it had nothing left to measure.
 * What this suite protected ALL ALONG, failure 2 above, still applies to
 * every page and is what it asserts now: nothing arms a splash anywhere, so
 * no page ever opens with the navbar hidden, the document locked, or a
 * stray transform on #app-wrapper; and the overlay round trip that once
 * armed it by accident (menu open -> close) leaves a working page.
 *
 * Serves the built `dist/client`, so it exercises exactly what ships.
 */
import { launchTestBrowser } from './e2e-browser.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const dist = path.join(process.cwd(), 'dist', 'client');
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif',
  '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
};

if (!fs.existsSync(dist)) {
  console.error('[splash] No build found. Run `npm run build` first.');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  for (const c of [path.join(dist, p), path.join(dist, p, 'index.html'), path.join(dist, `${p}.html`)]) {
    if (c.startsWith(dist) && fs.existsSync(c) && fs.statSync(c).isFile()) {
      res.writeHead(200, { 'Content-Type': MIME[path.extname(c)] ?? 'application/octet-stream' });
      fs.createReadStream(c).pipe(res);
      return;
    }
  }
  res.writeHead(404);
  res.end();
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

let failed = 0;
let passed = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { console.log(`  ✓ ${name}`); passed += 1; }
  else { console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); failed += 1; }
};

console.log('e2e-splash.test.mjs');

const browser = await launchTestBrowser();

const state = (page) =>
  page.evaluate(() => ({
    armed: document.documentElement.classList.contains('splash-armed'),
    lifting: document.documentElement.classList.contains('splash-lifting'),
    navVisible: getComputedStyle(document.getElementById('navbar')).visibility,
    overflow: getComputedStyle(document.documentElement).overflow,
    transform: getComputedStyle(document.getElementById('app-wrapper')).transform,
    scrollY: Math.round(window.scrollY),
  }));
const noTransform = (t) => t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)';

try {
  // ── No page arms a splash; none strands the reader ────────────────────
  for (const [label, width, height] of [['mobile', 390, 844], ['desktop', 1440, 900]]) {
    for (const route of ['/', '/#hq-content', '/feed/', '/intel/', '/events/']) {
      const page = await browser.newPage();
      await page.setViewport({ width, height });
      await page.goto(`http://localhost:${port}${route}`, { waitUntil: 'networkidle0' });
      await new Promise((r) => setTimeout(r, 400));
      const s = await state(page);
      ok(`${label} ${route}: no splash armed`, s.armed === false && s.lifting === false);
      ok(`${label} ${route}: navbar visible`, s.navVisible === 'visible', s.navVisible);
      ok(`${label} ${route}: document not locked`, s.overflow !== 'hidden', s.overflow);
      ok(`${label} ${route}: no stray wrapper transform`, noTransform(s.transform), s.transform);
      await page.close();
    }
  }

  // ── The homepage scrolls, and the top never re-arms anything ──────────
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 400));
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 900); });
    await new Promise((r) => setTimeout(r, 300));
    const down = await state(page);
    ok('homepage: a plain scroll moves the page', down.scrollY >= 850, String(down.scrollY));
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise((r) => setTimeout(r, 900));
    const top = await state(page);
    ok('homepage: returning to the top arms nothing', top.armed === false && top.navVisible === 'visible', JSON.stringify(top));
    await page.close();
  }

  // ── The overlay round trip leaves a working page ──────────────────────
  /*
    The trap this guarded: an overlay pins <body> via the shared scroll lock,
    a pinned body reads scrollY 0, and the splash read that as "reader at the
    top" and armed, hiding the navbar the open menu lives inside. The splash
    is gone, but the lock is not, so the round trip is still asserted.
  */
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 400));
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 1200); });
    await new Promise((r) => setTimeout(r, 300));

    await page.waitForSelector('.nav-toggle', { timeout: 5000 });
    await page.click('.nav-toggle');
    await new Promise((r) => setTimeout(r, 500));
    const open = await page.evaluate(() => ({
      armed: document.documentElement.classList.contains('splash-armed'),
      navVisible: getComputedStyle(document.getElementById('navbar')).visibility,
      menuOpen: document.getElementById('navbar').classList.contains('menu-open'),
    }));
    ok('overlay: the menu opens visibly and arms nothing', open.menuOpen && open.navVisible === 'visible' && !open.armed, JSON.stringify(open));

    await page.click('.nav-toggle');
    await new Promise((r) => setTimeout(r, 500));
    const closed = await page.evaluate(() => ({
      scrollY: Math.round(window.scrollY),
      bodyPinned: document.body.style.position === 'fixed',
      overflow: getComputedStyle(document.documentElement).overflow,
    }));
    ok('overlay: closing the menu restores the page where it was', closed.scrollY > 1000 && !closed.bodyPinned && closed.overflow !== 'hidden', JSON.stringify(closed));
    await page.evaluate(() => window.scrollBy(0, 300));
    await new Promise((r) => setTimeout(r, 200));
    ok('overlay: scrolling works after the round trip', (await page.evaluate(() => Math.round(window.scrollY))) > 1300);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (failed > 0) {
  console.error(`\n${failed} test(s) FAILED, ${passed} passed.`);
  process.exit(1);
}
console.log(`All ${passed} tests passed.`);
