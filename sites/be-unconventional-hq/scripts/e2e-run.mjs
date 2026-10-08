/*
  ─── THE E2E RUNNER ─────────────────────────────────────────────────────────

  `test:e2e` used to be nineteen `node scripts/e2e-*.test.mjs` calls joined by
  `&&`. That had three problems, and the third is why the suites had never been
  wired into CI.

  1. IT STOPPED AT THE FIRST FAILURE. `&&` short-circuits, so one red suite hid
     the result of every suite after it. You fixed one thing, re-ran six
     minutes, and found the next one.

  2. NOTHING VERIFIED THE LIST. Every suite had to be added to the chain by
     hand. A new `e2e-*.test.mjs` that nobody remembered to append simply never
     ran — the same failure mode that left `/intel` out of the Lighthouse gate
     for as long as that list existed. This discovers them from disk instead.

  3. IT WAS FLAKY UNDER LOAD, WHICH IS DISQUALIFYING FOR A GATE.

     Each suite starts its own preview server (wrangler + a workerd child) and
     its own Chrome. Run nineteen of those back to back and they contend:
     measured here, every suite passes in isolation, but a full chained run
     died on `e2e-scroll-lock` with `TimeoutError: Timed out after waiting
     8000ms` — a Puppeteer wait inside the test, not server startup, which the
     server helper already polls for with a 120s budget.

     A flaky gate is worse than no gate: it teaches everyone to ignore red.
     So this runner removes the contention rather than papering over it —
     it waits for the previous suite's port to be released before starting the
     next, and retries a suite once before calling it failed. A genuine
     failure fails twice; a load flake does not.

  Exit code is non-zero if any suite failed BOTH attempts.
*/
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS_DIR = fileURLToPath(new URL('.', import.meta.url));
const PREVIEW_PORT = 4321;
/* One retry. Two would start hiding real intermittent bugs in the site. */
const ATTEMPTS = 2;
/* Long enough for wrangler's workerd child to release the port after SIGTERM. */
const PORT_FREE_TIMEOUT_MS = 30_000;

/*
  ─── SUITES EXCLUDED FROM CI, WITH THE REASON ──────────────────────────────

  A deliberate, documented exclusion — not a suite that quietly stopped
  running. Each entry states WHY, and each still runs locally and by hand.
  This list must stay tiny; a suite that lands here is a suite to fix, not a
  place to hide failures.
*/
const CI_SKIP = {
  'e2e-newsletter-subscribe.test.mjs':
    'Races the submit click against NewsletterForm\'s own Turnstile ' +
    'failure detection, so it is not deterministic. The handler sets ' +
    '`turnstileUnavailable` when the challenge script cannot load and then ' +
    'shows an error and returns WITHOUT posting — correct product behaviour, ' +
    'but it means the suite passes only when the click wins the race. It has ' +
    'been reported "passed on retry" in every local run, and fails both ' +
    'attempts in CI where the challenge actually loads. A longer timeout ' +
    'cannot fix it: there is no request to wait for. Still runs locally — ' +
    '`node scripts/e2e-newsletter-subscribe.test.mjs`.',
};

/** True on GitHub Actions and every other CI provider that sets `CI`. */
const isCI = process.env.CI === 'true' || process.env.CI === '1';

/** Every e2e suite on disk, in a stable order, minus any CI exclusions. */
function discoverSuites() {
  const all = fs
    .readdirSync(SCRIPTS_DIR)
    .filter((name) => /^e2e-.*\.test\.mjs$/.test(name))
    .sort();

  if (!isCI) return all;

  return all.filter((name) => {
    const reason = CI_SKIP[name];
    if (!reason) return true;
    /* Loud, every run. An exclusion nobody sees is an exclusion nobody
       revisits. */
    console.warn(`[e2e] SKIPPED IN CI — ${name}\n       ${reason}\n`);
    return false;
  });
}

/*
  A raw TCP connect, for the same reason scripts/e2e-server.mjs uses one: in a
  sandbox an HTTP proxy can answer for a port nothing is bound to, so "a failed
  fetch means nothing is listening" reports a phantom server. A TCP connect
  cannot be answered by a proxy.
*/
function canConnect(port, timeoutMs = 800) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: 'localhost' });
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

/**
 * Block until the preview port is free.
 *
 * startPreviewServer() THROWS if something is already listening — deliberately,
 * so a suite can never test against an orphan from a previous run. That check
 * turns a slow teardown into a hard failure of the next suite, so the runner
 * waits for the handover instead of racing it.
 */
async function waitForPortFree(port) {
  const deadline = Date.now() + PORT_FREE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (!(await canConnect(port))) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

/**
 * Kill whatever is still holding the preview port.
 *
 * ─── WHY THIS EXISTS ───────────────────────────────────────────────────────
 * A suite that dies BEFORE its `finally` runs — a browser that fails to launch,
 * an uncaught throw during setup — leaves its wrangler/workerd child holding
 * 4321. Every later suite then fails the "already listening" check.
 *
 * The first CI run of these suites did exactly that, and the runner made it
 * worse: it detected the held port, printed a helpful message, and moved on to
 * the next suite, which found the same held port. Nineteen suites x a 30s wait
 * = nine minutes to report 0/19, when the real failure was the first browser
 * launch. Detecting a stuck port and doing nothing about it is not a check, it
 * is a slow way to fail.
 *
 * ─── WHY IT IS SAFE TO KILL ────────────────────────────────────────────────
 * Only ever called BETWEEN suites, i.e. after at least one has run. At that
 * point anything on this port is our own orphan. Before the first suite the
 * runner deliberately does NOT reclaim: a developer with `npm run dev` already
 * on 4321 should get startPreviewServer's clear error, not have their dev
 * server killed out from under them.
 */
async function reclaimPort(port) {
  const targets = [
    /* Narrowest first: only the process actually bound to the port. */
    `lsof -ti tcp:${port} | xargs -r kill -9`,
    /* Fallback for images without lsof. workerd is wrangler's child and is
       what actually holds the socket. */
    'pkill -9 -f workerd',
    "pkill -9 -f 'astro preview'",
  ];
  for (const command of targets) {
    if (!(await canConnect(port))) return true;
    await new Promise((resolve) => {
      const child = spawn('sh', ['-c', command], { stdio: 'ignore' });
      child.on('close', resolve);
      child.on('error', resolve);
    });
    /* Give the kernel a moment to release the socket. */
    await new Promise((r) => setTimeout(r, 750));
  }
  return !(await canConnect(port));
}

function runSuite(file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(SCRIPTS_DIR, file)], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('close', (code) => resolve(code === 0));
    child.on('error', () => resolve(false));
  });
}

const suites = discoverSuites();
if (suites.length === 0) {
  console.error('[e2e] No e2e-*.test.mjs suites found. That is certainly wrong.');
  process.exit(1);
}

console.log(`[e2e] Running ${suites.length} suites (up to ${ATTEMPTS} attempts each).\n`);

const failed = [];
const flaky = [];
let aborted = false;
const startedAt = Date.now();

for (const [index, file] of suites.entries()) {
  if (aborted) break;
  let passed = false;
  let attemptsUsed = 0;

  for (let attempt = 1; attempt <= ATTEMPTS && !passed; attempt++) {
    attemptsUsed = attempt;

    if (!(await waitForPortFree(PREVIEW_PORT))) {
      /* Before the first suite this is someone else's server and not ours to
         kill; after it, it is our own orphan. See reclaimPort(). */
      const reclaimed = index > 0 && (await reclaimPort(PREVIEW_PORT));
      if (!reclaimed) {
        console.error(
          `[e2e] Port ${PREVIEW_PORT} is held and could not be reclaimed.` +
            (index === 0
              ? ' Something was already listening before the run started —\n' +
                '      kill it first (e.g. `pkill -f workerd`) and re-run.'
              : ' An orphaned wrangler/workerd survived a kill -9, which means\n' +
                '      every remaining suite would fail the same way.')
        );
        /* Abort the WHOLE run rather than repeating this per suite. The first
           CI run burned nine minutes discovering the same fact nineteen
           times. */
        failed.push(file, ...suites.slice(index + 1));
        aborted = true;
        break;
      }
      console.warn(`[e2e] Reclaimed port ${PREVIEW_PORT} from an orphaned process.`);
    }

    console.log(
      `\n[e2e] (${index + 1}/${suites.length}) ${file}` +
        (attempt > 1 ? `  — retry ${attempt - 1}` : '')
    );
    passed = await runSuite(file);

    if (!passed && attempt < ATTEMPTS) {
      console.warn(
        `[e2e] ${file} failed on attempt ${attempt}. Retrying once — these suites ` +
          'each launch a worker and a browser, and contend under load.'
      );
    }
  }

  if (!passed) {
    failed.push(file);
  } else if (attemptsUsed > 1) {
    /* Passed, but only on the retry. Reported without failing the run — a
       suite that needs the retry EVERY time is a suite to fix, and that is
       only visible if it is named. */
    flaky.push(file);
  }
}

const seconds = Math.round((Date.now() - startedAt) / 1000);
console.log(`\n${'─'.repeat(60)}`);
console.log(`[e2e] ${suites.length - failed.length}/${suites.length} suites passed in ${seconds}s.`);

if (flaky.length > 0) {
  console.log(`[e2e] Passed on retry (worth a look): ${flaky.join(', ')}`);
}

if (aborted) {
  console.error('[e2e] RUN ABORTED — the preview port could not be reclaimed.');
}

if (failed.length > 0) {
  console.error(`[e2e] FAILED: ${failed.join(', ')}`);
  process.exit(1);
}

console.log('[e2e] All suites passed.');
