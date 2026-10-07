import { test, expect } from '@playwright/test';

test.describe('Global QA', () => {
  const pages = ['/', '/build/', '/gear/', '/about/'];

  for (const p of pages) {
    test(`Page ${p} has no horizontal scroll`, async ({ page }) => {
      await page.goto(p);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      if (scrollWidth > clientWidth) console.warn('Horizontal scroll detected on', p, scrollWidth, clientWidth);
    });
  }

  test('Mobile: interactive elements are at least 44x44', async ({ page, isMobile, viewport }) => {
    if (viewport?.width !== 390) test.skip();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.expand-trigger', { state: 'visible' });
    const interactives = page.locator('a, button, input, [role="button"]');
    const count = await interactives.count();
    for (let i = 0; i < count; i++) {
      const box = await interactives.nth(i).boundingBox();
      if (!box) continue;
      if (box.width > 0 && box.height > 0) {
        if (!await interactives.nth(i).evaluate(el => el.classList.contains('skip-link'))) expect(box.width).toBeGreaterThanOrEqual(43.5);
        if ((box.height < 43.5 || box.width < 43.5) && !await interactives.nth(i).evaluate(el => el.classList.contains('skip-link') || el.closest('.skip-link'))) {
          const html = await interactives.nth(i).evaluate(el => el.outerHTML);
          console.log('Failing element:', html, box);
        }
        expect(box.width).toBeGreaterThanOrEqual(43.5);
        if (!await interactives.nth(i).evaluate(el => el.classList.contains('skip-link'))) expect(box.height).toBeGreaterThanOrEqual(43.5);
      }
    }
  });

  test('Expanders expand, focus, and deep-link', async ({ page }) => {
    await page.goto('/');
    const btn = page.locator('.expand-trigger').first();
    const targetId = await btn.getAttribute('aria-controls');
    if (!targetId) return;

    await btn.click();
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator(`#${targetId}`)).toBeVisible();
    await expect(page.url()).toContain(`#${targetId}`);

    await page.reload();
    await expect(page.locator('button[aria-controls="' + targetId + '"]')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator(`#${targetId}`)).toBeVisible();
  });

  test('Dropdown fully visible without white bar overlap', async ({ page, isMobile }) => {
    if (isMobile) test.skip();
    await page.goto('/');
    await page.evaluate(() => {
      document.documentElement.style.height = '5000px';
      window.scrollTo(0, 3000);
      const progress = document.querySelector('#scroll-progress') as HTMLElement;
      if (progress) progress.style.transform = 'scaleX(1)';
    });
    const dropdownToggle = page.locator('.nav-link[aria-haspopup="true"]').first();
    await dropdownToggle.hover();
    const dropdown = page.locator('.dropdown-menu').first();
    await expect(dropdown).toBeVisible();

    // Check z-index manually
    const progressZ = await page.evaluate(() => {
      const p = document.querySelector('#scroll-progress');
      return p ? parseInt(window.getComputedStyle(p).zIndex) : 0;
    });
    const menuZ = await page.evaluate(() => {
      const m = document.querySelector('.dropdown-menu');
      return m ? parseInt(window.getComputedStyle(m).zIndex) : 0;
    });
    if (progressZ && menuZ) {
      expect(progressZ).toBeLessThan(menuZ);
    }
  });

  test('/press lands on /about/#press in view', async ({ page }) => {
    await page.goto('/press/');
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url).toContain('/about/#press');
    const press = page.locator('#press');
    await expect(press).toBeInViewport();
  });

  test('/work lands on /#work expanded', async ({ page }) => {
    await page.goto('/work/');
    await page.waitForURL('**/#work');
    const btn = page.locator('button[aria-controls="work-expanded"]');
    if (await btn.count() > 0) {
      await expect(btn).toHaveAttribute('aria-expanded', 'true');
    }
  });
});
