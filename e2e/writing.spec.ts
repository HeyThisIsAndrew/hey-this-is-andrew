import { test, expect } from '@playwright/test';

test.describe('Writing index & Coffee Talk Substack reader', () => {
  test('/writing/ renders MagazineSpread and swaps center feature cleanly', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await page.goto('./writing/');
    await page.waitForLoadState('networkidle');

    const spread = page.locator('[data-magazine-spread]');
    await expect(spread).toBeVisible();

    const railItems = page.locator('[data-magazine-rail-item]');
    const railCount = await railItems.count();
    expect(railCount).toBeGreaterThanOrEqual(5);

    const featureImg = page.locator('[data-magazine-feature-img]');
    await expect(featureImg).toBeVisible();
    await expect
      .poll(() =>
        featureImg.evaluate((el) => {
          const img = el as HTMLImageElement;
          return img.complete && img.naturalWidth > 0;
        }),
      )
      .toBe(true);

    const featureTitle = page.locator('[data-magazine-feature-title]');
    const featureLink = page.locator('[data-magazine-feature-link]');
    const initialTitle = (await featureTitle.innerText()).trim();
    const initialHref = await featureLink.getAttribute('href');

    const nextRailItem = page.locator('[data-magazine-rail-item]:not(.active)').first();
    const expectedTitle = (await nextRailItem.getAttribute('data-title'))?.trim();
    const expectedHref = await nextRailItem.getAttribute('data-href');

    await nextRailItem.click();
    await expect(page).toHaveURL(/\/writing\/(#.+)?$/);
    await expect(featureTitle).not.toHaveText(initialTitle);
    if (expectedTitle) {
      await expect(featureTitle).toHaveText(expectedTitle);
    }
    if (expectedHref && expectedHref !== initialHref) {
      await expect(featureLink).toHaveAttribute('href', expectedHref);
    }

    expect(pageErrors).toEqual([]);
  });

  test('/writing/<slug>/ renders ArticleReader, ToC, BlogPosting JSON-LD, and SubstackGallery lightbox', async ({
    page,
    viewport,
  }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    // Article with multi-heading ToC and SEO schema
    await page.goto('./writing/scaling-a-one-person-brand-with-open/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('article h1')).toBeVisible();

    const hasBlogPostingSchema = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      return scripts.some((s) => {
        try {
          const data = JSON.parse(s.textContent || '{}');
          return data['@type'] === 'BlogPosting';
        } catch {
          return false;
        }
      });
    });
    expect(hasBlogPostingSchema).toBe(true);

    if ((viewport?.width ?? 1440) >= 1000) {
      const toc = page.locator('[data-article-toc]');
      await expect(toc).toBeVisible();
      expect(await toc.locator('[data-article-toc-link]').count()).toBeGreaterThanOrEqual(2);
    }

    // Article with an embedded Substack gallery and local WebP renditions
    await page.goto('./writing/dev-diary-my-journey-as-a-technical/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('article h1')).toBeVisible();

    const articleImages = page.locator('article img[src*="/article-images/"]');
    const imgCount = await articleImages.count();
    expect(imgCount).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < imgCount; i++) {
      await articleImages.nth(i).scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          articleImages.nth(i).evaluate((el) => {
            const img = el as HTMLImageElement;
            return img.complete && img.naturalWidth > 0;
          }),
        )
        .toBe(true);
    }

    const galleryWrapper = page.locator('substack-gallery .substack-gallery-wrapper').first();
    await expect(galleryWrapper).toBeVisible();

    const triggers = galleryWrapper.locator('.substack-gallery-trigger');
    expect(await triggers.count()).toBeGreaterThanOrEqual(2);

    await triggers.first().click();

    const lightbox = page.locator('dialog#substack-lightbox[open]');
    await expect(lightbox).toBeVisible();

    const lightboxImg = lightbox.locator('.substack-lightbox-img');
    await expect(lightboxImg).toBeVisible();
    const firstLightboxSrc = await lightboxImg.getAttribute('src');

    const rightArrow = lightbox.locator('.right-arrow');
    if (await rightArrow.isEnabled()) {
      await rightArrow.click();
      await expect(lightboxImg).not.toHaveAttribute('src', firstLightboxSrc || '');
    }

    await page.keyboard.press('Escape');
    await expect(page.locator('#substack-lightbox')).toHaveCount(0);

    expect(pageErrors).toEqual([]);
  });
});
