/*
  Static guard on the Intel magazine's rail split.

  THE BUG THIS PINS — reported from production, 2026-08-22

  The magazine spread flanks a large feature image with two vertical rails of
  article tiles. Those rails used to be filled by ALTERNATING sides:

      leftRail  = articles.filter((_, i) => i % 2 === 0)   // 0, 2, 4
      rightRail = articles.filter((_, i) => i % 2 === 1)   // 1, 3, 5

  Each rail still descended by date on its own, so nothing in the data or the
  sort was wrong — and that is exactly why no existing test caught it. What
  broke was READING order. With six articles the page rendered:

      left:  Aug 21   Aug 19   May 5
      right: Aug 20   Aug 4    May 2

  The second-newest article sat at the top of the *other* column, so there was
  no single chronological list to follow. It only read correctly if you scanned
  row by row across the spread — and a full-height feature image sits between
  the rails, so nobody does that.

  IT ALSO BROKE THE STACKED VIEWS, WHICH IS THE STRONGER ARGUMENT

  Below 1100px the three-column spread collapses: the feature moves to the
  top and the two rails stack, left rail then right rail, one above the
  other. There is no "read across" interpretation available there at all —
  it is a single vertical list.

  Alternating therefore rendered phones and tablets as 1st, 3rd, 5th, then
  2nd, 4th, 6th: unambiguously wrong, not a matter of reading model.
  Sequential halves make the stacked list simply 1..6.

  Measured on the built page: at 1440px the left column descends, the right
  column descends, and the bottom of the left hands over to the top of the
  right still going downward — one continuous sequence read column by column,
  which is how flanking rails read when a 720px feature image sits between
  them. At 900px and 390px the stacked list reads 1..6 straight through.

  WHY THIS IS A STATIC CHECK

  The ordering is correct in the data, correct in `getAllArticles()`, and
  correct in the props handed to the component. It goes wrong purely in how one
  already-sorted array is dealt into two columns, which no assertion about the
  data can see. Reading the source is the check that discriminates — same
  reasoning as scripts/viewport-units.test.mjs.

  Run:  node scripts/intel-magazine-order.test.mjs
*/
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const source = fs.readFileSync(
  path.join(ROOT, 'src/components/IntelMagazine.astro'),
  'utf8',
);

let passed = 0;
const test = (name, fn) => {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err.message}`);
    process.exitCode = 1;
  }
};

console.log('\nIntel magazine rail order\n');

test('rails are NOT dealt out by alternating sides', () => {
  assert.ok(
    !/index\s*%\s*2/.test(source),
    'IntelMagazine.astro splits its rails with `index % 2`, which puts the\n' +
      '    second-newest article at the top of the opposite column and leaves the\n' +
      '    spread with no single chronological list. Split the sorted array into\n' +
      '    sequential halves instead — newest half left, older half right.',
  );
});

test('rails are split into sequential halves', () => {
  assert.ok(
    /\.slice\(0,\s*splitAt\)/.test(source) && /\.slice\(splitAt\)/.test(source),
    'Expected the left rail to take the first half of the sorted articles and\n' +
      '    the right rail the remainder, so DOM order equals reading order.',
  );
});

test('the split point rounds up, keeping the extra tile on the newer side', () => {
  assert.ok(
    /Math\.ceil\(\s*railArticles\.length\s*\/\s*2\s*\)/.test(source),
    'Expected Math.ceil(length / 2): with an odd count the extra tile belongs\n' +
      '    on the left rail, which is the half holding the newer articles.',
  );
});

test('the centre feature is still the newest article', () => {
  assert.ok(
    /const feature[^=]*=\s*articles\[0\]/.test(source),
    'The spread opens on articles[0]; the props are documented newest-first.',
  );
});

test('the mobile lede reserves exactly as many lines as it renders', () => {
  /*
    ─── THE VOID ABOVE "READ MORE" ─────────────────────────────────────────

    Two rules, written apart, disagreeing about one number.

      .intel-feature-excerpt  (<=1100px)  --excerpt-lines: 7, sized with `1em`
                                          against its own 1.3rem
      .intel-feature-excerpt p (<=560px)  -webkit-line-clamp: 4 at 1rem

    Measured on a 393px phone: a 233px box holding 102px of text. 131px of
    the page's lead story was nothing at all, sitting directly above
    "Read More", and it was `height` rather than `max-height` that held it
    open.

    Neither rule was wrong alone. The clamp is a deliberate call — the full
    three-paragraph lede is ~580px of unbroken copy before a phone reader
    reaches any other article. They were simply never asked to agree.

    So the clamp reads the container's own count, and the container drops to
    the body size at that width so `1em` in its max-height means the same
    pixel as a rendered line.
  */
  const css = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles', 'modules', 'intel.css'),
    'utf8',
  );

  /* A CAP, NOT A RESERVATION. `height` holds the full count open whether or
     not there is text to fill it, which is what turned a short preview into
     a void. */
  assert.match(css, /\.intel-feature-excerpt \{[^}]*max-height: calc\(var\(--excerpt-lines\)/,
    'the excerpt must CAP its height, not reserve it; `height` re-opens the void ' +
      'for any preview shorter than the line count');
  assert.doesNotMatch(css, /\.intel-feature-excerpt \{[^}]*[^-]height: calc\(var\(--excerpt-lines\)/,
    'a fixed height on the excerpt is the original bug');

  /* ONE NUMBER. The clamp must not hardcode a count of its own. */
  const mobile = /@media \(max-width: 560px\) \{([\s\S]*?)\n\}/.exec(css);
  assert.ok(mobile, 'the 560px block is gone; this test no longer reads the file it thinks it does');
  assert.match(mobile[1], /-webkit-line-clamp: var\(--excerpt-lines\)/,
    'the mobile clamp must read --excerpt-lines, or it can disagree with the box again');
  assert.match(mobile[1], /\.intel-feature-excerpt \{[^}]*--excerpt-lines: \d+/,
    'the 560px block must set the count it clamps to');
  assert.match(mobile[1], /\.intel-feature-excerpt \{[^}]*font-size: 1rem/,
    'the container must match the paragraph size at this width, or `1em` in its ' +
      'max-height is not the height of a rendered line');
});

test('the excerpt fade only marks text that is actually cut', () => {
  /*
    The fade signals truncation. Unconditional, it dimmed the closing words of
    any preview short enough to finish inside the cap — punctuating a complete
    sentence as though it had been cut off. Now the component's own script
    sets `is-clipped` after it rebuilds the element, and the mask hangs off
    that.
  */
  const css = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles', 'modules', 'intel.css'),
    'utf8',
  );
  assert.match(css, /\.intel-feature-excerpt\.is-clipped \{[^}]*mask-image/,
    'the fade belongs to the clipped state');
  assert.doesNotMatch(css, /\.intel-feature-excerpt \{[^}]*mask-image/,
    'an unconditional fade dims the end of complete previews');

  assert.match(source, /function markClipped\(\)/, 'something has to set the clipped state');
  assert.match(source, /scrollHeight > excerpt\.clientHeight/,
    'overflow is the only reliable test for "was this cut"');
  /* Re-asked after every swap: rail articles do not share a paragraph count,
     and the server-rendered one never goes through paint(). */
  assert.ok(
    (source.match(/markClipped\(\)/g) ?? []).length >= 3,
    'markClipped must run on the server-rendered article AND after each swap, ' +
      'or the first view is the one view that never gets measured',
  );
});

test('a section heading never hyphenates or breaks inside a word', () => {
  /*
    ─── "PAST EVENT AR-CHIVE" ───────────────────────────────────────────────

    Reported from a phone. <SectionHeading /> was a flex ROW at every width,
    so on a 393px screen "PAST EVENT ARCHIVE" laid out inside 168px of a 329px
    header while "ALL PAST EVENTS" took the rest. Squeezed that hard it
    wrapped, and `hyphens: auto` finished the job.

    Both link-bearing headings had it: /intel's "Latest From The Channel" was
    over two lines at the same width for the same reason. The ones with no
    link already had the full measure.

    This lives in intel.css but the component is shared — /events, /intel,
    /featured and /author all render it — so a change here is a change to
    every one of them.
  */
  /*
    COMMENTS STRIPPED FIRST. The rules below explain themselves in prose that
    quotes the very declarations being banned — the note on .intel-break-title
    names `hyphens: auto` to say why it is gone. Matching the raw file makes
    the explanation trip the assertion, which is how this test failed on its
    own first run.
  */
  const css = fs
    .readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles', 'modules', 'intel.css'),
      'utf8',
    )
    .replace(/\/\*[\s\S]*?\*\//g, '');

  const title = /\.intel-break-title \{([^}]*)\}/.exec(css);
  assert.ok(title, '.intel-break-title is gone; this test no longer reads what it thinks it does');
  assert.match(title[1], /hyphens: none/,
    'hyphens: auto puts a hyphen inside a display heading — this is where AR-CHIVE came from');
  assert.doesNotMatch(title[1], /hyphens: auto/, 'auto hyphenation is the original bug');
  assert.match(title[1], /word-break: normal/,
    'word-break: break-word splits the word even without a hyphen');
  /* Kept: it only acts on a word that cannot fit its line at all, which is
     the one case where breaking beats overflowing the header. */
  assert.match(title[1], /overflow-wrap: break-word/,
    'a genuinely unbreakable word should still break rather than overflow');

  /*
    THE ROOT CAUSE IS THE ROW, NOT THE HYPHEN. Turning hyphenation off alone
    leaves the title wrapping in a third of the width; it just wraps without a
    hyphen. It needs the whole measure on a phone.
  */
  const head = /\.intel-break-head \{([^}]*)\}/.exec(css);
  assert.ok(head, '.intel-break-head is gone');
  assert.match(head[1], /flex-direction: column/,
    'the heading must stack on a phone so the title gets the full width');
  assert.match(css, /@media \(min-width: 768px\) \{\s*\.intel-break-head \{[^}]*flex-direction: row/,
    'and go back to a row once there is room for the title and its link side by side');
  /* 768 and not the 560 used elsewhere in this file: the root font-size drops
     to 80% at 768 and not before, so between 561 and 767 the type is at full
     size and the longest pair needs ~513px against ~496px of header. */
  assert.doesNotMatch(css, /@media \(min-width: 560px\) \{\s*\.intel-break-head/,
    'stacking must hold to 768px, where the root font-size actually drops');
});

console.log(`\n${passed} passed\n`);
