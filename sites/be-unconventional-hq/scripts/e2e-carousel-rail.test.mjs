/*
  Instagram rail — every tile must be openable, at every viewport width.

  THE BUG THIS EXISTS FOR
  On touch devices the rail gates the link behind a tap-to-centre handler. That
  handler used to check `.is-active`, which the IntersectionObserver only sets
  when a tile crosses the horizontal CENTRE of the track. A tile can only be
  centred if the scroll offset that centres it falls within [0, maxScroll] —
  so the tiles at each end of the rail could never qualify, and their taps were
  swallowed by preventDefault() forever. The wider the screen, the more dead
  tiles: on an iPad Pro 12.9" that was 4 of 10 in landscape (indices 0, 1, 8, 9)
  and 2 of 10 in portrait (0, 9), while a phone looked fine.

  The gate is visibility now, not centredness. This test walks every tile at
  several widths — including tablet widths, which is where it broke and where
  nothing else in the suite looks — and asserts each one ends up fully visible
  and therefore clickable.

  It also pins the two rail labels together. They are the left and right ends
  of one component and have to read as the same thing; they previously differed in
  case because the casing was baked into each label's markup.
*/
import { launchTestBrowser } from './e2e-browser.mjs';
import { startPreviewServer } from './e2e-server.mjs';
import assert from 'node:assert/strict';

/* Touch widths only — the desktop marquee is a different code path. Tablet
   sizes are deliberate: the failure scaled with viewport width. */
const VIEWPORTS = [
  { width: 1366, height: 1024, label: 'iPad Pro 12.9" landscape' },
  { width: 1024, height: 1366, label: 'iPad Pro 12.9" portrait' },
  { width: 834, height: 1194, label: 'iPad Air portrait' },
  { width: 390, height: 844, label: 'iPhone 14 Pro portrait' },
  { width: 320, height: 568, label: 'iPhone SE portrait' },
];

async function runTests() {
  console.log('Starting Astro preview server for Carousel Rail E2E...');
  const { stop } = await startPreviewServer();

  console.log('Server is running. Launching Puppeteer...');
  const browser = await launchTestBrowser();
  let exitCode = 0;
  let passed = 0;

  try {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage();
      /* hasTouch puts the component on its touch path — the same branch a real
         iPad takes via `(hover: none) and (pointer: coarse)`. */
      await page.setViewport({ width: vp.width, height: vp.height, hasTouch: true, isMobile: false });
      await page.goto('http://localhost:4321/', { waitUntil: 'networkidle2' });

      /* The homepage arms a splash curtain; drop it so the rail is laid out. */
      await page.evaluate(() => {
        document.documentElement.classList.remove('splash-armed', 'splash-lifting', 'splash-dropping');
        window.__hqScrollLock?.release?.();
      });

      const hasRail = await page
        .waitForSelector('.ig-carousel-track .ig-carousel-tile', { timeout: 5000 })
        .then(() => true)
        .catch(() => false);

      if (!hasRail) {
        // The rail only renders with enough qualifying posts; that is a valid
        // state and not this test's concern.
        console.log(`  – ${vp.label}: no rail rendered, skipping`);
        await page.close();
        continue;
      }
      /* The rail builds itself when it comes near the viewport, not while the
         page loads (CinematicGallery.astro, "BUILT WHEN IT IS NEAR"), so go
         where a reader would be before tapping it. */
      await page.evaluate(() => document.querySelector('infinite-marquee')?.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await page.waitForSelector('infinite-marquee[data-ready]', { timeout: 5000 });
      await new Promise((r) => setTimeout(r, 100));

      const result = await page.evaluate(async () => {
        const track = document.querySelector('.ig-carousel-track');
        const tiles = [...track.querySelectorAll('.ig-carousel-tile')];
        const maxScroll = track.scrollWidth - track.clientWidth;
        const blocked = [];

        /*
          Test the ACTUAL tap, not the geometry.

          An earlier version of this test only checked whether a tile could be
          scrolled fully into view. That is true for every tile regardless of
          which gate the handler uses, so the test passed even with the broken
          `.is-active` gate restored — it never executed the handler at all.

          A click is dispatched instead, and a bubble-phase listener on
          document (which runs AFTER the tile's own listener) reads
          `defaultPrevented`. If the handler swallowed the tap, the link would
          never open — that is the bug, and it is what this measures.
        */
        let prevented = null;
        const probe = (e) => {
          prevented = e.defaultPrevented;
          e.preventDefault(); // never actually navigate during the test
        };
        document.addEventListener('click', probe);

        for (let i = 0; i < tiles.length; i++) {
          const tile = tiles[i];
          // Put it wherever a real tap-to-centre would leave it.
          const wanted =
            tile.offsetLeft - track.offsetLeft + tile.offsetWidth / 2 - track.clientWidth / 2;
          track.scrollLeft = Math.max(0, Math.min(maxScroll, wanted));
          await new Promise((r) => requestAnimationFrame(r));

          prevented = null;
          tile.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          await new Promise((r) => requestAnimationFrame(r));

          // A second tap must always get through: the first may legitimately
          // scroll a partially visible tile into view.
          if (prevented) {
            prevented = null;
            tile.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            await new Promise((r) => requestAnimationFrame(r));
            if (prevented) blocked.push(i);
          }
        }

        document.removeEventListener('click', probe);
        track.scrollLeft = 0;
        return { total: tiles.length, blocked };
      });

      assert.equal(
        result.blocked.length,
        0,
        `${vp.label}: ${result.blocked.length} of ${result.total} tiles swallow their tap and can never be opened (indices ${result.blocked.join(', ')})`
      );
      console.log(`  ✓ ${vp.label}: all ${result.total} tiles open on tap`);
      passed++;

      // Both rail labels must share one type treatment.
      const labels = await page.evaluate(() => {
        const read = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const span = el.querySelector('span');
          const cs = getComputedStyle(span);
          return {
            family: cs.fontFamily,
            weight: cs.fontWeight,
            color: cs.color,
            transform: cs.textTransform,
            // letter-spacing is em-relative, so compare the ratio, not the px
            ratio: (parseFloat(cs.letterSpacing) / parseFloat(cs.fontSize)).toFixed(3),
            overflow: Math.round(span.scrollWidth - span.clientWidth),
          };
        };
        return { title: read('.ig-title-card'), cta: read('.ig-cta-card') };
      });

      if (labels.title && labels.cta) {
        const { title, cta } = labels;
        assert.equal(title.transform, 'uppercase', `${vp.label}: title label must be uppercase`);
        assert.equal(cta.transform, 'uppercase', `${vp.label}: CTA label must be uppercase`);
        assert.equal(title.family, cta.family, `${vp.label}: rail labels must share a font family`);
        assert.equal(title.weight, cta.weight, `${vp.label}: rail labels must share a font weight`);
        assert.equal(title.color, cta.color, `${vp.label}: rail labels must share a colour`);
        assert.equal(title.ratio, cta.ratio, `${vp.label}: rail labels must share letter-spacing`);
        // Font SIZE is allowed to differ — the CTA copy is longer and steps
        // down so it fits — but neither may overflow its card.
        assert.ok(title.overflow <= 0, `${vp.label}: title label overflows its card`);
        assert.ok(cta.overflow <= 0, `${vp.label}: CTA label overflows its card`);
        console.log(`  ✓ ${vp.label}: rail labels share one type treatment`);
        passed++;
      }

      await page.close();
    }

    /*
      EDGE TILES MUST BE HIGHLIGHTABLE.

      Reported on iPad: the two leftmost and two rightmost tiles could never be
      highlighted. `.is-active` came from an IntersectionObserver with a
      razor-thin trigger line down the centre of the rail, and a tile can only
      cross that line if the scroll offset centring it lies in [0, maxScroll].
      The head and tail tiles fail that by construction, and on touch there is
      no :hover to fall back on, so they read as dead.

      The active tile is now chosen by mapping scroll progress across the whole
      tile range, so the extremes resolve to the first and last tiles. This
      walks the rail and asserts the four tiles the report named are reachable.
    */
    for (const vp of [
      { width: 1366, height: 1024, label: 'iPad Pro landscape' },
      { width: 1024, height: 1366, label: 'iPad Pro portrait' },
      { width: 390, height: 844, label: 'iPhone portrait' },
    ]) {
      const page = await browser.newPage();
      await page.setViewport({ ...vp, hasTouch: true, isMobile: false });
      await page.goto('http://localhost:4321/', { waitUntil: 'networkidle2' });
      await page.evaluate(() => {
        document.documentElement.classList.remove('splash-armed', 'splash-lifting', 'splash-dropping');
        window.__hqScrollLock?.release?.();
      });
      /* Built when near, as above: go where the reader would be first. */
      const hasMarquee = await page.evaluate(() => {
        const el = document.querySelector('infinite-marquee');
        el?.scrollIntoView({ block: 'center', behavior: 'instant' });
        return Boolean(el);
      });
      if (hasMarquee) await page.waitForSelector('infinite-marquee[data-ready]', { timeout: 5000 });

      const seen = await page.evaluate(async () => {
        const track = document.querySelector('.ig-carousel-track');
        if (!track) return null;
        const tiles = [...track.querySelectorAll('.ig-carousel-tile')];
        if (tiles.length < 4) return null;
        const max = track.scrollWidth - track.clientWidth;
        const hit = new Set();
        for (let i = 0; i <= 40; i++) {
          track.scrollLeft = (max * i) / 40;
          await new Promise((r) => requestAnimationFrame(r));
          await new Promise((r) => requestAnimationFrame(r));
          const idx = tiles.findIndex((t) => t.classList.contains('is-active'));
          if (idx >= 0) hit.add(idx);
        }
        track.scrollLeft = 0;
        return { total: tiles.length, hit: [...hit] };
      });
      await page.close();
      if (!seen) continue;

      const last = seen.total - 1;
      const edges = [0, 1, last - 1, last];
      const unreachable = edges.filter((i) => !seen.hit.includes(i));
      assert.deepEqual(
        unreachable,
        [],
        `${vp.label}: edge tiles ${unreachable.join(', ')} of ${seen.total} can never be ` +
          `highlighted (reachable: ${seen.hit.join(', ')}). On touch there is no hover, ` +
          `so an unhighlightable tile reads as dead — this is the reported iPad bug.`
      );
      console.log(`  ✓ ${vp.label}: all 4 edge tiles highlightable (${seen.hit.length}/${seen.total} total)`);
      passed++;
    }

    console.log(`\n✅ Carousel Rail E2E tests passed (${passed} assertions groups).`);
  } catch (error) {
    console.error('\n❌ Carousel Rail E2E failed:', error.message);
    exitCode = 1;
  } finally {
    await browser.close();
    stop();
    process.exit(exitCode);
  }
}

runTests();
