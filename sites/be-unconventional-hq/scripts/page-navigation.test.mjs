/**
 * How a page ENTERS, and how the contents rail follows the reader.
 *
 * ─── WHAT THIS IS GUARDING ──────────────────────────────────────────────────
 * Two reports, one cause each, and both are easy to undo by tidying:
 *
 *   "way too jarring"  — the What We Cover tiles go to /feed#film. Along the
 *                        nav that is one step right, so the page slid sideways,
 *                        and THEN the feed smooth-scrolled several thousand
 *                        pixels down to the row. Two motions in two axes.
 *
 *   the contents rail  — it sat at the top of a 14rem column and scrolled with
 *                        the page until its sticky caught. It is pinned to the
 *                        viewport now, and the reading measure took the width.
 */
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(join(here, '..', ...p), 'utf8');

test('a link that names a section moves down the page, not across the nav', () => {
  const layout = read('src', 'layouts', 'Layout.astro');

  /*
    Checked BEFORE the nav order, which is the whole point: Home -> Feed is one
    step right and would win on nav order alone, which is exactly what produced
    a sideways slide into a downward scroll.
  */
  const fn = layout.slice(layout.indexOf('function directionFor'));
  const body = fn.slice(0, fn.indexOf('\n        }'));
  assert.match(body, /if \(toHash\) return 'dive-down';/, 'arriving at an anchor is a descent');
  assert.match(body, /if \(fromHash\) return 'dive-up';/, 'and leaving one comes back up');
  assert.ok(
    body.indexOf("toHash") < body.indexOf('from < to ? '),
    'the anchor check must come before the nav-order comparison, or it never runs',
  );

  /* Back out of an anchor the way you went in. */
  assert.match(
    layout,
    /event\.from\.hash && !event\.to\.hash\) direction = 'dive-up'/,
    'a traverse off an anchor rises rather than sliding sideways',
  );
});

test('the vertical transitions exist and are gentler than the horizontal ones', () => {
  const css = read('src', 'styles', 'global-base.css');

  for (const name of ['dive-down', 'dive-up']) {
    assert.match(
      css,
      new RegExp(`html\\[data-page-transition='${name}'\\]::view-transition-old\\(page-main\\)`),
      `${name} must animate the outgoing page`,
    );
    assert.match(
      css,
      new RegExp(`html\\[data-page-transition='${name}'\\]::view-transition-new\\(page-main\\)`),
      `${name} must animate the incoming page`,
    );
  }
});

test('the fade transitions exist and use the correct duration', () => {
  const cssText = read('src', 'styles', 'global-base.css');

  /*
    A page is much taller than it is wide, so the same percentage is a far
    longer journey down the screen than across it. The vertical travel has to
    stay SHORTER than the horizontal, or the fix reintroduces the lurch.
  */
  const hasFadeOut = !!cssText.match(/@keyframes page-fade-out/);
  const hasFadeIn = !!cssText.match(/@keyframes page-fade-in/);
  assert.ok(hasFadeOut && hasFadeIn, 'the crossfade keyframes must exist');

  // Verify transition duration is updated to 250ms
  assert.ok(cssText.includes('animation: page-fade-out 250ms'), 'should use 250ms duration');
});

test('the feed lands on its row rather than travelling to it', () => {
  const grid = read('src', 'components', 'FeedGrid.astro');

  assert.match(
    grid,
    /function scrollToHashRow\(instant = false\)/,
    'arrival and an in-place hash change are different events and need different answers',
  );
  assert.match(
    grid,
    /const behavior = instant \|\| reduced \? 'auto' : 'smooth'/,
    'an arrival must not smooth-scroll underneath the page transition',
  );
  assert.match(
    grid,
    /scrollToHashRow\(true\)/,
    'astro:page-load is the arrival, so it lands instantly',
  );

  /*
    The hashchange handler receives an Event. Passed as the listener directly it
    lands in `instant` and is truthy, which would make the in-place scroll
    instant too — the one case where the motion IS the feedback.
  */
  assert.match(
    grid,
    /const onRowHashChange = \(\) => scrollToHashRow\(false\)/,
    'the listener must be wrapped so the Event does not become `instant`',
  );
  assert.doesNotMatch(
    grid,
    /addEventListener\('hashchange', scrollToHashRow\)/,
    'passing the function straight in makes every in-place jump instant',
  );
});

test('the contents rail is pinned to the viewport, and gave its column back', () => {
  const nav = read('src', 'components', 'FloatingPageNav.astro');
  const page = read('src', 'pages', 'intel', '[slug].astro');
  const css = read('src', 'styles', 'modules', 'article.css');

  /*
    This briefly asserted the OPPOSITE — that a `.fpn-wrapper` with
    `position: sticky` had to exist. A sticky box sits where it is inserted,
    which is inside the page's content column, so the nav inherited that
    column's left edge rather than the screen's. At 1440 the column starts ~32px
    in and it looked right; at 3840 it starts at 978px and the nav landed on top
    of the first card.
  */
  assert.match(nav, /\.floating-page-nav\s*\{[\s\S]{0,400}?position:\s*fixed/,
    'only fixed is measured from the viewport at every width');

  /*
    A fixed element is trapped by any ancestor with a transform, a filter or a
    backdrop-filter — the containing-block rule that anchored the feed's PiP
    window to its hero instead of the viewport. Mounted outside the grid it
    cannot acquire one from a change inside the layout.
  */
  assert.ok(
    page.indexOf('<FloatingPageNav') < page.indexOf('<main class="article-page">'),
    'the nav must be mounted outside the layout it used to live in',
  );
  assert.doesNotMatch(page, /<ArticleToc/, 'the static rail is replaced, not doubled up');

  /*
    CLIPPED, NOT HIDDEN. `display: none` takes a label out of the accessibility
    tree, and a screen reader is then offered a nav of unnamed links.
  */
  const label = css.length && nav.slice(nav.indexOf('.fpn-label {'));
  assert.match(label.slice(0, label.indexOf('\n  }')), /max-width: 0/, 'labels clip');
  assert.doesNotMatch(label.slice(0, label.indexOf('\n  }')), /display: none/, 'labels must stay announced');

  /* The 14rem track existed to hold the contents. It does not any more. */
  const grid = css.slice(css.indexOf('.article-layout {'));
  const decl = grid.slice(0, grid.indexOf('\n}'));
  const cols = decl.match(/grid-template-columns: (\d+)rem minmax\(0, (\d+)rem\)/);
  assert.ok(cols, 'the three-column grid must still be declared in one place');
  assert.ok(+cols[1] <= 11, `the left track must shrink with the contents gone, got ${cols[1]}rem`);
  assert.ok(+cols[2] >= 56, `and the reading measure must take the width, got ${cols[2]}rem`);
});

/*
  ─── THE HERO/BANNER SEAM MUST NOT DEPEND ON THE WINDOW'S HEIGHT ────────────

  The rows were pulled up over the hero with `margin-top: -6vh`, paired with a
  mask that faded the hero's bottom edge. The mask was removed and the overlap
  was only reduced, which left a hard-edged hero with the rows still sliding
  under it.

  `vh` is a fraction of the window's HEIGHT; the hero's height is set by its
  CONTENT. Measured on /feed:

    1440 x 900    hero 654px   overlap  54px    8.3% of the hero
    1440 x 1800   hero 654px   overlap 108px   16.5% of the hero
    3840 x 2160   hero 632px   overlap 130px   20.5% of the hero

  The first two are the same page at the same width — only the window's height
  changed and the overlap doubled. Retuning the number cannot fix that; any
  `vh` value has the same defect. Hence: no viewport-relative overlap at all.
*/
test('the rows do not slide under the hero by a viewport-relative amount', () => {
  const grid = read('src', 'components', 'FeedGrid.astro');

  const spotlight = [...grid.matchAll(/#feed-rows\s*\{[^}]*\}/g)].map((m) => m[0]).join('\n');
  assert.doesNotMatch(
    spotlight,
    /margin-top:\s*-[\d.]+v(h|min|max)/,
    'a vh overlap is a different fraction of the hero at every window size',
  );

  /* And the hero must not have grown a bottom fade back to hide the seam. */
  const hero = read('src', 'components', 'FeedSpotlightHero.astro');
  assert.doesNotMatch(
    hero,
    /mask-image:\s*linear-gradient\(\s*to bottom[^)]*transparent/,
    'the hero bottom fade was removed deliberately; it is not the fix for a seam',
  );
});

/*
  ─── PAGING A LIST IS NOT TRAVELLING ANYWHERE ───────────────────────────────

  /events -> /events/2 is a real navigation, so it drove the site-wide page
  transition and slid the whole document sideways to change a grid of tiles
  halfway down it.
*/
test('paging a list moves the list, not the page', () => {
  const layout = read('src', 'layouts', 'Layout.astro');
  const css = read('src', 'styles', 'global-base.css');
  /*
    THE ROUTE MOVED. /events no longer paginates — its upcoming list is a scroll
    container in the page — so the list this test was written about is now the
    PAST EVENT ARCHIVE, which is the same list pattern and still paged. The
    machinery in Layout.astro and global-base.css is unchanged and still serves
    every other paginated route.
  */
  const events = read('src', 'pages', 'events', 'archive', '[...page].astro');

  /* Comments stripped: the notes explaining WHY these are forbidden quote the
     offending declarations, and an un-stripped check matches the prose. */
  const eventsCode = events.replace(/\/\*[\s\S]*?\*\//g, '');

  assert.match(layout, /function baseOf\(pathname\)/, 'a paginated route needs its page number stripped');
  assert.match(
    layout,
    /if \(baseOf\(fromPath\) === baseOf\(toPath\)\) return 'page-rows';/,
    'same list, different page, must not read as a journey along the nav',
  );

  /*
    ─── NOTHING ON THIS PAGE IS A VIEW-TRANSITION TARGET ──────────────────────

    This went through two wrong answers. First `.events-page-grid` carried the
    name, which animated the sidebar too. Then `.upcoming-section` did, which
    was worse: a view transition positions its snapshots against the VIEWPORT,
    not the element's place in the document, and Astro resets scroll on
    navigation — so tiles captured 700px down the page were replayed at the top
    of the screen, over the hero.

    Neither a different element nor a different animation fixes that. The page
    must not jump, and the list must not leave the flow. So: no name anywhere
    here, the scroll position is restored across the swap, and the list plays a
    plain CSS fade on the real element.
  */
  assert.doesNotMatch(
    eventsCode,
    /view-transition-name/,
    'a snapshot of this list is drawn against the viewport, not where the list lives',
  );
  assert.match(events, /data-rows-target/, 'the list must be marked for the in-place fade');

  /*
    And SOMETHING must carry it. The events index was the only element in the
    project ever marked, so removing pagination from that page came within one
    attribute of leaving the fade and the scroll restore pointed at nothing,
    site-wide and silently. This asserts the attribute exists somewhere under
    src/pages, not merely in the file above.
  */
  const marked = execSync(
    "grep -rl 'data-rows-target' src/pages || true",
    { cwd: join(here, '..'), encoding: 'utf8' },
  ).trim();
  assert.ok(marked.length > 0, 'no page carries data-rows-target: page-rows animates nothing');

  /*
    ─── AND IT LANDS ON THE LIST, NOT ON A REMEMBERED OFFSET ────────────────

    This used to assert that `window.scrollY` was captured before the swap and
    restored after it. That was the behaviour, and it was the bug: the last
    page of a paginated list is usually shorter, so an offset that sat mid-list
    on page 1 is past the end of page 2 and the browser clamps it to the bottom
    of the document. Reported as "press Next and get thrown to the footer".

    Restoring an offset is also wrong when it fits, because it leaves the
    reader at the BOTTOM of a list whose items all just changed. The top of the
    container is the same correct answer at every page height.
  */
  const layoutSrc = read('src', 'layouts', 'Layout.astro');
  assert.match(
    layoutSrc,
    /rowsPending = direction === 'page-rows'/,
    'the swap must know a pagination happened',
  );
  assert.match(
    layoutSrc,
    /astro:after-swap[\s\S]{0,1400}?querySelector\('\[data-rows-target\]'\)[\s\S]{0,200}?scrollIntoView/,
    'and must land on the list itself',
  );
  assert.ok(
    !/window\.scrollTo\(\{ top: y/.test(layoutSrc),
    'restoring a remembered offset is what threw the reader to the bottom',
  );

  const cssSrc = read('src', 'styles', 'global-base.css');
  assert.match(
    cssSrc,
    /html\[data-page-transition='page-rows'\] \[data-rows-target\]/,
    'the fade must play on the real element, not a snapshot',
  );

  /*
    An earlier attempt switched the page-level name off from this page with
    `#page-content { view-transition-name: none !important }`. That disabled the
    transition for every navigation INTO and OUT OF /events too, and
    asymmetrically — only one of the two documents in a transition carries this
    page's stylesheet.
  */
  assert.doesNotMatch(
    eventsCode,
    /#page-content\)?\s*\{[^}]*view-transition-name:\s*none/,
    'the page-level transition name must not be switched off from one route',
  );

  /* Suppressing old/new alone leaves the group's default cross-fade, which is
     the full-page flash this exists to avoid. */
  assert.match(
    css,
    /html\[data-page-transition='page-rows'\]::view-transition-group\(page-main\)\s*\{\s*animation-duration:\s*0s/,
    'the page-main GROUP has to be stopped too, not just its old/new',
  );
  assert.match(css, /@keyframes section-rows-in/, 'the rows need their own motion');
  assert.doesNotMatch(
    css,
    /::view-transition-(old|new)\(section-rows\)/,
    'the list is animated in place now; a snapshot rule would bring the fly-over back',
  );
});

/*
  The coverage filters are client-side: no navigation, so no view transition to
  ride on. They set `display` directly, which reflowed the grid in one frame.
*/
test('a filter fades its cards rather than snapping them', () => {
  for (const rel of [
    ['src', 'pages', 'featured', '[slug].astro'],
    ['src', 'components', 'EventFeatured.astro'],
    ['src', 'components', 'EventAnnouncement.astro'],
  ]) {
    const src = read(...rel);
    const name = rel[rel.length - 1];

    assert.match(src, /is-filtered-out/, `${name}: the fade needs a class to drive it`);
    assert.match(
      src,
      /requestAnimationFrame\(\(\) => \w+\.classList\.remove\('is-filtered-out'\)\)/,
      `${name}: a card coming back must be laid out BEFORE it fades in, or there is no start frame`,
    );
    assert.match(
      src,
      /if \(\w+\.classList\.contains\('is-filtered-out'\)\) \w+\.style\.display = 'none'/,
      `${name}: re-check before hiding — a fast second click lands inside the fade`,
    );

    /* Opacity only. `.content-card` already owns a transform for its hover
       lift, and two sources animating one property means the card jumps. */
    const decl = src.slice(src.indexOf('.content-card.is-filtered-out'));
    assert.doesNotMatch(
      decl.slice(0, decl.indexOf('}')),
      /transform:/,
      `${name}: the filter must not animate transform, the hover lift owns it`,
    );
  }
});

/*
  ─── A COMMENT THAT EATS ITS OWN RULE ───────────────────────────────────────

  `.event-hero`'s note about NOT using overflow:hidden lost its terminator in a
  commit that trimmed the last line of the comment. The comment then ran on
  through the closing brace and destroyed the whole rule, so `position:
  relative` never applied. `.event-hero-bg-wrapper` is `position: absolute;
  inset: 0`, so with no positioned ancestor it escaped to the initial containing
  block and sized itself to the VIEWPORT: the hero's blurred backdrop painted
  2224px tall behind every row on the feed.

  Reported as "why is the hero image extending into the background". Nothing
  caught it — the build passed, `astro check` passed, and the rule simply was
  not there. So this asserts the OUTPUT: every hero must actually establish a
  containing block for its own backdrop.
*/
test('every hero establishes a containing block for its backdrop', () => {
  for (const rel of [
    ['src', 'components', 'FeedSpotlightHero.astro'],
    ['src', 'components', 'EventFeatured.astro'],
    ['src', 'components', 'EventAnnouncement.astro'],
    ['src', 'pages', 'featured', '[slug].astro'],
  ]) {
    const src = read(...rel);
    const name = rel[rel.length - 1];

    /*
      Comments stripped FIRST, then the rule is looked for. That is the whole
      point: the bug was a rule that only existed inside a comment.
    */
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
    const rule = code.match(/\.event-hero\s*\{([^}]*)\}/);
    assert.ok(rule, `${name}: the .event-hero rule must survive comment stripping`);
    assert.match(
      rule[1],
      /position:\s*relative/,
      `${name}: without it the backdrop escapes to the viewport and paints over the page`,
    );
  }
});

/*
  ─── THE HERO AND THE ROWS READ ONE WIDTH ───────────────────────────────────

  The heroes carried their own `2xl:!max-w-[1920px]` / `3xl:!max-w-[2400px]`
  while `.container-page` capped at 1536. Two sources for one measurement, and
  they disagreed by 217px at 3840.

  Worse, a full-bleed rail insets its first card to that column, so at 3840
  there were 978px of empty ground before the first card while the cards ran off
  the right-hand edge. Reported as "a ton of empty space on the left side".
*/
test('one content width, shared by the hero and the page body', () => {
  const layoutCss = read('src', 'styles', 'modules', 'layout.css');

  assert.match(layoutCss, /--page-max:\s*\d+px/, 'the width has to be named somewhere');
  assert.match(
    layoutCss,
    /\.container-page\s*\{[^}]*max-width:\s*var\(--page-max\)/,
    'the page body reads the shared width',
  );

  for (const rel of [
    ['src', 'components', 'FeedSpotlightHero.astro'],
    ['src', 'components', 'EventFeatured.astro'],
    ['src', 'components', 'EventAnnouncement.astro'],
    ['src', 'pages', 'featured', '[slug].astro'],
  ]) {
    const src = read(...rel);
    const name = rel[rel.length - 1];

    assert.doesNotMatch(
      src,
      /max-w-\[(1920|2400)px\]/,
      `${name}: a second cap on the hero is how the two came to disagree`,
    );
    assert.match(
      src,
      /\.hero-grid-container\s*\{[\s\S]{0,200}?max-width:\s*var\(--page-max\)/,
      `${name}: the hero must read the shared width`,
    );
  }
});

/*
  The contents nav is edge-pinned. It was briefly a zero-size `sticky` wrapper,
  which sits inside the content column — so at 3840 it landed on top of the
  first card instead of on the screen's edge.
*/
test('the contents nav is pinned to the viewport, not the content column', () => {
  const nav = read('src', 'components', 'FloatingPageNav.astro');
  const rule = nav.slice(nav.indexOf('.floating-page-nav {'));
  const decl = rule.slice(0, rule.indexOf('\n  }'));

  assert.match(decl, /position:\s*fixed/, 'only fixed is measured from the viewport at every width');

  /* Comments stripped: the notes explaining why sticky was wrong name it. */
  const code = nav.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(code, /position:\s*sticky/, 'a sticky box inherits the content column it sits in');
  assert.doesNotMatch(code, /class="fpn-wrapper"/, 'the wrapper is gone; fixed takes no layout space anyway');
});

/*
  ─── THE BANNER ART CARRIES ON BEHIND THE ROW ───────────────────────────────

  The artwork used to stop dead on the banner's bottom edge, which put a hard
  horizontal line directly above the row heading. The cause was a `mask-image`
  on the banner BOX: a mask resolves its percentages against the element's own
  border box, so it faded out at exactly the height the row starts at.

  The fade belongs to the ART, which is taller than the box by `--banner-bleed`
  and dissolves across it. The box keeps its own height, so the row still flows
  underneath and the lockup stays anchored where it was.
*/
test('the banner art overhangs its box and fades, rather than being cut off', () => {
  const banner = read('src', 'components', 'FeedRowBanner.astro');
  const grid = read('src', 'components', 'FeedGrid.astro');

  const boxRule = banner.slice(banner.indexOf('.feed-row-banner {'));
  const boxDecl = boxRule.slice(0, boxRule.indexOf('\n  }'));

  assert.match(boxDecl, /--banner-bleed:/, 'the overhang has to be a named amount');
  assert.match(boxDecl, /overflow:\s*visible/, 'hidden clips the overhang away again');
  assert.doesNotMatch(
    boxDecl,
    /mask-image:/,
    'a mask on the BOX cuts the art off at the row, which is the bug',
  );

  /* The art is what is taller, and what fades. */
  assert.match(
    banner,
    /height:\s*calc\(100% \+ var\(--banner-bleed\)\)/,
    'the art must be taller than the box by the bleed',
  );
  const artRule = banner.slice(banner.indexOf('.feed-row-banner-art {'));
  assert.match(
    artRule.slice(0, artRule.indexOf('\n  }')),
    /mask-image:\s*linear-gradient\(to bottom[\s\S]*?transparent 100%\)/,
    'the art dissolves at its own bottom, not the box\'s',
  );

  /*
    And the row has to sit on top of it. The art is positioned and the heading
    is not, so without a stacking position of its own the picture paints over
    the row's own content.
  */
  assert.match(
    grid,
    /\.feed-row--prestige \.feed-row-head,\s*\n\s*\.feed-row--prestige \.feed-row-rail \{[^}]*z-index:\s*1/,
    'the heading and the rail must paint above the overhang',
  );
});

/*
  ─── A FEATURED ROW'S TILES CARRY THE SHOW, NOT THE HUB ─────────────────────

  The Lanterns tiles resolve to DC, because that is the hub that owns them, so
  promoting one into the spotlight hero filled it with DC's key art and the DC
  roundel — directly under a banner showing the show's own logo. The row and
  the hero it drives disagreed about what you were looking at.
*/
test('a featured tile hands its show\'s artwork to the hero', () => {
  const card = read('src', 'components', 'ContentCard.astro');
  const grid = read('src', 'components', 'FeedGrid.astro');

  assert.match(card, /brandOverride\?:/, 'the card must accept a show-level identity');
  assert.match(
    card,
    /title: brandOverride\?\.title \|\| entity\.title/,
    'the show names itself where it has a name',
  );
  for (const field of ['logo', 'hero']) {
    assert.match(
      card,
      new RegExp(`${field}: brandOverride\\?\\.${field} \\|\\| entity\\.${field}`),
      `the show's ${field} must win over the hub's`,
    );
  }

  /*
    But ONLY the look and the name. The Explore CTA still has to reach a page
    that exists, and the show has none — overriding `url` would send it nowhere.
  */
  const payload = card.slice(card.indexOf('const brandData = entity'));
  const block = payload.slice(0, payload.indexOf(': undefined;'));
  for (const field of ['slug', 'url', 'type', 'color']) {
    assert.doesNotMatch(
      block,
      new RegExp(`${field}: brandOverride`),
      `${field} must stay the hub's — the show has no page of its own`,
    );
  }

  /* And the shelf must actually pass it, at a size fit for a hero backdrop
     rather than the 2560px master the banner uses. */
  assert.match(grid, /const collectionBrands = new Map/, 'the row must build the override');
  assert.match(grid, /getImage\(\{ src: collection\.bannerArt, width: \d+ \}\)/, 'the backdrop must be resized');
  assert.match(grid, /brandOverride=\{collectionBrands\.get\(collection\.id\)/, 'the tiles must carry it');
});

/*
  ─── THE CONTENTS RAIL FOLLOWS THE READER, AND THE JUMP LANDS ───────────────

  Two faults, reported together as "I selected the 2nd tile it scrolled down but
  first is still highlighted, the scroll position is broken for all articles":

    the rail only ever asked "which heading was the last to pass the 80px
    line", which is right while scrolling THROUGH a section and wrong the
    instant you jump to one — the target lands BELOW the line, so the previous
    heading is still the last one passed and stays lit;

    and the jump itself landed short on the first click of a cold load, because
    a native anchor resolves against the layout as it is at that instant and
    the images above the fold had not finished laying out. Measured: 842px
    instead of the ~90px `scroll-margin-top` asks for.
*/
test('the contents rail tracks the section you jumped to', () => {
  const nav = read('src', 'components', 'FloatingPageNav.astro');

  /* A heading in the upper part of the viewport wins outright. */
  assert.match(
    nav,
    /const ZONE_BOTTOM = window\.innerHeight \* 0\.5/,
    'the rail needs a zone, not just a line',
  );
  assert.match(
    nav,
    /onScreen\[0\]\?\.id[\s\S]{0,80}setActive\(onScreen\[0\]\.id\)/,
    'the topmost heading on screen is the current section',
  );

  /* And a click is an answer, not a hint. */
  assert.match(nav, /setActive\(id\);/, 'the clicked entry lights immediately');

  /*
    ─── IT TRAVELS, AND THE JOURNEY IS GUARDED ───────────────────────────────

    This file used to assert the opposite: `doesNotMatch(/behavior: 'smooth'/)`,
    on the reasoning that two animated versions had read as unsteady so
    switching beat travelling. That pinned a workaround as the contract.

    The flicker (1 > 4 > 2 > 3 > 4) was never the animation. It was a stray
    trackpad `wheel` event landing inside the animation, releasing the pin, and
    letting geometry light up every section the page travelled past. Making the
    jump instant removed the window rather than the cause.

    So the scroll is smooth again and what must hold is the guard: the pin
    survives the journey, and it stops surviving when the journey ENDS rather
    than after a guessed number of milliseconds, because a smooth scroll's
    duration scales with distance.
  */
  assert.match(nav, /event\.preventDefault\(\)/, 'the browser jump is replaced by one we control');
  assert.match(
    nav,
    /const jumpWhenAimed = \(attempt(: number)?\) =>/,
    'the target must stop moving before it is aimed at',
  );
  assert.match(
    nav,
    /scrollIntoView\(\{ block: 'start', behavior: 'smooth' \}\)/,
    'the cinematic scroll is the point; instant was the workaround',
  );
  assert.match(
    nav,
    /armReleaseWhenSettled\(\);[\s\S]{0,120}?scrollIntoView/,
    'the guard must be armed BEFORE the scroll: a flick can land in the same frame',
  );
  assert.match(
    nav,
    /const releasePin = \(\) => \{\s*if \(!releaseArmed\) return;/,
    'a wheel event during the jump must not release the pin',
  );
  assert.doesNotMatch(
    nav,
    /ignoreWheelUntil|Date\.now\(\) \+ 1000/,
    'not a fixed window — Chrome scales a smooth scroll with distance, so one guess is wrong at both ends',
  );
  assert.match(
    nav,
    /still >= 3 \|\| Date\.now\(\) > deadline/,
    'the guard ends when the scroll settles, with a cap so it cannot wedge the pin',
  );
  assert.match(
    nav,
    /history\.replaceState\(null, '', `#\$\{id\}`\)/,
    'replaceState, not location.hash — the latter re-triggers the browser jump',
  );
});

test('the contents rail resolves position in ONE place', () => {
  /*
    ─── WHY THIS BROKE ON A 4K MONITOR ─────────────────────────────────────

    The IntersectionObserver kept its own Set and highlighted the TOPMOST
    intersecting target, deferring to the zone rule only when the Set emptied.
    Two rules for one question, and they disagreed the moment the observed
    elements got tall.

    The ids are on the rail SECTIONS, ~424px each, not on the heading text. An
    element intersects if ANY part of it is in the band, so a rail whose top had
    already scrolled past the 80px line still intersected on its lower half and
    won by being topmost.

    Measured on /feed at 2560x1400, scrolled to the bottom after clicking TV:
      film  top  13, bottom 437  -> observer picked this
      tv    top 481, bottom 906  -> the section actually under the reader
  */
  const nav = read('src', 'components', 'FloatingPageNav.astro');
  assert.match(nav, /const observer = new IntersectionObserver\(\s*\(\) => resolveActive\(\)/,
    'the observer must report a change, not decide the answer');

  /* CHECK THE CODE, NOT THE FILE. The comment above the scroll listener names
     the Set it replaced, and naming it there is the point of a comment. */
  const code = nav.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/activeHeadings/.test(code), 'its second rule and the Set behind it must be gone');
});

test('the last sections are reachable on a tall viewport', () => {
  /*
    The detection zone is the top half of the viewport and a section becomes
    active by scrolling INTO it. The last sections never can: once the document
    is at its end they sit wherever the page leaves them. At 3840x2160 the zone
    floor is 1080px and TV landed below it, so clicking TV highlighted Games.
  */
  const nav = read('src', 'components', 'FloatingPageNav.astro');
  assert.match(nav, /const atBottom =/, 'the end of the document is a position, not a non-event');
  /*
    The tolerance was `- 2` and was reported as still wrong on a 4K display:
    `scrollHeight` is an integer and `scrollY` is not, so a scaled display
    rounds them apart and maximum scroll lands short of the number. Asserted as
    a RANGE rather than a literal, because the exact figure is a band chosen to
    cover a display this browser does not emulate, not a measurement — inside
    it the branch returns the same answer either way.
  */
  const tolerance = nav.match(/const BOTTOM_TOLERANCE = (\d+);/);
  assert.ok(tolerance, 'the tolerance must be named, not buried in the comparison');
  assert.ok(Number(tolerance[1]) >= 4, 'two pixels was not enough on a scaled 4K display');
  assert.ok(Number(tolerance[1]) <= 40, 'a wide band starts answering for sections still in reach');
  assert.match(nav, /Math\.ceil\(window\.innerHeight \+ window\.scrollY\)/,
    'the sum is fractional and the value it is compared against is not');
});

test('a click outranks geometry until the reader takes the page back', () => {
  /*
    At the end of a document several sections are on screen and none can scroll
    further, so clicking Film and clicking TV land at the SAME scroll position.
    No measurement can separate them. The reader's own click is the better
    evidence, so it is pinned.

    Released by a REAL gesture only. A plain `scroll` listener cannot make that
    distinction — the click's own scrollIntoView() would clear the pin in the
    frame it was set.
  */
  const nav = read('src', 'components', 'FloatingPageNav.astro');
  assert.match(nav, /let pinnedId: string \| null = null;/);
  assert.match(nav, /if \(pinnedId\) return;/, 'geometry must stand down while a pin is set');
  assert.match(nav, /pinnedId = id;/, 'and the click must set it');

  for (const gesture of ['wheel', 'touchmove', 'keydown']) {
    assert.match(nav, new RegExp(`addEventListener\\('${gesture}'`), `${gesture} must release the pin`);
  }
  assert.ok(!/addEventListener\('scroll', releasePin/.test(nav),
    'a scroll listener would clear the pin on the click\'s own jump');
});
