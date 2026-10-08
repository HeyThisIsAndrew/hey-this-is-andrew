/*
  public/_headers declares each path exactly once.

  ─── THE OUTAGE THIS GUARDS ───────────────────────────────────────────────
  A second `/*` block was added to carry the RFC 8288 Link header for #192.
  It looked additive. It was not.

  Cloudflare applies the LAST matching rule for a path, not the union of the
  matching rules, so the new `/*` REPLACED the existing one. The site shipped
  to production with no Content-Security-Policy, no Strict-Transport-Security,
  no X-Frame-Options, no X-Content-Type-Options, no Referrer-Policy and no
  Permissions-Policy on any page.

  It was invisible in review (the diff reads as "add a header"), invisible in
  `npm test`, and invisible to the Lighthouse gate, which runs against a local
  build. It surfaced as Best Practices 73 in a production Lighthouse run, with
  all four Trust and Safety audits failing at once.

  Losing the CSP also takes `unsafe-eval` with it, which Partytown requires to
  rehydrate its `resolveUrl`; the same report showed the CORS failures that
  issue #63 documented as the signature of exactly that.

  So: one block per path. Additions go inside the block that already exists.
*/
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const raw = fs.readFileSync(path.join(ROOT, 'public', '_headers'), 'utf8');

/** Path lines are unindented and start with `/`; header lines are indented. */
const paths = raw
  .split('\n')
  .filter((line) => /^\/\S*\s*$/.test(line))
  .map((line) => line.trim());

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (error) { failures += 1; console.error(`  ✗ ${name}\n      ${error.message}`); }
}

console.log('\npublic/_headers integrity');

check('no path is declared twice', () => {
  const seen = new Map();
  const dupes = [];
  for (const p of paths) {
    if (seen.has(p)) dupes.push(p);
    seen.set(p, true);
  }
  assert.deepEqual(
    dupes,
    [],
    `duplicate path block(s): ${dupes.join(', ')}. Cloudflare keeps only the LAST ` +
      'one, so the earlier block is silently dropped. Merge into the existing block.',
  );
});

check('the site-wide block still carries every security header', () => {
  /* Each of these was live, then silently absent in production for the
     duration of the duplicate-block regression. Named individually so a
     future edit cannot quietly drop one. */
  const block = raw.slice(raw.indexOf('\n/*\n'), raw.indexOf('\n/admin\n'));
  for (const header of [
    'Content-Security-Policy',
    'Strict-Transport-Security',
    'X-Frame-Options',
    'X-Content-Type-Options',
    'Referrer-Policy',
    'Permissions-Policy',
  ]) {
    assert.ok(block.includes(`${header}:`), `${header} is missing from the /* block`);
  }
});

check("the CSP keeps 'unsafe-eval', which Partytown cannot work without", () => {
  /* Not a nice-to-have: without it Partytown's `new Function` rehydration of
     resolveUrl is blocked, it loads vendor scripts cross-origin instead, and
     they fail CORS. See the long note in _headers and issue #63. */
  const policy = raw.split('\n').map((l) => l.trim()).find((l) => l.startsWith('Content-Security-Policy:'));
  assert.ok(policy, 'no Content-Security-Policy directive found in _headers');
  assert.match(policy, /script-src[^;]*'unsafe-eval'/);
});

check("script-src does NOT allow data:, whatever a QA report says", () => {
  /*
    ─── A FIX THAT WAS ASKED FOR, MEASURED, AND DECLINED ────────────────────

    A QA swarm reported a CSP violation on /featured/marvel-comics and
    recommended adding `data:` to script-src, attributing the blocked script
    to "likely Google Analytics/Tag Manager/Meta".

    Both halves of that were wrong, and the evidence is reproducible:

      WHAT IT ACTUALLY IS. The only data: script in the whole build lives in
      Astro's own ClientRouter bundle, and it is EMPTY — the URI is literally
      `data:application/javascript,` with nothing after the comma. Astro
      appends it to force the browser to flush pending inline module scripts
      after a view transition. No analytics vendor is involved; every real
      one on this site (GTM, GA, Meta, TikTok, Clarity) is already allowlisted
      by origin a few lines above.

      WHAT BLOCKING IT COSTS. Nothing. Served with this exact policy and the
      script blocked: 23 module scripts still executed after a client-side
      navigation, both hub filter buttons still bound (data-bound="true"),
      filtering narrowed 6 tiles to 2, and toggling restored all 6. The
      swarm's own agents 2 and 7 passed on the same pages under the same
      policy.

      WHAT ADDING IT COSTS. `data:` in script-src is a documented XSS
      amplifier: it lets any injected <script src="data:..."> run, which is
      most of what script-src exists to stop. Trading that for a console
      warning is not a trade.

    If the warning itself ever needs to go, the answer is upstream in Astro,
    not here.
  */
  /*
    Read the DIRECTIVE, not the file. `_headers` explains itself at length and
    the word "script-src" appears in a COMMENT twenty lines above the policy,
    so a regex run over the whole file matches that prose instead. The first
    version of this guard did exactly that and passed with `data:` injected
    into the real policy, which is the one thing it exists to catch.
  */
  const policyLine = raw
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('Content-Security-Policy:'));
  assert.ok(policyLine, 'no Content-Security-Policy directive found in _headers');

  const scriptSrc = /script-src[^;]*/.exec(policyLine)?.[0] ?? '';
  assert.ok(scriptSrc, 'the CSP has no script-src directive at all');
  assert.ok(
    !/\bdata:/.test(scriptSrc),
    'script-src allows data:, which lets an injected <script src="data:..."> execute. The ' +
      'only data: script this site loads is an EMPTY one from Astro ClientRouter, and ' +
      'blocking it was measured to break nothing.',
  );

  /* img-src data: is fine and separate: inline SVGs and placeholders use it. */
  assert.match(policyLine, /img-src[^;]*\bdata:/, 'img-src should still permit data: URIs');
});

check('the RFC 8288 Link header lives inside that same block', () => {
  const block = raw.slice(raw.indexOf('\n/*\n'), raw.indexOf('\n/admin\n'));
  assert.match(block, /Link: <\/\.well-known\/api-catalog>/, 'the Link header moved out of /*');
});

console.log(
  failures === 0
    ? '\n✅ _headers integrity checks passed.\n'
    : `\n❌ ${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
