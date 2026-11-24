#!/usr/bin/env node
/**
 * pnpm new-site <name>
 *
 * Copies templates/site-starter to sites/<name>, names the package, points
 * its deploy template at the new folder, and installs. The copy is yours to
 * edit; the template stays untouched for the next site.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pnpmCommand } from './pnpm-command.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const name = process.argv[2];

if (!name || !/^[a-z0-9][a-z0-9-]*$/.test(name)) {
  console.error('Usage: pnpm new-site <name>   (lowercase letters, digits and dashes, e.g. my-client-site)');
  process.exit(1);
}

// The name is the Cloudflare Worker's name, and previews live at
// <branch>-<name>.<subdomain>.workers.dev: one DNS label of at most 63
// characters, so keep room for a readable branch alias.
if (name.length > 40) {
  console.error(`"${name}" is ${name.length} characters; keep site names to 40 or fewer so branch previews stay readable.`);
  process.exit(1);
}

const from = path.join(root, 'templates/site-starter');
const to = path.join(root, 'sites', name);
if (fs.existsSync(to)) {
  console.error(`sites/${name} already exists. Pick another name.`);
  process.exit(1);
}

const SKIP = new Set(['node_modules', 'dist', '.astro']);
fs.cpSync(from, to, { recursive: true, filter: (src) => !SKIP.has(path.basename(src)) });

const pkgFile = path.join(to, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
pkg.name = name;
if (pkg.cloudflare) pkg.cloudflare.worker = name;
fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n');

const wranglerFile = path.join(to, 'wrangler.jsonc');
if (fs.existsSync(wranglerFile)) {
  fs.writeFileSync(wranglerFile, fs.readFileSync(wranglerFile, 'utf8').replaceAll('__SITE__', name));
}

const deployFile = path.join(to, 'deploy/github-pages.yml');
fs.writeFileSync(deployFile, fs.readFileSync(deployFile, 'utf8').replaceAll('__SITE__', name));

console.log(`Created sites/${name}. Installing...`);
// The running pnpm (npm/corepack install, or the standalone @pnpm/exe
// binary), else pnpm from PATH, else corepack's.
const [pnpmBin, pnpmArgs] = pnpmCommand();
execFileSync(pnpmBin, [...pnpmArgs, 'install'], { cwd: root, stdio: 'inherit' });
console.log(`
Next:
  1. sites/${name}/src/styles/theme.css   set your colours
  2. sites/${name}/src/data/site.ts       name, links, socials
  3. corepack pnpm --filter ${name} dev   then open http://localhost:4321
  4. http://localhost:4321/local-cms      edit posts, brand panels, and gallery
     (saves src/data/*.json; commit and push)
  5. Open a pull request: it gets a preview at
     https://<branch>-${name}.heythisisandrewb.workers.dev (noindex).
     Merge to main: it deploys to https://${name}.heythisisandrewb.workers.dev
     (by hand: corepack pnpm cf deploy ${name})
`);
