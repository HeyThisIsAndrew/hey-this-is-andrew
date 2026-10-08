/*
  Route cache rules must survive Astro's own schema, and the runbook must
  match what the provider actually emits (#196).

  ─── THE BUG THIS GUARDS ──────────────────────────────────────────────────
  Astro 7 `routeRules` entries are `{ maxAge, swr, tags }` and nothing else.
  The schema is a plain `z.object()`, which STRIPS unknown keys rather than
  rejecting them. So a rule written in any other shape parses "successfully"
  as `{}` and silently disables the policy it was meant to declare.

  The first pass at #196 wrote:

      "/api/live-status.json": { headers: { "Cache-Control": "...s-maxage=900..." } }

  which parsed to `{}`. The provider then emitted a bare
  `Cloudflare-CDN-Cache-Control: public` with no TTL, and because that header
  is CDN-targeted it is the one Cloudflare honours ahead of the handler's own
  `s-maxage=900`. The same commit deleted the hand-rolled `caches.default`
  block whose comment read "Cloudflare dynamic routes bypass CDN cache by
  default. Manually enforce it."

  That is a quota bug, not a style bug: `/api/live-status.json` spends 100
  YouTube units per call against 10,000/day, and the edge cache IS the rate
  limiter (scripts/live-status.md). A rule that strips to nothing removes it.

  `astro check` does catch the bad shape, but `astro check` is not in CI, so
  nothing stopped it from shipping. This suite is the CI-side guard: it
  validates the REAL config against Astro's OWN shipped schema, so any future
  rule that strips to nothing fails here instead of quietly at the edge.
*/
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { buildCacheControlDirectives, pathTag } from 'astro/cache/provider-utils';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

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

/* The real config, not a copy of it. A test against a transcribed literal
   would pass while the shipped file said something else. */
const config = (await import(path.join(ROOT, 'astro.config.mjs'))).default;
const RUNBOOK = read('scripts/live-status.md');

/**
 * The only keys a RouteRule may carry. Held here rather than imported because
 * Astro does not export its cache schema publicly, and a test that reaches
 * into `dist/` breaks on every upgrade for reasons that have nothing to do
 * with this repo.
 *
 * The cross-check below keeps the copy honest: when the real schema IS
 * reachable it must agree with this list, so an Astro upgrade that adds or
 * removes a key fails here loudly instead of letting the list rot.
 */
const ALLOWED_RULE_KEYS = ['maxAge', 'swr', 'tags'];

/** Astro's own schema when the internal path still resolves, else null. */
async function loadRealSchema() {
  const internal = path.join(ROOT, 'node_modules/astro/dist/core/cache/config.js');
  if (!fs.existsSync(internal)) return null;
  try {
    return (await import(pathToFileURL(internal).href)).RouteRulesSchema ?? null;
  } catch {
    return null;
  }
}
const realSchema = await loadRealSchema();

/** Parse through the real schema when available, else emulate the strip. */
const parseRules = (rules) =>
  realSchema
    ? realSchema.parse(rules)
    : Object.fromEntries(
        Object.entries(rules).map(([route, rule]) => [
          route,
          Object.fromEntries(Object.entries(rule).filter(([k]) => ALLOWED_RULE_KEYS.includes(k))),
        ]),
      );

/** The route whose cache policy is a quota gate rather than a nicety. */
const QUOTA_ROUTE = '/api/live-status.json';

console.log('Route cache rules survive Astro\'s schema:');

test('every routeRule round-trips with NOTHING stripped', () => {
  /*
    The whole bug in one assertion. `safeParse` succeeds on a malformed rule,
    so success is not the signal: equality before and after is.
  */
  const rules = config.routeRules ?? {};
  const parsed = parseRules(rules);
  for (const [route, rule] of Object.entries(rules)) {
    const before = Object.keys(rule).sort();
    const after = Object.keys(parsed[route] ?? {}).sort();
    const dropped = before.filter((k) => !after.includes(k));
    assert.deepEqual(
      dropped,
      [],
      `routeRules["${route}"] has key(s) Astro silently discards: ${dropped.join(', ')}. ` +
        `A RouteRule is { maxAge, swr, tags } only, and an unknown key strips to {} ` +
        `rather than erroring, which disables the rule.`,
    );
  }
});

test('the allowed-key list still matches Astro\'s real schema', () => {
  /*
    Skips rather than fails when the internal path moves, because an upgrade
    relocating a private file is not this repo's bug. It DOES fail when the
    schema is reachable and disagrees, which is the case that matters: a new
    key would otherwise look like an unknown key and be reported as stripped.
  */
  if (!realSchema) {
    console.log('      (skipped: astro internal schema not reachable in this version)');
    return;
  }
  const probe = { '/x': Object.fromEntries(ALLOWED_RULE_KEYS.map((k) => [k, k === 'tags' ? ['t'] : 1])) };
  assert.deepEqual(
    Object.keys(realSchema.parse(probe)['/x']).sort(),
    [...ALLOWED_RULE_KEYS].sort(),
    'Astro\'s RouteRule keys changed; update ALLOWED_RULE_KEYS in this suite',
  );
});

test('a rule that strips to nothing is REJECTED by this check', () => {
  /* Proves the assertion above has teeth, against the exact shape that shipped. */
  const bad = { [QUOTA_ROUTE]: { headers: { 'Cache-Control': 's-maxage=900' } } };
  const parsed = parseRules(bad);
  assert.deepEqual(parsed[QUOTA_ROUTE], {}, 'Astro no longer strips unknown keys; revisit this suite');
  assert.notDeepEqual(Object.keys(bad[QUOTA_ROUTE]), Object.keys(parsed[QUOTA_ROUTE]));
});

console.log('\nThe quota-gated route still has a real edge TTL:');

test(`${QUOTA_ROUTE} declares a cache rule at all`, () => {
  assert.ok(
    config.routeRules?.[QUOTA_ROUTE],
    'the YouTube quota gate has no routeRule; every visitor would spend 100 units',
  );
});

test('its rule produces a bounded edge lifetime, not a bare "public"', () => {
  const rule = parseRules(config.routeRules)[QUOTA_ROUTE];
  const directives = buildCacheControlDirectives(rule, ['public']);
  assert.match(
    directives,
    /max-age=\d+/,
    `Cloudflare-CDN-Cache-Control would be "${directives}" with no TTL. ` +
      `That header is CDN-targeted, so it overrides the handler's own s-maxage.`,
  );
  const maxAge = Number(directives.match(/max-age=(\d+)/)[1]);
  /*
    100 units per call against 10,000/day. 900s caps the endpoint near 96
    calls/day. Anything much shorter risks the quota; much longer and "going
    live" takes too long to show.
  */
  assert.ok(maxAge >= 600, `edge max-age ${maxAge}s is short enough to threaten the YouTube quota`);
});

console.log('\nThe runbook matches what the provider actually emits:');

test('the documented purge tag is the one pathTag() produces', () => {
  /*
    The first pass documented the bare path. Cloudflare would accept that
    purge and match nothing, which is the worst failure shape: it looks like
    it worked.
  */
  const real = pathTag(QUOTA_ROUTE);
  assert.notEqual(real, QUOTA_ROUTE, 'pathTag is now identity; the runbook needs revisiting');
  assert.ok(
    RUNBOOK.includes(`"tags":["${real}"]`),
    `the runbook's purge command must use ${real}, not the bare path`,
  );
  assert.ok(
    !/--data '\{"tags":\["\/api/.test(RUNBOOK),
    'the runbook still documents a bare-path purge somewhere, which matches nothing',
  );
});

test('the runbook quotes the header the provider really sets', () => {
  assert.ok(
    RUNBOOK.includes('Cloudflare-CDN-Cache-Control'),
    'the runbook should name the header that actually governs the edge',
  );
});

console.log('\nThe pieces the provider depends on are wired:');

test('the Cloudflare cache provider is configured', () => {
  assert.equal(config.cache?.provider?.name, 'cloudflare');
  assert.equal(config.cache?.provider?.entrypoint, '@astrojs/cloudflare/cache/provider');
});

test('CF_VERSION_METADATA is bound, so a deploy invalidates stale entries', () => {
  /*
    `readVersionId()` in the provider reads `env.CF_VERSION_METADATA` to append
    an `astro-version:` tag. Without the binding it returns undefined, the tag
    is absent, and yesterday's cached status survives a deploy.
  */
  const wrangler = JSON.parse(read('wrangler.jsonc').replace(/^\s*\/\/.*$/gm, ''));
  assert.equal(
    wrangler.version_metadata?.binding,
    'CF_VERSION_METADATA',
    'without this binding the astro-version cache tag is never emitted',
  );
});

test('the handler no longer hand-rolls the cache it now declares', () => {
  /* Both mechanisms at once would double-cache and make the policy ambiguous. */
  const route = read('src/pages/api/live-status.json.ts');
  assert.ok(!/caches\.default/.test(route), 'manual caches.default is back alongside the declarative rule');
  assert.match(
    route,
    /s-maxage=900/,
    'the handler must still send its own Cache-Control for browsers and non-Cloudflare intermediaries',
  );
});

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
