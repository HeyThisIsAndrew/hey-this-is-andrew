/*
  THE AD ROTATOR'S COPY HAS TO FIT, AND THE ROTATOR HAS TO HAVE ONE CLOCK.

  ─── THE BUG THIS PINS ─────────────────────────────────────────────────────
  Reported from a phone in portrait: the banner's blurbs were cut off. Two
  separate causes, both measured in a real browser at 300-2400px before this
  file was written.

  1. THE COPY WAS TOO LONG FOR THE COLUMN, AND THE COLUMN WAS SMALLER THAN
     ANYONE THOUGHT. `.container-page` keeps a 2rem gutter at every width, so
     a 320px phone gives the banner 272px. Against a fixed 78px logo column,
     3rem of padding and two 1rem gaps that left 141px for the text.
     "Edit with DaVinci Resolve" needs 217px there, so it lost its last eight
     characters — and with `text-overflow: ellipsis` on a parent whose child
     is the block that overflows, it did not even get an ellipsis. It was cut
     mid-letter.

     Fixed twice over: a per-partner compact string (`bannerTextCompact` in
     src/data/referrals.js) swapped in by media query, and mobile chrome that
     scales with the viewport instead of stepping at two fixed breakpoints.
     A stepped tier does not fix this class of bug, it relocates it to just
     above its own breakpoint.

  2. THE PROGRESS INDICATOR AND THE ROTATION WERE TWO CLOCKS. A
     `setInterval(8000)` advanced the slides while a CSS animation drew the
     timer, and only the animation paused on hover. Leaving the banner with
     the outline 90% round, the outline finished in 0.8s and then the slide
     sat there for the rest of an interval that had restarted from zero:
     reported as "a delay between transition". The rotation is driven by the
     animation's own `animationend` now, so there is exactly one clock and
     pausing it pauses both.

  ─── WHY A TEST AND NOT A SCREENSHOT ──────────────────────────────────────
  Copy is edited by a human in a data file, and the string that breaks the
  layout is always the next one somebody adds. The character budgets below
  are measured, not guessed, and they are the cheap check that runs on every
  commit.

  ─── THE BUDGETS, AND WHERE THEY COME FROM ────────────────────────────────
  Measured in Chromium against the built page, in the display font the banner
  actually uses, at the tightest width of each breakpoint:

    mobile   320px wide: text column 170px, 8.43px per uppercase character
             -> 20 characters is the hard ceiling. Budget 19, so a string at
             the limit still has a character of room.
    desktop  769px wide: text column 452px, 15.92px per character
             -> 28 characters is the hard ceiling. Budget 27.

  If a partner needs more than the mobile budget, that is what
  `bannerTextCompact` is for. Do not raise these numbers to make a string
  pass: re-measure first, because the thing that changed is the layout.
*/
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const referrals = read('src/data/referrals.js');
/*
  The banner moved out of IntelLayout into its own component so the Feed could
  mount the same one instead of a copy. `banner` is where its markup, styles and
  script now live; `layout` is still read, but only for the one assertion that
  is genuinely about the /intel PAGE rather than the banner: where the rotator
  sits relative to the magazine and the video strip.
*/
const banner = read('src/components/CommercialRotator.astro');
const layout = read('src/layouts/IntelLayout.astro');
const tokens = read('src/styles/global-base.css');

const MOBILE_BUDGET = 19;
const DESKTOP_BUDGET = 27;

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed += 1;
  } catch (e) {
    console.log(`  ✗ ${name}\n    ${e.message}`);
    failed += 1;
  }
}

/*
  referrals.js is parsed as text rather than imported: it imports .png assets,
  which plain node refuses. Same reason scripts/hub-card.test.mjs reads source
  instead of importing the component.
*/
function parseReferralItems() {
  const items = [];
  const blocks = referrals.split(/\n\s*\{\s*\n/).slice(1);
  for (const block of blocks) {
    const body = block.split(/\n\s*\},?\s*\n/)[0];
    const field = (name) => {
      const m = body.match(new RegExp(`${name}:\\s*'((?:[^'\\\\]|\\\\.)*)'`));
      return m ? m[1] : null;
    };
    const label = field('label');
    if (!label) continue;
    items.push({
      label,
      // `href: site.socials.amazon` is an expression, not a literal; a null
      // href here means "not an empty string", which is what matters.
      href: body.includes("href: ''") ? '' : field('href') ?? 'expression',
      blurb: field('blurb'),
      bannerText: field('bannerText'),
      bannerTextCompact: field('bannerTextCompact'),
    });
  }
  return items;
}

const items = parseReferralItems();
/* A live item is one that actually reaches a surface. getReferralItems()
   filters on a truthy href, so this must filter the same way. */
const live = items.filter((item) => item.href !== '');

console.log('\nAd rotator copy\n');

test('referrals.js still parses into the partners we expect', () => {
  assert.ok(items.length >= 3, `found only ${items.length} partner blocks`);
  assert.ok(
    live.length >= 3,
    `expected at least 3 live partners, found ${live.length} (${live.map((i) => i.label).join(', ')})`,
  );
  const labels = items.map((i) => i.label);
  for (const expected of ['Amazon Storefront', 'Mint Mobile', 'DaVinci Resolve']) {
    assert.ok(labels.includes(expected), `${expected} is missing from referrals.js`);
  }
});

test('every live partner has banner copy of its own', () => {
  for (const item of live) {
    assert.ok(
      item.bannerText,
      `${item.label} has no bannerText, so the rotator would fall back to its label`,
    );
  }
});

test(`mobile copy fits the narrowest phone (<= ${MOBILE_BUDGET} characters)`, () => {
  for (const item of live) {
    /* What a phone actually shows: the compact string when there is one, the
       full string when there is not. A missing compact string is a decision
       that the full one fits, and this is what holds that decision honest. */
    const onMobile = item.bannerTextCompact ?? item.bannerText;
    assert.ok(
      onMobile.length <= MOBILE_BUDGET,
      `${item.label} shows "${onMobile}" (${onMobile.length} chars) on mobile, over the ` +
        `${MOBILE_BUDGET}-character budget. Give it a shorter bannerTextCompact — do not ` +
        `raise the budget without re-measuring the column.`,
    );
  }
});

test(`desktop copy fits the narrowest desktop (<= ${DESKTOP_BUDGET} characters)`, () => {
  for (const item of live) {
    assert.ok(
      item.bannerText.length <= DESKTOP_BUDGET,
      `${item.label}'s bannerText "${item.bannerText}" is ${item.bannerText.length} chars, ` +
        `over the ${DESKTOP_BUDGET}-character budget measured at 769px`,
    );
  }
});

test('a compact string is always shorter than the full one', () => {
  for (const item of live) {
    if (!item.bannerTextCompact) continue;
    assert.ok(
      item.bannerTextCompact.length < item.bannerText.length,
      `${item.label}'s compact copy "${item.bannerTextCompact}" is not shorter than its full ` +
        `copy "${item.bannerText}", so the swap costs a string and buys nothing`,
    );
  }
});

test('no em dashes in banner copy (house style)', () => {
  for (const item of live) {
    for (const [field, value] of Object.entries(item)) {
      if (typeof value !== 'string') continue;
      assert.ok(
        !value.includes('—'),
        `${item.label}'s ${field} contains an em dash; CLAUDE.md forbids them in copy a visitor reads`,
      );
    }
  }
});

test('the rotator reads bannerText, never the rail’s blurb', () => {
  /*
    `blurb` is the article rail's sentence. The rotator read it once, which is
    why three partners' rail copy was rewritten into CTA fragments to make a
    banner fit. One string cannot serve a wrapping column and a row that does
    not wrap.
  */
  assert.match(
    banner,
    /full:\s*item\.bannerText\s*\?\?\s*item\.label/,
    'getBannerCopy must take its full string from bannerText, falling back to label',
  );
  assert.ok(
    !/item\.blurb/.test(banner),
    'IntelLayout must not render item.blurb — that is the rail’s copy, not the banner’s',
  );
});

console.log('\nThe responsive swap\n');

test('both strings ship and CSS hides one with display', () => {
  assert.match(banner, /<span class="banner-copy-full">/, 'the full string must be its own element');
  assert.match(banner, /<span class="banner-copy-compact">/, 'the compact string must be its own element');

  /*
    `display` specifically. A clip, a zero width, `visibility: hidden` or an
    opacity all leave the hidden string in the accessibility tree, and the
    slide gets read out twice.
  */
  assert.match(
    banner,
    /\.banner-copy-compact\s*\{\s*display:\s*none;/,
    'the compact string must be display:none by default, so desktop shows the full one',
  );
});

test('the swap is inside a mobile media query and guarded on has-compact-copy', () => {
  /*
    520px, not 768px, and the number is measured: the longest full string needs
    256px and the column is 293px at 520px wide. Swapping at the tablet
    breakpoint meant a tablet read "Free Editor" with 163px of its column
    empty. How the row is SPACED still changes at 768px; how long its copy can
    be is a different question with a different answer.
  */
  const mobile = banner.slice(banner.indexOf('@media (max-width: 520px)'));
  assert.match(
    mobile,
    /\.yt-banner-text\.has-compact-copy\s+\.banner-copy-full\s*\{\s*display:\s*none;/,
    'the mobile rule must hide the full string only on slides that HAVE a compact one',
  );
  assert.match(
    mobile,
    /\.yt-banner-text\.has-compact-copy\s+\.banner-copy-compact\s*\{\s*display:\s*block;/,
    'the mobile rule must show the compact string',
  );

  /*
    The guard class is the whole safety property: without it, a partner with
    no compact string (Amazon, deliberately) would render a slide with no text
    at all on every phone.
  */
  /* Every rule that hides the full string must be reached through the guard.
     Checked by looking at what precedes each `.banner-copy-full {`, so a new
     unguarded rule anywhere in the sheet fails this. */
  for (const match of banner.matchAll(/([^\n]*)\.banner-copy-full\s*\{([^}]*)\}/g)) {
    const [, selectorPrefix, body] = match;
    if (!/display:\s*none/.test(body)) continue;
    assert.match(
      selectorPrefix,
      /\.has-compact-copy\s*$|\.has-compact-copy\s+$/,
      'never hide .banner-copy-full unconditionally: a slide without compact copy would go ' +
        `blank. Offending selector: "${selectorPrefix.trim()}.banner-copy-full"`,
    );
  }
  assert.match(
    banner,
    /'has-compact-copy':\s*copy\.compact !== null/,
    'the class must be driven by whether the partner actually has compact copy',
  );
});

test('mobile chrome scales with the viewport instead of stepping', () => {
  const mobile = banner.slice(banner.indexOf('@media (max-width: 768px)'));
  assert.match(
    mobile,
    /grid-template-columns:\s*\n?\s*clamp\([^)]*\)\s*\n?\s*minmax\(0,\s*1fr\)/,
    'the mobile row must use a clamp() logo column and minmax(0, 1fr) for the copy — a ' +
      'fixed logo column is what left 141px for 172px of text at 320px',
  );
  assert.ok(
    !/@media \(max-width: 380px\)/.test(banner),
    'the 380px tier is gone on purpose: fluid chrome covers it, and two sets of fixed ' +
      'numbers is how the 320-380px band got missed in the first place',
  );
});

console.log('\nWhat sits above the rotator\n');

test('the empty state renders in the magazine slot, above the rotator', () => {
  /*
    Reported as "I had to scroll down to see that": filtering /intel to a
    category with no articles rendered the filter row, the ad banner, four
    videos and then a screen of nothing before "no items found" appeared,
    because the empty state was emitted after the video and archive sections.

    The message answering "where did the articles go?" belongs where the
    articles would have been, which is the magazine's slot. `isEmpty` is
    `!hasMagazine && !hasArchive`, so the spread and the empty state can never
    both render and this is a swap, not an insertion.
  */
  const magazine = layout.indexOf('{hasMagazine && <IntelMagazine');
  const emptyState = layout.indexOf('<EmptyState');
  const rotator = layout.indexOf('<CommercialRotator />');
  const videoStrip = layout.indexOf('id="intel-video-head"');

  assert.ok(magazine > 0 && emptyState > 0 && rotator > 0 && videoStrip > 0,
    'expected the magazine, empty state, rotator and video strip all to be present');
  assert.ok(
    emptyState > magazine,
    'the empty state must sit in the magazine slot, directly after the spread',
  );
  assert.ok(
    emptyState < rotator,
    'the empty state must come BEFORE the ad rotator: below it, the ad is the ' +
      'first thing a visitor meets on a page that has told them nothing yet',
  );
  assert.ok(
    emptyState < videoStrip,
    'the empty state must come before the video strip, which is what pushed it ' +
      'below the fold in the first place',
  );
});

console.log('\nOne clock\n');

test('nothing in the rotator runs on a timer', () => {
  /* Comments stripped first: this file's own explanation of the bug names the
     API that caused it, and matching that would fail for the wrong reason. */
  const script = banner
    .slice(layout.indexOf('<script>'), layout.indexOf('</script>'))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.ok(
    !/setInterval|setTimeout/.test(script),
    'the rotator must not schedule anything: the outline animation is the clock, and a ' +
      'second one desynchronises the moment hover pauses only one of them',
  );
  assert.match(
    banner,
    /progress\.addEventListener\('animationend', advance\)/,
    'the advance must be driven by the progress animation ending',
  );
});

test('the hold duration is declared once, in CSS', () => {
  assert.match(
    banner,
    /--banner-hold:\s*8s;/,
    'the hold duration belongs on .yt-banner-wrapper as --banner-hold',
  );
  assert.match(
    banner,
    /animation:\s*perimeterFill\s+var\(--banner-hold\)/,
    'the outline must read its duration from --banner-hold, not repeat the number',
  );
  const holds = banner.match(/--banner-hold:/g) ?? [];
  assert.equal(holds.length, 1, `--banner-hold is declared ${holds.length} times; it must be one value`);
});

test('the outline traces the whole box, clockwise from the top left', () => {
  /*
    A <rect>'s path starts at its top-left corner and runs clockwise, so
    drawing the dash IN draws the outline the way the box reads. pathLength
    normalizes the perimeter to 100 units, which is what makes one dash of 100
    exactly one lap at any banner size — no measuring in JS, and it survives a
    reflow.
  */
  assert.match(
    banner,
    /<rect class="banner-perimeter-rect"[^>]*x="0"[^>]*y="0"[^>]*width="100%"[^>]*height="100%"[^>]*pathLength="100"/,
    'the perimeter rect must cover the box from 0,0 with pathLength="100"',
  );
  assert.match(banner, /stroke-dasharray:\s*100;/, 'one dash, one lap');
  assert.match(
    banner,
    /stroke-dashoffset:\s*100;/,
    'the lap must start fully offset (empty) and draw in',
  );
  assert.match(
    banner,
    /0%\s*\{\s*stroke-dashoffset:\s*100;[\s\S]*?100%\s*\{\s*stroke-dashoffset:\s*0;/,
    'the keyframes must run 100 -> 0, which is the clockwise direction',
  );
});

test('auto-pause is scoped to the rotator, not the whole wrapper', () => {
  /*
    With the pause rules on .yt-banner-wrapper, the pause button sat inside its
    own hover zone: clicking it appeared to do nothing, and for a keyboard user
    focusing it paused via :focus-within, so the toggle looked dead in both
    directions.
  */
  assert.match(
    banner,
    /\.banner-rotator-grid:hover \.banner-perimeter-rect,\s*\n\s*\.banner-rotator-grid:focus-within \.banner-perimeter-rect,\s*\n\s*\.yt-banner-wrapper\.is-paused \.banner-perimeter-rect/,
    'hover and focus pause must be scoped to .banner-rotator-grid, with .is-paused on the wrapper',
  );
  assert.ok(
    !/\.yt-banner-wrapper:hover \.banner-perimeter-rect/.test(banner),
    'the wrapper must not be the hover-pause scope: the pause control lives inside it',
  );
});

test('the rotator stops while it is off screen', () => {
  /*
    The outline is the one animation on this page Lighthouse flags as
    non-composited ("Unsupported CSS Property: stroke-dashoffset"), so every
    frame is main-thread work. Off screen it was doing that for a box nobody
    could see, and because the animation is also the clock, slides were
    advancing unseen.

    `is-offscreen` and `is-paused` are separate classes deliberately: either
    holds the outline, and scrolling back into view must not resume a rotation
    the visitor stopped on purpose.
  */
  assert.match(
    banner,
    /\.yt-banner-wrapper\.is-offscreen \.banner-perimeter-rect \{\s*animation-play-state: paused;/,
    'an off-screen banner must pause the outline, which is also the rotation clock',
  );
  assert.match(
    banner,
    /new IntersectionObserver\(/,
    'visibility must be observed rather than polled',
  );
  assert.match(
    banner,
    /wrapper\.classList\.toggle\('is-offscreen', !entry\.isIntersecting\)/,
    'the class must follow intersection directly',
  );
  assert.ok(
    !/classList\.remove\('is-paused'\)/.test(banner),
    'nothing in the visibility path may clear a user pause',
  );
  assert.match(
    banner,
    /astro:before-swap', \(\) => visibility\.disconnect\(\)/,
    'the observer must be dropped on navigation, not left bound to a detached element',
  );
  assert.match(
    banner,
    /if \('IntersectionObserver' in window\)/,
    'guard the API: without it the banner should simply keep running',
  );
});

test('there is a real pause control, revealed by script', () => {
  assert.match(banner, /id="banner-pause"[^>]*hidden/, 'the control must ship hidden: no JS, no rotation, nothing to pause');
  assert.match(banner, /pauseBtn\.hidden = false/, 'the script must reveal it');
  assert.match(
    banner,
    /Resume the rotating links/,
    'the accessible name must say which way the toggle goes',
  );
});

console.log('\nOnly one slide is reachable\n');

test('hidden slides are inert in the markup and in the script', () => {
  /*
    Every slide is an <a>. Turning one away in 3D hides it from the eye and
    from nothing else: it keeps its place in the tab order and its voice in a
    screen reader. Shipping them inert is also the correct no-JS state, since
    without the script nothing rotates.
  */
  assert.match(
    banner,
    /data-state="hidden-prev" data-meta=\{getAdMeta\(item\)\} inert aria-hidden="true"/,
    'ad slides must ship inert and aria-hidden',
  );
  assert.match(
    banner,
    /slide\.inert = hidden;/,
    'the script must keep inert in step with the active slide',
  );
  assert.match(
    banner,
    /if \(hidden\) slide\.setAttribute\('aria-hidden', 'true'\);\s*\n\s*else slide\.removeAttribute\('aria-hidden'\);/,
    'aria-hidden must be removed from the active slide, not set to "false" and left on',
  );
});

console.log('\nThe disclosure is readable\n');

/** WCAG relative luminance and contrast ratio, recomputed from the tokens. */
const lum = (hex) => {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.substr(i, 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

test('the disclosure clears AA, with no opacity undoing it', () => {
  const token = (name) => {
    const m = tokens.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
    assert.ok(m, `--${name} not found in global-base.css`);
    return m[1];
  };

  const contrast = ratio(token('color-white-muted'), token('color-surface'));
  assert.ok(contrast >= 4.5, `--color-white-muted on --color-surface is ${contrast.toFixed(2)}:1`);

  const block = banner.slice(banner.indexOf('.banner-meta-text {'));
  const rule = block.slice(0, block.indexOf('}'));
  assert.match(rule, /color:\s*var\(--color-white-muted\)/, 'the disclosure must use the muted token');

  /*
    It shipped at 0.35 opacity, which blends #888 on #111 to #3b3b3b: 1.67:1.
    The token's own 5.33:1 means nothing if an opacity throws it away, and a
    disclosure nobody can read is not a disclosure.
  */
  assert.ok(
    !/opacity:/.test(rule),
    'no opacity on the disclosure text: it is what took the contrast to 1.67:1',
  );
  const size = rule.match(/font-size:\s*([\d.]+)rem/);
  assert.ok(size && parseFloat(size[1]) >= 0.65, 'the disclosure must be at least 0.65rem');
});

test('each disclosure names the real relationship', () => {
  /*
    referrals.js is explicit that calling a link sponsored when it is not
    "would be its own kind of inaccuracy", and the same holds the other way.
    An affiliate slide has to say so.
  */
  assert.match(banner, /if \(item\.offer\) return 'REFERRAL LINK';/, 'a referral offer is a referral link');
  assert.match(
    banner,
    /if \(item\.affiliate === false\) return 'RECOMMENDATION';/,
    'a link that pays nothing must not borrow a word implying it does',
  );
  assert.match(banner, /return 'AFFILIATE LINK';/, 'everything else is an affiliate link and says so');
});

test('the disclosure row is clickable where it has to be', () => {
  const block = banner.slice(banner.indexOf('.banner-metadata-row {'));
  const rule = block.slice(0, block.indexOf('}'));
  assert.ok(
    !/pointer-events:\s*none/.test(rule),
    'the row carried pointer-events: none, which made the pause button unclickable',
  );
});

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed.\n`);
process.exit(failed === 0 ? 0 : 1);
