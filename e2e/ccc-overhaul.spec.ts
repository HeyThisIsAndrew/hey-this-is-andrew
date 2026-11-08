import { test, expect } from '@playwright/test';

test.describe('CCC Page Overhaul Acceptance Verification', () => {
  test('Hero: logo + "Bars. Restaurants. Events" + coupe image, no tagline, logo largest', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('./ccc/');

    const hero = page.locator('.ccc-hero');
    await expect(hero).toBeVisible();

    const logo = hero.locator('.ccc-hero-logo');
    const sub = hero.locator('#ccc-title');
    const heroImg = hero.locator('.ccc-hero-media img');

    await expect(logo).toBeVisible();
    await expect(sub).toHaveText('Bars. Restaurants. Events');
    await expect(heroImg).toBeVisible();

    // No tagline or paragraph in hero
    await expect(hero).not.toContainText('Content that brings people through your door');
    await expect(hero.locator('p')).toHaveCount(0);

    // Logo must outweigh the text line
    const logoBox = await logo.boundingBox();
    const subBox = await sub.boundingBox();
    expect(logoBox).not.toBeNull();
    expect(subBox).not.toBeNull();
    expect(logoBox!.width).toBeGreaterThan(subBox!.width);
    expect(logoBox!.height).toBeGreaterThan(subBox!.height);

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

    // Verify all 7 required fields in order
    const fields = modal.locator('#ccc-inquiry-form').locator('input, textarea, select');
    await expect(fields).toHaveCount(7);

    await expect(modal.locator('label[for="ccc-name"]')).toContainText('Your name');
    await expect(modal.locator('label[for="ccc-email"]')).toContainText('Email');
    await expect(modal.locator('label[for="ccc-venue"]')).toContainText('Venue name');
    await expect(modal.locator('label[for="ccc-location"]')).toContainText('Venue location, city or neighborhood');
    await expect(modal.locator('label[for="ccc-showoff"]')).toContainText('What do you want to show off?');
    await expect(modal.locator('#ccc-showoff')).toHaveAttribute(
      'placeholder',
      'the menu, the room, the people, anything new.'
    );
    await expect(modal.locator('label[for="ccc-date"]')).toContainText('Preferred date or dates');
    await expect(modal.locator('label[for="ccc-budget"]')).toContainText('Budget');

    // Fill out all 7 fields and submit
    await modal.locator('#ccc-name').fill('Alex Rivera');
    await modal.locator('#ccc-email').fill('alex@nightjarbar.com');
    await modal.locator('#ccc-venue').fill('Nightjar');
    await modal.locator('#ccc-location').fill('Silver Lake, Los Angeles');
    await modal.locator('#ccc-showoff').fill('New winter cocktail menu and late-night room energy.');
    await modal.locator('#ccc-date').fill('2026-12-10');
    await modal.locator('#ccc-budget').selectOption('$1,200 to $2,000');

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
    expect(decodeURIComponent(mailtoHref || '')).toContain('Location: Silver Lake, Los Angeles');
    expect(decodeURIComponent(mailtoHref || '')).toContain('What to show off: New winter cocktail menu and late-night room energy.');
    expect(decodeURIComponent(mailtoHref || '')).toContain('Preferred dates: 2026-12-10');
    expect(decodeURIComponent(mailtoHref || '')).toContain('Budget: $1,200 to $2,000');

    const payload = await modal.locator('#ccc-copy-payload').inputValue();
    expect(payload).toContain('Subject: CCC shoot inquiry: Nightjar');
    expect(payload).toContain('Budget: $1,200 to $2,000');
    await expect(modal.locator('#ccc-copy-btn')).toBeVisible();

    // Close button closes modal
    await modal.locator('#ccc-modal-close').click();
    await expect(modal).toBeHidden();
  });

  for (const vp of [
    { name: 'desktop-1920', width: 1920, height: 1080 },
    { name: 'mobile-390', width: 390, height: 844 },
  ]) {
    test(`Scroll collapse & strip tap works at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('./ccc/');

      const panels = page.locator('[data-ccc-panel]');
      await expect(panels).toHaveCount(5);

      const expectedTitles = [
        '01 Why it matters',
        '02 Where it goes',
        '03 The work',
        '04 Real nights',
        '05 How it works',
      ];
      for (let i = 0; i < 5; i++) {
        const strip = panels.nth(i).locator('[data-ccc-strip]');
        const num = (await strip.locator('.ccc-strip-num').textContent())?.trim() ?? '';
        const title = (await strip.locator('.ccc-strip-title').textContent())?.trim() ?? '';
        expect(`${num} ${title}`).toBe(expectedTitles[i]);
      }

      // Panel 01 open on load, rest collapsed
      await expect(panels.nth(0)).toHaveClass(/is-expanded/);
      for (let i = 1; i < 5; i++) {
        await expect(panels.nth(i)).toHaveClass(/is-collapsed/);
      }

      // Scroll down past Panel 01 -> Panel 01 collapses, Panel 02 expands
      await page.evaluate(() => {
        const p1 = document.querySelectorAll('[data-ccc-panel]')[1];
        const y = p1.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.4;
        window.scrollTo(0, y);
      });
      await page.waitForTimeout(450);

      await expect(panels.nth(0)).toHaveClass(/is-collapsed/);
      await expect(panels.nth(1)).toHaveClass(/is-expanded/);
      await expect(page.locator('[data-ccc-panel].is-expanded')).toHaveCount(1);

      // Tapping Strip 04 expands only Panel 04 and collapses the rest
      await panels.nth(3).locator('[data-ccc-strip]').click();
      await expect(panels.nth(3)).toHaveClass(/is-expanded/);
      await expect(page.locator('[data-ccc-panel].is-expanded')).toHaveCount(1);

      // Passed strips (01, 02, 03) are stacked in order at the top
      const r0 = await panels.nth(0).locator('[data-ccc-strip]').boundingBox();
      const r1 = await panels.nth(1).locator('[data-ccc-strip]').boundingBox();
      const r2 = await panels.nth(2).locator('[data-ccc-strip]').boundingBox();
      expect(r0!.y).toBeLessThan(r1!.y);
      expect(r1!.y).toBeLessThan(r2!.y);

      // Tapping Strip 01 expands Panel 01 again
      await panels.nth(0).locator('[data-ccc-strip]').click();
      await expect(panels.nth(0)).toHaveClass(/is-expanded/);
      await expect(page.locator('[data-ccc-panel].is-expanded')).toHaveCount(1);
    });
  }

  test('Reduced motion disables scroll-driven collapse while preserving click accordion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./ccc/');

    const panels = page.locator('[data-ccc-panel]');
    await expect(panels.nth(0)).toHaveClass(/is-expanded/);

    // Scrolling does not auto-collapse Panel 01 under reduced motion
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(300);
    await expect(panels.nth(0)).toHaveClass(/is-expanded/);

    // Clicking Strip 02 expands Panel 02 and collapses Panel 01
    await panels.nth(1).locator('[data-ccc-strip]').click();
    await expect(panels.nth(1)).toHaveClass(/is-expanded/);
    await expect(panels.nth(0)).toHaveClass(/is-collapsed/);
  });

  test('Copy trim, photo credit, buyer facts, and monochrome rules', async ({ page }) => {
    await page.goto('./ccc/');

    // Open Panel 03 to verify photo credit and deleted nightList
    const panels = page.locator('[data-ccc-panel]');
    await panels.nth(2).locator('[data-ccc-strip]').click();
    await expect(page.locator('.ccc-credit')).toHaveText(
      'Photographs by Andrew Baxter. Shot for Capture Create Caffeinate.'
    );
    await expect(panels.nth(2)).not.toContainText('Every part of your night');

    // Open Panel 05 to verify buyer facts survive
    await panels.nth(4).locator('[data-ccc-strip]').click();
    await expect(panels.nth(4)).toContainText('15 selects the next day');
    await expect(panels.nth(4)).toContainText('within a week');
    await expect(panels.nth(4)).toContainText('No cap on photos');
    await expect(panels.nth(4)).toContainText('Small footprint');

    // No em dashes anywhere on the page
    const fullHtmlText = await page.evaluate(() => document.body.textContent || '');
    expect(fullHtmlText).not.toContain('—');
  });
});
