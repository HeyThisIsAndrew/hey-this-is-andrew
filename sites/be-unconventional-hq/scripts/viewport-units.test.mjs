/*
  Static guard on the measured viewport height, `--vv-height`.

  `svh`, `lvh` and `dvh` differ only when the browser has chrome that retracts
  during scroll, which headless Chrome does not, so no e2e test can tell them
  apart. The homepage sizes its V4 layout from `--vv-height` (home.css), the
  REAL visualViewport height: seeded inline before first paint and republished
  only on rotation, never on scroll (a per-scroll value would jitter). These
  checks read the source that keeps it that way.

  (The old splash hero's own `100lvh` / landscape rules went with the hero in
  V4; their pins were removed with them.)
*/
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${error.message}`);
    failed++;
  }
}

console.log('Measured viewport height:');

test('--vv-height is seeded inline, before first paint', () => {
  const layout = fs.readFileSync(path.join(ROOT, 'src/layouts/Layout.astro'), 'utf8');
  assert.ok(
    /is:inline[\s\S]{0,2000}--vv-height/.test(layout),
    'Layout.astro no longer seeds --vv-height from an is:inline script. It has ' +
      'to be set before first paint: the homepage layout is sized from it, so ' +
      'waiting for a module means it paints at the fallback height and then resizes.',
  );
});

test('viewport-anchor republishes --vv-height, and only on rotation', () => {
  const anchor = fs.readFileSync(path.join(ROOT, 'src/lib/viewport-anchor.ts'), 'utf8');
  assert.ok(
    /--vv-height/.test(anchor),
    'viewport-anchor.ts no longer publishes --vv-height, so a rotation leaves ' +
      'the hero at the height of the orientation it no longer has — the ' +
      'reported bug: "load the homepage and then rotate your phone".',
  );

  /* The call must be reachable from the rotation settling path and NOT from
     the geometry/scroll path, which is where a chrome collapse arrives. */
  const refreshBody = anchor.slice(
    anchor.indexOf('const refresh = ()'),
    anchor.indexOf('const schedule = ()'),
  );
  assert.ok(
    !/publishViewportHeight\s*\(/.test(refreshBody),
    'publishViewportHeight() is called from refresh(), which runs on ' +
      'visualViewport scroll/resize — that is a chrome collapse. Republishing ' +
      'there resizes the hero mid-scroll and re-rasterizes the blurred ' +
      '.hero-bg: the exact jitter 100dvh was rejected for. It belongs only in ' +
      'the rotation settling path.',
  );
});

test('the viewport meta is parsed before --vv-height is measured', () => {
  const layout = fs.readFileSync(path.join(ROOT, 'src/layouts/Layout.astro'), 'utf8');
  const viewport = layout.indexOf('name="viewport"');
  const seed = layout.indexOf("setProperty('--vv-height'");
  assert.ok(viewport !== -1, 'the viewport meta tag is gone');
  assert.ok(seed !== -1, 'the --vv-height seed is gone');
  assert.ok(
    viewport < seed,
    'The viewport meta must come BEFORE the script that reads visualViewport.height.\n' +
      '      Measured with it after: CLS 0.69 and performance 73% on the homepage.\n' +
      '      Measured with it before: CLS 0 and performance 97%.',
  );
});

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
