/*
  Google Tag Manager is loaded ONCE, by Cloudflare, and never by this repo.

  ─── THE BUG THIS GUARDS ──────────────────────────────────────────────────
  Cloudflare's Google tag gateway injects GTM-PDDF3D6K into every production
  HTML response and serves it first-party from /nlsh. Layout.astro ALSO
  loaded the container, through Partytown, so every page ran two copies:
  TikTok logged "Duplicate Pixel ID", and the Partytown copy was fetched via
  /api/proxy, which went on serving a container version Google had already
  replaced. A GA4 measurement-ID fix was published in GTM and Realtime still
  showed zero, because half the site never received it.

  So, pinned here:
    1. Nothing in the layout loads gtm.js or runs Partytown.
    2. The integration is gone from the Astro config and package.json.
    3. /api/proxy no longer relays tag scripts.
    4. The page_view push the GTM container triggers on is still there,
       bound to astro:page-load, which fires on the first load AND after
       every ClientRouter navigation.
*/
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Source with comments stripped, so prose about a pattern never trips a check. */
const code = (s) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (error) { failures += 1; console.error(`  ✗ ${name}\n      ${error.message}`); }
}

const layout = code(read('src/layouts/Layout.astro'));
const config = code(read('astro.config.mjs'));
const pkg = JSON.parse(read('package.json'));
const proxy = code(read('src/pages/api/proxy.js'));

console.log('\nGTM single loader');

check('the layout does not load gtm.js (Cloudflare injects it)', () => {
  assert.ok(
    !/<script[^>]*googletagmanager\.com\/gtm\.js/.test(layout),
    'Layout.astro loads gtm.js. The Cloudflare tag gateway already injects the ' +
      'container, so this makes a second copy and every tag fires twice.',
  );
});

check('nothing runs through Partytown', () => {
  assert.ok(!/text\/partytown/.test(layout), 'Layout.astro still has a text/partytown script');
  assert.ok(!/partytown/i.test(config), 'astro.config.mjs still configures Partytown');
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  assert.ok(!('@astrojs/partytown' in deps), '@astrojs/partytown is still a dependency');
});

check('/api/proxy does not relay tag scripts', () => {
  for (const host of ['googletagmanager.com', 'google-analytics.com', 'connect.facebook.net', 'analytics.tiktok.com', 'clarity.ms']) {
    assert.ok(!proxy.includes(host), `/api/proxy still allows ${host}`);
  }
});

check('the gtm.js start event is pushed exactly once', () => {
  /* The gateway injects the loader only. Without this push the Google tag
     never loads and GA4 records nothing, while TikTok and Meta look fine. */
  const pushes = layout.match(/'gtm\.start':\s*new Date\(\)\.getTime\(\),\s*event:\s*'gtm\.js'/g) ?? [];
  assert.equal(pushes.length, 1, `expected one gtm.js start push in Layout.astro, found ${pushes.length}`);
  const guard = layout.indexOf("window['setup'] = true");
  assert.ok(guard > -1 && layout.indexOf("'gtm.start'") > guard, 'the start push must sit inside the once-per-session guard');
});

check('page_view is pushed on astro:page-load with path and title', () => {
  const at = layout.indexOf("addEventListener('astro:page-load'");
  assert.ok(at > -1, 'no astro:page-load listener in Layout.astro');
  const body = layout.slice(at, at + 1200);
  for (const key of ["event: 'page_view'", 'page_location:', 'page_path:', 'page_title:']) {
    assert.ok(body.includes(key), `the page_view push is missing ${key}`);
  }
  assert.match(body, /requestIdleCallback\(pushGA,\s*\{\s*timeout:/, 'the idle callback needs a timeout, or a busy page never reports');
});

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nall checks passed');
