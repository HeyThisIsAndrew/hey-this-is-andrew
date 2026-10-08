/**
 * `content-visibility: auto` on the homepage (src/styles/modules/home.css).
 *
 * It is the fix for the homepage's mobile main-thread cost (layout passes over
 * sections nobody can see yet), and it has two ways to do harm, both silent:
 *
 *   1. It implies paint containment, which clips like `overflow: hidden`.
 *      Hard rule 3: a clipping ancestor turns a YouTube frame into a black box
 *      on iOS Safari. So a contained section must drop containment when it
 *      holds a frame, and Featured (FeaturedHighlights' player) stays out.
 *   2. Containing the first screen delays the very paint it exists to speed
 *      up, and containing a section that paints past its own box slices that
 *      paint off (Featured's card shadow, Inside HQ's portrait frame).
 *
 * Source-level on purpose: the rule is one selector list, and the regression
 * is someone adding a section to it.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../src/styles/modules/home.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const page = fs.readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');

let passed = 0;
const test = (name, fn) => {
  try {
    fn();
    passed++;
  } catch (err) {
    process.exitCode = 1;
    console.error(`✗ ${name}\n  ${err.message}`);
  }
};

/* Every rule that sets content-visibility, as { selector, value }. */
const rules = [...css.matchAll(/([^{}]+)\{[^{}]*content-visibility:\s*([a-z-]+)/g)].map((m) => ({ selector: m[1].trim(), value: m[2] }));
const autoRules = rules.filter((r) => r.value === 'auto');
const releaseRules = rules.filter((r) => r.value === 'visible');
const autoSelectors = autoRules.map((r) => r.selector).join(' ');

test('there is exactly one content-visibility: auto rule', () => {
  assert.equal(autoRules.length, 1, autoRules.map((r) => r.selector).join(' | '));
});

test('it contains the measured below-the-fold sections', () => {
  for (const cls of ['.intel-spread', '.watching', '.home-slot']) {
    assert.ok(autoSelectors.includes(cls), `${cls} is not contained`);
  }
});

test('the first screen is never contained (hero, spotlight banner)', () => {
  for (const cls of ['hero-acc', 'spotlight']) {
    assert.ok(!autoSelectors.includes(cls), `${cls} is contained: it would delay the LCP it protects`);
  }
});

test('Featured and Inside HQ stay out (player host, and both paint past their box)', () => {
  for (const cls of ['featured-world', 'inside-hq']) {
    assert.ok(!autoSelectors.includes(cls), `${cls} is contained`);
  }
});

test('the footer stays out (shared across pages, view-transition scoped)', () => {
  assert.ok(!/site-footer/.test(autoSelectors), 'the footer is contained');
});

test('every contained selector releases containment when it holds an iframe (hard rule 3)', () => {
  assert.equal(releaseRules.length, 1, 'expected one content-visibility: visible release rule');
  const release = releaseRules[0].selector;
  assert.match(release, /:has\(iframe\)/, 'the release rule must key on :has(iframe)');
  for (const part of autoRules[0].selector.split(/,(?![^(]*\))/).map((s) => s.trim())) {
    assert.ok(release.includes(`${part}:has(iframe)`), `${part} has no :has(iframe) release`);
  }
});

test('every contained home-slot has a named modifier with an intrinsic size', () => {
  const slots = [...page.matchAll(/class="home-slot([^"]*)"/g)].map((m) => m[1]);
  assert.ok(slots.length >= 3, `expected the three hosted slots, found ${slots.length}`);
  for (const extra of slots) {
    const mod = extra.match(/home-slot--[\w-]+/)?.[0];
    assert.ok(mod, `a home-slot has no modifier: "home-slot${extra}"`);
    assert.match(css, new RegExp(`\\.${mod}\\s*\\{[^}]*contain-intrinsic-size:\\s*auto\\s+\\d+px`), `${mod} has no contain-intrinsic-size`);
  }
});

console.log(process.exitCode ? '' : `✅ ${passed} passed, 0 failed.`);
