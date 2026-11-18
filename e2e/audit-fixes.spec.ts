import { test, expect } from '@playwright/test';

test.describe('Audit Fixes Verification', () => {
  test('Service logistics ledger has three centered columns and no pricing', async ({ page }) => {
    await page.goto('./');

    const clientBlock = page.locator('#services [data-client-block]');
    await expect(clientBlock).toBeVisible();
    const ledger = clientBlock.locator('.logistics-ledger');
    const columns = await ledger.evaluate(el => getComputedStyle(el).gridTemplateColumns);
    expect(columns.split(' ')).toHaveLength(3);

    const items = ledger.locator('.logistics-item');
    await expect(items).toHaveText([
      '15 selects the next day. The full gallery within a week.',
      'Edited photos and vertical reels, licensed for your social and web.',
      'Shot on location for Desert Escape at Ace Hotel Palm Springs, the Stone Groove Stillhouse launch, and brand and creator campaigns.',
    ]);
    for (const item of await items.all()) {
      await expect(item).toHaveCSS('text-align', 'center');
      await expect(item).toHaveCSS('align-items', 'center');
      await expect(item).toHaveCSS('justify-content', 'center');
      await expect(item).toHaveCSS('border-left-width', '0px');
      await expect(item.locator('.logistics-value')).toHaveCSS('text-transform', 'uppercase');
    }

    // No Starting Rate or pricing numbers
    await expect(clientBlock).not.toContainText('Starting Rate');
    await expect(clientBlock).not.toContainText('$');
  });

  test('Contact rule: UGC CTA on homepage, no CCC email on homepage or gear page', async ({ page }) => {
    await page.goto('./');

    const expectedUgcHref =
      'mailto:heythisisandrewb@gmail.com?subject=Product%20review%20%2F%20brand%20partnership' +
      '&body=Brand%3A%0AProduct%3A%0AWhat%20you%20want%20shown%3A%0ATimeline%3A%0A';

    // 1. Homepage services has exactly one UGC CTA
    const servicesCta = page.locator('#services').getByRole('link', { name: 'Send a product' });
    await expect(servicesCta).toBeVisible();
    await expect(servicesCta).toHaveAttribute('href', expectedUgcHref);

    // 2. No CCC mailto buttons on homepage
    await expect(page.locator('#work a:has-text("Start a project")')).toHaveCount(0);
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

  test('Homepage shows the seven sections in order', async ({ page }) => {
    await page.goto('./');
    const sections = await page.locator('#main-content > section').evaluateAll(els => els.map(el => el.id));
    expect(sections).toEqual(['overview', 'directory', 'work', 'services', 'gear', 'explore', 'newsletter']);
  });

  test('Elevator reels play local files in place or open their Instagram links', async ({ page }) => {
    await page.goto('./');

    const originals = page.locator('.photo-set:not([aria-hidden])');
    const reels = originals.locator('.photo-item[data-video-url]');
    test.skip((await reels.count()) === 0, 'no Instagram reels in this build');

    const instagramLinks = originals.locator('.photo-item[data-video-url]:not([data-video-src])');
    for (const link of await instagramLinks.all()) {
      const permalink = await link.getAttribute('data-video-url');
      expect(permalink).toMatch(/^https:\/\/www\.instagram\.com\/reel\//);
      await expect(link).toHaveAttribute('href', permalink!);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link.locator('.photo-play-badge, .photo-tag-video-icon')).toHaveCount(0);
    }
    const player = page.locator('[data-photo-player]');
    if (await instagramLinks.count()) {
      const link = instagramLinks.first();
      const permalink = (await link.getAttribute('href'))!;
      await page.context().route(permalink, route => route.fulfill({ body: '' }), { times: 1 });
      const [popup] = await Promise.all([
        page.waitForEvent('popup'),
        link.evaluate(el => (el as HTMLElement).click()),
      ]);
      await expect(popup).toHaveURL(permalink);
      await popup.close();
      await expect(page.locator('.photo-section')).not.toHaveClass(/is-zoomed/);
      await expect(player).toBeHidden();
    }

    const videoItem = originals.locator('.photo-item[data-video-src]').first();
    if (!(await videoItem.count())) return;
    await expect(videoItem.locator('.photo-play-badge')).toContainText('Video');

    // A video tile zooms into the elevator view like a photo: nothing plays
    // and no separate dialog opens.
    await videoItem.evaluate((el) => (el as HTMLElement).click());
    await expect(page.locator('.photo-section')).toHaveClass(/is-zoomed/);
    await expect(player).toBeHidden();
    await expect(page.locator('#photo-reel-player')).toHaveCount(0);

    // Play in the dock plays the self-hosted file in place, with the HQ
    // close button above it, clear of the nav.
    await page.locator('[data-photo-play]').click();
    await expect(player).toBeVisible();
    await expect(player.locator('video')).toHaveCount(1);
    await expect(page.locator('iframe[src*="instagram.com"]')).toHaveCount(0);
    const close = player.locator('[data-photo-player-close]');
    await expect(close).toHaveText('×');
    const gap = await close.evaluate((el) => el.getBoundingClientRect().top - document.querySelector('.site-nav')!.getBoundingClientRect().bottom);
    expect(gap).toBeGreaterThanOrEqual(0);

    // Escape stops it and keeps the zoom; Escape again closes the zoom.
    await page.keyboard.press('Escape');
    await expect(player).toBeHidden();
    await expect(page.locator('.photo-section')).toHaveClass(/is-zoomed/);
    await page.keyboard.press('Escape');
    await expect(page.locator('.photo-section')).not.toHaveClass(/is-zoomed/);
  });

  test('Elevator photo tile click opens carousel with HUD counter and Close button', async ({ page }) => {
    await page.goto('./');

    const photoItem = page.locator('.photo-item:not([data-video-url])').first();
    if ((await photoItem.count()) === 0) return; // No Instagram photos downloaded in local dev
    await photoItem.click();

    // Verify elevator is zoomed
    const stage = page.locator('#camera-stage');
    await expect(stage).toHaveClass(/is-zoomed/);

    // Verify HUD
    const hud = page.locator('[data-photo-hud]');
    await expect(hud).toBeVisible();
    const progress = page.locator('[data-photo-progress]');
    await expect(progress).toContainText(/Item \d+ of \d+/);

    // Click HUD close button exits elevator cleanly
    const hudClose = page.locator('[data-photo-close]');
    await hudClose.click();
    await expect(stage).not.toHaveClass(/is-zoomed/);
  });
});
