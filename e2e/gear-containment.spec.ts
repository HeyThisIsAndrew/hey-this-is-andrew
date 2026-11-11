import { test, expect } from '@playwright/test';

const sizes = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 820, height: 1180 },
  { width: 1440, height: 900 },
];

for (const viewport of sizes) {
  test(`gear sections contain their deck and hidden grid at ${viewport.width}`, async ({ browser, baseURL }, testInfo) => {
    const context = await browser.newContext({ baseURL, viewport, hasTouch: viewport.width < 1000, isMobile: viewport.width < 1000 });
    const page = await context.newPage();
    await page.goto('/hey-this-is-andrew/gear/');
    await page.waitForFunction(() => document.querySelector('#gear-accordion-container')?.getAttribute('data-gear-wired') === '1');
    const sections = page.locator('.gear-accordion-section');
    for (const section of await sections.all()) {
      if (!(await section.getAttribute('class'))?.includes('is-expanded')) await section.locator('.gear-accordion-header').click();
      await expect(section).toHaveClass(/is-settled/);
      const geometry = () => section.evaluate(sec => {
        const rect = (selector: string) => sec.querySelector(selector)!.getBoundingClientRect();
        const body = rect('.gear-accordion-body');
        const deck = rect('.gear-deck');
        const stage = rect('.deck-stage');
        const card = rect('.deck-card.active');
        const children = ['.card-img', '.card-title', '.card-spec'].map(sel => {
          const el = sec.querySelector(`.deck-card.active ${sel}`);
          if (!el) return true;
          const r = el.getBoundingClientRect();
          return r.left >= card.left - 1 && r.right <= card.right + 1 && r.top >= card.top - 1 && r.bottom <= card.bottom + 1 && el.scrollWidth <= el.clientWidth + 1;
        });
        return { contained: deck.width <= body.width + 1 && stage.width <= deck.width + 1 && card.width <= stage.width + 1 && children.every(Boolean), gap: body.height - deck.height, widths: { deck: deck.width, stage: stage.width, card: card.width, image: sec.querySelector('.deck-card.active .card-img')?.getBoundingClientRect().width, title: rect('.deck-card.active .card-title').width } };
      });
      await expect.poll(async () => (await geometry()).contained).toBe(true);
      await expect.poll(async () => Math.abs((await geometry()).gap)).toBeLessThan(2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      const id = await section.getAttribute('id');
      await testInfo.attach(`${viewport.width}-${id}-measurements`, { body: JSON.stringify(await geometry()), contentType: 'application/json' });
      if (id === 'gear-lenses' && [390, 1440].includes(viewport.width)) await section.screenshot({ path: `verification/gear-deck/after-${viewport.width}.png` });
    }
    const toggle = page.locator('[data-all-toggle]');
    const grid = page.locator('#gear-all-products');
    await expect(toggle).toHaveCount(1);
    await expect(sections.locator('[data-all-toggle]')).toHaveCount(0);
    for (let round = 0; round < 2; round++) {
      await toggle.click();
      await expect(page.locator('#gear-accordion-container')).toBeHidden();
      await expect(grid).toBeVisible();
      await expect(grid).not.toHaveClass(/is-collapsed/);
      await expect(grid.locator('.all-grid-card:visible')).toHaveCount(45);
      await grid.locator('.all-grid-card').last().scrollIntoViewIfNeeded();
      await expect(grid.locator('.all-grid-card').last()).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      if (round === 0) {
        await page.locator('#gear-search-input').fill('90mm');
        await expect(grid.locator('.all-grid-card:visible')).toHaveCount(1);
        await expect(grid.locator('.all-grid-card:visible')).toContainText('Sony FE 90mm');
        await expect(grid.locator('[data-grid-count]')).toHaveText('1 product');
        await page.locator('#gear-search-clear').click();
        await page.locator('.gear-chip[data-cat="lenses"]').click();
        await expect(grid.locator('.all-grid-card:visible')).toHaveCount(9);
        await page.locator('#gear-search-input').fill('no-such-product');
        await expect(grid.locator('.all-grid-card:visible')).toHaveCount(0);
        await expect(page.locator('#gear-empty-state')).toBeVisible();
        await page.locator('#gear-reset-btn').click();
        await expect(grid.locator('.all-grid-card:visible')).toHaveCount(45);
        if ([390, 1440].includes(viewport.width)) {
          await grid.locator('.all-grid-topbar').scrollIntoViewIfNeeded();
          await page.screenshot({ path: `verification/gear-deck/grid-${viewport.width}.png` });
        }
      }
      await toggle.click();
      await expect(grid).toBeHidden();
      await expect(page.locator('#gear-accordion-container')).toBeVisible();
      await expect(page.locator('.gear-accordion-section.is-expanded')).toHaveCount(1);
    }
    await page.goto('/hey-this-is-andrew/brands/be-unconventional-hq/');
    const photos = page.locator('.hq-photo');
    expect(await photos.count()).toBeGreaterThan(0);
    if (viewport.width < 900) {
      for (const photo of await photos.all()) {
        await photo.scrollIntoViewIfNeeded();
        await expect.poll(() => photo.evaluate(img => { const r = img.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1; })).toBe(true);
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await context.close();
  });
}

test('phone: all nine lenses fit, thumbnails scroll and touch swipes rotate', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: sizes[0], hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto('/hey-this-is-andrew/gear/');
  const section = page.locator('#gear-lenses');
  await section.locator('.gear-accordion-header').tap();
  await expect(section).toHaveClass(/is-settled/);
  const thumbs = section.locator('.deck-thumb-tile');
  await expect(thumbs).toHaveCount(9);
  for (let i = 0; i < 9; i++) {
    const thumb = thumbs.nth(i);
    await thumb.scrollIntoViewIfNeeded();
    await thumb.tap();
    await expect(section.locator('.deck-card.active')).toHaveAttribute('data-index', String(i));
    await expect.poll(() => section.locator('.deck-card.active .card-img').evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect.poll(() => section.locator('.deck-card.active').evaluate(card => {
      const r = card.getBoundingClientRect();
      return ['.card-img', '.card-title', '.card-spec'].every(sel => {
        const el = card.querySelector(sel)!;
        const c = el.getBoundingClientRect();
        return c.left >= r.left - 1 && c.right <= r.right + 1 && c.top >= r.top - 1 && c.bottom <= r.bottom + 1 && el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1;
      });
    })).toBe(true);
    await expect.poll(() => thumb.evaluate(el => {
      const track = el.parentElement!;
      const desired = Math.max(0, Math.min(track.scrollWidth - track.clientWidth, (el as HTMLElement).offsetLeft - track.clientWidth / 2 + (el as HTMLElement).offsetWidth / 2));
      return Math.abs(track.scrollLeft - desired);
    })).toBeLessThan(2);
  }
  const stage = section.locator('.deck-stage');
  await stage.scrollIntoViewIfNeeded();
  const session = await context.newCDPSession(page);
  for (let i = 0; i < 9; i++) {
    const box = (await stage.boundingBox())!;
    const x = box.x + box.width * 0.75;
    const y = Math.max(90, box.y + Math.min(box.height * 0.4, 180));
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let step = 1; step <= 5; step++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - step * 22, y }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(section.locator('.deck-card.active')).toHaveAttribute('data-index', String(i));
    await page.waitForTimeout(550);
  }
  expect(await section.locator('.deck-card.next-1').evaluate(el => { const r = el.getBoundingClientRect(); const active = el.parentElement!.querySelector('.active')!.getBoundingClientRect(); return r.right > active.right && r.left < innerWidth; })).toBe(true);
  await context.close();
});

test('reduced motion opens sections and alternate grids without delayed content', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/hey-this-is-andrew/gear/');
  const section = page.locator('#gear-lenses');
  await section.locator('.gear-accordion-header').click();
  await expect(section).toHaveClass(/is-settled/);
  await expect(section).not.toHaveClass(/is-animating/);
  await page.locator('[data-all-toggle]').click();
  await expect(page.locator('#gear-all-products')).toBeVisible();
  await page.locator('[data-all-toggle]').click();
  await expect(page.locator('#gear-all-products')).toBeHidden();
  expect(await section.locator('.gear-accordion-body').evaluate(el => parseFloat(getComputedStyle(el).transitionDuration))).toBeLessThan(0.001);
});
