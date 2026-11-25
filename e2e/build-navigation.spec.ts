import { test, expect, type Page } from '@playwright/test';

async function navigate(page: Page, name: string, path: string) {
  const menu = page.locator('.site-nav .menu-btn');
  if (await menu.isVisible()) {
    await menu.click();
    await page.locator('#mobile-menu').getByRole('link', { name, exact: true }).first().click();
  } else {
    await page.locator('.desktop-nav').getByRole('link', { name, exact: true }).first().click();
  }
  await expect(page).toHaveURL(new RegExp(`/hey-this-is-andrew/${path}/$`));
  if (path === 'writing') {
    await expect(page.locator('#goal-modal')).toHaveAttribute('data-goal-modal-ready', 'true');
  }
}

for (const start of ['./', './gear/']) {
  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    test(`Build in Public goals modal works after navigation from ${start} with ${reducedMotion} motion`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion });
      await page.goto(start);
      await page.evaluate(() => {
        (window as any).__buildNavigation = 'same-document';
      });

      for (let visit = 0; visit < 2; visit++) {
        await navigate(page, 'Build in Public', 'writing');
        await expect(page.locator('#writing [data-magazine-spread]')).toBeVisible();

        const boxes = page.locator('#goals .goal-box');
        await expect(boxes).toHaveCount(4);

        const firstBox = boxes.first();
        const groupId = await firstBox.getAttribute('data-goal-trigger');
        await firstBox.scrollIntoViewIfNeeded();
        await firstBox.click();

        const modal = page.locator('dialog#goal-modal[open]');
        await expect(modal).toBeVisible();
        await expect(modal.locator(`[data-goal-panel="${groupId}"]`)).toBeVisible();

        await page.keyboard.press('Escape');
        await expect(page.locator('dialog#goal-modal[open]')).toHaveCount(0);

        expect(await page.evaluate(() => (window as any).__buildNavigation)).toBe('same-document');
        await navigate(page, 'Gear', 'gear');
      }

      await page.goBack();
      await expect(page).toHaveURL(/\/hey-this-is-andrew\/writing\/$/);
      await expect(page.locator('#goal-modal')).toHaveAttribute('data-goal-modal-ready', 'true');
      await page.goForward();
      await expect(page).toHaveURL(/\/gear\/$/);
    });
  }
}

test('Build redirect stub and /writing/ remain readable without JavaScript', async ({ browser, baseURL, request }) => {
  const redirectRes = await request.get('./build/');
  expect(redirectRes.status()).toBe(200);
  const redirectHtml = await redirectRes.text();
  expect(redirectHtml).toMatch(/<meta http-equiv="refresh" content="0;url=[^"]*\/writing\/#goals"/);
  expect(redirectHtml).toMatch(/href="[^"]*\/writing\/#goals"/);

  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  await page.goto('./writing/');
  await expect(page.locator('#writing')).toBeVisible();
  await expect(page.locator('#goals .goal-box')).toHaveCount(4);
  await expect(page.locator('#goals .goal-preview-label')).toHaveCount(4);
  await expect(page.locator('#articles')).toBeVisible();
  await context.close();
});
