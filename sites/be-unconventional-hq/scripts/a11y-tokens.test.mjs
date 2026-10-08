/*
  THE DECORATIVE RED MUST NEVER BE TEXT.

  The palette has two reds and they are not interchangeable:

    --color-accent       #cc0000   3.21:1 on #111   borders, glows, outlines
    --color-accent-text  #ef4444   5.02:1 on #111   anything you read

  CLAUDE.md states it outright: #cc0000 "is a border and glow colour only,
  never a text or icon colour". WCAG AA wants 4.5:1 for body text, and 3.21
  is not it.

  This is pinned as a test because AUTOMATED TOOLS CANNOT SEE IT. Lighthouse
  and axe measure colour AT REST, not on hover or focus, which is exactly
  where the violation was: `.mini-event-row:hover .mini-event-name` used the
  decorative red and the site still scored 100/100 accessibility. Only reading
  the CSS finds it.

  Contrast figures recomputed here rather than quoted, so the thresholds
  cannot drift away from the tokens they describe.
*/
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readdirSync, statSync } from 'node:fs';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed += 1; }
  catch (e) { console.log(`  ✗ ${name}\n    ${e.message}`); failed += 1; }
}

/** WCAG relative luminance and contrast ratio. */
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.substr(i, 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

/** Every .astro / .css / .tsx file under src/, recursively. */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(astro|css|tsx|ts)$/.test(name)) out.push(p);
  }
  return out;
}

console.log('Accessible colour tokens:');

test('the two reds still mean what the rule says they mean', () => {
  /* The reds live in the THEME file; --color-surface is in global-base. */
  const theme = readFileSync(join(ROOT, 'src/styles/theme-red.css'), 'utf8');
  const base = readFileSync(join(ROOT, 'src/styles/global-base.css'), 'utf8');
  const tok = (name, from = theme) =>
    (from.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`)) ?? [])[1];
  const accent = tok('--color-accent');
  const accentText = tok('--color-accent-text');
  const surface = tok('--color-surface', base) ?? '#111111';
  assert.ok(accent && accentText, 'both red tokens must exist');

  const decorative = ratio(accent, surface);
  const readable = ratio(accentText, surface);
  assert.ok(
    decorative < 4.5,
    `--color-accent is now ${decorative.toFixed(2)}:1 and would PASS as text. ` +
      'If that is deliberate, this whole guard can go; if it drifted, it is a bug.',
  );
  assert.ok(
    readable >= 4.5,
    `--color-accent-text is ${readable.toFixed(2)}:1 and fails WCAG AA. It is the ` +
      'token everything legible depends on.',
  );
});

test('--color-accent is never used as a text or icon colour', () => {
  /*
    Matches `color: var(--color-accent)` and its fallback form, but NOT
    `background-color`, `border-color`, `outline-color`, `caret-color`, or
    `--color-accent-text`. Decoration is what the token is for.
  */
  const offenders = [];
  for (const file of walk(join(ROOT, 'src'))) {
    const text = readFileSync(file, 'utf8');
    text.split('\n').forEach((line, i) => {
      // A `color:` declaration not preceded by background-/border-/outline-/caret-
      if (!/(^|[;{\s])color:\s*var\(--color-accent[,)]/.test(line)) return;
      offenders.push(`${file.replace(ROOT + '/', '')}:${i + 1}  ${line.trim().slice(0, 78)}`);
    });
  }
  assert.deepEqual(
    offenders,
    [],
    'These paint TEXT with the decorative red (3.21:1, fails WCAG AA).\n' +
      '      Use --color-accent-text (#ef4444, 5.02:1) instead:\n\n        ' +
      offenders.join('\n        ') + '\n',
  );
});

test('a hidden subtree is out of the TAB order, and inert only where nothing is visible', () => {
  /*
    `aria-hidden` removes a subtree from the ACCESSIBILITY TREE but leaves it
    in the TAB ORDER. A keyboard user can land on a control inside something
    nobody can see, and it announces nothing, because the tree says it is not
    there. axe rates this serious (`aria-hidden-focus`).

    ─── THE PART THIS TEST GOT WRONG THE FIRST TIME ──────────────────────────

    The original version of this test required `inert` beside every
    `aria-hidden`, and that shipped a production bug.

    `inert` removes a subtree from the tab order, which was the goal. It ALSO
    disables pointer events on everything inside it. The Instagram carousel is
    a MARQUEE: all fifteen groups scroll through the visible area, and thirteen
    of them were `inert`. So most of the tiles a visitor could see were dead to
    clicks. Reported from production as "the tiles are not clickable".

    The rule is therefore about the TAB ORDER, not about `inert`:

      - VISIBLE duplicates (marquee groups and their clones) use
        `tabindex="-1"` on the links. Out of sequential focus navigation,
        which is what the axe rule measures, still clickable by pointer.
      - GENUINELY HIDDEN subtrees, like a collapsed stage pane nobody can
        reach or click, use `inert`. There is nothing to click, so removing
        pointer events costs nothing.

    Both are pinned below, and `inert` is explicitly banned from the carousel.
  */
  const gallery = readFileSync(join(ROOT, 'src/components/CinematicGallery.astro'), 'utf8');

  /* Strip comments: the fix is explained at length in this file and the word
     `inert` appears throughout that prose. Only real attributes count. */
  const galleryCode = gallery
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  assert.ok(
    !/\binert\b/.test(galleryCode),
    'The Instagram carousel must NOT use inert. Every marquee group scrolls through the visible ' +
      'area, and inert disables pointer events, so the tiles stop being clickable. This exact ' +
      'regression reached production. Use tabindex="-1" on the links instead.',
  );
  /* Every group after the FIRST: groups 3-5 were once the only hidden ones,
     so group 2 was a second readable, tabbable copy of every post on desktop. */
  assert.match(
    galleryCode,
    /aria-hidden=\{groupIndex > 1 \? "true" : undefined\}/,
    'every marquee group after the first must be aria-hidden, or each post is announced twice',
  );
  assert.match(
    galleryCode,
    /tabindex=\{groupIndex > 1 \? -1 : undefined\}/,
    'the duplicate marquee groups must take their links out of the tab order with tabindex="-1"',
  );
  assert.match(
    galleryCode,
    /clone\.querySelectorAll\('a'\)\.forEach\(\(a\) => a\.setAttribute\('tabindex', '-1'\)\)/,
    'the JS-cloned groups must too — there are up to ten of them, and they are the ones axe ' +
      'actually flagged',
  );

  /*
    The hub stage panes are the opposite case and keep `inert`: a collapsed
    pane is not on screen, so there is nothing to click and removing pointer
    events costs nothing. Dropping it there would put the Play button of every
    inactive pane back in the tab order.
  */
  const hub = readFileSync(join(ROOT, 'src/pages/featured/[slug].astro'), 'utf8');
  assert.match(hub, /pane\.toggleAttribute\('inert', !on\)/,
    'show() must keep inert in step with aria-hidden on the stage panes, or the ' +
      'active pane keeps its Play button unreachable');
});

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed.\n`);
process.exit(failed === 0 ? 0 : 1);
