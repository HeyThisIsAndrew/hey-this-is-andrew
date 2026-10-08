/*
  The homepage's LCP budget: what may and may not download or run while the
  hero art is loading. Each rule is a measured fix from the 2026-09-24
  PageSpeed investigation (mobile 92, desktop 99); see the comment at each
  source for the numbers.

    1. HERO_SIZES describes the OPEN PANEL, not the viewport, and uses the
       same strip width home.css does. `100vw` took YouTube's 1280px JPEG
       originals on desktop (660 KiB in PageSpeed's desktop report).
    2. Only the headline face (Syne) is preloaded. Preloading Inter as well
       split Slow 4G bandwidth with the hero art (real LCP 1.44s -> 1.10s).
    3. The homepage's compact Intel spread holds its images in data-defer-*
       until load. `loading="lazy"` alone does not: Chrome starts lazy images
       within 1,250px, and the spread is ~320px below the fold on a phone.
    4. The broken-image sweep in Layout ignores deferred images.
    5. Inline scripts are minified after the build, and only classic ones.
    6. The Instagram rail, the Watching rail and the ad rotator do not force
       layout at page load.

  Plain `node`, no build, no network.
*/
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HERO_SIZES, HERO_STRIP_WIDTH, firstPartyHeroSrcset, heroArtPath } from '../src/lib/homepage-feed.ts';
import { heroArtUpstream, parseHeroArtParams, webpWidth } from '../src/lib/hero-art.ts';
import { minifyInlineScripts } from '../src/lib/minify-inline-scripts.mjs';
import { getCardImageSources } from '../src/lib/card-images.ts';
import { readdirSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const code = (p) => read(p).replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}\n    ${err.message.split('\n').join('\n    ')}`);
  }
}

console.log('\nHomepage LCP budget');

test('HERO_SIZES is the open panel, not 100vw', () => {
  assert.notEqual(HERO_SIZES, '100vw', 'a 732px desktop panel must not ask for 1350px of art');
  assert.match(HERO_SIZES, /^\(max-width: 767px\) 100vw, /, 'phones (stacked) are still the full width');
  assert.match(HERO_SIZES, /\(orientation: landscape\) and \(max-height: 520px\) 100vw/, 'short landscape screens stack too');
});

test('HERO_SIZES uses the same strip width and gaps as home.css', () => {
  const css = read('src/styles/modules/home.css');
  const strip = css.match(/--strip:\s*(clamp\([^;]+\));/)?.[1];
  assert.ok(strip, 'home.css no longer declares --strip');
  assert.ok(HERO_SIZES.includes(`4 * ${strip}`), `HERO_SIZES must subtract four ${strip} strips (home.css --strip)`);
  assert.match(css, /--open-w:\s*calc\(100cqw - 4 \* var\(--strip\) - 24px\)/, 'home.css --open-w changed: update HERO_SIZES with it');
  assert.ok(HERO_SIZES.endsWith('- 24px)'), 'HERO_SIZES must subtract the four 6px gaps');
});

test('only the headline face is preloaded', () => {
  const layout = code('src/layouts/Layout.astro');
  assert.match(layout, /<Font cssVariable="--font-display" preload=\{true\} \/>/, 'Syne (the hero headline) keeps its preload');
  assert.match(layout, /<Font cssVariable="--font-body" preload=\{false\} \/>/, 'Inter must not be preloaded: it races the hero art on Slow 4G');
});

test('the compact Intel spread defers its images', () => {
  const rail = code('src/components/MagazineRail.astro');
  assert.match(rail, /<ArticleThumb[^>]*defer=\{compact\}/, 'compact rail thumbs must pass defer');
  const thumb = code('src/components/ArticleThumb.astro');
  assert.match(thumb, /data-defer-src=\{defer \?/, 'ArticleThumb must hold a deferred src in data-defer-src');
  assert.match(thumb, /src=\{defer \? undefined :/, 'a deferred thumb must not carry a real src');
  const mag = code('src/components/IntelMagazine.astro');
  assert.match(mag, /src=\{compact \? undefined :/, 'the compact feature image must not carry a real src');
  assert.match(mag, /initDeferredImages\(\)/, 'IntelMagazine must start the deferred-image loader');
  assert.match(mag, /cancelDeferredImage\(/, 'a swap must cancel a pending deferred source');
});

test('the deferred loader waits for load before looking ahead', () => {
  const lib = code('src/lib/deferred-images.ts');
  assert.match(lib, /addEventListener\('load'/, 'the look-ahead margin must wait for the load event');
  assert.match(lib, /observe\('0px'\)/, 'before load, only an image actually in view is filled');
});

test('the broken-image sweep skips deferred images', () => {
  const layout = code('src/layouts/Layout.astro');
  assert.match(layout, /querySelectorAll(<HTMLImageElement>)?\('img:not\(\[data-defer-src\]\)'\)/, 'an <img> with no src yet reads as broken to the sweep');
});

test('startup layout reads are gated on the section being near', () => {
  const gallery = code('src/components/CinematicGallery.astro');
  assert.match(gallery, /constructor\(\) \{\s*super\(\);[\s\S]{0,200}new IntersectionObserver/, 'the Instagram rail must build itself when near, not in the constructor');
  const watching = code('src/components/home/WatchingRail.astro');
  assert.match(watching, /gate\.observe\(track\)/, 'the Watching rail must wait until it is near before measuring');
  const rotator = code('src/components/CommercialRotator.astro');
  assert.match(rotator, /if \(progress\.classList\.contains\('is-counting'\)\)/, 'the first lap must not force a layout');
  const featured = code('src/components/FeaturedHighlights.astro');
  assert.doesNotMatch(featured, /void progress\.offsetWidth/, 'the Featured progress bar restarts over two frames, not a forced reflow');
});

test('the inline-script minifier minifies classic scripts only', () => {
  const fake = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
  const html =
    '<script>/* a long note */ var a = 1;</script>' +
    '<script type="module">/* keep */ x()</script>' +
    '<script type="application/ld+json">{"a": 1}</script>' +
    '<script type="text/partytown">/* keep */ y()</script>' +
    '<script src="/x.js"></script>';
  const out = minifyInlineScripts(html, fake);
  assert.match(out.html, /<script>var a = 1;<\/script>/);
  assert.match(out.html, /<script type="module">\/\* keep \*\/ x\(\)<\/script>/);
  assert.match(out.html, /\{"a": 1\}/);
  assert.match(out.html, /text\/partytown">\/\* keep \*\//);
  assert.equal(out.failed, 0);
});

test('a script the minifier cannot parse is left exactly as written', () => {
  const html = '<script>  broken ( </script>';
  const out = minifyInlineScripts(html, () => {
    throw new Error('parse');
  });
  assert.equal(out.html, html);
  assert.equal(out.failed, 1);
});

test('the hero art ladder is rewritten to our own origin, top rung and src untouched', () => {
  const id = 'Q5uT7qsvd20';
  const card = getCardImageSources(`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`);
  const out = firstPartyHeroSrcset(card.srcset);
  assert.match(out, new RegExp(`^${heroArtPath(id, HERO_STRIP_WIDTH)} ${HERO_STRIP_WIDTH}w, ${heroArtPath(id, 400)} 400w, `), 'a blurred-strip rung first, then the first-party ladder');
  assert.ok(out.includes(`${heroArtPath(id, 800)} 800w`), 'the phone rung must be first-party');
  assert.doesNotMatch(out, /wsrv\.nl/, 'no wsrv rung may be left on the hero');
  assert.ok(
    out.endsWith(`https://i.ytimg.com/vi/${id}/maxresdefault.jpg 1280w`),
    "the top rung stays YouTube's maxres: Layout's thumbnail recovery finds the risky rendition by it",
  );
  assert.match(card.src, /hqdefault\.jpg$/, 'src stays the guaranteed hqdefault floor');
  assert.equal(firstPartyHeroSrcset('https://substackcdn.com/image/fetch/w_400/x.jpg 400w'), 'https://substackcdn.com/image/fetch/w_400/x.jpg 400w', 'non-YouTube art is left alone');
});

test('each rewritten rung asks the route for the same wsrv rendition the page used to', () => {
  const id = 'Q5uT7qsvd20';
  const card = getCardImageSources(`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`);
  const wsrv = card.srcset.split(', ').filter((c) => c.includes('wsrv.nl')).map((c) => c.split(' ')[0].replace(/&amp;/g, '&'));
  assert.ok(wsrv.length >= 4);
  for (const url of wsrv) {
    const w = Number(url.match(/&w=(\d+)/)[1]);
    assert.equal(heroArtUpstream(id, w), url, `the route's upstream for ${w}w must be byte-identical, so it shares wsrv's warm cache`);
  }
});

test('the strip rung is small and low quality, and only a strip-sized slot can pick it', () => {
  assert.ok(HERO_STRIP_WIDTH < 400);
  assert.match(heroArtUpstream('Q5uT7qsvd20', HERO_STRIP_WIDTH), /&q=50&we$/, 'the strip rung is blurred on screen, so q=50');
  assert.match(heroArtUpstream('Q5uT7qsvd20', 800), /&q=85&we$/, 'every other rung keeps the quality the page always used');
  /* A closed strip is 130px (HERO_CLOSED_SIZES); at 1.75x that is 228px, so it
     takes 240w. An open panel is at least 412px, so even at 1x it needs 400w+. */
  assert.ok(130 * 1.75 <= HERO_STRIP_WIDTH && 412 > HERO_STRIP_WIDTH);
});

test('the hero art route is not an open proxy', () => {
  assert.deepEqual(parseHeroArtParams('Q5uT7qsvd20', '800.webp'), { id: 'Q5uT7qsvd20', width: 800 });
  assert.equal(parseHeroArtParams('Q5uT7qsvd20', '801.webp'), null, 'only the ladder widths');
  assert.equal(parseHeroArtParams('../../etc/pa', '800.webp'), null);
  assert.equal(parseHeroArtParams('Q5uT7qsvd20x', '800.webp'), null, 'an id is exactly 11 characters');
  assert.equal(parseHeroArtParams('Q5uT7qsvd20', '800.png'), null);
  /* read(), not code(): the Accept header's 'image/*' opens a "comment" for the naive stripper. */
  const route = read('src/pages/img/yt/[id]/[w].ts');
  assert.match(route, /export const prerender = false/);
  assert.match(route, /cache\.set\(false\)[\s\S]*cache\.set\(resized \? \{ maxAge/, 'nothing is edge-cached until it is known to be a real image');
});

test('webpWidth reads real WebP headers', () => {
  const dir = join(ROOT, 'public/article-images');
  const files = readdirSync(dir).filter((f) => /-(480|720)\.webp$/.test(f)).slice(0, 4);
  assert.ok(files.length > 0);
  for (const f of files) {
    const want = Number(f.match(/-(\d+)\.webp$/)[1]);
    const got = webpWidth(new Uint8Array(readFileSync(join(dir, f))));
    assert.ok(got !== null && got <= want && got > 120, `${f}: read ${got}px`);
  }
  assert.equal(webpWidth(new Uint8Array(40)), null, 'not a WebP');
});

test('the minifier is wired into the build', () => {
  const config = read('astro.config.mjs');
  assert.match(config, /minifyInlineScriptsIntegration\(\),/, 'astro.config.mjs must register the integration');
  assert.match(config, /'astro:build:done'/);
});

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed.\n`);
process.exit(failed === 0 ? 0 : 1);
