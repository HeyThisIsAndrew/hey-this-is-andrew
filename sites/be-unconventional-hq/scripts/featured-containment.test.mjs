/*
  /featured — layout invariants that have each already shipped as a bug.

  Static assertions over the page source, in the style of the other guards in
  this directory: no browser, no network, no build step. They cannot prove the
  page LOOKS right — they exist to stop four specific regressions that were
  each found only after they reached a device.
*/
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';
import { EVENT_TYPE_LABELS } from '../src/lib/events.ts';
import { collectHubCoverage } from '../src/lib/hub-coverage.ts';

/*
  Several guards below read OTHER files (the hub page, the two event
  components). They need the same comment-stripping `src` gets, or a negative
  assertion finds this repository's own explanation of the bug and reports it
  as the bug. That has happened here before.
*/
const stripComments = (text) =>
  text
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const here = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(here, '..', 'src', 'pages', 'featured', 'index.astro'), 'utf8');

/*
  Assertions run against the source with comments removed. Every rule below is
  about what the page DOES, and this file explains at length why — which means
  an un-stripped search finds its own reasoning and reports the bug it exists
  to prevent. `{/* … *\/}` (Astro), `/* … *\/` and `// …` all go.
*/
const src = raw
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

/*
  The page's own <style> block, comments removed.

  Several guards below are about what is declared in CSS, and `src` is the
  whole .astro file — frontmatter, markup and script included — so searching it
  finds the TypeScript that GENERATES a rule as readily as a hardcoded one.
  This narrows the search to the stylesheet.
*/
function styleBlock() {
  const open = raw.indexOf('\n<style>');
  const close = raw.indexOf('</style>', open);
  if (open === -1 || close === -1) throw new Error('featured/index.astro has no <style> block');
  return raw.slice(open + '\n<style>'.length, close).replace(/\/\*[\s\S]*?\*\//g, '');
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

console.log('\nfeatured/index.astro layout invariants');

test('the trailer wrapper is no TALLER than the panel it sits in', () => {
  /*
    It used to be 150% tall and clawed back with a second, intersected mask
    layer. WebKit does not honour `mask-composite` there, so the overhang
    painted 111px below the row on desktop and 74px on a landscape phone —
    over the footer, on the last row. Containment is the wrapper's own box
    now; nothing else is load-bearing.
  */
  const block = src.slice(src.indexOf('.trailer-bg-wrapper {'));
  const decl = block.slice(0, block.indexOf('}'));
  assert.match(decl, /height:\s*100%/, '.trailer-bg-wrapper must be height: 100%');
  assert.doesNotMatch(decl, /height:\s*150%/, '.trailer-bg-wrapper must not overhang vertically');
});

test('no mask-composite anywhere on this page', () => {
  assert.doesNotMatch(
    src,
    /mask-composite/,
    'a composited mask layer list is not reliable in WebKit — contain by box size and soften with a scrim instead',
  );
});

test('the hero card is a real link, not a div with a click handler', () => {
  // The keyboard, screen-reader, middle-click and open-in-new-tab paths all
  // depend on this being an anchor. A `data-href` + window.location pair
  // supports none of them.
  assert.match(src, /<a\s+[^>]*class=\{`deck-card /, 'the deck card must be an <a>');
  assert.doesNotMatch(src, /data-href/, 'no data-href indirection — use a real href');
  assert.doesNotMatch(src, /window\.location\.href\s*=/, 'no scripted navigation for the card');
});

test('the brand mark and the way in live ON the artwork', () => {
  for (const cls of ['deck-card-scrim', 'deck-card-plate', 'deck-card-enter']) {
    assert.ok(src.includes(cls), `${cls} is missing`);
  }
  // The old trailer-corner stack is what collided with the video on a phone.
  for (const gone of ['trailer-bottom-content', 'trailer-text-btn-row', 'dynamic-brand-btn']) {
    assert.ok(!src.includes(gone), `${gone} should be gone — the plate replaced it`);
  }
});

test('the hub rail only feathers a side that actually continues', () => {
  // A fixed 10%/90% ramp dimmed the first and last hub permanently, so two of
  // five looked disabled with nothing scrolled.
  assert.match(src, /--nav-fade-start:\s*0%/, 'the start ramp must default to zero');
  assert.match(src, /--nav-fade-end:\s*0%/, 'the end ramp must default to zero');
  assert.match(src, /data-overflow-start/, 'the script must report which side overflows');
  assert.match(src, /data-overflow-end/, 'the script must report which side overflows');
});

test('nothing inside the accordion has an intrinsic height', () => {
  /*
    The four rows fit the viewport only because their content contributes no
    min-content height. Giving `.deck-stack` an aspect-ratio closed a gap in
    portrait and, in the same stroke, gave every COLLAPSED row ~220px it could
    not shrink out of: the page grew to 1290px and the last row ran past the
    footer.
  */
  const stacks = src.split('.deck-stack {').slice(1);
  for (const block of stacks) {
    const decl = block.slice(0, block.indexOf('}'));
    assert.doesNotMatch(decl, /aspect-ratio/, '.deck-stack must not have an intrinsic aspect-ratio');
  }
});

test('the typeface demo is not trapped in a phone media query', () => {
  /*
    Every demo face and the picker's own styling sat inside
    `@media (max-width: 768px)`, so the picker did nothing on the screen it
    exists to choose a face for.
  */
  const queries = [];
  const re = /@media\s*\([^)]*max-width:\s*768px[^)]*\)[^{]*\{/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    let depth = 0;
    let end = m.index;
    for (let j = m.index; j < src.length; j += 1) {
      if (src[j] === '{') depth += 1;
      else if (src[j] === '}') {
        depth -= 1;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }
    queries.push(src.slice(m.index, end));
  }
  assert.ok(queries.length > 0, 'expected at least one phone media query');
  for (const body of queries) {
    for (const face of ['Syncopate', 'Bebas Neue', 'Cinzel', 'Oswald']) {
      assert.ok(!body.includes(`'${face}'`), `${face} must be declared outside the phone query`);
    }
    assert.ok(!body.includes('.font-picker-btn {'), 'the picker must be styled outside the phone query');
  }
});

test('there is no player on /featured, and no page-relative iframe anywhere', () => {
  /*
    The trailer needed the right half of a 50/50 split, and that split has
    moved to the hub page where playback follows a CLICK. Every problem this
    page had came from autoplaying somebody else's embed on a screen nobody had
    clicked into — the paused-player chrome, the caption track, blocked
    autoplay. None of it applies once the player is somewhere a visitor chose
    to be.

    The player's CSS and controller are deliberately still in this file: they
    are what gets lifted onto the hub page, and lifting beats rewriting from
    memory. What must be true is that nothing RENDERS one here.
  */
  assert.doesNotMatch(src, /<iframe/, 'no iframe element on /featured');
  assert.doesNotMatch(src, /<video/, 'no video element on /featured');
  assert.doesNotMatch(src, /youtube-nocookie/, 'no embed URL rendered on /featured');

  // HARD RULE 4 still applies to anything this page ever grows.
  assert.doesNotMatch(src, /\.src\s*=\s*['"]{2}/, "never assign an iframe src = ''");
  assert.doesNotMatch(src, /src=""/, "an empty src resolves to the current page");

  // The mark is what carries the row now.
  assert.match(src, /brand-stage-mark/, "the hub's mark is the backdrop");
});


test('the same image is not painted three times in one row', () => {
  /*
    Reported as "way too much repetition of the same damn image", and it was
    literal: `heroImage` was the deck card, the nav rail thumbnail, AND — via
    getHubBackdrop()'s fallback — the blurred plate behind all of it. A hub
    with one asset was that one asset, three times, at three sizes.

    The panel is built from the hub's OTHER asset now: the logo, blown up and
    blurred as a haze, with the same file crisp in front of it. A supplied
    `backdrops[0]` override still wins, because that is an image chosen for
    this job rather than reused into it.
  */
  assert.match(src, /backdrop-plate--mark/, 'the ghost layer is the mark');
  assert.match(src, /const ghostUrl = brand\.logo/, 'the ghost comes from the logo');
  assert.match(src, /const markUrl = brand\.logo/, 'the stage subject comes from the logo');

  // The order matters: an explicit override beats the mark, and the mark beats
  // nothing. heroImage must not be reachable as this panel's backdrop.
  const panel = src.slice(src.indexOf('const backdrop = getHubBackdrop'), src.indexOf('class="stage-wash"'));
  assert.match(panel, /backdrop \?[\s\S]*ghostUrl \?/, 'override wins, then the mark');

  /*
    This assertion used to stop at the markup, and passed while the bug was
    still live: getHubBackdrop() falls back to `heroImage` INSIDE
    local-content.ts, so the panel never mentioned heroImage and DC went on
    painting the same still three times. The panel must call the override-only
    reader, and that reader must not reach for the key art.
  */
  assert.match(panel, /getHubBackdropOverride\(/, '/featured asks for the override only');
  const lib2 = readFileSync(join(here, '..', 'src', 'lib', 'local-content.ts'), 'utf8');
  const fn = lib2.slice(lib2.indexOf('export function getHubBackdropOverride'));
  assert.doesNotMatch(fn.slice(0, fn.indexOf('\n}')), /heroImage/,
    'the override reader must not fall back to the key art');
});

test('NOTHING on the right side of a row moves', () => {
  /*
    THE LIGHT LEAK. Reported three times; I twice fixed something else and
    twice claimed it was done.

    The cause was a 32s `scale(1) -> scale(1.06)` push-in on
    .trailer-bg-wrapper — the element that CLIPS. Scaling a clipping box scales
    the clip with it, so the wrapper's edge crept ~3% above and below the panel
    and carried the plate's near-sharp, under-blurred border out past the top
    and bottom scrims. Those scrims are SIBLINGS of the wrapper, laid out
    against .large-trailer-card, so they can never cover anything that leaves
    the wrapper's own box. The 32s ease-in-out is precisely why it read as a
    leak that GREW while the page sat idle.

    Raising the scrims to alpha 1 did not fix it and could not have. The fix is
    that this side of the row is static. If motion comes back here it must move
    something that is neither the clip nor its contents — and it has to get
    past this test first.
  */
  const rightSide = [
    '.trailer-bg-wrapper',
    '.backdrop-plate',
    '.trailer-fallback-img',
    '.large-trailer-card',
    '.brand-stage-mark',
  ];
  for (const cls of rightSide) {
    const i = src.indexOf(cls + ' {');
    if (i === -1) continue;
    const decl = src.slice(i, src.indexOf('}', i));
    assert.doesNotMatch(decl, /animation:/, `${cls} must not animate`);
  }
  // No rule anywhere may animate the clipping wrapper or the plate.
  assert.doesNotMatch(src, /trailerPush/, 'the push-in must stay gone');
  assert.doesNotMatch(src, /backdropDrift/, 'the plate drift must stay gone');
  assert.doesNotMatch(src, /slowPan/, 'the fallback pan must stay gone');

  // The scrims still reach alpha 1 — necessary, just never sufficient.
  for (const cls of ['.trailer-gradient-top', '.trailer-gradient-bottom']) {
    const block = src.slice(src.indexOf(cls + ' {'));
    const decl = block.slice(0, block.indexOf('}'));
    const first = decl.match(/linear-gradient\(to (?:bottom|top),\s*rgba\([\d,\s]*?([\d.]+)\)/);
    assert.ok(first, `${cls} must have a vertical gradient`);
    assert.strictEqual(first[1], '1', `${cls} must start fully opaque, not ${first[1]}`);
  }
});


test("the deck's feather does not reach the card's own controls", () => {
  /*
    The stack is masked so cards translated past its right edge dissolve
    instead of being cut. That ramp used to reach full opacity only at 62%
    from the right — but the front card is 85% wide, so its right third sat
    inside the fade and the "Enter" chip, which lands ~20-41% from that edge,
    was drawn at roughly a fifth of its opacity. Reported as the vignette
    obscuring it.

    The ramp has to be fully opaque before the chip starts.
  */
  const stack = src.slice(src.indexOf('.deck-stack {'));
  const decl = stack.slice(0, stack.indexOf('\n  }'));
  const full = decl.match(/rgba\(0,0,0,1\) (\d+)%\)/);
  assert.ok(full, 'the stack mask must reach full opacity somewhere');
  assert.ok(
    Number(full[1]) <= 19,
    `the feather reaches the card: full opacity at ${full[1]}% leaves the Enter chip faded`,
  );
  // And it must still land on zero at the box edge, or no-repeat cuts visibly.
  assert.match(decl, /rgba\(0,0,0,0\) 0%/, 'the ramp must reach zero at the edge');
});

test('the rows snap; nothing animates a layout property', () => {
  /*
    `transition: flex-basis 0.7s` forced a full layout and repaint of the
    accordion on every frame for 700ms, underneath a full-bleed blur. Measured
    at 412x823 with a 4x CPU throttle it ran p95 50ms with frames up to 87ms
    against a 16.7ms budget; snapping the geometry and letting the staged
    reveal carry the motion took it to p95 28ms with one janky frame.

    Anything that transitions a layout property here — flex, flex-basis, width,
    height, top, margin — puts it straight back.
  */
  const block = src.slice(src.indexOf('.accordion-section {'));
  const decl = block.slice(0, block.indexOf('}'));
  assert.doesNotMatch(
    decl,
    /transition:[^;]*(flex|width|height|margin|top|bottom|left|right)/,
    'a row must not transition a layout property',
  );
  // The motion lives in the staged reveal, which is opacity and transform only.
  assert.match(src, /transition-delay: 0\.\d+s/, 'the staged reveal must still be there');
});

test("a hub's backdrop is its OWN art, never borrowed footage", () => {
  /*
    The backdrop used to be a cross-fade of up to six stills gathered from the
    thumbnails of videos tagged to the hub, then from its category. Those
    thumbnails are the channel's own video covers, which are frequently a
    photograph of the presenter — so Marvel's backdrop could be, and was, the
    top of the site owner's head. A hub is somebody else's brand and cannot be
    backed by that.

    One image per hub, its own, or none. A hub with no art falls through to the
    brand-tinted ground the page already draws.
  */
  const lib = readFileSync(join(here, '..', 'src', 'lib', 'local-content.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  assert.match(lib, /export function getHubBackdrop\b/, 'one backdrop per hub');
  assert.doesNotMatch(lib, /getHubBackdrops\b/, 'the multi-still gatherer must be gone');
  assert.doesNotMatch(lib, /thumbnailUrl/, "a hub must not borrow a video's thumbnail");
  assert.doesNotMatch(lib, /CATEGORY_TOPIC_FALLBACK/, 'a hub must not borrow from its category');

  // Blurred past detail, so the source stays small.
  assert.match(src, /width\(640\)/, 'the deck plate is requested small because it is blurred');
});

test('the blur is clipped, so its weak edge never shows', () => {
  /*
    A CSS blur goes WEAK at its own element's edges — it mixes in the
    transparent pixels outside — so the outermost band of a blurred element is
    the least blurred part of it. The plate is also scaled, which pushed it past
    its box and out behind the row heading. Together those put a strip of
    near-sharp artwork behind the category title, reported as "not blurred all
    the way to the top".

    The wrapper clips and the plate overscans past it, so what shows is the
    middle of the blur. Only safe because no iframe remains in this subtree —
    see hard rule 3.
  */
  const wrapper = src.slice(src.indexOf('.trailer-bg-wrapper {'));
  assert.match(wrapper.slice(0, wrapper.indexOf('}')), /overflow: hidden/, 'the wrapper must clip');

  const plate = src.slice(src.indexOf('.backdrop-plate {'));
  const decl = plate.slice(0, plate.indexOf('}'));
  assert.match(decl, /inset: -\d+%/, 'the plate must overscan past the clip');
  assert.match(decl, /filter: blur\(/, 'the plate must be blurred');

  // The drift is a transform on a static blur; animating the filter re-rasters.
  assert.doesNotMatch(src, /transition: filter/, 'do not animate the blur itself');
});

test('a row is sized by its own share, not by what its siblings leave over', () => {
  /*
    THIS IS THE ONE THAT COST A DAY.

    /featured is 42kB of HTML. On a throttled connection the parser lays out the
    first accordion row before the rest of the document arrives — sampled every
    frame, the container held ONE row at 742px at 200ms and four at
    536/69/69/69 by 338ms. With `flex: 1` / `flex: 8` a row's height depends on
    how many siblings it is sharing with, so every row that arrived resized
    every row already painted. That was a 0.276 cumulative layout shift, the
    worst metric on the site, and it failed the Lighthouse gate at 80%.

    Sizing by flex-BASIS against the container makes a row the same height
    whether it is alone in the DOM or the last of four. Any change back to a
    grow ratio brings the shift back, and it will only show up under throttling
    — which is why this is a test and not a comment.
  */
  const block = src.slice(src.indexOf('.accordion-section {'));
  const decl = block.slice(0, block.indexOf('}'));
  assert.match(decl, /flex: 0 0 calc\(100% \/ \(var\(--rows/, 'a collapsed row needs a fixed basis');
  assert.doesNotMatch(decl, /flex:\s*1;/, 'a grow ratio makes a row depend on its siblings');

  const exp = src.slice(src.indexOf('.accordion-section.expanded {'));
  const expDecl = exp.slice(0, exp.indexOf('}'));
  assert.match(expDecl, /flex: 0 0 calc\(800% \/ \(var\(--rows/, 'the open row needs a fixed basis too');

  // The basis is a share of the container, so the container's own height has to
  // be definite from the first layout — a percentage of a parent is not.
  const cont = src.slice(src.indexOf('.accordion-container {'));
  const contDecl = cont.slice(0, cont.indexOf('}'));
  assert.match(contDecl, /height: calc\(100lvh/, 'the container must be sized from the viewport');

  // --rows comes from the template, because a category with no hubs does not render.
  assert.match(src, /--rows: \$\{sortedCategories\.length\}/, '--rows must come from the data');
});

test('the shipping typeface is self-hosted, not a third-party stylesheet', () => {
  // A render-blocking stylesheet on another origin sits in the critical path of
  // a page whose whole layout is viewport-derived. Inter and Syne are already
  // self-hosted here; the display face is now too. The picker's other faces
  // stay remote because none of them ships.
  //
  // Asserted through PROD_FONT rather than against a filename: this test named
  // montserrat-500-latin.woff2 for two changes of shipping face after
  // Montserrat stopped being one, and passed both times on a file the page no
  // longer serves.
  const prod = src.match(/const PROD_FONT = '([a-z-]+)'/);
  assert.ok(prod, 'PROD_FONT must be declared');
  const map = src.slice(src.indexOf('const SELF_HOSTED_FILES'), src.indexOf('const selfHostedFile'));
  assert.match(
    map,
    new RegExp(`\\b${prod[1]}: \\{[^}]*file: '/fonts/`),
    `PROD_FONT is '${prod[1]}' but SELF_HOSTED_FILES serves it no local file`,
  );
  assert.match(src, /font-display: optional/, 'optional, so a late font never swaps under the reader');
  assert.match(src, /const REMOTE_FONTS/, 'the remote faces must be separated from the shipping one');
  assert.doesNotMatch(src, /@import url/, '@import is the slowest way to load CSS');
});

test('every candidate face is actually served, and none are hardcoded', () => {
  /*
    Two bugs, one symptom: every face from the fifth (Anton) rightward rendered
    in the body font while the first four worked.

    `display=optional` gives the browser ~100ms and PERMANENTLY declines a face
    that misses. Correct for one shipping face on a real page; wrong for a
    stylesheet naming seventeen families, where the first few land inside the
    window and the rest are silently dropped — in list order, which is why the
    failure looked like a cutoff partway along the picker.

    And the per-face CSS was written out twice: generated from DEMO_FONTS, and
    ALSO hardcoded for the original four. The duplicate covered a subset,
    omitted their tracking, and read as if it were the whole set.
  */
  const url = src.slice(src.indexOf('const fontImportUrl'), src.indexOf('const fontCss'));
  assert.doesNotMatch(url, /display=optional/,
    "the picker's stylesheet must not use display=optional — it drops faces past the first few");
  assert.match(url, /display=swap/, 'the comparison faces must be allowed to arrive late');

  // Exactly one place declares a face's rule, and it is generated.
  assert.match(src, /\[data-title-font='\$\{f\.id\}'\]/, 'per-face rules are generated from DEMO_FONTS');
  /*
    This used to slice from the string 'TEMPORARY typography demo', which is
    inside a COMMENT — and `src` has had its comments stripped. indexOf
    returned -1, slice(-1) handed back the file's last character, and the
    assertion below passed against one byte for as long as it existed. The
    duplicate it was written to catch was sitting in the file the whole time.
    Search the real stylesheet instead.
  */
  assert.doesNotMatch(styleBlock(), /data-demo-font='[a-z-]+'\]/,
    'no hardcoded per-face rules — they go stale the moment a face is added');
  assert.doesNotMatch(styleBlock(), /\[data-title-font='(?!demo')[a-z-]+'\]/,
    "no hardcoded per-face rules — only 'demo' may appear as a literal here");

  // The self-hosted file must belong to the face that ships.
  const map = src.slice(src.indexOf('const SELF_HOSTED_FILES'), src.indexOf('const selfHostedFile'));
  const prod = src.match(/const PROD_FONT = '([a-z-]+)'/);
  assert.ok(prod, 'PROD_FONT must be declared');
  assert.ok(
    new RegExp(`\\b${prod[1]}: \\{`).test(map),
    `PROD_FONT is '${prod[1]}' but no self-hosted file is registered for it`,
  );
});

test('one physical trackpad swipe can only ever move one card', () => {
  /*
    THE THIRD VERSION OF THIS GESTURE. Each earlier one shipped and was
    reported:

      1. debounced from the LAST wheel event, so macOS momentum held it for
         the whole tail. "one to three seconds per swipe."
      2. released on any RISING delta, but the deck fires part-way through the
         push while fingers are still accelerating, so the rest of that same
         push read as a new gesture. "one swipe moved two cards."
      3. released on any sample 2px above the previous one. Momentum is
         quantised and jitters up by more than 2px constantly, and a tail
         still running at 25px/event re-accumulates the 40px firing threshold
         in two events. Modelled against a realistic decaying tail with ±2px
         of noise, SIX OF EIGHT swipes advanced two cards. Reported as
         "sometimes it swipes through multiple carousels rather than one".

    Version three compares against the TROUGH, not the previous sample:
    momentum only decays, so its trough keeps falling and noise measured
    against the lowest point so far cannot clear it, while a real push
    re-accelerates past it many times over.

    MIN_FIRE_GAP is the unconditional backstop. Whatever the release logic
    concludes, no physical swipe moves two cards.
  */
  const gesture = src.slice(src.indexOf('const SWIPE_DELTA'), src.indexOf('// Deck Stack Clicks'));

  assert.match(gesture, /const MIN_FIRE_GAP = (\d+)/,
    'the hard cap on cards per swipe is gone; the release heuristic is then the ' +
      'only thing standing between one swipe and several, and it has been wrong twice');
  const gap = Number(gesture.match(/const MIN_FIRE_GAP = (\d+)/)[1]);
  assert.ok(gap >= 150 && gap <= 320,
    `MIN_FIRE_GAP is ${gap}ms. Below ~150 momentum can still re-trigger inside it; ` +
      `above ~320 it starts eating a deliberate second swipe, which is what the ` +
      `first version of this gesture was reported for.`);
  assert.match(gesture, /now - lastFire < MIN_FIRE_GAP/, 'the cap must actually gate the fire');

  assert.match(gesture, /trough/, 'the tail must be measured against its trough');
  assert.match(gesture, /abs < trough\) trough = abs/, 'the trough has to track downward');
  assert.match(gesture, /REARM_FLOOR/,
    'without a floor, a tail decayed to 1px re-arms on a 3px blip, which is 2.5x ' +
      'its trough and means nothing');

  assert.doesNotMatch(gesture, /abs <= lastAbs \+/,
    'releasing on a rise above the PREVIOUS sample is version three of this bug: ' +
      'momentum jitter clears it constantly');
});

test('the hub trailer hands over to the first rail tile when it stops', () => {
  /*
    The rail used to ship tile 0 marked active in the markup while the stage
    played the hub's own trailer, so a fresh PlayStation page highlighted
    "Marvel's Wolverine" over a PS5 trailer. Removing that hardcoded state
    stopped the page lying but left the rail showing nothing at all.

    This is the other half. The stage announces `hub:stage-idle` whenever the
    trailer stops for ANY reason — ended (playerState 0), ran its
    HUB_RUN_MS, or never started — and the rail selects its first tile.

    Verified in a browser across five cases: nothing selected during the
    trailer; tile 0 after it ends; a visitor's own pick is never overridden;
    reduced motion selects immediately; a hub with no tiles does not throw.
  */
  const hub = readFileSync(join(here, '..', 'src', 'pages', 'featured', '[slug].astro'), 'utf8');

  assert.match(hub, /stage\.dataset\.stageArmed = '1'/,
    'the stage must record that a trailer is genuinely coming, so the rail can tell ' +
      'waiting-for-handover from nothing-will-ever-happen');
  assert.match(hub, /dispatchEvent\(new CustomEvent\('hub:stage-idle'\)\)/,
    'teardown must announce the stage is empty — that is the single signal covering ' +
      'ended, timed out, and never started');
  assert.match(hub, /addEventListener\('hub:stage-idle', handOver\)/,
    'the rail must hand over on every idle. `{ once: true }` was wrong once replay ' +
      'existed — the second trailer would end and hand over to nothing. It is safe ' +
      'to re-run because handOver returns early when a tile is already active, and ' +
      'show() unloads the frame directly rather than through teardown().');
  assert.match(hub, /state === 0 && stage!?\.classList\.contains\('is-playing'\)/,
    'playerState 0 is ENDED, but the player also reports states before it starts — ' +
      'without the is-playing guard a pre-roll report tears the trailer down early');
  assert.match(hub, /if \(cards\.some\(\(c\) => c\.classList\.contains\('active'\)\)\) return;/,
    'a visitor who has already picked a tile must never have the stage yanked away');

  /* The markup must NOT pre-select, or the handover has nothing to hand over to
     and the page is back to claiming a tile is showing when it is not. */
  assert.doesNotMatch(hub, /hub-rail-card \$\{i === 0 \? 'active'/,
    'the rail must not hardcode tile 0 active — that is the bug this replaced');
});

test('a hub never offers a filter for content it does not have', () => {
  /*
    ─── THE GRID THAT EMPTIED ITSELF ───────────────────────────────────────

    ARTICLES and VIDEOS were hardcoded, so every hub offered both regardless
    of what it held. Four of eighteen hold only one kind, and tapping the
    other button emptied the grid with nothing to explain it:

      disney-plus   0 articles, 1 video   -> ARTICLES wiped the page
      a24           0 articles, 1 video   -> ARTICLES wiped the page
      universal     0 articles, 2 videos  -> ARTICLES wiped the page
      xbox          1 article,  0 videos  -> VIDEOS   wiped the page

    Reported as "the featured page filters are just broken", reproduced by
    navigating straight to a hub. From the visitor's side that is exactly
    what an empty grid looks like.

    The row renders only when BOTH kinds are present. One button that can
    only show everything or hide everything is not a filter — that is the
    phantom "Upcoming Events" button again in a different costume.
  */
  const hub = stripComments(
    readFileSync(join(here, '..', 'src', 'pages', 'featured', '[slug].astro'), 'utf8'),
  );

  assert.match(hub, /const showFilters = coverage\.showFilters;/,
    'the page must take the decision from the matcher, not re-derive it');
  assert.match(hub, /\{showFilters && \(\s*<div class="filter-controls/,
    'the filter row must be gated on that, not rendered unconditionally');

  /*
    And the decision itself, exercised rather than pattern-matched. These are
    the four shapes above, in the same order, plus the mixed case that SHOULD
    offer the row.
  */
  const article = (tags) => ({ tags, date: '2026-01-01' });
  const video = (tags) => ({ youtubeTags: tags, publishedAt: '2026-01-01' });
  const hubDoc = { slug: { current: 'probe' }, coverageTags: ['Marvel Studios'] };

  const videoOnly = collectHubCoverage({
    hub: hubDoc, videos: [video(['Marvel Studios'])], articles: [],
  });
  assert.equal(videoOnly.showFilters, false, 'a hub with no articles must not offer ARTICLES');

  const articleOnly = collectHubCoverage({
    hub: hubDoc, videos: [], articles: [article(['Marvel Studios'])],
  });
  assert.equal(articleOnly.showFilters, false, 'a hub with no videos must not offer VIDEOS');

  const empty = collectHubCoverage({ hub: hubDoc, videos: [], articles: [] });
  assert.equal(empty.showFilters, false, 'an empty hub offers nothing at all');

  const mixed = collectHubCoverage({
    hub: hubDoc,
    videos: [video(['Marvel Studios'])],
    articles: [article(['Marvel Studios'])],
  });
  assert.equal(mixed.showFilters, true, 'both kinds present is the one case the row is for');
});

test('no page-wide filter handler survives a client-side navigation', () => {
  /*
    ─── THE DEEP-LINK BUG ──────────────────────────────────────────────────

    Reported from a phone: open an event, tap its "Official Franchise Hub"
    card through to the hub, scroll to the filters, tap ARTICLES. The
    Upcoming Events tile vanished and the buttons could not be deselected.

    Both event components carried an `initEventFilters` that queried
    `document` for `.filter-btn` and `.content-card`. Astro's ClientRouter
    does not unload a page's module when you navigate away, so its
    `astro:page-load` listener kept firing on whatever came next and found
    the HUB's buttons.

    It hid every `.content-card` on the page (the hub's Upcoming Events tile
    is one), and it only ever ADDED `active` with no toggle-off branch, so
    running beside the hub's own handler the two fought over one class. It
    re-bound on every navigation too: it wrote `data-bound` and never read it.

    ─── THE EVENT PAGE HAS FILTERS AGAIN, AND THAT IS FINE ─────────────────

    What made the old handler dangerous was never that it existed, it was
    that it read the whole document. Event pages now render their own
    ARTICLES/VIDEOS row, so three things carry the fix instead:

      the scope is NAMED. The hub section is `data-coverage="hub"`, the
      event section `data-coverage="event"`, and each handler asks for its
      own. A bare `[data-coverage]` on both would reunite them the moment
      ClientRouter kept two modules alive across one navigation — which is
      the original bug wearing the fix as a costume.

      it TOGGLES. `wasActive` is read before anything is cleared.

      it BINDS ONCE. `data-bound` is read, not merely written.
  */
  const scopes = [
    ['EventAnnouncement.astro', 'event', join(here, '..', 'src', 'components', 'EventAnnouncement.astro')],
    ['EventFeatured.astro', 'event', join(here, '..', 'src', 'components', 'EventFeatured.astro')],
    ['featured/[slug].astro', 'hub', join(here, '..', 'src', 'pages', 'featured', '[slug].astro')],
  ];

  for (const [label, scope, path] of scopes) {
    const code = stripComments(readFileSync(path, 'utf8'));

    assert.ok(
      !/document\.querySelectorAll\('\.filter-btn'\)/.test(code),
      `${label} queries .filter-btn page-wide; after a navigation that reaches another page's buttons`,
    );
    assert.ok(
      !/document\.querySelectorAll\('\.content-card'\)/.test(code),
      `${label} queries .content-card page-wide; that is what hid the hub's Upcoming Events tile`,
    );
    /*
      Narrow on purpose. A page-wide query is not itself the bug — the TOC
      scrollspy legitimately reads `[data-event-toc]` across the document,
      and that selector exists on event pages only. The bug is building the
      FILTER's two lists from the document, so that is what is named here.
    */
    assert.ok(
      !/const (?:filterBtns|contentCards) = Array\.from\(document\./.test(code),
      `${label} builds a filter list from the whole document again`,
    );

    assert.ok(
      code.includes(`document.querySelector('[data-coverage="${scope}"]')`),
      `${label} must scope its filter to [data-coverage="${scope}"], not to a bare [data-coverage] ` +
        'that both page types would answer',
    );
    assert.match(code, /const wasActive = btn\.classList\.contains\('active'\)/,
      `${label} must keep the toggle-off branch, or a filter can be set but never cleared`);
    assert.match(code, /dataset\.bound === 'true'/,
      `${label} must READ data-bound, not only write it, or listeners stack up per navigation`);
  }

  /*
    The two scope names must actually differ. Written as one assertion so a
    later "tidy-up" that unifies them fails here rather than on a phone.
  */
  const names = new Set(scopes.map(([, scope]) => scope));
  assert.equal(names.size, 2, 'the hub and the event page must not share one filter scope');
});

test('the coverage filter cannot reach outside the coverage section', () => {
  /*
    ─── THE BUG THIS PINS, WHICH SHIPPED TWICE ───────────────────────────────

    The filter handler used to read the whole document:

      const filterBtns   = Array.from(document.querySelectorAll('.filter-btn'));
      const contentCards = Array.from(document.querySelectorAll('.content-card'));

    Fine while the coverage grid was the only card grid on a hub page. Then
    "Upcoming Events" arrived and broke it from both ends at once.

      THE BUTTON. It shipped as `<button class="filter-btn type-btn active">`
      with no data-filter, purely as a section label. The page-wide query bound
      it anyway, so: click one, `wasActive` is true, every button deactivates
      and this one loses its outline; click two, `wasActive` is false, so the
      handler reads `data-filter || ''` and every .content-card on the page
      gets display:none. Reported as "on click it hides the tile but then it
      does nothing on second click". It is a <SectionHeading /> now.

      THE CARDS. <EventCard /> renders `class="content-card past-event-card"`
      and carries no data-type, so pressing ARTICLES set display:none on every
      upcoming event above the filter. That one was still live after the button
      was fixed: a filter for one section emptying another.

    Both are the same mistake, so this guards the cause rather than the two
    symptoms: the queries must be rooted in the coverage section, and any card
    grid added to this page later is out of their reach by construction.
  */
  const hub = stripComments(
    readFileSync(join(here, '..', 'src', 'pages', 'featured', '[slug].astro'), 'utf8'),
  );

  assert.match(hub, /<section class="content-section" data-coverage="hub">/,
    'the coverage section must be identifiable, or its filters have nothing to scope to');

  assert.ok(
    !/const filterBtns = Array\.from\(document\.querySelectorAll/.test(hub) &&
      !/const contentCards = Array\.from\(document\.querySelectorAll/.test(hub),
    'the filter reads the whole document again. Every .filter-btn and .content-card on the ' +
      'page is in range, including sections that have nothing to do with coverage.',
  );
  assert.ok(
    hub.includes('const coverage = document.querySelector(\'[data-coverage="hub"]\')'),
    'the filter must root itself in the coverage section, by name',
  );
  assert.match(hub, /const filterBtns = Array\.from\(coverage\?\.querySelectorAll/,
    'buttons come from inside the coverage section');
  assert.match(hub, /const contentCards = Array\.from\(coverage\?\.querySelectorAll/,
    'cards come from inside the coverage section');

  /*
    And the label that started it is a heading, not a button. <SectionHeading />
    renders an <h2> — nothing a .filter-btn query can pick up.
  */
  assert.ok(
    !/class="filter-btn[^"]*"[^>]*>\s*UPCOMING EVENTS/i.test(hub),
    'Upcoming Events is a section label. As a .filter-btn it gets bound to the coverage ' +
      'filter and wipes the grid on its second press.',
  );
  assert.match(hub, /<SectionHeading title="Upcoming Events" id="hub-upcoming-heading" \/>/,
    'the label is a ruled section heading, the same furniture /events uses for Past Event Archive');
});

test('the hero jump link points at a heading that exists', () => {
  /*
    The hero's second control is an ANCHOR to the Upcoming Events heading on
    the same page, not a button and not a filter. That distinction is the whole
    fix above. Two things have to stay true or it silently goes nowhere: the
    href and the id must agree, and the section must actually render.

    No scroll offset is set here on purpose. global-base.css carries
    `scroll-padding-top: 112px` on html, which is what keeps the heading clear
    of the fixed header. Measured landing position: 112px from the top.
  */
  const hub = readFileSync(join(here, '..', 'src', 'pages', 'featured', '[slug].astro'), 'utf8');

  assert.match(hub, /href="#hub-upcoming-heading"/, 'the jump link needs a destination');
  assert.match(hub, /id="hub-upcoming-heading"/, 'the destination must exist on the page');

  /* Rendered only where the hub HAS an upcoming event. A hub with none would
     otherwise show a control that scrolls to nothing. */
  const jumpAt = hub.indexOf('hero-events-jump');
  assert.ok(jumpAt > 0, 'the jump link is gone');
  assert.match(hub.slice(0, jumpAt).slice(-1500), /associatedUpcomingEvents\.length > 0 && \(/,
    'the jump link must be gated on the hub actually having an upcoming event');

  /* Same rectangle as Play trailer. They are peers in one row, so the visual
     rules live on the shared class and neither can drift from the other. */
  assert.match(hub, /class="hero-action-btn hero-events-jump"/,
    'the jump link wears the shared action-button class, so it matches Play trailer exactly');
  assert.match(hub, /\.hero-actions \{[^}]*display: flex/,
    'the two hero controls sit in one flex row');
});


test('the card meta is one line of text, not three flex boxes', () => {
  /*
    ─── THE STRANDED BULLET ────────────────────────────────────────────────

    Reported from a phone. The meta row was a flex row of three spans, and a
    flex item is a BOX: one that wraps internally keeps the width of its
    LONGEST line. So at 393px "Convention & Expo" broke to "CONVENTION &" /
    "EXPO", the box stayed 112px wide, and the bullet and year began after
    that box, vertically centred against its 36px height. Measured: bullet at
    x=281 against a label box ending at x=275, beside a second line only 12px
    of which was ink. They read as belonging to nothing.

    It is a single line of metadata, so it flows as text. A long label now
    wraps mid-phrase and the date follows immediately after it, which is what
    running text does: "INDUSTRY" / "AWARDS • 2026".
  */
  const card = readFileSync(join(here, '..', 'src', 'components', 'EventCard.astro'), 'utf8');

  const meta = /\n  \.past-event-meta \{([^}]*)\}/.exec(card);
  assert.ok(meta, '.past-event-meta is gone; this test no longer reads what it thinks it does');
  assert.doesNotMatch(meta[1], /display: flex/,
    'a flex row makes each part a box, and a box that wraps strands what follows it');
  assert.match(meta[1], /display: block/, 'the three parts are one line of text');

  /*
    THE SEPARATOR TRAVELS WITH THE DATE. Otherwise the other bad break is
    available: a line ending on a dangling bullet.
  */
  assert.match(card, /<span class="past-event-meta-date">/,
    'the bullet and the date must be one unit');
  assert.match(card, /\.past-event-meta-date \{[^}]*white-space: nowrap/,
    'that unit must never break internally');

  /*
    AND ITS GAP IS A MARGIN, not the whitespace between two spans: Astro
    collapses that at build time and the pair rendered as "Convention• 2026".
  */
  assert.match(card, /\.past-event-meta-date \{[^}]*margin-left: 0\.4rem/,
    'the gap has to survive Astro collapsing markup whitespace');
});

test('the event type label stays short enough for a card', () => {
  /*
    "Convention & Expo" was the longest label by a wide margin and the only
    one that wrapped at 393px. The structural fix above means a long label
    degrades gracefully rather than breaking, but the label is also just
    better short: naming both halves was the convention/expo merge
    apologising for itself.

    The VALUE is untouched — it is stored on fourteen documents and renaming
    it would be a migration for no gain.
  */
  assert.equal(EVENT_TYPE_LABELS['convention-expo'], 'Convention',
    'the merged type displays as plain "Convention"');
  for (const [value, label] of Object.entries(EVENT_TYPE_LABELS)) {
    assert.ok(
      label.length <= 16,
      `"${label}" (${value}) is ${label.length} chars; at 0.2em tracking that is a ` +
        'second line on a phone card',
    );
  }
});
test('an event card says what the event is, and promises only what it can keep', () => {
  /*
    ─── THE EYEBROW ──────────────────────────────────────────────────────────

    It was the literal string "Event" on every card. That is a placeholder in
    the shape of metadata: all nineteen events in the store carry an
    `eventType`, and the hero tag on the event's own page has been reading it
    the whole time, so a premiere said EVENT on the card and PREMIERE one click
    later.

    `getEventTypeLabel` is the resolver those pages already use, and it falls
    back to 'Event' for an unset type, so a card with no type renders the exact
    string it used to. Nothing to special-case.

    ─── THE CTA ──────────────────────────────────────────────────────────────

    "View Coverage" is a promise. On an UPCOMING event it is one nobody has
    made yet: whether it gets covered is not decided when the card renders, and
    the hub list is the only place this card shows events that have not
    happened. Past events are the opposite case, and the archive keeps the
    words it earned.
  */
  const card = readFileSync(join(here, '..', 'src', 'components', 'EventCard.astro'), 'utf8');
  const lib = readFileSync(join(here, '..', 'src', 'lib', 'events.ts'), 'utf8');

  assert.doesNotMatch(card, /<span>Event<\/span>/,
    'the eyebrow is hardcoded again. The store knows what kind of event this is.');
  assert.match(card, /getEventTypeLabel/,
    'the eyebrow must come from the same resolver the event page hero uses, or the two drift');
  assert.match(card, /<span>\{typeLabel\}<\/span>/, 'the resolved label is what renders');

  /* The fallback is what makes this safe to apply to every caller. If it ever
     stops returning 'Event' for an unset type, cards with no type go blank. */
  assert.match(lib, /return 'Event';/,
    'getEventTypeLabel must still fall back to "Event"; without it an untyped card has no eyebrow');

  assert.match(card, /\{wide \? 'Event Details' : 'View Coverage'\}/,
    'an upcoming event cannot advertise coverage that has not been committed to; a past one should');
});

test('the hub events list is a list, and its card is anchored at both ends', () => {
  /*
    ─── WHY THIS IS NOT A GRID ───────────────────────────────────────────────

    The section shipped with `.event-grid`'s own track rule, copied from
    /events: `repeat(auto-fill, minmax(min(100%, 420px), 1fr))`. Right there,
    where the Past Event Archive has dozens of entries and fills every track.

    A hub has one upcoming event, sometimes two. In a 3-up grid that put a
    single card in the left third with two empty tracks beside it, which reads
    as an orphan rather than a section. `auto-fit` was the obvious swap and is
    worse: it lets the COUNT pick the layout, so the same card is full width on
    a hub with one event and half width on a hub with two.

    One column, always, and <EventCard wide /> to use the width rather than
    merely span it. Three upcoming events then stack into three rows, which is
    what a schedule looks like.
  */
  const hub = readFileSync(join(here, '..', 'src', 'pages', 'featured', '[slug].astro'), 'utf8');
  const card = readFileSync(join(here, '..', 'src', 'components', 'EventCard.astro'), 'utf8');

  const gridRule = /\.hub-events-grid \{([^}]*)\}/.exec(hub);
  assert.ok(gridRule, 'the upcoming events container lost its rule');
  assert.doesNotMatch(gridRule[1], /grid-template-columns/,
    'the upcoming events list is back to a multi-track grid. With one event that is a card ' +
      'stranded in the left third; with two it is a different card again.');
  assert.match(gridRule[1], /flex-direction: column/, 'one full-width row per event');

  assert.match(hub, /<EventCard event=\{e\} index=\{index\} wide \/>/,
    'the hub list needs the wide variant, or a full-width card hugs the left edge with a ' +
      'thousand pixels of nothing after it');

  /*
    ─── TWO ANCHORS, NOT THREE ───────────────────────────────────────────────

    `justify-content: space-between` distributes CHILDREN, so with meta, title
    and CTA as three siblings the title landed dead centre with a gulf either
    side — the orphan problem again, moved inside the card. .past-event-text
    groups the identity so the row has one end and one action.
  */
  assert.match(card, /<div class="past-event-text">/,
    'meta and title must be one block, or space-between strands the title mid-row');
  assert.match(card, /\.past-event-card--wide \.past-event-body \{[^}]*justify-content: space-between/,
    'the wide row anchors its two ends');

  /*
    ─── THE ARCHIVES MUST NOT NOTICE ─────────────────────────────────────────

    /events and /events/archive render this same card and pass nothing. Their
    grid geometry was measured before and after the wide variant landed and is
    identical to the pixel; `wide` defaults to false and every rule it adds is
    behind .past-event-card--wide.
  */
  assert.match(card, /const \{ event, index = 0, wide = false \} = Astro\.props;/,
    'wide must default off, or the two archive grids inherit a layout built for one card');
  const wideRules = card.match(/^\s*\.past-event-card--wide[^{]*\{/gm) ?? [];
  assert.ok(wideRules.length >= 3, 'the wide layout should be expressed as its own modifier rules');
  const bodyRule = /\n  \.past-event-body \{([^}]*)\}/.exec(card);
  assert.ok(bodyRule, 'the shared body rule is gone');
  assert.match(bodyRule[1], /flex-direction: column/,
    'the SHARED body must stay a column. The wide row overrides it behind its own modifier; ' +
      'changing it here changes /events and /events/archive too.');

  /* An inline style cannot be overridden by a class, which is why the CTA's
     margin had to come out of the markup for the wide row to close that gap. */
  assert.doesNotMatch(card, /class="watch-now-btn" style=/,
    'the CTA margin belongs in CSS; inline, the wide variant cannot reach it');
});

test('the hub trailer can be played again without a reload', () => {
  /*
    The trailer used to play exactly once. `initHubStage` is guarded by
    `stageInit`, `teardown()` unloads the frame to about:blank, and nothing
    re-armed — so the only replay was a refresh, or leaving and returning
    (ClientRouter swaps the DOM, which clears the guard). Measured:

      first load:        frameSrc = https://www.youtube-nocook…
      after it ends:     frameSrc = about:blank
      re-fire page-load: frameSrc = about:blank        <- no replay
      after re-navigate: frameSrc = https://www.youtube-nocook…

    Arming is a function now so replay is a second CALL, not a second code
    path. teardown() already leaves exactly the state arm() expects.

    PLACEMENT WAS THE HARD PART, and it took three attempts.

    1. Over the hub's mark. Unpressable: the handover puts a rail pane up the
       instant the trailer ends, so `is-item` is on from then on and a control
       behind that pane can never be reached. A test pressed it and found
       nothing clickable.
    2. The stage's top-right corner, sharing the sound toggle's slot. That is
       pressable, and it was still wrong. Reported from a phone as confusing:
       the stage shows a RAIL CARD almost all of its life, so a pill reading
       TRAILER sat in the corner of the Wolverine card, which carries its own
       PLAY button. Two play affordances on one image, for two different
       videos.
    3. The copy column, beside Read more. The button replays the HUB's
       trailer, so it belongs with the hub's identity, not with whatever the
       stage happens to be showing. Out there it cannot overlap the stage at
       any breakpoint or in any state.

    So this test pins the thing that went wrong twice: the control must NOT be
    a descendant of .hub-stage.
  */
  const hub = readFileSync(join(here, '..', 'src', 'pages', 'featured', '[slug].astro'), 'utf8');

  /* Allows extra parameters: arm() grew a `withSound` argument so a replay the
     visitor pressed can start unmuted, while the automatic first play stays
     muted (the only state a browser will start on its own). What matters is
     that arming is a CALLABLE, not its exact arity. */
  assert.match(hub, /const arm = \(delay: number[^)]*\) =>/,
    'arming must be a callable function — inline, the trailer can only ever play once');
  assert.match(hub, /arm\(HUB_LEAD_IN_MS\)/, 'the first play waits, so the mark is seen before it dissolves');
  /* `arm(0)` or `arm(0, true)` — no lead-in either way. The second argument
     asks for sound, which a replay is entitled to because the visitor pressed
     a button and that counts as activation. */
  assert.match(hub, /arm\(0[,)]/, 'a replay the visitor asked for starts immediately');

  /* Class LIST, not the whole attribute. The button gained .hero-action-btn
      when the hero grew a second control beside it (the Upcoming Events jump);
      .hub-stage-replay is the behaviour hook the click handler and the
      is-playing rule both key off, and it has to survive that. */
  assert.match(hub, /class="[^"]*\bhub-stage-replay\b/, 'there must be a control');

  /*
    ─── IT MUST NOT LIVE ON THE STAGE ────────────────────────────────────────

    Slice from the stage's opening tag to its close and assert the button is
    not in there. Both failed placements were inside this element.
  */
  /* Matched on the class LIST, not on an exact attribute string. This read
     `class="hero-trailer hub-stage animate-on-scroll"` verbatim, so removing
     `animate-on-scroll` from the stage for LCP reasons -- a change with
     nothing to do with what this test guards -- broke it, and the failure
     said the markup had moved rather than that a class had. */
  const stageMatch = /class="[^"]*\bhero-trailer\b[^"]*\bhub-stage\b[^"]*"/.exec(hub);
  const stageOpen = stageMatch ? stageMatch.index : -1;
  assert.ok(stageOpen > 0, 'could not find the stage element; this test is no longer reading the markup');
  const stageMarkup = hub.slice(stageOpen, hub.indexOf('</section>', stageOpen));
  assert.ok(
    !stageMarkup.includes('hub-stage-replay'),
    'the replay control is inside .hub-stage again. On the stage it reads as a control for ' +
      'whatever the stage is showing, which is a rail card with its own PLAY button almost ' +
      'all of the time. It belongs in the copy column with the hub identity.',
  );

  /*
    ─── NAMED FROM ITS OWN CONTENT ───────────────────────────────────────────

    WCAG 2.5.3 (Label in Name) wants the accessible name to CONTAIN the visible
    text. The old aria-label was "Replay the <hub> trailer" against visible
    text "Trailer" — fine — but the visible text is "Play trailer" now, and
    "Replay the PlayStation trailer" does not contain "play trailer". So the
    name comes from content plus an sr-only suffix instead.
  */
  assert.ok(
    !/class="[^"]*\bhub-stage-replay\b[^"]*"[^>]*aria-label/.test(hub),
    'an aria-label here replaces the name built from the visible words. Name it from content.',
  );
  assert.match(hub, /<span class="hub-stage-replay-text">Play trailer<\/span>/,
    'the visible words are what a speech-input user will say');
  assert.match(hub, /<span class="sr-only"> for \{event\.title\}<\/span>/,
    'the hub name belongs in the accessible name, after the visible text so it still contains it');

  /* Hidden while the trailer runs. Matched from the shared ancestor now that
     the button is not a descendant of the stage. */
  assert.match(hub, /\.hero-grid-container:has\(\.hub-stage\.is-playing\) \.hub-stage-replay \{\s*display: none/,
    'replay must vanish while the trailer plays; the old .hub-stage.is-playing selector ' +
      'cannot match a button that is no longer inside the stage');

  /*
    ─── GATED ON A TRAILER, NOT ON ANY PLAYABLE VIDEO ────────────────────────

    hasPlayableVideo is also true for a hub with no trailer that merely has a
    video in its rail, and initHubStage returns early on !stage.dataset.trailer
    — so such a hub would render a button that does nothing. Every hub has a
    trailer today, which is precisely why this would have shipped unnoticed.
  */
  assert.match(hub, /\{trailerId && \(/,
    'the replay control must be gated on trailerId');
  assert.ok(
    !/\{hasPlayableVideo && \(\s*\/\*[\s\S]{0,400}?WATCH IT AGAIN/.test(hub),
    'the replay control is gated on hasPlayableVideo again, which renders a dead button ' +
      'on a hub whose only videos are in the rail',
  );

  /* Replay while a tile is showing has to clear the rail, or the page is back
     to a highlighted tile over a trailer that is not it. */
  assert.match(hub, /dispatchEvent\(new CustomEvent\('hub:stage-replay'\)\)/,
    'the stage must ASK the rail to stand down rather than setting card state itself');
  assert.match(hub, /addEventListener\('hub:stage-replay'/, 'and the rail must answer');
});

test('the calendar dialog does not land on its own close button', () => {
  /*
    Reported as "a red box around the X that should not be there on desktop,
    iPad or iPhone". It was the keyboard focus ring, painted on every open
    before anyone touched anything.

    Nothing in the component focuses the button: `showModal()` focuses the
    first focusable child, and browsers treat that as keyboard-style focus, so
    `:focus-visible` matched. Measured on the built page: outline
    "2px solid rgb(204, 0, 0)", focusVisible true, immediately on open.

    A `tabindex="-1"` container takes focus without painting a ring, so focus
    still moves into the dialog — which screen readers, Escape and <dialog>'s
    native Tab trapping all depend on — without looking focused.
  */
  const modal = readFileSync(join(here, '..', 'src', 'components', 'SpanningCalendarModal.astro'), 'utf8');
  assert.match(modal, /class="modal-inner" tabindex="-1" autofocus/,
    'the dialog needs a non-button landing spot, or showModal() paints a focus ring on the X');
  assert.match(modal, /\.modal-inner:focus-visible \{\s*outline: none/,
    'the landing spot must not paint a ring of its own');
  assert.match(modal, /\.close-btn:focus-visible \{/,
    'the X must STILL show a ring when a keyboard user Tabs to it — that is not the bug');
});

test('the deck nav rail is operable from a keyboard', () => {
  /*
    These were <div>s carrying a click handler, so Tab went from the row
    heading straight past the entire rail. A <div> is a plain box; browsers
    only put genuinely interactive elements in the tab order, and one that
    merely BEHAVES like a button when clicked is not one. WCAG 2.1.1.

    Never a dead end — the deck cards are real <a>s, so every hub stayed
    reachable — but the rail is the fast way to switch and a keyboard user
    simply did not have it.

    Verified in a browser after the change: Tab reaches all four thumbs,
    each announces as `button` named "Show <hub>", Enter moves the deck, and
    the focus ring computes to rgb(239,69,69).
  */
  const thumb = src.slice(src.indexOf('deck-nav-track'), src.indexOf('</div>', src.indexOf('deck-nav-track')));
  assert.match(thumb, /<button\s+type="button"/,
    'the rail thumbs must be real <button>s — a div with a click handler is not focusable');
  assert.doesNotMatch(thumb, /<div class={`deck-nav-thumb/,
    'a div thumb is the regression this pins');
  assert.match(thumb, /aria-label={`Show \$\{brand\.title\}`}/,
    'an icon-only button needs an accessible name');
  assert.match(thumb, /aria-current=/, 'which thumb is showing must be announced, not only painted');

  const style = styleBlock();
  /* A <button> inherits a UA font, colour, alignment and radius. Without
     these the rail rendered in the system font with rounded corners. */
  for (const reset of ['font: inherit', 'color: inherit', 'text-align: inherit', 'border-radius: 0']) {
    assert.ok(style.includes(reset),
      `.deck-nav-thumb must reset \`${reset}\` — buttons carry user-agent defaults a div does not`);
  }
  assert.match(style, /\.deck-nav-thumb:focus-visible/,
    'being focusable is no use if you cannot see where you are');

  /* renderDeck paints the class; aria-current is the announcement. Both have
     to move together or a screen reader keeps naming the previous hub. */
  assert.match(src, /setAttribute\('aria-current', 'true'\)/, 'renderDeck must set aria-current');
  assert.match(src, /setAttribute\('aria-current', 'false'\)/, 'and clear it');
});

test('the picker publishes variables; the scoped rules read them', () => {
  /*
    THE PICKER SET font-family AND LOST EVERY TIME.

    Its rules live in an inline <style> in the head. The `.accordion-title`
    rules they had to beat live in this component's SCOPED block, which Astro
    rewrites to `.accordion-title[data-astro-cid-…]` — one class plus one
    attribute, the same 0,2,0 as `[data-title-font='x'] .accordion-title`. The
    scoped sheet is emitted second, so the tie went to the base rule.

    Measured in dev with getComputedStyle before the fix: thirteen of the
    seventeen faces left the title in the previously-selected face, and the
    weight and tracking never moved for ANY of them. Four appeared to work,
    and only because a stale duplicate of the scoped block still hardcoded
    exactly those four further down the same sheet.

    Custom properties do not have that fight: they inherit, and the scoped
    rules opt in by reading them. Losing that indirection reinstates the bug
    silently, so it is pinned from both ends.
  */
  const fontCssAt = src.indexOf('const fontCss');
  // The CLOSING frontmatter fence. Searched from fontCss, not from 0 — the
  // first `---` in the file is the OPENING fence and the slice comes back empty.
  const gen = src.slice(fontCssAt, src.indexOf('\n---', fontCssAt));
  assert.match(gen, /--accordion-title-face:/, 'the picker must publish the face as a variable');
  assert.match(gen, /--accordion-title-weight:/, 'and its weight');
  assert.match(gen, /--accordion-title-tracking:/, 'and its tracking');
  assert.doesNotMatch(
    gen,
    /^\s*font-family:/m,
    'the generated rules must NOT set font-family — the scoped .accordion-title ' +
      'rule ties on specificity and is emitted later, so it wins and the picker ' +
      'does nothing',
  );

  const style = styleBlock();
  assert.match(
    style,
    /font-family: var\(\s*--accordion-title-face,/,
    '.accordion-title must read the picker variable, with the original stack as ' +
      'its fallback so a face that never arrives leaves the row untouched',
  );
  assert.match(style, /font-weight: var\(--accordion-title-weight,/,
    'the weight must come from the face, or a display face with one cut is synthesised');

  /*
    The demo-mode selector is gated on `[data-title-font='demo']` deliberately.
    Ungated, a per-row variable set on the title ELEMENT beats the picker's
    value inherited from <main>, and picker mode silently keeps showing the
    per-row demo assignment instead of the face that was pressed.
  */
  assert.match(
    gen,
    /\[data-title-font='demo'\] \.accordion-title\[data-demo-font=/,
    "demo-mode rules must be gated on [data-title-font='demo'] or picker mode cannot win",
  );
});

test('the featured stylesheet is not carrying a second copy of itself', () => {
  /*
    HOW THIS PAGE ACQUIRED A STALE TWIN.

    `feat(featured): one layout at every size` COPIED the desktop block rather
    than moving it, and the copy — an older revision, from
    `fix(featured): stop painting on the video` — was left LATER in the same
    sheet, where it quietly won. It reverted `.brand-stage` from the full plate
    back to the old two-column insets, put `.brand-stage-mark` back to 74%, and
    kept the four hardcoded per-face rules that made the typeface picker look
    like it half-worked. About 1,500 lines, silently in charge, for four days.

    These three counts are the cheapest thing that would have caught it: each
    belongs to a block that exists once by construction, and a duplicated
    region takes all three above one. Rules that are deliberately declared
    twice — the unwrapped "ONE LAYOUT, EVERY SIZE" overrides at the end — are
    not among them.
  */
  const style = styleBlock();
  /* Anchored to the start of a line, so a selector that merely ENDS in the
     name (`…:not([data-title-font='demo']) .accordion-title-demo-label`) is
     not counted as a second declaration of it. */
  const count = (selector) =>
    (style.match(new RegExp(`^\\s*\\${selector} \\{`, 'gm')) ?? []).length;

  assert.equal(count('.font-picker-btn'), 1,
    'the picker is styled in one place; a second copy means a duplicated region');
  assert.equal(count('.font-picker'), 1,
    'the picker is positioned in one place');
  assert.equal(count('.accordion-title-demo-label'), 1,
    'the demo label is styled in one place');

  /*
    And the orphan the same merge left behind: a `to { … }` with no
    `@keyframes` opening it, which a parser reads as a rule for a nonexistent
    <to> element followed by a stray brace. Inert, but it is how the block
    ended up unbalanced, and an unbalanced block is how a parser swallows the
    rules after it.
  */
  assert.doesNotMatch(style, /^\s*to \{/m,
    'an orphaned keyframe step — @keyframes was removed and its body left behind');
});

test("a hub's empty state carries no mark of ours", () => {
  /*
    The deck card used `.article-thumb-fallback`, and home-cards.css paints
    `--brand-fallback-mark` — this site's own logo — as a background on that
    class. Correct on our content cards; wrong on a hub tile, where it put BE
    UNCONVENTIONAL across PlayStation's artwork slot as though it were
    PlayStation's. Exactly the mistake that backing a hub with a video
    thumbnail made, in a different place.
  */
  assert.doesNotMatch(src, /article-thumb-fallback/,
    "a hub tile must not borrow the site's own fallback mark");
  assert.match(src, /deck-card-empty/, 'the empty state is the hub tile\'s own');
  const block = src.slice(src.indexOf('.deck-card-empty {'));
  const decl = block.slice(0, block.indexOf('\n  }'));
  assert.match(decl, /--brand-rgb/, "the empty state is tinted by the HUB's colour");
  assert.doesNotMatch(decl, /brand-fallback-mark|logo/, 'no mark of ours on it');
});

test('the row that is already open arms its own trailer', () => {
  /*
    syncTrailers() ran only from renderDeck() and the header click, and neither
    fires on load. The first row is expanded in the markup, so its trailer was
    never armed until something was clicked: reported as the video failing to
    start on DC until you switched to Marvel and back. Nothing was broken about
    playback — nothing had asked it to play.
  */
  const init = src.slice(src.indexOf('function initAccordionAndDecks'), src.indexOf('function initFontPicker'));
  const lastBrace = init.lastIndexOf('\n  }');
  const afterLoop = init.slice(init.lastIndexOf('});', lastBrace), lastBrace);
  assert.match(afterLoop, /syncTrailers\(\)/,
    'syncTrailers() must run once at init, not only from the click handlers');
});

test("the hub's mark scales with its artwork, not in fixed pixels", () => {
  /*
    A flat pixel height cannot be right at more than one screen size, and this
    was 26px everywhere: 11% of the card's height on a phone, which reads
    correctly, but 4.8% on an iPad and 4% on a 2000px display — which is what
    "way too small" was describing. The phone looked fine because the card is
    small there; the logo had not grown, the card had.

    It got that way from unwrapping the phone-only media query into the base
    layout: `height: 26px` was written for a 414px card and inherited by a
    1145px one.

    .deck-stack is a size container and .deck-card already measures against it,
    so the mark does too. Measured after: 10.5-11.2% of card height at 440,
    1024, 1366, 1512 and 2000 wide, with the phone unchanged.
  */
  const block = src.slice(src.indexOf('.deck-card-logo {'));
  const decl = block.slice(0, block.indexOf('\n  }'));
  assert.doesNotMatch(decl, /height: \d+px;/, 'a fixed pixel height is wrong at every size but one');
  assert.match(decl, /cqh|cqw/, 'the mark must measure against the card it sits on');
  assert.match(decl, /clamp\(/, 'it needs a floor for the phone and a ceiling for a huge display');

  // The override that was actually winning must stay gone.
  assert.ok(
    !/\.deck-card-logo \{\s*height: 26px;/.test(src),
    'the flat 26px override applied at EVERY width once the query was unwrapped',
  );
});

test('the hub hero rail never cuts a card at any edge', () => {
  /*
    Reported twice: the leftmost card cut off on DC, the rightmost on Marvel,
    and worse once selected — the active card scales 1.06, so parked flush it
    reaches further into the clip than it did at rest.

    Three things, each of which was individually broken:

    1. `overflow-x: auto` computes `overflow-y` to `auto` too, so the rail
       clips on all four sides. It needs padding on all four, not just the
       bottom.
    2. The fade must ramp ONLY where there is more to scroll to. A fixed ramp
       cannot tell "more over there" from "this is the end", so it dims a card
       that is simply the last one. Both ramps default to 0%. This is the same
       construct as the deck rail on /featured, where a fixed 10%/90% ramp made
       two of five hubs look permanently disabled.
    3. Bringing a card into view must be measured from bounding rects. The rail
       is not positioned, so a card's offsetParent is elsewhere and offsetLeft
       is not rail-relative — scrolling back to the FIRST card silently did
       nothing while scrolling to the last worked.

    Verified in a browser: every card selected in turn, on four viewports, on a
    hub with one item and one with five. None clipped.
  */
  const hub = readFileSync(join(here, '..', 'src', 'pages', 'featured', '[slug].astro'), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  /*
    `\n  .hub-rail {` — the BASE rule at two-space indent. A bare
    `.hub-rail {` also matches the tail of
    `.hero-grid-container.has-stage .hub-rail {` inside the media query,
    which is indented four spaces, so the slice ran past its close and read the
    wrong declarations entirely. The assertion failed against a rule that was
    perfectly correct.
  */
  const railStart = hub.indexOf('\n  .hub-rail {');
  assert.ok(railStart > -1, 'the base .hub-rail rule must exist');
  const rail = hub.slice(railStart + 1);
  const decl = rail.slice(0, rail.indexOf('\n  }'));
  assert.doesNotMatch(decl, /padding-bottom: \d+px;\s*$/m, 'padding must be on all four sides');
  assert.match(decl, /padding: \d+px;/, 'a clipped rail needs room on every side');
  assert.match(decl, /--rail-fade-start, 0%/, 'the start ramp must default to zero');
  assert.match(decl, /--rail-fade-end, 0%/, 'the end ramp must default to zero');

  /*
    BOUNDED TO initHubRail, not sliced to the end of the file.

    The open-ended slice was fine only while the rail happened to be the last
    thing in the module. It is not any more: initHubPlay() sits below it and
    scrolls the STAGE into view with `behavior: 'smooth'`, which is a vertical
    scroll of the page and has nothing to do with the rail's fade. Read to the
    end and this test failed on a line it was never written about.
  */
  const railFrom = hub.indexOf('function initHubRail');
  assert.ok(railFrom > -1, 'the rail must initialise itself');
  const js = hub.slice(railFrom, hub.indexOf('\n  }', hub.indexOf('function initHubPlay')) > -1
    ? hub.indexOf('function initHubPlay')
    : undefined);
  assert.match(js, /scrollWidth - rail\.clientWidth/, 'the fade must know whether the rail overflows');
  assert.match(js, /getBoundingClientRect/, 'bring-into-view must not rely on offsetLeft');
  assert.doesNotMatch(js, /offsetLeft/, 'offsetLeft is not rail-relative here — it broke scrolling to the first card');
  assert.doesNotMatch(js, /behavior: 'smooth'/, 'a smooth scroll leaves the fade computing against a stale position');
});

test('the hub hero plays in its own panel, never in the modal', () => {
  /*
    The rail's Play button used the site's global [data-action="open-video"]
    handler, which opens the full-screen modal. Right for a card in a feed;
    wrong here, because this panel IS the player — a video launching a popup
    out of it reads as the page losing its place.

    The coverage feed BELOW the hero still uses the modal, which is correct.
    Only the hero's own action changed.

    Verified in a browser on iPhone and desktop, across three hubs: pressing
    Play leaves the modal closed, sets is-playing, and loads the embed into the
    stage's own frame.
  */
  const hub = readFileSync(join(here, '..', 'src', 'pages', 'featured', '[slug].astro'), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  const hero = hub.slice(hub.indexOf('hub-stage-item-copy'), hub.indexOf('</section>'));
  assert.doesNotMatch(hero, /data-action="open-video"/,
    'the hero must not hand its video to the full-screen modal');
  assert.match(hub, /data-hub-play=/, 'the hero plays in its own stage');
  assert.match(hub, /stage\.classList\.add\('is-playing'\)/, 'pressing play must reveal the stage frame');

  /*
    The frame must exist whenever ANYTHING can play in it, not only when the
    hub has its own trailer — a hub with no trailerUrl but a video in its rail
    still needs somewhere to play, and without this its Play button had no
    frame and fell back to the modal.
  */
  assert.match(hub, /hasPlayableVideo/, 'the frame is gated on any playable video, not just the trailer');

  /*
    NOTHING IS PAINTED OVER THE VIDEO. The caption guard is gone: it was
    covering picture on trailers whose letterbox it had been sized against, and
    YouTube's own UI showing is now accepted.
  */
  assert.doesNotMatch(hub, /hub-stage-guard/, 'no bar may cover the picture');
});

test('a hidden hub leaves the live site but stays visible in dev', () => {
  /*
    An unfinished hub should not be on the live site, but it must stay in front
    of the person finishing it — otherwise the only way to work on one is to
    keep toggling it back on.

    EXPLICIT, not inferred from whether a hub "has content". That was the other
    option and it is the wrong one: "no content" is ambiguous (no logo? no key
    art? no tagged videos?) and today almost every hub has artwork pending but
    zero tagged coverage, so an automatic rule would hide hubs that are ready.

    Verified against real builds: with `hidden: true` on PlayStation, the hub
    left /featured AND /featured/playstation stopped generating, while the
    Gaming row survived with Nintendo and Xbox. Unsetting it restored both.
  */
  const lib = readFileSync(join(here, '..', 'src', 'lib', 'local-content.ts'), 'utf8');
  const fn = lib.slice(lib.indexOf('export function getFeaturedBrandsLocal'));
  const body = fn.slice(0, fn.indexOf('\n}'));
  assert.match(body, /import\.meta\.env\.DEV/, 'dev must show every hub regardless of the flag');
  assert.match(body, /d\.hidden !== true/, 'a production build must drop hidden hubs');

  /*
    An empty CATEGORY is structurally impossible, which is what makes this safe:
    /featured derives its rows FROM the hubs (group by hubCategory, take the
    keys), so a category whose hubs are all hidden has no key and never renders.
  */
  assert.match(src, /brands\.reduce/, 'rows are derived from the hubs, never a fixed list');
  assert.match(src, /Object\.keys\(groupedBrands\)/, 'a category with no hubs has no key');
  assert.match(src, /--rows: \$\{sortedCategories\.length\}/,
    'the accordion must size from the rows that survive, not a constant');
});

test('the hub rail centres, and cannot strand its first thumbnail', () => {
  /*
    The rail defaulted to flex-start, so a category with two or three hubs left
    its thumbnails jammed against the far left of a wide screen while the
    poster sat centred above them. Measured after the fix: rail group centre
    within 1px of the poster centre at 430, 1512 and 2000 wide.

    `safe center` is load-bearing, not a flourish. Plain `center` on a
    scrolling flex row is a known trap: once the contents overflow, the
    overflow is pushed past the container's START edge, and that direction
    cannot be scrolled to — the first thumbnails become permanently
    unreachable. `safe` reverts to flex-start exactly when overflow begins.
  */
  const i = src.indexOf('.deck-nav-track {');
  const decl = src.slice(i, src.indexOf('\n  }', i));
  assert.match(decl, /justify-content: safe center/, 'the rail must centre safely');
  assert.match(decl, /justify-content: center;[\s\S]*justify-content: safe center/,
    'plain center must be declared FIRST as the fallback for browsers without `safe`');
  assert.match(decl, /overflow-x: auto/, 'the rail still scrolls when it overflows');
});

test('the hub hero is the deck page\'s stage, and keeps its own height', () => {
  /*
    The hub hero is now the 50/50 that /featured used to carry: copy on the
    left, the hub's mark on the right dissolving to its trailer, with a
    feathered middle instead of a column boundary.

    THE HERO MUST NOT BE VIEWPORT-HEIGHT. An earlier attempt set it to
    `calc(100lvh - header)`, which is ~1286px on an iPad Pro portrait holding
    maybe 400px of content — reported as completely broken on both a tablet and
    a phone, and it was. Measured after this rebuild: 70% of the viewport on
    iPad portrait, iPad landscape, iPhone 17 Pro Max and desktop.
  */
  const hub = readFileSync(join(here, '..', 'src', 'pages', 'featured', '[slug].astro'), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  const hero = hub.slice(hub.indexOf('.event-hero {'));
  const hdecl = hero.slice(0, hero.indexOf('\n  }'));
  assert.doesNotMatch(hdecl, /height:\s*calc\(100lvh/, 'a viewport-height hero is a wall of nothing on a tablet');
  assert.doesNotMatch(hdecl, /position: sticky/, 'the pinned hero was reverted — it needs a different construction');

  // The stage, and the reasons it can exist here at all.
  assert.match(hub, /hub-stage-mark/, 'the mark is the resting state');
  assert.match(hub, /hub-stage-iframe/, 'the trailer exists');
  assert.match(hub, /src="about:blank"/, "HARD RULE 4: never src=''");
  assert.doesNotMatch(hub, /\.src\s*=\s*['"]{2}/, "HARD RULE 4: never assign src = ''");
  assert.match(hub, /enablejsapi=1/, 'the state channel must be open');
  assert.match(hub, /state === 1/, 'reveal only on a CONFIRMED playing state');
  assert.doesNotMatch(hub, /setTimeout\(reveal/, 'a timed reveal is what showed a paused player');

  // HARD RULE 3: the clipping plate is a SIBLING of the iframe, never above it.
  const stage = hub.slice(hub.indexOf('.hub-stage {'));
  assert.doesNotMatch(stage.slice(0, stage.indexOf('\n  }')), /overflow: hidden/,
    'nothing between the iframe and the page may clip');

  /*
    ─── ONE BACKDROP LAYER, NOT TWO ─────────────────────────────────────────

    This used to assert the OPPOSITE: a second `.hub-stage-bg` plate, masked
    into the right-hand side and feathered across the middle into the backdrop
    behind it. Two copies of one picture at two scales show the same shapes
    twice out of register, which is what "a blob of images meshing" was, and
    `contain` on the wide banners left lit bare ground either side of the plate.

    Reverting that is a design decision the owner made after seeing it on the
    real artwork, so the guard is inverted rather than deleted: the layer must
    stay gone, or the bug comes back the next time somebody reads the old note.
  */
  assert.doesNotMatch(hub, /class="hub-stage-bg"/, 'the second backdrop layer must stay removed');
  assert.doesNotMatch(hub, /\.hub-stage-plate \{/, 'and so must the blurred ghost inside it');

  /*
    The one that remains must actually cover the hero. `.event-hero-bg-animated`
    sets width/height to 100%, and an absolutely positioned box with a left, a
    right AND a width all non-auto drops its `right` — so `inset: -12%` shifted
    the plate left and left 12% of the hero bare down the right-hand edge.
    Measured on /feed at a 1009px hero, the plate stopped at 928px.
  */
  const plate = hub.slice(hub.indexOf('.hero-backdrop-plate {'));
  const pdecl = plate.slice(0, plate.indexOf('\n  }'));
  /*
    The overscan is an ABSOLUTE allowance for the blur's weak edge (about twice
    the radius), not a percentage. At 12% it was 230px a side on a 1920px hero —
    ten times what the blur needs — and read as a backdrop zoomed a third of the
    way in, reported as "too far zoomed in".
  */
  assert.match(pdecl, /--plate-overscan: \d+px/, 'the overscan must be tied to the blur radius');
  assert.doesNotMatch(pdecl, /inset: -\d+%/, 'a percentage overscan scales with the hero, not the blur');
  assert.match(pdecl, /width: calc\(100% \+ var\(--plate-overscan\) \* 2\)/,
    'the plate must span its own overscan, not the hero');
  assert.match(pdecl, /height: calc\(100% \+ var\(--plate-overscan\) \* 2\)/, 'in both axes');
  assert.match(pdecl, /max-width: none/,
    'the global img reset caps an overscanning plate at 100% and the gap returns');
  assert.doesNotMatch(pdecl, /animation:/, 'scaling a clipping box was the light leak — nothing here moves');

  /*
    THE RAIL DRIVES THE STAGE, AND NOTHING IT SHOWS AUTOPLAYS.

    Picking an item swaps the stage to a still and a title. Playback happens
    only if the visitor presses Play, routed through the site's existing global
    [data-action="open-video"] handler — which is the whole reason this page can
    carry video at all. A player the visitor asked for is allowed to show its
    own controls, so none of the chrome problems that plagued the deck page
    apply here.

    Verified in a browser: 5 cards and 5 panes on Marvel, clicking card 1
    activates pane 1, sets is-item, and unloads the trailer to about:blank.
  */
  assert.match(hub, /hub-rail-card/, 'the hero features recent coverage');
  assert.match(hub, /<button\s+type="button"\s+class="hub-rail-card"/,
    'rail items must be real buttons — the deck shipped as divs once and was unreachable');
  assert.match(hub, /data-action="open-video"/, 'video panes reuse the site\'s modal handler');
  assert.match(hub, /pickHeroItems/, 'what the hero features must live in ONE function');

  // Articles are first-class here, not an afterthought.
  assert.match(hub, /contentType === 'video' \? 'Watch' : 'Read'/, 'articles feature too');

  // Choosing an item must UNLOAD the trailer, not merely hide it.
  const rail = hub.slice(hub.indexOf('function initHubRail'));
  assert.match(rail, /frame\.src = 'about:blank'/,
    'a hidden iframe still holds its document, its script and its connections');

  /*
    Identity appears exactly once, and the element that carries it IS the
    heading.

    This used to assert an `sr-only` <h1> beside an `aria-hidden` <img alt="">.
    That satisfied the outline, but a mark that failed to load left blank
    space with nothing saying what the page was. The <h1> wraps the mark now
    and the name is the image's alt, so a broken image paints the name in the
    mark's own place and assistive tech reads it once rather than once per
    element. Same invariant, answered where the question is.
  */
  assert.match(hub, /<h1 class="hero-title-lockup">[\s\S]{0,400}?alt=\{event\.title\}/,
    'the mark must BE the heading, and carry the hub name as its alt');
  assert.doesNotMatch(hub, /<h1 class="sr-only">\{event\.title\}<\/h1>/,
    'the sr-only twin is gone; two elements naming the page is what was announced twice');
  assert.doesNotMatch(hub, /class="hero-logo-wrap" aria-hidden="true"/,
    'the wrapper must not be hidden from assistive tech now that it holds the heading');
});

test('every category row is reachable and operable from the keyboard', () => {
  /*
    The headers were <div>s with a click handler. Focus went from the open row's
    cards straight to the footer, so the three CLOSED hubs could not be reached
    at all without a mouse — a design review found it by trying to Tab to them
    and failing.

    A heading wrapping a button is the ARIA accordion pattern: the <h2> keeps
    the document outline, the <button> takes focus and handles Enter and Space
    for free, and aria-expanded announces the state.
  */
  assert.match(src, /<h2 class="accordion-heading">/, 'the row label must stay a heading');
  assert.match(src, /<button\s+[\s\S]{0,200}?class="accordion-header"/, 'the header must be a button');
  assert.match(src, /aria-expanded=\{isExpanded/, 'the button must announce its state');
  assert.match(src, /aria-controls=\{`hub-row-\$\{category\}`\}/, 'the button must name the panel it controls');
  assert.match(src, /id=\{`hub-row-\$\{category\}`\}/, 'the panel needs the id aria-controls points at');
  assert.match(src, /setAttribute\('aria-expanded'/, 'the state must be kept in step on click');
  assert.match(src, /\.accordion-header:focus-visible/, 'a focusable control needs a visible focus ring');
});

test('pressing Play once is enough', () => {
  /*
    Reported: "it's requiring me to press the play icon and then the YouTube
    player refreshes, and then I have to hit a red play button".

    `autoplay=1` is REFUSED by every browser's autoplay policy while the video
    carries sound, and a refused autoplay is not an inert frame: YouTube swaps
    to its own poster and its own red button. So the first press looked like it
    reloaded the player and did nothing, and the video only started on a SECOND
    press inside somebody else's UI.

    Muted autoplay is never refused. The video starts muted and the sound is
    turned back on over the JS API on a confirmed PLAYING. If a browser refuses
    the unmute too (iOS is the strict one), the video is still running with
    YouTube's own controls up, one tap from sound.
  */
  const hub = readFileSync(join(here, '..', 'src', 'pages', 'featured', '[slug].astro'), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  // The URL the Play button writes, isolated from the resting trailer's.
  const at = hub.indexOf('data-hub-play');
  assert.ok(at > -1, 'the Play button must carry data-hub-play');
  /* Bounded to the press handler itself: the feed BELOW the hero legitimately
     binds [data-action="open-video"], and an unbounded slice swept it in. */
  const from = hub.indexOf('[data-hub-play]', at);
  /* 1600, not 900: the binding now also guards against double-binding across a
     client-side navigation and gives the coverage card its keyboard handler,
     both of which sit above the press itself. */
  const handler = hub.slice(from, from + 3500);
  /* The embed URL lives in a helper now, because the press builds it twice:
     once asking for sound and once falling back. Assert on the helper. */
  const at2 = hub.indexOf('const embedUrl =');
  assert.ok(at2 > -1, 'the press must build its embed URL in one place');
  const url = hub.slice(at2, at2 + 600);

  /* No longer by autoplay=1: an embed that starts itself is what YouTube's
     bot check looks for (CLAUDE.md hard rule 11). The press loads the player
     and playWhenReady() sends playVideo once it is ready. */
  assert.doesNotMatch(url, /autoplay=1/, 'an embed that starts itself risks the YouTube sign-in wall');
  assert.match(handler, /embedUrl\(id, !withSound\);\s*startStage\(frame\)/, 'one press must start it');
  assert.match(url, /enablejsapi=1/, 'without the API nothing can be asked of the player');
  assert.match(url, /origin=\$\{encodeURIComponent/, 'the player will not answer without an origin');
  assert.match(url, /playsinline=1/, 'iOS goes full screen without it');
  assert.doesNotMatch(url, /controls=0/, "a chosen video keeps the player's own controls");

  /*
    A VIDEO THE VISITOR PRESSED PLAY ON ASKS FOR SOUND. The resting trailer is
    muted because muted is the only state a browser starts on its own, but a
    press is not the trailer: they asked for it, and starting it silent is its
    own bug. So mute is decided BEFORE the frame loads, and the press tries
    mute=0 first.
  */
  assert.match(handler, /const withSound = .*!soundBlocked\(\)/, 'the press must try for sound');
  assert.match(handler, /embedUrl\(id, !withSound\)/, 'and open the video accordingly');
  assert.match(hub, /mute=\$\{muted \? '1' : '0'\}/, 'mute is decided per load, not hardcoded');

  /*
    And it CHECKS. A refused autoplay is not a dead frame: YouTube shows its own
    red button. So if the player has not reached PLAYING a moment later it is
    reloaded muted, and the answer is remembered for the tab so the next video
    does not pay the same wait.
  */
  assert.match(handler, /await didStart\(frame, HUB_START_GRACE_MS\)/, 'the press must verify it started');
  assert.match(handler, /rememberSoundBlocked\(\)[\s\S]{0,140}embedUrl\(id, true\)/,
    'a refusal must fall back to muted, or the press is wasted');
  assert.match(handler, /token !== playToken/,
    'the fallback runs after an await and must not stomp a video chosen since');

  /*
    What it must NEVER do is unmute a video ALREADY running: playback under the
    muted-autoplay allowance is paused by the browser when script takes the mute
    away without activation in that frame, and YouTube stalls on its spinner.
    Reported as "starts for half a second, then it just infinitely loads".
  */
  assert.doesNotMatch(handler, /unMute/, 'never unmute a frame that is already playing');

  // It plays HERE. The modal was the previous bug and must not come back.
  assert.doesNotMatch(handler, /data-action="open-video"/, 'this panel is the player, not a modal trigger');

  /*
    And nothing may sit on top of the frame it just started. The picked rail
    card's pane is at full opacity until this rule zeroes it; without it the
    video plays behind an opaque still, which from the outside is exactly what
    a dead button looks like.
  */
  assert.match(hub, /\.hub-stage\.is-playing \.hub-stage-item \{[^}]*opacity: 0/,
    'a playing video must not be covered by the pane that launched it');
  assert.match(hub, /\.hub-stage\.is-playing \.hub-stage-item \{[^}]*visibility: hidden/,
    'opacity alone still leaves it hit-testable on top of the player');
});

test('a phone held sideways gets the two-column hero', () => {
  /*
    The split was gated on `min-width: 900px`, which reads as "desktop" and is
    wrong for what it decides. An iPhone 16/17 Pro in landscape is 874px and a
    Max is 932px, so the same gesture on two phones in the same hand produced
    two different layouts and the smaller one stacked.

    What decides whether copy and video sit side by side is whether the
    viewport is wider than it is tall. The 820px floor is measured: the hero
    bottoms out near 394px on its own content whatever the width, and below
    820 the devices are shorter than that, so the split ran off the bottom (93px
    over on an SE). Verified fitting at 844x390, 852x393, 874x402, 896x414,
    932x430 and 956x440.
  */
  const hub = readFileSync(join(here, '..', 'src', 'pages', 'featured', '[slug].astro'), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  const split = '@media (min-width: 900px), (orientation: landscape) and (min-width: 820px) {';
  assert.ok(hub.includes(split), 'the split must key off orientation, not width alone');

  /*
    The backdrop query must be the EXACT INVERSE. A flat `max-width: 1023px`
    overlapped the old split by a whole band, so a 900-1023px portrait viewport
    got two columns AND the full-bleed plate built for a stacked page.
  */
  const stacked = '@media (max-width: 899px) and (orientation: portrait), (max-width: 819px) {';
  assert.ok(hub.includes(stacked), 'the stacked backdrop must invert the split exactly');
  assert.ok(!hub.includes('@media (max-width: 1023px) {'),
    'the old flat breakpoint overlapped the split');

  // Desktop's header clearance is a vw clamp, so it GROWS with width — a third
  // of the screen on a 390px-tall phone. Short landscape has to opt out.
  assert.match(hub, /@media \(orientation: landscape\) and \(max-height: 450px\) \{[\s\S]{0,220}padding-top: 5\.25rem/,
    'a short landscape viewport cannot afford the full clearance');
});

test('the visitor can turn the sound on', () => {
  /*
    Everything on this stage starts muted, because muted is the only state a
    browser will start on its own. The trailer runs with controls=0, so without
    a control of ours there was no way to hear it at all: "the initial trailer
    doesn't have an unmute button, so you can never unmute it".

    And the button checks its own work. If the browser refuses the unmute it
    pauses the video, so the mute goes back on and playback resumes rather than
    leaving a spinner where the trailer was.
  */
  const hub = readFileSync(join(here, '..', 'src', 'pages', 'featured', '[slug].astro'), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  assert.match(hub, /class="hub-stage-sound"/, 'the stage needs a sound control');
  assert.match(hub, /<button type="button" class="hub-stage-sound"/, 'it must be a real button');
  assert.match(hub, /\.hub-stage\.is-playing(?:[^{]+)? \.hub-stage-sound \{[^}]*display: inline-flex/,
    'it only means anything while something is playing');

  // HARD RULE 3: it is a SIBLING of the video, never a clipping wrapper.
  assert.ok(hub.indexOf('class="hub-stage-sound"') > hub.indexOf('</div>\n            )}'),
    'the control sits outside the video wrapper');

  const ctl = hub.slice(hub.indexOf('function initHubSound'));
  assert.match(ctl, /send\('unMute'\)/, 'pressing it must ask for sound');
  assert.match(ctl, /send\('setVolume', \[100\]\)/, 'unmuting at volume zero is still silence');
  assert.match(ctl, /send\('mute'\);\n      send\('playVideo'\);/,
    'a refused unmute must be undone AND playback resumed, or the frame spins');
  assert.match(ctl, /state === 1 \|\| state === 3/, '3 is buffering, which is normal for a moment');
  assert.match(ctl, /aria-pressed/, 'a toggle must announce its state');
});

test('the shipping typeface actually has a file to ship', () => {
  /*
    PROD_FONT names the one face production emits. If SELF_HOSTED_FILES has no
    entry for it, no @font-face and no preload are written: the build succeeds,
    the page ships, and every heading renders in the fallback sans-serif. That
    is invisible until it is live, so the page throws at build time and this
    catches it offline first.
  */
  const m = src.match(/const PROD_FONT = '([^']+)'/);
  assert.ok(m, 'PROD_FONT must be declared');
  const font = m[1];

  const files = src.slice(src.indexOf('const SELF_HOSTED_FILES'));
  const entry = files.slice(0, files.indexOf('};')).match(
    new RegExp(`${font}:\\s*\\{[^}]*file: '([^']+)'`),
  );
  assert.ok(entry, `SELF_HOSTED_FILES has no entry for PROD_FONT '${font}'`);

  const onDisk = join(here, '..', 'public', entry[1].replace(/^\//, ''));
  assert.ok(existsSync(onDisk), `${entry[1]} is registered but not in public/`);
  const head = readFileSync(onDisk).subarray(0, 4).toString('latin1');
  assert.equal(head, 'wOF2', `${entry[1]} is not a woff2 file`);

  assert.match(src, /if \(!SELF_HOSTED_FILES\[PROD_FONT\]\)/,
    'the page must refuse to build with a face it cannot serve');
});

/*
  ─── THE COVERAGE GRID DRIVES THE STAGE ───────────────────────────────────────

  The hero swap the rest of the site got — click a card, it plays where the hero
  is — had reached the Feed and every FeedSpotlightHero page but not these. A hub
  or event page has its own player at the top and its coverage cards opened the
  full-screen modal over it instead, which is the same "page loses its place"
  the rail's own Play button was fixed for two commits earlier.

  Three things have to hold together, and all three are easy to undo by accident:
  the cards must ask for it (`context="hub"`), the binding must be able to see
  them (document-wide), and it must run at all on a hub whose stage has no rail.
*/
test('a coverage card plays in the stage, not over it', () => {
  for (const file of [
    join('src', 'pages', 'featured', '[slug].astro'),
    join('src', 'components', 'EventFeatured.astro'),
    join('src', 'components', 'EventAnnouncement.astro'),
  ]) {
    const src = readFileSync(join(here, '..', file), 'utf8');
    const code = src
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');

    assert.match(
      code,
      /<ContentCard item=\{item\} index=\{index\} context="hub" \/>/,
      `${file}: the coverage card must ask to drive the stage`,
    );

    /*
      Its own function, NOT inside initHubRail(). That function returns early
      when a hub has no rail, and a card that looks exactly like a working one
      but does nothing is the quietest failure this page can have.
    */
    assert.match(code, /function initHubPlay\(\)/, `${file}: the press must not depend on the rail`);
    const play = code.slice(code.indexOf('function initHubPlay()'));
    assert.match(
      play,
      /document\.querySelectorAll<HTMLElement>\('\[data-hub-play\]'\)/,
      `${file}: a coverage card is not inside the stage, so the query cannot be`,
    );
    assert.match(
      play,
      /!stage\.contains\(btn\)[\s\S]{0,120}scrollIntoView/,
      `${file}: a press from below the fold must bring the player back into view`,
    );
    assert.match(
      play,
      /hubPlayBound/,
      `${file}: astro:page-load fires again after every navigation`,
    );
    assert.match(
      play,
      /role'\) === 'button'[\s\S]{0,200}keydown/,
      `${file}: a <div role="button"> fires no click on Enter`,
    );

    assert.ok(
      code.includes('initHubPlay();'),
      `${file}: the function has to actually be called`,
    );
  }
});

/*
  The modal must not ALSO fire. ContentCard emits `data-action="open-video"` for
  a playable card everywhere else on the site, and that is the global handler
  that opens the overlay. On a hub page both would run: the video would start in
  the stage and a modal would cover it.
*/
test('a hub card does not also trigger the site-wide modal', () => {
  const card = readFileSync(join(here, '..', 'src', 'components', 'ContentCard.astro'), 'utf8');
  const at = card.indexOf('const dataAction =');
  assert.ok(at > -1, 'the card must decide its own action in one place');
  const decision = card.slice(at, at + 400);
  assert.match(decision, /isHubContext\s*\n?\s*\?\s*undefined/, 'hub context must emit no data-action');
});


test('the deck card and its filmstrip scale together', () => {
  /*
    ─── WHAT THIS STOPS ──────────────────────────────────────────────────────

    `.deck-card` was a flat `85%` of the stack and `.deck-nav-thumb` a flat
    84x46 at every width, so the two had no relationship at all. Measured at
    3840x2160: the card reached 2101x1182 while each thumbnail stayed 46px
    tall — 4% of the picture it navigates — and the strip around them was
    `clamp(66px, 7vh, 150px)`, growing while its own contents did not.
    Reported as the image being too massive and the tiles far too small.

    Both are sized from the same `vw` basis now, the thumb at exactly a fifth
    of the card, so the ratio holds instead of one outrunning the other.
    Measured after: card 1982 wide, thumb 372, which is 18.8%.
  */
  const src = raw;

  const card = src.match(/\n  \.deck-card \{[\s\S]*?\n  \}/);
  assert.ok(card, 'the deck card rule is gone');
  assert.match(card[0], /width: min\(85%, (\d+)vw\)/,
    'the card must stop growing with the screen');
  const cardVw = Number(card[0].match(/width: min\(85%, (\d+(?:\.\d+)?)vw\)/)[1]);

  const thumb = src.match(/\.deck-nav-thumb \{\s*\/\*[\s\S]*?width: clamp\([^)]*\);[\s\S]*?\n    \}/);
  assert.ok(thumb, 'the sized thumbnail rule is gone');
  const thumbVw = Number(thumb[0].match(/clamp\(\d+px, (\d+(?:\.\d+)?)vw/)[1]);

  const ratio = thumbVw / cardVw;
  assert.ok(ratio > 0.15 && ratio < 0.25,
    `the tile should be about a fifth of the card; got ${(ratio * 100).toFixed(1)}%`);
  assert.match(thumb[0], /aspect-ratio: 16 \/ 9;/,
    '84x46 was 1.83, which had already drifted off 16/9');

  /*
    And the card's dead centring declaration must stay dead. Computed style
    reports `position: relative; top: 0; margin-top: 0` — a later rule re-lays
    the deck out. Replacing it with a `translate` that DID apply moved the card
    566px up the page.
  */
  assert.ok(!/translate: 0 -50%/.test(card[0]),
    'the card is not positioned by this rule; a live translate here moves it off screen');
});

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed.\n`);
process.exit(failed === 0 ? 0 : 1);
