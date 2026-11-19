import { test, expect, type Page } from '@playwright/test';

/*
 * /gear: one gallery. Every category is an expanded full-width panel, one
 * after another; search and the category select filter across them.
 * Data: sites/hey-this-is-andrew/src/data/gear.json.
 */

const IDS = ['gear-bodies', 'gear-lenses', 'gear-lighting', 'gear-tools', 'gear-audio', 'brew', 'gear-gaming'];
const COUNTS: Record<string, number> = {
  'gear-bodies': 5, 'gear-lenses': 9, 'gear-lighting': 2, 'gear-tools': 9, 'gear-audio': 6, brew: 13, 'gear-gaming': 1,
};
const visiblePanels = (page: Page) => page.locator('.gear-panel:visible');
const count = (page: Page) => page.locator('[data-grid-count]');

test.describe('Gear page', () => {
  test('every category is an expanded panel with its kit, links and disclosures', async ({ page }) => {
    await page.goto('/hey-this-is-andrew/gear/');
    await expect(page).toHaveTitle(/Gear · HEY_THISISANDREW/);

    // Screen-reader h1 only; the lede and the disclosure stay.
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveClass(/\bvh\b/);
    await expect(page.locator('.gear-lede')).toHaveText('Behind the work. Updated as it evolves.');
    await expect(page.locator('[data-affiliate-disclosure]')).toContainText('As an Amazon Associate');

    // No deck, no accordion, no view toggle.
    await expect(page.locator('.gear-accordion-section, .deck-card, [data-all-toggle]')).toHaveCount(0);

    const panels = page.locator('.gear-panel');
    await expect(panels).toHaveCount(IDS.length);
    for (let i = 0; i < IDS.length; i++) await expect(panels.nth(i)).toHaveId(IDS[i]);
    for (const [id, n] of Object.entries(COUNTS)) {
      await expect(page.locator(`#${id} .gear-card:visible`)).toHaveCount(n);
    }
    await expect(count(page)).toHaveText('45 products');
    for (const hidden of ['Amaran PT1c', 'Light Dome Mini II', 'Weebill 3']) {
      await expect(page.locator('.gear-card', { hasText: hidden })).toHaveCount(0);
    }

    // Short CTA labels, never the product name or a URL.
    for (const l of await page.locator('.gear-card-cta:not(.gear-card-video)').allTextContents()) {
      expect(l.trim()).toMatch(/^View on [A-Za-z. ]+$/);
    }
    const a7 = page.locator('#gear-item-sony-a7iv');
    await expect(a7.locator('.gear-card-cta.is-primary')).toHaveAttribute('href', 'https://link.amazon/B0aDbXAM1');
    await expect(a7.locator('.gear-card-img')).toHaveAttribute('src', /\/gear\/sony-a7iv\.jpg$/);
    const viltrox = page.locator('.gear-card', { hasText: 'Viltrox AF 85mm f/2.0 EVO' });
    await expect(viltrox.locator('.gear-card-cta', { hasText: 'View on Amazon' })).toHaveAttribute('href', 'https://link.amazon/B03iIx6Ml');
    await expect(viltrox.locator('.gear-card-cta', { hasText: 'View on Viltrox' })).toHaveAttribute('href', 'https://viltrox.com/products/af-85mm-f2-0-fe?ref=thisisviltrox');
    await expect(viltrox.locator('.gear-card-img')).toHaveAttribute('src', /\/gear\/viltrox-85-f2-evo\.jpg$/);

    // Shop the lists: three tiles, unchanged destinations.
    const tiles = page.locator('.gear-collection-tile');
    await expect(tiles).toHaveCount(3);
    await expect(tiles.nth(0)).toHaveAttribute('href', 'https://a.co/d/00WeFxoS');
    await expect(tiles.nth(1)).toHaveAttribute('href', 'https://a.co/d/0fSswpx1');
    await expect(tiles.nth(2)).toHaveAttribute('href', 'https://a.co/d/070Rc6h9');
    await expect(page.locator('#brew .influencer-pill')).toHaveAttribute('href', 'https://a.co/d/0fSswpx1');
    await expect(page.locator('[data-bottom-disclosure]')).toHaveAccessibleName('Affiliate Disclosure');
    await expect(page.locator('[data-bottom-disclosure]')).toContainText('The Viltrox store link is an affiliate link');

    // Sharp corners, no sideways scroll.
    const rounded = await page.locator('.gear-monolith, .gear-collections').evaluateAll((roots) =>
      roots.flatMap((r) => [r, ...r.querySelectorAll('*')]).filter((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius) > 0).length);
    expect(rounded).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test('search and category filter cards across panels and hide empty panels', async ({ page }) => {
    await page.goto('/hey-this-is-andrew/gear/');
    const input = page.locator('#gear-search-input');

    await input.fill('90mm');
    await expect(visiblePanels(page)).toHaveCount(1);
    await expect(page.locator('#gear-lenses .gear-card:visible')).toHaveCount(1);
    await expect(page.locator('#gear-lenses .gear-card:visible')).toContainText('90mm');
    await expect(count(page)).toHaveText('1 product');

    await input.fill('Ascaso');
    await expect(page.locator('#brew')).toBeVisible();
    await expect(visiblePanels(page)).toHaveCount(1);

    await input.fill('zzzz');
    await expect(visiblePanels(page)).toHaveCount(0);
    await expect(page.locator('#gear-empty-state')).toBeVisible();
    await page.locator('#gear-reset-btn').click();
    await expect(visiblePanels(page)).toHaveCount(IDS.length);
    await expect(count(page)).toHaveText('45 products');

    const select = page.locator('#gear-category-select');
    await expect(select.locator('option')).toHaveCount(8);
    await select.selectOption('cafe');
    await expect(visiblePanels(page)).toHaveCount(1);
    await expect(page.locator('#brew .gear-card:visible')).toHaveCount(13);
    await input.fill('fellow');
    await expect(page.locator('#brew .gear-card:visible').first()).toContainText('Fellow');
    await page.locator('#gear-search-clear').click();
    await expect(count(page)).toHaveText('13 products');
  });

  test('toolbar is one tight row on desktop', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop layout');
    await page.goto('/hey-this-is-andrew/gear/');
    const boxes = await page.locator('.gear-filter-toolbar > *').evaluateAll((els) =>
      els.map((e) => e.getBoundingClientRect()).map((r) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom })));
    for (let i = 1; i < boxes.length; i++) expect(boxes[i].left - boxes[i - 1].right).toBeLessThanOrEqual(24);
    const mids = boxes.map((b) => (b.top + b.bottom) / 2);
    expect(Math.max(...mids) - Math.min(...mids)).toBeLessThanOrEqual(2);
  });

  test('section and item links land on their panel, clearing a filter that hides it', async ({ page }) => {
    await page.goto('/hey-this-is-andrew/gear/#brew');
    await expect(page.locator('#brew')).toBeInViewport();
    await page.locator('#gear-category-select').selectOption('lenses');
    await expect(page.locator('#gear-lighting')).toBeHidden();
    await page.evaluate(() => { location.hash = '#gear-item-aputure-amaran-200d'; });
    await expect(page.locator('#gear-lighting')).toBeVisible();
    await expect(page.locator('#gear-item-aputure-amaran-200d')).toBeVisible();
  });

  test('phone: every gear control is at least 44x44', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-mobile', 'phone layout');
    await page.goto('/hey-this-is-andrew/gear/');
    const small = await page.locator('.gear-search-input, .gear-category-select, .gear-card-cta, .influencer-pill, .gear-collection-tile').evaluateAll((els) =>
      els.map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && (r.width < 44 || r.height < 44)).length);
    expect(small).toBe(0);
  });
});
