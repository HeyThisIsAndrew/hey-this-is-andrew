#!/usr/bin/env node
/**
 * Cloudflare Workers: one script for every site.
 *
 *   pnpm cf list                         sites that deploy to Cloudflare
 *   pnpm cf build  <site>                build it for Cloudflare
 *   pnpm cf deploy <site>                build, then deploy its Worker
 *   pnpm cf deploy all                   every Cloudflare site
 *   pnpm cf preview <site|all> <branch>  build, then upload a preview version
 *   pnpm cf preview-url <site> <branch>  print the preview URL for a branch
 *   pnpm cf changed <base> <head>        sites touched between two commits (CI)
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
 *
 * Worker secrets: list their names in the block ("secrets": ["RESEND_API_KEY"]).
 * After a deploy, each one present in the environment is copied onto the
 * Worker (CI passes them from repository secrets); absent ones are left as
 * they are on Cloudflare.
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
    secrets: pkg.cloudflare.secrets || [],
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

const execPath = process.env.npm_execpath;
const pnpm = execPath && /pnpm/.test(execPath)
  ? /\.[cm]?js$/i.test(execPath)
    ? [process.execPath, [execPath]]
    : [execPath, []]
  : ['pnpm', []];

function previewAlias(worker, branch) {
  const maxAliasLen = Math.max(1, 63 - worker.length - 1);
  const normalized = String(branch || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxAliasLen)
    .replace(/-+$/g, '');
  return normalized || 'preview';
}

function previewUrl(site, alias) {
  return `https://${alias}-${site.worker}.${WORKERS_SUBDOMAIN}.workers.dev`;
}

function wranglerConfigFor(site) {
  // The Astro Cloudflare adapter writes a complete config for server sites;
  // static sites use their own wrangler.jsonc (assets from ./dist).
  const adapterConfig = path.join(site.path, 'dist/server/wrangler.json');
  const config = fs.existsSync(adapterConfig) ? adapterConfig : path.join(site.path, 'wrangler.jsonc');
  if (!fs.existsSync(config)) fail(`${site.dir} has no wrangler.jsonc.`);
  return config;
}

function build(site, siteUrlOverride = site.siteUrl) {
  // Every site reads its origin and base path from these. Root-served, so
  // the base is "/" (the GitHub Pages copies use sub-paths instead).
  const env = {
    ...process.env,
    CF_WORKERS: '1',
    SITE_URL: siteUrlOverride,
    ASTRO_SITE: siteUrlOverride,
    BASE_PATH: '/',
    ASTRO_BASE: '/',
    ASTRO_TELEMETRY_DISABLED: '1',
  };
  fs.rmSync(path.join(site.path, 'dist'), { recursive: true, force: true });
  run(pnpm[0], [...pnpm[1], '--filter', site.pkgName, 'build'], { env });
}

function deploy(site) {
  build(site);
  const config = wranglerConfigFor(site);
  run(pnpm[0], [...pnpm[1], 'exec', 'wrangler', 'deploy', '--config', config], { cwd: site.path });
  for (const name of site.secrets) {
    const value = process.env[name];
    if (!value) continue;
    console.log(`\n$ wrangler secret put ${name} --name ${site.worker}`);
    execFileSync(pnpm[0], [...pnpm[1], 'exec', 'wrangler', 'secret', 'put', name, '--name', site.worker], {
      cwd: site.path,
      input: value,
      stdio: ['pipe', 'inherit', 'inherit'],
    });
  }
  console.log(`\nLive: ${site.siteUrl}`);
}

function preview(site, branch) {
  const alias = previewAlias(site.worker, branch);
  const url = previewUrl(site, alias);
  build(site, url);
  const config = wranglerConfigFor(site);
  run(
    pnpm[0],
    [
      ...pnpm[1],
      'exec',
      'wrangler',
      'versions',
      'upload',
      '--config',
      config,
      '--preview-alias',
      alias,
      '--message',
      `Preview: ${branch}`,
    ],
    { cwd: site.path },
  );
  console.log(`\nPreview: ${url}`);
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
  case 'preview':
    if (!args[0] || !args[1]) fail('Usage: pnpm cf preview <site|all> <branch>');
    for (const s of args[0] === 'all' ? allSites() : [getSite(args[0])]) preview(s, args[1]);
    break;
  case 'preview-url': {
    if (!args[0] || !args[1]) fail('Usage: pnpm cf preview-url <site> <branch>');
    const site = getSite(args[0]);
    console.log(previewUrl(site, previewAlias(site.worker, args[1])));
    break;
  }
  case 'changed':
    // JSON array of site folders, for the GitHub Actions matrix.
    console.log(JSON.stringify(changed(args[0], args[1]).map((s) => s.dir)));
    break;
  default:
    fail('Usage: pnpm cf <list|build|deploy|preview|preview-url|changed> ...  (see scripts/cloudflare.mjs)');
}
