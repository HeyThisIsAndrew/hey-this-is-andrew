/*
  The in-app-browser escape hatch must survive a view transition, and must
  never move a visitor without being asked (#198).

  ─── THE TWO BUGS THIS GUARDS ─────────────────────────────────────────────
  `@vdaluz/astro-inapp-escape` ships its own `InAppEscape.astro`. Dropped
  into this site it is half-broken, in two ways that are invisible in a
  build and invisible in CI:

  1. Its script reveals the banner from module scope with a bare
     `classList.remove('hidden')`, once. This site renders <ClientRouter />,
     so the first internal link swaps in fresh HTML where the banner is
     hidden again, and a module script does not re-run. The banner appears
     on the landing page and is never seen again. Every other script in
     `Layout.astro` binds `astro:page-load` for exactly this reason.

  2. On Android it runs `window.location.href = intent://...` on load, with
     no banner, no tap and no user gesture. One `inapp-spy` false positive
     and a real reader is thrown off the page.

  So this suite pins the local component that replaces it: re-runnable init,
  no navigation without a click, and detection still delegated to the
  package rather than re-implemented here.
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

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err.message}`);
    failed++;
  }
}

const COMPONENT = code(read('src/components/InAppEscape.astro'));
const LAYOUT = code(read('src/layouts/Layout.astro'));

console.log('The escape hatch survives client-side navigation:');

test('init is bound to astro:page-load, not only DOMContentLoaded', () => {
  assert.match(
    COMPONENT,
    /addEventListener\('astro:page-load',\s*initInAppEscape\)/,
    'without this the banner dies on the first internal link, as the packaged component does',
  );
  assert.match(COMPONENT, /addEventListener\('DOMContentLoaded',\s*initInAppEscape\)/);
});

test('the reveal is NOT a bare top-level statement', () => {
  /*
    The packaged shape: `classList.remove('hidden')` sitting in module scope,
    reachable exactly once per hard load.
  */
  assert.ok(
    !/^\s*document\.getElementById\([^)]*\)\?\.classList\.remove/m.test(COMPONENT),
    'revealing from module scope is what makes the banner unrepeatable',
  );
});

test('the once-guard lives on the ELEMENT, not in module scope', () => {
  /*
    A module-level `let done = false` would be correct on the first load and
    wrong forever after: a view transition hands over a brand new node that
    has never been wired.
  */
  assert.match(
    COMPONENT,
    /banner\.dataset\.inappInit/,
    'a module-scoped guard cannot see that the DOM was replaced',
  );
});

console.log('\nNobody is navigated without asking:');

test('the Android intent fires from a click handler, never on load', () => {
  const assignment = COMPONENT.match(/window\.location\.href\s*=\s*androidIntentUrl\([^)]*\)/g) || [];
  assert.equal(assignment.length, 1, 'exactly one place should navigate');
  assert.match(
    COMPONENT,
    /addEventListener\('click',\s*\(\)\s*=>\s*\{\s*window\.location\.href\s*=\s*androidIntentUrl/,
    'the redirect must be inside a click listener, which is the whole fix',
  );
});

test('no navigation sits at the top level of init', () => {
  const init = COMPONENT.slice(COMPONENT.indexOf('function initInAppEscape'));
  const beforeHandler = init.slice(0, init.indexOf("addEventListener('click'"));
  assert.ok(
    !/window\.location\.href\s*=/.test(beforeHandler),
    'a redirect reachable before any click is the auto-hijack this replaces',
  );
});

test('both platforms get the SAME banner, and only the button behaves differently', () => {
  /*
    An earlier pass gave Android a short line plus a button and gave iOS a
    full sentence with none, so the same component rendered one line on one
    OS and two on the other. The only real difference between the platforms
    is what the button can DO: Android can hand the URL to the default
    browser via `intent://`, iOS exposes no such API. That is not a reason
    for two layouts.
  */
  assert.match(
    COMPONENT,
    /textNode\.hidden = false;[\s\S]{0,80}openBtn\.hidden = false;[\s\S]{0,120}if \(platform === 'android'\)/,
    'the text and the button must be shown for BOTH platforms before the branch',
  );
  const branch = COMPONENT.slice(COMPONENT.indexOf("if (platform === 'android')"));
  assert.ok(
    !/textNode\.textContent\s*=/.test(branch.slice(0, branch.indexOf('} else'))),
    'the Android branch must not set its own copy; the shared line is set above it',
  );
});

test('iOS gets instructions from the same button, in place', () => {
  const ios = COMPONENT.slice(COMPONENT.indexOf('} else {', COMPONENT.indexOf("if (platform === 'android')")));
  assert.match(ios, /openBtn\.addEventListener\('click'/, 'iOS must use the same button, not a dead control');
  assert.match(ios, /textNode\.textContent\s*=/, 'the iOS tap must swap the copy in place');
  assert.ok(
    !/innerHTML/.test(COMPONENT),
    'assign textContent, so copy that is only ever plain text cannot become an injection point',
  );
  assert.match(ios, /openBtn\.hidden = true/, 'hiding the spent button keeps the longer sentence on one line');
});

test('only Android navigates, and only from a click', () => {
  const android = COMPONENT.slice(
    COMPONENT.indexOf("if (platform === 'android')"),
    COMPONENT.indexOf('} else {', COMPONENT.indexOf("if (platform === 'android')")),
  );
  assert.match(android, /addEventListener\('click',[\s\S]{0,120}window\.location\.href = androidIntentUrl/);
  const ios = COMPONENT.slice(COMPONENT.indexOf('} else {', COMPONENT.indexOf("if (platform === 'android')")));
  assert.ok(!/window\.location\.href\s*=/.test(ios), 'iOS must never navigate; nothing it could navigate to helps');
});

test('an in-app browser on neither platform is left alone', () => {
  /* A banner whose advice does not match the device is worse than none. The
     guard now sits before the shared copy is written rather than as a
     trailing else, so match the guard itself. */
  assert.match(
    COMPONENT,
    /if \(platform !== 'android' && platform !== 'ios'\) return;/,
    'nothing bails out for a platform this banner cannot advise',
  );
});

console.log('\nThe details that break quietly:');

test('detection is delegated to the package, not re-implemented', () => {
  assert.match(
    COMPONENT,
    /import\s*\{[^}]*detectInApp[^}]*\}\s*from\s*'@vdaluz\/astro-inapp-escape'/,
    'hand-rolled user-agent sniffing is the part that rots; keep using inapp-spy',
  );
});

test('visibility is a class, never the hidden ATTRIBUTE on the banner', () => {
  /*
    `.inapp-escape.is-visible { display: flex }` would beat the UA's
    `[hidden] { display: none }`, so an attribute-hidden banner would show
    for every visitor on earth.
  */
  assert.match(COMPONENT, /\.inapp-escape\s*\{\s*display:\s*none/);
  assert.match(COMPONENT, /banner\.classList\.add\('is-visible'\)/);
  assert.ok(
    !/banner\.hidden\s*=/.test(COMPONENT),
    'the banner itself must not be toggled by attribute while it carries a display rule',
  );
});

test('the banner is fixed, so it does not scroll away from a fixed navbar', () => {
  assert.match(
    COMPONENT,
    /\.inapp-escape\.is-visible\s*\{[\s\S]*?position:\s*fixed/,
    'absolute positioning lets the escape route scroll off while the navbar stays',
  );
});

test('it sits above the navbar and the modal layer', () => {
  const z = COMPONENT.match(/z-index:\s*(\d+)/);
  assert.ok(z, 'no z-index');
  assert.ok(Number(z[1]) > 300, `z-index ${z[1]} is under the modal layer at 300`);
});

test('dismissal is remembered, and storage failure does not hide the banner', () => {
  assert.match(COMPONENT, /sessionStorage\.setItem\(DISMISS_KEY/);
  assert.match(
    COMPONENT,
    /catch\s*\{[\s\S]{0,220}return false;/,
    'private mode throws on read; failing closed would silence the banner for those visitors',
  );
});

test('the dismiss control clears the WCAG AA pointer-target floor', () => {
  /*
    24x24 CSS px is WCAG 2.2 SC 2.5.8 Target Size (Minimum), level AA, and
    that is the bar this repo has to clear. The 44px this check first
    asserted is SC 2.5.5 at level AAA, which is also Apple's HIG figure. A
    28px control is a deliberate density choice that passes AA and misses
    AAA, so failing the build over it was this test overreaching, not the
    component regressing. Pin the standard, not the preference.
  */
  const box = COMPONENT.match(/\.inapp-escape-dismiss\s*\{[\s\S]*?\}/);
  assert.ok(box, 'the dismiss control has no rule block');
  const dims = [...box[0].matchAll(/(?:min-)?(width|height):\s*(\d+(?:\.\d+)?)px/g)];
  assert.ok(dims.length >= 2, 'the dismiss control sets no explicit size');
  for (const [, axis, px] of dims) {
    assert.ok(Number(px) >= 24, `dismiss ${axis} is ${px}px, under the 24px AA floor`);
  }
});

test('the dismiss control has an accessible name', () => {
  /*
    Either technique is fine: visually hidden text inside the button, or an
    `aria-label` on it. The first version of this check named one of them,
    which failed a switch to the other while the name was still there. What
    matters is that a control whose only content is a glyph or an icon is
    not announced as "times", "button", or nothing.
  */
  const btn = COMPONENT.match(/<button[^>]*data-inapp-dismiss[\s\S]*?<\/button>/);
  assert.ok(btn, 'no dismiss button');
  const hasAriaLabel = /aria-label="[^"]+"/.test(btn[0]);
  const hasSrOnlyText = /class="sr-only">[^<]+</.test(btn[0]);
  assert.ok(
    hasAriaLabel || hasSrOnlyText,
    'the dismiss control has no accessible name, only a glyph',
  );
});

console.log('\nThe layout uses the local component:');

test('Layout imports ours, not the packaged component', () => {
  assert.match(LAYOUT, /import InAppEscape from '\.\.\/components\/InAppEscape\.astro'/);
  assert.ok(
    !/from '@vdaluz\/astro-inapp-escape\/InAppEscape\.astro'/.test(LAYOUT),
    'the packaged component is the one with both bugs',
  );
});

test('no user-facing copy in the banner uses an em dash', () => {
  /* House style, CLAUDE.md: split the sentence or use a comma. */
  const copy = COMPONENT.match(/>[^<>{}]*[a-z][^<>{}]*</g) || [];
  const offenders = copy.filter((c) => c.includes('—'));
  assert.deepEqual(offenders, [], `em dash in visitor-facing copy: ${offenders.join(' | ')}`);
});

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
