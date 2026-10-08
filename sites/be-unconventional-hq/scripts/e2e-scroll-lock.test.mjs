/**
 * E2E: the global scroll lock.
 *
 * ─── WHAT THIS GUARDS ─────────────────────────────────────────────────────
 * Opening a video modal and closing it must leave the reader on EXACTLY the
 * pixel they started on. The bug this was written for: `closeModal()` unpinned
 * the body and then restored the offset inside a double requestAnimationFrame,
 * so for ~32ms the page painted at the wrong position — a visible jump — and
 * `focus()` on the trigger card scrolled it into view, so where you landed
 * depended on which video you had tapped.
 *
 * A unit test cannot catch this: the final scroll position was often correct.
 * What was wrong was the position DURING the close, and which element had
 * scrolled itself into view. So this measures both.
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
  '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

if (!fs.existsSync(dist)) {
  console.error('[scroll-lock] No build found. Run `npm run build` first.');
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

console.log('e2e-scroll-lock.test.mjs');

const browser = await launchTestBrowser();

try {
  for (const [label, width, height] of [['mobile', 390, 844], ['desktop', 1440, 900]]) {
    const page = await browser.newPage();
    await page.setViewport({ width, height });

    // Use a hash fragment so Hero.astro's shouldArm() returns false,
    // preventing the splash screen from locking scrolling and breaking the test.
    await page.goto(`http://localhost:${port}/#e2e`, { waitUntil: 'networkidle0' });

    const trigger = await page.$('[data-action="open-video"]');
    if (!trigger) {
      console.log(`  – ${label}: no video trigger on the homepage; nothing to assert`);
      await page.close();
      continue;
    }

    // Scroll well down the page — the bug is invisible at offset 0, because
    // "jump to the top" and "stay put" look identical there.
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, 1200);
    });
    await new Promise((r) => setTimeout(r, 250));
    const before = await page.evaluate(() => Math.round(window.scrollY));
    ok(`${label}: scrolled away from the top to set up the test`, before > 400, `got ${before}`);

    const widthBefore = await page.evaluate(() => document.documentElement.clientWidth);

    // Open.
    await page.evaluate(() => {
      document.querySelector('[data-action="open-video"]').click();
    });
    await new Promise((r) => setTimeout(r, 400));

    const open = await page.evaluate(() => ({
      active: document.getElementById('video-modal')?.classList.contains('active'),
      locked: document.documentElement.classList.contains('modal-open'),
      bodyTop: document.body.style.top,
      clientWidth: document.documentElement.clientWidth,
    }));

    ok(`${label}: modal opens`, open.active === true);
    ok(`${label}: page is locked`, open.locked === true);
    /*
      The offset is the whole mechanism. `position: fixed` with no `top` snaps
      the page to 0 — which is what the background did before this was fixed.
    */
    ok(
      `${label}: body carries the scroll offset while locked`,
      open.bodyTop === `-${before}px`,
      `expected -${before}px, got "${open.bodyTop}"`,
    );
    /* Scrollbar gutter: locking must not change the usable width. */
    ok(
      `${label}: content width unchanged by locking (no sideways shift)`,
      open.clientWidth === widthBefore,
      `${widthBefore} → ${open.clientWidth}`,
    );

    /*
      Sample the scroll position on EVERY animation frame across the close.
      The old implementation restored two frames late, so intermediate frames
      sat at the wrong offset even though the final value was right. Checking
      only the end state would have passed against the bug.
    */
    await page.evaluate(() => {
      window.__scrollSamples = [];
      let frames = 0;
      const sample = () => {
        window.__scrollSamples.push(Math.round(window.scrollY));
        if ((frames += 1) < 30) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
      document.querySelector('#video-modal .modal-close').click();
    });
    await new Promise((r) => setTimeout(r, 700));

    const after = await page.evaluate(() => ({
      scrollY: Math.round(window.scrollY),
      samples: window.__scrollSamples,
      locked: document.documentElement.classList.contains('modal-open'),
      bodyPosition: document.body.style.position,
      bodyTop: document.body.style.top,
    }));

    ok(`${label}: lock released on close`, after.locked === false);
    ok(
      `${label}: body styles fully cleared`,
      after.bodyPosition === '' && after.bodyTop === '',
      `position="${after.bodyPosition}" top="${after.bodyTop}"`,
    );
    ok(
      `${label}: lands on the exact starting offset`,
      Math.abs(after.scrollY - before) <= 2,
      `expected ~${before}, got ${after.scrollY}`,
    );

    /* No frame during the close may be more than a couple of pixels away from
       where the reader was. This is the assertion that actually encodes
       "no visible jump". */
    const worst = after.samples.reduce(
      (max, y) => Math.max(max, Math.abs(y - before)),
      0,
    );
    ok(
      `${label}: no intermediate frame jumps (worst drift ${worst}px)`,
      worst <= 2,
      `sampled ${after.samples.length} frames, worst ${worst}px from ${before}`,
    );

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
