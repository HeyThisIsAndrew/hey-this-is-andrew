#!/usr/bin/env node
/**
 * Cloudflare Workers: one script for every site.
 *
 *   pnpm cf list                              sites that deploy to Cloudflare
 *   pnpm cf info <site>                       its Worker, URLs and check routes (JSON)
 *   pnpm cf build <site> [--preview <branch>] build it (production, or a preview)
 *   pnpm cf deploy <site|all>                 build, then deploy to production
 *   pnpm cf preview <site|all> <branch>       build, then upload a preview version
 *   pnpm cf preview-url <site> <branch>       the preview address for a branch
 *   pnpm cf live-sha <site>                   the commit production serves
 *   pnpm cf needs-deploy <site> <sha>         "true"/"false": is production behind?
 *   pnpm cf verify <site> <sha>               wait until production serves <sha>
 *   pnpm cf preview-check <site> <branch> [--report <file>]
 *                                             wait for the preview, check its routes
 *   pnpm cf changed [<base> <head>]           sites affected between two commits (CI)
 *
 * A site opts in with a "cloudflare" block in its package.json:
 *
 *   "cloudflare": { "worker": "my-site", "routes": ["/", "/about/"] }
 *
 * plus a wrangler.jsonc beside it (pnpm new-site writes both). Production is
 * https://<worker>.<WORKERS_SUBDOMAIN>.workers.dev, or "siteUrl" when the block
 * sets one (a custom domain). Previews are
 * https://<alias>-<worker>.<WORKERS_SUBDOMAIN>.workers.dev ("preview_urls": true
 * in wrangler.jsonc). "routes" are the pages a preview run reports on.
 *
 * Every build stamps the commit into each page (<meta name="build-sha">, from
 * @andrew/ui ChromeMeta), which is how CI proves what production serves, the
 * same as BE Unconventional HQ's deploy.yml. Preview builds also carry
 * noindex (meta, robots.txt and an X-Robots-Tag header).
 *
 * Worker secrets: list their names in the block ("secrets": ["RESEND_API_KEY"]).
 * A production deploy uploads each one present in the environment WITH the
 * new version (wrangler deploy --secrets-file), never as a separate step:
 * `wrangler secret put` and dashboard edits build on the NEWEST version,
 * which may be an unmerged preview (see CLOUDFLARE.md). Absent ones are left
 * as they are on Cloudflare. Previews inherit the Worker's secrets.
 *
 * Deploying needs Cloudflare credentials: `npx wrangler login` on a laptop, or
 * CLOUDFLARE_API_TOKEN (and optionally CLOUDFLARE_ACCOUNT_ID) in CI.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { pnpmCommand } from './pnpm-command.mjs';

export const WORKERS_SUBDOMAIN = 'heythisisandrewb';
export const MAX_DNS_LABEL = 63;

// BE Unconventional HQ has its own repository; the copy under sites/ is out
// of date. Deploying it would overwrite the live HQ Worker (AGENTS.md).
export const NEVER_DEPLOY = new Set(['be-unconventional-hq']);

// Inputs to every site's build: a change to any of these deploys them all.
// (Root package.json counts only when its wrangler version changes.)
export const GLOBAL_PATHS = [
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'tsconfig.base.json',
  'scripts/cloudflare.mjs',
  'scripts/pnpm-command.mjs',
];
const GLOBAL_PATTERNS = [/^\.github\/workflows\/cloudflare[^/]*\.ya?ml$/];

// Files an OS drops into folders that must never be uploaded.
const JUNK_FILES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sitesDir = path.join(root, 'sites');
const packagesDir = path.join(root, 'packages');

// ── Sites ────────────────────────────────────────────────────────────────

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** wrangler.jsonc: JSON with comments and trailing commas. */
export function parseJsonc(text) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j;
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2) + 1;
      if (i === 0) break;
    } else {
      out += c;
    }
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

function readSite(dir) {
  const pkgFile = path.join(sitesDir, dir, 'package.json');
  if (!fs.existsSync(pkgFile)) return null;
  const pkg = readJson(pkgFile);
  if (!pkg.cloudflare?.worker || NEVER_DEPLOY.has(dir)) return null;
  const { worker } = pkg.cloudflare;
  const workersUrl = `https://${worker}.${WORKERS_SUBDOMAIN}.workers.dev`;
  return {
    dir,
    pkgName: pkg.name,
    worker,
    workersUrl,
    siteUrl: (pkg.cloudflare.siteUrl || workersUrl).replace(/\/$/, ''),
    customDomain: Boolean(pkg.cloudflare.siteUrl),
    secrets: pkg.cloudflare.secrets || [],
    routes: pkg.cloudflare.routes || ['/'],
    path: path.join(sitesDir, dir),
  };
}

export function allSites() {
  return fs.readdirSync(sitesDir).sort().map(readSite).filter(Boolean);
}

function getSite(name) {
  if (NEVER_DEPLOY.has(name)) fail(`${name} is never deployed from this repository (see AGENTS.md).`);
  const site = allSites().find((s) => s.dir === name || s.pkgName === name || s.worker === name);
  if (!site) fail(`No Cloudflare site called "${name}". Cloudflare sites: ${allSites().map((s) => s.dir).join(', ') || 'none'}.`);
  return site;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

// ── Which sites a change affects (the workspace dependency graph) ──────────

/** Every workspace package (packages/* and sites/*): name, folder, @andrew deps. */
export function workspaceGraph() {
  const nodes = new Map();
  for (const [base, prefix] of [[packagesDir, 'packages'], [sitesDir, 'sites']]) {
    if (!fs.existsSync(base)) continue;
    for (const dir of fs.readdirSync(base)) {
      const file = path.join(base, dir, 'package.json');
      if (!fs.existsSync(file)) continue;
      const pkg = readJson(file);
      const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies, ...pkg.optionalDependencies });
      nodes.set(pkg.name, { name: pkg.name, folder: `${prefix}/${dir}`, deps });
    }
  }
  return nodes;
}

/** The workspace packages `name` depends on, directly or through others. */
export function workspaceDepsOf(name, graph = workspaceGraph()) {
  const seen = new Set();
  const visit = (n) => {
    for (const d of graph.get(n)?.deps || []) {
      if (graph.has(d) && !seen.has(d)) {
        seen.add(d);
        visit(d);
      }
    }
  };
  visit(name);
  return seen;
}

function wranglerVersionAt(ref) {
  try {
    const pkg = JSON.parse(execFileSync('git', ['show', `${ref}:package.json`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
    return pkg.devDependencies?.wrangler ?? pkg.dependencies?.wrangler ?? null;
  } catch {
    return undefined;
  }
}

/**
 * The Cloudflare sites a set of changed files affects:
 *   sites/<x>/**          that site;
 *   packages/<p>/**       the sites that depend on that package (recursively);
 *   global build inputs   every site (GLOBAL_PATHS, the Cloudflare workflows,
 *                         or the root wrangler version).
 * Anything else (docs, other workflows, templates, tests) affects none.
 * Pass `files` to skip git (tests); otherwise base..head is diffed, and an
 * unknown base (first push, shallow history) means every site.
 */
export function changed(base, head = 'HEAD', { files, sites = allSites(), graph = workspaceGraph(), rootWranglerChanged } = {}) {
  if (!files) {
    try {
      if (!base || /^0+$/.test(base)) throw new Error('no base');
      files = execFileSync('git', ['diff', '--name-only', base, head], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
        .split('\n').filter(Boolean);
    } catch {
      return sites;
    }
  }
  const isGlobal = (f) => GLOBAL_PATHS.includes(f) || GLOBAL_PATTERNS.some((re) => re.test(f));
  if (files.some(isGlobal)) return sites;
  if (files.includes('package.json')) {
    const wranglerMoved = rootWranglerChanged ?? (base ? wranglerVersionAt(base) !== wranglerVersionAt(head) : true);
    if (wranglerMoved) return sites;
  }

  const byFolder = new Map([...graph.values()].map((n) => [n.folder, n.name]));
  const touchedPackages = new Set();
  const touchedSites = new Set();
  for (const f of files) {
    const [top, dir] = f.split('/');
    if (top === 'sites' && dir) touchedSites.add(dir);
    if (top === 'packages' && dir && byFolder.has(`packages/${dir}`)) touchedPackages.add(byFolder.get(`packages/${dir}`));
  }
  return sites.filter((s) => {
    if (touchedSites.has(s.dir)) return true;
    const deps = workspaceDepsOf(s.pkgName, graph);
    return [...touchedPackages].some((p) => deps.has(p));
  });
}

// ── Preview aliases (Wrangler's own rules, deploy-helpers/preview-alias.ts) ──

const ALIAS_RE = /^[a-z](?:[a-z0-9-]*[a-z0-9])?$/;

/**
 * A DNS-safe alias for `branch` such that "<alias>-<worker>" is one DNS label
 * (<= 63 characters): lowercase letters, digits and hyphens, starting with a
 * letter. Too long, it is cut and given a short hash of the branch name, so
 * two long branches sharing a prefix still get different addresses.
 */
export function previewAlias(worker, branch) {
  const available = MAX_DNS_LABEL - worker.length - 1;
  let alias = String(branch || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!alias) alias = 'preview';
  if (!/^[a-z]/.test(alias)) alias = `b-${alias}`;
  if (alias.length > available) {
    const suffix = `-${createHash('sha256').update(String(branch)).digest('hex').slice(0, 4)}`;
    if (available - suffix.length < 1) throw new Error(`Worker name "${worker}" is too long for preview aliases (max ${MAX_DNS_LABEL} characters with the alias).`);
    alias = `${alias.slice(0, available - suffix.length).replace(/-+$/, '')}${suffix}`;
  }
  if (!ALIAS_RE.test(alias)) throw new Error(`Could not make a valid preview alias from "${branch}".`);
  return alias;
}

export function previewUrl(site, branch) {
  return `https://${previewAlias(site.worker, branch)}-${site.worker}.${WORKERS_SUBDOMAIN}.workers.dev`;
}

// ── Build ────────────────────────────────────────────────────────────────

let pnpmCached;
const pnpm = () => (pnpmCached ??= pnpmCommand());

function run(cmd, args, opts = {}) {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { stdio: 'inherit', cwd: root, ...opts });
}

function gitHead() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

/** The wrangler config a site deploys with: the adapter's for server sites. */
function wranglerConfigFor(site) {
  const adapterConfig = path.join(site.path, 'dist/server/wrangler.json');
  const config = fs.existsSync(adapterConfig) ? adapterConfig : path.join(site.path, 'wrangler.jsonc');
  if (!fs.existsSync(config)) fail(`${site.dir} has no wrangler.jsonc.`);
  return config;
}

/**
 * The folder uploaded as the Worker's static assets. Always inside the site's
 * own dist/: a Worker never ships the repository root or another site.
 */
export function assetsDirFor(site) {
  const config = wranglerConfigFor(site);
  const parsed = config.endsWith('.json') ? readJson(config) : parseJsonc(fs.readFileSync(config, 'utf8'));
  const dir = parsed.assets?.directory;
  if (!dir) fail(`${path.relative(root, config)} has no assets.directory.`);
  const resolved = path.resolve(path.dirname(config), dir);
  const dist = path.join(site.path, 'dist');
  if (resolved !== dist && !resolved.startsWith(`${dist}${path.sep}`)) {
    fail(`${site.dir}: assets.directory resolves to ${path.relative(root, resolved)}, outside sites/${site.dir}/dist.`);
  }
  return resolved;
}

function pruneJunk(dir) {
  let removed = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) removed += pruneJunk(p);
    else if (JUNK_FILES.has(entry.name) || entry.name.startsWith('._')) {
      fs.rmSync(p);
      removed++;
    }
  }
  return removed;
}

/**
 * Build a site for Cloudflare. Production by default; with { preview } the
 * build points at the preview address and is marked noindex everywhere.
 */
export function build(site, { preview = false, siteUrl = site.siteUrl } = {}) {
  const env = {
    ...process.env,
    CF_WORKERS: '1',
    SITE_URL: siteUrl,
    BASE_PATH: '/',
    ASTRO_TELEMETRY_DISABLED: '1',
    PUBLIC_BUILD_SHA: process.env.PUBLIC_BUILD_SHA || gitHead(),
  };
  // The old names win nowhere now; drop them so a stale shell value cannot.
  delete env.ASTRO_SITE;
  delete env.ASTRO_BASE;
  if (preview) {
    env.CF_PREVIEW = '1';
    env.PUBLIC_NOINDEX = '1';
  } else {
    delete env.CF_PREVIEW;
    delete env.PUBLIC_NOINDEX;
  }
  fs.rmSync(path.join(site.path, 'dist'), { recursive: true, force: true });
  run(pnpm()[0], [...pnpm()[1], '--filter', site.pkgName, 'build'], { env });

  const assets = assetsDirFor(site);
  const removed = pruneJunk(assets);
  if (removed) console.log(`Removed ${removed} OS junk file(s) (.DS_Store etc.) from ${path.relative(root, assets)}.`);
  if (preview) {
    fs.writeFileSync(path.join(assets, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
    const headers = path.join(assets, '_headers');
    const existing = fs.existsSync(headers) ? `${fs.readFileSync(headers, 'utf8').replace(/\n*$/, '')}\n\n` : '';
    fs.writeFileSync(headers, `${existing}/*\n  X-Robots-Tag: noindex, nofollow\n`);
  }
  console.log(`\nBuilt ${site.dir} (${preview ? 'preview' : 'production'}) for ${siteUrl} at ${env.PUBLIC_BUILD_SHA || 'an unstamped commit'}.`);
}

// ── Deploy and preview ───────────────────────────────────────────────────

function wrangler(site, args) {
  run(pnpm()[0], [...pnpm()[1], 'exec', 'wrangler', ...args], { cwd: site.path });
}

export function deploy(site) {
  build(site);
  const config = wranglerConfigFor(site);
  const secrets = Object.fromEntries(site.secrets.filter((n) => process.env[n]).map((n) => [n, process.env[n]]));
  const args = ['deploy', '--config', config];
  let tmp;
  if (Object.keys(secrets).length) {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-secrets-'));
    const file = path.join(tmp, 'secrets.json');
    fs.writeFileSync(file, JSON.stringify(secrets), { mode: 0o600 });
    args.push('--secrets-file', file);
    console.log(`Uploading secrets with this version: ${Object.keys(secrets).join(', ')}`);
  }
  try {
    wrangler(site, args);
  } finally {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`\nLive: ${site.siteUrl}`);
}

export function preview(site, branch) {
  const url = previewUrl(site, branch);
  build(site, { preview: true, siteUrl: url });
  const sha = (process.env.PUBLIC_BUILD_SHA || gitHead()).slice(0, 7);
  // versions upload, never deploy: production keeps serving what it serves.
  wrangler(site, [
    'versions', 'upload', '--config', wranglerConfigFor(site),
    '--preview-alias', previewAlias(site.worker, branch),
    '--message', `Preview: ${branch}${sha ? ` @ ${sha}` : ''}`,
  ]);
  console.log(`\nPreview: ${url}`);
}

// ── Live checks ──────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const attempts = (fallback) => Number(process.env.CF_CHECK_ATTEMPTS) || fallback;
const interval = (fallback) => (Number(process.env.CF_CHECK_INTERVAL) || fallback) * 1000;

async function httpGet(url) {
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'cache-control': 'no-cache' } });
    return { status: res.status, body: await res.text() };
  } catch (err) {
    return { status: 0, body: '', error: err.message };
  }
}

export function buildShaIn(html) {
  return html.match(/<meta name="build-sha" content="([0-9a-f]{7,40})"/)?.[1] || '';
}

/** The commit production serves, read from its workers.dev address. */
export async function liveSha(site) {
  const { body } = await httpGet(`${site.workersUrl}/?deploy-check=${Date.now()}`);
  return buildShaIn(body);
}

function isCommit(sha) {
  try {
    execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], { cwd: root, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Production is current for this site when it serves `sha`, or serves an
 * older commit and nothing this site builds from changed since.
 */
export async function needsDeploy(site, sha) {
  const live = await liveSha(site);
  if (!live) return { needed: true, reason: 'production serves no build stamp (never deployed by CI, or not answering)' };
  if (live === sha) return { needed: false, reason: `production already serves ${sha}` };
  if (!isCommit(live)) return { needed: true, reason: `production serves ${live}, which is not in this history` };
  if (!changed(live, sha).some((s) => s.dir === site.dir)) {
    return { needed: false, reason: `production serves ${live.slice(0, 7)}; nothing ${site.dir} builds from changed since` };
  }
  return { needed: true, reason: `production serves ${live.slice(0, 7)}; ${site.dir} changed since` };
}

/**
 * After a deploy: the Worker's workers.dev address must serve `sha` (the
 * domain may sit behind bot protection that refuses CI runners). A custom
 * domain gets one informational probe: 404 means it is not on this Worker.
 */
export async function verify(site, sha) {
  const n = attempts(20);
  let live = '';
  for (let i = 1; i <= n; i++) {
    live = await liveSha(site);
    if (live === sha) {
      console.log(`${site.workersUrl} serves ${sha} (attempt ${i}).`);
      if (site.customDomain) {
        const { status } = await httpGet(`${site.siteUrl}/?deploy-check=${Date.now()}`);
        console.log(`${site.siteUrl} answered HTTP ${status} (403 = bot protection, fine; 404 = the domain is NOT on this Worker).`);
        if (status === 404) console.log(`::warning::${site.siteUrl} answers 404, so the domain is not served by the ${site.worker} Worker. See CLOUDFLARE.md.`);
      }
      return true;
    }
    console.log(`Attempt ${i}/${n}: production serves ${live || 'an unstamped build'}, waiting for ${sha}...`);
    if (i < n) await sleep(interval(15));
  }
  console.log(`::error::Deployed ${sha}, but ${site.workersUrl} still serves ${live || 'an unstamped build or no page'}. Check the ${site.worker} Worker's Deployments in Cloudflare.`);
  return false;
}

/**
 * After a preview upload: the preview must answer 200, then each of the
 * site's routes is reported. Returns { ok, markdown }.
 */
export async function previewCheck(site, branch, sha = '') {
  const url = previewUrl(site, branch);
  const n = attempts(12);
  let status = 0;
  let served = '';
  for (let i = 1; i <= n; i++) {
    const res = await httpGet(`${url}/?preview-check=${Date.now()}`);
    status = res.status;
    served = buildShaIn(res.body);
    if (status === 200 && (!sha || served === sha)) break;
    console.log(`Attempt ${i}/${n}: HTTP ${status}${served ? `, serving ${served.slice(0, 7)}` : ''}, waiting...`);
    if (i < n) await sleep(interval(10));
  }
  const rows = [];
  for (const route of site.routes) {
    const res = await httpGet(`${url}${route}`);
    rows.push(`| [\`${route}\`](${url}${route}) | ${res.status || 'no answer'} |`);
  }
  const robots = await httpGet(`${url}/robots.txt`);
  const ok = status === 200;
  const markdown = [
    `### ${ok ? '✅' : '❌'} \`${site.dir}\` preview`,
    '',
    `**${url}**`,
    '',
    `Branch \`${branch}\`${sha ? ` at \`${sha.slice(0, 7)}\`` : ''}${served ? `, serving \`${served.slice(0, 7)}\`` : ''}. Production is unchanged.`,
    '',
    '| Page | HTTP |',
    '| --- | --- |',
    ...rows,
    '',
    `robots.txt: ${/Disallow: \/\s*$/m.test(robots.body) ? '`Disallow: /` (not indexed)' : `HTTP ${robots.status}, no Disallow`}`,
    '',
    'Previews share production\'s secrets and storage: test forms with your own addresses.',
    '',
  ].join('\n');
  if (!ok) {
    console.log(`::error::The ${site.dir} preview at ${url} did not answer 200 (last: HTTP ${status || 'no answer'}). If every attempt was 404, turn on Preview URLs for the Worker: Cloudflare > Workers & Pages > ${site.worker} > Settings > Domains & Routes > Preview URLs (or "preview_urls": true in its wrangler.jsonc, then deploy once).`);
  }
  return { ok, markdown };
}

// ── CLI ──────────────────────────────────────────────────────────────────

function sitesArg(arg) {
  return arg === 'all' ? allSites() : [getSite(arg)];
}

async function main(argv) {
  const [command, ...args] = argv;
  const flag = (name) => {
    const i = args.indexOf(name);
    return i === -1 ? undefined : args.splice(i, 2)[1];
  };
  switch (command) {
    case 'list':
      for (const s of allSites()) console.log(`${s.dir.padEnd(34)} ${s.siteUrl}`);
      break;
    case 'info': {
      if (!args[0]) fail('Usage: pnpm cf info <site>');
      const { path: _p, secrets: _s, ...info } = getSite(args[0]);
      console.log(JSON.stringify(info));
      break;
    }
    case 'build': {
      const branch = flag('--preview');
      if (!args[0]) fail('Usage: pnpm cf build <site> [--preview <branch>]');
      const site = getSite(args[0]);
      build(site, branch ? { preview: true, siteUrl: previewUrl(site, branch) } : {});
      break;
    }
    case 'deploy':
      if (!args[0]) fail('Usage: pnpm cf deploy <site|all>');
      for (const s of sitesArg(args[0])) deploy(s);
      break;
    case 'preview':
      if (!args[0] || !args[1]) fail('Usage: pnpm cf preview <site|all> <branch>');
      for (const s of sitesArg(args[0])) preview(s, args[1]);
      break;
    case 'preview-url':
      if (!args[0] || !args[1]) fail('Usage: pnpm cf preview-url <site> <branch>');
      console.log(previewUrl(getSite(args[0]), args[1]));
      break;
    case 'live-sha':
      if (!args[0]) fail('Usage: pnpm cf live-sha <site>');
      console.log(await liveSha(getSite(args[0])));
      break;
    case 'needs-deploy': {
      if (!args[0] || !args[1]) fail('Usage: pnpm cf needs-deploy <site> <sha>');
      const { needed, reason } = await needsDeploy(getSite(args[0]), args[1]);
      console.error(reason);
      console.log(String(needed));
      break;
    }
    case 'verify':
      if (!args[0] || !args[1]) fail('Usage: pnpm cf verify <site> <sha>');
      if (!(await verify(getSite(args[0]), args[1]))) process.exit(1);
      break;
    case 'preview-check': {
      const report = flag('--report');
      const sha = flag('--sha') || process.env.PUBLIC_BUILD_SHA || '';
      if (!args[0] || !args[1]) fail('Usage: pnpm cf preview-check <site> <branch> [--sha <sha>] [--report <file>]');
      const { ok, markdown } = await previewCheck(getSite(args[0]), args[1], sha);
      console.log(markdown);
      if (report) fs.writeFileSync(report, markdown);
      if (!ok) process.exit(1);
      break;
    }
    case 'changed':
      // JSON array of site folders, for the GitHub Actions matrix.
      console.log(JSON.stringify(changed(args[0], args[1] || 'HEAD').map((s) => s.dir)));
      break;
    default:
      fail('Usage: pnpm cf <list|info|build|deploy|preview|preview-url|live-sha|needs-deploy|verify|preview-check|changed> ...  (see scripts/cloudflare.mjs)');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}
