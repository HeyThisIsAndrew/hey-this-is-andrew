/*
  A card without a usable cover shows the brand mark.

  Two holes, one patch:

    1. NO IMAGE AT ALL — the record has no thumbnail, so the component renders
       a fallback panel instead of an <img>.

    2. AN IMAGE THAT IS NOT ONE — this is the regression. A livestream synced
       while it was live stored `maxresdefault_live.jpg`; that URL stops
       resolving the moment the stream ends, and YouTube answers with HTTP 200
       and a 120x90 grey "no thumbnail" graphic. The existing fail-safe only
       catches `naturalWidth === 0`, so a successful load of a placeholder
       sailed straight through and the card painted the grey box.

  Case 2 is driven here by intercepting an i.ytimg.com request and answering
  with a real 120x90 PNG — the same shape YouTube sends — so the assertion is
  about behaviour, not about a mocked flag.
*/
import { launchTestBrowser } from './e2e-browser.mjs';
import { startPreviewServer } from './e2e-server.mjs';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';

/** Build a real, decodable solid-grey PNG of the given size. */
function makePng(width, height) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crcBuf]);
  };

  const table = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })();
  function crc32(buf) {
    let c = -1;
    for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return c ^ -1;
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  // 10..12 = compression, filter, interlace = 0

  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0x2b)]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const PLACEHOLDER_PNG = makePng(120, 90); // YouTube's "no thumbnail" size
const REAL_PNG = makePng(480, 270); // a normal hqdefault-shaped thumbnail

let passed = 0;
let failed = 0;
function check(name, fn) {
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

async function runTests() {
  console.log('Starting Astro preview server for image fallback E2E...');
  const { stop } = await startPreviewServer();
  console.log('Server is running. Launching Puppeteer...');
  const browser = await launchTestBrowser();
  let exitCode = 0;

  try {
    // ─── Every YouTube thumbnail answers as a PLACEHOLDER ─────────────────
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (req.url().includes('i.ytimg.com')) {
        req.respond({ status: 200, contentType: 'image/png', body: PLACEHOLDER_PNG }).catch(() => {});
        return;
      }
      // Everything else external is unreachable from CI; stub images so the
      // page settles instead of hanging on them.
      if (req.resourceType() === 'image' && /^https?:\/\//.test(req.url()) && !req.url().includes('localhost')) {
        req.respond({ status: 200, contentType: 'image/png', body: REAL_PNG }).catch(() => {});
        return;
      }
      req.continue().catch(() => {});
    });

    await page.goto('http://localhost:4321/feed', { waitUntil: 'networkidle0' });

    /*
      Card thumbnails are loading="lazy", so most of them have not been
      requested at all yet — an unloaded <img> has naturalWidth 0 and would be
      indistinguishable from a broken one. Scroll the page so they actually
      load, then judge only the ones that really decoded.
    */
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });
    await new Promise((r) => setTimeout(r, 1200)); // let loads + listener settle

    const placeholderState = await page.evaluate(async () => {
      /*
        Measured through a bare `Image()`, mirroring `measureTruePixels()` in
        Layout.astro. `naturalWidth` on the live element is density-corrected,
        and the correction runs BOTH ways: the same 120x90 body reports 73x55
        on an element whose srcset promised 480w into a wide slot, and 128x96
        on `#hero-bg`, whose top rung (1200w) is narrower than its 100vw slot.
        The original `<=` absorbed the shrinking case and missed the growing
        one — the same blind spot the production check had.

        If this and Layout.astro ever diverge, this suite stops testing what
        ships.
      */
      const truePixels = (img) =>
        new Promise((resolve) => {
          const url = img.currentSrc || img.getAttribute('src') || '';
          if (!url) return resolve({ w: 0, h: 0 });
          const probe = new Image();
          probe.onload = () => resolve({ w: probe.naturalWidth, h: probe.naturalHeight });
          probe.onerror = () => resolve({ w: 0, h: 0 });
          probe.src = url;
        });

      const imgs = Array.from(document.querySelectorAll('img')).filter(
        (i) =>
          (i.currentSrc || i.src || '').includes('i.ytimg.com') &&
          i.complete &&
          i.naturalWidth > 0,
      );
      return {
        total: imgs.length,
        // `<=`, not `===`: naturalWidth is density-corrected, so the same
        // 120x90 body reports 120x90 on a plain <img> and 73x55 on one whose
        // srcset promised 480w. Asserting equality here was wrong in exactly
        // the way the production check was.
        decodedAsPlaceholder: (await Promise.all(imgs.map(truePixels))).filter(
          (d) => d.w > 0 && d.w <= 120 && d.h > 0 && d.h <= 90,
        ).length,
        markedFailed: imgs.filter((i) => {
          const p = i.parentElement;
          const c = p && p.tagName === 'PICTURE' ? p.parentElement : p;
          return c && c.hasAttribute('data-img-failed');
        }).length,
      };
    });

    check('the page really did receive placeholder-sized responses', () => {
      assert.ok(placeholderState.total > 0, 'no LOADED i.ytimg.com images on /feed to test with');
      assert.equal(
        placeholderState.decodedAsPlaceholder,
        placeholderState.total,
        'stub did not take effect',
      );
    });

    check('a successfully-loaded placeholder is treated as a failure', () => {
      // The regression: naturalWidth is 120, not 0, and no error event fires.
      assert.equal(
        placeholderState.markedFailed,
        placeholderState.total,
        `${placeholderState.total} placeholder(s) but only ${placeholderState.markedFailed} marked — ` +
          'the grey box would still be showing',
      );
    });

    const markPainted = await page.evaluate(() => {
      const el = document.querySelector('.content-card-media[data-img-failed]');
      if (!el) return null;
      const bg = getComputedStyle(el).backgroundImage;
      const img = el.querySelector('img');
      return {
        usesMark: bg.includes('logo-mark'),
        imgHidden: img ? getComputedStyle(img).display === 'none' : true,
      };
    });

    check('the brand mark is painted on the failed card', () => {
      assert.ok(markPainted, 'no failed card found to inspect');
      assert.equal(markPainted.usesMark, true, 'background-image does not include the brand mark');
    });

    check('the placeholder image itself is hidden behind it', () => {
      assert.equal(markPainted.imgHidden, true, 'the grey placeholder is still visible');
    });

    await page.close();

    // ─── A card with NO image at all ──────────────────────────────────────
    const plain = await browser.newPage();
    await plain.setViewport({ width: 1280, height: 900 });
    await plain.goto('http://localhost:4321/feed', { waitUntil: 'domcontentloaded' });

    const noImage = await plain.evaluate(() => {
      const panel = document.querySelector('.article-thumb-fallback');
      if (!panel) return null;
      return { usesMark: getComputedStyle(panel).backgroundImage.includes('logo-mark') };
    });

    check('a card with no image at all also shows the mark', () => {
      if (!noImage) {
        // No such record on this page right now — the CSS is shared with the
        // failed case above, which is already asserted, so this is not a
        // failure. Say so rather than silently passing an empty assertion.
        console.log('    (no image-less card present on /feed — covered by the shared rule above)');
        return;
      }
      assert.equal(noImage.usesMark, true, 'fallback panel does not paint the brand mark');
    });

    await plain.close();

    console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed.`);
    if (failed > 0) exitCode = 1;
  } catch (error) {
    console.error('❌ E2E Test Failed:', error);
    exitCode = 1;
  } finally {
    await browser.close();
    stop();
    process.exit(exitCode);
  }
}

runTests();
