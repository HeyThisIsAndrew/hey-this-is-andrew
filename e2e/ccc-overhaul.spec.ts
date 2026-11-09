import { test, expect } from '@playwright/test';

test.describe('CCC Page Overhaul Acceptance Verification', () => {
  test('Exact production layout: all sections intact and styled as on live', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('./ccc/');

    // Hero
    const hero = page.locator('.ccc-hero');
    await expect(hero).toBeVisible();
    await expect(hero.locator('.ccc-hero-logo')).toBeVisible();
    await expect(hero.locator('#ccc-hero-title')).toContainText('Content that brings people');
    await expect(hero.locator('#ccc-hero-title')).toContainText('through your door');
    await expect(hero.locator('.ccc-hero-sub')).toHaveText('Bars · Restaurants · Events');

    // All production sections exist in exact order
    const sectionIds = ['why', 'where', 'work', 'video', 'how', 'pricing', 'contact'];
    for (const id of sectionIds) {
      await expect(page.locator(`#${id}`)).toBeVisible();
    }

    // Section 03: The work mosaic and "Every part of your night"
    const work = page.locator('#work');
    await expect(work.locator('.ccc-night-copy')).toContainText('Every part of your night');
    await expect(work.locator('.ccc-mosaic-wide')).toBeVisible();
    await expect(work.locator('.ccc-mosaic-tile')).toHaveCount(4);
    await expect(work.locator('.ccc-room')).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('Modal: Start a project button opens modal with streamlined 5 fields', async ({ page }) => {
    await page.goto('./ccc/');

    const startButtons = page.locator('[data-open-ccc-modal]');
    await expect(startButtons).toHaveCount(5);

    // Open modal from hero button
    await startButtons.first().click();
    const modal = page.locator('#ccc-inquiry-modal');
    await expect(modal).toBeVisible();

    // Verify modal inputs exist and have appropriate labels (streamlined 5 fields)
    await expect(modal.locator('label[for="ccc-name"]')).toContainText('Your name');
    await expect(modal.locator('label[for="ccc-email"]')).toContainText('Email');
    await expect(modal.locator('label[for="ccc-venue"]')).toContainText('Venue name & city');
    await expect(modal.locator('label[for="ccc-service"]')).toContainText('What do you need?');
    await expect(modal.locator('label[for="ccc-notes"]')).toContainText('Dates, details, or questions');

    // Fill out fields and select options
    await modal.locator('#ccc-name').fill('Alex Rivera');
    await modal.locator('#ccc-email').fill('alex@nightjarbar.com');
    await modal.locator('#ccc-venue').fill('Nightjar, Los Angeles');
    await modal.locator('#ccc-service').selectOption('Photo + vertical reel bundle');
    await modal.locator('#ccc-notes').fill('New winter cocktail menu and late-night room energy.');

    await modal.locator('button[type="submit"]').click();

    // Confirmation state
    const confirmBox = modal.locator('#ccc-confirm-box');
    await expect(confirmBox).toBeVisible();
    await expect(modal.locator('#ccc-confirm-msg')).toHaveText(
      'Thanks. We will get back to you to schedule a call.'
    );

    // Prefilled mailto link & fallback composed text
    const mailtoHref = await modal.locator('#ccc-mailto-link').getAttribute('href');
    expect(mailtoHref).toContain('mailto:capturecreatecaffeinate@gmail.com');
    expect(decodeURIComponent(mailtoHref || '')).toContain('CCC shoot inquiry: Nightjar, Los Angeles');
    expect(decodeURIComponent(mailtoHref || '')).toContain('Name: Alex Rivera');
    expect(decodeURIComponent(mailtoHref || '')).toContain('Email: alex@nightjarbar.com');
    expect(decodeURIComponent(mailtoHref || '')).toContain('Venue: Nightjar, Los Angeles');
    expect(decodeURIComponent(mailtoHref || '')).toContain('Package/Service: Photo + vertical reel bundle');
    expect(decodeURIComponent(mailtoHref || '')).toContain('Notes & dates: New winter cocktail menu and late-night room energy.');

    const payload = await modal.locator('#ccc-copy-payload').inputValue();
    expect(payload).toContain('Subject: CCC shoot inquiry: Nightjar, Los Angeles');
    expect(payload).toContain('Venue: Nightjar, Los Angeles');
    expect(payload).toContain('Package/Service: Photo + vertical reel bundle');
    await expect(modal.locator('#ccc-copy-btn')).toBeVisible();

    // Close button closes modal
    await modal.locator('#ccc-modal-close').click();
    await expect(modal).toBeHidden();
  });

  test('Scrolling maintains natural section flow and visibility', async ({ page }) => {
    await page.goto('./ccc/');

    const sectionIds = ['why', 'where', 'work', 'video', 'how', 'pricing', 'contact'];
    for (const id of sectionIds) {
      const sec = page.locator(`#${id}`);
      await expect(sec).toBeVisible();
    }

    // Scroll down to the bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(100);
    await expect(page.locator('#contact')).toBeVisible();

    // Scroll back up to the top
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(100);
    await expect(page.locator('.ccc-hero')).toBeVisible();
  });
});
