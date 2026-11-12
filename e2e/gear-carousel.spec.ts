import { test, expect, type Page } from '@playwright/test';

// The homepage Gear carousel (GearCarousel.astro) and the /gear/ deep links
// it relies on (GearGrid.astro). Manual control has to win: a pick stays put
// past the 7s auto-advance, and the card in view opens that item on /gear/.

const state = (page: Page) =>
  page.evaluate(() => {
    const track = document.querySelector<HTMLElement>('[data-gc-track]')!;
    const dots = [...document.querySelectorAll('[data-gc-dot]')];
    return {
      dot: dots.findIndex((d) => d.classList.contains('is-active')),
      pos: Math.round((track.scrollLeft / track.clientWidth) * 100) / 100,
    };
  });

test('gear carousel: real gear, arrows and dots move it, a pick holds, the card opens the item', async ({ page }) => {
  await page.goto('./');
  const carousel = page.locator('#gear [data-gear-carousel]');
  await carousel.scrollIntoViewIfNeeded();
  await expect(carousel.locator('.gc-slide')).toHaveCount(7);
  await expect(carousel.locator('.gc-category')).toHaveText(['Cameras', 'Lenses', 'Lighting', 'Tools and Support', 'Audio', 'Cafe Bar', 'Gaming']);

  await carousel.locator('[data-gc-next]').click();
  await expect.poll(() => state(page)).toEqual({ dot: 1, pos: 1 });
  await carousel.locator('[data-gc-prev]').click();
  await expect.poll(() => state(page)).toEqual({ dot: 0, pos: 0 });
  await carousel.locator('[data-gc-dot="2"]').click();
  await expect.poll(() => state(page)).toEqual({ dot: 2, pos: 2 });
  await expect(carousel.locator('[data-gc-dot="2"]')).toHaveAttribute('aria-current', 'true');

  // Past the auto-advance interval, with the pointer off the card: it stays.
  await page.mouse.move(2, 2);
  await page.waitForTimeout(8000);
  expect(await state(page)).toEqual({ dot: 2, pos: 2 });

  // The storefront picks are a static block now, with the disclosure.
  await expect(page.locator('#gear #storefront-rotator')).toHaveCount(0);
  await expect(page.locator('#gear .storefront-pick')).toHaveCount(3);
  await expect(page.locator('#gear .kit-disclosure')).toHaveText('As an Amazon Associate, I earn from qualifying purchases.');

  // The card in view is the link, and /gear/ opens on that item.
  await carousel.locator('.gc-card').nth(2).click();
  await expect(page).toHaveURL(/\/gear\/#gear-item-aputure-amaran-200d$/);
  await expect(page.locator('#gear-lighting')).toHaveClass(/is-expanded/);
  await expect(page.locator('#gear-lighting .deck-card.active')).toHaveAttribute('aria-label', 'Aputure Amaran 200d');
  await expect(page.locator('.gear-accordion-section.is-expanded')).toHaveCount(1);
});

test('/gear/ section links from the nav open their section', async ({ page }) => {
  for (const id of ['gear-lenses', 'brew', 'gear-audio']) {
    await page.goto(`./gear/#${id}`);
    await expect(page.locator(`#${id}`)).toHaveClass(/is-expanded/);
    await expect(page.locator('.gear-accordion-section.is-expanded')).toHaveCount(1);
  }
});

test('storefront rotator on /gear/ keeps the reader\'s pick', async ({ page }) => {
  await page.goto('./gear/');
  const rotator = page.locator('#storefront-rotator');
  await rotator.scrollIntoViewIfNeeded();
  await rotator.locator('.storefront-dot').nth(1).click();
  await page.mouse.move(2, 2);
  await page.waitForTimeout(8000);
  await expect(rotator.locator('.storefront-slide').nth(1)).toHaveClass(/is-active/);
});
