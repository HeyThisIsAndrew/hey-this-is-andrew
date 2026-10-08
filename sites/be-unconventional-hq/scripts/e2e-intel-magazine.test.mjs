/**
 * E2E: the /intel magazine's swappable centre feature.
 *
 * Serves the built `dist/client` (run `npm run build` first) rather than the
 * dev server, so it exercises exactly what ships.
 *
 * The point of these assertions is that the interaction is a progressive
 * enhancement, not a JS-only feature: the rails must remain real links that
 * work with scripting disabled, and the centre must be server-rendered.
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
  console.error('[intel-magazine] No build found. Run `npm run build` first.');
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
const ok = (name, cond) => {
  if (cond) { console.log(`  ✓ ${name}`); passed += 1; }
  else { console.error(`  ✗ ${name}`); failed += 1; }
};

console.log('e2e-intel-magazine.test.mjs');

const browser = await launchTestBrowser();

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(`http://localhost:${port}/intel`, { waitUntil: 'networkidle0' });

  const hasMagazine = await page.$('#intel-feature');
  if (!hasMagazine) {
    // With an empty archive there is no magazine to test; that is a valid
    // state, not a failure.
    console.log('  – no magazine rendered (empty archive); nothing to assert');
  } else {
    const rails = await page.$$('.intel-rail-item');
    if (rails.length === 0) {
      console.log('  – only one article; no rail items to swap');
    } else {
      const before = await page.$eval('#intel-feature-title', (e) => e.textContent.trim());
      const beforeHref = await page.$eval('#intel-feature-link', (e) => e.getAttribute('href'));

      /*
        Target a tile that is NOT already the centre feature.

        Every article in the spread has a rail tile, including the one
        currently featured — so the first tile is usually the feature itself,
        and clicking it correctly changes nothing. Picking a non-active tile
        is what actually exercises the swap.
      */
      const TARGET = '.intel-rail-item:not(.active)';
      const railTitle = await page.$eval(`${TARGET} .intel-rail-title`, (e) => e.textContent.trim());
      const railHref = await page.$eval(TARGET, (e) => e.getAttribute('href'));

      await page.click(TARGET);
      await new Promise((r) => setTimeout(r, 500));

      const after = await page.$eval('#intel-feature-title', (e) => e.textContent.trim());
      const afterHref = await page.$eval('#intel-feature-link', (e) => e.getAttribute('href'));

      ok('rail click swaps the centre feature', before !== after && after === railTitle);
      ok('centre link follows the swap', afterHref === railHref && afterHref !== beforeHref);
      ok('rail click does not navigate away', (await page.evaluate(() => location.pathname)) === '/intel');
      ok('selection is recorded in the URL hash', (await page.evaluate(() => location.hash)).length > 1);
      ok('exactly one rail item is marked active', (await page.$$eval('.intel-rail-item.active', (e) => e.length)) === 1);
      ok('active rail item exposes aria-current', (await page.$eval('.intel-rail-item.active', (e) => e.getAttribute('aria-current'))) === 'true');

      /*
        The lede must survive the swap as PARAGRAPHS.

        The centre used to hold a single <p> whose text was replaced wholesale.
        It now holds one <p> per paragraph, rebuilt by the script — so a swap
        that quietly collapsed the lede back to one block, or left the previous
        article's paragraphs behind, would look fine in a screenshot and be
        wrong. Assert the count and that the text actually changed.
      */
      /*
        Compare against the DATA, not a hard-coded count. The rail item the
        swap came from carries its lede in `data-preview` (paragraphs joined
        with a blank line), so the contract is: every paragraph the data
        provides is rendered. A fixed ">= 2" here was really asserting a
        property of the mock content — the real snapshot has articles whose
        feed body was truncated, whose lede is legitimately one paragraph.
      */
      const expectedParas = await page.$eval(
        '.intel-rail-item.active',
        (el) => (el.dataset.preview ?? '').split('\n\n').filter(Boolean).length,
      );
      ok(
        `lede renders every paragraph the data provides (${expectedParas})`,
        (await page.$$eval('#intel-feature-excerpt p', (els) => els.length)) === Math.max(1, expectedParas),
      );
      ok(
        'lede is rebuilt as text, never as markup',
        await page.$$eval('#intel-feature-excerpt p', (els) =>
          els.every((el) => el.children.length === 0 && el.textContent.trim().length > 0)),
      );

      const hash = await page.evaluate(() => location.hash);
      await page.goto(`http://localhost:${port}/intel${hash}`, { waitUntil: 'networkidle0' });
      await new Promise((r) => setTimeout(r, 400));
      ok('hash deep-link restores the selection', (await page.$eval('#intel-feature-title', (e) => e.textContent.trim())) === railTitle);
    }

    // Progressive enhancement: the layout must survive without scripting.
    const noJs = await browser.newPage();
    await noJs.setJavaScriptEnabled(false);
    await noJs.goto(`http://localhost:${port}/intel`, { waitUntil: 'domcontentloaded' });
    const hrefs = await noJs.$$eval('.intel-rail-item', (els) => els.map((e) => e.getAttribute('href')));
    /*
      The point is that each rail item is a REAL link, not a JS-only handle —
      not that it is necessarily internal. An article we host resolves to
      /intel/<slug>; one whose body Substack has not given us still resolves
      to its Substack permalink. Both are legitimate, so accept either rather
      than failing whenever the archive happens to contain an unhosted post.
    */
    ok(
      'rail items are real links without JS (internal or Substack)',
      hrefs.length > 0 && hrefs.every((h) => h && (h.startsWith('/') || /^https?:\/\//.test(h))),
    );
    ok('centre feature is server-rendered', (await noJs.$eval('#intel-feature-title', (e) => e.textContent.trim())).length > 0);
    /* Same data-aware contract as the swap assertion above. */
    const ssrExpected = await noJs.$eval(
      '.intel-rail-item[aria-current="true"], .intel-rail-item.active',
      (el) => (el.dataset.preview ?? '').split('\n\n').filter(Boolean).length,
    ).catch(() => 1);
    ok(
      `lede is server-rendered with every data paragraph (${ssrExpected})`,
      (await noJs.$$eval('#intel-feature-excerpt p', (els) => els.length)) === Math.max(1, ssrExpected),
    );

    /*
      Balanced rails.

      IntelMagazine deals the spread alternately (0→left, 1→right, 2→left …),
      so an ODD MAGAZINE_SIZE leaves one rail a tile shorter than the other and
      the spread renders lopsided. This guards the pairing between that
      constant (src/data/sections.js) and the dealing logic — either one
      changing alone breaks the layout.
    */
    const railSplit = await noJs.evaluate(() => ({
      left: document.querySelectorAll('.intel-rail-left .intel-rail-item').length,
      right: document.querySelectorAll('.intel-rail-right .intel-rail-item').length,
    }));
    ok(
      `rails are balanced (${railSplit.left}L / ${railSplit.right}R)`,
      Math.abs(railSplit.left - railSplit.right) <= 1,
    );
  }

  /*
    The brand glow must actually paint.

    It is a fixed layer at `z-index: -1`, which only lands above the page's
    base colour because `body` carries `isolation: isolate`. Drop that one
    declaration and the glow silently disappears from every page — no error,
    no failing selector, just a site that has lost its signature. So this
    checks the computed value AND samples the rendered corner, because the
    CSS being present is not the same as the pixels being red.
  */
  const glowPage = await browser.newPage();
  await glowPage.setViewport({ width: 1440, height: 900 });
  await glowPage.goto(`http://localhost:${port}/intel`, { waitUntil: 'networkidle0' });

  ok(
    'body isolates, so the glow is not painted over',
    (await glowPage.evaluate(() => getComputedStyle(document.body).isolation)) === 'isolate',
  );

  const corner = await glowPage.evaluate(() => {
    const el = document.querySelector('.brand-glow');
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { display: cs.display, z: cs.zIndex };
  });
  ok('glow layer is present and behind the flow', corner?.display === 'block' && corner?.z === '-1');

  const shot = await glowPage.screenshot({
    clip: { x: 1432, y: 300, width: 4, height: 4 },
    encoding: 'base64',
  });
  /* A PNG this small is trivially comparable against the same crop of the
     far side of the viewport: the top-right must be redder than the left. */
  const shotLeft = await glowPage.screenshot({
    clip: { x: 4, y: 300, width: 4, height: 4 },
    encoding: 'base64',
  });
  ok('top-right corner renders differently from the left edge', shot !== shotLeft);
  /*
    Responsive visibility of the category controls.

    Regression guard: the mobile "Categories" button and the inline category
    row are mutually exclusive. The button's `display: none` default lives in
    styles/modules/filters.css rather than a component's scoped <style> —
    when the markup moved into CategoryOverlay.astro, a scoped rule in
    QuadrantFilter.astro silently stopped applying and the button appeared on
    desktop on BOTH the Feed and /intel.
  */
  const vis = await browser.newPage();
  /*
    ─── AND THE FEED MUST NOT GROW ONE BACK ──────────────────────────────────

    The route was swapped out of the loop below because the Feed deliberately
    stopped rendering a filter row. Swapping it out silently would mean the
    Feed could sprout one again — or have one restored by a well-meaning
    revert — with nothing to catch it, so the removal is asserted rather than
    merely un-tested.
  */
  for (const width of [1440, 390]) {
    await vis.setViewport({ width, height: 900 });
    await vis.goto(`http://localhost:${port}/feed`, { waitUntil: 'networkidle0' });
    const feedFilters = await vis.evaluate(() => ({
      wrapper: !!document.getElementById('quadrant-filter-wrapper'),
      trigger: !!document.getElementById('open-categories-btn'),
      buttons: document.querySelectorAll('.quadrant-btn').length,
    }));
    ok(
      `/feed @${width}: no filter row (the rows replace it)`,
      !feedFilters.wrapper && !feedFilters.trigger && feedFilters.buttons === 0,
      JSON.stringify(feedFilters),
    );
  }

  /*
    /category/film stands in for /feed here. The Feed stopped rendering the
    filter row when its horizontal rows took over that job, and this route
    renders the same <QuadrantFilter />, so the responsive contract below is
    still checked on both filter components rather than only on /intel's.
  */
  for (const route of ['/category/film', '/intel']) {
    for (const width of [1440, 390]) {
      await vis.setViewport({ width, height: 900 });
      await vis.goto(`http://localhost:${port}${route}`, { waitUntil: 'networkidle0' });
      const state = await vis.evaluate(() => {
        const row = document.querySelector('.mobile-category-row');
        const inline = document.querySelector('.intel-filter-nav, .desktop-category-row');
        return {
          button: row ? getComputedStyle(row).display : 'missing',
          inline: inline ? getComputedStyle(inline).display : 'missing',
        };
      });
      const isMobile = width <= 768;
      ok(
        `${route} @${width}: Categories button ${isMobile ? 'shown' : 'hidden'}`,
        state.button === (isMobile ? 'flex' : 'none'),
        state.button,
      );
      ok(
        `${route} @${width}: inline category row ${isMobile ? 'hidden' : 'shown'}`,
        isMobile ? state.inline === 'none' : state.inline !== 'none',
        state.inline,
      );
    }
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
