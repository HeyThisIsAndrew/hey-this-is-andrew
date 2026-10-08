/*
  CinematicGallery — the Instagram rail's cross-browser invariants.

  Static assertions over the component source, in the style of
  featured-containment.test.mjs: no browser, no network, no build step. They
  cannot prove the rail LOOKS right in Safari. They exist because the rail
  rendered correctly in Chromium and was visibly broken in the other two
  engines, and every rule below is one of the two defects that caused it.

  The e2e suite cannot cover this. scripts/e2e-carousel-rail.test.mjs drives
  Puppeteer, which is Chromium — the one engine where all of this already
  worked. A guard that runs in the engine that was never broken is not a guard,
  so these assertions are about what the source DECLARES.
*/
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(here, '..', 'src', 'components', 'CinematicGallery.astro'), 'utf8');

/*
  Comments stripped, for the reason the other guards strip them: this component
  documents each of these rules at length, so an un-stripped search finds the
  reasoning and passes on the prose while the code says the opposite.
*/
const strip = (s) =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

/* The scoped <style> block and the is:global one are separate stylesheets with
   separate jobs: the tiles live in the first, the injected rail labels in the
   second. Both are searched, because the sizing rule has to hold in both. */
function block(open, close, from = 0) {
  const a = raw.indexOf(open, from);
  assert.notEqual(a, -1, `CinematicGallery.astro has no ${open} block`);
  const b = raw.indexOf(close, a);
  assert.notEqual(b, -1, `CinematicGallery.astro has an unterminated ${open}`);
  return { text: strip(raw.slice(a + open.length, b)), end: b };
}

/*
  Parsed LAZILY, on first use inside a test.

  `npm test` joins its suites with `&&`, so anything this file throws at module
  scope takes every later suite down with it — the exact failure e2e-harness
  documents at length. Reading these behind a memo means a structural surprise
  (a renamed block, an unterminated tag) surfaces as a failing assertion in this
  suite and nothing else.
*/
const memo = new Map();
const lazy = (key, fn) => () => {
  if (!memo.has(key)) memo.set(key, fn());
  return memo.get(key);
};

const scopedStyle = lazy('scoped', () => block('\n<style>', '</style>').text);
const globalStyle = lazy('global', () => block('<style is:global>', '</style>').text);
const script = lazy('script', () => block('\n<script>', '</script>').text);

/* The declarations of one rule, by selector, within a given stylesheet. */
function rule(css, selector) {
  const at = css.indexOf(selector + ' {');
  assert.notEqual(at, -1, `no \`${selector}\` rule found`);
  const body = css.slice(at + selector.length + 2);
  return body.slice(0, body.indexOf('}'));
}

/* The contents of a media query block, so the mobile overrides can be read
   without matching the desktop rule of the same name. */
function media(css, query) {
  const at = css.indexOf(query);
  assert.notEqual(at, -1, `no \`${query}\` block found`);
  let depth = 0;
  for (let i = css.indexOf('{', at); i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return css.slice(at, i);
  }
  throw new Error(`unterminated ${query}`);
}

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed += 1;
  } catch (error) {
    console.log(`  ✗ ${name}\n    ${error.message}`);
    failed += 1;
  }
}

console.log('\nCinematicGallery cross-browser invariants');

/* ─── WEBKIT: THE COLLAPSE ────────────────────────────────────────────────
   `flex: 0 0 220px` + `aspect-ratio: 4 / 5` and nothing else is enough in
   Chromium and is NOT enough in WebKit. Every child of the tile anchor is
   absolutely positioned, so the tile has no in-flow content, and WebKit treats
   a ratio on a zero-content flex item as indefinite. Tiles collapsed and the
   row's gap collapsed with them: reported from Safari as overlapping tiles.  */

for (const [label, css, selector, w, h] of [
  ['tile', scopedStyle, '.ig-carousel-tile', 220, 275],
  ['rail label', globalStyle, '.ig-carousel-track .ig-rail-label', 220, 275],
]) {
  test(`the ${label} states its width outright, not just a flex basis`, () => {
    const decl = rule(css(), selector);
    for (const prop of ['width', 'min-width', 'max-width']) {
      assert.match(
        decl,
        new RegExp(`(^|[;\\s])${prop}:\\s*(?:${w}px|var\\(--ig-card,\\s*${w}px\\))`, 'm'),
        `${selector} must declare ${prop}: ${w}px or var(--ig-card). A flex basis alone lets WebKit ` +
          'resolve the box from an indefinite aspect ratio, which collapses it.',
      );
    }
  });

  test(`the ${label} states its height outright, not just an aspect ratio`, () => {
    const decl = rule(css(), selector);
    assert.match(
      decl,
      new RegExp(`(^|[;\\s])height:\\s*(?:${h}px|calc\\(var\\(--ig-card,\\s*${w}px\\)\\s*\\*\\s*1\\.25\\))`, 'm'),
      `${selector} must declare height: ${h}px (${w} * 5/4) or calc(var(...) * 1.25). aspect-ratio is the ` +
        'statement of intent; WebKit will not resolve the box from it alone here.',
    );
  });
}

test('the mobile breakpoint carries the same rigid box, not just a smaller basis', () => {
  const mobileScoped = media(scopedStyle(), '@media (max-width: 560px)');
  const mobileGlobal = media(globalStyle(), '@media (max-width: 560px)');

  for (const [label, css] of [['tile', mobileScoped], ['rail label', mobileGlobal]]) {
    for (const prop of ['width', 'min-width', 'max-width']) {
      assert.match(
        css,
        new RegExp(`${prop}:\\s*160px`),
        `the ${label} must restate ${prop} at 160px below 560px. Overriding only ` +
          'flex-basis leaves the desktop 220px width in force and the row overflows.',
      );
    }
    assert.match(
      css,
      /height:\s*200px/,
      `the ${label} must restate height at 200px below 560px (160 * 5/4).`,
    );
  }
});

test('a marquee group is as wide as its own tiles, not as wide as the track allows', () => {
  const decl = rule(scopedStyle(), '.ig-marquee-group');
  assert.match(
    decl,
    /(^|[;\s])width:\s*max-content/m,
    '.ig-marquee-group must be width: max-content. It is a flex ITEM of the track, ' +
      'so without an intrinsic width the container sizes it, and WebKit squeezed it ' +
      'below the sum of its tiles.',
  );
  assert.match(
    decl,
    /(^|[;\s])min-width:\s*max-content/m,
    '.ig-marquee-group must also be min-width: max-content — width alone is still a ' +
      'shrinkable base size.',
  );
  assert.match(
    decl,
    /flex-shrink:\s*0/,
    'flex-shrink: 0 stays. max-content fixes the BASE size; this stops the track ' +
      'taking it back. Both are load-bearing.',
  );
});

/* ─── GECKO: THE DESYNC AND THE STUTTER ───────────────────────────────────  */

test('the marquee advances by elapsed time, never by a fixed amount per frame', () => {
  assert.match(
    script(),
    /const PIXELS_PER_SECOND\s*=\s*\d+/,
    'the scroll speed must be expressed per second. A per-frame increment runs at ' +
      'double or triple speed on a 120Hz or 144Hz display.',
  );
  assert.match(
    script(),
    /exactScrollLeft\s*\+=\s*PIXELS_PER_SECOND\s*\*\s*delta/,
    'the increment must be scaled by the frame delta.',
  );
  assert.doesNotMatch(
    script(),
    /exactScrollLeft\s*\+=\s*(0?\.\d+|\d+)\s*;/,
    'a bare numeric increment is the frame-rate-dependent bug. Scale it by delta.',
  );
});

test('the frame delta is capped, so a backgrounded tab does not resume with one jump', () => {
  assert.match(
    script(),
    /Math\.min\(\s*\(now - lastTimestamp\) \/ 1000\s*,\s*0\.\d+\s*\)/,
    'delta must be Math.min((now - lastTimestamp) / 1000, <cap>). rAF stops firing in ' +
      'a hidden tab, so an uncapped delta teleports the rail on return.',
  );
});

test('divergence is measured against what the ENGINE stored, not against our float', () => {
  /*
    Firefox truncates scrollLeft to whole pixels; Chromium keeps the fraction.
    Comparing the engine's value to our own float accumulator therefore tripped
    on rounding alone in Gecko, and every trip set isPaused and re-armed the
    150ms resume timer: a permanent stutter, in one engine only.
  */
  assert.doesNotMatch(
    script(),
    /Math\.abs\(\s*track\.scrollLeft - exactScrollLeft\s*\)/,
    'comparing the engine\'s scrollLeft against our own float accumulator is the ' +
      'Firefox stutter. Compare against the value read back after the write.',
  );
  assert.match(
    script(),
    /lastAppliedScroll = track\.scrollLeft/,
    'the value written must be read straight back out of the element — that is the ' +
      'integer Gecko actually kept.',
  );
  const check = script().match(/Math\.abs\(\s*currentScroll - lastAppliedScroll\s*\)\s*>\s*(\d+)/);
  assert.ok(check, 'the divergence check must compare currentScroll to lastAppliedScroll');
  assert.ok(
    Number(check[1]) >= 6,
    `the divergence threshold is ${check[1]}px and must clear a whole-pixel rounding ` +
      'step with room to spare (>= 6). A real scroll gesture is far larger.',
  );
});

test('the divergence check still exists, so a trackpad can take over from the marquee', () => {
  assert.match(
    script(),
    /isPaused = true;[\s\S]{0,200}handleInteractionEnd\(\)/,
    'detecting a native scroll and yielding to it is the whole point of the check. ' +
      'Widening the threshold must not become deleting the behaviour.',
  );
});

test('group width is measured deterministically, not after a hopeful timeout', () => {
  assert.doesNotMatch(
    script(),
    /setTimeout\([\s\S]{0,40}?,\s*100\s*\)/,
    'sizing must not run inside setTimeout(..., 100). 100ms is not a guarantee that ' +
      'painting has finished, and a groupWidth measured wrong is wrong for the life ' +
      'of the page.',
  );
  assert.match(
    script(),
    /getBoundingClientRect\(\)\.width/,
    'measure with getBoundingClientRect(): offsetLeft is integer-rounded, so a ' +
      'fractional group width is truncated and the error compounds on every wrap.',
  );
  assert.match(
    script(),
    /styles\.columnGap/,
    'the flex gap must be read from the computed columnGap and added to the rect. ' +
      'The `gap` shorthand serialises inconsistently across engines.',
  );
  assert.match(
    script(),
    /requestAnimationFrame\(\(\) => \{[\s\S]{0,300}?measureGroupWidth\(\)/,
    'the first measurement belongs in a rAF callback, which is past the initial layout.',
  );
});

/*
  THE TRACK MUST NOT BE POSITIONED.

  Making it `position: relative` looks like a tidy way to measure offsets, and
  it silently breaks two things: the touch branch's tap-to-centre and the
  desktop drag both read `tile.offsetLeft - track.offsetLeft`, which assumes the
  tiles and the track share an offsetParent (the wrapper). Positioning the track
  makes the track itself the tiles' offsetParent, and both computations, plus
  the e2e suite's own centring maths, quietly produce the wrong number.
*/
test('the track is NOT positioned, because offsetLeft maths depends on it', () => {
  const decl = rule(scopedStyle(), '.ig-carousel-track');
  assert.doesNotMatch(
    decl,
    /position:\s*(relative|absolute|sticky|fixed)/,
    '.ig-carousel-track must stay static. tile.offsetLeft - track.offsetLeft assumes ' +
      'the tiles and the track share an offsetParent; positioning the track makes the ' +
      'track that parent and breaks tap-to-centre and the drag.',
  );
  assert.match(
    rule(scopedStyle(), '.ig-carousel-wrapper'),
    /position:\s*relative/,
    'the wrapper is the shared offsetParent and must stay positioned.',
  );
});

/*
  The touch branch is a separate code path with its own hard-won behaviour, and
  it is the one the e2e suite covers. It returns before any of the marquee code
  above, and that early return is what keeps the two apart.
*/
test('the touch branch still returns before the marquee loop is wired', () => {
  const src_ = script();
  const branch = src_.indexOf('if (isMobileTouch) {');
  assert.notEqual(branch, -1, 'the isMobileTouch branch must still exist');
  const loop = src_.indexOf('const PIXELS_PER_SECOND');
  assert.ok(branch < loop, 'the touch branch must come before the marquee loop');
  assert.ok(
    src_.slice(branch, loop).includes('return;'),
    'the touch branch must return, so a touch device never starts the marquee loop.',
  );
});

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed.\n`);
process.exit(failed === 0 ? 0 : 1);
