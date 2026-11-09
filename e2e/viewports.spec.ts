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
      await expect(cards).toHaveCount(3);

      // 2. UGC CTA on homepage services section (no CCC mailto on homepage)
      const ctaUgc = page.locator('#services a[href^="mailto:heythisisandrewb@gmail.com"]');
      await expect(ctaUgc).toBeVisible();
      await expect(page.locator('#work a:has-text("Start a project")')).toHaveCount(0);
      await expect(page.locator('#gear a:has-text("Start a project")')).toHaveCount(0);

      // 3. Section order (#services above #goals)
      const servicesY = await page.locator('#services').evaluate((el) => el.getBoundingClientRect().top);
      const goalsY = await page.locator('#goals').evaluate((el) => el.getBoundingClientRect().top);
      expect(servicesY).toBeLessThan(goalsY);

      // 4. Elevator 4 columns at 1920 / desktop
      if (vp.width >= 1200) {
        const colCount = await page.locator('.photo-column').count();
        if (colCount > 0) {
          const visibleCols = await page.locator('.photo-column').evaluateAll((cols) =>
            cols.filter((c) => getComputedStyle(c).display !== 'none').length
          );
          expect(visibleCols).toBe(4);
        } else {
          // In local environment without Instagram sync credentials, verify elevator columns on UI showroom
          await page.goto('./kit/');
          const visibleCols = await page.locator('.photo-column').evaluateAll((cols) =>
            cols.filter((c) => getComputedStyle(c).display !== 'none').length
          );
          expect(visibleCols).toBe(4);
        }
      }

      // 5. Gear page: no CCC mailto per Nov 9 contact rule
      await page.goto('./gear/');
      await expect(page.locator('.gear-project-cta')).toHaveCount(0);
      await expect(page.locator('a[href*="capturecreatecaffeinate@gmail.com"]')).toHaveCount(0);

      const disclosure = page.locator('[data-affiliate-disclosure]');
      await expect(disclosure).toBeVisible();
      await expect(disclosure).toContainText('As an Amazon Associate, I earn from qualifying purchases.');
    });
  });
}
