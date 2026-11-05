import { test, expect, type Locator, type Page } from '@playwright/test';

/*
 * /gear: the HQ /featured deck. Every header shows at once; one section is
 * open at a time; the open one is a deck (front card, two peeking, thumbs).
 * Data: sites/hey-this-is-andrew/src/data/gear.json.
 */

const activeTitle = (sec: Locator) => sec.locator('.deck-card.active .card-title');
const cta = (sec: Locator) => sec.locator('.deck-card.active [data-store-cta]');

async function openSection(page: Page, id: string) {
  const sec = page.locator(`#${id}`);
  if (!((await sec.getAttribute('class')) || '').includes('is-expanded')) {
    await sec.locator('.gear-accordion-header').click();
  }
  await expect(sec).toHaveClass(/is-expanded/);
  return sec;
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
    await expect(cta(bodies)).toHaveAttribute('href', 'https://link.amazon/B0aDbXAM1');
    await expect(bodies.locator('.deck-card.active .card-img')).toHaveAttribute('src', /\/gear\/sony-a7iv\.jpg$/);

    // Viltrox: Amazon first, Viltrox direct in the picker, no wrong image.
    const lenses = await openSection(page, 'gear-lenses');
    await expect(bodies).toHaveClass(/is-collapsed/);
    await lenses.locator('.deck-thumb-tile[aria-label="Viltrox AF 85mm f/2.0 EVO"]').click();
    await expect(activeTitle(lenses)).toHaveText('Viltrox AF 85mm f/2.0 EVO');
    await expect(cta(lenses)).toHaveAttribute('href', 'https://link.amazon/B03iIx6Ml');
    await expect(cta(lenses)).toContainText('View on Amazon');
    await lenses.locator('.deck-card.active .store-option', { hasText: 'Viltrox' }).click();
    await expect(cta(lenses)).toHaveAttribute('href', 'https://viltrox.com/products/af-85mm-f2-0-fe?ref=thisisviltrox');
    await expect(cta(lenses)).toContainText('View on Viltrox');
    // The f/2.0 EVO photo (Andrew's, 2026-11), never the old f/1.8 II file.
    await expect(page.locator('img[src*="viltrox-85-evo"]')).toHaveCount(0);
    await expect(lenses.locator('.deck-card.active .card-img')).toHaveAttribute('src', /\/gear\/viltrox-85-f2-evo\.jpg$/);
    await expect(lenses.locator('.deck-thumb-tile[aria-label="Viltrox AF 85mm f/2.0 EVO"] img')).toHaveAttribute('src', /\/gear\/viltrox-85-f2-evo\.jpg$/);

    // A single-store item has no picker.
    await lenses.locator('.deck-thumb-tile').first().click();
    await expect(lenses.locator('.deck-card.active .store-picker')).toHaveCount(0);

    // Disclosures: header line, per-hero line, AFFILIATE NOTICE, CTA kept.
    await expect(page.locator('[data-affiliate-disclosure]')).toContainText('As an Amazon Associate');
    await expect(lenses.locator('.deck-card.active .card-disclosure')).toContainText('As an Amazon Associate');
    await expect(page.locator('[data-bottom-disclosure]')).toContainText('AFFILIATE NOTICE');
    await expect(page.locator('.gear-project-cta a')).toContainText('Start a project');

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
    await expect(lenses.locator('[data-deck-counter]')).toHaveText('01 / 01');
    await expect(activeTitle(lenses)).toContainText('90mm');
    await expect(lenses.locator('.deck-card.next-1:not(.is-filtered-out)')).toHaveCount(0);

    await input.fill('Ascaso');
    const cafe = page.locator('#brew');
    await expect(cafe).toBeVisible();
    await expect(cafe).toHaveClass(/is-expanded/);
    await expect(page.locator('.gear-accordion-section:visible')).toHaveCount(1);
    await expect(cafe.locator('[data-deck-counter]')).toHaveText('01 / 01');
    await expect(activeTitle(cafe)).toContainText('Ascaso');

    await page.locator('#gear-search-clear').click();
    await expect(page.locator('.gear-accordion-section:visible')).toHaveCount(7);
  });

  test('phone: every gear control is at least 44x44', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/hey-this-is-andrew/gear/');
    await openSection(page, 'gear-lenses');
    await page.locator('#gear-lenses .deck-thumb-tile[aria-label="Viltrox AF 85mm f/2.0 EVO"]').click();
    const sel = [
      '.gear-chip', '.btn-all-toggle', '.influencer-pill', '.gear-accordion-header',
      '.deck-step', '.deck-thumb-tile', '.gear-accordion-section.is-expanded .deck-card.active .store-cta',
      '.gear-accordion-section.is-expanded .deck-card.active .store-option', '.gear-collection-link',
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
    test(`headers toggle, deck rotates, hero unclipped at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/hey-this-is-andrew/gear/');
      const sections = page.locator('.gear-accordion-section');
      const n = await sections.count();

      // Every header opens alone and closes on a second click.
      for (let i = 0; i < n; i++) {
        const sec = sections.nth(i);
        const hdr = sec.locator('.gear-accordion-header');
        if (((await sec.getAttribute('class')) || '').includes('is-expanded')) {
          await hdr.click();
          await expect(sec).toHaveClass(/is-collapsed/);
        }
        await hdr.click();
        await expect(sec).toHaveClass(/is-expanded/);
        await expect(page.locator('.gear-accordion-section.is-expanded')).toHaveCount(1);
        await hdr.click();
        await expect(sec).toHaveClass(/is-collapsed/);
      }

      // Deck rotation: next, prev, thumbnail, peeking card.
      const lenses = await openSection(page, 'gear-lenses');
      await expect(activeTitle(lenses)).toHaveText('Sony FE 24-70mm f/2.8 GM');
      await lenses.locator('[data-deck-next]').click();
      await expect(activeTitle(lenses)).toHaveText('Sony FE 16-35mm f/2.8 GM II');
      await lenses.locator('[data-deck-prev]').click();
      await expect(activeTitle(lenses)).toHaveText('Sony FE 24-70mm f/2.8 GM');
      await lenses.locator('.deck-thumb-tile').nth(4).click();
      await expect(activeTitle(lenses)).toHaveText('Sony FE 90mm f/2.8 Macro G OSS');
      // A reader clicks the sliver of the next card peeking out on the right.
      // Measure the card's ON-SCREEN box (it is scaled, so a locator click
      // with `position` aims at its untransformed box and hits the front
      // card) and click there. The cards glide for 0.5s and the page may
      // still be settling, so the whole step re-measures and retries.
      const peek = lenses.locator('.deck-card.next-1');
      await expect(async () => {
        const now = (await activeTitle(lenses).textContent()) || '';
        if (now.includes('55mm')) return;
        // Never click past it: a click that lands on the wrong card fails.
        expect(now).toContain('90mm');
        await peek.scrollIntoViewIfNeeded();
        // Wait until the card's box holds still between two reads.
        let box = (await peek.boundingBox())!;
        for (let k = 0; k < 10; k++) {
          await page.waitForTimeout(120);
          const next = (await peek.boundingBox())!;
          const still = Math.abs(next.x - box.x) < 0.5 && Math.abs(next.y - box.y) < 0.5 && Math.abs(next.width - box.width) < 0.5;
          box = next;
          if (still) break;
        }
        await page.mouse.click(box.x + box.width - 18, box.y + box.height / 2);
        await expect(activeTitle(lenses)).toHaveText('Sony FE 55mm f/1.8 ZA Sonnar', { timeout: 1500 });
      }).toPass({ timeout: 10000 });

      // The hero image has its own row: below the nav, nothing over it.
      await lenses.locator('.deck-card.active .card-visual').scrollIntoViewIfNeeded();
      const geo = await lenses.evaluate((sec) => {
        const img = sec.querySelector('.deck-card.active .card-img')!.getBoundingClientRect();
        const vis = sec.querySelector('.deck-card.active .card-visual')!.getBoundingClientRect();
        const nav = document.querySelector('.site-nav')!.getBoundingClientRect().bottom;
        return { inRow: img.top >= vis.top - 0.5 && img.bottom <= vis.bottom + 0.5, belowNav: img.top >= nav - 0.5 };
      });
      expect(geo.inRow).toBe(true);
      expect(geo.belowNav).toBe(true);

      // No horizontal page scroll.
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
