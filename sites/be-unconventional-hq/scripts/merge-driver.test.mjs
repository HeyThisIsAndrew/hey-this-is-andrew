/*
  The synced-data merge driver.

  This code rewrites src/data/*.json during a merge, unattended. If it is
  wrong it does not throw — it silently drops documents or overwrites
  editorial work, and nobody finds out until a page renders empty. So its
  contract is pinned here rather than trusted.

  Runs the real driver as a subprocess against temp files, the same way git
  invokes it. No git repository needed.
*/
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const DRIVER = join(dirname(fileURLToPath(import.meta.url)), 'merge-sync-json.mjs');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed += 1; }
  catch (e) { console.log(`  ✗ ${name}\n    ${e.message}`); failed += 1; }
}

/** Run the driver as git would. Returns { ok, output, result }. */
function merge(ancestor, ours, theirs, name = 'src/data/videos.json') {
  const dir = mkdtempSync(join(tmpdir(), 'mergedrv-'));
  const p = (n, v) => { const f = join(dir, n); writeFileSync(f, JSON.stringify(v, null, 2)); return f; };
  const O = p('O', ancestor), A = p('A', ours), B = p('B', theirs);
  let ok = true, output = '';
  try { output = execFileSync('node', [DRIVER, O, A, B, name], { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }); }
  catch (e) { ok = false; output = `${e.stdout ?? ''}${e.stderr ?? ''}`; }
  return { ok, output, result: JSON.parse(readFileSync(A, 'utf8')) };
}

const doc = (id, over = {}) => ({ videoId: id, views: 1, featured: false, _updatedAt: '2026-01-01', ...over });

console.log('Synced-data merge driver:');

test('a document only one side has is never dropped', () => {
  const { ok, result } = merge([], [doc('a'), doc('b')], [doc('a'), doc('c')]);
  assert.ok(ok, 'should auto-resolve');
  assert.deepEqual(result.map((d) => d.videoId).sort(), ['a', 'b', 'c']);
});

test('freshness is compared PER DOCUMENT, not per side', () => {
  /*
    The bug this pins was in the first draft: it picked the fresher SIDE
    wholesale. A side can be newer overall while holding a stale copy of one
    document the other side re-fetched, and that document silently kept its
    stale values. Here `ours` is newer overall (b) and `theirs` is newer for a.
  */
  const ours   = [doc('a', { views: 10, _updatedAt: '2026-01-01' }), doc('b', { views: 20, _updatedAt: '2026-09-01' })];
  const theirs = [doc('a', { views: 99, _updatedAt: '2026-05-01' }), doc('b', { views: 30, _updatedAt: '2026-02-01' })];
  const { ok, result } = merge([], ours, theirs);
  assert.ok(ok);
  const by = Object.fromEntries(result.map((d) => [d.videoId, d.views]));
  assert.equal(by.a, 99, 'a: theirs is newer and must win');
  assert.equal(by.b, 20, 'b: ours is newer and must win');
});

test('ANY editorial disagreement refuses the merge', () => {
  // CLAUDE.md hard rule 5. A sync must never overwrite what a human set.
  for (const field of ['featured', 'notes', 'status', 'manualTaxonomyOverride',
                       'hubs', 'topics', 'requiresReview', 'hidden', 'order']) {
    const { ok, output } = merge([], [doc('a', { [field]: 'HUMAN' })], [doc('a', { [field]: 'SYNC' })]);
    assert.equal(ok, false, `${field} disagreement must NOT auto-resolve`);
    assert.match(output, /EDITORIAL/, `${field}: the refusal must say why`);
    assert.match(output, new RegExp(field), `${field}: the refusal must name the field`);
  }
});

test('a newer factual value does NOT license overwriting editorial', () => {
  // The dangerous near-miss: theirs is newer, so a naive "newest wins" would
  // take its featured:false over a human's featured:true.
  const { ok } = merge([],
    [doc('a', { featured: true,  _updatedAt: '2026-01-01' })],
    [doc('a', { featured: false, _updatedAt: '2026-12-01' })]);
  assert.equal(ok, false, 'must refuse regardless of which side is fresher');
});

/*
  ─── event AND featuredBrand ARE EDITORIAL ALL THE WAY DOWN ─────────────────

  Not a hypothetical. Merging main into feat/events-overhaul-clean silently
  reverted five human-authored values across two events, and the driver
  reported "No editorial field touched" — true by its own list, which named
  only video fields.

  A video doc is mostly YouTube's and only a short list belongs to a human.
  These two types are the opposite: they came from the Sanity export and are
  edited in the local CMS, so every non-system field is somebody's typing.
*/
const ev = (slug, over = {}) => ({
  _id: 'ev-' + slug, _type: 'event', _updatedAt: '2026-01-01',
  slug: { current: slug }, title: 'An Event', ...over,
});

test('every non-system field on an event is editorial', () => {
  const { ok, output } = merge(
    [ev('sdcc-2026')],
    [ev('sdcc-2026', { _updatedAt: '2026-09-09', eventType: 'convention-expo', description: 'the rewritten copy' })],
    [ev('sdcc-2026', { _updatedAt: '2026-09-10', eventType: 'convention', description: 'old copy' })],
  );
  assert.ok(!ok, 'a disagreement over eventType or description must refuse the merge');
  assert.match(output, /eventType/, 'the report must name eventType');
  assert.match(output, /description/, 'and description; neither is on the video EDITORIAL list');
  /* The newer side being newer is exactly the trap: main's stamp was later and
     its copy of these fields was older work. */
  assert.match(output, /convention-expo/, 'the report shows what would have been lost');
});

test('a field present on only ONE side still counts as a disagreement', () => {
  /*
    d23-2026 carried `tagline` on the branch and nothing on main, and the
    merge dropped it. Reading the keys of a single copy would miss this, so
    the driver reads the UNION of both.

    BOTH DIRECTIONS, deliberately. An earlier version of this test only put
    the extra field on `ours`, and it passed against a driver that read only
    `ours`' keys — proving nothing. The ours-only case is the one a
    single-side read gets right by accident; the theirs-only case is the one
    it silently drops.
  */
  for (const [label, oursExtra, theirsExtra] of [
    ['ours has it', { tagline: 'The Ultimate Disney Fan Event' }, {}],
    ['theirs has it', {}, { tagline: 'The Ultimate Disney Fan Event' }],
  ]) {
    const { ok, output } = merge(
      [ev('d23-2026')],
      [ev('d23-2026', { _updatedAt: '2026-09-09', ...oursExtra })],
      [ev('d23-2026', { _updatedAt: '2026-09-10', ...theirsExtra })],
    );
    assert.ok(!ok, `${label}: a field one side has and the other does not is still a human value at risk`);
    assert.match(output, /tagline/, `${label}: the report must name the field`);
  }
});

test('featuredBrand gets the same protection as event', () => {
  const brand = (over = {}) => ({
    _id: 'fb-marvel', _type: 'featuredBrand', _updatedAt: '2026-01-01',
    slug: { current: 'marvel-comics' }, title: 'Marvel', ...over,
  });
  const { ok, output } = merge(
    [brand()],
    [brand({ _updatedAt: '2026-09-09', hubCategory: 'franchises', description: 'From street-level heroes' })],
    [brand({ _updatedAt: '2026-09-10', hubCategory: 'studios', description: 'Something else' })],
  );
  assert.ok(!ok, 'brand hubs are edited by hand too');
  assert.match(output, /hubCategory/, 'the report must name the field');
});

test('system fields are bookkeeping, not editorial', () => {
  /*
    Otherwise every event merge would abort on `_rev` or `_updatedAt`, which
    differ by construction, and the driver would be useless for these types.
  */
  const { ok, result } = merge(
    [ev('pax-west-2026')],
    [ev('pax-west-2026', { _updatedAt: '2026-09-09', _rev: 'aaa', eventType: 'convention-expo' })],
    [ev('pax-west-2026', { _updatedAt: '2026-09-10', _rev: 'bbb', eventType: 'convention-expo' })],
  );
  assert.ok(ok, 'differing _rev/_updatedAt alone must still auto-resolve');
  assert.equal(result.length, 1);
  assert.equal(result[0].eventType, 'convention-expo', 'and the agreed editorial value survives');
});

test('videos still auto-resolve: the rule is per type, not a blanket freeze', () => {
  /*
    The fix must not turn every merge into a manual one. A video's title and
    counts are YouTube's and the newer side should win, exactly as before.
  */
  const { ok, result } = merge(
    [doc('v1', { title: 'old', views: 10 })],
    [doc('v1', { title: 'old title', views: 50, _updatedAt: '2026-01-01' })],
    [doc('v1', { title: 'new title', views: 99, _updatedAt: '2026-02-01' })],
  );
  assert.ok(ok, 'a factual disagreement on a video is noise, not a conflict');
  assert.equal(result[0].title, 'new title', 'the newer sync wins on facts');
  assert.equal(result[0].views, 99);
});

test('object-shaped files merge by key and stay objects', () => {
  // article-images.json is an object keyed by source URL, not an array. The
  // first draft handled arrays only and declined on the file most likely to
  // conflict — every article sync rewrites it.
  const { ok, result } = merge({}, { 'a.jpg': { local: 1 } }, { 'b.jpg': { ci: 1 } }, 'src/data/article-images.json');
  assert.ok(ok, 'should auto-resolve an object-shaped file');
  assert.ok(!Array.isArray(result), 'must be written back as an object');
  assert.deepEqual(Object.keys(result).sort(), ['a.jpg', 'b.jpg']);
});

test('every id field the real data files actually use is recognised', () => {
  // instagram.json keys on a bare `id` and matched none of the first draft's
  // list, which would have aborted every Instagram merge.
  for (const [label, mk] of [
    ['_id', (v) => ({ _id: 'x', v })],
    ['videoId', (v) => ({ videoId: 'x', v })],
    ['id', (v) => ({ id: 'x', v })],
    ['slug.current', (v) => ({ slug: { current: 'x' }, v })],
    ['guid', (v) => ({ guid: 'x', v })],
  ]) {
    const { ok, result } = merge([], [mk(1)], [mk(2)]);
    assert.ok(ok, `${label}: should auto-resolve`);
    assert.equal(result.length, 1, `${label}: the two sides must align to ONE document, not two`);
  }
});

test('an unidentifiable document aborts rather than guessing', () => {
  const { ok, output } = merge([], [{ noIdHere: 1 }], [{ noIdHere: 2 }]);
  assert.equal(ok, false);
  assert.match(output, /no id field/);
});

test('mismatched shapes abort rather than coercing', () => {
  const { ok, output } = merge([], [doc('a')], { 'a.jpg': {} });
  assert.equal(ok, false);
  assert.match(output, /different shapes/);
});

test('setup-git does nothing in an automated build', () => {
  /*
    The registration script runs from `postinstall`, so it fires on every CI
    and deploy build too. Its comment claimed it no-ops on "CI checkouts" —
    but a CI checkout IS a git work tree, so the work-tree guard passes there
    and it registered the driver anyway. Caught in a Cloudflare Workers Build
    log, printing its whole success banner on a production deploy.

    Harmless (the config lands in a container that never merges anything) but
    pointless work and noise in every release log. An automated build has no
    interactive merges to resolve.
  */
  const setup = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'setup-git.mjs'), 'utf8');
  for (const name of ['CI', 'GITHUB_ACTIONS']) {
    assert.ok(
      setup.includes(`'${name}'`),
      `setup-git.mjs must recognise ${name} as an automated build and skip. ` +
        'The work-tree check alone does NOT cover CI — a CI checkout is a work tree.',
    );
  }
  assert.match(setup, /const automated = /, 'the automation check must gate the exit');

  // And prove it, rather than trusting the source read.
  const run = (env) => execFileSync('node', [join(dirname(fileURLToPath(import.meta.url)), 'setup-git.mjs')],
    { encoding: 'utf8', env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'ignore'] });
  assert.equal(run({ CI: 'true' }).trim(), '', 'CI=true must produce no output at all');
  assert.equal(run({ GITHUB_ACTIONS: 'true' }).trim(), '', 'GITHUB_ACTIONS=true must produce no output');
});

test('.gitattributes names the driver for every file the syncs rewrite', () => {
  const attrs = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '.gitattributes'), 'utf8');
  for (const f of ['videos', 'articles', 'instagram', 'article-images']) {
    assert.match(attrs, new RegExp(`src/data/${f}\\.json\\s+merge=sync-json`),
      `src/data/${f}.json must be routed to the driver, or it conflicts wholesale as before`);
  }
});

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed.\n`);
process.exit(failed === 0 ? 0 : 1);
