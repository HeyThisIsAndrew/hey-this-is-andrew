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
  if (path === 'build') await expect(page.locator('#goals [data-accordion-group]')).toHaveAttribute('data-ready', '1');
}

async function expectMatchingPanels(page: Page) {
  await expect.poll(() => page.locator('#goals [data-accordion-row]').evaluateAll(rows => rows.filter(row => {
    const expanded = row.querySelector('[data-accordion-header]')?.getAttribute('aria-expanded') === 'true';
    const body = row.querySelector<HTMLElement>('.accordion-body')!;
    return body.inert === expanded || (expanded ? body.getBoundingClientRect().height <= 1 : body.getBoundingClientRect().height > 1);
  }).map(row => row.id))).toEqual([]);
}

for (const start of ['./', './gear/']) {
  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    test(`Build panels collapse after navigation from ${start} with ${reducedMotion} motion`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion });
      await page.goto(start);
      await page.evaluate(() => {
        (window as any).__buildNavigation = 'same-document';
        document.addEventListener('astro:after-swap', () => {
          if (document.querySelector('#goals [data-accordion-group]')) {
            (window as any).__buildSwapEnhanced = document.documentElement.classList.contains('acc-js');
          }
        });
      });
      for (let visit = 0; visit < 2; visit++) {
        await navigate(page, 'Build in Public', 'build');
        const headers = page.locator('#goals [data-accordion-header]');
        await expect(headers.first()).toHaveAttribute('aria-expanded', 'true');
        await expect(page.locator('#goals [data-accordion-row].is-expanded')).toHaveCount(1);
        await expectMatchingPanels(page);
        // Once the component is loaded, collapsed styles must exist at the
        // swap itself, before scripts or a refresh can repair the layout.
        if (start === './' || visit > 0) expect(await page.evaluate(() => (window as any).__buildSwapEnhanced)).toBe(true);
        await headers.first().click();
        await expect(headers.first()).toHaveAttribute('aria-expanded', 'false');
        await expectMatchingPanels(page);
        for (const index of [1, (await headers.count()) - 1]) {
          await headers.nth(index).click();
          await expect(headers.nth(index)).toHaveAttribute('aria-expanded', 'true');
          await expect(page.locator('#goals [data-accordion-row].is-expanded')).toHaveCount(1);
          await expectMatchingPanels(page);
        }
        await headers.last().click();
        await expect(page.locator('#goals [data-accordion-row].is-expanded')).toHaveCount(0);
        await expectMatchingPanels(page);
        expect(await page.evaluate(() => (window as any).__buildNavigation)).toBe('same-document');
        await navigate(page, 'Gear', 'gear');
      }
      await page.goBack();
      await expect(page.locator('#goals [data-accordion-group]')).toHaveAttribute('data-ready', '1');
      await expectMatchingPanels(page);
      await page.goForward();
      await expect(page).toHaveURL(/\/gear\/$/);
    });
  }
}

test('Build panels remain readable without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  await page.goto('./build/');
  const bodies = page.locator('#goals .accordion-body');
  expect(await bodies.count()).toBeGreaterThan(1);
  expect(await bodies.evaluateAll(elements => elements.every(el => el.getBoundingClientRect().height > 1))).toBe(true);
  await context.close();
});
