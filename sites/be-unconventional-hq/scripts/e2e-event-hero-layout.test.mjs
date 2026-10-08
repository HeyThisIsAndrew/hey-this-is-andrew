/*
  THE EVENT AND HUB HEROES, MEASURED AS RENDERED.

  THE REPORT (production, 2026-10)
  Every event without a `trailerUrl` lost the two-column hero. LA Comic Con,
  the four PAX pages, SDCC 2027 and TwitchCon rendered one 1358px column at
  1512x982: the copy, then the stage, then the rail orphaned under it, and LA
  Comic Con's stage auto-selected its only coverage pane into a card the
  width of the screen. At 2xl the same seven got two columns back, but from a
  Tailwind utility that set widths and no areas, so the CTA auto-placed into
  the right column.

  WHY A SOURCE TEST DID NOT CATCH IT
  The grid class was `.has-trailer`, keyed on `trailerId`. The stage behind it
  had since become unconditional (it rests on the key art without a
  trailer), so the class and the thing it laid out stopped agreeing. Every
  source assertion about the CSS was true. Only the rendered page, on an
  event with no trailer, was wrong, and every event someone looked at while
  working on the hero had one.

  So this renders EVERY built /events/<slug>/ and /featured/<slug>/, at the
  widths the report measured, and asserts the layout the design intends:

    1. `.has-stage` on the grid if and only if the stage is in the DOM.
    2. Two columns with grid areas, the stage in the right one.
    3. No visible stage pane unless it is the selected one, and on a stage
       with no trailer nothing is selected until the reader picks a tile.
    4. No `.is-item` on a stage whose rail has no items to show.
    5. The rail in the LEFT column, under the copy.
    6. The CTA under the logo, in the left column.
    7. No horizontal overflow.
    8. The logo inside its own column.
    9. FIRST PAINT: all of the above with JavaScript off, and the scripts
       move none of the copy, stage, rail or CTA to another column or width.

  External images are answered locally with an SVG of the asset's own aspect
  ratio (a Sanity ref carries `-<W>x<H>-` in its name), so the layout sees
  real shapes, including LA Comic Con's 2.35:1 key art, with no network and
  no dependence on a CDN being up. YouTube never loads, which is also what a
  reader with a blocked embed gets.
*/
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchTestBrowser } from './e2e-browser.mjs';
import { startPreviewServer } from './e2e-server.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist/client');
const BASE = 'http://localhost:4321';
/* 1512x982 is the report's MacBook. 1600 is past Tailwind's 2xl (1536), where
   the wide ratio applies and where the areas-less grid used to take over. */
const VIEWPORTS = [
  { width: 1512, height: 982, deviceScaleFactor: 1 },
  { width: 1600, height: 1000, deviceScaleFactor: 1 },
];
/* Past the hero's entrance animations (the stage starts at 0.2s). */
const SETTLE_MS = 1500;
/* Pages checked at once. */
const CONCURRENCY = 4;
/* Sub-pixel rounding between two layouts of the same page. */
const TOLERANCE = 2;

function builtRoutes(dir) {
  const base = path.join(DIST, dir);
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== 'archive' && fs.existsSync(path.join(base, d.name, 'index.html')))
    .map((d) => `/${dir}/${d.name}/`)
    .sort();
}

function svgFor(url) {
  const dims = /-(\d{2,5})x(\d{2,5})[-.]/.exec(decodeURIComponent(url));
  const [w, h] = dims ? [Number(dims[1]), Number(dims[2])] : [1280, 720];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#4a3a2a"/></svg>`;
}

async function stubExternal(page) {
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const url = request.url();
    if (url.startsWith(BASE) || url.startsWith('data:') || url === 'about:blank') return request.continue();
    if (request.resourceType() === 'image') {
      return request.respond({ status: 200, contentType: 'image/svg+xml', body: svgFor(url) });
    }
    return request.respond({ status: 204, body: '' });
  });
}

/* Everything the assertions need, read in one pass. */
const measure = () => {
  const q = (s) => document.querySelector(s);
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return null;
    return { left: r.left, right: r.right, top: r.top + scrollY, bottom: r.bottom + scrollY, width: r.width };
  };
  const grid = q('.hero-grid-container');
  const stage = grid?.querySelector('.hub-stage') ?? null;
  const cs = grid ? getComputedStyle(grid) : null;
  const visiblePanes = stage
    ? [...stage.querySelectorAll('.hub-stage-item')].filter((p) => {
        const s = getComputedStyle(p);
        return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.01;
      })
    : [];
  return {
    hasGrid: !!grid,
    hasStageClass: !!grid?.classList.contains('has-stage'),
    stageInDom: !!stage,
    stageTrailer: !!stage?.dataset.trailer,
    columns: cs ? cs.gridTemplateColumns.split(' ').filter(Boolean).length : 0,
    areas: cs?.gridTemplateAreas ?? 'none',
    isItem: !!stage?.classList.contains('is-item'),
    activePanes: stage ? stage.querySelectorAll('.hub-stage-item.active').length : 0,
    visibleUnselected: visiblePanes.filter((p) => !p.classList.contains('active')).length,
    railItems: document.querySelectorAll('.hub-rail-card').length,
    copy: box(q('.hero-copy')),
    stage: box(stage),
    rail: box(q('.hub-rail')),
    cta: box(q('.hero-info-cta')),
    logo: box(q('.hero-logo')),
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
};

async function render(browser, route, viewport, { javaScript }) {
  const page = await browser.newPage();
  try {
    await page.setJavaScriptEnabled(javaScript);
    await page.setViewport(viewport);
    await stubExternal(page);
    await page.goto(BASE + route, { waitUntil: 'load', timeout: 60000 });
    await new Promise((r) => setTimeout(r, SETTLE_MS));
    return await page.evaluate(measure);
  } finally {
    await page.close();
  }
}

function assertLayout(m, where) {
  assert.ok(m.hasGrid, `${where}: no .hero-grid-container rendered`);

  assert.equal(m.hasStageClass, m.stageInDom,
    `${where}: .has-stage is ${m.hasStageClass ? 'set' : 'missing'} but the stage is ` +
      `${m.stageInDom ? '' : 'NOT '}in the DOM. The grid's two-column areas must follow ` +
      'the stage, never the trailer: keying them on trailerId is what stacked every event ' +
      'without one.');
  if (!m.stageInDom) return;

  assert.equal(m.columns, 2, `${where}: the hero is ${m.columns} column(s), expected copy | stage`);
  assert.notEqual(m.areas, 'none',
    `${where}: two columns with no grid areas. That is a width utility auto-placing the ` +
      'rail and CTA wherever they fall, the 2xl half of the original bug.');

  assert.equal(m.visibleUnselected, 0,
    `${where}: ${m.visibleUnselected} stage pane(s) visible without being selected`);
  if (!m.stageTrailer) {
    assert.equal(m.activePanes, 0,
      `${where}: a stage with no trailer selected a pane on its own. It rests on the key ` +
        'art until the reader picks a tile; auto-selecting is what put one giant coverage ' +
        'card in LA Comic Con\'s hero.');
  }
  if (m.railItems === 0) {
    assert.equal(m.isItem, false, `${where}: .is-item on a stage whose rail has nothing in it`);
  }

  assert.ok(m.copy && m.stage, `${where}: copy or stage has no box`);
  assert.ok(m.copy.right <= m.stage.left + TOLERANCE,
    `${where}: the copy (right ${m.copy.right}) runs into the stage (left ${m.stage.left})`);

  if (m.rail) {
    assert.ok(Math.abs(m.rail.left - m.copy.left) <= TOLERANCE && m.rail.right <= m.stage.left + TOLERANCE,
      `${where}: the rail is not in the left column (rail ${m.rail.left}-${m.rail.right}, ` +
        `copy from ${m.copy.left}, stage from ${m.stage.left})`);
    assert.ok(m.rail.top >= m.copy.bottom - TOLERANCE,
      `${where}: the rail (top ${m.rail.top}) is not under the copy (bottom ${m.copy.bottom})`);
  }

  if (m.cta) {
    assert.ok(Math.abs(m.cta.left - m.copy.left) <= TOLERANCE && m.cta.right <= m.stage.left + TOLERANCE,
      `${where}: the CTA is not in the left column (cta ${m.cta.left}-${m.cta.right}, ` +
        `copy from ${m.copy.left}, stage from ${m.stage.left})`);
    if (m.logo) {
      assert.ok(m.cta.top >= m.logo.bottom - TOLERANCE,
        `${where}: the CTA (top ${m.cta.top}) is not under the logo (bottom ${m.logo.bottom})`);
    }
  }

  if (m.logo) {
    assert.ok(m.logo.left >= m.copy.left - TOLERANCE && m.logo.right <= m.copy.right + TOLERANCE,
      `${where}: the logo (${m.logo.left}-${m.logo.right}) overflows its column ` +
        `(${m.copy.left}-${m.copy.right})`);
  }

  assert.ok(m.overflowX <= 0, `${where}: the page scrolls sideways by ${m.overflowX}px`);
}

/*
  Horizontal only: which column each block is in, where it starts, how wide it
  is. That is what a hero painting stacked and then being fixed by a script
  would change. Vertical positions are NOT compared, because one control is
  legitimately script-only: a hub's "Read more" under a clamped description is
  revealed by JS when the text overflows (Disney+, PlayStation), which grows
  the copy column by its own height and recentres the stage beside it.
*/
function assertSameBoxes(withJs, withoutJs, where) {
  for (const key of ['copy', 'stage', 'rail', 'cta']) {
    const a = withJs[key];
    const b = withoutJs[key];
    if (!a && !b) continue;
    assert.ok(a && b, `${where}: .${key} exists ${a ? 'only with' : 'only without'} JavaScript`);
    for (const edge of ['left', 'width']) {
      assert.ok(Math.abs(a[edge] - b[edge]) <= TOLERANCE,
        `${where}: the ${key}'s ${edge} is ${b[edge]} at first paint and ${a[edge]} once the ` +
          'scripts run. The server-rendered layout must already be the final one.');
    }
  }
}

async function runTests() {
  const routes = [...builtRoutes('events'), ...builtRoutes('featured')];
  assert.ok(routes.length > 0, 'no built event or hub pages under dist/client; run `npm run build` first');

  console.log(`Starting Astro preview server for the event/hub hero layout (${routes.length} pages)...`);
  const { stop } = await startPreviewServer();
  const browser = await launchTestBrowser();
  const failures = [];
  let passed = 0;

  const jobs = VIEWPORTS.flatMap((viewport) => routes.map((route) => ({ viewport, route })));
  const check = async ({ viewport, route }) => {
    const where = `${route} @${viewport.width}x${viewport.height}`;
    try {
      const withoutJs = await render(browser, route, viewport, { javaScript: false });
      assertLayout(withoutJs, `${where} (first paint, no JS)`);
      const withJs = await render(browser, route, viewport, { javaScript: true });
      assertLayout(withJs, where);
      assertSameBoxes(withJs, withoutJs, where);
      passed++;
      console.log(`  ✓ ${where}`);
    } catch (error) {
      failures.push(error.message);
      console.error(`  ✗ ${where}\n    ${error.message}`);
    }
  };

  try {
    /* A few tabs at once: most of each check is the settle wait, and serially
       72 of them took four and a half minutes. Each tab is its own page with
       its own viewport, so they cannot disturb one another's layout. */
    const queue = [...jobs];
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) await check(queue.shift());
    }));
  } finally {
    await browser.close();
    stop();
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
  process.exit(0);
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
