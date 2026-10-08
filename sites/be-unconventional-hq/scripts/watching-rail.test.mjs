/*
  "The HQ Is Watching" loop clones must be born visible.

  The rail loops by cloning its cards before and after the real set, one
  viewport BEFORE it scrolls into view. The cards carry `.reveal` (opacity 0
  until Layout.astro's shared observer sets `data-state`), so the originals
  were still hidden when copied, and the observer never watches the clones:
  12 of 12 stayed at opacity 0. Pressing an arrow or scrolling fast showed an
  empty rail until the recentre snapped back to the real cards (reported on
  desktop, reproduced and fixed on the built site).

  Static and offline: plain `node scripts/watching-rail.test.mjs`.
*/
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'src/components/home/WatchingRail.astro'), 'utf8');
const code = src.replace(/\/\*[\s\S]*?\*\//g, '');

const makeClone = code.slice(code.indexOf('const makeClone'), code.indexOf('const setWidth'));
assert.ok(makeClone.length > 0, 'makeClone() not found in WatchingRail.astro');
assert.match(
  makeClone,
  /classList\.remove\(\s*'reveal'\s*,\s*'animate-on-scroll'\s*\)/,
  'makeClone() must strip the reveal classes, or every clone stays at opacity 0',
);
assert.match(
  makeClone,
  /querySelectorAll<HTMLElement>\('\.reveal, \.animate-on-scroll'\)/,
  'and it must strip them from the clone\'s descendants, not only the <li>',
);

/*
  A fast trackpad fling must neither hit an edge nor shift at rest. Measured
  with one clone set per side: a left fling reached 195px from the scroller's
  start, and a 140ms debounce recentred mid-snap, landing 100px off and
  animating 79 more frames.
*/
assert.match(code, /copies = Math\.max\(2,/, 'at least two clone sets per side, so a fling cannot reach an edge');
const onScroll = code.slice(code.indexOf('const onScroll'), code.indexOf('const onScrollEnd'));
assert.match(onScroll, /if \(!hasScrollEnd\)/, 'the debounce recentre is only a fallback for browsers without scrollend');
const recentre = code.slice(code.indexOf('const recentre'), code.indexOf('const enableLoop'));
assert.match(recentre, /scrollSnapType = 'none'/, 'the recentre jump pauses snapping, so it lands pixel-identical');
assert.match(recentre, /Math\.round\(/, 'the recentre moves by whole sets');

/*
  Whole cards only, feathered at both edges. Reported on desktop: the
  right-most card was sliced by the rail's edge, because a fixed card width
  fitted whatever it fitted. fit() sizes a whole number of cards to fill the
  row; the track's inline padding is the fade, and snaps land inside it.
*/
const fit = code.slice(code.indexOf('const fit'), code.indexOf('const setWidth'));
assert.match(fit, /Math\.round\(\(room \+ gap\) \/ \(base \+ gap\)\)/, 'a whole number of cards, nearest the feed size');
assert.match(fit, /setProperty\('--rail-w'/, 'the card width is published for the CSS');
assert.match(code, /fit\(\);\s*onMedia\(\);/, 'size BEFORE the loop measures a set');
const css = fs.readFileSync(path.join(ROOT, 'src/styles/modules/home.css'), 'utf8');
const track = css.slice(css.indexOf('.home-v4 .rail-track {'), css.indexOf('.home-v4 .rail-track::-webkit-scrollbar'));
assert.match(track, /padding: 0\.75rem var\(--rail-fade\) 1\.5rem;/, 'the fade is the track\'s inline padding');
assert.match(track, /scroll-padding-inline: var\(--rail-fade\)/, 'snaps land a card inside the fade');
assert.match(track, /mask-image: linear-gradient\(\s*to right,\s*transparent 0,/, 'both edges feathered');
assert.match(css, /width: var\(--rail-w, min\(85vw, var\(--feed-card, 320px\)\)\)/, 'cards read the fitted width');

console.log('✅ Watching rail: clones born visible, flings clean, whole cards with feathered edges.');
