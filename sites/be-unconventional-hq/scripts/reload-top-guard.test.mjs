/*
  Programmatic scrolls JUMP, and a homepage refresh holds the top.

  global-base.css sets `html { scroll-behavior: smooth }` site-wide, so a bare
  `window.scrollTo()` animates. Every reset below has to either pass an
  explicit behavior or pin `scroll-behavior: auto` AND force a style recalc
  before scrolling (a pin without the recalc silently does nothing).

  ReloadTopGuard.astro keeps a homepage refresh at the top, including against
  iOS Safari's late scroll restore, and lets go on the reader's first input.
  scripts/e2e-reload-scroll.test.mjs measures that in a browser; this file
  stops the code being deleted or quietly broken.

  Static and offline: plain `node scripts/reload-top-guard.test.mjs`.
*/
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const guard = read('src/components/ReloadTopGuard.astro');

/** Strip comments so prose about a pattern is not mistaken for the pattern. */
const withoutComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '');

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

/* Files that scroll the page programmatically. Any new one belongs here. */
const SCROLLERS = [
  'src/components/ReloadTopGuard.astro',
  'src/components/Navbar.astro',
  'src/lib/scroll-lock.ts',
  'src/lib/scroll-to.ts',
];

console.log('\nEvery reset must JUMP, never animate:');

test('no window.scrollTo() in the scrollers can animate by accident', () => {
  const offenders = [];
  for (const file of SCROLLERS) {
    const source = withoutComments(read(file));
    for (const match of source.matchAll(/window\.scrollTo\(/g)) {
      const call = source.slice(match.index, source.indexOf(')', match.index) + 1);
      if (/behavior\s*:/.test(call)) continue; // explicit: the author chose
      const preamble = source.slice(Math.max(0, match.index - 400), match.index);
      if (/scrollBehavior\s*=\s*['"]auto['"]/.test(preamble)) continue;
      offenders.push(`${file}:${source.slice(0, match.index).split('\n').length} ${call}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'these calls inherit the global `scroll-behavior: smooth` and will animate. ' +
      'Route them through jumpTo() in src/lib/scroll-to.ts, or pass an explicit behavior:\n    ' +
      offenders.join('\n    ')
  );
});

test('pinning scroll-behavior is always followed by a forced style recalc', () => {
  /* Measured, jumping 390 -> 0 and reading scrollY the next frame: pin only
     390 (still animating), pin + flush 0. So every pin needs a layout read
     between it and the scroll. */
  const offenders = [];
  for (const file of SCROLLERS) {
    const source = withoutComments(read(file));
    for (const match of source.matchAll(/scrollBehavior\s*=\s*['"]auto['"]/g)) {
      const after = source.slice(match.index, match.index + 400);
      const scrollAt = after.search(/window\.scrollTo\(/);
      if (scrollAt === -1) continue;
      if (/offsetHeight|offsetWidth|getBoundingClientRect|getComputedStyle/.test(after.slice(0, scrollAt))) continue;
      offenders.push(`${file}:${source.slice(0, match.index).split('\n').length}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'these pin scroll-behavior to `auto` and scroll WITHOUT forcing a recalc, so ' +
      'the scroll animates anyway. Add `void root.offsetHeight;` after the pin:\n    ' +
      offenders.join('\n    ')
  );
});

test('the inline copy in ReloadTopGuard.astro matches the shared helper', () => {
  assert.match(
    withoutComments(read('src/lib/scroll-to.ts')),
    /scrollBehavior\s*=\s*'auto';[\s\S]{0,120}offsetHeight[\s\S]{0,120}window\.scrollTo/,
    'src/lib/scroll-to.ts must pin, flush, then scroll, in that order'
  );
  assert.match(
    withoutComments(guard),
    /function jumpToTop\(\)[\s\S]{0,400}offsetHeight[\s\S]{0,120}window\.scrollTo/,
    "ReloadTopGuard.astro's inline jumpToTop() has lost its forced recalc and now animates"
  );
  assert.match(read('src/pages/index.astro'), /<ReloadTopGuard \/>/, 'the homepage must mount the reload guard');
});

console.log('\nA refresh holds the top without fighting the reader:');

test('the reload path keeps a scroll listener that re-pins the top', () => {
  assert.match(
    withoutComments(guard),
    /isReload[\s\S]*addEventListener\(\s*'scroll'/,
    'the reload path must keep a scroll listener, not just fire one-shot resets'
  );
});

test('the guard releases on the first real input', () => {
  assert.match(
    guard,
    /touchstart[\s\S]{0,200}pointerdown|pointerdown[\s\S]{0,200}touchstart/,
    'the top guard must release on the first touch/pointer, or it fights a reader who scrolls at once'
  );
  assert.match(guard, /'wheel'/, 'the top guard must release on the first wheel event');
});

test('no hard scroll lock on reload (it ate the first swipe)', () => {
  /* A `position: fixed; overflow: hidden` lock held until the first input
     killed the first trackpad swipe (Chrome, Brave) and the first iPhone
     Safari swipe after a refresh: the swipe is latched to a scroller when it
     begins, and the page was still locked then. */
  const code = withoutComments(guard);
  assert.ok(!/classList\.add\(\s*['"]reload-lock['"]/.test(code), 'ReloadTopGuard must not lock scrolling on reload');
  assert.ok(!/reload-lock/.test(withoutComments(read('src/styles/modules/ios-lock.css'))), 'ios-lock.css still styles a reload lock');
});

console.log(failed === 0 ? `\n✅ ${passed} passed, 0 failed.` : `\n❌ ${passed} passed, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
