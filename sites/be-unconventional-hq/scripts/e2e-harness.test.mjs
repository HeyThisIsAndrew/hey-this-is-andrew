/*
  THE E2E HARNESS ITSELF, PINNED.

  These are unit tests for the machinery that RUNS the browser suites, not for
  the site. They live in `npm test` rather than `npm run test:e2e` because they
  need no browser and take milliseconds — and because a harness bug takes all
  nineteen suites down at once, so it should be caught by the fast job.

  THE INCIDENT — the first CI run of the e2e job, 0/19 in nine minutes.

  Two independent faults, both in the harness.

  1. CHROME COULD NOT LAUNCH AS A NON-ROOT CI USER.

       FATAL:zygote_host_impl_linux.cc] No usable sandbox! If you are running
       on Ubuntu 23.10+ ... that has disabled unprivileged user namespaces
       with AppArmor ...

     e2e-browser.mjs passed `--no-sandbox` only when `process.getuid() === 0`.
     GitHub's ubuntu-latest runs as `runner`, not root, so the check did not
     fire — and the image restricts unprivileged user namespaces, so Chrome
     could neither use its sandbox nor fall back. Every suite failed to launch.

  2. THE RUNNER TURNED ONE CRASH INTO NINE MINUTES.

     The first suite died before its cleanup ran, leaving wrangler/workerd
     holding port 4321. The runner detected the held port, printed a helpful
     message, and moved on — to a suite that found the same held port.
     Nineteen suites x a 30s wait, to report a fact discovered in the first
     ten seconds. Detecting a stuck port and doing nothing about it is not a
     check, it is a slow way to fail.
*/
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const runner = fs.readFileSync(path.join(ROOT, 'scripts/e2e-run.mjs'), 'utf8');
const ci = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');

/** The steps of one job in ci.yml, as raw text. */
function jobBlock(name) {
  const start = ci.indexOf(`\n  ${name}:\n`);
  assert.ok(start !== -1, `job "${name}" not found in ci.yml`);
  /* Up to the next top-level job key (two-space indent, non-comment). */
  const rest = ci.slice(start + 1);
  const next = rest.search(/\n  [a-z][a-z0-9-]*:\n/);
  return next === -1 ? rest : rest.slice(0, next);
}

import { sandboxUnavailableFor } from './e2e-browser.mjs';

console.log('E2E harness:');

test('CI disables the sandbox even as a NON-ROOT user', () => {
  /* The exact GitHub Actions case: uid 1001, CI=true. This is what the old
     root-only check missed, and it is why all nineteen suites died at launch. */
  assert.equal(
    sandboxUnavailableFor({ uid: 1001, ci: 'true' }),
    true,
    'GitHub runs as `runner` (non-root) on an image that blocks unprivileged\n' +
      '      user namespaces, so Chrome can neither sandbox nor fall back. Without\n' +
      '      --no-sandbox every suite dies at launch with "No usable sandbox!".',
  );
  assert.equal(sandboxUnavailableFor({ uid: 1001, ci: '1' }), true, 'CI=1 counts too');
});

test('root disables it regardless of CI', () => {
  assert.equal(sandboxUnavailableFor({ uid: 0, ci: undefined }), true);
});

test('a developer machine KEEPS the sandbox', () => {
  /* Pure function, so this holds no matter what uid the test itself runs as —
     which is the point of extracting it. */
  assert.equal(
    sandboxUnavailableFor({ uid: 1000, ci: undefined }),
    false,
    'Chrome\'s sandbox is a real security boundary and must stay ON locally.\n' +
      '      It is disabled only where it cannot work: root, or CI.',
  );
  assert.equal(sandboxUnavailableFor({ uid: 1000, ci: '' }), false);
  assert.equal(sandboxUnavailableFor({ uid: 1000, ci: 'false' }), false);
});

test('CI launches also get --disable-dev-shm-usage', () => {
  const browser = fs.readFileSync(path.join(ROOT, 'scripts/e2e-browser.mjs'), 'utf8');
  assert.ok(
    /--disable-dev-shm-usage/.test(browser),
    'CI containers give /dev/shm 64 MB and Chrome writes its shared memory\n' +
      '      there. Without this a browser that launches fine crashes partway through\n' +
      '      a page, and it reads like a test failure rather than an environment one.',
  );
});

test('the runner reclaims a port an orphaned process is holding', () => {
  assert.ok(
    /async function reclaimPort\(/.test(runner),
    'A suite that dies before its cleanup leaves wrangler/workerd on 4321, and\n' +
      '      every later suite then fails startPreviewServer\'s "already listening"\n' +
      '      check. The runner has to take the port back.',
  );
  assert.ok(
    /lsof -ti tcp:\$\{port\}/.test(runner),
    'kill the process actually bound to the port first, before any broad pkill',
  );
});

test('it does NOT kill a pre-existing server before the first suite', () => {
  assert.ok(
    /index > 0 && \(await reclaimPort\(/.test(runner),
    'Reclaiming must be gated on index > 0. Before the first suite, anything on\n' +
      '      4321 belongs to the developer — killing their `npm run dev` is not the\n' +
      '      harness\'s business. After a suite has run, an orphan is ours.',
  );
});

test('an unreclaimable port aborts the run instead of repeating per suite', () => {
  assert.ok(
    /aborted = true/.test(runner) && /if \(aborted\) break;/.test(runner),
    'When the port cannot be reclaimed, every remaining suite fails identically.\n' +
      '      The run must stop. The first CI run spent nine minutes rediscovering the\n' +
      '      same fact nineteen times.',
  );
  assert.ok(
    /failed\.push\(file, \.\.\.suites\.slice\(index \+ 1\)\)/.test(runner),
    'the un-run suites must still be reported as failed — silently skipping them\n' +
      '      would turn an aborted run into a green one.',
  );
});

/*
  ─── `npm test` IS THE OFFLINE SUITE, AND MUST STAY BUILD-INDEPENDENT ───────

  THE INCIDENT. A search-relevance suite that reads
  dist/client/api/search-index.json was added to `npm test` — and placed
  FIRST. The chain is joined by `&&`, so its `process.exit(1)` on a missing
  index took all thirty offline suites with it, and CI's unit job runs
  `npm test` with no build step, so it could never have passed. The PR sat
  with a red `test-and-build` and a report claiming 130/130.

  The cost was not the broken suite. It was the thirty working ones: among
  them command-palette.test.mjs, which pins the search palette's default view
  and would have caught, on the first run, that the same branch had knocked
  two of the four hub categories out of it.

  A suite that needs built output belongs in `test:e2e`, which CI runs in the
  job that has already produced dist/. scripts/e2e-run.mjs discovers those
  from disk, so moving the file is the whole of the fix.
*/
test('no suite in `npm test` reads build output', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const suites = [...pkg.scripts.test.matchAll(/scripts\/([\w.-]+\.test\.mjs)/g)].map((m) => m[1]);
  assert.ok(suites.length > 25, `expected the full offline suite, found ${suites.length}`);

  /*
    Comments are stripped first, the same way command-palette.test.mjs does it:
    a suite that EXPLAINS this rule quotes the path it is about, and this test
    matched itself on its own docstring the first time it ran.
  */
  const codeOf = (f) => fs.readFileSync(path.join(ROOT, 'scripts', f), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    /*
      A DEPENDENCY'S `dist/` IS NOT OUR BUILD OUTPUT.

      The rule above is about `dist/` as produced by `npm run build`, which the
      unit job never runs. `node_modules/<pkg>/dist/...` is a published file
      that exists the moment `npm ci` finishes, so reading one is exactly as
      safe as importing the package.

      Without this, route-cache.test.mjs was flagged for reading Astro's own
      shipped cache schema out of `node_modules/astro/dist/`. The advice in the
      failure message (rename to `e2e-*`) would have moved a suite that needs
      no build into the job that builds, and quietly stopped it running in the
      job that actually gates merges.
    */
    .replace(/node_modules\/[\w@./-]+/g, '');
  const offenders = suites.filter((f) => /\bdist\//.test(codeOf(f)));
  assert.deepEqual(offenders, [],
    `${offenders.join(', ')} read build output but run in \`npm test\`, which CI runs ` +
    'with no build step. Rename to e2e-*.test.mjs so scripts/e2e-run.mjs picks it up ' +
    'in the job that has already built.');
});

/*
  And the same boundary from the other side: `npm test` short-circuits on `&&`,
  so ANY suite that exits before its assertions run hides every suite after it.
  A bare process.exit in the offline suite is therefore never local damage.
*/
test('no suite in `npm test` bails out with process.exit before its assertions', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const suites = [...pkg.scripts.test.matchAll(/scripts\/([\w.-]+\.test\.mjs)/g)].map((m) => m[1]);

  const offenders = suites.filter((f) => {
    const src = fs.readFileSync(path.join(ROOT, 'scripts', f), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    /*
      Reporting a real failure at the END is what these suites are for; the
      pattern being caught is the guard clause that quits before any test runs,
      which is what a missing prerequisite looks like.
    */
    const exits = [...src.matchAll(/process\.exit\(1\)/g)].map((m) => m.index);
    const firstTest = src.search(/\n\s*test\(/);
    return firstTest !== -1 && exits.some((i) => i < firstTest);
  });
  assert.deepEqual(offenders, [],
    `${offenders.join(', ')} can exit(1) before running a single assertion. In an ` +
    '`&&` chain that takes every later suite down with it.');
});

test('the e2e job does NOT blank the Turnstile site key', () => {
  /*
    THE INCIDENT — first otherwise-healthy CI run of these suites, 19/20:

      ✗ the newsletter widget container exists but nothing is rendered yet
      TimeoutError: Waiting failed: 5000ms exceeded

    The e2e job had copied `echo "PUBLIC_TURNSTILE_SITE_KEY=" >> .env` from the
    Lighthouse job. An empty key makes the Turnstile widget omit ITSELF — which
    is exactly why the Lighthouse job sets it, to keep ~234 KB of
    challenge-platform script out of the pages it measures.

    But e2e-turnstile-lazy exists to test that widget's lazy-load behaviour.
    The step disabled the thing the suite tests, so the suite could not pass at
    any point. Reproduced locally by adding the line, and it passes without it.

    The suites must drive the pages as production builds them.
  */
  const job = jobBlock('e2e');
  assert.ok(
    !/PUBLIC_TURNSTILE_SITE_KEY=\s*(\"|'|$)/m.test(job),
    'The e2e job must not write an EMPTY PUBLIC_TURNSTILE_SITE_KEY. It makes the\n' +
      '      widget omit itself, and e2e-turnstile-lazy tests that widget.',
  );
});

test('the e2e job uses the always-passes TEST key, not production\'s', () => {
  /*
    THE SECOND FAILURE, after removing the empty key. Production's key went in
    instead, and e2e-newsletter-subscribe died:

      BROWSER: [Cloudflare Turnstile] Error: 600010.
      TimeoutError: Timed out after waiting 8000ms

    600010 is "sitekey not valid for this domain". The production key is
    registered for beunconventionalhq.com; the suites run on localhost:4321, so
    Turnstile refuses a token and the subscribe flow waits forever.

    Cloudflare's test key is the only value that satisfies BOTH suites: it
    renders, so the lazy-load suite has a widget to watch, and it is valid on
    any domain, so the subscribe suite gets a token.

    Worth knowing why this cannot be caught locally: a dev sandbox that blocks
    challenges.cloudflare.com never reaches the domain check, so both suites
    pass there with the production key — the server fails open when no token
    arrives. Only CI sees it.
  */
  const job = jobBlock('e2e');
  assert.ok(
    /PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA/.test(job),
    "the e2e job must use Cloudflare's always-passes site key. Production's is\n" +
      '      domain-locked to beunconventionalhq.com and fails with 600010 on localhost.',
  );
  const production = fs
    .readFileSync(path.join(ROOT, 'wrangler.jsonc'), 'utf8')
    .match(/"PUBLIC_TURNSTILE_SITE_KEY":\s*"([^"]+)"/)?.[1];
  assert.ok(production, 'could not read the production site key from wrangler.jsonc');
  assert.ok(
    !job.includes(production),
    `the e2e job must not pin production's site key (${production}) — it is\n` +
      '      registered for beunconventionalhq.com and cannot issue a token on localhost.',
  );
});

test('the Lighthouse gate still DOES blank it', () => {
  /* The complement — removing it there would put a third party's variable
     response time back inside the performance gate. */
  const job = jobBlock('test-and-build');
  assert.ok(
    /PUBLIC_TURNSTILE_SITE_KEY=/.test(job),
    'the Lighthouse job must keep writing an empty key: the widget pulls api.js\n' +
      '      and ~234 KB of challenge-platform script, which is most of a second of\n' +
      '      bandwidth taken from the LCP image on a throttled connection.',
  );
});

test('the CI skip-list is tiny, documented, and loud', () => {
  /*
    e2e-newsletter-subscribe is excluded from CI because it is not
    deterministic: it races the submit click against NewsletterForm's own
    Turnstile failure detection. When the challenge script cannot load the
    handler sets `turnstileUnavailable`, shows an error and returns WITHOUT
    posting — correct product behaviour, but it means the suite passes only
    when the click wins the race. It was reported "passed on retry" in every
    local run and failed both attempts in CI, where the challenge does load.
    A longer timeout cannot fix it; there is no request to wait for.

    The danger of any skip-list is that it grows quietly into a place to hide
    failures. So: it must stay small, every entry must carry a reason, and the
    skip must be printed on every run.
  */
  const entries = [...runner.matchAll(/^\s*'(e2e-[^']+\.test\.mjs)':/gm)].map((m) => m[1]);
  assert.ok(
    entries.length <= 2,
    `${entries.length} suites are skipped in CI. This list is for suites that\n` +
      '      CANNOT be made deterministic, not a place to park failures. Fix them.',
  );
  assert.ok(
    /console\.warn\(`\[e2e\] SKIPPED IN CI/.test(runner),
    'every skip must be printed on every run — an exclusion nobody sees is an\n' +
      '      exclusion nobody revisits.',
  );
  assert.ok(
    /if \(!isCI\) return all;/.test(runner),
    'the skip must apply to CI ONLY. These suites still have to run locally, or\n' +
      '      excluding them from CI quietly deletes their coverage entirely.',
  );
  /* And the skipped suite must still exist — a stale entry would silently
     stop matching and mean nothing. */
  for (const name of entries) {
    assert.ok(
      fs.existsSync(path.join(ROOT, 'scripts', name)),
      `${name} is on the skip-list but no longer exists. Remove the entry.`,
    );
  }
});

test('the retry is still one, and still opt-out-able only by editing', () => {
  const m = runner.match(/const ATTEMPTS = (\d+)/);
  assert.ok(m, 'ATTEMPTS not found');
  assert.equal(
    Number(m[1]),
    2,
    'One retry. Two would start hiding genuinely intermittent bugs in the site,\n' +
      '      which is the opposite of what this gate is for.',
  );
});

test('suites are discovered from disk, never a hand-maintained list', () => {
  assert.ok(
    /readdirSync\(SCRIPTS_DIR\)[\s\S]{0,120}e2e-\.\*\\\.test\\\.mjs/.test(runner),
    'A hardcoded list that nothing verifies is how a suite goes unrun — the same\n' +
      '      failure that kept /intel out of the Lighthouse gate for as long as that\n' +
      '      list existed.',
  );
  /* And the discovery must actually see the suites that exist. */
  const onDisk = fs
    .readdirSync(path.join(ROOT, 'scripts'))
    .filter((f) => /^e2e-.*\.test\.mjs$/.test(f));
  assert.ok(
    onDisk.length >= 19,
    `only ${onDisk.length} e2e suites found on disk; expected at least 19`,
  );
});

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
