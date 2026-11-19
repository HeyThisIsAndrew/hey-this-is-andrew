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

  // No stacked second banner on #gear, disclosure intact; Mint Mobile is not gear.
  await expect(page.locator('#gear [data-banner-rotator]')).toHaveCount(0);
  await expect(page.locator('#gear')).not.toContainText('Mint Mobile');
  await expect(page.locator('#gear .kit-disclosure')).toHaveText('As an Amazon Associate, I earn from qualifying purchases.');

  // The active slide links directly to that section on /gear/, and /gear/ opens on that section.
  await spotlight.locator('[data-spotlight-slide].is-current').click();
  await expect(page).toHaveURL(/\/gear\/#gear-audio$/);
  await expect(page.locator('#gear-audio')).toBeInViewport();
});

test('/gear/ section and item links land on their section', async ({ page }) => {
  for (const id of ['gear-lenses', 'brew', 'gear-audio']) {
    await page.goto(`./gear/#${id}`);
    await expect(page.locator(`#${id}`)).toBeInViewport();
  }
  await page.goto('./gear/#gear-item-aputure-amaran-200d');
  await expect(page.locator('#gear-item-aputure-amaran-200d')).toBeInViewport();
});

test('unified BannerRotator (kit + referrals) on /about/ and /gear/ plus View all referrals modal', async ({ page }) => {
  const expectedTitles = ['Full kit', 'DaVinci Resolve', 'Mint Mobile', 'inKind', 'Fetch', 'Instacart', 'Rakuten'];

  for (const route of ['./about/', './gear/']) {
    await page.goto(route);
    const rotator = page.getByRole('complementary', { name: 'Referrals and kit' });
    await expect(rotator.locator('[data-banner-rotator] [data-rotator-slide]', { hasText: 'Mint Mobile' }))
      .toHaveAttribute('href', 'https://my.mintmobile.com/refer/pHvGFQz');
    await expect(rotator.locator('[data-banner-rotator] [data-rotator-slide] .ui-rotator-title-full'))
      .toHaveText(expectedTitles);

    const dialog = rotator.locator('[data-referrals-dialog]');
    await expect(dialog).not.toHaveAttribute('open', '');

    await rotator.getByRole('button', { name: /View all referrals/i }).click();
    await expect(dialog).toHaveAttribute('open', '');
    await expect(dialog.locator('.referrals-dialog-disclosure')).toContainText('Amazon Associate');
    await expect(dialog.locator('.referrals-card-title')).toHaveText(expectedTitles);

    // Esc closes the modal
    await page.keyboard.press('Escape');
    await expect(dialog).not.toHaveAttribute('open', '');

    // Reopen and close with the bare X button
    await rotator.getByRole('button', { name: /View all referrals/i }).click();
    await expect(dialog).toHaveAttribute('open', '');
    await dialog.getByRole('button', { name: 'Close referrals' }).click();
    await expect(dialog).not.toHaveAttribute('open', '');

    // Reopen and light-dismiss by clicking outside the dialog box
    await rotator.getByRole('button', { name: /View all referrals/i }).click();
    await expect(dialog).toHaveAttribute('open', '');
    await page.mouse.click(5, 5);
    await expect(dialog).not.toHaveAttribute('open', '');
  }

  await page.goto('./');
  await expect(page.locator('#services').getByRole('link', { name: 'Cohley profile' }))
    .toHaveAttribute('href', 'https://connect.cohley.com/public/profile/andrew-baxter/');
});

test('mobile 390x844 edge-to-edge carousels, framed flip-card rotator, and scrollable modal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  // Homepage #gear spotlight matches HQ edge-to-edge mobile layout
  await page.goto('./');
  await page.locator('#gear').scrollIntoViewIfNeeded();
  const homeMetrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const frame = document.querySelector('#gear .ui-spotlight-frame')?.getBoundingClientRect();
    const cta = document.querySelector('#gear .ui-spotlight-slide.is-current .ui-spotlight-cta')?.getBoundingClientRect();
    const ctaLabel = document.querySelector('#gear .ui-spotlight-slide.is-current .ui-spotlight-cta-label');
    return {
      overflow: doc.scrollWidth > doc.clientWidth,
      left: frame ? Math.round(frame.left) : -1,
      right: frame ? Math.round(frame.right) : -1,
      height: frame ? Math.round(frame.height) : -1,
      ctaW: cta ? Math.round(cta.width) : 0,
      ctaH: cta ? Math.round(cta.height) : 0,
      ctaLabelDisplay: ctaLabel ? getComputedStyle(ctaLabel).display : '',
    };
  });
  expect(homeMetrics.overflow).toBe(false);
  expect(homeMetrics.left).toBe(0);
  expect(homeMetrics.right).toBe(390);
  expect(homeMetrics.height).toBeLessThan(260);
  expect(homeMetrics.ctaLabelDisplay).toBe('none');
  expect(homeMetrics.ctaW).toBeGreaterThanOrEqual(44);
  expect(homeMetrics.ctaH).toBeGreaterThanOrEqual(44);

  // /gear/ category panels span 0..390 edge-to-edge and BannerRotator has HQ framed geometry
  await page.goto('./gear/');
  const gearMetrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const box = (sel: string) => {
      const r = document.querySelector(sel)?.getBoundingClientRect();
      return r ? { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), height: Math.round(r.height) } : null;
    };
    return {
      overflow: doc.scrollWidth > doc.clientWidth,
      panels: box('#gear-panels'),
      panel: box('.gear-panel'),
      rotator: box('[data-banner-rotator] .ui-rotator-grid'),
    };
  });
  expect(gearMetrics.overflow).toBe(false);
  for (const key of ['panels', 'panel'] as const) {
    expect(gearMetrics[key]?.left).toBe(0);
    expect(gearMetrics[key]?.right).toBe(390);
  }
  expect(gearMetrics.rotator?.width).toBeGreaterThanOrEqual(370);
  expect(gearMetrics.rotator?.height).toBeLessThanOrEqual(120);

  // /about/ framed flip-card rotator + scrollable modal on mobile
  await page.goto('./about/');
  const aboutMetrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const r = document.querySelector('[data-banner-rotator] .ui-rotator-grid')?.getBoundingClientRect();
    return {
      overflow: doc.scrollWidth > doc.clientWidth,
      width: r ? Math.round(r.width) : 0,
      height: r ? Math.round(r.height) : 0,
    };
  });
  expect(aboutMetrics.overflow).toBe(false);
  expect(aboutMetrics.width).toBeGreaterThanOrEqual(370);
  expect(aboutMetrics.height).toBeLessThanOrEqual(120);

  await page.getByRole('button', { name: /View all referrals/i }).click();
  const modalMetrics = await page.evaluate(() => {
    const dialog = document.querySelector<HTMLDialogElement>('[data-referrals-dialog]');
    const body = dialog?.querySelector<HTMLElement>('.referrals-dialog-body');
    return {
      open: Boolean(dialog?.open),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      rectWidth: dialog ? Math.round(dialog.getBoundingClientRect().width) : 0,
      scrollHeight: body ? body.scrollHeight : 0,
      clientHeight: body ? body.clientHeight : 0,
    };
  });
  expect(modalMetrics.open).toBe(true);
  expect(modalMetrics.overflow).toBe(false);
  expect(modalMetrics.rectWidth).toBeLessThanOrEqual(390);
  expect(modalMetrics.scrollHeight).toBeGreaterThanOrEqual(modalMetrics.clientHeight);
});
