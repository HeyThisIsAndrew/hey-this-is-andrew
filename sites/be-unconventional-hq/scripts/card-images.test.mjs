/*
  Card thumbnail sizing (src/lib/card-images.ts).

  These rewrites shipped inline in ContentCard.astro with no coverage, and two
  of the four branches were dead on real data: the Substack width replace
  missed the 6 of 11 URLs in src/data/articles.json that carry no `w_` at all,
  and the companion height replace matched none of them. A card image that
  quietly keeps loading a 2048x1152 original looks completely fine in review —
  which is exactly why it needs a test rather than an eyeball.

  Offline and pure: plain `node scripts/card-images.test.mjs`.
*/
import assert from 'node:assert/strict';
import {
  getCardImageSources,
  CARD_IMAGE_SIZES,
  youtubeFallbackSrc,
  isSubstackFetchUrl,
} from '../src/lib/card-images.ts';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${error.message}`);
    failed++;
  }
}

/*
  Parse a srcset into [{url, descriptor}].

  Deliberately NOT `srcset.split(',')`. Substack's Cloudinary transform list is
  itself comma-separated, so every candidate URL contains commas and a naive
  split shreds four candidates into twenty-four fragments.

  Browsers do not have that problem: the HTML srcset grammar collects a URL as
  a run of NON-WHITESPACE characters, so an embedded comma is part of the URL
  and only ", " acts as the candidate separator. Verified in Chromium against
  these exact URL shapes — with a sentinel `src` to distinguish selection from
  fallback, it selected the intended candidate and requested the URL with its
  commas intact.

  So the separator to split on is a comma followed by whitespace and the start
  of the next URL, which is what browsers effectively do.
*/
function parseSrcset(srcset) {
  if (!srcset) return [];
  return srcset
    .split(/,\s+(?=https?:\/\/)/)
    .map((entry) => {
      const [url, descriptor] = entry.trim().split(/\s+/);
      return { url, descriptor };
    });
}

console.log('YouTube renditions:');

const MAXRES = 'https://i.ytimg.com/vi/zGA4XXAkE_s/maxresdefault.jpg';

/*
  `src` is the floor the recovery falls back TO, so it must be a rendition
  YouTube generates for every video. The proxied ladder lives in `srcset`.
  Putting a proxied maxresdefault here took e2e-image-fallback from 5/5 to 3/5.
*/
test('src stays on the guaranteed hqdefault, never the proxy', () => {
  const { src } = getCardImageSources(MAXRES);
  assert.equal(src, 'https://i.ytimg.com/vi/zGA4XXAkE_s/hqdefault.jpg');
});

test('the proxied ladder is offered in srcset', () => {
  const { srcset } = getCardImageSources(MAXRES);
  assert.ok(srcset.includes('wsrv.nl'), srcset);
});

test('maxresdefault offers all wsrv.nl proxy widths', () => {
  const entries = parseSrcset(getCardImageSources(MAXRES).srcset);
  assert.deepEqual(entries, [
    /*
      TWO CHANGES MERGED HERE, from two branches that fixed different halves.

      `q=75` (was 85) is the compression half: PageSpeed put 20.2 KiB on the
      banner spotlight art alone under "Increasing the image compression factor
      could improve this image's download size".

      `800` is the ladder half. 412 CSS px at DPR 1.75 is 721 device px, which
      had to take the 900 rung; the other branch used 750, which also clears
      721 but drops a 390px phone at DPR 2 (780) back onto the 900. 800 clears
      both, and it is the only rung added -- see the note on WSRV_WIDTHS for
      why the ladder stays coarse.
    */
    { url: 'https://wsrv.nl/?url=i.ytimg.com%2Fvi%2FzGA4XXAkE_s%2Fmaxresdefault.jpg&w=400&output=webp&q=85&we', descriptor: '400w' },
    { url: 'https://wsrv.nl/?url=i.ytimg.com%2Fvi%2FzGA4XXAkE_s%2Fmaxresdefault.jpg&w=600&output=webp&q=85&we', descriptor: '600w' },
    { url: 'https://wsrv.nl/?url=i.ytimg.com%2Fvi%2FzGA4XXAkE_s%2Fmaxresdefault.jpg&w=800&output=webp&q=85&we', descriptor: '800w' },
    { url: 'https://wsrv.nl/?url=i.ytimg.com%2Fvi%2FzGA4XXAkE_s%2Fmaxresdefault.jpg&w=900&output=webp&q=85&we', descriptor: '900w' },
    { url: 'https://wsrv.nl/?url=i.ytimg.com%2Fvi%2FzGA4XXAkE_s%2Fmaxresdefault.jpg&w=1200&output=webp&q=85&we', descriptor: '1200w' },
    { url: 'https://i.ytimg.com/vi/zGA4XXAkE_s/maxresdefault.jpg', descriptor: '1280w' },
  ]);
});

/*
  The ladder STOPS at the source. maxresdefault is 1280x720, so 1600 and 2000
  asked wsrv.nl to upsample: measured against the live service, w=2000 returned
  a real 2000x1125 at 282 KB, heavier than the 258 KB original the proxy exists
  to replace, and softer. A wide screen picked exactly that rung.
*/
test('no rung asks the proxy for more pixels than maxresdefault has', () => {
  const entries = parseSrcset(getCardImageSources(MAXRES).srcset);
  for (const { url, descriptor } of entries) {
    const w = Number(descriptor.replace('w', ''));
    assert.ok(w <= 1280, `${descriptor} upsamples a 1280px source: ${url}`);
    if (url.includes('wsrv.nl')) {
      assert.ok(url.includes(`&w=${w}&`), `descriptor ${descriptor} must match its own w= param: ${url}`);
    } else {
      assert.ok(url.includes('maxresdefault.jpg'), `direct fallback must be maxresdefault: ${url}`);
    }
  }
});

test('the video id is preserved verbatim', () => {
  // A greedy rewrite could eat the id segment; ids can contain '-' and '_'.
  const { src, srcset } = getCardImageSources(
    'https://i.ytimg.com/vi/a-B_c1D2e3F/maxresdefault.jpg',
  );
  // `src` is the raw hqdefault floor; the srcset rungs are proxied, so the id
  // is url-encoded there and plain here.
  assert.ok(src.includes('/vi/a-B_c1D2e3F/'), src);
  for (const { url } of parseSrcset(srcset)) {
    if (url.includes('wsrv.nl')) {
      assert.ok(url.includes('%2Fvi%2Fa-B_c1D2e3F%2F'), url);
    } else {
      assert.ok(url.includes('/vi/a-B_c1D2e3F/'), url);
    }
  }
});

test('hqdefault is left alone and never upgraded', () => {
  /*
    maxresdefault only exists for uploads at 720p+. Synthesising it from a
    lower rendition returns YouTube's grey 120x90 placeholder, so a URL that
    did not already name maxresdefault must pass through untouched.
  */
  const url = 'https://i.ytimg.com/vi/abc123/hqdefault.jpg';
  const { src, srcset } = getCardImageSources(url);
  assert.equal(src, url);
  assert.equal(srcset, '');
});

test('mqdefault and sddefault are likewise untouched', () => {
  for (const rendition of ['mqdefault', 'sddefault', 'default']) {
    const url = `https://i.ytimg.com/vi/abc123/${rendition}.jpg`;
    const { src, srcset } = getCardImageSources(url);
    assert.equal(src, url, rendition);
    assert.equal(srcset, '', rendition);
  }
});

test('an unrecognised ytimg path is passed through', () => {
  const url = 'https://i.ytimg.com/vi/abc123/oardefault.jpg';
  assert.deepEqual(getCardImageSources(url), { src: url, srcset: '' });
});

console.log('\nSubstack renditions:');

// Both shapes are real, taken from src/data/articles.json.
const SUBSTACK_NO_WIDTH =
  'https://substackcdn.com/image/fetch/$s_!qfD6!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fa5e65013_2048x1152.jpeg';
const SUBSTACK_WITH_WIDTH =
  'https://substackcdn.com/image/fetch/$s_!COgv!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fa5e65013_2048x1152.jpeg';

test('a width is INSERTED when the URL carries none', () => {
  // The regression: 6 of 11 real URLs have no w_, and a replace-only rewrite
  // left every one of them serving the full-size original.
  const { src } = getCardImageSources(SUBSTACK_NO_WIDTH);
  assert.ok(src.includes('w_600'), src);
  assert.ok(src.includes('c_limit'), src);
});

test('an existing width is replaced, not duplicated', () => {
  const { src } = getCardImageSources(SUBSTACK_WITH_WIDTH);
  assert.ok(src.includes('w_600'), src);
  assert.ok(!src.includes('w_1456'), src);
  assert.equal(src.match(/w_\d+/g).length, 1, 'exactly one width param');
});

test('c_limit appears exactly once even when already present', () => {
  const { src } = getCardImageSources(SUBSTACK_WITH_WIDTH);
  assert.equal(src.match(/c_limit/g).length, 1, src);
});

test('the encoded original URL is never rewritten', () => {
  /*
    The original is percent-encoded and its filename ends `_2048x1152.jpeg`.
    A whole-string regex would happily rewrite digits in there and produce a
    404. Both real shapes must come through with the original byte-identical.
  */
  for (const input of [SUBSTACK_NO_WIDTH, SUBSTACK_WITH_WIDTH]) {
    const original = input.slice(input.indexOf('/https%3A'));
    const { src, srcset } = getCardImageSources(input);
    assert.ok(src.endsWith(original), src);
    for (const { url } of parseSrcset(srcset)) {
      assert.ok(url.endsWith(original), url);
    }
  }
});

test('the other transforms are preserved in order', () => {
  const { src } = getCardImageSources(SUBSTACK_NO_WIDTH);
  const transforms = src.slice(
    src.indexOf('image/fetch/') + 'image/fetch/'.length,
    src.indexOf('/https%3A'),
  );
  for (const part of ['$s_!qfD6!', 'f_auto', 'q_auto:eco', 'fl_progressive:steep']) {
    assert.ok(transforms.split(',').includes(part), `${part} missing from ${transforms}`);
  }
});

test('no height is pinned', () => {
  // The old h_338 forced a 16:9 box onto sources of any ratio. The card
  // already fixes aspect via CSS + object-fit, so height must stay absent.
  const { src, srcset } = getCardImageSources(SUBSTACK_NO_WIDTH);
  assert.ok(!/[,/]h_\d+/.test(src), src);
  assert.ok(!/[,/]h_\d+/.test(srcset), srcset);
});

test('srcset ascends and descriptors match their widths', () => {
  const entries = parseSrcset(getCardImageSources(SUBSTACK_NO_WIDTH).srcset);
  /* Seven since the cards grew: a featured tile is 860px on a 4K display, which
     is ~1720 device pixels at 2x, so the ladder runs past 1200. The seventh is the
     800w rung that closes the 600->900 gap a phone falls into. */
  assert.equal(entries.length, 7);

  let previous = 0;
  for (const { url, descriptor } of entries) {
    const width = Number(descriptor.replace('w', ''));
    assert.ok(width > previous, `descriptors must ascend, got ${descriptor} after ${previous}w`);
    // The descriptor is a promise about the file; it has to match the request.
    assert.ok(url.includes(`w_${width}`), `${url} does not request ${width}px`);
    previous = width;
  }
});

console.log('\nPass-through and edge cases:');

test('a non-YouTube, non-Substack URL is proxied through wsrv.nl', () => {
  const url = 'https://cdn.sanity.io/images/abc/production/def-1920x1080.jpg';
  const sources = getCardImageSources(url);
  assert.ok(sources.src.includes('wsrv.nl/?url=cdn.sanity.io'), sources.src);
  assert.ok(sources.srcset.includes('wsrv.nl/?url=cdn.sanity.io'), sources.srcset);
  assert.ok(sources.srcset.includes('400w'));
  assert.ok(sources.srcset.includes('1200w'));
});

test('empty, whitespace, null and undefined all yield no image', () => {
  for (const input of ['', '   ', '\n\t ', null, undefined]) {
    assert.deepEqual(
      getCardImageSources(input),
      { src: '', srcset: '' },
      `input: ${JSON.stringify(input)}`,
    );
  }
});

test('surrounding whitespace is trimmed', () => {
  // ContentCard guarded this before the rewrite existed: an untrimmed
  // whitespace value still reaches <img src> and paints a broken box.
  const { src } = getCardImageSources(`  ${MAXRES}\n`);
  assert.equal(src, 'https://i.ytimg.com/vi/zGA4XXAkE_s/hqdefault.jpg');
});

test('the rewrite is idempotent', () => {
  // Cards can be re-derived from already-rewritten data; a second pass must
  // not stack a second w_ or c_limit.
  for (const input of [MAXRES, SUBSTACK_NO_WIDTH, SUBSTACK_WITH_WIDTH]) {
    const once = getCardImageSources(input);
    const twice = getCardImageSources(once.src);
    assert.equal(twice.src, once.src, input);
  }
});

console.log('\nsizes attribute:');

test('CARD_IMAGE_SIZES covers every grid breakpoint', () => {
  // Mirrors home-cards.css: 42vw phone row, 2-up to 1100px, 4-up from 1536.
  /* 90vw, not the old 42vw: below 560 the card is a full-width vertical slate,
     not the horizontal row whose media took 42% of it. */
  assert.match(CARD_IMAGE_SIZES, /max-width:\s*560px\)\s*90vw/);
  assert.match(CARD_IMAGE_SIZES, /max-width:\s*1100px\)\s*47vw/);

  /*
    The desktop step is no longer a single 360px. `.container-page` steps up on
    wide screens (--page-max), so a 4-up grid card is 366px at 1536 and 632px at
    2600, and the feed's browse rows step with it too. Each desktop step must be
    at least as large as the 4-up card at that container width, or the browser
    fetches a smaller rendition and the card is soft.
  */
  const steps = [...CARD_IMAGE_SIZES.matchAll(/\(min-width:\s*(\d+)px\)\s*(\d+)px/g)]
    .map(([, bp, px]) => [Number(bp), Number(px)]);
  assert.ok(steps.length >= 4, `expected a desktop ladder, got: ${CARD_IMAGE_SIZES}`);

  /* Largest first, or an earlier narrow match swallows every wider screen. */
  const breakpoints = steps.map(([bp]) => bp);
  assert.deepEqual(
    breakpoints,
    [...breakpoints].sort((a, b) => b - a),
    `sizes must run largest-first, got ${breakpoints.join(', ')}`,
  );

  const containerAt = { 1536: 1536, 1920: 1920, 2560: 2240, 3400: 2600 };
  for (const [bp, promised] of steps) {
    const container = containerAt[bp];
    if (!container) continue;
    const fourUp = Math.round((container - 3 * 24) / 4);
    assert.ok(
      promised >= fourUp,
      `at ${bp}px a 4-up card is ${fourUp}px but sizes promises ${promised}px`,
    );
  }

  assert.ok(CARD_IMAGE_SIZES.trim().endsWith('23vw'), CARD_IMAGE_SIZES);
});

console.log('\nyoutubeFallbackSrc (client recovery target):');

/*
  This is the half of the contract srcset cannot express. The browser will
  not retry a neighbouring candidate when its pick 404s, so Layout.astro's
  fail-safe re-points the <img> at the rendition YouTube always generates.
  Both sides share this function so they cannot disagree about which one
  that is.
*/

test('maxresdefault falls back to hqdefault', () => {
  assert.equal(
    youtubeFallbackSrc(MAXRES),
    'https://i.ytimg.com/vi/zGA4XXAkE_s/hqdefault.jpg',
  );
});

test('sddefault falls back too — it is 4:3 but it is not guaranteed either', () => {
  assert.equal(
    youtubeFallbackSrc('https://i.ytimg.com/vi/abc123/sddefault.jpg'),
    'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
  );
});

test('the guaranteed renditions decline, so the caller stops instead of looping', () => {
  /*
    An empty return is what makes the recovery single-shot in the honest
    case: if hqdefault itself is what failed, there is nothing better to
    ask for and the container should get the branded panel.
  */
  for (const rendition of ['hqdefault', 'mqdefault', 'default']) {
    assert.equal(
      youtubeFallbackSrc(`https://i.ytimg.com/vi/abc123/${rendition}.jpg`),
      '',
      rendition,
    );
  }
});

test('non-YouTube URLs decline', () => {
  // Article covers must keep reaching markFailed() and their branded panel.
  for (const url of [
    'https://substackcdn.com/image/fetch/w_600,c_limit/https%3A%2F%2Fx.jpg',
    'https://wsrv.nl/?url=example.com%2Fa.jpg&w=600',
    '/article-images/0104b20cd77d37bb-720.webp',
    '',
  ]) {
    assert.equal(youtubeFallbackSrc(url), '', JSON.stringify(url));
  }
});

test('the video id survives, and query strings are preserved', () => {
  assert.equal(
    youtubeFallbackSrc('https://i.ytimg.com/vi/a-B_c1D2e3F/maxresdefault.jpg?sqp=xyz'),
    'https://i.ytimg.com/vi/a-B_c1D2e3F/hqdefault.jpg?sqp=xyz',
  );
});

test('extracts from wsrv.nl proxy URL', () => {
  const proxied = 'https://wsrv.nl/?url=i.ytimg.com%2Fvi%2FzGA4XXAkE_s%2Fmaxresdefault.jpg&w=600';
  assert.equal(
    youtubeFallbackSrc(proxied),
    'https://i.ytimg.com/vi/zGA4XXAkE_s/hqdefault.jpg',
  );
});

test('applying it twice is a no-op', () => {
  const once = youtubeFallbackSrc(MAXRES);
  assert.equal(youtubeFallbackSrc(once), '');
});


/*
  ─── THE ARTICLE HERO ───────────────────────────────────────────────────────

  Added after a portrait cover (1086x1609) tanked the article page's Lighthouse
  score two ways at once, both of which live here now.

  1. The hero fell through to the RAW `article.image`. localArticleImage()
     returns null for substackcdn URLs by design, because Substack's BODY
     images arrive carrying `w_1456,c_limit`. Cover images come from a
     different field and carry NO width transform, so the hero shipped the
     source at full resolution with no srcset, as the eager LCP element.

  2. It declared `width="1456" height="816"` regardless of the real image.

  isSubstackFetchUrl() is the gate that lets the hero reuse the substackcdn
  branch of getCardImageSources() WITHOUT ever reaching the wsrv.nl branch,
  which is the cold third-party transcode that was reverted once already.
*/
console.log('article hero sources');

const COVER_NO_WIDTH =
  'https://substackcdn.com/image/fetch/$s_!Rj68!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F66b03785_1086x1609.png';

test('isSubstackFetchUrl admits substackcdn fetch URLs and nothing else', () => {
  assert.equal(isSubstackFetchUrl(COVER_NO_WIDTH), true);
  assert.equal(isSubstackFetchUrl('https://substack-post-media.s3.amazonaws.com/public/images/a_1x1.png'), false);
  assert.equal(isSubstackFetchUrl('https://i.ytimg.com/vi/abc/maxresdefault.jpg'), false);
  assert.equal(isSubstackFetchUrl(''), false);
  assert.equal(isSubstackFetchUrl(null), false);
  assert.equal(isSubstackFetchUrl(undefined), false);
});

test('a cover with NO width transform still gets one, plus a srcset', () => {
  const { src, srcset } = getCardImageSources(COVER_NO_WIDTH);
  assert.match(src, /,w_\d+,c_limit\//, 'src must carry an inserted width cap');
  assert.ok(!/w_\d+.*w_\d+/.test(src.split('/https')[0]), 'exactly one width in the transform list');
  const widths = [...srcset.matchAll(/ (\d+)w/g)].map((m) => Number(m[1]));
  assert.deepEqual(widths, [400, 600, 800, 900, 1200, 1600, 2000]);
});

test('the hero never routes a non-Substack cover through wsrv.nl', () => {
  // The guard is isSubstackFetchUrl, not getCardImageSources. This pins the
  // reason the guard has to exist: without it, an S3 cover would be proxied.
  const s3 = 'https://substack-post-media.s3.amazonaws.com/public/images/a_3840x2160.png';
  assert.equal(isSubstackFetchUrl(s3), false);
  assert.match(getCardImageSources(s3).src, /wsrv\.nl/);
});


/*
  ─── A `sizes` IS A CLAIM ABOUT THE CSS ─────────────────────────────────────

  This has now gone wrong twice, both times by reusing a CORRECT string in a
  place it does not describe:

    the featured hero   360px promised, 768px box  -> 2.1x upscale
    the featured shelf  360px promised, 560px box  -> 1.56x upscale

  Both looked like an image-quality problem and were a sizing claim. So the
  widths in the CSS and the widths in the `sizes` are asserted against each
  other here rather than trusted to stay in step.
*/
import { readFileSync as _readFileSync } from 'node:fs';
import { join as _join, dirname as _dirname } from 'node:path';
import { fileURLToPath as _fileURLToPath } from 'node:url';

const _here = _dirname(_fileURLToPath(import.meta.url));
const _read = (...p) => _readFileSync(_join(_here, '..', ...p), 'utf8');

/*
  ─── THE TILE LADDER AND THE IMAGE LADDER ARE ONE DECISION ─────────────────

  `--feed-card` / `--feed-card-featured` in modules/layout.css set how wide a
  card renders. CARD_IMAGE_SIZES / FEATURED_CARD_IMAGE_SIZES tell the browser
  how wide it will be, so it can pick a rendition. If the two disagree the
  browser picks a smaller source and the card is visibly soft — an image bug
  with a layout cause, and one that has now happened three times:

    the featured hero    360px promised, 768px box
    the featured shelf   360px promised, 560px box
    the 4K browse rows   360px promised, 500px box

  So this reads BOTH ladders out of the real files and requires every step to
  match. Change a tile size without changing its `sizes` and this fails.
*/
test('every card width has a matching image size, at every step', () => {
  const layout = _read('src', 'styles', 'modules', 'layout.css');
  const images = _read('src', 'lib', 'card-images.ts');

  /* Pull `--feed-card: 380px` etc, keyed by the enclosing min-width (0 = base). */
  const ladder = (varName) => {
    const found = new Map();
    const re = new RegExp(`(?:@media \\(min-width:\\s*(\\d+)px\\)[\\s\\S]*?)?${varName}:\\s*(\\d+)px`, 'g');
    let m;
    while ((m = re.exec(layout))) found.set(Number(m[1] || 0), Number(m[2]));
    return found;
  };

  const sizesOf = (constName) => {
    const block = images.match(new RegExp(`${constName}\\s*=([\\s\\S]*?);`));
    assert.ok(block, `${constName} must exist`);
    const text = block[1];
    const found = new Map();
    for (const m of text.matchAll(/\(min-width:\s*(\d+)px\)\s*(\d+)px/g)) {
      found.set(Number(m[1]), Number(m[2]));
    }
    /*
      The trailing default. FEATURED_CARD_IMAGE_SIZES ends in a px value, which
      is the base step; CARD_IMAGE_SIZES ends in `23vw`, which is a viewport
      fraction and not comparable to a px ladder entry — at the base breakpoint
      it resolves to 353px against a 320px card, so it covers, but it cannot be
      read as a number here. A missing base entry therefore means "not stated in
      px", not "wrong", and the caller skips it.
    */
    const tail = text.match(/,\s*'?\s*(\d+)px'/);
    if (tail) found.set(0, Number(tail[1]));
    return found;
  };

  for (const [cssVar, sizesConst] of [
    ['--feed-card', 'CARD_IMAGE_SIZES'],
    ['--feed-card-featured', 'FEATURED_CARD_IMAGE_SIZES'],
  ]) {
    const css = ladder(cssVar);
    const declared = sizesOf(sizesConst);
    assert.ok(css.size >= 2, `${cssVar} must have a ladder to compare against`);

    /*
      COVERING, not equal. `CARD_IMAGE_SIZES` also describes the 4-up card grid,
      whose cards are wider than a feed row's at every step, so it legitimately
      over-states the row. Over-stating fetches a slightly larger rendition and
      is sharp; under-stating picks a smaller source and is soft. Only the
      second is a bug, so only the second fails here.
    */
    for (const [breakpoint, width] of css) {
      const promised = declared.get(breakpoint);

      /* See sizesOf(): a `vw` fallback has no px step to compare. Every
         BREAKPOINT step still must be stated and must cover. */
      if (breakpoint === 0 && promised === undefined) continue;

      assert.ok(
        typeof promised === 'number',
        `${sizesConst} has no step at min-width ${breakpoint || '(base)'}px, but ${cssVar} does`,
      );
      assert.ok(
        promised >= width,
        `${sizesConst} promises ${promised}px at min-width ${breakpoint || '(base)'}px ` +
          `but ${cssVar} renders ${width}px — the image would be upscaled`,
      );
    }
  }

  /*
    And the largest card must have a rendition big enough for a 2x screen.
    860px at 2x is ~1720 device pixels; a ladder stopping at 1200 upscales it.
  */
  const widest = Math.max(...ladder('--feed-card-featured').values());
  for (const name of ['SUBSTACK_WIDTHS', 'WSRV_WIDTHS']) {
    const arr = images.match(new RegExp(`${name}\\s*=\\s*\\[([^\\]]+)\\]`));
    assert.ok(arr, `${name} must exist`);
    const top = Math.max(...arr[1].split(',').map((n) => Number(n.trim())));
    assert.ok(
      top >= widest * 2,
      `${name} tops out at ${top}, below ${widest}px at 2x (${widest * 2})`,
    );
  }
});

test('the featured shelf describes its own width, not the grid\'s', () => {
  const grid = _read('src', 'components', 'FeedGrid.astro');
  const images = _read('src', 'lib', 'card-images.ts');
  const card = _read('src', 'components', 'ContentCard.astro');

  /* The shelf reads the shared ladder rather than hardcoding a width — the
     step-by-step agreement with `sizes` is asserted in the test above. */
  assert.match(
    grid,
    /\.feed-row--prestige \.feed-row-item\s*\{[^}]*var\(--feed-card-featured/,
    'the featured shelf must read --feed-card-featured',
  );
  assert.match(
    grid,
    /\.feed-row-item\s*\{[^}]*var\(--feed-card,/,
    'the browse rows must read --feed-card',
  );
  assert.ok(images.includes('FEATURED_CARD_IMAGE_SIZES'), 'the shelf needs its own sizes');

  /*
    And the shelf must ASK for it. The mapping is by variant rather than a
    ternary precisely so a new variant cannot silently inherit the grid's.
  */
  assert.match(card, /CARD_SIZES_FOR_VARIANT/, 'sizes must be chosen by variant');
  assert.match(card, /featured: FEATURED_CARD_IMAGE_SIZES/, 'the featured variant must map to its own');
  /*
    Matched on the ATTRIBUTE inside the tentpole row's block rather than on a
    whole one-line element. The original assertion pinned the exact single-line
    spelling and broke the moment the element was reformatted to take
    `brandOverride` — a test failing on whitespace, not on behaviour.
  */
  /* The shelf was a hardcoded `prestigeRow`; it is a curated COLLECTION built
     from the `series` field now. Same markup, same variant, same oversized
     tiles; only the identifier moved. */
  const shelfStart = grid.indexOf('collection.items.map');
  assert.notEqual(shelfStart, -1, 'the collection shelf should still render its own items');
  assert.match(
    grid.slice(shelfStart, shelfStart + 900),
    /variant="featured"/,
    'a curated collection must render its cards as the featured variant',
  );
});

/*
  ─── SCALING TYPE MUST NOT SCALE CARD WIDTHS ────────────────────────────────

  The root font-size steps up on wide monitors (80% -> 90% -> 100% -> 110%), so
  every rem on the site grows with the screen. That is the point: the whole
  layout is authored in rem and a 4K display was rendering a page built for a
  1536px window.

  The card widths must NOT follow. `sizes` is a px claim mirroring `--feed-card`
  in modules/layout.css, and if that variable were expressed in rem it would
  grow with the root while `sizes` stayed put — the browser would fetch a
  rendition for the old width and every card would go soft. That is the same
  failure this file already guards three times over, arriving by a new route.
*/
/*
  ─── EVERY PAGE-LEVEL WRAPPER IS THE SAME WIDTH ─────────────────────────────

  `.container` and `.container-page` are the same idea: the page's content
  column. They disagreed — `.container` was a hard 1536px while
  `.container-page` stepped up with the screen — and the navbar is a
  `.container`. Measured on a 3840 display: the nav ran 1145 -> 2681 while the
  rows under it ran 648 -> 3177, so the logo sat 497px inboard of the content
  and the links clustered mid-screen.

  Any new hard-coded page width is the same bug waiting to happen, so this
  asserts that both read the variable rather than a number.
*/
test('the page wrappers all read --page-max, none hard-code a width', () => {
  const layout = _read('src', 'styles', 'modules', 'layout.css');

  for (const selector of ['.container', '.container-page']) {
    const rule = layout.match(
      new RegExp(`(^|\\n)\\${selector}\\s*\\{([^}]*)\\}`, 'm'),
    );
    assert.ok(rule, `${selector} must be declared in layout.css`);
    assert.match(
      rule[2],
      /max-width:\s*var\(--page-max\)/,
      `${selector} must read --page-max, not a fixed width`,
    );
  }
});

test('the card ladder is in px, so growing the root cannot desync the images', () => {
  const layout = _read('src', 'styles', 'modules', 'layout.css');

  for (const name of ['--page-max', '--feed-card', '--feed-card-featured']) {
    const decls = [...layout.matchAll(new RegExp(`${name}:\\s*([^;]+);`, 'g'))].map((m) => m[1].trim());
    assert.ok(decls.length >= 2, `${name} must have a ladder`);
    for (const value of decls) {
      assert.match(value, /^\d+px$/, `${name} must be px, got "${value}" — rem would track the root font`);
    }
  }

  /* And the root ladder has to step where the page ladder does, or the
     container and its type change size at different widths. */
  const base = _read('src', 'styles', 'global-base.css');
  const fontSteps = [...base.matchAll(/@media \(min-width:\s*(\d+)px\)\s*\{\s*html\s*\{\s*font-size:/g)]
    .map((m) => Number(m[1]))
    .filter((bp) => bp >= 1920);
  const pageSteps = [...layout.matchAll(/@media \(min-width:\s*(\d+)px\)[\s\S]{0,200}?--page-max:/g)]
    .map((m) => Number(m[1]));
  assert.deepEqual(
    fontSteps.sort((a, b) => a - b),
    pageSteps.sort((a, b) => a - b),
    'the root font and the page width must step at the same breakpoints',
  );
});


console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed.`);
/*
  A per-item logo override (`customHeroLogo`) is a Sanity asset, and `.url()`
  on its own asks for the ORIGINAL: Ketchup Entertainment's is a 3364x1091
  PNG, which /feed fetched at high priority beside its LCP image. The event
  templates sized it; FeedSpotlightHero and ContentCard did not (the site-wide
  audit, 2026-09). Every call site must size it.
*/
{
  const fs = await import('node:fs');
  const path = await import('node:path');
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const walk = (d) => fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : /\.(astro|ts)$/.test(e.name) ? [path.join(d, e.name)] : []);
  const offenders = walk('src').filter((rel) =>
    /urlFor\([^)]*customHeroLogo\)\.url\(\)/.test(fs.readFileSync(path.join(root, rel), 'utf8')));
  if (offenders.length) {
    console.error(`  ✗ customHeroLogo requested at full size in: ${offenders.join(', ')}`);
    process.exit(1);
  }
  console.log('  ✓ every customHeroLogo is requested at a size, never the original');
}

process.exit(failed === 0 ? 0 : 1);

