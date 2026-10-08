/**
 * Shared preview-server launcher for the e2e suites.
 *
 * ─── WHY THIS EXISTS ──────────────────────────────────────────────────────
 * Every e2e file used to start `npm run preview` itself and decide the server
 * was ready by watching stdout for the substring `http://localhost:`:
 *
 *     server.stdout.on('data', (data) => {
 *       if (data.toString().includes('http://localhost:')) resolve();
 *     });
 *
 * That was true of the old preview output. It is no longer true. The
 * Cloudflare adapter's preview runs `wrangler dev`, which now prints a Local
 * Explorer banner BEFORE the worker is listening:
 *
 *     The Local Explorer API is available at http://localhost:4321/cdn-cgi/...
 *       GET http://localhost:4321/cdn-cgi/explorer/api - OpenAPI schema
 *       ... ~12 more lines ...
 *     [wrangler:info] Ready on http://localhost:4321      <- the real signal
 *
 * The first of those lines contains `http://localhost:`, so the readiness
 * promise resolved roughly a dozen lines early and Puppeteer began driving a
 * server that was not up yet. Pages came back empty, and every assertion that
 * looked for real content failed as though the DATA were missing — which is
 * exactly how it was reported: "Production data missing: No events found on
 * /events". The events were there the whole time; `/events` serves 200 with
 * both event links in the static HTML.
 *
 * Matching on `Ready on` instead would just be a newer string to go stale.
 * This polls the server until it actually answers a request, which is the
 * condition the tests genuinely depend on and cannot drift.
 */
import { spawn } from 'node:child_process';
import net from 'node:net';

/**
 * Is something accepting TCP connections on this port, right now?
 *
 * Deliberately a raw socket rather than an HTTP request. In sandboxed CI an
 * HTTP proxy can sit in front of even loopback traffic and answer for a port
 * that nothing is bound to — observed here returning `500` for a closed 4321
 * while `ss` reported no listener at all. Any readiness or orphan check built
 * on "a failed fetch means nothing is listening" is wrong under that setup, in
 * the direction that matters: it reports a phantom server. A TCP connect
 * cannot be answered by an HTTP proxy, so it tells the truth in both
 * environments.
 */
function canConnect(port, timeoutMs = 1200) {
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

/** SIGKILL the tree if a polite stop does not take. */
function stopServer(server) {
  try {
    spawn('npx', ['astro', 'preview', 'stop']);
  } catch {}
  if (!server || server.exitCode !== null) return;
  try {
    /* Negative pid targets the process GROUP. wrangler spawns a workerd child;
       killing only the npm wrapper leaves that child holding the port, and the
       next suite in the run then fails to bind. */
    process.kill(-server.pid, 'SIGTERM');
  } catch {
    try { server.kill('SIGTERM'); } catch { /* already gone */ }
  }
  setTimeout(() => {
    try { process.kill(-server.pid, 'SIGKILL'); } catch { /* already gone */ }
  }, 3000).unref?.();
}

/**
 * Start `npm run preview` and resolve once it actually serves a request.
 *
 * @param {{port?: number, timeoutMs?: number}} [options]
 * @returns {Promise<{server: import('node:child_process').ChildProcess, base: string, stop: () => void}>}
 */
export async function startPreviewServer({ port = 4321, timeoutMs = 120000 } = {}) {
  const base = `http://localhost:${port}`;

  /*
    Fail loudly if the port is ALREADY serving before we start.

    A leftover worker from an earlier run answers the readiness poll below, so
    the suite would appear to come up, run against stale code, and then die the
    moment that orphan was reaped — surfacing as ERR_CONNECTION_REFUSED on the
    first navigation, with nothing pointing at the real cause. Observed exactly
    that while building this helper.
  */
  if (await canConnect(port)) {
    throw new Error(
      `Something is already listening on ${base} before the preview server started. ` +
        'That is almost certainly an orphaned wrangler/workerd from a previous run — ' +
        "the suite would otherwise test against it. Kill it first (e.g. `pkill -f workerd`).",
    );
  }

  const server = spawn('npm', ['run', 'preview'], {
    stdio: 'pipe',
    // Own process group, so stopServer can take the workerd child down too.
    detached: true,
    env: {
      ...process.env,
      /*
        Best effort only, and deliberately not relied on. Both names are in
        the astro:env schema, and @astrojs/cloudflare resolves those from
        wrangler.jsonc `vars` and from the values baked in at build time, both
        of which outrank this process env (see the long note in
        .github/workflows/ci.yml). What actually decides whether the suites
        get a token is the key the BUILD was made with, which is why CI writes
        Cloudflare's always-passes test keys into `.env` before building and
        `.env.example` tells you to do the same locally.
      */
      PUBLIC_TURNSTILE_SITE_KEY: '',
      TURNSTILE_SECRET_KEY: '',
      ASTRO_TELEMETRY_DISABLED: '1'
    },
  });

  let output = '';
  const record = (data) => { output += data.toString(); };
  server.stdout?.on('data', record);
  server.stderr?.on('data', record);

  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    if (server.exitCode !== null && server.exitCode !== 0) {
      throw new Error(`Preview server exited with code ${server.exitCode}.\n\n${output}`);
    }
    if (await canConnect(port)) {
      /* Bound and accepting. Confirm it actually answers HTTP before handing
         the suite a server that is still wiring itself up. */
      try {
        const res = await fetch(base, { signal: AbortSignal.timeout(3000) });
        await res.arrayBuffer().catch(() => {});
        if (res.status < 500) return { server, base, stop: () => stopServer(server) };
        lastError = new Error(`HTTP ${res.status}`);
      } catch (err) {
        lastError = err;
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  stopServer(server);
  throw new Error(
    `Preview server never answered at ${base} within ${timeoutMs}ms` +
      `${lastError ? ` (last error: ${lastError.message})` : ''}.\n\n${output}`,
  );
}
