import { test, expect, type Page } from '@playwright/test';

/*
 * /gear: two views over one toolbar. The carousel (HQ featured deck, one
 * section open at a time) is the default; Show all lists every product as a
 * small tile, grouped by category. Data: sites/hey-this-is-andrew/src/data/gear.json.
 */

const IDS = ['gear-bodies', 'gear-lenses', 'gear-lighting', 'gear-tools', 'gear-audio', 'gear-desk', 'brew', 'gear-gaming'];
const CHIPS = ['cameras', 'lenses', 'lighting', 'support', 'audio', 'desk', 'cafe', 'gaming'];
const COUNTS: Record<string, number> = { cameras: 5, lenses: 9, lighting: 2, support: 9, audio: 8, desk: 7, cafe: 13, gaming: 1 };
const count = (page: Page) => page.locator('[data-grid-count]');
const toggle = (page: Page) => page.locator('[data-all-toggle]');
const showAll = async (page: Page) => {
  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#gear-all-products')).toBeVisible();
};

test.describe('Gear page', () => {
  test('carousel is the default view: the deck with one section open', async ({ page }) => {
    await page.goto('/hey-this-is-andrew/gear/');
    await expect(page).toHaveTitle(/Gear · HEY_THISISANDREW/);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveClass(/\bvh\b/);
    await expect(page.locator('.gear-lede')).toHaveText('Behind the work. Updated as it evolves.');
    await expect(page.locator('[data-affiliate-disclosure]')).toContainText('As an Amazon Associate');

    await expect(toggle(page)).toHaveText('Show all products');
    await expect(page.locator('#gear-all-products')).toBeHidden();
    await expect(page.locator('.box-idx')).toHaveCount(0);
    await expect(page.locator('.box-title')).toHaveText(['Cameras', 'Lenses', 'Lighting', 'Tools and Support', 'Audio', 'Command Station Desk', 'Cafe Bar', 'Gaming']);
    const sections = page.locator('.gear-accordion-section');
    await expect(sections).toHaveCount(IDS.length);
    for (let i = 0; i < IDS.length; i++) await expect(sections.nth(i)).toHaveId(IDS[i]);
    await expect(page.locator('.gear-accordion-section.is-expanded')).toHaveCount(1);
    await expect(page.locator('#gear-bodies')).toHaveClass(/is-expanded/);
    await expect(page.locator('#gear-bodies .deck-card.active .card-title')).toHaveText('Sony a7IV');
    await expect(count(page)).toHaveText('54 products');

    // The active thumbnail: a thin red outline; the rest dimmed.
    const active = page.locator('#gear-bodies .deck-thumb-tile.is-active');
    await expect(active).toHaveCSS('border-top-color', 'rgb(230, 0, 0)');
    const dim = await page.locator('#gear-bodies .deck-thumb-tile:not(.is-active)').first().evaluate((el) => parseFloat(getComputedStyle(el).opacity));
    expect(dim).toBeLessThan(0.7);

    // Next and previous rotate the deck.
    await page.locator('#gear-bodies [data-deck-next]').click();
    await expect(page.locator('#gear-bodies .deck-card.active .card-title')).not.toHaveText('Sony a7IV');
    await page.locator('#gear-bodies [data-deck-prev]').click();
    await expect(page.locator('#gear-bodies .deck-card.active .card-title')).toHaveText('Sony a7IV');
  });

  test('carousel front card has the locked HQ hover', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'hover needs a fine pointer');
    await page.goto('/hey-this-is-andrew/gear/');
    const card = page.locator('#gear-bodies .deck-card.active');
    const img = card.locator('.card-img');
    await expect(img).toHaveCSS('transition-duration', /0\.8s/);
    await card.hover();
    await expect(img).toHaveCSS('transform', 'matrix(1.03, 0, 0, 1.03, 0, 0)');
    await expect(page.locator('#gear-bodies .deck-glow-layer.active')).toHaveCSS('opacity', '1');
  });

  test('Show all: small tiles grouped by category, every section open', async ({ page }) => {
    await page.goto('/hey-this-is-andrew/gear/');
    await showAll(page);
    await expect(toggle(page)).toHaveText('Deck view');
    await expect(page.locator('#gear-decks-view')).toBeHidden();

    const sections = page.locator('.all-grid-section');
    await expect(sections).toHaveCount(CHIPS.length);
    for (const [i, chip] of CHIPS.entries()) {
      await expect(sections.nth(i)).toHaveAttribute('data-chip', chip);
      await expect(sections.nth(i).locator('.all-grid-card')).toHaveCount(COUNTS[chip]);
    }
    await expect(page.locator('.all-grid-section-title')).toHaveText(['Cameras', 'Lenses', 'Lighting', 'Tools and Support', 'Audio', 'Command Station Desk', 'Cafe Bar', 'Gaming']);
    for (const hidden of ['Amaran PT1c', 'Light Dome Mini II', 'Weebill 3']) {
      await expect(page.locator('.all-grid-card', { hasText: hidden })).toHaveCount(0);
    }

    // Small tiles, never full-bleed panels.
    const vw = page.viewportSize()!.width;
    const tile = await page.locator('.all-grid-card').first().boundingBox();
    expect(tile!.height).toBeLessThan(400);
    if (vw >= 1100) expect(tile!.width).toBeLessThan(vw * 0.5);

    // Short store labels, unchanged links.
    for (const l of await page.locator('.all-card-cta').allTextContents()) expect(l.trim()).toMatch(/^View on [A-Za-z. ]+$/);
    const viltrox = page.locator('.all-grid-card', { hasText: 'Viltrox AF 85mm f/2.0 EVO' });
    await expect(viltrox.locator('.all-card-cta', { hasText: 'View on Amazon' })).toHaveAttribute('href', 'https://link.amazon/B03iIx6Ml');
    await expect(viltrox.locator('.all-card-cta', { hasText: 'View on Viltrox' })).toHaveAttribute('href', 'https://viltrox.com/products/af-85mm-f2-0-fe?ref=thisisviltrox');

    const expectedLinks: [string, string][] = [
      ['Sony a7IV', 'https://link.amazon/B0ikMLJoW'],
      ['Sony a7CR', 'https://link.amazon/B05NYlnyx'],
      ['Shure MV6 Gen 1', 'https://link.amazon/B0cAAzs9L'],
      ['Shure MV6 USB Microphone (Gen 2, Black)', 'https://link.amazon/B0e10Bwnq'],
      ['Shure MV88', 'https://link.amazon/B0il7wQlr'],
      ['iVANKY 20-in-1 Docking Station', 'https://link.amazon/B0bw1t11T'],
      ['Dell Monitors', 'https://link.amazon/B0ag9JenR'],
      ['VIVO AeroPoise Dual Monitor Stand', 'https://link.amazon/B0h9dvZzN'],
      ['iPad Pro 13-inch (M4)', 'https://link.amazon/B03Qy9Mwe'],
      ['Apple Magic Keyboard for iPad Pro 13-inch (M4 and M5)', 'https://link.amazon/B03JskWrW'],
      ['Elgato 4K X Capture Card', 'https://link.amazon/B0aHqNl1N'],
      ['Elgato Cam Link 4K', 'https://link.amazon/B075xTDni'],
    ];
    for (const [name, href] of expectedLinks) {
      const card = page.locator('.all-grid-card').filter({
        has: page.locator('.all-card-name', { hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }),
      });
      await expect(card.locator('.all-card-cta', { hasText: 'View on Amazon' })).toHaveAttribute('href', href);
    }

    // Back to the carousel.
    await toggle(page).click();
    await expect(page.locator('#gear-decks-view')).toBeVisible();
    await expect(toggle(page)).toHaveText('Show all products');
  });

  test('search and category filter both views and hide empty sections', async ({ page }) => {
    await page.goto('/hey-this-is-andrew/gear/');
    const input = page.locator('#gear-search-input');
    const select = page.locator('#gear-category-select');
    await expect(select.locator('option')).toHaveCount(9);

    // Carousel: the matching section opens; the rest hide.
    await input.fill('90mm');
    await expect(page.locator('.gear-accordion-section:visible')).toHaveCount(1);
    await expect(page.locator('#gear-lenses')).toHaveClass(/is-expanded/);
    await expect(page.locator('#gear-lenses .deck-card.active .card-title')).toContainText('90mm');
    await expect(count(page)).toHaveText('1 product');

    // Show all follows the same filter.
    await showAll(page);
    await expect(page.locator('.all-grid-section:visible')).toHaveCount(1);
    await expect(page.locator('.all-grid-card:visible')).toHaveCount(1);

    await input.fill('zzzz');
    await expect(page.locator('#gear-empty-state')).toBeVisible();
    await expect(page.locator('.all-grid-section:visible')).toHaveCount(0);
    await page.locator('#gear-reset-btn').click();
    await expect(count(page)).toHaveText('54 products');
    await expect(page.locator('.all-grid-section:visible')).toHaveCount(CHIPS.length);

    await select.selectOption('cafe');
    await expect(page.locator('.all-grid-section:visible')).toHaveCount(1);
    await expect(page.locator('.all-grid-section[data-chip="cafe"] .all-grid-card:visible')).toHaveCount(13);
    await expect(count(page)).toHaveText('13 products');
  });

  test('toolbar is one tight row on desktop', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'desktop layout');
    await page.goto('/hey-this-is-andrew/gear/');
    const boxes = await page.locator('.gear-filter-toolbar > *').evaluateAll((els) =>
      els.map((e) => e.getBoundingClientRect()).map((r) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom, h: r.height })));
    for (let i = 1; i < boxes.length; i++) expect(boxes[i].left - boxes[i - 1].right).toBeLessThanOrEqual(24);
    const mids = boxes.map((b) => (b.top + b.bottom) / 2);
    expect(Math.max(...mids) - Math.min(...mids)).toBeLessThanOrEqual(2);
    // The search, category and toggle controls share one height.
    expect(new Set(boxes.slice(0, 3).map((b) => Math.round(b.h))).size).toBe(1);
  });

  test('Shop the lists: three collection tiles, unchanged destinations', async ({ page }) => {
    await page.goto('/hey-this-is-andrew/gear/');
    const tiles = page.locator('.gear-collection-tile');
    await expect(tiles).toHaveCount(3);
    await expect(tiles.nth(0)).toHaveAttribute('href', 'https://a.co/d/00WeFxoS');
    await expect(tiles.nth(1)).toHaveAttribute('href', 'https://a.co/d/0fSswpx1');
    await expect(tiles.nth(2)).toHaveAttribute('href', 'https://a.co/d/070Rc6h9');
    await expect(page.locator('[data-bottom-disclosure]')).toContainText('The Viltrox store link is an affiliate link');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test('section and item links open their section in the carousel', async ({ page }) => {
    await page.goto('/hey-this-is-andrew/gear/#brew');
    await expect(page.locator('#brew')).toHaveClass(/is-expanded/);
    await page.goto('/hey-this-is-andrew/gear/#gear-item-aputure-amaran-200d');
    await expect(page.locator('#gear-lighting')).toHaveClass(/is-expanded/);
    await expect(page.locator('#gear-lighting .deck-card.active')).toHaveAttribute('aria-label', 'Aputure Amaran 200d');
  });

  test('expanding a section below Cameras never forcefully scrolls the user down and keeps the section in view', async ({ page }) => {
    await page.goto('/hey-this-is-andrew/gear/');
    await expect(page.locator('#gear-bodies')).toHaveClass(/is-expanded/);

    // Case A: position Lenses cleanly in view (without Playwright's own pre-click scroll skewing scrollY),
    // then expand Lenses below Cameras and assert the browser never forcefully scrolls down.
    const lensesBar = page.locator('#gear-lenses .gear-accordion-header-bar');
    await lensesBar.scrollIntoViewIfNeeded();
    const scrollBeforeA = await page.evaluate(() => window.scrollY);
    await lensesBar.click();
    await expect(page.locator('#gear-lenses')).toHaveClass(/is-settled/);

    const caseA = await page.evaluate(() => {
      const nav = document.querySelector<HTMLElement>('.site-nav');
      const headerBar = document.querySelector<HTMLElement>('#gear-lenses .gear-accordion-header-bar');
      const activeCard = document.querySelector<HTMLElement>('#gear-lenses .deck-card.active');
      const navBottom = nav ? nav.getBoundingClientRect().bottom : 0;
      const barRect = headerBar?.getBoundingClientRect();
      const cardRect = activeCard?.getBoundingClientRect();
      return {
        scrollY: window.scrollY,
        barTop: barRect?.top ?? -1,
        barBottom: barRect?.bottom ?? -1,
        cardTop: cardRect?.top ?? -1,
        navBottom,
        vh: window.innerHeight,
      };
    });
    expect(caseA.scrollY).toBeLessThanOrEqual(scrollBeforeA + 2);
    expect(caseA.barTop).toBeGreaterThanOrEqual(caseA.navBottom - 2);
    expect(caseA.barBottom).toBeLessThan(caseA.vh);
    expect(caseA.cardTop).toBeLessThan(caseA.vh);

    // Case B: scrolled down with Lenses open above, clicking Audio must never scroll down or pull Audio above the header.
    await page.evaluate(() => {
      const audio = document.getElementById('gear-audio');
      const nav = document.querySelector<HTMLElement>('.site-nav');
      const navBottom = nav ? nav.getBoundingClientRect().bottom : 80;
      if (audio) {
        const y = window.scrollY + audio.getBoundingClientRect().top - (navBottom + 24);
        window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
      }
    });
    const scrollBeforeB = await page.evaluate(() => window.scrollY);
    expect(scrollBeforeB).toBeGreaterThan(0);
    await page.locator('#gear-audio .gear-accordion-header-bar').click();
    await expect(page.locator('#gear-audio')).toHaveClass(/is-settled/);

    const caseB = await page.evaluate(() => {
      const nav = document.querySelector<HTMLElement>('.site-nav');
      const headerBar = document.querySelector<HTMLElement>('#gear-audio .gear-accordion-header-bar');
      const navBottom = nav ? nav.getBoundingClientRect().bottom : 0;
      const barRect = headerBar?.getBoundingClientRect();
      return {
        scrollY: window.scrollY,
        barTop: barRect?.top ?? -1,
        barBottom: barRect?.bottom ?? -1,
        navBottom,
        vh: window.innerHeight,
      };
    });
    expect(caseB.scrollY).toBeLessThanOrEqual(scrollBeforeB + 2);
    expect(caseB.barTop).toBeGreaterThanOrEqual(caseB.navBottom - 2);
    expect(caseB.barBottom).toBeLessThan(caseB.vh);
  });
});
