import { test, expect, type Page } from '@playwright/test';

// The homepage Gear spotlight (GearCarousel.astro using @andrew/ui SpotlightBar
// + StorefrontCTA.astro using @andrew/ui BannerRotator): the seven /gear/
// sections, and the /gear/ deep links it relies on (GearGrid.astro). Pause
// and manual navigation must hold past the 7s rotation interval, and clicking
// the active slide opens that section on /gear/.

const activeSlideIndex = (page: Page) =>
  page.evaluate(() => {
    const slides = [...document.querySelectorAll<HTMLElement>('#gear [data-gear-carousel] [data-spotlight-slide]')];
    return slides.findIndex((slide) => slide.classList.contains('is-current') && !slide.hasAttribute('aria-hidden'));
  });

test('gear carousel: the seven sections, controls and keys, pause holds past interval, the slide opens the section', async ({ page }) => {
  await page.goto('./');
  const spotlight = page.locator('#gear [data-gear-carousel] [data-spotlight]');
  await spotlight.scrollIntoViewIfNeeded();
  await expect(spotlight.locator('.ui-spotlight-title')).toHaveText(['Cameras', 'Lenses', 'Lighting', 'Tools and Support', 'Audio', 'Cafe Bar', 'Gaming']);
  await expect(spotlight.locator('[data-spotlight-slide] img')).toHaveCount(7);
  await expect(spotlight.locator('[data-spotlight-progress]')).toBeAttached();

  await spotlight.locator('[data-spotlight-next]').click();
  await expect.poll(() => activeSlideIndex(page)).toBe(1);
  await spotlight.locator('[data-spotlight-prev]').click();
  await expect.poll(() => activeSlideIndex(page)).toBe(0);

  for (let index = 1; index <= 4; index++) {
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => activeSlideIndex(page)).toBe(index);
  }

  // Explicitly pause and verify the active slide holds past the 7s interval even with pointer and focus outside.
  await spotlight.locator('[data-spotlight-pause]').click();
  await expect(spotlight).toHaveClass(/is-paused/);
  await expect(spotlight.locator('[data-spotlight-pause]')).toHaveAttribute('data-paused', 'true');
  await page.mouse.move(2, 2);
  await page.locator('#main-content').focus();
  await page.waitForTimeout(8000);
  expect(await activeSlideIndex(page)).toBe(4);

  // Gear picks only, BannerRotator with 2 slides, disclosure intact; Mint Mobile is not gear.
  await expect(page.locator('#gear [data-banner-rotator] [data-rotator-slide]')).toHaveCount(2);
  await expect(page.locator('#gear')).not.toContainText('Mint Mobile');
  await expect(page.locator('#gear .kit-disclosure')).toHaveText('As an Amazon Associate, I earn from qualifying purchases.');

  // The active slide links directly to that section on /gear/, and /gear/ opens on that section.
  await spotlight.locator('[data-spotlight-slide].is-current').click();
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
