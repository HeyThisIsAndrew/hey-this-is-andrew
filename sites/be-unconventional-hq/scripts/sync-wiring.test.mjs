/*
  THE SYNC PLUMBING, PINNED.

  THE INCIDENT — 2026-08-14 13:18 UTC, scheduled sync-youtube.yml run
  Two independent faults in one shell line.

  1. THE YOUTUBE SYNC HAD BEEN WRITING NOTHING.

     "sync" was a shell chain:

       node scripts/sync-youtube.mjs && node --env-file=.env scripts/sync-instagram.mjs

     npm appends passthrough arguments to the END of that string, so
     `npm run sync -- --execute` put `--execute` on the LAST command only. Both
     scripts are dry-run by default, so the YouTube sync previewed and exited
     while the job reported success. Straight from the failing log, with
     --execute explicitly requested:

       [dry-run] Would sync 191 docs (181 from YouTube, 10 preserved, 0 retired)
       [dry-run] Pass --execute to write.

     A shell chain cannot fan arguments out past its last member, so it is
     replaced by scripts/sync-all.mjs, which spawns each sync with this
     process's exact argv.

  2. `--env-file=.env` IS A HARD ERROR WHEN THE FILE IS ABSENT.

       node: .env: not found
       ##[error]Process completed with exit code 9

     Which is every CI runner: secrets arrive as environment variables, not as
     a committed .env. `--env-file-if-exists` loads it locally and is a no-op
     in CI.

  And the coupling underneath both: a workflow named "Sync YouTube videos",
  holding only YOUTUBE_* secrets, ran `npm run sync` — which also runs the
  Instagram sync. A source the job has no credentials for was failing a source
  it does.

  WHAT THIS TEST CAN AND CANNOT DO
  It cannot run a sync: both need credentials and live network, so neither
  works in CI or in the build sandbox — which is precisely why a dry-run
  regression survived unnoticed for as long as it did. What it pins is the
  wiring, which is where every one of these faults actually lived, and which
  is checkable with nothing but the repository.
*/
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${error.message}`);
    failed++;
  }
}

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const scripts = pkg.scripts || {};
const syncAll = fs.readFileSync(path.join(ROOT, 'scripts/sync-all.mjs'), 'utf8');
const igSync = fs.readFileSync(path.join(ROOT, 'scripts/sync-instagram.mjs'), 'utf8');
const workflow = fs.readFileSync(
  path.join(ROOT, '.github/workflows/sync-youtube.yml'),
  'utf8'
);

console.log('Sync wiring:');

test('no npm script chains two syncs with && (the flag would reach only the last)', () => {
  for (const [name, body] of Object.entries(scripts)) {
    if (!/sync/i.test(name)) continue;
    const syncScripts = (body.match(/scripts\/sync-[a-z-]+\.mjs/g) || []).filter(
      (s) => !s.includes('sync-all')
    );
    assert.ok(
      !(body.includes('&&') && syncScripts.length > 1),
      `"${name}" chains ${syncScripts.length} sync scripts with &&:\n        ${body}\n` +
        '      npm appends passthrough args to the END of the string, so\n' +
        '      `npm run ' + name + ' -- --execute` would reach only the last one and\n' +
        '      the others would silently dry-run. Use scripts/sync-all.mjs, which\n' +
        '      forwards argv to every sync.',
    );
  }
});

test('no npm script uses the hard-failing --env-file', () => {
  for (const [name, body] of Object.entries(scripts)) {
    const bad = /--env-file=/.test(body);
    assert.ok(
      !bad,
      `"${name}" uses --env-file=: ${body}\n` +
        '      That is a hard error when the file is absent, which is every CI\n' +
        '      runner — it exited the scheduled sync with code 9. Use\n' +
        '      --env-file-if-exists= instead.',
    );
  }
});

test('sync-all forwards this process’s argv to every sync', () => {
  assert.ok(
    /const forwardedArgs = process\.argv\.slice\(2\)/.test(syncAll),
    'sync-all.mjs must capture process.argv.slice(2)',
  );
  assert.ok(
    /\.\.\.forwardedArgs/.test(syncAll),
    'sync-all.mjs must spread the forwarded args into each spawn, or a flag\n' +
      '      like --execute silently stops reaching the child scripts.',
  );
});

test('one failing sync does not abort the others', () => {
  assert.ok(
    !/process\.exit\(1\)[\s\S]{0,80}for \(const sync of SYNCS\)/.test(syncAll),
    'sync-all must not exit inside the loop',
  );
  assert.ok(
    /results\.push\(await run\(/.test(syncAll),
    'sync-all must collect every result and report at the end. The sources are\n' +
      '      independent; letting a missing Instagram token stop a working YouTube\n' +
      '      sync is the coupling that broke the scheduled job.',
  );
});

test('sync-all still exits non-zero when something failed', () => {
  assert.ok(
    /if \(failed\.length > 0\)[\s\S]{0,200}process\.exit\(1\)/.test(syncAll),
    'a failed sync must fail the process, or CI goes green on a broken run —\n' +
      '      which is the whole reason this went unnoticed.',
  );
});

test('the YouTube workflow runs the YouTube sync ONLY', () => {
  /* Command lines only — a stale header comment is worth fixing but is not a
     broken workflow, and conflating the two makes the failure message lie. */
  const runs = workflow
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n')
    .match(/npm run sync[a-z:-]*/g) || [];
  assert.ok(runs.length > 0, 'the workflow no longer runs any sync');
  /* sync:dispatch-images (THE HQ DISPATCH's story images) is allowed: it
     needs no secrets at all, and the new videos this job syncs are exactly
     what it has to build images for. Anything else, and above all the
     combined `npm run sync`, is still refused. */
  const ALLOWED = ['npm run sync:youtube', 'npm run sync:dispatch-images'];
  for (const cmd of runs) {
    assert.ok(
      ALLOWED.includes(cmd),
      `sync-youtube.yml runs "${cmd}". It holds only YOUTUBE_* secrets, so\n` +
        '      running the combined `npm run sync` drags in the Instagram sync and\n' +
        '      fails the job on credentials it was never given.',
    );
  }
});

test('the workflow still asks for --execute on its real runs', () => {
  assert.ok(
    /npm run sync:youtube -- --execute/.test(workflow),
    'the non-dry-run branch must pass --execute, or the schedule writes nothing.',
  );
});

test('a missing Instagram token skips instead of throwing', () => {
  assert.ok(
    !/throw new Error\('META_ACCESS_TOKEN/.test(igSync),
    'sync-instagram must not throw when unconfigured — it takes the whole\n' +
      '      combined sync down with it.',
  );
  assert.ok(
    /return null/.test(igSync) && /skipping the Instagram sync/i.test(igSync),
    'sync-instagram must warn loudly and return null when there is no token.',
  );
});

test('an empty API response never blanks the stored feed', () => {
  assert.ok(
    /media\.length === 0/.test(igSync) && /Refusing to overwrite/i.test(igSync),
    'a zero-item response is far more likely to be a bad token or a rate limit\n' +
      '      than a genuinely empty account, and must not overwrite\n' +
      '      src/data/instagram.json — same never-delete contract as the articles sync.',
  );
});

test('an Instagram sync workflow exists and uses the EXISTING Meta secret', () => {
  const p = path.join(ROOT, '.github/workflows/sync-instagram.yml');
  assert.ok(
    fs.existsSync(p),
    'There is no sync-instagram.yml. META_ACCESS_TOKEN has been a repository\n' +
      '      secret all along (sync-media-kit.yml uses it), but nothing ever ran the\n' +
      '      Instagram CONTENT sync with it, so the feed was only refreshed by hand.',
  );
  const wf = fs.readFileSync(p, 'utf8');
  assert.ok(
    /secrets\.META_ACCESS_TOKEN/.test(wf),
    'the workflow must read the existing META_ACCESS_TOKEN secret — no new\n' +
      '      Instagram-specific token exists or is needed; the Graph API reaches\n' +
      '      Instagram through the linked Facebook Page.',
  );
  assert.ok(
    /npm run sync:instagram -- --execute/.test(wf),
    'the workflow must pass --execute on its real runs, or it only ever previews.',
  );
});

test('the Instagram workflow commits the images as well as the JSON', () => {
  const wf = fs.readFileSync(path.join(ROOT, '.github/workflows/sync-instagram.yml'), 'utf8');
  assert.ok(
    /git add src\/data\/instagram\.json public\/instagram/.test(wf),
    'the JSON references files in public/instagram/ by path, so committing one\n' +
      '      without the other ships a feed pointing at images that are not in the\n' +
      '      repository.',
  );
});

test('the sync prunes images that have left the feed', () => {
  assert.ok(
    /pruneOrphanedMedia/.test(igSync),
    'a daily workflow that commits downloaded images needs to remove the ones\n' +
      '      that age out of the 50-post window, or the repository grows forever.',
  );
  assert.ok(
    /const keep = new Set\(/.test(igSync),
    'the prune must be driven by the set of files just written, never by a\n' +
      '      wildcard delete.',
  );
});

test('a quiet run does not rewrite the JSON (no needless rebuild)', () => {
  assert.ok(
    /function stableShape\(/.test(igSync),
    'The sync must compare against a signature-normalised shape before writing.\n' +
      '      Instagram re-signs its CDN URLs on every fetch, so displayUrl differs\n' +
      '      every run even when nothing changed — writing that back means a\n' +
      '      commit and a Cloudflare rebuild four times a day for nothing.',
  );
  assert.ok(
    /stableShape\(previous\) === stableShape\(media\)[\s\S]{0,400}return;/.test(igSync),
    'the equality check must return WITHOUT writing when only signatures moved.',
  );
});

test('the signature normaliser ignores query strings but not content', () => {
  /* Extracted and executed, not pattern-matched: this one is pure and its
     behaviour is the whole point, so it is worth actually running. */
  const body = igSync.slice(
    igSync.indexOf('function stableShape'),
    igSync.indexOf('async function fetchInstagramMedia')
  );
  const stableShape = new Function(body + '; return stableShape;')();

  const base = [{ id: '1', caption: 'hello', displayUrl: 'https://cdn/x.jpg?oe=AAAA' }];
  const resigned = [{ id: '1', caption: 'hello', displayUrl: 'https://cdn/x.jpg?oe=BBBB' }];
  const edited = [{ id: '1', caption: 'edited', displayUrl: 'https://cdn/x.jpg?oe=AAAA' }];
  const added = [...base, { id: '2', caption: 'new', displayUrl: 'https://cdn/y.jpg?oe=C' }];

  assert.equal(stableShape(base), stableShape(resigned), 'a re-signed URL must compare EQUAL');
  assert.notEqual(stableShape(base), stableShape(edited), 'an edited caption must compare different');
  assert.notEqual(stableShape(base), stableShape(added), 'a new post must compare different');
});

test('media already on disk is not re-downloaded', () => {
  assert.ok(
    /existingByIchId/.test(igSync),
    'localiseMedia() must index public/instagram/ once and skip ids it already\n' +
      '      has. The media behind a post id never changes — only the URL signature\n' +
      '      rotates — so refetching all 50 every run is 200 needless downloads a\n' +
      '      day at the 6-hourly cadence.',
  );
});

test('the Instagram schedule runs at least every 6 hours, offset from the others', () => {
  const wf = fs.readFileSync(path.join(ROOT, '.github/workflows/sync-instagram.yml'), 'utf8');
  const cron = (wf.match(/cron:\s*'([^']+)'/) || [])[1];
  assert.ok(cron, 'no cron schedule found');
  const [minute, hour] = cron.split(' ');
  assert.match(
    hour,
    /^\*\/[1-6]$/,
    `cron hour field is "${hour}"; the owner asked for at least every 6 hours.`,
  );
  assert.notEqual(
    minute,
    '0',
    'offset the minute from :00 — sync-youtube and sync-articles both run there,\n' +
      '      and three jobs racing for a runner and a rebuild at the same instant is\n' +
      '      avoidable.',
  );
});

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
