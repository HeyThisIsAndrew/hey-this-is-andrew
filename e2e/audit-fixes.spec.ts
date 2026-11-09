import { test, expect } from '@playwright/test';

test.describe('Audit Fixes Verification', () => {
  test('Brand-Client Block under #services renders 4-column card grid with exact copy', async ({ page }) => {
    await page.goto('./');

    const clientBlock = page.locator('#services [data-client-block]');
    await expect(clientBlock).toBeVisible();

    const cards = clientBlock.locator('.client-card');
    await expect(cards).toHaveCount(4);

    await expect(cards.nth(0)).toContainText('Starting Rate');
    await expect(cards.nth(0)).toContainText('Photo sessions start at $950. Add a reel for $550, or get both for $1,200 (founding rate). Events quoted by scope.');
    await expect(cards.nth(0).locator('a')).toHaveAttribute('href', /\/ccc\/(#how|#pricing)?$/);

    await expect(cards.nth(1)).toContainText('Turnaround');
    await expect(cards.nth(1)).toContainText('15 selects the next day. The full gallery within a week.');

    await expect(cards.nth(2)).toContainText('Deliverables & Usage');
    await expect(cards.nth(2)).toContainText('Edited photos and vertical reels, licensed for your social and web.');

    await expect(cards.nth(3)).toContainText('Client Results');
    await expect(cards.nth(3)).toContainText('Shot on location for Desert Escape at Ace Hotel Palm Springs, the Stone Groove Stillhouse launch, and brand and creator campaigns.');
  });

  test('Contact rule: UGC CTA on homepage, no CCC email on homepage or gear page', async ({ page }) => {
    await page.goto('./');

    const expectedUgcHref =
      'mailto:heythisisandrewb@gmail.com?subject=Product%20review%20%2F%20brand%20partnership' +
      '&body=Brand%3A%0AProduct%3A%0AWhat%20you%20want%20shown%3A%0ATimeline%3A%0A';

    // 1. Homepage services has exactly one UGC CTA
    const servicesCta = page.locator('#services a:has-text("Send a product to review")');
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

  test('Homepage section order has What I do (#services) above Goals (#goals)', async ({ page }) => {
    await page.goto('./');
    const servicesY = await page.locator('#services').evaluate(el => el.getBoundingClientRect().top);
    const goalsY = await page.locator('#goals').evaluate(el => el.getBoundingClientRect().top);
    expect(servicesY).toBeLessThan(goalsY);
  });

  test('Elevator video tile zooms first, then plays in place', async ({ page }) => {
    await page.goto('./');

    const videoItem = page.locator('.photo-set:not([aria-hidden]) .photo-item[data-video-url]').first();
    if ((await videoItem.count()) === 0) return; // No Instagram photos downloaded in local dev
    await expect(videoItem.locator('.photo-play-badge')).toContainText('Video');

    // A video tile zooms into the elevator view like a photo: nothing plays
    // and no separate dialog opens.
    await videoItem.evaluate((el) => (el as HTMLElement).click());
    await expect(page.locator('.photo-section')).toHaveClass(/is-zoomed/);
    const player = page.locator('[data-photo-player]');
    await expect(player).toBeHidden();
    await expect(page.locator('#photo-reel-player')).toHaveCount(0);

    // A reel with no self-hosted file has no Play (Instagram's embed refuses
    // those reels); the dock's Instagram link is the way to it, and a second
    // tap on the tile opens no player.
    const hasFile = await videoItem.evaluate((el) => Boolean((el as HTMLElement).dataset.videoSrc));
    await expect(page.locator('[data-photo-watch]')).toBeVisible();
    if (!hasFile) {
      await expect(page.locator('[data-photo-play]')).toBeHidden();
      await videoItem.evaluate((el) => (el as HTMLElement).click());
      await expect(player).toBeHidden();
      await expect(page.locator('iframe[src*="instagram.com"]')).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(page.locator('.photo-section')).not.toHaveClass(/is-zoomed/);
      return;
    }

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
