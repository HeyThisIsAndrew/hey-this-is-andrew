/*
  NO SECTION OF THIS SITE MAY DEPEND ON JAVASCRIPT TO BE VISIBLE.

  Two classes ship content at `opacity: 0` and wait for a script to reveal
  it: `.animate-on-scroll` and `.reveal` (the shared IntersectionObserver in
  Layout.astro). Each is a nice entrance and sits directly in front of real
  content.

  WHAT THIS PINS, AND WHY IT IS A TEST RATHER THAN A COMMENT

  Reported from an iPhone, with a photograph: the homepage rendering the
  heading "EXPLORE THE HQ / WHAT WE COVER" over an entirely black section,
  and the navbar not responding to taps. It cleared by itself after a while,
  and stopped happening once the phone was charged. Nothing was wrong with
  the markup or the CSS. The phone was in Low Power Mode on a build that was
  minutes old, so nothing was warm in the CDN or in the device cache, and the
  module that adds the reveal class had not executed yet.

  Measured with JavaScript disabled on the built site before the fix:

    desktop  /feed   .reveal x12, .animate-on-scroll x2
    desktop  /about  .animate-on-scroll x9, .reveal x1

  Mobile got off lighter only because hero.css carries a blunt
  `opacity: 1 !important` override for both classes inside its phone media
  query.

  A browser test cannot pin this cheaply: proving it needs a page load with
  scripts blocked, and the failure is a slow-network condition rather than a
  behaviour. Reading the two files that have to agree costs milliseconds and
  catches the thing that actually went wrong, which is the two halves being
  edited apart.
*/
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(join(here, '..', ...p), 'utf8');

const utilities = read('src', 'styles', 'modules', 'utilities.css');
const layout = read('src', 'layouts', 'Layout.astro');

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

console.log('Reveal failsafe:');

/* The classes that ship invisible. A new one must be added here AND to the
   failsafe rules, so the list is asserted, not assumed. */
const REVEAL_CLASSES = ['.animate-on-scroll', '.reveal'];

test('every reveal class is un-gated when the page has no JavaScript', () => {
  for (const cls of REVEAL_CLASSES) {
    assert.ok(
      utilities.includes(`html:not(.js) ${cls}`),
      `utilities.css has no \`html:not(.js) ${cls}\` rule. Without it, a ` +
        `reader with JavaScript off or blocked sees that content as a blank ` +
        `panel rather than as unanimated content.`,
    );
  }
});

test('every reveal class is un-gated when its script never arrives', () => {
  // The reported failure. `.js` is set by an inline script and cannot catch
  // this: `.js` WAS set, and the module was the thing that had not run.
  assert.ok(
    utilities.includes('html.reveal-failsafe .animate-on-scroll') &&
      utilities.includes('html.reveal-failsafe .reveal'),
    'utilities.css must un-gate .animate-on-scroll and .reveal under .reveal-failsafe',
  );
  assert.match(
    utilities,
    /opacity:\s*1\s*!important/,
    'the failsafe has to outrank the rules that hid the content, which are ' +
      'plain declarations in three different stylesheets',
  );
});

test('the watchdog lives in the INLINE head script, not a bundled one', () => {
  /*
    Load-bearing. A watchdog inside a bundled module cannot fire when the
    bundle is what failed to arrive — it would be guarding itself. The `.js`
    class is set from the same inline block for the same reason.
  */
  const inline = layout.slice(
    layout.indexOf('<script is:inline>'),
    layout.indexOf('</script>', layout.indexOf('<script is:inline>')),
  );
  assert.ok(inline.includes("classList.add('js')"), 'the .js gate must be inline');
  assert.ok(
    inline.includes('reveal-failsafe'),
    'the reveal watchdog must be in the inline head script. In a bundled ' +
      'module it cannot fire for the failure it exists to catch.',
  );
  const delay = inline.match(/}\s*,\s*(\d+)\);/);
  assert.ok(delay, 'the watchdog must be on a timer');
  const ms = Number(delay[1]);
  assert.ok(
    ms >= 3000 && ms <= 10000,
    `the watchdog fires after ${ms}ms. Under ~3s it will trip on a slow but ` +
      `healthy load and cost the entrance animation for no reason; over ~10s ` +
      `the reader has already decided the page is broken.`,
  );
});

test('the watchdog only reports a system the page actually uses', () => {
  /*
    Without the presence check, the failsafe class would be set on routes
    whose module never runs because it has nothing to reveal, and a
    diagnostic that fires everywhere stops being one.
  */
  assert.match(
    layout,
    /!window\.__hqRevealReady && document\.querySelector\(/,
    'the reveal branch must check that the page has reveal elements at all',
  );
});

test('each reveal system signs in when it RUNS, not when it loads', () => {
  /*
    The flag has to mean "the content got revealed". Set at module scope it
    would only mean "the chunk downloaded", and an astro:page-load event that
    never fires leaves the content just as invisible with the watchdog
    satisfied.
  */
  const initReveal = layout.slice(layout.indexOf('function initReveal()'));
  assert.match(
    initReveal.slice(0, 600),
    /window\.__hqRevealReady = true/,
    'initReveal() must set __hqRevealReady',
  );
  const immediate = layout.slice(layout.indexOf('function revealImmediately()'));
  assert.match(
    immediate.slice(0, 400),
    /window\.__hqRevealReady = true/,
    'revealImmediately() must set it too — it is the path taken on every ' +
      'client-side navigation, and initReveal() only runs on a cold load',
  );
});

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed.\n`);
process.exit(failed === 0 ? 0 : 1);
