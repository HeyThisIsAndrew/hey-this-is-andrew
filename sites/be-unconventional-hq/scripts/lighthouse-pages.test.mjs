/*
  THE LIGHTHOUSE GATE MUST AUDIT EVERY PAGE IN THE MAIN NAV.

  `/intel` was absent from scripts/lighthouse-check.mjs for as long as that
  list has existed. Not for a reason — nothing checked the hardcoded PAGES
  array against the site's actual routes, so a surface could be added to the
  navigation and never measured, and one was. It went unnoticed until the
  owner read a report and asked why Intel was not in it.

  A hardcoded list is fine; a hardcoded list nothing verifies is how a page
  ships unmeasured. src/data/site.js already declares the navigation, and the
  gate should cover at least that, plus the homepage.

  Deliberately a MINIMUM, not an exact match: auditing extra routes is a
  judgement call (a slow one-off like /media-kit may be worth watching), and
  failing the build for auditing too much would be silly. What must never
  happen again is a nav entry going unmeasured.
*/
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { site } from '../src/data/site.js';

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

const check = fs.readFileSync(path.join(ROOT, 'scripts/lighthouse-check.mjs'), 'utf8');

/** The PAGES array as the gate actually sees it — comments stripped. */
function auditedPages() {
  const code = check.replace(/\/\*[\s\S]*?\*\//g, '');
  const m = code.match(/const PAGES = \[([^\]]*)\]/);
  assert.ok(m, 'could not find the PAGES array in lighthouse-check.mjs');
  return m[1]
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

console.log('Lighthouse page coverage:');

test('every main-nav route is audited', () => {
  const audited = new Set(auditedPages());
  const navRoutes = site.nav.map((item) => `/${item.href}`);
  const missing = navRoutes.filter((r) => !audited.has(r));
  assert.deepEqual(
    missing,
    [],
    `These main-nav routes are not in the Lighthouse gate: ${missing.join(', ')}\n` +
      `      Audited: ${[...audited].join(', ')}\n` +
      '      A page in the navigation that nothing measures can degrade for months\n' +
      '      without anyone noticing — which is exactly what happened to /intel.',
  );
});

test('the homepage is audited', () => {
  assert.ok(
    auditedPages().includes('/'),
    'the homepage is the most-visited route and must be in PAGES',
  );
});

test('the gate still enforces a real threshold', () => {
  /*
    Was `THRESHOLD >= 0.9`. The single line is now two bands (see below), so
    this asserts what that check was actually protecting: the bar the gate
    APPLIES has to stay meaningful. The pass line stays at 90 and the hard
    failure line may not be dropped below 80 to quiet a red build — which is
    the only way this guard could be defeated now that failing is the lower
    of the two numbers.
  */
  const pass = check.match(/const PASS_THRESHOLD = ([\d.]+);/);
  const failAt = check.match(/const FAIL_THRESHOLD = ([\d.]+);/);
  assert.ok(pass, 'PASS_THRESHOLD not found');
  assert.ok(failAt, 'FAIL_THRESHOLD not found');
  assert.ok(
    Number(pass[1]) >= 0.9,
    `PASS_THRESHOLD is ${pass[1]}; the bar for "green" must stay at 0.9 or higher.`,
  );
  assert.ok(
    Number(failAt[1]) >= 0.8,
    `FAIL_THRESHOLD is ${failAt[1]}; the build must still fail somewhere at or above 0.8.\n` +
      '      Lowering this is how a gate quietly stops gating.',
  );
  assert.ok(
    Number(failAt[1]) <= Number(pass[1]),
    'FAIL_THRESHOLD must not exceed PASS_THRESHOLD, or every warning is also a failure.',
  );
});

/*
  ─── THE TWO BANDS ─────────────────────────────────────────────────────────

  The gate was a single 90% line: below it, red build. That does not scale with
  the thing the site exists to do — each published article adds a cover image,
  a card on two hub pages and more DOM, so scores drift down as content
  accrues, and a hard 90 turns ordinary publishing into a build failure.

  Split at the owner's direction: >=90 pass, 80-90 warn (build stays green),
  <80 fail. These assertions exist because the failure mode is silent in both
  directions — wiring the fail branch to PASS_THRESHOLD makes the warn band
  fail the build, and calling fail() on the warn path does the same thing
  under a friendlier name. Neither shows up in a green run.
*/
test('the gate has two bands at 90 and 80', () => {
  assert.match(check, /const PASS_THRESHOLD = 0\.9;/);
  assert.match(check, /const FAIL_THRESHOLD = 0\.8;/);
});

test('only sub-80 sets the failing flag', () => {
  assert.match(
    check,
    /const failed = score !== null && score < FAIL_THRESHOLD;/,
    'the failure test must compare against FAIL_THRESHOLD; using PASS_THRESHOLD makes the warn band fail the build',
  );
  assert.match(check, /const warned = score !== null && !failed && score < PASS_THRESHOLD;/);
});

test('the warn band does NOT fail the build', () => {
  const tail = check.slice(check.indexOf('if (anyFailed) {'));
  const warnBranch = tail.slice(tail.indexOf('} else if (anyWarned) {'), tail.indexOf('} else {'));
  assert.ok(warnBranch.length > 0, 'the anyWarned branch is gone');
  assert.ok(
    !/\bfail\(/.test(warnBranch),
    'the warning branch must not call fail() — a warning that fails the build is a failure with a friendlier name',
  );
});

test('a page is still re-sampled and explains itself in the warn band', () => {
  // Confirmation re-runs and the diagnostics dump key off THRESHOLD. If that
  // were wired to FAIL_THRESHOLD, a page sitting at 85% would warn with no
  // metrics attached and the warning would be unactionable.
  assert.match(check, /const THRESHOLD = PASS_THRESHOLD;/);
});

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
