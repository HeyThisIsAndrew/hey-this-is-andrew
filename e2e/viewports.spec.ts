import { test, expect } from '@playwright/test';

const viewports = [
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'mobile-390-portrait', width: 390, height: 844 },
  { name: 'mobile-844-landscape', width: 844, height: 390 },
];

for (const vp of viewports) {
  test.describe(`Viewport ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(`Verifies all audit requirements at ${vp.name}`, async ({ page }) => {
      await page.goto('./');

      // 1. Brand Client block under #services
      const clientBlock = page.locator('#services [data-client-block]');
      await expect(clientBlock).toBeVisible();
      const cards = clientBlock.locator('.client-card');
      await expect(cards).toHaveCount(4);

      // 2. Start a project CTAs
      const ctaWork = page.locator('#work a[href^="mailto:capturecreatecaffeinate@gmail.com"]');
      await expect(ctaWork).toBeVisible();
      const ctaServices = page.locator('#services a[href^="mailto:capturecreatecaffeinate@gmail.com"]');
      await expect(ctaServices).toBeVisible();
      const ctaGear = page.locator('#gear a[href^="mailto:capturecreatecaffeinate@gmail.com"]');
      await expect(ctaGear).toBeVisible();

      // 3. Section order (#services above #goals)
      const servicesY = await page.locator('#services').evaluate((el) => el.getBoundingClientRect().top);
      const goalsY = await page.locator('#goals').evaluate((el) => el.getBoundingClientRect().top);
      expect(servicesY).toBeLessThan(goalsY);

      // 4. Elevator 4 columns at 1920
      if (vp.width >= 1200) {
        const visibleCols = await page.locator('.photo-column').evaluateAll((cols) =>
          cols.filter((c) => getComputedStyle(c).display !== 'none').length
        );
        expect(visibleCols).toBe(4);
      }

      // 5. Gear page
      await page.goto('./gear/');
      const ctaGearPage = page.locator('.gear-project-cta a[href^="mailto:capturecreatecaffeinate@gmail.com"]');
      await expect(ctaGearPage).toBeVisible();

      const disclosure = page.locator('[data-affiliate-disclosure]');
      await expect(disclosure).toBeVisible();
      await expect(disclosure).toContainText('As an Amazon Associate, I earn from qualifying purchases.');
    });
  });
}
