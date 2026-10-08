/**
 * Run every content sync, forwarding this process's flags to ALL of them.
 *
 * ─── THE BUG THIS EXISTS TO KILL ────────────────────────────────────────────
 *
 * `sync` used to be a shell chain:
 *
 *   "sync": "node scripts/sync-youtube.mjs && node --env-file=.env scripts/sync-instagram.mjs"
 *
 * npm appends passthrough arguments to the END of that string, so
 * `npm run sync -- --execute` expanded to:
 *
 *   node scripts/sync-youtube.mjs && node --env-file=.env scripts/sync-instagram.mjs --execute
 *                                 ^ no --execute
 *
 * The flag reached only the last command in the chain. Both sync scripts are
 * dry-run by default, so the YouTube sync had been quietly previewing and
 * writing NOTHING on every scheduled run. From the 2026-08-14 13:18 CI log,
 * with `--execute` explicitly requested:
 *
 *   [dry-run] Would sync 191 docs (181 from YouTube, 10 preserved, 0 retired)
 *   [dry-run] Pass --execute to write.
 *
 * A shell chain cannot fan arguments out to more than its last member, so the
 * chain is replaced rather than patched. Each script is spawned with the exact
 * argv this process received.
 *
 * ORDER AND FAILURE SEMANTICS
 * Sequential, in declaration order, so the logs of a multi-source sync stay
 * readable. A failing sync does not abort the ones after it — the sources are
 * independent, and letting a missing Instagram token stop a working YouTube
 * sync is precisely the coupling that broke the scheduled job. Every failure
 * is reported at the end and the process exits non-zero, so nothing fails
 * silently.
 */
import { spawn } from 'node:child_process';

/** Extra node flags a script needs, and the script itself. */
const SYNCS = [
  {
    name: 'articles',
    nodeArgs: [],
    script: 'scripts/sync-articles.mjs',
  },
  {
    name: 'youtube',
    nodeArgs: [],
    script: 'scripts/sync-youtube.mjs',
  },
  {
    name: 'instagram',
    /* `--env-file-if-exists`, NOT `--env-file`. The latter is a hard error
       when the file is absent, which is every CI runner — secrets arrive as
       real environment variables there, not as a committed .env. That is the
       second half of the same broken run:

         node: .env: not found
         ##[error]Process completed with exit code 9

       The if-exists form loads .env for local development and is a no-op in
       CI. Requires Node >= 20.12; package.json pins >= 22.15. */
    nodeArgs: ['--env-file-if-exists=.env'],
    script: 'scripts/sync-instagram.mjs',
  },
];

function run({ name, nodeArgs, script }, forwardedArgs) {
  return new Promise((resolve) => {
    console.log(`\n─── sync: ${name} ───`);
    const child = spawn(process.execPath, [...nodeArgs, script, ...forwardedArgs], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('close', (code) => resolve({ name, code: code ?? 1 }));
    child.on('error', (err) => {
      console.error(`[sync-all] ${name} could not start: ${err.message}`);
      resolve({ name, code: 1 });
    });
  });
}

const forwardedArgs = process.argv.slice(2);
const results = [];
for (const sync of SYNCS) {
  results.push(await run(sync, forwardedArgs));
}

const failed = results.filter((r) => r.code !== 0);
console.log('\n─── sync summary ───');
for (const { name, code } of results) {
  console.log(`  ${code === 0 ? '✓' : '✗'} ${name}${code === 0 ? '' : ` (exit ${code})`}`);
}

if (failed.length > 0) {
  console.error(
    `\n[sync-all] ${failed.length} sync(s) failed: ${failed.map((f) => f.name).join(', ')}`
  );
  process.exit(1);
}
