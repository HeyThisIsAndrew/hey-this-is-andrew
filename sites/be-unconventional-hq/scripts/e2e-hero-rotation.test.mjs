/*
  THE HOMEPAGE HERO'S ROTATION: IT STOPS WHEN ASKED, AND RESUMES WHEN ASKED.

  THE REPORT
  "Load the homepage, click a column tile to force a hero transition, press
  play: the progress bar fails to resume and the auto transition does not
  resume."

  WHY
  The rotation pauses while the pointer is over the hero or focus is inside
  it (the pause-on-interaction WCAG 2.2.2 asks of anything that moves). At the
  moment the reader presses Play, BOTH are true: the pointer is on the button
  and the button has focus. So the toggle flipped to "Pause rotation" while
  nothing moved, and because focus stays on a clicked button, it never
  resumed. Play now clears those two holds; the next mouseenter or focusin
  sets them again, so the pause still works for whoever arrives later.

  Nothing covered the rotation before this suite, which is how a toggle that
  said one thing and did another shipped.
*/
import { launchTestBrowser } from './e2e-browser.mjs';
import { startPreviewServer } from './e2e-server.mjs';
import assert from 'node:assert/strict';

const BASE = 'http://localhost:4321';
const DESKTOP = { width: 1440, height: 900 };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Which panel is open, how far its progress bar is, and what the toggle says. */
const state = (page) =>
  page.evaluate(() => {
    const panels = [...document.querySelectorAll('[data-acc-panel]')];
    const open = panels.findIndex((p) => p.classList.contains('is-open'));
    const fill = panels[open]?.querySelector('.acc-progress-fill');
    const m = /scaleX\(([\d.]+)\)/.exec(fill?.style.transform || '');
    return {
      open,
      fill: m ? Number(m[1]) : 0,
      toggle: document.querySelector('[data-acc-toggle]')?.getAttribute('aria-label'),
    };
  });

async function runTests() {
  console.log('Starting Astro preview server for Hero Rotation E2E...');
  const { stop } = await startPreviewServer();
  console.log('Server is running. Launching Puppeteer...');
  const browser = await launchTestBrowser();
  let exitCode = 0;
  let passed = 0;
  const pass = (msg) => {
    console.log(`  ✓ ${msg}`);
    passed++;
  };

  try {
    const page = await browser.newPage();
    await page.setViewport(DESKTOP);
    /* Only the site itself: the art and YouTube are not what is under test. */
    await page.setRequestInterception(true);
    page.on('request', (r) => (r.url().startsWith(BASE) ? r.continue() : r.abort()));
    await page.goto(`${BASE}/`, { waitUntil: 'load' });
    /* Park the pointer on the navbar, away from the hero, so nothing holds. */
    await page.mouse.move(5, 5);
    await wait(1500);

    let s = await state(page);
    assert.ok(s.fill > 0, `the rotation should run on its own; the progress bar is at ${s.fill}`);
    pass('the rotation runs on its own');

    /* A manual pick stops it for good (until Play). */
    const tiles = await page.$$('[data-acc-trigger]');
    await tiles[2].click();
    await wait(1200);
    s = await state(page);
    assert.equal(s.open, 2, 'clicking the third tile should open it');
    assert.equal(s.toggle, 'Play rotation', 'a manual pick should stop the rotation');
    assert.equal(s.fill, 0, 'a stopped rotation should not advance its progress bar');
    pass('clicking a tile opens it and stops the rotation');

    /* THE BUG: Play, with the pointer still over the button and focus on it. */
    await page.click('[data-acc-toggle]');
    await wait(1500);
    s = await state(page);
    assert.equal(s.toggle, 'Pause rotation', 'the toggle should read Pause after Play');
    assert.ok(
      s.fill > 0.05,
      `after Play the progress bar should move at once, even with the pointer on the button; it is at ${s.fill}`,
    );
    pass('Play resumes the progress bar immediately, pointer and focus still on the button');

    await wait(7000);
    s = await state(page);
    assert.equal(s.open, 3, `the rotation should have advanced to the next panel; open is ${s.open}`);
    pass('...and the rotation advances to the next panel');

    /* The pause-on-hover is re-armed by the next mouseenter. */
    await page.mouse.move(5, 5);
    await wait(200);
    const panelBox = await (await page.$('.acc-panel.is-open'))?.boundingBox();
    await page.mouse.move(panelBox.x + panelBox.width / 2, panelBox.y + panelBox.height / 2);
    await wait(300);
    const before = (await state(page)).fill;
    await wait(1200);
    const after = (await state(page)).fill;
    assert.ok(Math.abs(after - before) < 0.01, `hovering the hero should still pause it (${before} -> ${after})`);
    pass('hovering the hero still pauses it afterwards');

    /* The video path: playing stops the rotation; closing it and pressing
       Play resumes it the same way. */
    await page.mouse.move(5, 5);
    /* Open the first panel that carries a video, whichever that is today. */
    const videoTile = await page.evaluate(() =>
      [...document.querySelectorAll('[data-acc-panel]')].findIndex((p) => p.querySelector('[data-play-video]')));
    if (videoTile >= 0) {
      await (await page.$$('[data-acc-trigger]'))[videoTile].click();
      await wait(900);
    }
    const play = await page.$('.acc-panel.is-open [data-play-video].acc-cta, .acc-panel.is-open [data-play-video]');
    if (play) {
      await play.click();
      await wait(600);
      s = await state(page);
      assert.equal(s.toggle, 'Play rotation', 'playing a video should stop the rotation');
      const close = await page.$('.acc-panel.is-open [data-close-video]');
      if (close) {
        await close.click();
        await wait(300);
      }
      await page.click('[data-acc-toggle]');
      await wait(1500);
      s = await state(page);
      assert.ok(s.fill > 0.05, `after a video, Play should resume the rotation; the bar is at ${s.fill}`);
      pass('after playing and closing a video, Play resumes the rotation');
    } else {
      console.log('  - skipped the video path: the open panel has no video');
    }

    /* THE PLAY FLASH: the panel drops its clip while a video plays (hard
       rule 3), and the art, hover-zoomed and sized to --open-w, spilled up
       to 23px past the panel until the video showed. Clicked with the
       pointer ON the panel, as a reader does, since the hover zoom was the
       half a scripted click missed. */
    await page.goto(`${BASE}/`, { waitUntil: 'load' });
    await wait(1200);
    const cta = await page.$('.acc-panel.is-open .acc-cta[data-play-video]');
    if (cta) {
      const box = await cta.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await wait(1600); // let the hover zoom settle
      await page.evaluate(() => {
        window.__spill = [];
        const t0 = performance.now();
        const tick = () => {
          const p = document.querySelector('.acc-panel.is-open');
          const img = p?.querySelector('.acc-media img');
          if (p?.classList.contains('is-playing') && img && getComputedStyle(img).display !== 'none') {
            const a = p.getBoundingClientRect(), c = img.getBoundingClientRect();
            window.__spill.push(Math.max(a.left - c.left, c.right - a.right, a.top - c.top, c.bottom - a.bottom, 0));
          }
          if (performance.now() - t0 < 2000) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      await page.mouse.down();
      await page.mouse.up();
      await wait(2200);
      const spill = await page.evaluate(() => window.__spill);
      assert.ok(spill.length > 0, 'the panel never entered its playing state');
      assert.ok(Math.max(...spill) <= 1, `the art spilled ${Math.max(...spill).toFixed(1)}px past the panel as the video started`);
      pass(`pressing Play never lets the art spill past the panel (${spill.length} frames checked)`);
    }

    await page.close();
    console.log(`\n✅ Hero Rotation E2E tests passed (${passed} checks).`);
  } catch (error) {
    console.error('\n❌ Hero Rotation E2E failed:', error.message);
    exitCode = 1;
  } finally {
    await browser.close();
    stop();
    process.exit(exitCode);
  }
}

runTests();
