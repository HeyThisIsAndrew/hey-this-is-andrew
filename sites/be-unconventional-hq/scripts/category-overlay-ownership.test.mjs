/*
  The category overlay has exactly ONE delegated handler (#189).

  ─── WHAT WENT WRONG ──────────────────────────────────────────────────────
  CategoryOverlay.astro and QuadrantFilter.astro each wrapped a document-level
  delegated block in the same `window.categoryOverlayDelegated` guard, and
  QuadrantFilter renders <CategoryOverlay />, so on /feed both scripts ran on
  one page. Whichever chunk Vite emitted first claimed the flag and the
  other's block never registered.

  Nothing pinned that order. If it had flipped, QuadrantFilter would have won
  and taken Escape-to-close, the aria-hidden toggle and the focus move with
  it, silently: the overlay still opens, and still closes by button.

  ─── WHY A SOURCE TEST AND NOT ONLY A BROWSER ONE ─────────────────────────
  The browser suite (scripts/e2e-category-modal.test.mjs) proves the
  behaviour works in whatever chunk order today's build happens to produce.
  It cannot prove there is only one handler, because two handlers racing for
  one flag look exactly like one handler working. That is the property this
  file pins, and it is the property that was actually at risk.

  Confirmed to fail on the pre-fix tree: 4 of these checks go red against the
  two-handler version.
*/
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMPONENTS = path.join(ROOT, 'src', 'components');

/** Source with comments stripped, so prose describing a pattern never
    satisfies (or trips) a check about the code that uses it. */
function code(source) {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const overlay = code(read('src/components/CategoryOverlay.astro'));
const quadrant = code(read('src/components/QuadrantFilter.astro'));

/** The three selectors the delegated handler claims. */
const OWNED_SELECTORS = [
  '#open-categories-btn',
  '#close-categories-btn',
  '#category-fullscreen-overlay a.cat-btn',
];

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`  ✗ ${name}\n      ${error.message}`);
  }
}

console.log('\nCategory overlay: single ownership');

check('exactly one component claims the delegated selectors', () => {
  /* Any component that both binds a document listener AND names one of the
     owned selectors is a claimant. There must be one. */
  const claimants = fs
    .readdirSync(COMPONENTS)
    .filter((name) => name.endsWith('.astro'))
    .filter((name) => {
      const source = code(read(path.join('src', 'components', name)));
      const bindsDocument = /document\.addEventListener\(\s*'(click|keydown)'/.test(source);
      const claimsSelector = OWNED_SELECTORS.some((sel) => source.includes(sel));
      return bindsDocument && claimsSelector;
    });

  assert.deepEqual(
    claimants,
    ['CategoryOverlay.astro'],
    `expected only CategoryOverlay to bind these selectors, got: ${claimants.join(', ')}`,
  );
});

check('QuadrantFilter no longer binds any of them', () => {
  for (const selector of OWNED_SELECTORS) {
    assert.ok(
      !quadrant.includes(selector),
      `QuadrantFilter still references ${selector}; it renders <CategoryOverlay /> so this would race again`,
    );
  }
});

check('the shared latch both components fought over is gone', () => {
  /* Renamed rather than reused: `categoryOverlayDelegated` read as a flag
     anyone could take, which is how two components came to share it. */
  assert.ok(
    !overlay.includes('categoryOverlayDelegated') && !quadrant.includes('categoryOverlayDelegated'),
    'the old shared flag name is still live in code',
  );
  assert.match(overlay, /__hqCategoryOverlayBound/);
});

console.log('\nCategory overlay: the behaviours that were at risk');

check('Escape closes the overlay', () => {
  /* The one that mattered. Losing it leaves a keyboard user with a
     full-screen overlay they can open and cannot dismiss, and every other
     assertion still passes because the close button still works. */
  assert.match(overlay, /document\.addEventListener\('keydown'/);
  assert.match(overlay, /event\.key === 'Escape'/);
});

check('aria-hidden is toggled on open and close', () => {
  assert.match(overlay, /setAttribute\('aria-hidden', 'false'\)/);
  assert.match(overlay, /setAttribute\('aria-hidden', 'true'\)/);
});

check('focus moves into the overlay on open and back out on close', () => {
  assert.match(overlay, /closeBtn\.focus\(\)/);
  assert.match(overlay, /openBtn\.focus\(\)/);
});

check('aria-expanded tracks the overlay state', () => {
  assert.match(overlay, /setAttribute\('aria-expanded', 'true'\)/);
  assert.match(overlay, /setAttribute\('aria-expanded', 'false'\)/);
});

check('the button-label handler lives with the button it mutates', () => {
  /*
    Regression caught while diffing the built output against main. This
    handler rewrites `#open-categories-btn` to "Categories | Film", and it
    used to sit in QuadrantFilter. Once QuadrantFilter's delegated block was
    deleted its script had no imports left, Rollup folded the remainder into
    FeedGrid's chunk, and /category/[category] does not load that chunk, so
    the label silently stopped updating there.

    Which is the same class of bug as the one this ticket fixes: behaviour
    riding on how chunks happen to be emitted. Keeping it in the component
    that renders the button means its script is on every page that has one.
  */
  assert.match(overlay, /Categories \| \$\{/);
  assert.ok(
    !quadrant.includes('Categories | '),
    'the label handler is back in QuadrantFilter, whose script is not emitted on /category',
  );
});

check('the label handler leaves surfaces without a desktop row alone', () => {
  /* /intel renders this overlay from IntelFilters, which has no
     `.desktop-category-row`. Guarding on the row EXISTING (not on finding an
     active button in it) stops the handler overwriting that surface's own
     `buttonLabel` with a hardcoded default. */
  assert.match(overlay, /const desktopRow = document\.querySelector\('\.desktop-category-row, \.intel-filter-nav'\)/);
  assert.match(overlay, /if \(!openBtn \|\| !desktopRow\) return;/);
});

console.log('\nCategory overlay: what was deliberately not merged in');

check('category links are left to ClientRouter, not hijacked', () => {
  /*
    QuadrantFilter's dead block did `preventDefault()` + `navigate(href)` on
    non-hash links, and #189 suggested folding it in. It is redundant —
    <ClientRouter /> is site-wide — and it is a regression: Astro's router
    bails on metaKey/ctrlKey/altKey/shiftKey so cmd-click opens a new tab,
    and that block checked none of them. Folding it in would have swallowed
    every modified click on /intel and /category.
  */
  assert.ok(
    !overlay.includes("from 'astro:transitions/client'"),
    'the overlay should not be driving navigation itself',
  );
  assert.ok(
    !/navigate\(/.test(overlay),
    'category links must behave like links so modified clicks still work',
  );
});

check('the scroll lock is released by count reset, not an extra decrement', () => {
  /*
    The lock is reference counted (src/lib/scroll-lock.ts). Adding
    QuadrantFilter's `astro:before-preparation` → unlockScroll() would be a
    counted decrement that releases ANOTHER overlay's lock when the mobile
    nav is also open. releaseScrollLock() resets the counter outright, which
    is what a document about to be replaced needs.
  */
  assert.match(overlay, /addEventListener\('astro:before-swap', releaseScrollLock\)/);
  assert.ok(
    !overlay.includes('astro:before-preparation'),
    'before-preparation + unlockScroll would decrement a shared counter',
  );
});

check('the swap cleanup is registered outside the binding guard', () => {
  /* Leak protection must not depend on which script won a race, so it sits
     after the guarded block rather than inside it. */
  const guard = overlay.indexOf('__hqCategoryOverlayBound');
  const swap = overlay.indexOf("addEventListener('astro:before-swap'");
  assert.ok(guard > -1, 'the ownership guard is missing');
  assert.ok(swap > -1, 'the before-swap cleanup is missing');
  assert.ok(swap > guard, 'expected the swap listener after the guarded block');
  const guarded = overlay.slice(guard, swap);
  const opens = (guarded.match(/\{/g) ?? []).length;
  const closes = (guarded.match(/\}/g) ?? []).length;
  assert.ok(closes >= opens, 'the swap listener appears to be inside the guard');
});

console.log('\nCategory overlay: it is a takeover, so it goes over everything');

check('the overlay escapes the stacking context that trapped it', () => {
  /*
    The overlay is rendered inside `#page-content`, which carries
    `view-transition-name: page-main` so ClientRouter can slide the page. That
    forms a STACKING CONTEXT with no z-index of its own, so the overlay painted
    below the `<header>` at 100 however high it set itself — verified in a
    browser at z-index 10000, where elementsFromPoint still returned the header
    in front. A phone showed the navbar's logo, search icon and hamburger over
    a full-screen black menu, with its close X underneath the hamburger.

    What must hold: the CONTEXT is lifted, and only while this one overlay is
    open. Asserted as the relationship between the class the component sets and
    the rule that reads it, because either half alone is silent.
  */
  const filters = code(read('src/styles/modules/filters.css'));
  const overlaySrc = code(read('src/components/CategoryOverlay.astro'));

  const lift = filters.match(/html\.category-overlay-open #page-content \{[^}]*\}/);
  assert.ok(lift, 'nothing lifts #page-content, so the overlay is still sealed inside it');
  assert.match(lift[0], /position: relative;/, 'z-index does nothing on a static box');

  const liftZ = Number(lift[0].match(/z-index:\s*(\d+)/)[1]);
  const navZ = Number(code(read('src/components/Navbar.astro')).match(/z-index:\s*(\d+)/)[1]);
  assert.ok(liftZ > navZ, `the lifted context (${liftZ}) must outrank the navbar (${navZ})`);

  assert.match(overlaySrc, /classList\.add\('category-overlay-open'\)/,
    'opening must set the class the rule keys on');
  assert.match(overlaySrc, /classList\.remove\('category-overlay-open'\)/,
    'and closing must drop it, or the page stays over the navbar for good');

  assert.doesNotMatch(overlaySrc, /class="category-fullscreen-overlay z-\[/,
    'the Tailwind z utility contradicted the stylesheet it lost to; it is gone');
});

console.log(
  failures === 0
    ? '\n✅ Category overlay ownership checks passed.\n'
    : `\n❌ ${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
