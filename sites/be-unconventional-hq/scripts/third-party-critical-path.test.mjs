/*
  The homepage must not fetch YouTube's player on the critical path.

  ─── THE BUG THIS GUARDS ──────────────────────────────────────────────────
  `FeaturedHighlights.astro` called `loadYouTubeAPI()` straight off
  `DOMContentLoaded`. That injects `youtube.com/iframe_api`, which pulls
  ~845 KiB of YouTube JavaScript (~517 KiB of it never executed) across three
  new origins — for a section that sits BELOW THE FOLD.

  PageSpeed's mobile profile (Slow 4G at 1.6 Mbps, 4x CPU) turned that into
  ~4s of bandwidth queued ahead of a 32 KiB hero image: Performance 58, FCP
  6.7s, LCP 10.9s. The SAME run scored 84 on desktop with a 0.8s LCP, because
  desktop has the bandwidth to absorb it. The LCP image was never slow, it was
  starved.

  Worse, the local gate could not see any of it. This repo's CI sandbox has no
  egress to youtube.com, so every local Lighthouse run scored a page whose
  largest download was silently absent, and reported ~90 for the same commit
  PageSpeed scored 58. A green that measures a different page than the one
  visitors get is worse than a red.

  So two things are pinned here:
    1. The player is fetched only once the section approaches the viewport.
    2. The gate says out loud when a third party was unreachable, instead of
       reporting a green it did not actually measure.
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

const HIGHLIGHTS = code(read('src/components/FeaturedHighlights.astro'));
/* The loader itself moved to src/lib so it could be tested behaviourally
   (scripts/youtube-iframe-api.test.mjs); the shelf imports it. */
const API_LOADER = code(read('src/lib/youtube-iframe-api.ts'));
const GATE = code(read('scripts/lighthouse-check.mjs'));

console.log('Third-party cost is kept off the critical path:');

test('the homepage still loads the YouTube API at all', () => {
  assert.match(
    HIGHLIGHTS,
    /import\s*\{\s*loadYouTubeAPI\s*\}\s*from\s*'\.\.\/lib\/youtube-iframe-api'/,
    'the featured carousel needs the iframe API — this suite defers it, it does not delete it',
  );
  assert.match(API_LOADER, /youtube\.com\/iframe_api/, 'the shared loader no longer names the iframe API');
});

test('the API load is NOT fired directly from DOMContentLoaded', () => {
  /*
    The regression shape exactly: a bare call in the init body, which runs on
    `DOMContentLoaded`. Deferred, the call lives inside `startPlayers`.
  */
  const bare = /\n\s*loadYouTubeAPI\(\)\.then\(/.test(HIGHLIGHTS);
  const insideDeferredHelper = /startPlayers\s*=\s*\(\)\s*=>\s*\{[\s\S]*?loadYouTubeAPI\(\)/.test(HIGHLIGHTS);
  assert.ok(
    !bare || insideDeferredHelper,
    'loadYouTubeAPI() runs unconditionally at init — that is the 845 KiB critical-path regression',
  );
});

test('the API load is gated behind an IntersectionObserver', () => {
  assert.match(
    HIGHLIGHTS,
    /IntersectionObserver\([\s\S]*?startPlayers\(\)/,
    'nothing defers the player fetch until the section approaches the viewport',
  );
});

test('the gate uses rootMargin, so the API is in flight before the section is seen', () => {
  assert.match(
    HIGHLIGHTS,
    /rootMargin:\s*'[^']*\d+px/,
    'the deferring observer needs lead time or the carousel visibly pops in',
  );
});

test('a browser without IntersectionObserver still gets a player', () => {
  assert.match(
    HIGHLIGHTS,
    /IntersectionObserver'\s+in\s+window[\s\S]*?\}\s*else\s*\{\s*startPlayers\(\);/,
    'the deferral must degrade to an immediate load, never to no video at all',
  );
});

test('the carousel paints before the player is fetched', () => {
  /*
    Deferring the API must not defer the UI. `activateIndex` already guards
    every player call behind `win.YT && win.YT.Player`, so calling it with no
    API loaded is the supported static-carousel state.
  */
  assert.match(
    HIGHLIGHTS,
    /* Four spaces = the init body itself. Nested inside a `.then()` callback
       it would be six, which is precisely the regression: the same two calls,
       but queued behind the download. Indentation is the only thing that
       distinguishes "now" from "after 845 KiB" without parsing the file. */
    /\n {4}activateIndex\(currentIndex\);\n {4}startAutoPlay\(\);\n/,
    'the first slide must activate immediately, not wait on a 845 KiB download',
  );
});

test('the deferring observer is disconnected on client-side navigation', () => {
  assert.match(
    HIGHLIGHTS,
    /astro:before-swap[\s\S]{0,80}apiObserver\.disconnect\(\)/,
    'an observer that survives a swap fetches the API for a page that is gone',
  );
});

console.log('\nThe Lighthouse gate admits what it could not measure:');

test('it probes the third-party origins the site really pulls', () => {
  for (const origin of ['youtube.com', 'googletagmanager.com', 'fonts.gstatic.com']) {
    assert.ok(
      GATE.includes(origin),
      `${origin} is loaded by the site but not probed, so its absence stays invisible`,
    );
  }
});

test('the probe runs before the scores are collected', () => {
  const probeAt = GATE.indexOf('unreachableThirdParties = await probeThirdParties()');
  const serverAt = GATE.indexOf('Starting preview server');
  assert.ok(probeAt > -1, 'the probe is never called');
  assert.ok(probeAt < serverAt, 'the caveat must be printed before the numbers it qualifies');
});

test('an unreachable origin does NOT fail the build', () => {
  /*
    CI is sandboxed on purpose. A hard failure here would be permanently red
    and would simply be deleted by the next person. Loud, not fatal.
  */
  const probeBlock = GATE.slice(
    GATE.indexOf('unreachableThirdParties = await probeThirdParties()'),
    GATE.indexOf('Starting preview server'),
  );
  assert.ok(
    !/\bfail\(/.test(probeBlock) && !/process\.exitCode/.test(probeBlock),
    'a missing third party must warn, never fail — otherwise the gate is red forever in CI',
  );
});

test('an all-green summary carries the caveat when a third party was missing', () => {
  const summaryAt = GATE.indexOf('All pages passed at');
  assert.ok(summaryAt > -1, 'the all-passed summary is gone');
  const summary = GATE.slice(summaryAt, summaryAt + 500);
  assert.match(
    summary,
    /unreachableThirdParties\.length/,
    '"All pages passed" must never print unqualified after a partial measurement',
  );
});

test('the probe treats a thrown fetch as unreachable, not as a pass', () => {
  assert.match(
    GATE,
    /catch\s*\{[\s\S]{0,120}return origin;/,
    'a swallowed network error is exactly the false green this probe exists to stop',
  );
});

/*
  Behavioural, not textual. `lighthouse-check.mjs` calls `run()` at module
  scope, so importing it would launch Chrome — instead lift the one pure
  function out of the source and exercise it against response-shaped stubs.
*/
const isEgressDenial = (() => {
  const raw = read('scripts/lighthouse-check.mjs');
  const start = raw.indexOf('function isEgressDenial(res) {');
  assert.ok(start > -1, 'isEgressDenial is gone — the probe cannot tell a block from a reply');
  const end = raw.indexOf('\n}', start) + 2;
  return new Function(`${raw.slice(start, end)}; return isEgressDenial;`)();
})();

const response = (status, headers) => ({
  status,
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
});

test('a proxy 403 carrying x-deny-reason counts as UNREACHABLE', () => {
  /*
    The exact shape this repo's sandbox returns for youtube.com. The first
    version of the probe called it reachable, which is how a 403 got reported
    as "third parties fine" while 845 KiB never loaded.
  */
  assert.equal(
    isEgressDenial(
      response(403, { 'x-deny-reason': 'host_not_allowed', 'content-type': 'text/plain', 'content-length': '102' }),
    ),
    true,
  );
});

test('a bare short text/plain 403 counts as UNREACHABLE even with no marker header', () => {
  assert.equal(isEgressDenial(response(403, { 'content-type': 'text/plain', 'content-length': '102' })), true);
});

test('a real origin answering 404 counts as REACHABLE', () => {
  /* fonts.gstatic.com genuinely serves 404 at its root. That is the host
     talking, so its bytes ARE in the measurement and must not be flagged. */
  assert.equal(
    isEgressDenial(response(404, { 'content-type': 'text/html; charset=UTF-8', 'content-length': '1561', server: 'sffe' })),
    false,
  );
});

test('a real origin answering 200 counts as REACHABLE', () => {
  assert.equal(isEgressDenial(response(200, { 'content-type': 'text/javascript', 'content-length': '2000' })), false);
});

test('a genuine HTML 403 from an origin is NOT mistaken for a proxy block', () => {
  /* Otherwise a rate-limited or geo-blocked third party would look like a
     sandbox problem and send the next reader chasing egress settings. */
  assert.equal(isEgressDenial(response(403, { 'content-type': 'text/html', 'content-length': '4200' })), false);
});

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
