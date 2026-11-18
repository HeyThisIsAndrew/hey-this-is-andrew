import { test, expect, type Page } from '@playwright/test';

// The homepage Gear carousel (GearCarousel.astro): the seven /gear/ sections,
// and the /gear/ deep links it relies on (GearGrid.astro). Manual control
// has to win: a pick stays put past the 7s auto-advance, and the card in
// view opens that section on /gear/.

const state = (page: Page) =>
  page.evaluate(() => {
    const track = document.querySelector<HTMLElement>('[data-gc-track]')!;
    const slides = [...track.querySelectorAll<HTMLElement>('.gc-slide')];
    const active = slides.findIndex((slide) => slide.querySelector<HTMLAnchorElement>('.gc-card')?.tabIndex === 0);
    const activeOffset = slides[active]?.offsetLeft ?? Infinity;
    return {
      active,
      snapped: Math.abs(track.scrollLeft - activeOffset) <= 1,
    };
  });

test('gear carousel: the seven sections, overlaid arrows and keys, a pick holds, the card opens the section', async ({ page }) => {
  await page.goto('./');
  const carousel = page.locator('#gear [data-gear-carousel]');
  await carousel.scrollIntoViewIfNeeded();
  await expect(carousel.locator('.gc-title')).toHaveText(['Cameras', 'Lenses', 'Lighting', 'Tools and Support', 'Audio', 'Cafe Bar', 'Gaming']);
  await expect(carousel.locator('.gc-card img')).toHaveCount(7);
  await expect(carousel.locator('.gc-media .gc-kicker')).toHaveCount(7);
  await expect(carousel.locator('.gc-controls')).toHaveCount(0);
  const track = carousel.locator('[data-gc-track]');
  const trackBox = (await track.boundingBox())!;
  const secondSlide = (await track.locator('.gc-slide').nth(1).boundingBox())!;
  expect(trackBox.x + trackBox.width - secondSlide.x).toBeGreaterThanOrEqual(40);
  for (const sel of ['[data-gc-prev]', '[data-gc-next]']) {
    const arrow = carousel.locator(sel);
    await expect(arrow).toHaveCSS('position', 'absolute');
    const box = (await arrow.boundingBox())!;
    expect(Math.abs(box.y + box.height / 2 - trackBox.y - trackBox.height / 2)).toBeLessThanOrEqual(1);
  }

  await carousel.locator('[data-gc-next]').click();
  await expect.poll(() => state(page)).toEqual({ active: 1, snapped: true });
  await carousel.locator('[data-gc-prev]').click();
  await expect.poll(() => state(page)).toEqual({ active: 0, snapped: true });
  for (let index = 1; index <= 4; index++) {
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => state(page)).toEqual({ active: index, snapped: true });
    await expect(carousel.locator('.gc-card').nth(index)).toBeFocused();
  }

  // The selection stays past the auto-advance interval with pointer and focus outside the carousel.
  await page.mouse.move(2, 2);
  await page.locator('#main-content').focus();
  await page.waitForTimeout(8000);
  expect(await state(page)).toEqual({ active: 4, snapped: true });

  // Gear picks only, static, with the disclosure; Mint Mobile is not gear.
  await expect(page.locator('#gear .storefront-flip-card')).toHaveCount(2);
  await expect(page.locator('#gear')).not.toContainText('Mint Mobile');
  await expect(page.locator('#gear .kit-disclosure')).toHaveText('As an Amazon Associate, I earn from qualifying purchases.');

  // The card in view is the link, and /gear/ opens on that section.
  await carousel.locator('.gc-card').nth(4).click();
  await expect(page).toHaveURL(/\/gear\/#gear-audio$/);
  await expect(page.locator('#gear-audio')).toHaveClass(/is-expanded/);
  await expect(page.locator('.gear-accordion-section.is-expanded')).toHaveCount(1);
});

test('/gear/ section and item links open their section', async ({ page }) => {
  for (const id of ['gear-lenses', 'brew', 'gear-audio']) {
    await page.goto(`./gear/#${id}`);
    await expect(page.locator(`#${id}`)).toHaveClass(/is-expanded/);
    await expect(page.locator('.gear-accordion-section.is-expanded')).toHaveCount(1);
  }
  await page.goto('./gear/#gear-item-aputure-amaran-200d');
  await expect(page.locator('#gear-lighting')).toHaveClass(/is-expanded/);
  await expect(page.locator('#gear-lighting .deck-card.active')).toHaveAttribute('aria-label', 'Aputure Amaran 200d');
});

test('referrals on /about/ (Mint Mobile never in a gear section), Cohley under What I do', async ({ page }) => {
  await page.goto('./about/');
  const referrals = page.getByRole('complementary', { name: 'Referrals' });
  await expect(referrals.locator('.storefront-pick', { hasText: 'Mint Mobile' }).getByRole('link', { name: 'Check out' }))
    .toHaveAttribute('href', 'https://my.mintmobile.com/refer/pHvGFQz');
  await expect(referrals.locator('.storefront-pick h3')).toHaveText(['Mint Mobile', 'inKind', 'Fetch', 'Instacart', 'Rakuten']);
  await page.goto('./');
  await expect(page.locator('#services').getByRole('link', { name: 'Cohley profile' }))
    .toHaveAttribute('href', 'https://connect.cohley.com/public/profile/andrew-baxter/');
  await page.goto('./gear/');
  await expect(page.locator('main')).not.toContainText('Mint Mobile');
});
