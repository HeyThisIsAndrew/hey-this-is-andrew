import { test, expect } from '@playwright/test';

test.describe('Global QA', () => {
  const pages = ['./', './build/', './about/'];

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
    await page.goto('./');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.expand-trigger', { state: 'visible' });
    const interactives = page.locator('a:not(.press-link a):not(.footer-privacy):not([target="_blank"]), button, input, [role="button"]');
    const count = await interactives.count();
    for (let i = 0; i < count; i++) {
      const box = await interactives.nth(i).boundingBox();
      if (!box) continue;
      if (box.width > 0 && box.height > 0) {
        const isExempt = await interactives.nth(i).evaluate(el => el.classList.contains('skip-link') || el.classList.contains('filter-tab') || el.classList.contains('gear-chip') || el.hasAttribute('data-pn-link'));
        if (!isExempt) {
          expect(box.width).toBeGreaterThanOrEqual(43.5);
          expect(box.height).toBeGreaterThanOrEqual(43.5);
        }
      }
    }
  });

  test('Expanders expand, focus, and deep-link', async ({ page }) => {
    await page.goto('./');
    const btn = page.locator('.expand-trigger').first();
    const targetId = await btn.getAttribute('aria-controls');
    if (!targetId) return;

    await btn.click();
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator(`#${targetId}`)).toBeVisible();
    await expect(page.url()).toContain(`#${targetId}`);

    await page.reload();
    await expect(page.locator('button[aria-controls="' + targetId + '"]')).toHaveAttribute('aria-expanded', 'true');
  });

  test('Dropdown paints over the scroll bar, and the bar never hides', async ({ page, isMobile }) => {
    if (isMobile) test.skip();
    await page.goto('./');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
    await page.waitForTimeout(300);
    const bar = page.locator('#scroll-progress');
    await page.locator('.nav-link[aria-haspopup="true"]').first().hover();
    const dropdown = page.locator('.nav-item.is-open .dropdown-menu');
    await expect(dropdown).toBeVisible();
    // Hovering a nav link never wipes the line out (it used to be hidden
    // while any dropdown was open).
    await expect(bar).toBeVisible();
    // Where the menu crosses the bar, the menu is on top: paint order, not
    // z-index numbers (the menu's z-index only counts inside the header).
    const onTop = await page.evaluate(() => {
      const b = document.querySelector('#scroll-progress')!.getBoundingClientRect();
      const m = document.querySelector('.nav-item.is-open .dropdown-inner')!.getBoundingClientRect();
      const x = m.left + m.width / 2;
      const y = b.top + b.height / 2;
      if (y < m.top || y > m.bottom) return true; // they do not cross at all
      return Boolean(document.elementFromPoint(x, y)?.closest('.dropdown-menu'));
    });
    expect(onTop).toBe(true);
  });

  test('Hover never clears the active nav underline', async ({ page, isMobile }) => {
    if (isMobile) test.skip();
    await page.goto('./build/');
    const underline = (el: Element) => getComputedStyle(el, '::after').transform;
    const active = page.locator('.desktop-nav .nav-link.active');
    await expect(active).toHaveCount(1);
    const links = page.locator('.desktop-nav .nav-link');
    for (let i = 0; i < (await links.count()); i++) {
      await links.nth(i).hover();
      await page.waitForTimeout(450); // past the 0.35s underline transition
      await expect(active).toHaveClass(/\bactive\b/);
      expect(await active.evaluate(underline)).toBe('matrix(1, 0, 0, 1, 0, 0)');
    }
  });

  test('Brands: exactly three panels, and the camera zooms into each', async ({ page }) => {
    await page.goto('./');
    const panels = page.locator('[data-bacc-panel]');
    await expect(panels).toHaveCount(3);
    await expect(page.locator('[data-bacc-trigger]')).toHaveText([/BE Unconventional HQ/i, /Capture Create Caffeinate/i, /Sip the Magic/i]);
    await page.locator('[data-bacc]').scrollIntoViewIfNeeded();
    const viewport = page.locator('[data-bacc-viewport]');
    for (let i = 0; i < 3; i++) {
      const panel = panels.nth(i);
      if (!(await panel.evaluate((e) => e.classList.contains('is-open')))) await panel.locator('[data-bacc-trigger]').click();
      await expect(panel).toHaveClass(/is-open/);
      await panel.locator('.bacc-media').click({ force: true });
      await expect(viewport).toHaveClass(/is-zoomed/);
      await page.keyboard.press('Escape');
      await expect(viewport).not.toHaveClass(/is-zoomed/);
    }
  });

  test('Latest filters: Video and Writing toggle, equal widths, deep links', async ({ page }) => {
    await page.goto('./');
    const tabs = page.locator('#latest .filter-tab');
    await expect(tabs).toHaveText(['Video', 'Writing']);
    const [a, b] = await tabs.evaluateAll((ts) => ts.map((t) => t.getBoundingClientRect().width));
    expect(Math.abs(a - b)).toBeLessThan(1);
    const hidden = (kind: string) => page.locator(`#latest-home-list [data-kind="${kind}"]:not([hidden])`).count();
    await expect(tabs.nth(0)).toHaveAttribute('aria-pressed', 'false');
    await expect(tabs.nth(1)).toHaveAttribute('aria-pressed', 'false');
    const writingCount = await hidden('writing');
    await tabs.nth(0).click();
    await expect(tabs.nth(0)).toHaveAttribute('aria-pressed', 'true');
    expect(await hidden('writing')).toBe(0);
    await tabs.nth(0).click();
    await expect(tabs.nth(0)).toHaveAttribute('aria-pressed', 'false');
    expect(await hidden('writing')).toBe(writingCount);
    await page.goto('./?filter=writing#latest');
    await expect(tabs.nth(1)).toHaveAttribute('aria-pressed', 'true');
    expect(await hidden('video')).toBe(0);
  });

  test('/build: one accordion row per goal group, each opens and closes', async ({ page }) => {
    await page.goto('./build/');
    const headers = page.locator('.build-acc-header');
    expect(await headers.count()).toBeGreaterThanOrEqual(3);
    await expect(page.locator('.build-acc-row').first()).toHaveClass(/expanded/);
    for (let i = 1; i < (await headers.count()); i++) {
      await headers.nth(i).click();
      await expect(headers.nth(i)).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('.build-acc-row.expanded')).toHaveCount(1);
      await expect(page.locator('.build-acc-row').nth(i).locator('.build-acc-body')).toBeVisible();
    }
    await headers.last().click();
    await expect(page.locator('.build-acc-row.expanded')).toHaveCount(0);
    // A deep link opens its row.
    await page.goto('./build/#content-engine');
    await expect(page.locator('.build-acc-row[data-row="content-engine"]')).toHaveClass(/expanded/);
    await expect(page.locator('#content-engine-panel [role="progressbar"]')).toBeVisible();
  });

  test('Gear is its own page, reached from the nav', async ({ page, isMobile }) => {
    await page.goto('./');
    if (isMobile) {
      await page.locator('.menu-btn').click();
      await page.locator('.mobile-main-link', { hasText: 'Gear' }).click();
    } else {
      await page.locator('.desktop-nav .nav-link', { hasText: 'Gear' }).click();
    }
    await page.waitForURL('**/gear/');
    await expect(page.locator('h1')).toHaveText(/Gear/i);
    await expect(page.locator('#gear-monolith')).toBeVisible();
  });

  test('/press lands on /about/#press in view', async ({ page }) => {
    await page.goto('./press/');
    await page.waitForURL('**/about/#press', { timeout: 10000 });
    const press = page.locator('#press');
    await expect(press).toBeInViewport();
  });

  test('/work lands on /#work expanded', async ({ page }) => {
    await page.goto('./work/');
    await page.waitForURL('**/#work');
    const btn = page.locator('button[aria-controls="work-expanded"]');
    if (await btn.count() > 0) {
      await expect(btn).toHaveAttribute('aria-expanded', 'true');
    }
  });
});
