import fs from 'fs';
import path from 'path';
import assert from 'node:assert/strict';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed += 1; }
  catch (e) { console.log(`  ✗ ${name}\n    ${e.message}`); failed += 1; }
}

console.log('\nFeed UI regressions:');

test('Feed UI regressions', () => {
  const spotlightHeroPath = path.join(process.cwd(), 'src/components/FeedSpotlightHero.astro');
  const feedGridPath = path.join(process.cwd(), 'src/components/FeedGrid.astro');
  const feedLayoutPath = path.join(process.cwd(), 'src/layouts/FeedLayout.astro');
  const layoutPath = path.join(process.cwd(), 'src/layouts/Layout.astro');
  
  const spotlightHero = fs.readFileSync(spotlightHeroPath, 'utf8');
  const feedGrid = fs.readFileSync(feedGridPath, 'utf8');
  const feedLayout = fs.readFileSync(feedLayoutPath, 'utf8');
  const layout = fs.readFileSync(layoutPath, 'utf8');

  // 1. Mobile Portrait Hero Blowout
  assert.ok(
    spotlightHero.includes('max-width: 100%'),
    'FeedSpotlightHero.astro must constrain flex children to max-width 100% to prevent line-clamp from blowing out mobile view'
  );
  
  // 2. Isolate Pagination Transitions
  assert.ok(
    !layout.includes('transition:name="page-content"'),
    'Layout.astro must NOT declare a global transition:name, which breaks pagination encapsulation'
  );
  assert.ok(
    !feedLayout.includes('transition:name="feed-grid"'),
    'FeedLayout.astro must NOT declare transition:name, to prevent full-page navigation slides'
  );
  /*
    The scoped transition name now lives in FeedSpotlightHero.astro, not
    FeedGrid.astro. The spotlight swap moved there so that every page mounting
    the hero gets it — /category/<slug> mounts the hero but not the grid, and
    its cards were inert because the handler was tied to the grid.

    The invariant is unchanged and still worth pinning: the swap must scope its
    transition to the element it is actually changing, rather than letting a
    manual DOM update animate the whole page.
  */
  assert.ok(
    spotlightHero.includes("viewTransitionName = 'feed-grid-manual'"),
    'FeedSpotlightHero.astro must dynamically assign viewTransitionName to scope the spotlight swap'
  );
  assert.ok(
    !feedGrid.includes("viewTransitionName = 'feed-grid-manual'"),
    'the swap belongs to the hero now; a copy left in FeedGrid would bind it twice'
  );

  // 3. Jump-to-Top on a spotlight click
  /*
    This used to read FeedGrid and was about the category filter buttons, which
    the Feed no longer renders — its rows segment the same content, so the
    filter row and the hash-filter module behind it were removed.

    The behaviour it was really protecting survives in the spotlight swap: a
    click that loads a card into the hero must not also let the browser follow
    the card's own href and jump. That call moved to the hero with the handler.
  */
  assert.ok(
    spotlightHero.includes('e.preventDefault()'),
    'FeedSpotlightHero.astro must call e.preventDefault() on a spotlight click, or the card navigates instead of loading into the hero'
  );
});

if (failed > 0) {
  process.exit(1);
} else {
  console.log(`\n✅ ${passed} passed, 0 failed.\n`);
}
