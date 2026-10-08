/*
  THE ASSET PICKER'S MEMORY, AND THE PANEL IT OPENS IN.

  Two reports, both from using the Reuse picker for the job it exists for.

  1. "I was trying to swap the places of images, and the one that got replaced
     would be missing if it wasn't visible anywhere."

     The picker's contents were derived from what the store currently
     REFERENCES. Swapping two images is: open Reuse on field A, pick B's
     image — and the instant that lands, A's old image is referenced by
     nothing and vanishes, before you can open field B and put it there. The
     picker deleted the thing you were halfway through moving.

  2. "The close button is overlapped on the top of the reuse prompt overlay."

     The panel was Tailwind's `z-50`. The navbar is z-index 100 and
     `.safe-area-blackout` is 110, and the CMS renders inside the site's own
     <Layout>, so the site header painted over the panel's header row.

  Offline: the component is read as source, in the style of the other guards
  in this directory.
*/
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(join(here, '..', ...p), 'utf8');

/* Comments here describe the bugs the negative assertions hunt. Strip. */
const stripComments = (t) =>
  t.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed += 1; }
  catch (e) { console.log(`  ✗ ${name}\n    ${e.message}`); failed += 1; }
}

const cms = stripComments(read('src', 'components', 'admin', 'LocalCmsApp.tsx'));

console.log('\nthe asset picker');

test('the library is remembered, not derived from what is in use', () => {
  assert.match(cms, /function buildAssetLibrary\(docs: any\[\], remembered: string\[\]\)/,
    'the picker must be fed remembered ∪ in-use, or a swap loses the displaced image');
  assert.match(cms, /const refs = Array\.from\(new Set\(\[\.\.\.remembered, \.\.\.inUse\.keys\(\)\]\)\);/,
    'both halves have to be in the union');

  /* An entry nothing points at is the NORMAL mid-swap state, so it must be
     kept and labelled rather than filtered out. */
  assert.match(cms, /usedBy: inUse\.get\(ref\) \?\? \[\]/,
    'an unreferenced asset must survive with an empty usedBy, not be dropped');
  assert.doesNotMatch(cms, /\.filter\(\(\w+\) => \w+\.usedBy\.length\)/,
    'filtering out unused assets is the original bug');
});

test('the memory only ever grows on its own', () => {
  /*
    The effect that folds newly seen refs in must never remove. A `setState`
    that replaced the list with what is currently in use would reproduce the
    bug through a longer path.
  */
  const effect = cms.match(/const live = collectAssetLibrary\(docs\)[\s\S]*?\}, \[docs\]\);/);
  assert.ok(effect, 'could not find the effect that folds in newly seen refs');
  assert.match(effect[0], /new Set\(\[\.\.\.prev, \.\.\.live\]\)/,
    'the union must include what was already remembered');
  assert.match(effect[0], /if \(next\.length === prev\.length\) return prev;/,
    'returning prev unchanged is what stops the effect re-triggering through its own state');
  assert.doesNotMatch(effect[0], /setRememberedAssets\(live\)/,
    'replacing the memory with the live set is the bug wearing a different hat');
});

test('forgetting is deliberate, and it is not a delete', () => {
  const forget = cms.match(/const forgetAsset = useCallback\([\s\S]*?\}, \[\]\);/);
  assert.ok(forget, 'there must be an explicit way to drop an asset from the list');
  assert.match(forget[0], /prev\.filter\(\(r\) => r !== ref\)/,
    'forgetting removes exactly one ref from the remembered list');

  /* It must not reach the store. Nothing in this path may write a document. */
  assert.doesNotMatch(forget[0], /setDocs|updateDoc|fetch\(/,
    'forgetting an asset must not touch videos.json, any document, or the uploaded file');

  /* And it is offered only where it cannot interrupt a swap. */
  assert.match(cms, /\{unused && onForget && \(/,
    'Forget must appear only on assets no document currently points at');
});

test('an unused asset can still be found by typing', () => {
  /*
    The filter matched `usedBy` alone. Once the library started keeping unused
    assets, those have an empty usedBy — so the entries somebody is hunting
    for mid-swap were the exact ones no query could reach.
  */
  const filter = cms.match(/const shown = q[\s\S]*?: library;/);
  assert.ok(filter, 'could not find the picker filter');
  assert.match(filter[0], /refDimensions\(a\.ref\)\.includes\(q\)/, 'size must be searchable');
  assert.match(filter[0], /a\.ref\.toLowerCase\(\)\.includes\(q\)/, 'the ref must be searchable');
});

test('the panel opens above the navbar, and Close stays reachable', () => {
  /*
    Read the navbar's REAL z-index rather than hardcoding 100 here, so raising
    it later fails this test instead of silently burying the panel again.
  */
  const navCss = read('src', 'styles', 'modules', 'navbar.css');
  const mobileCss = read('src', 'styles', 'modules', 'responsive-mobile.css');
  const highest = [...navCss.matchAll(/z-index:\s*(\d+)/g), ...mobileCss.matchAll(/z-index:\s*(\d+)/g)]
    .map((m) => Number(m[1]))
    .reduce((a, b) => Math.max(a, b), 0);
  assert.ok(highest > 0, 'could not read any z-index off the navbar styles');

  const panelZ = cms.match(/style=\{\{ zIndex: (\d+) \}\}/);
  assert.ok(panelZ, 'the picker overlay must set an explicit z-index');
  assert.ok(Number(panelZ[1]) > highest,
    `the picker is z-index ${panelZ[1]} and the site chrome reaches ${highest}; the navbar will ` +
      'paint over the panel header, which is where Close lives');

  /* Inline, not a utility class: this page has a recorded history of
     Tailwind's JIT not emitting rules used here. */
  assert.doesNotMatch(cms, /className="fixed inset-0 z-50/,
    'a z-50 utility is what the navbar beat, and a class that fails to generate fails silently');

  /* And the header must sit outside the scrolling region, or Close scrolls
     away once the grid is longer than the panel. */
  assert.match(cms, /flex-none flex items-center justify-between[\s\S]{0,600}?onClick=\{onClose\}/,
    'the Close row must be flex-none, outside the scroll area');
  assert.match(cms, /flex-1 min-h-0 overflow-y-auto/,
    'the grid, not the whole panel, is what scrolls');
});

test('both forms read ONE library, built once', () => {
  /*
    EventForm and BrandForm each used to derive their own with
    collectAssetLibrary(allDocs). Two derivations is how one of them keeps the
    old in-use-only behaviour after the other is fixed.
  */
  assert.doesNotMatch(cms, /const assetLibrary = useMemo\(\(\) => collectAssetLibrary\(allDocs\)/,
    'a form deriving its own library will drift from the remembered one');
  const built = cms.match(/const assetLibrary = useMemo\(\s*\(\) => buildAssetLibrary\(docs, rememberedAssets\)/g) || [];
  assert.equal(built.length, 1, 'the library is built exactly once, at the top of the app');
});

console.log(failed === 0 ? `\n✅ ${passed} passed, 0 failed.` : `\n❌ ${passed} passed, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
