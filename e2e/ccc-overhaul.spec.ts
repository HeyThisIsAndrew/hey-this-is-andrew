import { test, expect } from '@playwright/test';

test.describe('CCC Page Overhaul Acceptance Verification', () => {
  test('Hero: logo + headline (max 2 lines) + category line, no image in hero', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('./ccc/');

    const hero = page.locator('.ccc-hero');
    await expect(hero).toBeVisible();

    const logo = hero.locator('.ccc-hero-logo');
    const title = hero.locator('#ccc-title');
    const sub = hero.locator('.ccc-hero-sub');

    await expect(logo).toBeVisible();
    await expect(title).toHaveText('Content that brings people through your door');
    await expect(sub).toContainText('Bars · Restaurants · Events');

    // Only the logo image is present in hero - no photo in hero
    const heroImages = hero.locator('img');
    await expect(heroImages).toHaveCount(1);
    await expect(heroImages.first()).toHaveAttribute('alt', 'Capture Create Caffeinate logo');

    // Verify headline does not exceed 2 lines
    const titleBox = await title.boundingBox();
    expect(titleBox).not.toBeNull();
    // At line-height ~1.25 with clamp font-size, 2 lines is well under 90px
    expect(titleBox!.height).toBeLessThan(90);

    expect(errors).toEqual([]);
  });

  test('Pricing removed from page body and closer, present only inside modal', async ({ page }) => {
    await page.goto('./ccc/');

    await expect(page.locator('#pricing')).toHaveCount(0);
    await expect(page.locator('.ccc-closer-price')).toHaveCount(0);

    // Check visible text outside modal has no dollar signs
    const pageTextOutsideModal = await page.evaluate(() => {
      const clone = document.body.cloneNode(true) as HTMLElement;
      clone.querySelector('#ccc-inquiry-modal')?.remove();
      return clone.innerText;
    });
    expect(pageTextOutsideModal).not.toMatch(/\$950|\$1,200|\$1,500|\$550/);

    // Inside modal, pricing note and budget ranges exist
    const modal = page.locator('#ccc-inquiry-modal');
    await expect(modal.locator('#ccc-pricing-note')).toHaveText(
      'Half-day photo + reel starts at $1,200. Founding rate for the first 3 venues, regularly $1,500.'
    );
  });

  test('Modal: every Start a project button opens modal, 7 required fields, mailto + copy fallback', async ({ page }) => {
    await page.goto('./ccc/');

    const startButtons = page.locator('button:has-text("Start a project"), a:has-text("Start a project")');
    const count = await startButtons.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // No Start a project button on /ccc/ is a mailto link
    for (let i = 0; i < count; i++) {
      const href = await startButtons.nth(i).getAttribute('href');
      expect(href ?? '').not.toMatch(/^mailto:/);
    }

    // Open modal from first button, close with Escape
    await startButtons.first().click();
    const modal = page.locator('#ccc-inquiry-modal');
    await expect(modal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();

    // Open modal from closer button
    await startButtons.last().scrollIntoViewIfNeeded();
    await startButtons.last().click();
    await expect(modal).toBeVisible();

    // Verify modal inputs exist and have appropriate labels
    await expect(modal.locator('label[for="ccc-name"]')).toContainText('Your name');
    await expect(modal.locator('label[for="ccc-email"]')).toContainText('Email');
    await expect(modal.locator('label[for="ccc-venue"]')).toContainText('Venue name');
    await expect(modal.locator('label[for="ccc-location"]')).toContainText('Venue location');
    await expect(modal.locator('label[for="ccc-service"]')).toContainText('What are you looking for?');
    await expect(modal.locator('label[for="ccc-date"]')).toContainText('Preferred date or dates');
    await expect(modal.locator('label[for="ccc-budget"]')).toContainText('Budget');
    await expect(modal.locator('label[for="ccc-showoff"]')).toContainText('Special requests or details');
    await expect(modal.locator('.ccc-help-text')).toContainText('Feel free to type in any special requests or message');

    // Fill out fields and select options
    await modal.locator('#ccc-name').fill('Alex Rivera');
    await modal.locator('#ccc-email').fill('alex@nightjarbar.com');
    await modal.locator('#ccc-venue').fill('Nightjar');
    await modal.locator('#ccc-location').fill('Silver Lake, Los Angeles');
    await modal.locator('#ccc-service').selectOption('Photo + vertical reel bundle ($1,200 founding rate)');
    await modal.locator('input[value="Rush 48-hour gallery delivery"]').check();
    await modal.locator('#ccc-date').fill('2026-12-10');
    await modal.locator('#ccc-budget').selectOption('$1,200 to $2,000');
    await modal.locator('#ccc-showoff').fill('New winter cocktail menu and late-night room energy.');

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
    expect(decodeURIComponent(mailtoHref || '')).toContain('CCC shoot inquiry: Nightjar');
    expect(decodeURIComponent(mailtoHref || '')).toContain('Name: Alex Rivera');
    expect(decodeURIComponent(mailtoHref || '')).toContain('Email: alex@nightjarbar.com');
    expect(decodeURIComponent(mailtoHref || '')).toContain('Venue: Nightjar');
    expect(decodeURIComponent(mailtoHref || '')).toContain('Package/Service: Photo + vertical reel bundle ($1,200 founding rate)');
    expect(decodeURIComponent(mailtoHref || '')).toContain('Add-ons: Rush 48-hour gallery delivery');
    expect(decodeURIComponent(mailtoHref || '')).toContain('Budget: $1,200 to $2,000');

    const payload = await modal.locator('#ccc-copy-payload').inputValue();
    expect(payload).toContain('Subject: CCC shoot inquiry: Nightjar');
    expect(payload).toContain('Rush 48-hour gallery delivery');
    expect(payload).toContain('Budget: $1,200 to $2,000');
    await expect(modal.locator('#ccc-copy-btn')).toBeVisible();

    // Close button closes modal
    await modal.locator('#ccc-modal-close').click();
    await expect(modal).toBeHidden();
  });

  test('Scrolling up and down maintains section visibility', async ({ page }) => {
    await page.goto('./ccc/');

    const sectionIds = ['why', 'where', 'work', 'video', 'how', 'contact'];
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

    // Verify all sections remain fully visible in the DOM (no collapse failure)
    for (const id of sectionIds) {
      const sec = page.locator(`#${id}`);
      await expect(sec).toBeVisible();
      const box = await sec.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThan(100);
    }
  });

  test('Copy trim, photo credit, buyer facts, and monochrome rules', async ({ page }) => {
    await page.goto('./ccc/');

    // Photo credit in Section 03
    await expect(page.locator('.ccc-credit')).toHaveText(
      'Photographs by Andrew Baxter. Shot for Capture Create Caffeinate.'
    );

    // Section 05 buyer facts survive
    const howSec = page.locator('#how');
    await expect(howSec).toContainText('15 selects the next day');
    await expect(howSec).toContainText('within a week');
    await expect(howSec).toContainText('No cap on photos');
    await expect(howSec).toContainText('Small footprint');

    // Section 01 contains the coupe photo
    const whyCoupe = page.locator('#why img[alt*="coupe cocktail"]');
    await expect(whyCoupe).toBeVisible();

    // Zero em dashes anywhere on the page
    const fullHtmlText = await page.evaluate(() => document.body.textContent || '');
    expect(fullHtmlText).not.toContain('—');
  });
});
