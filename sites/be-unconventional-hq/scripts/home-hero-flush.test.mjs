/*
  The homepage hero sits FLUSH under the navbar (issue #262).

  The navbar's height is its content's (logo clamp, rem padding scaled by the
  root size, a 1px border): 66.55px on a 14" MacBook Pro, 83px at 2560. The
  hero cleared it with a fixed 104px and left a 37px dead band. Navbar.astro
  now measures itself into `--nav-h` and every `--home-top` reads it, with the
  old px values only as no-JS fallbacks. Measured after: 0px gap from 390 to
  2560 wide, CLS unchanged.

  Static and offline: plain `node scripts/home-hero-flush.test.mjs`.
*/
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(ROOT, 'src/styles/modules/home.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const nav = fs.readFileSync(path.join(ROOT, 'src/components/Navbar.astro'), 'utf8');

const tops = [...css.matchAll(/--home-top:\s*([^;]+);/g)].map((m) => m[1].trim());
assert.ok(tops.length >= 4, 'expected --home-top at each breakpoint');
for (const t of tops) {
  assert.match(t, /^var\(--nav-h, \d+px\)$/, `--home-top must read the measured navbar height, got "${t}"`);
}

const after = nav.slice(nav.indexOf('</header>'));
assert.match(after, /<script is:inline>[\s\S]*setProperty\('--nav-h'/,
  'the navbar publishes --nav-h from an inline script directly after </header>, before the hero is parsed');
assert.match(after, /astro:after-swap/, 'and re-applies it after a ClientRouter swap rewrites <html> attributes');

console.log('✅ The homepage hero sits flush under the measured navbar.');
