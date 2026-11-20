import { test, expect, type Page } from '@playwright/test';

/* The homepage elevator is compact: the first click opens the fullscreen
   elevator; inside it a tile click zooms the camera onto that tile. */
async function openFullscreenElevator(page: Page) {
  const section = page.locator('.photo-section');
  await page.locator('.photo-section .photo-stage-wrap').scrollIntoViewIfNeeded();
  await page.locator('.photo-section .photo-stage-wrap').click({ position: { x: 40, y: 40 } });
  await expect(section).toHaveClass(/is-fullscreen/);
  return section;
}
/* A tile from the visible set that sits on screen, so a click lands on it. */
async function onScreenTile(page: Page, selector: string) {
  const handle = await page.evaluateHandle((sel) => {
    const vh = window.innerHeight;
    return Array.from(document.querySelectorAll<HTMLElement>(sel)).find((el) => {
      const col = el.closest<HTMLElement>('.photo-column');
      const r = el.getBoundingClientRect();
      return col && getComputedStyle(col).display !== 'none' && r.width > 0 && r.top > 40 && r.top < vh - 150;
    }) ?? null;
  }, selector);
  return handle.asElement();
}

test.describe('Audit Fixes Verification', () => {
  test('What I Do has no pricing and nothing beneath the elevator', async ({ page }) => {
    await page.goto('./');
    const services = page.locator('#services');
    await expect(services.locator('.stat-value')).toHaveText(['Building in Public', 'Creator and Coffee Drinker', 'UGC']);
    await expect(services).not.toContainText('Starting Rate');
    await expect(services).not.toContainText('$');
    expect(await services.locator('.work-elevator').evaluate((el) => el.nextElementSibling)).toBeNull();
    await expect(page.locator('.photo-note')).toHaveCount(0);
  });

  test('Contact rule: UGC CTA on the UGC card, no CCC email on homepage or gear page', async ({ page }) => {
    await page.goto('./');

    // 1. The UGC card's back carries the one UGC CTA.
    const ugc = page.locator('#services .work-flip-card--action');
    await ugc.locator('.flip-card-toggle').click({ force: true });
    await expect(ugc).toHaveClass(/is-flipped/);
    const servicesCta = page.locator('#services').getByRole('link', { name: 'Send a product' });
    await expect(servicesCta).toHaveCount(1);
    await expect(servicesCta).toBeVisible();
    await expect(servicesCta).toHaveAttribute('href', /^mailto:[^?]+\?subject=Product%20review%20%2F%20brand%20partnership&body=/);

    // 2. No CCC mailto buttons on homepage
    await expect(page.locator('#gear a:has-text("Start a project")')).toHaveCount(0);
    await expect(page.locator('a[href*="capturecreatecaffeinate@gmail.com"]')).toHaveCount(0);

    // 3. On /gear/: no CCC mailto and no project CTA
    await page.goto('./gear/');
    await expect(page.locator('.gear-project-cta')).toHaveCount(0);
    await expect(page.locator('a[href*="capturecreatecaffeinate@gmail.com"]')).toHaveCount(0);

    // 4. On /ccc/: Contact opens the CCC inquiry modal
    await page.goto('./ccc/');
    const cccContactBtn = page.locator('.ccc-actions a[data-open-ccc-modal]').first();
    await expect(cccContactBtn).toBeVisible();
  });

  test('Homepage shows its sections in order', async ({ page }) => {
    await page.goto('./');
    const sections = await page.locator('#main-content > section').evaluateAll(els => els.map(el => el.id));
    expect(sections).toEqual(['overview', 'directory', 'gear', 'services', 'newsletter']);
  });

  test('Elevator reels zoom in, then play locally or open Instagram from the dock', async ({ page }) => {
    await page.goto('./');
    const originals = page.locator('.photo-set:not([aria-hidden])');
    test.skip((await originals.locator('.photo-item[data-video-url]').count()) === 0, 'no Instagram reels in this build');

    // Every Instagram-only reel names its permalink and shows no play badge.
    const instagramOnly = originals.locator('.photo-item[data-video-url]:not([data-video-src])');
    for (const tile of await instagramOnly.all()) {
      expect(await tile.getAttribute('data-video-url')).toMatch(/^https:\/\/www\.instagram\.com\/reel\//);
      await expect(tile.locator('.photo-play-badge, .photo-tag-video-icon')).toHaveCount(0);
    }

    const section = await openFullscreenElevator(page);
    const player = page.locator('[data-photo-player]');
    const dock = page.locator('[data-photo-actions]');
    const watch = page.locator('[data-photo-watch]');

    const igTile = await onScreenTile(page, '.photo-item[data-video-url]:not([data-video-src])');
    if (igTile) {
      const permalink = await igTile.getAttribute('data-video-url');
      await igTile.evaluate((el) => (el as HTMLElement).click());
      await expect(section).toHaveClass(/is-zoomed/);
      await expect(watch).toBeVisible();
      await expect(watch).toHaveAttribute('href', permalink!);
      await expect(watch).toHaveAttribute('target', '_blank');
      await expect(page.locator('[data-photo-play]')).toBeHidden();
      // The dock belongs to the tile: directly beneath it, centred on it
      // (once the camera has landed; clicked this soon after opening, the
      // zoom first waits for the fullscreen view to finish growing).
      const gaps = () => page.evaluate(() => {
        const t = document.querySelector('.photo-item.is-active')!.getBoundingClientRect();
        const d = document.querySelector('[data-photo-actions]')!.getBoundingClientRect();
        return { below: Math.round(d.top - t.bottom), offCentre: Math.round(Math.abs((d.left + d.right) / 2 - (t.left + t.right) / 2)) };
      });
      await expect.poll(async () => { const g = await gaps(); return g.below >= 0 && g.below <= 40 && g.offCentre <= 24; }, { timeout: 4000 }).toBe(true);
      await page.keyboard.press('Escape');
      await expect(section).not.toHaveClass(/is-zoomed/);
      await expect(section).toHaveClass(/is-fullscreen/);
    }

    const videoTile = await onScreenTile(page, '.photo-item[data-video-src]');
    if (!videoTile) return;
    await videoTile.evaluate((el) => (el as HTMLElement).click());
    await expect(section).toHaveClass(/is-zoomed/);
    await expect(player).toBeHidden();
    await page.locator('[data-photo-play]').click();
    await expect(player).toBeVisible();
    await expect(player.locator('video')).toHaveCount(1);
    await expect(page.locator('iframe[src*="instagram.com"]')).toHaveCount(0);
    await expect(player.locator('[data-photo-player-close]')).toHaveText('×');

    // Escape stops it and keeps the zoom; Escape again closes the zoom.
    await page.keyboard.press('Escape');
    await expect(player).toBeHidden();
    await expect(section).toHaveClass(/is-zoomed/);
    await page.keyboard.press('Escape');
    await expect(section).not.toHaveClass(/is-zoomed/);
  });

  test('Elevator zoom: HUD counter, and every way out of the zoom stays fullscreen', async ({ page }) => {
    await page.goto('./');
    test.skip((await page.locator('.photo-item:not([data-video-url])').count()) === 0, 'no photos in this build');
    const section = await openFullscreenElevator(page);
    const stage = page.locator('#camera-stage');

    const zoomIn = async () => {
      const tile = await onScreenTile(page, '.photo-set:not([aria-hidden]) .photo-item:not([data-video-url])');
      expect(tile).not.toBeNull();
      await tile!.evaluate((el) => { el.setAttribute('data-qa-tile', ''); (el as HTMLElement).click(); });
      await expect(stage).toHaveClass(/is-zoomed/);
      await expect(page.locator('[data-photo-hud]')).toBeVisible();
      await expect(page.locator('[data-photo-progress]')).toContainText(/Item \d+ of \d+/);
    };
    const backInFullscreen = async () => {
      await expect(stage).not.toHaveClass(/is-zoomed/);
      await expect(section).toHaveClass(/is-fullscreen/);
      await page.locator('[data-qa-tile]').evaluate((el) => el.removeAttribute('data-qa-tile'));
    };

    // The HUD's Close button.
    await zoomIn();
    await page.locator('[data-photo-close]').click();
    await backInFullscreen();

    // Clicking the zoomed photo again (the one on screen: near a track end
    // the zoom moves to its twin in the other set, in the same spot).
    await zoomIn();
    await page.locator('#camera-stage .photo-item.is-active').evaluate((el) => (el as HTMLElement).click());
    await backInFullscreen();

    // Walking a column, tile after tile, never runs out (2026-11-20): the
    // next tile up or down is always on screen to click, as a finger would,
    // and the columns beside it stay full (the camera never climbs off the
    // wall into black).
    for (const step of [-1, 1]) {
      await zoomIn();
      await page.waitForTimeout(700);
      for (let i = 0; i < 24; i++) {
        const point = await page.evaluate((dir) => {
          const active = document.querySelector<HTMLElement>('#camera-stage .photo-item.is-active');
          const column = active?.closest('.photo-column');
          if (!active || !column) return 'no active tile';
          const items = Array.from(column.querySelectorAll<HTMLElement>('.photo-item'));
          const next = items[items.indexOf(active) + dir];
          if (!next) return 'no tile ' + (dir < 0 ? 'above' : 'below');
          for (const col of Array.from(document.querySelectorAll<HTMLElement>('#camera-stage .photo-column'))) {
            const c = col.getBoundingClientRect();
            if (getComputedStyle(col).display === 'none' || c.right <= 0 || c.left >= innerWidth) continue;
            const filled = Array.from(col.querySelectorAll('.photo-item')).some((el) => {
              const t = el.getBoundingClientRect();
              return t.bottom > innerHeight * 0.3 && t.top < innerHeight * 0.7;
            });
            if (!filled) return 'column ' + col.dataset.column + ' is empty on screen';
          }
          const r = next.getBoundingClientRect();
          const y = dir < 0 ? Math.max(4, r.bottom - 20) : Math.min(innerHeight - 4, r.top + (Math.min(innerHeight, r.bottom) - r.top) * 0.75);
          const x = r.left + r.width / 2;
          if (r.bottom <= 0 || r.top >= innerHeight || document.elementFromPoint(x, y)?.closest('.photo-item') !== next) return 'next tile off screen';
          return { x, y };
        }, step);
        expect(point).toEqual(expect.objectContaining({ x: expect.any(Number) }));
        await page.mouse.click((point as { x: number }).x, (point as { y: number }).y);
        await expect(stage).toHaveClass(/is-zoomed/);
        await page.waitForTimeout(650);
      }
      await page.keyboard.press('Escape');
      await backInFullscreen();
    }

    // The browser's back button.
    await zoomIn();
    await page.goBack();
    await backInFullscreen();

    // Escape from fullscreen leaves the elevator.
    await page.keyboard.press('Escape');
    await expect(section).not.toHaveClass(/is-fullscreen/);
  });
});
