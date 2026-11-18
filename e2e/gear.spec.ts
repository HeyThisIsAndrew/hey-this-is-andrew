import { test, expect, type Locator, type Page } from '@playwright/test';

/*
 * /gear: one category deck at a time, with the HQ featured layout.
 * Data: sites/hey-this-is-andrew/src/data/gear.json.
 */

const activeTitle = (sec: Locator) => sec.locator('.deck-card.active .card-title');
const openDetails = async (section: Locator) => {
  await section.locator('.deck-card.active [data-gear-open]').click();
  const panel = section.locator('.card-details[data-open="true"]');
  await expect(panel).toBeVisible();
  return panel;
};
const categorySelect = (page: Page) => page.locator('#gear-category-select');

async function openSection(page: Page, id: string) {
  const section = page.locator(`#${id}`);
  const value = await section.getAttribute('data-chip');
  await categorySelect(page).selectOption(value!);
  await expect(section).toBeVisible();
  await expect(section).toHaveClass(/is-settled/);
  return section;
}

test.describe('Gear page', () => {
  test('kit, store links, labels and disclosures', async ({ page }) => {
    await page.goto('/hey-this-is-andrew/gear/');
    await expect(page).toHaveTitle(/Gear · HEY_THISISANDREW/);

    // Seven sections, in Andrew's list order; Cameras open on load.
    const ids = ['gear-bodies', 'gear-lenses', 'gear-lighting', 'gear-tools', 'gear-audio', 'brew', 'gear-gaming'];
    const sections = page.locator('.gear-accordion-section');
    await expect(sections).toHaveCount(ids.length);
    for (let i = 0; i < ids.length; i++) await expect(sections.nth(i)).toHaveId(ids[i]);
    await expect(page.locator('.gear-accordion-section.is-expanded')).toHaveCount(1);
    await expect(page.locator('#gear-bodies')).toHaveClass(/is-expanded/);

    // Exact kit counts (owned items with no store link are hidden).
    const counts: Record<string, number> = {
      'gear-bodies': 5, 'gear-lenses': 9, 'gear-lighting': 2, 'gear-tools': 9, 'gear-audio': 6, brew: 13, 'gear-gaming': 1,
    };
    for (const [id, n] of Object.entries(counts)) {
      await expect(page.locator(`#${id} .deck-card`)).toHaveCount(n);
    }
    for (const hidden of ['Amaran PT1c', 'Light Dome Mini II', 'Weebill 3']) {
      await expect(page.locator('.deck-card', { hasText: hidden })).toHaveCount(0);
    }

    // Catalog picks carry a Recommended badge; the 24 owned items do not.
    await expect(page.locator('.deck-card .reco-badge')).toHaveCount(21);
    await expect(page.locator('.deck-card:has(.reco-badge)')).toHaveCount(21);
    await expect(page.locator('.deck-card:not(:has(.reco-badge))')).toHaveCount(24);
    await expect(page.locator('.deck-card', { hasText: 'Sony a7IV' }).locator('.reco-badge')).toHaveCount(0);
    await expect(page.locator('.deck-card', { hasText: 'PlayStation Portal' }).locator('.reco-badge')).toHaveText('Recommended');

    // Short CTA labels everywhere, never the product name or a URL.
    const labels = await page.locator('[data-store-cta-label]').allTextContents();
    for (const l of labels) expect(l.trim()).toMatch(/^View on [A-Za-z. ]+$/);

    // Cameras: first item and its link.
    const bodies = page.locator('#gear-bodies');
    await expect(activeTitle(bodies)).toHaveText('Sony a7IV');
    await expect((await openDetails(bodies)).locator('[data-store-cta]')).toHaveAttribute('href', 'https://link.amazon/B0aDbXAM1');
    await expect(bodies.locator('.deck-card.active .card-img')).toHaveAttribute('src', /\/gear\/sony-a7iv\.jpg$/);

    // Viltrox: Amazon first, Viltrox direct in the picker, no wrong image.
    const lenses = await openSection(page, 'gear-lenses');
    await expect(bodies).toHaveClass(/is-collapsed/);
    await lenses.locator('.deck-thumb-tile[aria-label="Viltrox AF 85mm f/2.0 EVO"]').evaluate((el) => (el as HTMLElement).click());
    await expect(activeTitle(lenses)).toHaveText('Viltrox AF 85mm f/2.0 EVO');
    const viltroxDetails = await openDetails(lenses);
    const viltroxCta = viltroxDetails.locator('[data-store-cta]');
    await expect(viltroxCta).toHaveAttribute('href', 'https://link.amazon/B03iIx6Ml');
    await expect(viltroxCta).toContainText('View on Amazon');
    await viltroxDetails.locator('.store-option', { hasText: 'Viltrox' }).click();
    await expect(viltroxCta).toHaveAttribute('href', 'https://viltrox.com/products/af-85mm-f2-0-fe?ref=thisisviltrox');
    await expect(viltroxCta).toContainText('View on Viltrox');
    // The f/2.0 EVO photo (Andrew's, 2026-11), never the old f/1.8 II file.
    await expect(page.locator('img[src*="viltrox-85-evo"]')).toHaveCount(0);
    await expect(lenses.locator('.deck-card.active .card-img')).toHaveAttribute('src', /\/gear\/viltrox-85-f2-evo\.jpg$/);
    await expect(lenses.locator('.deck-thumb-tile[aria-label="Viltrox AF 85mm f/2.0 EVO"] img')).toHaveAttribute('src', /\/gear\/viltrox-85-f2-evo\.jpg$/);

    // A single-store item has no picker.
    await lenses.locator('.deck-thumb-tile').first().click();
    const lensDetails = await openDetails(lenses);
    await expect(lensDetails.locator('.store-picker')).toHaveCount(0);

    await expect(page.locator('[data-affiliate-disclosure]')).toContainText('As an Amazon Associate');
    await expect(lensDetails.locator('.card-disclosure')).toContainText('As an Amazon Associate');
    await page.locator('[data-gear-resources-toggle]').click();
    await expect(page.locator('[data-bottom-disclosure]')).toHaveAccessibleName('Affiliate Disclosure');
    await expect(page.locator('[data-bottom-disclosure]')).toContainText('The Viltrox store link is an affiliate link');
    await expect(page.locator('[data-bottom-disclosure]')).toBeVisible();
    await expect(page.locator('.gear-project-cta')).toHaveCount(0);

    // Collections.
    await expect(page.locator('.gear-collection-link')).toHaveCount(3);
    await expect(page.locator('#brew .influencer-pill')).toHaveAttribute('href', 'https://a.co/d/0fSswpx1');
    await expect(page.locator('#gear-lenses .influencer-pill')).toHaveAttribute('href', 'https://a.co/d/00WeFxoS');
  });

  test('search syncs the deck and spans the Cafe Bar', async ({ page }) => {
    await page.goto('/hey-this-is-andrew/gear/');
    const input = page.locator('#gear-search-input');

    await input.fill('90mm');
    const lenses = page.locator('#gear-lenses');
    await expect(lenses).toBeVisible();
    await expect(lenses).toHaveClass(/is-expanded/);
    await expect(page.locator('.gear-accordion-section:visible')).toHaveCount(1);
    await expect(lenses.locator('[data-deck-counter]')).toHaveCount(0);
    await expect(activeTitle(lenses)).toContainText('90mm');
    await expect(lenses.locator('.deck-card.next-1:not(.is-filtered-out)')).toHaveCount(0);

    await input.fill('Ascaso');
    const cafe = page.locator('#brew');
    await expect(cafe).toBeVisible();
    await expect(cafe).toHaveClass(/is-expanded/);
    await expect(page.locator('.gear-accordion-section:visible')).toHaveCount(1);
    await expect(cafe.locator('[data-deck-counter]')).toHaveCount(0);
    await expect(activeTitle(cafe)).toContainText('Ascaso');

    await page.locator('#gear-search-clear').click();
    await expect(page.locator('.gear-accordion-section:visible')).toHaveCount(1);
    await expect(categorySelect(page).locator('option')).toHaveCount(8);
    await expect(page.locator('#brew .deck-thumb-tile:not(.is-filtered-out)')).toHaveCount(13);
  });

  test('trackpad: a second swipe during the first one\'s momentum moves one more card', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/hey-this-is-andrew/gear/');
    const lenses = await openSection(page, 'gear-lenses');
    const stage = lenses.locator('.deck-stage');
    await stage.scrollIntoViewIfNeeded();
    const titles = await lenses.locator('.deck-card .card-title').allTextContents();
    const at = async () => titles.indexOf(((await activeTitle(lenses).textContent()) || '').trim());
    const start = await at();

    // A macOS two-finger swipe: the push accelerates, then momentum decays
    // with a little noise, one event per frame (16ms), the pointer never
    // leaving the deck. Dispatched in the page so the cadence is exact;
    // CDP-driven wheel events arrive 30-70ms apart, which no trackpad does.
    const swipe = (push: number[], tail: number[]) =>
      stage.evaluate(async (el, deltas) => {
        for (const d of deltas) {
          el.dispatchEvent(new WheelEvent('wheel', { deltaX: d, deltaY: 0, bubbles: true, cancelable: true }));
          await new Promise((r) => setTimeout(r, 16));
        }
      }, [...push, ...tail]);
    const push = [4, 10, 22, 38, 52, 60];
    const tail = [56, 50, 43, 37, 33, 28, 25, 22, 20, 17, 15, 13, 12, 10, 9, 8, 7];
    const noisyTail = [56, 50, 45, 39, 41, 33, 30, 32, 26, 24, 25, 20, 18, 19, 15, 13, 14, 11, 10, 9, 10, 8, 7, 6, 6, 5, 4, 4, 3, 3, 2, 2, 2, 1, 1, 1];

    // One swipe, one card, however long its momentum runs.
    await swipe(push, noisyTail);
    await expect.poll(at).toBe(start + 1);
    await page.waitForTimeout(300);
    expect(await at()).toBe(start + 1);

    // Swipe again while the first swipe's tail is still arriving. This is
    // the bug: the lock waited for silence, the tail never went quiet, and
    // the second swipe did nothing.
    await swipe(push, tail.slice(0, 8));
    await swipe(push, tail);
    await expect.poll(at).toBe(start + 3);
  });

  test('phone: every gear control is at least 44x44', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/hey-this-is-andrew/gear/');
    const lenses = await openSection(page, 'gear-lenses');
    const viltrox = page.locator('#gear-lenses .deck-thumb-tile[aria-label="Viltrox AF 85mm f/2.0 EVO"]');
    await viltrox.evaluate((el) => (el as HTMLElement).click());
    await openDetails(lenses);
    await page.locator('[data-gear-resources-toggle]').click();
    const sel = [
      '#gear-category-select', '.btn-all-toggle', '.influencer-pill',
      '.gear-accordion-section.is-expanded .deck-card.active .card-open',
      '.gear-accordion-section.is-expanded .deck-step',
      '.gear-accordion-section.is-expanded .deck-thumb-tile',
      '.gear-accordion-section.is-expanded .card-details .store-cta',
      '.gear-accordion-section.is-expanded .card-details .store-option',
      '.gear-collection-link', '.gear-resources-toggle',
    ].join(', ');
    // The card that just came forward scales up for 0.5s: measure once settled.
    await expect
      .poll(() =>
        page.locator(sel).evaluateAll((els) =>
          els
            .map((el) => ({ el, r: el.getBoundingClientRect() }))
            .filter(({ r }) => r.width > 0 && r.height > 0 && (r.width < 43.5 || r.height < 43.5))
            .map(({ el, r }) => `${el.className} ${Math.round(r.width)}x${Math.round(r.height)}`)
        )
      )
      .toEqual([]);
  });

  const viewports = [
    { name: 'desktop-1920', width: 1920, height: 1080 },
    { name: 'desktop-1440', width: 1440, height: 900 },
    { name: 'mobile-390-portrait', width: 390, height: 844 },
    { name: 'mobile-844-landscape', width: 844, height: 390 },
  ];

  for (const vp of viewports) {
    test(`dropdown switches category, deck rotates, artwork fills the card at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/hey-this-is-andrew/gear/');
      const sections = page.locator('.gear-accordion-section');
      for (const section of await sections.all()) {
        await openSection(page, (await section.getAttribute('id'))!);
        await expect(page.locator('.gear-accordion-section:visible')).toHaveCount(1);
      }

      // Deck rotation: next, prev, thumbnail, peeking card.
      const lenses = await openSection(page, 'gear-lenses');
      await expect(activeTitle(lenses)).toHaveText('Sony FE 24-70mm f/2.8 GM');
      await lenses.locator('[data-deck-next]').evaluate((el) => (el as HTMLElement).click());
      await expect(activeTitle(lenses)).toHaveText('Sony FE 16-35mm f/2.8 GM II');
      await lenses.locator('[data-deck-prev]').evaluate((el) => (el as HTMLElement).click());
      await expect(activeTitle(lenses)).toHaveText('Sony FE 24-70mm f/2.8 GM');
      await lenses.locator('.deck-thumb-tile').nth(4).evaluate((el) => (el as HTMLElement).click());
      await expect(activeTitle(lenses)).toHaveText('Sony FE 90mm f/2.8 Macro G OSS');
      const stage = lenses.locator('.deck-stage');
      await stage.scrollIntoViewIfNeeded();
      await expect(async () => {
        const card = await lenses.locator('.deck-card.active').boundingBox();
        const peek = await lenses.locator('.deck-card.next-1').boundingBox();
        expect(card).toBeTruthy();
        expect(peek).toBeTruthy();
        const edge = card!.x + card!.width;
        expect(peek!.x + peek!.width - edge).toBeGreaterThan(12);
        await page.mouse.click(edge + 10, peek!.y + peek!.height / 2);
        await expect(activeTitle(lenses)).toHaveText('Sony FE 55mm f/1.8 ZA Sonnar', { timeout: 900 });
      }).toPass();

      const img = lenses.locator('.deck-card.active .card-img');
      await expect(img).toHaveCSS('object-fit', 'cover');
      const geometry = await img.evaluate((element) => {
        const photo = element.getBoundingClientRect();
        const card = element.parentElement!.getBoundingClientRect();
        return {
          widthDelta: photo.width - card.width,
          heightDelta: photo.height - card.height,
        };
      });
      expect(geometry.widthDelta).toBeCloseTo(0);
      expect(geometry.heightDelta).toBeCloseTo(0);
      await expect(lenses.locator('.deck-thumb-tile.is-active')).toHaveCSS('border-top-color', 'rgb(230, 0, 0)');

      // No horizontal page scroll.
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
