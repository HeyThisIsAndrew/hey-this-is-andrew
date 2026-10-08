#!/usr/bin/env node
/**
 * Google Indexing API notifier for newly published /intel/ articles.
 *
 * ─── READ THIS BEFORE YOU TRUST IT ────────────────────────────────────────
 * Google's Indexing API is officially documented to support exactly two
 * content types: JobPosting, and BroadcastEvent embedded in a VideoObject.
 * Editorial articles are NOT on that list. Google's own docs say the API
 * "can only be used to crawl pages with either JobPosting or BroadcastEvent",
 * and that unsupported formats may stop working without notice.
 *
 * So this script is a HINT, not a mechanism. It costs nothing to run, it is
 * non-fatal by construction, and it may well shorten time-to-crawl for a new
 * article. It is not the reason articles get indexed. The sitemap's lastmod,
 * internal linking, and the site's overall crawl demand are. Do not let a
 * green run here be read as "the article is indexed" — see
 * scripts/indexing-api.md.
 *
 * ─── WHY NO SANITY WEBHOOK ────────────────────────────────────────────────
 * Articles do not live in Sanity. There is no `article` document type (see
 * schema/index.ts). /intel/<slug> is generated from src/data/articles.json,
 * which scripts/sync-articles.mjs writes from Substack's posts API. So the
 * moment a new article "publishes" on this site is the moment that sync adds
 * an eligible record, which is exactly where this hooks in.
 *
 * ─── AUTH, WITH NO DEPENDENCIES ───────────────────────────────────────────
 * Service-account JWT, signed with Node's built-in crypto. No googleapis, no
 * jsonwebtoken, nothing to pin or audit. The private key is read from an env
 * var holding the service account JSON, never from a file in the repo, and is
 * never logged — see redact() and the deliberate absence of any log line that
 * touches the credential or the access token.
 *
 * ─── MODES ────────────────────────────────────────────────────────────────
 *   --snapshot <file>   Write the CURRENT set of eligible /intel/ URLs to
 *                       <file>. Run this BEFORE the article sync.
 *   --before <file>     Diff the snapshot at <file> against the eligible set
 *                       now, and submit only URLs that appeared. Run AFTER.
 *   --url <url>         Submit one URL by hand. Repeatable.
 *   --type <t>          URL_UPDATED (default) or URL_DELETED.
 *   --require-live      Poll each URL until it answers 200 before submitting,
 *                       so we never point Google at a page the deploy has not
 *                       shipped yet. Bounded by --live-timeout (default 600s).
 *   --execute           Actually call Google. WITHOUT THIS THE SCRIPT IS A
 *                       DRY RUN, matching scripts/sync-youtube.mjs.
 *
 * Credentials: GOOGLE_INDEXING_CREDENTIALS holds the service account JSON
 * (the whole file contents, as a single env var). Absent means "skip, loudly"
 * — never a failure. See .env.example.
 */

import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const SITE_ORIGIN = 'https://beunconventionalhq.com';
const ARTICLE_PREFIX = '/intel/';
const ARTICLES_JSON = path.resolve(process.cwd(), 'src/data/articles.json');

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const INDEXING_ENDPOINT = 'https://indexing.googleapis.com/v3/urlNotifications:publish';
const SCOPE = 'https://www.googleapis.com/auth/indexing';

/**
 * Slugs that would shadow a route segment under /intel/. Must stay in step
 * with RESERVED_SLUGS in src/lib/articles.ts — src/pages/intel/[slug].astro
 * filters these out of getStaticPaths, so a page for them never exists.
 */
const RESERVED_SLUGS = new Set(['topic', 'page']);

/**
 * A slug we are willing to put in front of Google. Deliberately stricter than
 * whatever Substack happens to emit: lowercase, digits and single hyphens.
 * Anything else is treated as untrusted input and rejected rather than
 * escaped, because there is no legitimate article slug this excludes.
 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ── URL eligibility ─────────────────────────────────────────────────────────

/**
 * Validate a URL as one this script may submit.
 *
 * Treats the input as hostile: the caller may be a workflow_dispatch input, a
 * hand-typed --url, or a slug that arrived from Substack's API. Returns the
 * normalized URL string, or throws with a message that says what was wrong.
 */
export function assertSubmittableUrl(input) {
  let parsed;
  try {
    parsed = new URL(String(input));
  } catch {
    throw new Error(`Not a URL: ${JSON.stringify(String(input))}`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(`Refusing ${parsed.href}: must be https, got ${parsed.protocol}`);
  }
  if (parsed.origin !== SITE_ORIGIN) {
    throw new Error(`Refusing ${parsed.href}: origin must be exactly ${SITE_ORIGIN}`);
  }
  if (parsed.search || parsed.hash) {
    throw new Error(`Refusing ${parsed.href}: query strings and fragments are not canonical URLs here`);
  }
  if (!parsed.pathname.startsWith(ARTICLE_PREFIX)) {
    throw new Error(`Refusing ${parsed.href}: only ${ARTICLE_PREFIX}<slug> URLs may be submitted`);
  }

  const slug = parsed.pathname.slice(ARTICLE_PREFIX.length);
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(`Refusing ${parsed.href}: ${JSON.stringify(slug)} is not a single well-formed slug`);
  }
  if (RESERVED_SLUGS.has(slug)) {
    throw new Error(`Refusing ${parsed.href}: ${JSON.stringify(slug)} is a reserved route segment, no page exists`);
  }

  return parsed.href;
}

/**
 * The /intel/ URLs that actually have a page right now.
 *
 * This mirrors getPublishedArticles() in src/lib/articles.ts (non-hidden, has
 * a body, has a slug) plus the RESERVED_SLUGS filter that
 * src/pages/intel/[slug].astro applies in getStaticPaths. If those two ever
 * disagree with this function, this one is wrong: the site decides what pages
 * exist, not the notifier. scripts/indexing-api.test.mjs pins the agreement.
 */
export function eligibleArticleUrls(records) {
  if (!Array.isArray(records)) return [];
  const urls = [];
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    if (record.editorial?.hidden) continue;
    if (!record.hasBody) continue;
    const slug = typeof record.slug === 'string' ? record.slug : '';
    if (!slug || RESERVED_SLUGS.has(slug) || !SLUG_PATTERN.test(slug)) continue;
    urls.push(`${SITE_ORIGIN}${ARTICLE_PREFIX}${slug}`);
  }
  return [...new Set(urls)].sort();
}

/** URLs present in `after` but not in `before`. Order-stable. */
export function newUrls(before, after) {
  const seen = new Set(before);
  return after.filter((url) => !seen.has(url));
}

// ── Auth ────────────────────────────────────────────────────────────────────

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

/** Never let a key or token reach a log line, even inside an error message. */
function redact(message, credentials) {
  let out = String(message);
  if (credentials?.private_key) out = out.split(credentials.private_key).join('[REDACTED_PRIVATE_KEY]');
  return out.replace(/ya29\.[A-Za-z0-9._-]+/g, '[REDACTED_TOKEN]');
}

export function parseCredentials(raw) {
  let creds;
  try {
    creds = JSON.parse(raw);
  } catch {
    throw new Error('GOOGLE_INDEXING_CREDENTIALS is not valid JSON. Paste the whole service account key file, unmodified.');
  }
  for (const field of ['client_email', 'private_key']) {
    if (!creds[field]) {
      throw new Error(`GOOGLE_INDEXING_CREDENTIALS is missing "${field}". That is not a service account key file.`);
    }
  }
  if (creds.type && creds.type !== 'service_account') {
    throw new Error(`GOOGLE_INDEXING_CREDENTIALS has type "${creds.type}", expected "service_account".`);
  }
  return creds;
}

/** Signed JWT assertion for the OAuth2 JWT-bearer flow. */
export function buildAssertion(credentials, now = Math.floor(Date.now() / 1000)) {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: credentials.client_email,
      scope: SCOPE,
      aud: TOKEN_ENDPOINT,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = `${header}.${claims}`;
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(signingInput)
    .sign(credentials.private_key.replace(/\\n/g, '\n'), 'base64url');
  return `${signingInput}.${signature}`;
}

async function fetchAccessToken(credentials) {
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: buildAssertion(credentials),
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  if (!res.ok) {
    // The token endpoint echoes the assertion back on some errors. Redact.
    throw new Error(`Token exchange failed: HTTP ${res.status}. ${redact(text.slice(0, 300), credentials)}`);
  }
  const token = JSON.parse(text).access_token;
  if (!token) throw new Error('Token exchange returned no access_token.');
  return token;
}

// ── Submission ──────────────────────────────────────────────────────────────

const RETRYABLE = (status) => status === 429 || (status >= 500 && status < 600);

const FORBIDDEN_HELP = [
  'HTTP 403 from the Indexing API. The two causes, in the order they actually happen:',
  '  1. The service account is not an OWNER of the Search Console property.',
  '     Delegated Owner is required. "Full" and "Restricted" both return 403.',
  '     Search Console > Settings > Users and permissions > Add user >',
  '     paste the service account client_email > Permission: Owner.',
  '  2. The Indexing API is not enabled on the Google Cloud project that',
  '     issued this key. Google Cloud Console > APIs & Services > Library >',
  '     "Indexing API" > Enable.',
  'If both look right, confirm the key belongs to the SAME project where the',
  'API is enabled, and that the URL is inside the verified property.',
].join('\n');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One URL, with backoff on the failures that are worth retrying.
 *
 * 429 and 5xx are transient (quota window, Google-side blip) so they get
 * exponential backoff with jitter. 400 and 403 are configuration errors and
 * are returned immediately: retrying a 403 five times just burns the log.
 */
async function publishOne(url, type, token, credentials, { attempts = 5, baseDelayMs = 1000 } = {}) {
  let lastStatus = 0;
  let lastBody = '';

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let res;
    try {
      res = await fetch(INDEXING_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, type }),
        signal: AbortSignal.timeout(20000),
      });
    } catch (err) {
      lastStatus = 0;
      lastBody = redact(err instanceof Error ? err.message : String(err), credentials);
      if (attempt === attempts) break;
      await sleep(baseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * 250));
      continue;
    }

    lastStatus = res.status;
    lastBody = redact((await res.text()).slice(0, 400), credentials);

    if (res.ok) return { url, ok: true, status: res.status, attempts: attempt };
    if (res.status === 403) return { url, ok: false, status: 403, attempts: attempt, help: FORBIDDEN_HELP, body: lastBody };
    if (!RETRYABLE(res.status)) return { url, ok: false, status: res.status, attempts: attempt, body: lastBody };
    if (attempt === attempts) break;

    await sleep(baseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * 250));
  }

  return { url, ok: false, status: lastStatus, attempts, body: lastBody };
}

/**
 * Wait for the URL to actually exist.
 *
 * The article sync pushes a commit; Cloudflare then builds and deploys. If we
 * submit in that window Google fetches a 404 and we have spent a submission
 * teaching it the page is missing. Polling costs nothing and removes the race.
 */
async function waitUntilLive(url, timeoutSeconds, intervalSeconds = 30) {
  const deadline = Date.now() + timeoutSeconds * 1000;
  for (;;) {
    try {
      const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
      if (res.status === 200) return true;
    } catch {
      // Network blip. Same handling as a non-200: wait and try again.
    }
    if (Date.now() >= deadline) return false;
    await sleep(intervalSeconds * 1000);
  }
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { urls: [], type: 'URL_UPDATED', execute: false, requireLive: false, liveTimeout: 600 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[(i += 1)];
    if (arg === '--execute') args.execute = true;
    else if (arg === '--require-live') args.requireLive = true;
    else if (arg === '--url') args.urls.push(next());
    else if (arg === '--type') args.type = next();
    else if (arg === '--snapshot') args.snapshot = next();
    else if (arg === '--before') args.before = next();
    else if (arg === '--live-timeout') args.liveTimeout = Number(next());
    else if (arg.startsWith('--')) throw new Error(`Unknown flag: ${arg}`);
  }
  if (!['URL_UPDATED', 'URL_DELETED'].includes(args.type)) {
    throw new Error(`--type must be URL_UPDATED or URL_DELETED, got ${JSON.stringify(args.type)}`);
  }
  return args;
}

function readArticles() {
  if (!fs.existsSync(ARTICLES_JSON)) return [];
  try {
    return JSON.parse(fs.readFileSync(ARTICLES_JSON, 'utf-8'));
  } catch {
    return [];
  }
}

function summary(lines) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;
  try {
    fs.appendFileSync(file, `${lines.join('\n')}\n`);
  } catch {
    // A summary we cannot write is not worth failing a run over.
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Snapshot mode: record what exists now, then get out of the way.
  if (args.snapshot) {
    const urls = eligibleArticleUrls(readArticles());
    fs.writeFileSync(args.snapshot, JSON.stringify(urls, null, 2));
    console.log(`Snapshot: ${urls.length} eligible ${ARTICLE_PREFIX} URLs -> ${args.snapshot}`);
    return 0;
  }

  // Work out the URL list.
  let targets = [];
  if (args.before) {
    let before = [];
    try {
      before = JSON.parse(fs.readFileSync(args.before, 'utf-8'));
    } catch {
      console.log(`No readable snapshot at ${args.before}; treating every current URL as pre-existing.`);
      before = eligibleArticleUrls(readArticles());
    }
    targets = newUrls(before, eligibleArticleUrls(readArticles()));
    console.log(`Diff against ${args.before}: ${targets.length} newly published URL(s).`);
  }
  targets = targets.concat(args.urls);

  // Validate everything before doing anything, so a bad hand-typed URL cannot
  // half-run the batch.
  const validated = [];
  const rejected = [];
  for (const candidate of targets) {
    try {
      validated.push(assertSubmittableUrl(candidate));
    } catch (err) {
      rejected.push(err instanceof Error ? err.message : String(err));
    }
  }

  for (const reason of rejected) console.error(`REJECTED: ${reason}`);

  if (validated.length === 0) {
    console.log('Nothing to submit.');
    summary(['### Indexing API', '', 'Nothing to submit.', ...rejected.map((r) => `- REJECTED: ${r}`)]);
    return rejected.length > 0 && args.urls.length > 0 ? 1 : 0;
  }

  console.log(`${validated.length} URL(s) to submit as ${args.type}:`);
  for (const url of validated) console.log(`  ${url}`);

  if (!args.execute) {
    console.log('\nDRY RUN. Nothing was sent. Pass --execute to actually notify Google.');
    summary([
      '### Indexing API (dry run)',
      '',
      ...validated.map((u) => `- \`${u}\``),
      '',
      'No request was sent. `--execute` was not passed.',
    ]);
    return 0;
  }

  const raw = process.env.GOOGLE_INDEXING_CREDENTIALS;
  if (!raw) {
    console.log('GOOGLE_INDEXING_CREDENTIALS is not set. Skipping (this is not an error).');
    summary(['### Indexing API', '', 'Skipped: `GOOGLE_INDEXING_CREDENTIALS` is not configured.']);
    return 0;
  }

  const credentials = parseCredentials(raw);
  const token = await fetchAccessToken(credentials);

  const results = [];
  for (const url of validated) {
    if (args.requireLive && args.type === 'URL_UPDATED') {
      const live = await waitUntilLive(url, args.liveTimeout);
      if (!live) {
        console.error(`SKIPPED ${url}: still not answering 200 after ${args.liveTimeout}s. The deploy has probably not shipped it yet.`);
        results.push({ url, ok: false, status: 0, skipped: true });
        continue;
      }
    }
    const result = await publishOne(url, args.type, token, credentials);
    results.push(result);
    if (result.ok) {
      console.log(`OK ${result.status} ${url} (attempt ${result.attempts})`);
    } else {
      console.error(`FAILED ${result.status || 'network'} ${url} after ${result.attempts} attempt(s)`);
      if (result.body) console.error(`  ${result.body}`);
      if (result.help) console.error(result.help);
    }
  }

  const ok = results.filter((r) => r.ok).length;
  summary([
    '### Indexing API',
    '',
    `Type: \`${args.type}\` · Submitted: ${ok}/${results.length}`,
    '',
    ...results.map((r) => `- ${r.ok ? 'OK' : r.skipped ? 'SKIPPED (not live yet)' : `FAILED ${r.status}`} \`${r.url}\``),
    ...rejected.map((r) => `- REJECTED: ${r}`),
  ]);

  return ok === results.length ? 0 : 1;
}

const invokedDirectly = process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`;
if (invokedDirectly) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(`Indexing API notifier failed: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    });
}
