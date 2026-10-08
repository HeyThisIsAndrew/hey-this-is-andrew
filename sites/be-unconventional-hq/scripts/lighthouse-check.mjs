// Lighthouse CI gate. Audits a representative set of pages against a built
// `dist/` and fails (exit 1) if any category dips below the threshold.
//
// Requires `npm run build` to have already produced `dist/`. Boots the same
// preview server as `npm run preview` (patched entry.mjs + astro preview),
// polls it with real HTTP requests until it actually answers (the e2e
// suite's stdout-text-match readiness check is known-flaky — see the
// chaos-swarm audit), then runs Lighthouse against each page in one shared
// Chrome instance.
//
// `astro preview` (workerd's local simulation) serves everything
// uncompressed — verified empirically, no Content-Encoding header on any
// response. Real production is Cloudflare's edge, which brotli/gzip-
// compresses every text response automatically. Auditing the bare preview
// server measures a strictly slower target than what ships, so a small
// compressing reverse proxy sits between Lighthouse and the preview server
// to approximate real edge behavior. Without this the 90% gate would be
// unpassable regardless of code quality.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import puppeteer from 'puppeteer';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PREVIEW_PORT = 4323;
const PROXY_PORT = 4324;
const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}`;
const BASE_URL = `http://localhost:${PROXY_PORT}`;
/*
  ─── TWO BANDS, NOT ONE ─────────────────────────────────────────────────────

  This gate used to be a single 90% line: below it, red build. That made sense
  when the site was small and every score sat at 96-100, but it does not scale
  with the thing the site exists to do. Each published article adds a cover
  image, a card on /feed and /intel, and more DOM on the hub pages, so the
  scores drift down as content accrues. A hard 90 turns ordinary publishing
  into a build failure and trains everyone to ignore the gate — which is worse
  than a lower bar, because an ignored gate catches nothing.

  So the line is split, at the owner's direction:

    >= 90%        PASS. Where the site should be, and usually is.
    80% to 90%    WARN. Printed loudly, does NOT fail the build. This is the
                  drift band: worth looking at, not worth blocking a post.
    < 80%         FAIL. Something is actually broken — an unoptimised hero, a
                  render-blocking third party, a layout shift on the LCP
                  element. All three of those have happened here.

  The warn band is deliberately wide. A narrow one just moves the ignoring
  problem down ten points.
*/
const PASS_THRESHOLD = 0.9; // >= this is green
const FAIL_THRESHOLD = 0.8; // < this fails the build

/* The score that triggers the confirmation re-runs and the diagnostics dump.
   Anything in the warn band or below is worth a second look, so this is the
   WARN line, not the fail line — a page drifting to 85 should still print its
   metrics, or the warning tells you nothing actionable. */
const THRESHOLD = PASS_THRESHOLD;
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];
/*
  Every primary surface of the site. `/intel` was missing for as long as this
  list has existed — not for any reason, it was simply never added, and nothing
  checked the list against the site's actual routes. It is the articles index,
  one of the four things in the main nav, and it was the only one unaudited.

  Kept in sync by scripts/lighthouse-pages.test.mjs, which fails if a route in
  the main navigation is absent here.
*/
const PAGES = ['/', '/feed', '/intel', '/events', '/featured', '/about'];

/*
  ─── AND ONE ACTUAL ARTICLE ─────────────────────────────────────────────────

  Every entry above is a hub. Not one is an /intel/<slug> page, which is the
  page class that regressed hard enough for the owner to notice: a portrait
  cover shipped at full resolution with no srcset, against a hardcoded 16:9
  width/height that produced a ~660px layout shift on the LCP element. The
  gate measured six pages and none of them could see it.

  Chosen from articles.json rather than hardcoded, because a hardcoded slug
  rots the moment that article is unpublished or renamed, and a gate pointed
  at a 404 scores whatever a 404 scores. Newest first, since a new article is
  where an unoptimised image arrives.

  Applies the same eligibility the route does — non-hidden, has a body, has a
  slug, not a reserved segment — so this can only ever name a page that
  actually exists. Returns null on an empty or unreadable snapshot and the
  gate simply audits the hubs, exactly as before.
*/
function newestArticlePath() {
  try {
    const raw = fs.readFileSync(path.join(ROOT, 'src/data/articles.json'), 'utf-8');
    const eligible = JSON.parse(raw)
      .filter(
        (r) =>
          r &&
          !r.editorial?.hidden &&
          r.hasBody &&
          typeof r.slug === 'string' &&
          r.slug &&
          r.slug !== 'topic' &&
          r.slug !== 'page',
      )
      .sort((a, b) => new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime());
    return eligible.length ? `/intel/${eligible[0].slug}` : null;
  } catch {
    return null;
  }
}

/** What the gate actually audits: every hub, plus the newest article. */
const AUDIT_PAGES = [...PAGES, newestArticlePath()].filter(Boolean);
const SERVER_READY_TIMEOUT_MS = 30_000;
/*
  Form factor. Lighthouse's default is MOBILE (a throttled mid-tier phone),
  which is the harder target and stays the default here so the gate cannot be
  softened by accident. `--desktop` audits the desktop preset instead, which
  is the number tracked separately (it runs materially higher — no CPU/network
  throttling and a wider viewport, so more of the page is in the initial
  view). Reports are written to separate files so a desktop run never
  overwrites the mobile evidence.
*/
const DESKTOP = process.argv.includes('--desktop');
const FORM_FACTOR = DESKTOP ? 'desktop' : 'mobile';
const REPORTS_DIR = path.join(ROOT, DESKTOP ? '.lighthouse-reports-desktop' : '.lighthouse-reports');
const COMPRESSIBLE_TYPES = /^(text\/|application\/(javascript|json|xml|manifest\+json)|image\/svg\+xml)/;

function startCompressingProxy() {
  const proxy = http.createServer((clientReq, clientRes) => {
    const upstreamReq = http.request(
      {
        host: 'localhost',
        port: PREVIEW_PORT,
        path: clientReq.url,
        method: clientReq.method,
        headers: { ...clientReq.headers, 'accept-encoding': 'identity', host: `localhost:${PREVIEW_PORT}` },
      },
      (upstreamRes) => {
        const contentType = upstreamRes.headers['content-type'] || '';
        const acceptsBr = (clientReq.headers['accept-encoding'] || '').includes('br');
        const compressible = COMPRESSIBLE_TYPES.test(contentType) && acceptsBr;

        if (!compressible) {
          clientRes.writeHead(upstreamRes.statusCode, upstreamRes.headers);
          upstreamRes.pipe(clientRes);
          return;
        }

        const chunks = [];
        upstreamRes.on('data', (c) => chunks.push(c));
        upstreamRes.on('end', () => {
          const body = Buffer.concat(chunks);
          const compressed = zlib.brotliCompressSync(body, {
            params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 6 },
          });
          const headers = { ...upstreamRes.headers };
          headers['content-encoding'] = 'br';
          headers['content-length'] = compressed.length;
          clientRes.writeHead(upstreamRes.statusCode, headers);
          clientRes.end(compressed);
        });
      }
    );
    upstreamReq.on('error', (err) => {
      clientRes.writeHead(502);
      clientRes.end(String(err));
    });
    clientReq.pipe(upstreamReq);
  });
  return new Promise((resolve, reject) => {
    proxy.on('error', reject);
    proxy.listen(PROXY_PORT, () => resolve(proxy));
  });
}

function fail(message) {
  console.error(`\n[lighthouse-check] ${message}`);
  process.exitCode = 1;
}

/*
  THIRD-PARTY REACHABILITY.

  This gate reported the homepage green while PageSpeed scored the same commit
  at 58% mobile. Some agent sandboxes (the Claude Code remote environment among
  them) have no egress to youtube.com, so ~845 KiB of YouTube player JavaScript
  that a real visitor downloads was silently absent from those runs. The gate
  was not measuring a faster page, it was measuring a DIFFERENT page, and then
  reporting green.

  READ THIS BEFORE TRUSTING THE NUMBER BELOW. GitHub Actions is NOT one of
  those sandboxes: it reaches youtube.com, googletagmanager.com and the rest
  fine, and this probe correctly stays quiet there about all of them except
  static.cloudflareinsights.com. Yet CI still scored `/` at 94% mobile on the
  commit PageSpeed scored 58%, BEFORE and AFTER the fix that removed the
  YouTube payload from the critical path. So an unreachable third party is one
  cause of the gap and demonstrably not the whole of it.

  The larger one is the origin. This gate audits `astro preview` on localhost,
  where TTFB is ~15ms and every first-party asset is effectively free, so the
  LCP image wins its race no matter what else is competing. Production answers
  over a real network from Cloudflare. Lighthouse's simulated throttling models
  the link, not the origin, and cannot manufacture that difference. Closing it
  means pointing the audit at a deployed preview URL, which this gate does not
  yet do.

  Hence: probe, report, and never fail. A missing third party is a caveat on a
  number, not a verdict on a build — and the caveat is deliberately worded to
  send the reader to PageSpeed rather than to imply that a quiet probe means
  the measurement is complete. It is not.
*/
const THIRD_PARTY_ORIGINS = [
  'https://www.youtube.com',
  'https://i.ytimg.com',
  'https://www.googletagmanager.com',
  'https://fonts.gstatic.com',
  'https://static.cloudflareinsights.com',
];

let unreachableThirdParties = [];

async function probeThirdParties() {
  const results = await Promise.all(
    THIRD_PARTY_ORIGINS.map(async (origin) => {
      try {
        const res = await fetch(origin, { method: 'GET', signal: AbortSignal.timeout(8000) });
        return isEgressDenial(res) ? origin : null;
      } catch {
        /* DNS failure, refused connection, timeout: unambiguously unreachable. */
        return origin;
      }
    }),
  );
  return results.filter(Boolean);
}

/*
  A blocked host does NOT throw. The first version of this probe assumed it
  did, accepted "any response at all" as proof the tunnel opened, and reported
  every origin reachable while the sandbox was answering each one itself:

      HTTP/1.1 403  x-deny-reason: host_not_allowed
      Host not in allowlist: www.youtube.com.

  That is the same false green the probe exists to stop, one layer down. So
  read the response, not just the fact that one arrived.

  Two signals, deliberately narrow so a CI runner with real egress never trips
  them and starts crying wolf:

    1. `x-deny-reason` — the agent sandbox's own marker. Definitive.
    2. A 403 whose body is a short `text/plain` note. Real origins answer 403
       with HTML or JSON, and the two origins that matter most here
       (youtube.com/iframe_api, googletagmanager.com) answer 200 to anyone.

  A proxy that blocks with neither shape is still missed, which is why the
  warning says "confirm against PageSpeed Insights" rather than claiming the
  measurement is complete.
*/
function isEgressDenial(res) {
  if (res.headers.get('x-deny-reason')) return true;
  const type = res.headers.get('content-type') || '';
  const length = Number(res.headers.get('content-length') || '0');
  return res.status === 403 && type.startsWith('text/plain') && length > 0 && length < 512;
}

async function waitForServer(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.status < 500) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function run() {
  if (!fs.existsSync(path.join(ROOT, 'dist/server/entry.mjs'))) {
    fail('dist/server/entry.mjs not found. Run `npm run build` first.');
    return;
  }

  unreachableThirdParties = await probeThirdParties();
  if (unreachableThirdParties.length) {
    console.warn(
      `\n[lighthouse-check] ⚠️  PARTIAL MEASUREMENT — ${unreachableThirdParties.length} third-party origin(s) unreachable:\n` +
        unreachableThirdParties.map((o) => `      ${o}`).join('\n') +
        `\n    Their bytes and main-thread cost are ABSENT from every score below.\n` +
        `    Real visitors download them. Treat these numbers as an upper bound,\n` +
        `    and confirm against PageSpeed Insights before calling a page fast.\n`,
    );
  }

  console.log('[lighthouse-check] Starting preview server...');
  // detached so the whole process group (npm -> astro preview -> workerd) can
  // be killed together in finally(). Killing just the npm PID leaves workerd
  // running, which orphans the port and hangs any process still piping this
  // script's stdout.
  const server = spawn('npm', ['run', 'preview', '--', '--port', String(PREVIEW_PORT)], {
    cwd: ROOT,
    stdio: 'pipe',
    detached: true,
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', PUBLIC_DISABLE_ANALYTICS: 'true' },
  });
  server.stderr.on('data', (d) => process.stderr.write(`[preview] ${d}`));

  let chrome;
  let proxy;
  const results = [];
  try {
    const up = await waitForServer(`${PREVIEW_URL}/`, SERVER_READY_TIMEOUT_MS);
    if (!up) {
      fail(`Preview server did not respond within ${SERVER_READY_TIMEOUT_MS}ms.`);
      return;
    }
    console.log('[lighthouse-check] Preview server is up. Starting compression proxy...');
    proxy = await startCompressingProxy();

    console.log('[lighthouse-check] Launching Chrome...');
    chrome = await chromeLauncher.launch({
      chromePath: await puppeteer.executablePath(),
      chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    });

    fs.mkdirSync(REPORTS_DIR, { recursive: true });

    /*
      A Lighthouse score is a MEASUREMENT, not a property of the code, and on a
      shared CI runner the noisiest input by far is total-blocking-time — it is
      pure main-thread timing, so a noisy neighbour on the runner moves it
      tens of percent. This gate was failing on that noise:

        run 693 (push)         commit eda768a  ->  / = 96%  PASS
        run 694 (pull_request) commit eda768a  ->  / = 89%  FAIL

      Same commit, same workflow, opposite results; the same flip happened in
      reverse on a01eba2f (685 FAIL 88% / 686 PASS). Locally the same build
      scores 96-100 mobile and 100 desktop.

      So a page is only failed after being CONFIRMED: if any category comes in
      under the threshold, that page is re-audited and the MEDIAN of the
      samples decides. One unlucky sample can no longer fail the build, while a
      genuine regression — which reproduces every time — still fails all of
      them and still fails the gate. The samples are printed so a page that
      needed retries is visible rather than silently smoothed over.
    */
    const CONFIRM_SAMPLES = 3;
    const median = (values) => {
      const sorted = values.filter((v) => v !== null).sort((a, b) => a - b);
      if (!sorted.length) return null;
      return sorted[Math.floor(sorted.length / 2)];
    };

    /* One flags object, shared by the first pass and any confirmation runs, so
       a retry can never be audited under different conditions than the run it
       is confirming. */
    const lighthouseFlags = {
      port: chrome.port,
      output: 'json',
      onlyCategories: CATEGORIES,
      logLevel: 'error',
      /* `formFactor` alone does not change emulation — Lighthouse keeps the
         mobile screen and throttling unless screenEmulation and throttling
         are switched too, which silently produces a "desktop" run that is
         really a phone run. These are lighthouse's own desktop preset
         values. */
      ...(DESKTOP
        ? {
            formFactor: 'desktop',
            screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
            throttling: {
              rttMs: 40,
              throughputKbps: 10 * 1024,
              cpuSlowdownMultiplier: 1,
              requestLatencyMs: 0,
              downloadThroughputKbps: 0,
              uploadThroughputKbps: 0,
            },
          }
        : {}),
    };

    for (const pagePath of AUDIT_PAGES) {
      const url = `${BASE_URL}${pagePath}`;
      console.log(`[lighthouse-check] Auditing ${pagePath}...`);
      const runnerResult = await lighthouse(url, lighthouseFlags);

      const scores = {};
      for (const cat of CATEGORIES) {
        scores[cat] = runnerResult.lhr.categories[cat]?.score ?? null;
      }

      /* Confirm a sub-threshold result before believing it — see the note
         above the loop. Only failing pages pay the extra runtime. */
      let samples = null;
      let confirmed = runnerResult;
      if (CATEGORIES.some((cat) => scores[cat] !== null && scores[cat] < THRESHOLD)) {
        samples = {};
        for (const cat of CATEGORIES) samples[cat] = [scores[cat]];

        for (let attempt = 2; attempt <= CONFIRM_SAMPLES; attempt++) {
          console.log(`[lighthouse-check] ${pagePath} scored below ${THRESHOLD * 100}% — confirming (${attempt}/${CONFIRM_SAMPLES})...`);
          const retry = await lighthouse(url, lighthouseFlags);
          for (const cat of CATEGORIES) samples[cat].push(retry.lhr.categories[cat]?.score ?? null);
          /* Keep the worst run's report on disk: if the gate does fail, the
             uploaded artifact should show the failure, not the lucky sample. */
          const retryWorst = Math.min(...CATEGORIES.map((c) => retry.lhr.categories[c]?.score ?? 1));
          const heldWorst = Math.min(...CATEGORIES.map((c) => confirmed.lhr.categories[c]?.score ?? 1));
          if (retryWorst < heldWorst) confirmed = retry;
        }

        for (const cat of CATEGORIES) scores[cat] = median(samples[cat]);
      }

      results.push({
        pagePath,
        scores,
        samples,
        diagnostics: collectDiagnostics(confirmed.lhr),
      });

      const reportFile = path.join(
        REPORTS_DIR,
        `${pagePath === '/' ? 'home' : pagePath.replace(/\//g, '_')}.json`
      );
      fs.writeFileSync(reportFile, confirmed.report);
    }
  } finally {
    if (chrome) chrome.kill();
    if (proxy) proxy.close();
    try {
      // kill using astro preview stop since the pid is detached
      import('node:child_process').then((cp) => cp.spawnSync('npx', ['astro', 'preview', 'stop']));
    } catch {}
    try {
      process.kill(-server.pid, 'SIGKILL');
    } catch {
      server.kill('SIGKILL');
    }
  }

  console.log(`\n[lighthouse-check] Results — ${FORM_FACTOR} (pass ${PASS_THRESHOLD * 100}%, fail under ${FAIL_THRESHOLD * 100}%):\n`);
  console.log(
    ['Page', ...CATEGORIES].map((h) => h.padEnd(16)).join(' | ')
  );
  console.log('-'.repeat(16 * (CATEGORIES.length + 1) + 3 * CATEGORIES.length));

  let anyFailed = false;
  let anyWarned = false;
  const retried = [];
  for (const { pagePath, scores, samples } of results) {
    const row = [pagePath.padEnd(16)];
    for (const cat of CATEGORIES) {
      const score = scores[cat];
      const pct = score === null ? 'N/A' : `${Math.round(score * 100)}%`;
      const failed = score !== null && score < FAIL_THRESHOLD;
      const warned = score !== null && !failed && score < PASS_THRESHOLD;
      if (failed) anyFailed = true;
      if (warned) anyWarned = true;
      const mark = failed ? '❌' : warned ? '⚠️ ' : '✅';
      row.push(`${mark} ${pct}`.padEnd(16));
    }
    console.log(row.join(' | ') + (samples ? '  (median of 3)' : ''));
    if (samples) retried.push({ pagePath, samples });
  }

  /* Show the spread for any page that needed confirming. A tight spread that
     sits under the threshold is a real regression; a wide one is runner
     noise, and the difference matters when reading a red build. */
  if (retried.length) {
    console.log('\n--- confirmation samples (page scored below threshold on first pass) ---');
    for (const { pagePath, samples } of retried) {
      for (const cat of CATEGORIES) {
        const vals = samples[cat].filter((v) => v !== null);
        if (!vals.length || vals.every((v) => v >= THRESHOLD)) continue;
        console.log(
          `  ${pagePath.padEnd(12)} ${cat.padEnd(16)} ${vals.map((v) => `${Math.round(v * 100)}%`).join(' / ')}`
        );
      }
    }
  }

  console.log(`\nFull reports written to ${path.relative(ROOT, REPORTS_DIR)}/`);

  /*
    Print WHY a page failed, not just that it did.

    The table above is four numbers and no reason for any of them, and the
    JSON that holds the reason is an uploaded artifact — which means reading
    it costs a download, and is simply unavailable to anyone whose network
    cannot reach the artifact storage host. Chasing a red /events through
    several rounds of push-and-look-at-the-table is how you end up guessing:
    it is entirely possible to "fix" blocking time by 93%, watch the score
    move by one point, and still not know what the binding metric was.

    So the failing page explains itself in the log. Only failures print this,
    so a green run stays a five-line table.
  */
  for (const { pagePath, scores, diagnostics } of results) {
    const failedHere = CATEGORIES.some(
      (cat) => scores[cat] !== null && scores[cat] < THRESHOLD,
    );
    if (!failedHere || !diagnostics) continue;
    printDiagnostics(pagePath, diagnostics);
  }

  if (anyFailed) {
    fail(
      `One or more pages scored below the ${FAIL_THRESHOLD * 100}% failure threshold. ` +
        `Scores between ${FAIL_THRESHOLD * 100}% and ${PASS_THRESHOLD * 100}% are warnings; this is below that.`,
    );
  } else if (anyWarned) {
    /* Exit 0. A warning that fails the build is a failure with a friendlier
       name, and the whole point of the band is that publishing does not stop
       for it. */
    console.log(
      `\n[lighthouse-check] ⚠️  One or more pages are in the ${FAIL_THRESHOLD * 100}-${PASS_THRESHOLD * 100}% warning band.\n` +
        `    Not a failure, and the build is green. Worth a look before it drifts under ${FAIL_THRESHOLD * 100}%.`,
    );
  } else {
    console.log(
      `\n[lighthouse-check] All pages passed at ${PASS_THRESHOLD * 100}%+ across all categories` +
        (unreachableThirdParties.length
          ? ` — WITH ${unreachableThirdParties.length} THIRD PARTY(IES) UNREACHABLE.\n` +
            `    This is not a full measurement. See the warning at the top of this run.`
          : '.'),
    );
  }
}

/*
  Pull the few things that actually explain a performance score out of the
  full LHR, so the failure path can print them without keeping whole reports
  (each is several megabytes) alive in memory for every page.
*/
function collectDiagnostics(lhr) {
  const audit = (id) => lhr.audits?.[id];

  const metrics = [
    'first-contentful-paint',
    'largest-contentful-paint',
    'total-blocking-time',
    'cumulative-layout-shift',
    'speed-index',
    'interactive',
  ]
    .map((id) => {
      const a = audit(id);
      if (!a) return null;
      return {
        id,
        display: a.displayValue ?? '',
        // The per-metric score is the part that matters: a "3.2 s" LCP means
        // nothing on its own, but a score of 71 says exactly how many points
        // are sitting there to be won.
        score: a.score === null || a.score === undefined ? null : Math.round(a.score * 100),
      };
    })
    .filter(Boolean);

  /*
    Which element the LCP actually is, and where its time went. Guessing the
    element wrong sends you optimising an image the metric was never
    measuring — and the phase split is what separates "the file is too big"
    from "we discovered it too late" from "the server was slow", which are
    three completely different fixes.

    Lighthouse 13 moved this into `lcp-breakdown-insight`; the older
    `largest-contentful-paint-element` id is kept as a fallback so this keeps
    working across a version bump either way. Both nest a `type: 'node'`
    entry, sometimes at the top level of details.items and sometimes under a
    `.node` key, so accept both shapes.
  */
  let lcpElement = null;
  let lcpPhases = [];
  const lcpAudit = audit('lcp-breakdown-insight') ?? audit('largest-contentful-paint-element');

  const findNode = (items = []) => {
    for (const item of items) {
      if (item?.type === 'node' && (item.snippet || item.selector)) return item;
      if (item?.node?.snippet || item?.node?.selector) return item.node;
      const nested = findNode(item?.items ?? []);
      if (nested) return nested;
    }
    return null;
  };
  const node = findNode(lcpAudit?.details?.items ?? []);
  if (node) lcpElement = node.snippet || node.selector;

  const findPhases = (items = []) => {
    for (const item of items) {
      const rows = item?.items ?? [];
      if (rows.some((r) => r?.duration !== undefined && (r?.label || r?.subpart))) {
        return rows.map((r) => ({
          label: r.label || r.subpart,
          ms: Math.round(r.duration),
        }));
      }
      const nested = findPhases(rows);
      if (nested.length) return nested;
    }
    return [];
  };
  lcpPhases = findPhases(lcpAudit?.details?.items ?? []);

  // Opportunities, largest first — Lighthouse's own estimate of the ms each
  // would return.
  const opportunities = Object.values(lhr.audits ?? {})
    .filter((a) => a?.details?.type === 'opportunity' && (a.numericValue ?? 0) >= 100)
    .sort((a, b) => (b.numericValue ?? 0) - (a.numericValue ?? 0))
    .slice(0, 5)
    .map((a) => ({ title: a.title, ms: Math.round(a.numericValue) }));

  // The heaviest things on the wire, with when they finished, which is what
  // exposes a slow third-party origin.
  const requests = (audit('network-requests')?.details?.items ?? [])
    .filter((r) => (r.transferSize ?? 0) > 20000)
    .sort((a, b) => (b.transferSize ?? 0) - (a.transferSize ?? 0))
    .slice(0, 6)
    .map((r) => ({
      kb: Math.round((r.transferSize ?? 0) / 1024),
      endMs: Math.round(r.networkEndTime ?? 0),
      url: String(r.url ?? ''),
    }));

  return { metrics, lcpElement, lcpPhases, opportunities, requests };
}

function printDiagnostics(pagePath, { metrics, lcpElement, lcpPhases, opportunities, requests }) {
  console.log(`\n--- why ${pagePath} failed -------------------------------------------`);

  if (metrics.length) {
    console.log('  metric (score out of 100):');
    for (const m of metrics) {
      console.log(
        `    ${m.id.padEnd(26)} ${String(m.display).padStart(9)}   ${m.score === null ? '-' : m.score}`,
      );
    }
  }

  console.log(`\n  LCP element:\n    ${lcpElement ? String(lcpElement).slice(0, 160) : '(not reported)'}`);

  if (lcpPhases.length) {
    // Which phase dominates tells you which fix is the right one: time to
    // first byte -> the server; resource load delay -> the browser found it
    // late, so preload/priority; load duration -> the file is too big;
    // render delay -> the main thread was busy.
    console.log('\n  LCP phases:');
    for (const p of lcpPhases) {
      console.log(`    ${String(p.label).padEnd(26)} ${String(p.ms).padStart(6)}ms`);
    }
  }

  if (opportunities.length) {
    console.log('\n  opportunities:');
    for (const o of opportunities) {
      console.log(`    ${String(o.ms).padStart(6)}ms  ${o.title}`);
    }
  }

  if (requests.length) {
    console.log('\n  heaviest requests (kB, finished at):');
    for (const r of requests) {
      console.log(`    ${String(r.kb).padStart(5)}kB  ${String(r.endMs).padStart(6)}ms  ${r.url.slice(0, 96)}`);
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
