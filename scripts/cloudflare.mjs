#!/usr/bin/env node
/**
 * Cloudflare Workers: one script for every site.
 *
 *   pnpm cf list                     sites that deploy to Cloudflare
 *   pnpm cf build  <site>            build it for Cloudflare
 *   pnpm cf deploy <site>            build, then deploy its Worker
 *   pnpm cf deploy all               every Cloudflare site
 *   pnpm cf changed <base> <head>    sites touched between two commits (CI)
 *
 * A site opts in with a "cloudflare" block in its package.json:
 *
 *   "cloudflare": { "worker": "my-site" }
 *
 * plus a wrangler.jsonc beside it (pnpm new-site writes both). It goes live at
 * https://<worker>.<WORKERS_SUBDOMAIN>.workers.dev, or at "siteUrl" when the
 * block sets one (a custom domain). Static sites deploy their dist/ as Worker
 * static assets; a site built with the Astro Cloudflare adapter deploys the
 * dist/server/wrangler.json the adapter writes.
 *
 * Deploying needs Cloudflare credentials: `npx wrangler login` on a laptop, or
 * CLOUDFLARE_API_TOKEN (and optionally CLOUDFLARE_ACCOUNT_ID) in CI.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const WORKERS_SUBDOMAIN = 'heythisisandrewb';

// BE Unconventional HQ has its own repository; the copy under sites/ is out
// of date. Deploying it would overwrite the live HQ Worker (AGENTS.md).
const NEVER_DEPLOY = new Set(['be-unconventional-hq']);

// A change to any of these can change every site's build.
const SHARED_PATHS = ['packages/', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'package.json', 'scripts/cloudflare.mjs'];

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const sitesDir = path.join(root, 'sites');

function readSite(dir) {
  const pkgFile = path.join(sitesDir, dir, 'package.json');
  if (!fs.existsSync(pkgFile)) return null;
  const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
  if (!pkg.cloudflare?.worker || NEVER_DEPLOY.has(dir)) return null;
  const worker = pkg.cloudflare.worker;
  return {
    dir,
    pkgName: pkg.name,
    worker,
    siteUrl: (pkg.cloudflare.siteUrl || `https://${worker}.${WORKERS_SUBDOMAIN}.workers.dev`).replace(/\/$/, ''),
    path: path.join(sitesDir, dir),
  };
}

function allSites() {
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

function run(cmd, args, opts = {}) {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { stdio: 'inherit', cwd: root, ...opts });
}

const pnpm = process.env.npm_execpath && /pnpm/.test(process.env.npm_execpath)
  ? [process.execPath, [process.env.npm_execpath]]
  : ['corepack', ['pnpm']];

function build(site) {
  // Every site reads its origin and base path from these. Root-served, so
  // the base is "/" (the GitHub Pages copies use sub-paths instead).
  const env = {
    ...process.env,
    CF_WORKERS: '1',
    SITE_URL: site.siteUrl,
    ASTRO_SITE: site.siteUrl,
    BASE_PATH: '/',
    ASTRO_BASE: '/',
    ASTRO_TELEMETRY_DISABLED: '1',
  };
  fs.rmSync(path.join(site.path, 'dist'), { recursive: true, force: true });
  run(pnpm[0], [...pnpm[1], '--filter', site.pkgName, 'build'], { env });
}

function deploy(site) {
  build(site);
  // The Astro Cloudflare adapter writes a complete config for server sites;
  // static sites use their own wrangler.jsonc (assets from ./dist).
  const adapterConfig = path.join(site.path, 'dist/server/wrangler.json');
  const config = fs.existsSync(adapterConfig) ? adapterConfig : path.join(site.path, 'wrangler.jsonc');
  if (!fs.existsSync(config)) fail(`${site.dir} has no wrangler.jsonc.`);
  run(pnpm[0], [...pnpm[1], 'exec', 'wrangler', 'deploy', '--config', config], { cwd: site.path });
  console.log(`\nLive: ${site.siteUrl}`);
}

function changed(base, head) {
  const sites = allSites();
  let files;
  try {
    if (!base || /^0+$/.test(base)) throw new Error('no base');
    files = execFileSync('git', ['diff', '--name-only', base, head || 'HEAD'], { cwd: root, encoding: 'utf8' })
      .split('\n').filter(Boolean);
  } catch {
    return sites; // first push or unknown history: deploy everything
  }
  if (files.some((f) => SHARED_PATHS.some((p) => (p.endsWith('/') ? f.startsWith(p) : f === p)))) return sites;
  return sites.filter((s) => files.some((f) => f.startsWith(`sites/${s.dir}/`)));
}

const [command, ...args] = process.argv.slice(2);
switch (command) {
  case 'list':
    for (const s of allSites()) console.log(`${s.dir.padEnd(34)} ${s.siteUrl}`);
    break;
  case 'build':
    if (!args[0]) fail('Usage: pnpm cf build <site>');
    build(getSite(args[0]));
    break;
  case 'deploy':
    if (!args[0]) fail('Usage: pnpm cf deploy <site|all>');
    for (const s of args[0] === 'all' ? allSites() : [getSite(args[0])]) deploy(s);
    break;
  case 'changed':
    // JSON array of site folders, for the GitHub Actions matrix.
    console.log(JSON.stringify(changed(args[0], args[1]).map((s) => s.dir)));
    break;
  default:
    fail('Usage: pnpm cf <list|build|deploy|changed> ...  (see scripts/cloudflare.mjs)');
}
