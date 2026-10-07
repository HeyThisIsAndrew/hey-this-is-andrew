#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const say = (msg) => console.log(`\n\x1b[1m> ${msg}\x1b[0m`);
const fail = (msg) => {
  console.error(`\n\x1b[31m${msg}\x1b[0m`);
  process.exit(1);
};

// Parse args
const args = process.argv.slice(2);
let siteName = 'hey-this-is-andrew';
let command = args[0];
let branchArg = args[1];

if (args.length > 0) {
  const possibleSite = path.join(ROOT, 'sites', args[0]);
  if (fs.existsSync(possibleSite) && fs.statSync(possibleSite).isDirectory()) {
    siteName = args[0];
    command = args[1];
    branchArg = args[2];
  }
}

if (!command) {
  fail(`Usage: ./site [site-name] <command>\nCommands: review, dev, photos, clean, check`);
}

const SITE = path.join(ROOT, 'sites', siteName);
if (!fs.existsSync(SITE)) {
  fail(`Site "${siteName}" not found in sites/`);
}
const ASTRO = path.join(SITE, 'node_modules/astro/bin/astro.mjs');
const SYNC_FILES = [`sites/${siteName}/src/data/instagram-feed.json`, `sites/${siteName}/src/data/instagram-media-todo.md`];
const PHOTO_DIR = `sites/${siteName}/src/assets/instagram`;

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', ...opts });
  if (r.status !== 0) fail(`Stopped: \`${[cmd, ...args].join(' ')}\` did not finish.`);
}

function pnpm(args, opts) {
  const exec = process.env.npm_execpath;
  if (exec && /pnpm/.test(exec)) return run(process.execPath, [exec, ...args], opts);
  if (spawnSync('corepack', ['--version'], { stdio: 'ignore' }).status === 0) return run('corepack', ['pnpm', ...args], opts);
  return run('pnpm', args, opts);
}

function needInstall() {
  if (!fs.existsSync(ASTRO)) fail(`The site ${siteName} is not installed yet. Run: pnpm install`);
}

function photos() {
  needInstall();
  say('Downloading photos');
  run(process.execPath, ['scripts/sync-instagram.mjs'], { cwd: SITE });
}

function clean() {
  say('Removing downloaded photos');
  const tracked = SYNC_FILES.filter((f) => spawnSync('git', ['ls-files', '--error-unmatch', f], { cwd: ROOT, stdio: 'ignore' }).status === 0);
  if (tracked.length) run('git', ['checkout', '--', ...tracked]);
  run('git', ['clean', '-fq', '--', PHOTO_DIR]);
}

function dev() {
  needInstall();
  say(`Starting ${siteName} at http://localhost:3000`);
  // Use pnpm --filter inside as requested: "use pnpm --filter inside."
  // Wait, the prompt said: "Make it take a site name (default hey-this-is-andrew), validate it against sites/*, and use pnpm --filter inside."
  // So for `dev` and others I should probably use pnpm filter.
  // Actually, I can just run pnpm filter for dev and check.
  const child = spawn('corepack', ['pnpm', '--filter', siteName, 'dev'], { cwd: ROOT, stdio: 'inherit' });
  let stopping = false;
  const stop = (sig) => {
    stopping = true;
    child.kill(sig);
  };
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop('SIGTERM'));
  child.on('exit', (code, signal) => {
    if (stopping || signal) {
      console.log('\nSite stopped.');
      process.exit(0);
    }
    process.exit(code ?? 1);
  });
}

function review(branch) {
  clean();
  say('Getting the latest from GitHub');
  run('git', ['fetch', 'origin']);
  if (branch) {
    say(`Switching to ${branch}`);
    run('git', ['checkout', branch]);
  }
  run('git', ['pull', '--ff-only']);
  say('Installing');
  pnpm(['install']);
  photos();
  dev();
}

function check() {
  needInstall();
  say('Unit tests');
  // run through pnpm filter
  // wait, the prompt says "node scripts/site.mjs check: build with ASTRO_BASE=/hey-this-is-andrew/ plus audit-dist." in "Checks before every push".
  // pnpm --filter site test
  pnpm(['--filter', siteName, 'test']);
  say('Building the site');
  const env = { ...process.env, ASTRO_BASE: `/${siteName}/`, ASTRO_TELEMETRY_DISABLED: '1' };
  run('corepack', ['pnpm', '--filter', siteName, 'build'], { cwd: ROOT, env });
  say('Checking the built site');
  run('corepack', ['pnpm', '--filter', siteName, 'exec', 'node', 'scripts/audit-dist.mjs'], { cwd: ROOT, env });
  console.log('\nAll checks passed.');
}

const commands = { review: () => review(branchArg), dev, photos, clean, check };
if (!commands[command]) fail(`Unknown command "${command}".`);
commands[command]();
