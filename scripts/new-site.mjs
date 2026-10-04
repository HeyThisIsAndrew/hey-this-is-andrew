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
import { execSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const name = process.argv[2];

if (!name || !/^[a-z0-9][a-z0-9-]*$/.test(name)) {
  console.error('Usage: pnpm new-site <name>   (lowercase letters, digits and dashes, e.g. my-client-site)');
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
fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n');

const deployFile = path.join(to, 'deploy/github-pages.yml');
fs.writeFileSync(deployFile, fs.readFileSync(deployFile, 'utf8').replaceAll('__SITE__', name));

console.log(`Created sites/${name}. Installing...`);
// The running pnpm when started as `pnpm new-site`; otherwise corepack's
// (works without a global pnpm, e.g. `corepack pnpm new-site`).
const pnpmCmd = process.env.npm_execpath && /pnpm/.test(process.env.npm_execpath)
  ? `"${process.execPath}" "${process.env.npm_execpath}"`
  : 'corepack pnpm';
execSync(`${pnpmCmd} install`, { cwd: root, stdio: 'inherit' });
console.log(`
Next:
  1. sites/${name}/src/styles/theme.css   set your colours
  2. sites/${name}/src/data/site.ts       name, links, socials
  3. corepack pnpm --filter ${name} dev   then open http://localhost:4321
  4. http://localhost:4321/local-cms      the brand panels and your posts
     (saves src/data/*.json; commit and push)
`);
