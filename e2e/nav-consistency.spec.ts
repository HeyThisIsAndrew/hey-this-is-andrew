import { test, expect, type Page } from '@playwright/test';

/*
 * The header holds still between pages (2026-11-20): /brands/ (no scroll,
 * no sections) dropped the scrollbar gutter and the sections button, and
 * its links and Menu shifted. Measured on a fresh load of every top-level
 * page and after moving between them with the header.
 */
const pages = ['', 'about/', 'brands/', 'gear/', 'work-with-me/', 'latest/', 'writing/', 'brands/be-unconventional-hq/'];

const navBoxes = (page: Page) =>
  page.evaluate(() => {
    const box = (sel: string) => {
      const r = document.querySelector(sel)?.getBoundingClientRect();
      return r && r.width ? [r.left, r.top, r.width].map(Math.round).join(',') : 'none';
    };
    return ['.site-nav', '.site-nav .wordmark', '.desktop-nav', '.nav-search-btn', '.site-nav .menu-btn'].map(box).join(' | ');
  });

test('the header sits in the same place on every page', async ({ page }) => {
  await page.goto('./');
  await page.waitForLoadState('networkidle');
  const home = await navBoxes(page);
  for (const path of pages.slice(1)) {
    await page.goto(`./${path}`);
    await page.waitForLoadState('networkidle');
    expect(await navBoxes(page), path).toBe(home);
  }

  // Moving between pages with the header, as a visitor does.
  await page.goto('./about/');
  await page.waitForLoadState('networkidle');
  const menu = page.locator('.site-nav .menu-btn');
  if (await menu.isVisible()) {
    await menu.click();
    await page.locator('#mobile-menu').getByRole('link', { name: 'Brands', exact: true }).first().click();
  } else {
    await page.locator('.desktop-nav').getByRole('link', { name: 'Brands', exact: true }).first().click();
  }
  await expect(page).toHaveURL(/\/brands\/$/);
  await page.waitForFunction(() => document.querySelector('main')?.getAttribute('data-chrome-wired') === '1');
  await expect.poll(() => navBoxes(page)).toBe(home);
});
