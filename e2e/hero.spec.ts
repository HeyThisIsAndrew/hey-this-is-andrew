import { test, expect } from '@playwright/test';

/*
 * Homepage hero carousel: the portrait slide first (a logo-sized wordmark
 * with the line and the buttons), then the latest posts, each with its
 * brand's logo and the brands section's metadata chips, never a headline.
 */
test.describe('Hero carousel', () => {
  test('portrait slide: the wordmark is a logo, not the whole frame', async ({ page }) => {
    await page.goto('./');
    const lead = page.locator('.hs-carousel .ui-spotlight-slide--lead');
    await expect(lead).toHaveClass(/is-current/);
    const vw = page.viewportSize()!.width;
    const w = await lead.locator('.hs-wordmark img').evaluate((el) => el.getBoundingClientRect().width);
    expect(w).toBeLessThanOrEqual(Math.min(vw * 0.46, 360) + 1);
    // The line is said once, in the meta line beside the controls.
    await expect(lead.locator('.hs-line')).toHaveCount(0);
    await expect(page.locator('.hs-carousel [data-spotlight-meta]')).toHaveText('Creator, Photographer, Coffee Drinker. Building in Public.');
    await expect(lead.getByRole('link', { name: /Brands/ })).toBeVisible();
    await expect(lead.getByRole('link', { name: 'Work With Me' })).toBeVisible();
  });

  test('post slides: brand logo and metadata chips, no headline, linked to the post', async ({ page }) => {
    await page.goto('./');
    const posts = page.locator('.hs-carousel a.ui-spotlight-slide');
    test.skip((await posts.count()) === 0, 'no posts with images in this build');
    await expect(page.locator('.hs-carousel .ui-spotlight-title')).toHaveCount(0);
    for (const post of await posts.all()) {
      await expect(post).toHaveAttribute('href', /^https?:\/\//);
      await expect(post.locator('.ui-spotlight-logo')).toHaveAttribute('src', /\.png/);
      const chips = post.locator('.ui-spotlight-chip');
      await expect(chips).toHaveCount(2);
      await expect(chips.first()).toHaveClass(/ui-spotlight-chip--brand/);
      // No title line on the slide (the meta line shows it); still read out.
      await expect(post.locator('.ui-spotlight-title-sm')).toHaveCount(0);
      await expect(post.locator('.vh')).not.toBeEmpty();
    }

    // The first post: the chips line up with the header's logo, upper left.
    await page.locator('.hs-carousel [data-spotlight-next]').click();
    const current = page.locator('.hs-carousel a.ui-spotlight-slide.is-current');
    const [slide, meta, logo] = await Promise.all([
      current.evaluate((el) => el.getBoundingClientRect().toJSON()),
      current.locator('.ui-spotlight-meta-block').evaluate((el) => el.getBoundingClientRect().toJSON()),
      page.locator('.site-nav .wordmark').evaluate((el) => el.getBoundingClientRect().toJSON()),
    ]);
    expect(Math.abs(meta.left - logo.left)).toBeLessThanOrEqual(2);
    expect(meta.top - slide.top).toBeLessThan(80);
    await expect(page.locator('.hs-carousel [data-spotlight-meta]')).toContainText(' · ');
  });
});
