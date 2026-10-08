#!/usr/bin/env node
/*
  Registers the sync-json merge driver in THIS clone's .git/config.

  .gitattributes can NAME a merge driver but cannot define one — git
  deliberately will not execute a program a repository supplies, or cloning a
  repo would be code execution. So every clone runs this once.

  Idempotent, and safe to run from a postinstall hook.

  TWO GUARDS, because the first one does not cover what its comment used to
  claim it did. It said this no-ops on "CI checkouts" — but a CI checkout IS a
  git work tree, so `rev-parse --is-inside-work-tree` succeeds there and the
  driver was registered on every build. Caught in a Cloudflare Workers Build
  log, which printed the whole three-line success banner on a deploy:

    > beunconventionalhq@0.0.1 postinstall
    > node scripts/setup-git.mjs
    [setup-git] Registered the sync-json merge driver. …

  Harmless — the config lands in an ephemeral container that never merges
  anything — but it is pointless work and noise in the deploy log of every
  release. An automated build has no interactive merges to resolve, so it has
  no use for a merge driver.

  If a platform sets none of these variables the only cost is that banner
  again, so this stays a short list rather than an exhaustive one.
*/
import { execFileSync } from 'node:child_process';

const AUTOMATION = ['CI', 'CONTINUOUS_INTEGRATION', 'GITHUB_ACTIONS', 'CF_PAGES', 'WORKERS_CI'];

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

const automated = AUTOMATION.find((name) => process.env[name]);
if (automated) {
  process.exit(0); // an automated build never resolves a merge by hand
}

try {
  git('rev-parse', '--is-inside-work-tree');
} catch {
  process.exit(0); // not a git checkout; nothing to configure
}

const DRIVER = 'node scripts/merge-sync-json.mjs %O %A %B %P';
let existing = '';
try { existing = git('config', '--get', 'merge.sync-json.driver'); } catch { /* unset */ }

if (existing === DRIVER) {
  console.log('[setup-git] sync-json merge driver already registered.');
  process.exit(0);
}

git('config', 'merge.sync-json.name', 'Per-document merge for synced data files');
git('config', 'merge.sync-json.driver', DRIVER);
console.log(
  '[setup-git] Registered the sync-json merge driver.\n' +
    '            src/data/{videos,articles,instagram,article-images}.json will now\n' +
    '            merge per document instead of conflicting wholesale. It still stops\n' +
    '            and asks whenever an editorial field disagrees.',
);
