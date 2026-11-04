import { test, expect } from '@playwright/test';

test.describe('Audit Fixes Verification', () => {
  test('Brand-Client Block under #services renders 4-column card grid with exact copy', async ({ page }) => {
    await page.goto('./');

    const clientBlock = page.locator('#services [data-client-block]');
    await expect(clientBlock).toBeVisible();

    const cards = clientBlock.locator('.client-card');
    await expect(cards).toHaveCount(4);

    await expect(cards.nth(0)).toContainText('Starting Rate');
    await expect(cards.nth(0)).toContainText('Custom quotes, scoped to your shoot, deliverables, and usage.');

    await expect(cards.nth(1)).toContainText('Turnaround');
    await expect(cards.nth(1)).toContainText('Proofs in days, not weeks. Finals delivered on your approval.');

    await expect(cards.nth(2)).toContainText('Deliverables & Usage');
    await expect(cards.nth(2)).toContainText('Edited photos and vertical reels, licensed for your social and web.');

    await expect(cards.nth(3)).toContainText('Client Results');
    await expect(cards.nth(3)).toContainText('Shot on location for Desert Escape at Ace Hotel Palm Springs, the Stone Groove Stillhouse launch, and brand and creator campaigns.');
  });

  test('Start a project CTAs are present at all 4 specified locations', async ({ page }) => {
    await page.goto('./');

    const expectedHref = 'mailto:capturecreatecaffeinate@gmail.com?subject=Photography%20project%20inquiry';

    // 1. End of Selected Work
    const selectedWorkCta = page.locator('#work a:has-text("Start a project")');
    await expect(selectedWorkCta).toBeVisible();
    await expect(selectedWorkCta).toHaveAttribute('href', expectedHref);

    // 2. End of What I do (#services)
    const servicesCta = page.locator('#services a:has-text("Start a project")');
    await expect(servicesCta).toBeVisible();
    await expect(servicesCta).toHaveAttribute('href', expectedHref);

    // 3. End of Gear teaser (#gear on homepage)
    const gearTeaserCta = page.locator('#gear a:has-text("Start a project")');
    await expect(gearTeaserCta).toBeVisible();
    await expect(gearTeaserCta).toHaveAttribute('href', expectedHref);

    // 4. On /gear/
    await page.goto('./gear/');
    const gearPageCta = page.locator('.gear-project-cta a:has-text("Start a project")');
    await expect(gearPageCta).toBeVisible();
    await expect(gearPageCta).toHaveAttribute('href', expectedHref);
  });

  test('Homepage section order has What I do (#services) above Goals (#goals)', async ({ page }) => {
    await page.goto('./');
    const servicesY = await page.locator('#services').evaluate(el => el.getBoundingClientRect().top);
    const goalsY = await page.locator('#goals').evaluate(el => el.getBoundingClientRect().top);
    expect(servicesY).toBeLessThan(goalsY);
  });

  test('Elevator video tile click opens inline reel player dialog', async ({ page }) => {
    await page.goto('./');

    const videoItem = page.locator('.photo-item[data-video-url]').first();
    if ((await videoItem.count()) === 0) return; // No Instagram photos downloaded in local dev
    await expect(videoItem).toBeVisible();

    // Verify visible Play Video badge at rest
    const playBadge = videoItem.locator('.photo-play-badge');
    await expect(playBadge).toBeVisible();
    await expect(playBadge).toContainText('Play Video');

    // Click video tile opens dialog
    await videoItem.click();
    const reelPlayer = page.locator('#photo-reel-player');
    await expect(reelPlayer).toBeVisible();
    await expect(reelPlayer).toHaveClass(/is-active/);

    // Close dialog
    const closeBtn = reelPlayer.locator('.pro-close');
    await closeBtn.click();
    await expect(reelPlayer).toBeHidden();
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
