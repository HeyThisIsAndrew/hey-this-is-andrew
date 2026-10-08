/*
  The "Official <X> Hub" card, and the rail it lives in.

  Offline: the label logic is exercised directly, the templates are read as
  source. No browser, no build step.

  ─── THE TWO THINGS THIS PINS ──────────────────────────────────────────────

  1. THE HEADING WAS A LIE FOR MOST HUBS. It was hardcoded as "Official
     Franchise Hub" in the event template, which called Netflix a franchise
     on every event it backed. It now comes from the hub's own hubCategory.

  2. A PHONE READER SAW NONE OF THE RAIL. article.css hid `.article-rail`
     outright below 1200px, so the hub card, the editorial desk and Support
     The HQ existed on desktop only. The event templates had already solved
     this for themselves, which is why an event page stacked its rail on a
     phone and an article page silently dropped it.
*/
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';
import { HUB_KIND_LABELS, HUB_CATEGORY_LABELS, getHubKindHeading } from '../src/lib/hub-labels.ts';

const here = dirname(fileURLToPath(import.meta.url));
const readSrc = (...parts) => readFileSync(join(here, '..', ...parts), 'utf8');
const stripComments = (text) =>
  text
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');


/**
 * Remove every `@media (hover: hover) …` and `@media (prefers-reduced-motion
 * …)` block, braces balanced, so what is left is the styling EVERY device
 * gets.
 *
 * Both have to go. The first attempt stripped only the hover blocks, and the
 * assertion built on it could not fail: the reduced-motion block also
 * mentions `:active` (to cancel the transform), so a `:active` rule moved
 * inside the hover query still left a match behind and the guard passed.
 *
 * Written by counting rather than by pattern. CSS nesting is not a regular
 * language, and the regex version of this quietly stripped nothing at all.
 */
function stripConditionalBlocks(css) {
  let out = '';
  let i = 0;
  while (i < css.length) {
    const at = css.indexOf('@media', i);
    if (at === -1) return out + css.slice(i);

    const open = css.indexOf('{', at);
    const prelude = open === -1 ? '' : css.slice(at, open);
    if (open === -1 || !/hover:\s*hover|prefers-reduced-motion/.test(prelude)) {
      out += css.slice(i, at + 6);
      i = at + 6;
      continue;
    }

    out += css.slice(i, at);
    let depth = 0;
    let j = open;
    for (; j < css.length; j += 1) {
      if (css[j] === '{') depth += 1;
      else if (css[j] === '}') {
        depth -= 1;
        if (depth === 0) { j += 1; break; }
      }
    }
    i = j;
  }
  return out;
}

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed += 1;
  } catch (error) {
    console.log(`  ✗ ${name}\n    ${error.message}`);
    failed += 1;
  }
}

console.log('\nthe hub card heading');

test('a hub is called what it actually is', () => {
  assert.equal(getHubKindHeading({ hubCategory: 'universes' }), 'Official Franchise Hub');
  assert.equal(getHubKindHeading({ hubCategory: 'streaming' }), 'Official Streamer Hub');
  assert.equal(getHubKindHeading({ hubCategory: 'studios' }), 'Official Studio Hub');
  assert.equal(getHubKindHeading({ hubCategory: 'gaming' }), 'Official Games Hub');
});

test('an unknown or missing category says so rather than guessing', () => {
  assert.equal(getHubKindHeading({}), 'Official Hub');
  assert.equal(getHubKindHeading(null), 'Official Hub');
  assert.equal(getHubKindHeading({ hubCategory: 'nonsense' }), 'Official Hub');
});

test('every row on /featured has a singular name for one of its hubs', () => {
  /*
    The two maps have to move together. Add a category to HUB_CATEGORY_LABELS
    without adding it here and every hub in that row reads "Official Hub" --
    correct, but blank, and nobody would notice which row it was.
  */
  for (const key of Object.keys(HUB_CATEGORY_LABELS)) {
    assert.ok(HUB_KIND_LABELS[key],
      `hubCategory "${key}" is a row on /featured with no singular label, so its hubs will ` +
        'fall back to a bare "Official Hub"');
  }
});

test('"Games" is not singularised to "Game"', () => {
  /*
    The reason these are written out rather than derived by chopping an "s".
    It is right three times out of four, and the fourth is PlayStation
    getting an "Official Game Hub".
  */
  assert.equal(HUB_CATEGORY_LABELS.gaming, 'Games');
  assert.equal(HUB_KIND_LABELS.gaming, 'Games');
});

test('no template hardcodes the heading any more', () => {
  const templates = [
    ['EventAnnouncement.astro', join('src', 'components', 'EventAnnouncement.astro')],
    ['EventFeatured.astro', join('src', 'components', 'EventFeatured.astro')],
    ['ArticleSupportRail.astro', join('src', 'components', 'ArticleSupportRail.astro')],
  ];
  for (const [label, rel] of templates) {
    const code = stripComments(readSrc(rel));
    assert.ok(
      !/Official Franchise Hub/.test(code),
      `${label} writes the heading out. It is a property of the HUB, not of the page: ` +
        'hardcoded, it calls Netflix a franchise.',
    );
  }

  const card = readSrc('src', 'components', 'HubCard.astro');
  assert.match(card, /getHubKindHeading\(brand\)/,
    'HubCard must take its heading from the hub document');
});

console.log('\nthe card reshapes to the space it gets');

test('it is sized by its own width, not the window\'s', () => {
  /*
    ─── WHY A CONTAINER QUERY AND NOT A MEDIA QUERY ────────────────────────

    Measured widths of this exact card:

      desktop 1440   239px   (it is in the 19rem rail)
      phone   320    276px
      phone   390    346px
      tablet  768    710px
      phone landscape 844    782px
      tablet landscape 1024  953px

    The window and the card run in OPPOSITE directions: the biggest window
    gives the card its narrowest box. A media query would have made the
    desktop rail wide and the phone card narrow, which is backwards.
  */
  const card = readSrc('src', 'components', 'HubCard.astro');
  assert.match(card, /container-type: inline-size/,
    'the card must establish a query container, or the rules below never fire');
  assert.match(card, /@container hubcard \(min-width: 300px\)/,
    'the two-column shape starts where the card clears the desktop rail (239px) and a 320px phone (276px)');
  assert.match(card, /@container hubcard \(min-width: 560px\)/,
    'the banner shape starts below the smallest stacked width (710px)');
  assert.ok(
    !/@media[^{]*max-width[^{]*\{[^}]*rail-hub-card/s.test(card),
    'the card is being sized by the viewport again, which gets it exactly backwards',
  );
});

test('the mark is capped in BOTH axes', () => {
  /*
    16 of the 18 hubs have a square mark; Marvel (2.21:1) and Disney+
    (1.83:1) are wide wordmarks. Cap height alone and those two run away with
    the row. Cap width alone and the 16 square ones shrink to nothing.

    Measured with both caps, in the same box:
      DC     (1:1)     88x88 on a phone, 104x104 on a tablet
      Marvel (2.21:1)  96x43 on a phone, 140x63  on a tablet

    Same footprint, same row height, neither dominates.
  */
  const card = readSrc('src', 'components', 'HubCard.astro');
  const styles = card.slice(card.indexOf('<style>'));
  const logoRules = [...styles.matchAll(/\.rail-hub-logo\s*\{([^}]*)\}/g)].map((m) => m[1]);
  assert.ok(logoRules.length >= 2, 'the mark must be resized for the wider shapes');
  for (const rule of logoRules) {
    assert.match(rule, /max-height:/, 'every mark rule needs a height cap');
    assert.match(rule, /max-width:/,
      'and a width cap, or a 2.21:1 wordmark takes the row while square marks stay small');
  }
});

test('the narrow rail keeps the small stacked card', () => {
  /*
    The desktop rail is 239px. Nothing about widening the stacked card may
    reach it: a 104px mark in a 239px rail is most of the rail.
  */
  const card = readSrc('src', 'components', 'HubCard.astro');
  const base = card.slice(card.indexOf('<style>'), card.indexOf('@container'));
  assert.match(base, /\.rail-hub-logo\s*\{[^}]*max-height: 34px/,
    'the default (narrow) mark stays small');
  assert.match(base, /\.rail-hub-card\s*\{[^}]*display: block/,
    'and the default shape stays stacked');
});

test('the mark box holds its place before the mark loads', () => {
  /*
    The mark is `loading="lazy"` with no width/height attributes, so it
    measures 0x0 until it decodes. Every shape of this card must reserve the
    space, or the card's contents jump when the logo arrives.

    The two wider shapes set an explicit `height` and always did. The stacked
    one set nothing, so the desktop rail shifted by 34px on every article
    page. Found while re-checking a QA report whose own measurements were all
    "height 0" for an unrelated reason.
  */
  const card = readSrc('src', 'components', 'HubCard.astro');
  const styles = card.slice(card.indexOf('<style>'));
  const base = styles.slice(0, styles.indexOf('@container'));

  assert.match(base, /\.rail-hub-mark\s*\{[^}]*min-height:/,
    'the stacked mark box reserves no height, so it collapses until the lazy logo loads');

  for (const [label, shape] of [
    ['two-column', styles.slice(styles.indexOf('@container hubcard (min-width: 300px)'), styles.indexOf('@container hubcard (min-width: 560px)'))],
    ['banner', styles.slice(styles.indexOf('@container hubcard (min-width: 560px)'))],
  ]) {
    assert.match(shape, /\.rail-hub-mark\s*\{[^}]*height:/,
      `the ${label} mark box must keep its explicit height`);
  }
});

test('the brand name is text, not only a picture', () => {
  /*
    The mark is alt="", so it contributes nothing to the link's accessible
    name. Remove the words and a screen reader hears "Explore Hub" with no
    indication of WHICH hub. That is the reason the copy stays even though
    the box is visually obvious.
  */
  const card = readSrc('src', 'components', 'HubCard.astro');
  assert.match(card, /alt=""/, 'the mark is decorative');
  assert.match(card, /Explore all our coverage, videos, and intel for \{brand\.title\}/,
    'so the brand name must appear in the link text');
});

console.log('\npress feedback');

test('every tappable tile responds to a touch, not only to a mouse', () => {
  /*
    ─── HOVER IS NOT AVAILABLE ON A TOUCHSCREEN ────────────────────────────

    Both of these correctly gate their hover styling behind
    `(hover: hover) and (pointer: fine)` — without it, a tap on a phone
    leaves the tile stuck in its hover state until you touch something else.

    But nothing replaced hover there, so on a phone and an iPad a tap did
    nothing visible at all until the next page began to paint. `:active` is
    the branch touch actually gets, and it must live OUTSIDE that media
    query.
  */
  const targets = [
    ['HubCard.astro', join('src', 'components', 'HubCard.astro'), '.rail-hub-card'],
    ['referrals.css', join('src', 'styles', 'modules', 'referrals.css'), '.referral-item'],
  ];

  for (const [label, rel, sel] of targets) {
    const code = readSrc(rel);
    const escaped = sel.replace('.', '\\.');

    assert.match(code, new RegExp(`${escaped}:active`),
      `${label}: ${sel} has no :active state, so a touch device gets no feedback at all`);

    /*
      And it must not be nested inside the hover query, which would put it
      right back out of reach of the devices that need it. Every
      conditional block is cut out and the :active rule has to survive the
      cut. See stripConditionalBlocks: both the hover query and the
      reduced-motion query have to go, and the first version of this guard
      could not fail because it only removed the first of them.
    */
    assert.match(stripConditionalBlocks(code), new RegExp(`${escaped}:active`),
      `${label}: the :active rule only exists inside a media query. Inside the hover query it ` +
        'is out of reach of touch, which is exactly what it is for; inside reduced-motion it ' +
        'only cancels a transform.');
  }
});

console.log('\nthe rail on a phone');

test('the card and the rail are one component, used by both page types', () => {
  /*
    EventFeatured is on this list even though no event uses
    `layoutMode: 'featured'` today. That is exactly why it was missing the
    card: the gap was invisible, and would have surfaced as a card that
    simply was not there on the first event switched to that layout.
  */
  for (const rel of [
    join('src', 'components', 'EventAnnouncement.astro'),
    join('src', 'components', 'EventFeatured.astro'),
    join('src', 'components', 'ArticleSupportRail.astro'),
  ]) {
    const code = stripComments(readSrc(rel));
    assert.match(code, /<HubCard brand=\{/, `${rel} must render the shared card, not its own copy`);
    assert.ok(
      !/class="rail-hub-card"/.test(code),
      `${rel} has its own copy of the card markup again. Two copies is how the heading ` +
        'stayed wrong in one of them.',
    );
  }
});

test('an article resolves its own hub, because nothing tells it which', () => {
  const page = stripComments(readSrc('src', 'pages', 'intel', '[slug].astro'));
  assert.match(page, /findHubForItem\(article, getFeaturedBrandsLocal\(\)\)/,
    'the article page must infer its hub: unlike an event, it has no relatedBrandSlug');
  assert.match(page, /<ArticleSupportRail related=\{[^}]*\} brand=\{articleHub\} \/>/,
    'and must hand it to the rail');
});

test('below 1200px the support rail stacks instead of vanishing', () => {
  const css = readSrc('src', 'styles', 'modules', 'article.css');
  const block = css.slice(css.indexOf('@media (max-width: 1200px)'));

  assert.ok(
    !/\.article-rail \{\s*display: none/.test(css),
    'article.css hides BOTH rails again. That takes the hub card, the editorial desk and ' +
      'Support The HQ off every phone and tablet.',
  );
  assert.match(block, /\.desktop-only-toc \{\s*display: none/,
    'the TOC stays desktop-only: a jump-link list belongs beside the text or nowhere (but the rest of the rail stacks)');
  /*
    ONE DECLARATION, NOT THREE SIGHTINGS. This was
    `/grid-template-areas:[\s\S]*?"column"[\s\S]*?"support"[\s\S]*?"toc"/`, and
    `block` is everything from the media query to the END OF THE FILE, so the
    lazy spans let it match `grid-template-areas:` in one rule and pick up
    "toc" from some unrelated rule far below. Anchored to a single declaration
    now: the areas must appear in that order inside one `grid-template-areas`.
  */
  const areas = block.match(/grid-template-areas:\s*((?:\s*"[^"]*")+)\s*;/);
  assert.ok(areas, 'the stacked layout must declare grid-template-areas');
  const order = [...areas[1].matchAll(/"([^"]*)"/g)].map((m) => m[1].trim());
  assert.deepEqual(order, ['column', 'support', 'toc'],
    'the rails must stack AFTER the article, not before it, and both of them must stack');

  assert.match(block, /\.article-rail-right \.article-rail-more \{\s*display: none/,
    '"More From Intel" must stay hidden when stacked, or it prints the same related ' +
      'articles the column already shows directly under them');

  /*
    BOTH rails, each asserted BY NAME. `position: static` unanchored passed on
    the right rail's rule alone, so reverting the left rail to `display: none`
    — the exact regression this test is named for — went green.
  */
  for (const side of ['left', 'right']) {
    const rule = block.match(new RegExp(`\\.article-layout > \\.article-rail-${side} \\{([^}]*)\\}`));
    assert.ok(rule, `the ${side} rail needs its own stacked rule, scoped under .article-layout ` +
      'so it beats the global `.article-rail { position: sticky }` further down the file');
    assert.match(rule[1], /display: block/,
      `the ${side} rail must still RENDER when stacked; display:none is what took it off every phone`);
    assert.match(rule[1], /position: static/,
      `a sticky ${side} rail in a single-column flow pins itself to the viewport as you scroll past`);
  }
});

test('the stacked gap is paid for once, not twice', () => {
  /*
    The layout gap is a horizontal GUTTER side by side and becomes vertical
    space when stacked. With the rail's margin and the card's own margin on
    top of it that came to 144px at 390px, about a sixth of the screen.
  */
  const css = readSrc('src', 'styles', 'modules', 'article.css');
  const block = css.slice(css.indexOf('@media (max-width: 1200px)'));
  assert.match(block, /row-gap: 3\.5rem/, 'the row gap carries the separation');
  assert.match(block, /\.article-rail-right \.article-rail-more \+ \*,?\s*\{?[\s\S]{0,80}margin-top: 0/,
    'and the first VISIBLE block gives up its own margin. `display: none` does not stop ' +
      ':first-child matching, so the hidden "More From Intel" must be reached as a sibling.');

  /*
    BOTH RAILS, because the left one repeated the mistake. PR #225 put "Stay
    Updated" in the left rail with an inline `margin-top: 4rem` to clear the
    Table of Contents above it — and below 1200px that TOC is `display: none`,
    so the 4rem cleared nothing and simply added to the row-gap. Measured at
    390px: 120px above the block against 56px for every other stacked gap.
  */
  assert.match(block, /\.article-rail-left \.article-rail-stay \{\s*margin-top: 0/,
    'the left rail must give up its margin when stacked too, or the gap is paid twice');

  /*
    And it must be a CLASS, not an inline style. Inline can only be beaten
    with `!important`, which is how that rule ended up unscoped and reaching
    every rail on the site.
  */
  const page = readSrc('src', 'pages', 'intel', '[slug].astro');
  assert.doesNotMatch(page, /style="margin-top: 4rem;?"/,
    'the Stay Updated margin belongs in article.css as .article-rail-stay, not inline');
  assert.match(page, /class="article-rail-desk article-rail-stay/,
    'and the block has to carry the class the stylesheet targets');
});

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
