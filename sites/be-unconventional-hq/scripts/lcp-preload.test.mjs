/*
  A preloaded hero and the <img> that uses it must agree (#191).

  ─── THE BUG THIS GUARDS ──────────────────────────────────────────────────
  The first pass at the LCP work paired a `<picture>` using `media` queries
  with a `<link rel="preload">` pointing at the mobile URL. Those are two
  different selection algorithms, so on any desktop viewport the browser:

    1. fetched the 600px image at high priority, because we asked it to, then
    2. read the <picture>, chose the 1200px source, and fetched that as well.

  Two downloads, and the one the preload accelerated was the one thrown away —
  on the ticket whose entire purpose was a 3.9s LCP. Verified in the built
  output at the time: the featured hero requested w=600 and w=1200 together.

  The fix is `srcset` with `w` descriptors on a plain <img>, mirrored exactly
  by the preload's `imagesrcset`/`imagesizes`, so both run the same selection
  and precisely one candidate is fetched. This suite pins that pairing.

  These heroes are one image at three sizes, not art direction, so `<picture
  media>` was the wrong tool regardless.
*/
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Source with comments stripped, so prose about a pattern never trips a check. */
const code = (s) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Pages that preload their LCP hero, and the class on that hero. */
const HERO_PAGES = [
  { file: 'src/pages/featured/[slug].astro', heroClass: 'hero-backdrop-plate' },
  { file: 'src/components/EventAnnouncement.astro', heroClass: 'event-hero-bg-animated' },
  { file: 'src/components/EventFeatured.astro', heroClass: 'event-hero-bg-animated' },
];

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (error) { failures += 1; console.error(`  ✗ ${name}\n      ${error.message}`); }
}

console.log('\nPreloaded heroes select the same candidate the preload fetches');

for (const { file, heroClass } of HERO_PAGES) {
  const src = code(read(file));
  const name = file.split('/').slice(-2).join('/');

  check(`${name}: the hero is a plain <img srcset sizes>, not <picture media>`, () => {
    /* `<source media>` alongside a preload is the exact shape of the bug. */
    assert.ok(
      !/<source\s+media=/.test(src),
      'a <source media> is back; it cannot agree with a preload',
    );
    const img = src.match(new RegExp(`<img[\\s\\S]{0,600}?${heroClass}[\\s\\S]{0,400}?/>`));
    assert.ok(img, `could not find the hero <img> carrying .${heroClass}`);
    assert.match(img[0], /srcset=\{/, 'the hero <img> has no srcset');
    assert.match(img[0], /sizes=\{/, 'the hero <img> has no sizes');
  });

  check(`${name}: the preload mirrors that srcset and sizes`, () => {
    /*
      Compared by IDENTIFIER, not by value: both sides must read the same
      variable, so they cannot drift when the widths change. A preload with a
      bare href and no imagesrcset is the old bug wearing new clothes.
    */
    const layout = src.match(/<Layout[\s\S]*?>/);
    assert.ok(layout, 'no <Layout> opening tag found');
    const srcsetVar = src.match(new RegExp(`${heroClass}[\\s\\S]{0,400}?`))
      && src.match(/srcset=\{(\w+)\}/)?.[1];
    const sizesVar = src.match(/sizes=\{(\w+)\}/)?.[1];
    assert.ok(srcsetVar && sizesVar, 'could not resolve the srcset/sizes identifiers');
    assert.ok(
      new RegExp(`preloadImageSrcset=\\{${srcsetVar}`).test(layout[0]),
      `preloadImageSrcset must be fed from ${srcsetVar}, the same value the <img> uses`,
    );
    assert.ok(
      new RegExp(`preloadImageSizes=\\{[^}]*${sizesVar}`).test(layout[0]),
      `preloadImageSizes must be fed from ${sizesVar}`,
    );
  });

  check(`${name}: widths are declared once and reused`, () => {
    /* One array feeding both the srcset and the src keeps a fourth width from
       being added to one and not the other. */
    assert.match(src, /_WIDTHS\s*=\s*\[/, 'the widths are not declared as a single list');
  });
}

console.log('\nThe homepage preload');

/*
  The homepage's LCP element is the hero accordion's OPEN panel art
  (feat/homepage-v4), not the old Hero.astro banner. The preload must read the
  same story, the same srcset and the same `sizes` constant as that <img>, or
  it is a second download rather than a head start (the #191 bug above).
*/
check('index.astro preloads the open hero panel through Layout', () => {
  const src = code(read('src/pages/index.astro'));
  const layout = src.match(/<Layout[\s\S]*?>/);
  assert.ok(layout, 'no <Layout> opening tag found');
  assert.match(src, /const heroImage = feed\.hero\[0\]\?\.story/, 'the preload no longer reads panel 0');
  assert.match(layout[0], /preloadImage=\{heroImage\?\.image/, 'the hero preload is gone');
  assert.match(layout[0], /preloadImageSrcset=\{heroImage\?\.imageSrcset/, 'the preload lost its srcset');
  assert.match(layout[0], /preloadImageSizes=\{[^}]*HERO_SIZES/, 'the preload must use HERO_SIZES');
});

check('the open panel <img> reads the same srcset and HERO_SIZES', () => {
  const acc = code(read('src/components/home/HeroAccordion.astro'));
  const index = code(read('src/pages/index.astro'));
  for (const [name, src] of [['HeroAccordion.astro', acc], ['index.astro', index]]) {
    assert.match(
      src,
      /import \{[^}]*\bHERO_SIZES\b[^}]*\} from '(\.\.\/lib|\.\.\/\.\.\/lib)\/homepage-feed'/,
      `${name} must take HERO_SIZES from src/lib/homepage-feed.ts`,
    );
    assert.ok(!/HERO_SIZES\s*=/.test(src), `${name} redeclares HERO_SIZES locally`);
  }
  assert.match(acc, /const open = index === 0/, 'panel 0 must be the one rendered open');
  assert.match(acc, /srcset=\{story\.imageSrcset/);
  assert.match(acc, /sizes=\{[^}]*HERO_SIZES/);
});

check('index.astro does not set response headers on a prerendered page', () => {
  /*
    `Astro.response.headers.set()` is a no-op in a static build: the page is
    written to disk and there is no response object at request time. The RFC
    8288 Link header comes from public/_headers instead, which Cloudflare
    actually applies. Left in place it reads as working code and invites
    someone to "fix" the header by editing a line that never runs.
  */
  const src = code(read('src/pages/index.astro'));
  assert.ok(
    !/Astro\.response\.headers\.set/.test(src),
    'a response header is being set on a prerendered page, where it does nothing',
  );
  assert.match(read('public/_headers'), /Link: <\/\.well-known\/api-catalog>/);
});

console.log('\nLayout supports the full preload shape');

check('Layout emits imagesrcset and imagesizes, not just href', () => {
  const layout = read('src/layouts/Layout.astro');
  assert.match(layout, /imagesrcset=\{preloadImageSrcset/);
  assert.match(layout, /imagesizes=\{preloadImageSizes/);
  assert.match(layout, /fetchpriority="high"/);
});

console.log(
  failures === 0
    ? '\n✅ LCP preload checks passed.\n'
    : `\n❌ ${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
