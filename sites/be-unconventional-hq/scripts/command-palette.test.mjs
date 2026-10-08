/*
  THE SEARCH PALETTE'S NON-OBVIOUS CONTRACTS.

  Every assertion here corresponds to a bug that was real, and that neither
  Lighthouse, axe nor `astro check` reported. They are pinned as source reads
  because each of them is a rule about the RELATIONSHIP between two pieces of
  code, which no single-file linter can see:

    - a CSS override that loses to source order still parses perfectly
    - a modal that closes without running your teardown still closes
    - a `role="option"` with no `aria-selected` is still a valid attribute
    - a 38px button is still a button

  See src/components/CommandPalette.astro for the reasoning at each site.
*/
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const palette = readFileSync(join(ROOT, 'src/components/CommandPalette.astro'), 'utf8');
/*
  Several of the comments in that file QUOTE the code they replaced, so a
  plain search finds the old behaviour in the note explaining why it is gone.
  Checks for absence run against this stripped copy instead.
*/
const paletteCode = palette
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
/* There is more than one mobile media query; collect them all. */
const mobileCss = (palette.match(/@media \(max-width: 640px\).*? \{[\s\S]*?\n  \}\n/g) || []).join('\n');
const navbar = readFileSync(join(ROOT, 'src/components/Navbar.astro'), 'utf8');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed += 1; }
  catch (e) { console.log(`  ✗ ${name}\n    ${e.message}`); failed += 1; }
}

console.log('\nCommand palette:');

/*
  A <dialog> opened with showModal() closes on Escape entirely by itself,
  without running a line of our code. Teardown that lives in closePalette()
  is therefore skipped on every Escape that does not go through it, which
  left `modal-open` on <html> and the page unscrollable with a reload as the
  only way out.
*/
test('scroll unlock hangs off the dialog\'s own close event, not closePalette()', () => {
  const closeListener = palette.match(/dialog\.addEventListener\('close',[\s\S]*?\n    \}\);/);
  assert.ok(closeListener, 'there must be a listener on the dialog\'s `close` event');
  assert.match(closeListener[0], /unlock\(\)|body\.style\.overflow = ''/,
    'the close listener is where the scroll unlock has to live: Escape reaches it on every ' +
    'path, and closePalette() only when focus happens to be in the input');
  const closeFn = palette.match(/const closePalette = \(\) => \{[\s\S]*?\n    \};/);
  assert.ok(closeFn, 'closePalette must still exist');
  assert.doesNotMatch(closeFn[0], /unlock\(\)/,
    'the unlock must NOT be duplicated back into closePalette — one owner, or they drift');
});

/*
  Both selectors are a single class, so specificity ties and SOURCE ORDER
  decides. With the media query above the base rule, `max-height: 80vh` won
  and the mobile `60dvh` never applied: the panel measured 682px in an 852px
  viewport and 208px of results sat behind the keyboard. The fix was present
  in the file and doing nothing.
*/
test('the mobile max-height override is declared BELOW the base rule it overrides', () => {
  const base = palette.indexOf('max-height: 80vh');
  const mobile = palette.indexOf('height: 100dvh');
  assert.ok(base !== -1, 'the base .cmd-palette-content max-height must exist');
  assert.ok(mobile !== -1, 'the mobile override must exist');
  assert.ok(mobile > base,
    `the 100dvh override is at index ${mobile}, the 80vh base at ${base}. Equal specificity ` +
    'means the later rule wins, so an override above the base rule silently does nothing.');
});

/*
  `dvh` shrinks when the on-screen keyboard opens, which is the entire reason
  it is used here. `vh` does not, and this panel is only ever on screen while
  somebody is typing. This deliberately differs from the hero, which uses
  `lvh` — see scripts/viewport-units.test.mjs for why the opposite is right
  for an element sized to the scroll viewport.
*/
/* `/` opens search (issue #263), but never while the reader is typing in a
   field, which would swallow the character they meant to type. */
test('`/` opens the palette, except while typing', () => {
  assert.match(paletteCode, /e\.key === '\/' && !e\.metaKey && !e\.ctrlKey && !e\.altKey && !dialog\.open/);
  assert.match(paletteCode, /isContentEditable \|\| \/\^\(INPUT\|TEXTAREA\|SELECT\)\$\/\.test\(t\.tagName\)/);
});

test('the mobile panel is sized in dvh, never vh', () => {
  assert.ok(mobileCss, 'the mobile media query must exist');
  assert.match(mobileCss, /height: \d+dvh/, 'the mobile panel height must be in dvh');
  assert.doesNotMatch(mobileCss, /height: \d+vh(?!h)/,
    'a `vh` height does not shrink for the keyboard, which is the whole point here');
});

/*
  aria-activedescendant says WHICH row is current. aria-selected is what a
  screen reader reads the selected STATE from. With only the first, the row
  is announced with no indication that Enter will open it.
*/
test('every result row carries aria-selected, and the active one flips it', () => {
  assert.match(palette, /a\.setAttribute\('aria-selected', 'false'\)/,
    'rows must be created with aria-selected="false" — a role="option" without it is incomplete');
  assert.match(palette, /item\.setAttribute\('aria-selected', 'true'\)/,
    'the active row must be set to true in updateActiveState()');
  assert.match(palette, /item\.setAttribute\('aria-selected', 'false'\)/,
    'and every other row reset to false, or several rows claim to be selected at once');
});

/*
  Closing a modal onto <body> costs a keyboard user their place: the next Tab
  restarts at the top of the document. A tap does not reliably focus a
  <button> (iOS Safari leaves activeElement on <body>), so the opener is
  passed in rather than read off activeElement.
*/
test('focus returns to whatever opened the palette', () => {
  assert.match(palette, /const openPalette = \(opener\?: HTMLElement \| null\) =>/,
    'openPalette must accept the opener explicitly — activeElement is <body> after a tap');
  assert.match(palette, /openPalette\(trigger\)/,
    'the [data-action="open-search"] handler must pass the button it matched');
  assert.match(palette, /lastFocused\.focus\(\{ preventScroll: true \}\)/,
    'and the close listener must restore it, without scrolling the page to it');
});

/*
  The index is sorted newest first. "The ten newest things" opens the palette
  on whichever ONE kind of thing was published last — which is how it came to
  open on nothing but hubs.
*/
test('the empty query shows a curated mix, not the top of a date sort', () => {
  /*
    The spec was 3 articles, 3 videos, and 4 hubs taken one per category: ten
    items that show the SHAPE of the site rather than a slice of one bucket.

    Issue #183 put up to two upcoming events at the top, and the first cut
    simply prepended them to that ten. renderResults() shows ten, so the two
    hubs on the end fell off the bottom and two of the four categories stopped
    being represented, silently. That is the bug these assertions now pin: the
    hub block is fixed at four and the events come out of the ARTICLE/VIDEO
    budget, never out of the hubs.
  */
  assert.match(paletteCode, /const DEFAULT_VIEW_SIZE = 10;/,
    'the ten-item cap must be a named constant, not a literal in two places');
  assert.match(paletteCode, /const DEFAULT_HUB_COUNT = 4;/, 'four hubs');
  assert.match(paletteCode, /results\.slice\(0, DEFAULT_VIEW_SIZE\)/,
    'renderResults must enforce the same cap the mix is budgeted against');

  const mix = paletteCode.match(/const DEFAULT_MIX[\s\S]*?\];/);
  assert.ok(mix, 'the curated default mix must exist');
  assert.match(paletteCode, /DEFAULT_VIEW_SIZE - DEFAULT_HUB_COUNT - upcomingEvents\.length/,
    'articles and videos must fill what is LEFT after the events and the hubs, ' +
    'or the hub block gets pushed past the cap again');
  assert.match(mix[0], /\['article', articleCount\]/, 'articles take the larger half');
  assert.match(mix[0], /\['video', mixBudget - articleCount\]/, 'videos take the rest');

  assert.match(paletteCode, /seenCategories/,
    'the four hubs must be picked one per category, not as the first four in the index');
  assert.match(paletteCode, /d\.hubCategory/,
    'which needs hubCategory on the hub entries');
  assert.match(paletteCode, /selectedHubs\.length >= DEFAULT_HUB_COUNT/, 'four hubs');

  /* The builder moved out of src/pages/api/search-index.json.ts into this lib
     when the MCP endpoint needed the same rows server-side (#192). The route
     is now a two-line wrapper; the shape these tests care about is here. */
  const index = readFileSync(join(ROOT, 'src/lib/search-index.ts'), 'utf8');
  assert.match(index, /hubCategory: h\.hubCategory/,
    'the index must carry hubCategory or the per-category pick silently degrades ' +
    'to the first four hubs in the file');

  assert.doesNotMatch(paletteCode, /searchData\.slice\(0, 10\)/,
    'the raw date-sorted slice is what put 18 hubs above every article');
});

/*
  getEventsLocal() sorts events DESCENDING by startDate, so the search index
  hands the palette the furthest-out event FIRST. Slicing two off the top of
  that volunteered next year's event ahead of next week's, under a heading
  that means the opposite. The default view has to sort ascending itself.
*/
test('the two events volunteered are the SOONEST, not the furthest out', () => {
  const block = paletteCode.match(/const upcomingEvents = searchData[\s\S]*?;\n/);
  assert.ok(block, 'the default view must pick its own upcoming events');
  assert.match(block[0], /\.sort\(/,
    'the index order is descending by start date, so this must re-sort');
  assert.match(block[0], /String\(a\.date \?\? ''\)\.localeCompare\(String\(b\.date \?\? ''\)\)/,
    'ascending, and as STRINGS: these are YYYY-MM-DD calendar dates and must ' +
    'never be fed to new Date() (CLAUDE.md hard rule 1)');
});

/*
  The dialog is built once and persists across navigations, so its state
  outlives any one opening. openPalette() and the `close` handler both blank
  input.value; when only the `input` listener could unhide the clear button,
  typing then closing then reopening left the X sitting over an empty field.
*/
/*
  Issue #180 lists the clear control's acceptance criteria explicitly. Three of
  them are properties of the markup and stylesheet rather than of behaviour, so
  they are pinned here: it shipped at 32x32, sitting directly beside a
  .close-btn that IS 44px, which is the house minimum every other control in
  this panel holds to.
*/
test('the clear button meets the house tap-target minimum on mobile', () => {
  const rule = mobileCss.match(/\.clear-search-btn \{[\s\S]*?\}/);
  assert.ok(rule, 'there must be a mobile rule for the clear control');
  assert.match(rule[0], /width: 44px/, '44px wide under a thumb, not 32');
  assert.match(rule[0], /height: 44px/, '44px tall under a thumb, not 32');
});

test('the clear button names itself, and never submits', () => {
  const btn = palette.match(/<button[^>]*class="clear-search-btn"[^>]*>/);
  assert.ok(btn, 'the clear control must exist');
  assert.match(btn[0], /aria-label="Clear search"/,
    'it is a glyph, so the accessible name has to be supplied');
  assert.match(btn[0], /type="button"/,
    'without type="button" it submits whatever form it lands in');
  assert.match(btn[0], /\bhidden\b/,
    'it must start hidden: an empty field with an X on it is another thing to explain');
});

test('the clear button uses the readable red, not the decorative one', () => {
  const hover = palette.match(/\.clear-search-btn:hover \{[\s\S]*?\}/);
  assert.ok(hover, 'there must be a hover state, matching .close-btn');
  assert.match(hover[0], /var\(--color-accent-text\)/,
    'a glyph is text: --color-accent (#cc0000) is 3.21:1 and is border/glow only');
});

test('the clear button cannot disagree with the input it clears', () => {
  assert.match(paletteCode, /const syncClearBtn = \(\) => \{/,
    'one function must own the clear button visibility');
  assert.doesNotMatch(paletteCode, /clearBtn\.hidden = (?!input\.value\.length === 0)/,
    'nothing may set clearBtn.hidden directly; every path goes through syncClearBtn');

  /* Every path that blanks the field must resync the button. */
  const clears = paletteCode.match(/input\.value = '';\n\s*syncClearBtn\(\);/g) || [];
  const allClears = paletteCode.match(/input\.value = '';/g) || [];
  assert.equal(clears.length, allClears.length,
    `all ${allClears.length} paths that clear the input must call syncClearBtn, ` +
    `only ${clears.length} do`);
});

/*
  `cover` crops whatever does not fit, which is right for a video still and
  wrong for somebody else's logo. The Warner Bros shield and the DC disc were
  both losing their top and bottom.
*/
test('hub marks are contained, video stills are covered', () => {
  assert.match(palette, /item\.type === 'hub' \? 'cmd-result-image is-mark' : 'cmd-result-image'/,
    'hub images must be tagged so the stylesheet can treat them differently');
  const markRule = palette.match(/\.cmd-result-image\.is-mark \{[\s\S]*?\}/);
  assert.ok(markRule, 'there must be a .is-mark rule');
  assert.match(markRule[0], /object-fit: contain/, 'a brand mark must never be cropped');
});

/*
  Touch targets. The hamburger beside the search button is 44x44 and sets the
  house convention; search was 38x38 sitting 4px from it, so a thumb aimed at
  search that landed slightly right opened the menu instead.
*/
test('both search triggers are 44px targets, sized from ONE rule', () => {
  const btn = navbar.match(/<button class="nav-search-btn" data-action="open-search"[^>]*>/);
  assert.ok(btn, 'the mobile search trigger must exist');
  /*
    This used to assert `width: 44px` in a `style="..."` attribute. Inline
    styles are why the desktop twin shipped 0x0 and unfixable: nothing in CSS
    could reach it, and the two copies had no shared source of truth. The
    sizing now lives in navbar.css and both copies read from it.
  */
  assert.doesNotMatch(btn[0], /style="/,
    'the trigger must not carry inline styles — no stylesheet can override them, ' +
    'which is how the desktop copy ended up 0x0 with no way to fix it');

  const css = readFileSync(join(ROOT, 'src/styles/modules/navbar.css'), 'utf8');
  const rule = css.match(/\n\.nav-search-btn \{[\s\S]*?\}/);
  assert.ok(rule, '.nav-search-btn must be styled in navbar.css');
  assert.match(rule[0], /width: 44px/, 'the target must be 44px wide, matching .nav-toggle beside it');
  assert.match(rule[0], /height: 44px/, 'and 44px tall');

  /*
    An inline SVG with no width/height and no CSS size computes to 0x0 and
    takes its button with it. The desktop copy had exactly that, and scripted
    clicks still passed because `.click()` does not care about size.
  */
  const svgRule = css.match(/\.nav-search-btn svg \{[\s\S]*?\}/);
  assert.ok(svgRule, 'the icon must be sized in CSS, not left to the SVG to size itself');
  assert.match(svgRule[0], /width: 22px/, 'icon width');
  assert.match(svgRule[0], /height: 22px/, 'icon height');
});

/*
  a11y.css expands the hamburger's tap region to its LEFT, into what its own
  note calls "the empty middle of the bar where nothing else is interactive".
  The search button was then put in exactly that space, so the band covered it
  entirely and `.nav-toggle`'s higher z-index won every tap. Reported from a
  device: the magnifying glass could not be pressed in landscape.
*/
test('the toggle\'s tap band stops at the gap and never crosses its neighbour', () => {
  const a11y = readFileSync(join(ROOT, 'src/styles/modules/a11y.css'), 'utf8');
  const navbarCss = readFileSync(join(ROOT, 'src/styles/modules/navbar.css'), 'utf8');

  const gap = navbarCss.match(/--nav-control-gap:\s*(\d+)px/);
  assert.ok(gap, 'the gap must be a named token, since two files depend on it');
  assert.ok(Number(gap[1]) >= 16,
    `the gap is ${gap[1]}px. Below 16px the toggle's own expansion drops under the ` +
    '2800px2 minimum that e2e-corner-controls enforces, trading away a fix made for ' +
    'a real device report.');

  const bands = a11y.match(/#navbar(\.menu-open)? \.nav-toggle::before \{[\s\S]*?\}/g) || [];
  assert.ok(bands.length >= 2, 'the toggle band is set in a base rule and a landscape rule');
  for (const band of bands) {
    assert.match(band, /left: calc\(-1 \* var\(--nav-control-gap\) \+ 4px\)/,
      'every toggle band must cap its leftward reach at the gap (minus a buffer for ' +
      'sub-pixel rounding). A literal -48px or -16px here covers the search button.');
  }

  assert.match(a11y, /#navbar \.nav-search-btn::before/,
    'the search button takes the leftward budget instead — the bar to ITS left is empty');
  assert.match(a11y, /\.nav-search-btn::before,\n\.nav-toggle::before/,
    'and it must be in the base pseudo-element rule, or it has no region at all');
});

/*
  The dismiss control was a ~30x20 chip reading "ESC": a key that does not
  exist on the device, at well under a touch target, and the only visible way
  out (the backdrop is mostly covered by the panel).
*/
test('the dismiss control is a key hint on desktop and a real close target on touch', () => {
  assert.match(palette, /class="close-btn-key"/, 'the ESC hint must be its own element');
  assert.match(palette, /class="close-btn-glyph"/, 'and the touch glyph another');
  assert.match(mobileCss, /\.close-btn \{[\s\S]*?width: 44px/, 'the close target must be 44px on mobile');
  assert.match(mobileCss, /\.close-btn-key \{\s*display: none/, 'and the ESC hint hidden there');
  assert.match(palette, /aria-label="Close search \(Esc\)"/,
    'the accessible name must stay a superset of the visible "ESC" (WCAG 2.5.3 Label in Name)');
});

/*
  Three attributes that only exist for the on-screen keyboard, plus the one
  that stops iOS zooming the whole page when the field takes focus.
*/
test('the input is set up for a phone keyboard', () => {
  const input = palette.match(/<input[\s\S]*?\/>/)[0];
  assert.match(input, /enterkeyhint="search"/, 'the return key should read Search, not Go');
  assert.match(input, /autocapitalize="off"/, 'or every query starts with a capital');
  assert.match(input, /autocorrect="off"/, 'or iOS rewrites the proper nouns this site is made of');
  const fontSize = palette.match(/#cmd-palette-input[^}]*font-size:\s*([\d.]+)rem/);
  if (fontSize) {
    assert.ok(parseFloat(fontSize[1]) * 16 >= 16,
      `the input is ${fontSize[1]}rem; under 16px Safari zooms the page on focus and does not zoom back`);
  }
});

/*
  A complete combobox or none at all. Half the pattern — options and an
  activedescendant with no combobox for them to belong to — is worse than
  plain text, because it promises a widget that is not there.
*/
test('the input declares the full combobox pattern', () => {
  const input = palette.match(/<input[\s\S]*?\/>/)[0];
  assert.match(input, /role="combobox"/, 'role');
  assert.match(input, /aria-controls="cmd-palette-results"/, 'pointing at the listbox');
  assert.match(input, /aria-expanded="false"/, 'with an initial expanded state');
  assert.match(input, /aria-autocomplete="list"/, 'and the autocomplete behaviour named');
  assert.match(palette, /role="listbox"/, 'the results container must be the listbox');
  assert.match(palette, /setAttribute\('aria-expanded', 'true'\)/,
    'aria-expanded must be kept in step in JS, or it lies from the first keystroke');
});

/*
  The panel introduced two greys DARKER than anything the site uses. CLAUDE.md
  records that the muted palette is a deliberate trade-off and that an audit of
  six routes found zero failures at rest, with `--color-white-muted` (#888888)
  as the floor for subordinate copy. `#555` placeholder text (2.66:1) and `#666`
  empty-state text (3.45:1) were both below that floor and below WCAG AA.

  Contrast is recomputed here rather than quoted, so it cannot drift from the
  tokens it describes.
*/
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.substr(i, 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

test('the panel reads no text darker than the site\'s own muted floor', () => {
  const base = readFileSync(join(ROOT, 'src/styles/global-base.css'), 'utf8');
  const muted = base.match(/--color-white-muted:\s*(#[0-9a-fA-F]{6})/);
  assert.ok(muted, '--color-white-muted must be defined');
  /* The panel is rgba(10,10,10,.85) over a 70%-black backdrop: effectively #0a0a0a. */
  const PANEL = '#0a0a0a';
  assert.ok(ratio(muted[1], PANEL) >= 4.5,
    `the muted token itself must clear AA on the panel (got ${ratio(muted[1], PANEL).toFixed(2)}:1)`);

  for (const [what, sel] of [['placeholder', '#cmd-palette-input::placeholder'], ['empty state', '.cmd-palette-empty']]) {
    const rule = palette.match(new RegExp(sel.replace(/[.#*]/g, '\\$&') + '\\s*\\{[\\s\\S]*?\\}'));
    assert.ok(rule, `there must be a ${what} rule`);
    const hex = rule[0].match(/color:\s*(#[0-9a-fA-F]{3,6})/);
    if (hex) {
      const full = hex[1].length === 4
        ? '#' + hex[1].slice(1).split('').map((c) => c + c).join('')
        : hex[1];
      assert.fail(
        `${what} hardcodes ${full} at ${ratio(full, PANEL).toFixed(2)}:1 on the panel. ` +
        'Use var(--color-white-muted): it is the site\'s floor and it clears AA.');
    }
    assert.match(rule[0], /color:\s*var\(--color-white-muted\)/,
      `${what} text must use the muted token, not a darker one-off grey`);
  }
});

/*
  There are two reds and they are not interchangeable. The palette used
  `#ff4444`, which is neither of them: a near-miss of `--color-accent-text`
  that no other file would pick up if the token ever changed.
*/
test('the readable red comes from the token, not a near-miss of it', () => {
  const videoBadge = palette.match(/\.cmd-result-item\[data-action="open-video"\] \.cmd-result-badge \{[\s\S]*?\}/);
  assert.ok(videoBadge, 'the video badge rule must exist');
  assert.match(videoBadge[0], /color:\s*var\(--color-accent-text\)/,
    'read-me red is a token; #ff4444 was a hand-mixed near-miss of #ef4444');
});

/*
  The row is a flex line: [96x54 image][text column]. Section pages carry no
  image, so the image element was skipped, the text column became the first
  child, and that row's badge and title slid left into the thumbnail's lane.
  One row out of ten not lining up does not read as "this one is different",
  it reads as broken.
*/
test('a result with no image still renders the leading box, so the column line holds', () => {
  const imgBranch = paletteCode.match(/if \(item\.image\) \{[\s\S]*?\} else \{[\s\S]*?a\.appendChild\(img\);/);
  assert.ok(imgBranch,
    'the image branch must have an else that appends a fallback image — skipping the box ' +
    'entirely is what broke the alignment');
  assert.match(paletteCode, /className = 'cmd-result-image is-mark'/,
    'the fallback image must reuse .cmd-result-image so it inherits the exact box metrics');
  assert.match(paletteCode, /img\.alt = ''/,
    'the fallback image is decorative — the badge already says PAGE and the title says which');
});

/*
  The empty-query view was volunteering D23, which finished on 16 August.
  Retrospective coverage is not something to put in front of somebody who has
  not asked for it. Past events stay indexed and stay findable by typing; this
  is only about what the panel offers unprompted.
*/
test('the default view only volunteers an event that is still ahead of us', () => {
  assert.match(paletteCode, /const eligibleForDefault =/,
    'there must be one eligibility rule for the default view');
  assert.match(paletteCode, /d\.type === 'event'\) return isStillAhead\(d\)/,
    'events must be gated on still being ahead of us');
  assert.match(paletteCode, /!out\.includes\(d\) && eligibleForDefault\(d\)/,
    'the backfill must apply the same rule, or a finished event walks back in ' +
    'through the side door when a bucket comes up short');
});

/*
  Hard rule 1. `new Date("2026-08-16")` is midnight UTC, which renders as the
  15th anywhere west of Greenwich, so an event would drop out of the panel a
  day early for most of the audience. Compare the strings.
*/
test('the still-ahead check compares date STRINGS and never builds a Date', () => {
  const fn = paletteCode.match(/const isStillAhead = \(d: any\) => \{[\s\S]*?\n    \};/);
  assert.ok(fn, 'isStillAhead must exist');
  assert.doesNotMatch(fn[0], /new Date\(/,
    'building a Date from a calendar string UTC-shifts it to the previous day');
  assert.match(fn[0], /end >= today/, 'a same-precision string comparison');
  assert.match(paletteCode, /import \{ toYMD \} from '\.\.\/lib\/events\.ts'/,
    "today must come from the site's own helper, not a reimplementation");
});

/*
  A multi-day show is not over on its opening morning. Gating on the start
  date alone would have hidden SDCC on 23 July, mid-event.
*/
test('the check uses the END of an event, not its start', () => {
  const fn = paletteCode.match(/const isStillAhead = \(d: any\) => \{[\s\S]*?\n    \};/)[0];
  assert.match(fn, /d\.endDate \|\| d\.date/,
    'end date first, falling back to the start for a single-day event');

  const index = readFileSync(join(ROOT, 'src/lib/search-index.ts'), 'utf8');
  assert.match(index, /endDate: e\.endDate \|\| e\.startDate/,
    'the index must carry an end date for every event, or the client cannot make this call');
  assert.match(index, /endDate\?: string \| null/, 'and it must be on the entry type');
});

/*
  The empty view already shows three articles. Intel is the page those
  articles live on: it is not a result, it is the container of results that
  are already on screen.
*/
test('Intel is kept out of the default view but stays searchable', () => {
  const index = readFileSync(join(ROOT, 'src/lib/search-index.ts'), 'utf8');
  const intel = index.match(/\{ id: 'intel'.*?\}/);
  assert.ok(intel, 'the Intel page entry must exist');
  assert.match(intel[0], /excludeFromDefault: true/, 'flagged out of the default view');
  assert.match(intel[0], /url: '\/intel'/,
    'and still present in the index, so typing "intel" finds it');
  assert.match(paletteCode, /if \(d\.excludeFromDefault\) return false/,
    'the client must honour the flag');

  /* The decision lives with the pages, not hardcoded in the palette. */
  assert.doesNotMatch(paletteCode, /'\/intel'/,
    'the palette must not name a specific URL — that couples it to the page list');
});

/*
  `outline: none` on the input removed the white half of the site's focus ring
  and left the dark halo behind it: no contrast, no indicator, and a stray dark
  rectangle around the field.

  The ring is now shown conditionally rather than unconditionally: Safari
  forces `:focus-visible` on a text input even for a plain click, so the
  browser's own signal cannot separate a click from a keypress here. A body
  class tracks that instead. That is a legitimate approach and it is also more
  breakable than a plain rule, so the pieces are pinned: suppress on focus,
  restore under the keyboard class, and set the class for EVERY keyboard route
  in — including Cmd+K, which is keyboard navigation by definition and was
  missing, leaving a keyboard user with no indicator at all.
*/
test('the focus ring is suppressed for pointers and restored for keyboards', () => {
  assert.match(paletteCode, /#cmd-palette-input:focus \{[\s\S]*?outline: none/,
    'the ring is suppressed on plain focus, because Safari forces :focus-visible here');
  assert.match(paletteCode, /body\.is-keyboard-nav #cmd-palette-input:focus \{[\s\S]*?outline: 3px solid/,
    'and restored under the keyboard class, or keyboard users lose the indicator ' +
    'entirely (WCAG 2.4.7)');

  const setter = paletteCode.match(/document\.addEventListener\('keydown'[\s\S]*?\}, true\);/);
  assert.ok(setter, 'a keydown listener must set the keyboard class');
  assert.match(setter[0], /e\.key === 'Tab'/, 'Tab counts');
  assert.match(setter[0], /metaKey \|\| e\.ctrlKey\) && e\.key === 'k'/,
    'and so does Cmd+K: it is how a keyboard user opens this thing, and gating only ' +
    'on Tab left them with no focus indicator');

  assert.match(paletteCode, /addEventListener\('mousedown'[\s\S]*?remove\('is-keyboard-nav'\)/,
    'a pointer must clear it again');

  const a11y = readFileSync(join(ROOT, 'src/styles/modules/a11y.css'), 'utf8');
  assert.match(a11y, /:focus-visible \{[\s\S]*?outline: 3px solid/,
    'the site-wide ring must still exist for everything outside this panel');
});


/*
  The critique that started this: the panel was a well-built stock component
  wearing the site's colours. The clearest tell was the input itself, the
  largest text in the panel, being the only voice-carrying element left in the
  body face while the eyebrow and badges around it were already Syne.
*/
test('every voice-carrying element in the panel is in the display face', () => {
  const DISPLAY = /font-family: var\(--font-display/;
  for (const [what, sel] of [
    ['the input', '#cmd-palette-input'],
    ['result titles', '.cmd-result-title'],
    ['type badges', '.cmd-result-badge'],
    ['the eyebrow', '.cmd-palette-eyebrow'],
    ['the empty state', '.cmd-palette-empty'],
    ['the dismiss chip', '.close-btn'],
  ]) {
    const rule = paletteCode.match(new RegExp(sel.replace(/[.#]/g, '\\$&') + ' \\{[\\s\\S]*?\\n  \\}'));
    assert.ok(rule, `${what} must be styled`);
    assert.match(rule[0], DISPLAY,
      `${what} is in the body face. The panel reads as generic when the site's own ` +
      'voice stops at the decorations.');
  }
});

/*
  "No results found." is a status code with a full stop, delivered at the exact
  moment somebody is most likely to give up. It should say what happened and
  then what to try.
*/
test('the empty state offers a next step, not just a verdict', () => {
  assert.match(palette, /class="cmd-empty-hint"/,
    'the empty state must carry a hint line telling the reader what to try');
  assert.doesNotMatch(paletteCode, /No results found\./,
    'the bare status-code wording must be gone');
  /* House style, and it applies to anything a visitor reads. */
  const empty = palette.match(/<div class="cmd-palette-empty"[\s\S]*?<\/div>/)[0];
  assert.doesNotMatch(empty, /—/, 'no em dashes in user-facing copy');
});

/*
  The eyebrow said "RECENT TRANSMISSIONS" over a list that is a curated spread
  across articles, videos, hubs and pages, and has not been a recency feed
  since the mix replaced the date sort. It was inaccurate as well as off-voice.
*/
test('the default-view eyebrow describes what the list actually is', () => {
  assert.doesNotMatch(paletteCode, /RECENT TRANSMISSIONS/,
    'the list is not a recency feed and the register is not the site\'s');
  assert.match(paletteCode, /eyebrow\.textContent = '[A-Z ]+'/,
    'there must still be an eyebrow, and it stays in the uppercase house form');
});

/*
  The dismiss chip hovered white-on-lighter-grey, a generic UI state and the
  only one of its kind on the site. Every other control goes red:
  `.modal-close:hover` and `.nav-search-btn:hover` both use
  `--color-accent-text`, and the VIDEO badge in this same panel is already a
  red-bordered chip.
*/
test('the dismiss chip uses the house red for hover, focus and press', () => {
  const hover = paletteCode.match(/\.close-btn:hover,\n  \.close-btn:focus-visible \{[\s\S]*?\}/);
  assert.ok(hover, 'hover and focus-visible must share one rule, so a keyboard user ' +
    'sees what a mouse user sees');
  assert.match(hover[0], /color: var\(--color-accent-text\)/,
    'the label is read, so it takes the readable red (#ef4444), never #cc0000');
  assert.match(hover[0], /border-color: rgba\(204, 0, 0/,
    'the border takes the decorative red, which is what CLAUDE.md reserves it for');

  assert.match(paletteCode, /\.close-btn:active \{[\s\S]*?color: var\(--color-accent-text\)/,
    'and there must be an :active state — a phone never produces a hover, so without ' +
    'it a tap gives no feedback at all');

  assert.doesNotMatch(paletteCode, /\.close-btn:hover \{\s*background: rgba\(255, 255, 255, 0\.15\);\s*color: #fff;/,
    'the old generic white hover must be gone');
});

/*
  NETWORK CHAOS DEFENSIVE GUARDS (Ticket #182 Workstream B).

  Assuming the environment is hostile:
    1. loadIndex() must validate HTTP status and ensure searchData is an Array.
    2. renderResults() must not throw on missing urls or non-string URLs.
    3. defaultResults() must safely guard against non-array or empty data.
*/
test('loadIndex() validates HTTP status and ensures searchData is an Array', () => {
  assert.match(paletteCode, /if \(!res\.ok\) \{/, 'loadIndex must check res.ok');
  assert.match(paletteCode, /Array\.isArray\(data\)/, 'searchData must be guarded with Array.isArray');
});

test('renderResults() handles malformed entries without throwing', () => {
  assert.match(paletteCode, /item\.url \|\| '#'/);
  assert.match(paletteCode, /typeof item\.url === 'string'/);
});

test('defaultResults() guards against non-array searchData', () => {
  assert.match(paletteCode, /if \(!Array\.isArray\(searchData\)/);
});

test('the mobile origin is not undone by the open state', () => {
  /*
    The palette is `top: 50%` with `translate(-50%, -50%)` on desktop, and
    `top: 5%` with `translate(-50%, 0)` below 640px. But the translate that
    matters when the thing is on screen lives on `.cmd-palette[open]`, and a
    media query adds NO specificity: `[open]` is (0,2,0) and the bare class is
    (0,1,0), so the desktop centring won at every width whatever the order.

    From 5%, pulling up half the panel's own height puts most of it off the
    top of the screen. Reported from a phone as the search box displaying
    wrong, with the results clipped to a strip and the keyboard already up.
  */
  const mobile = paletteCode.match(/@media \(max-width: 640px\).*? \{[\s\S]*?\n  \}/);
  assert.ok(mobile, 'the mobile block is gone');
  assert.match(mobile[0], /\.cmd-palette\[open\] \{[^}]*transform: none;/,
    'the open state must be re-pointed at the mobile origin, not just the closed one');

  const openRules = [...paletteCode.matchAll(/\.cmd-palette\[open\] \{([^}]*)\}/g)]
    .map((m) => m[1])
    .filter((body) => /transform:/.test(body));
  assert.ok(openRules.length >= 2,
    'there must be a mobile open-state transform as well as the desktop one');
});

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed.\n`);
process.exit(failed === 0 ? 0 : 1);
