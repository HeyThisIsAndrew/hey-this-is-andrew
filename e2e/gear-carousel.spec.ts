import { test, expect, type Page } from '@playwright/test';

// The homepage Gear carousel (GearCarousel.astro): the seven /gear/ sections,
// and the /gear/ deep links it relies on (GearGrid.astro). Manual control
// has to win: a pick stays put past the 7s auto-advance, and the card in
// view opens that section on /gear/.

const state = (page: Page) =>
  page.evaluate(() => {
    const track = document.querySelector<HTMLElement>('[data-gc-track]')!;
    const tabs = [...document.querySelectorAll('[data-gc-tab]')];
    return {
      tab: tabs.findIndex((t) => t.classList.contains('is-active')),
      pos: Math.round((track.scrollLeft / track.clientWidth) * 100) / 100,
    };
  });

test('gear carousel: the seven sections, tabs and arrows move it, a pick holds, the card opens the section', async ({ page }) => {
  await page.goto('./');
  const carousel = page.locator('#gear [data-gear-carousel]');
  await carousel.scrollIntoViewIfNeeded();
  await expect(carousel.locator('[data-gc-tab]')).toHaveText(['Cameras', 'Lenses', 'Lighting', 'Support', 'Audio', 'Cafe', 'Gaming']);
  await expect(carousel.locator('.gc-title')).toHaveText(['Cameras', 'Lenses', 'Lighting', 'Tools and Support', 'Audio', 'Cafe Bar', 'Gaming']);

  await carousel.locator('[data-gc-next]').click();
  await expect.poll(() => state(page)).toEqual({ tab: 1, pos: 1 });
  await carousel.locator('[data-gc-prev]').click();
  await expect.poll(() => state(page)).toEqual({ tab: 0, pos: 0 });
  await carousel.locator('[data-gc-tab="4"]').click();
  await expect.poll(() => state(page)).toEqual({ tab: 4, pos: 4 });
  await expect(carousel.locator('[data-gc-tab="4"]')).toHaveAttribute('aria-current', 'true');

  // Past the auto-advance interval, with the pointer off the card: it stays.
  await page.mouse.move(2, 2);
  await page.waitForTimeout(8000);
  expect(await state(page)).toEqual({ tab: 4, pos: 4 });

  // Gear picks only, static, with the disclosure; Mint Mobile is not gear.
  await expect(page.locator('#gear .storefront-pick')).toHaveCount(2);
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
  await expect(referrals.getByRole('link', { name: /Check out Mint Mobile/ })).toHaveAttribute('href', 'https://my.mintmobile.com/refer/pHvGFQz');
  await expect(referrals.locator('.storefront-pick h3')).toHaveText(['Mint Mobile', 'inKind', 'Fetch', 'Instacart', 'Rakuten']);
  await page.goto('./');
  await expect(page.locator('#services').getByRole('link', { name: /View my Cohley profile/ }))
    .toHaveAttribute('href', 'https://connect.cohley.com/public/profile/andrew-baxter/');
  await page.goto('./gear/');
  await expect(page.locator('main')).not.toContainText('Mint Mobile');
});
