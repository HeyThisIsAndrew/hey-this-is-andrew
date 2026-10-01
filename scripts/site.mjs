#!/usr/bin/env node
/**
 * scripts/site.mjs: the short commands for the personal site (see README).
 * Run them as `./site <command>` (no pnpm involved, so Ctrl+C is quiet) or
 * as `pnpm <command>`.
 *
 *   pnpm review [branch]  get a branch (default: the one you are on), install,
 *                         download the photos and start the site
 *   pnpm dev              start the site at http://localhost:3000
 *   pnpm photos           download the "Shot on the job" photos
 *   pnpm clean            undo what `pnpm photos` changed (do this before
 *                         committing or switching branches)
 *   pnpm check            the same checks GitHub runs before publishing
 *
 * Works under plain `pnpm` and under `corepack pnpm` (no global pnpm
 * needed): it never calls `pnpm` itself, it runs Node, git and the site's
 * own tools directly. Ctrl+C stops the site quietly.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SITE = path.join(ROOT, 'sites/hey-this-is-andrew');
const ASTRO = path.join(SITE, 'node_modules/astro/bin/astro.mjs');
// The photo sync writes these; `clean` puts them back.
const SYNC_FILES = ['sites/hey-this-is-andrew/src/data/instagram-feed.json', 'sites/hey-this-is-andrew/src/data/instagram-media-todo.md'];
const PHOTO_DIR = 'sites/hey-this-is-andrew/src/assets/instagram';

const say = (msg) => console.log(`\n\x1b[1m> ${msg}\x1b[0m`);
const fail = (msg) => {
  console.error(`\n\x1b[31m${msg}\x1b[0m`);
  process.exit(1);
};

/** Run a command to completion; stop everything if it fails. */
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', ...opts });
  if (r.status !== 0) fail(`Stopped: \`${[cmd, ...args].join(' ')}\` did not finish. The message above says why.`);
}

/** pnpm itself, whichever way this was started: under pnpm (plain or
    corepack) it is the running pnpm; from ./site it is `corepack pnpm`,
    which works without a global pnpm; plain `pnpm` is the last resort. */
function pnpm(args, opts) {
  const exec = process.env.npm_execpath;
  if (exec && /pnpm/.test(exec)) return run(process.execPath, [exec, ...args], opts);
  if (spawnSync('corepack', ['--version'], { stdio: 'ignore' }).status === 0) return run('corepack', ['pnpm', ...args], opts);
  return run('pnpm', args, opts);
}

function needInstall() {
  if (!fs.existsSync(ASTRO)) fail('The site is not installed yet. Run: ./site review');
}

function photos() {
  needInstall();
  say('Downloading the "Shot on the job" photos');
  run(process.execPath, ['scripts/sync-instagram.mjs'], { cwd: SITE });
}

function clean() {
  say('Removing the downloaded photos (the files `pnpm photos` changed)');
  const tracked = SYNC_FILES.filter((f) => spawnSync('git', ['ls-files', '--error-unmatch', f], { cwd: ROOT, stdio: 'ignore' }).status === 0);
  if (tracked.length) run('git', ['checkout', '--', ...tracked]);
  run('git', ['clean', '-fq', '--', PHOTO_DIR]);
  console.log('Done. Nothing from the photo download is left to commit.');
}

/** The site, in the foreground. Ctrl+C ends it with no error message. */
function dev() {
  needInstall();
  say('Starting the site. Open http://localhost:3000 (Ctrl+C to stop)');
  const child = spawn(process.execPath, [ASTRO, 'dev', '--host', '0.0.0.0', '--port', '3000'], { cwd: SITE, stdio: 'inherit' });
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
  // The site's own test command (the root `test` calls pnpm recursively,
  // which needs pnpm installed globally).
  const siteTest = JSON.parse(fs.readFileSync(path.join(SITE, 'package.json'), 'utf8')).scripts?.test;
  if (siteTest) run(siteTest, [], { cwd: SITE, shell: true });
  say('Building the site the way GitHub does');
  run(process.execPath, [ASTRO, 'build'], { cwd: SITE, env: { ...process.env, ASTRO_BASE: '/hey-this-is-andrew/', ASTRO_TELEMETRY_DISABLED: '1' } });
  say('Checking the built site');
  run(process.execPath, ['scripts/audit-dist.mjs'], { cwd: SITE, env: { ...process.env, ASTRO_BASE: '/hey-this-is-andrew/' } });
  console.log('\nAll checks passed.');
}

const [command, arg] = process.argv.slice(2);
const commands = { review: () => review(arg), dev, photos, clean, check };
if (!commands[command]) fail(`Unknown command "${command ?? ''}". Use one of: ${Object.keys(commands).join(', ')}.`);
commands[command]();
