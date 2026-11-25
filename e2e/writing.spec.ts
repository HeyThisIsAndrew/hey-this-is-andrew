import { test, expect } from '@playwright/test';

test.describe('Writing index & Coffee Talk Substack reader', () => {
  test('/writing/ renders Coffee Talk pill, uniform article card grid, Goals pill, and bottom Substack actions', async ({
    page,
    viewport,
  }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await page.goto('./writing/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.writing-page-head')).toHaveCount(0);
    await expect(page.locator('#articles')).toHaveCount(0);
    await expect(page.locator('main hr')).toHaveCount(0);
    await expect(page.locator('#writing')).toHaveCSS('border-top-width', '0px');
    await expect(page.locator('#goals')).toHaveCSS('border-top-width', '0px');

    await expect(page.locator('.writing-pill')).toHaveText('Coffee Talk');
    await expect(page.locator('.goals-pill')).toHaveText('Goals');

    const cards = page.locator('#writing .writing-card-link');
    await expect(cards).toHaveCount(5);

    const xs = await cards.evaluateAll((els) =>
      Array.from(new Set(els.map((el) => Math.round(el.getBoundingClientRect().left)))),
    );
    if ((viewport?.width ?? 1440) >= 768) {
      expect(xs.length).toBe(2);
    } else {
      expect(xs.length).toBe(1);
    }

    const cardCount = await cards.count();
    for (let i = 0; i < cardCount; i++) {
      const card = cards.nth(i);
      const img = card.locator('.writing-card-media img');
      await img.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          img.evaluate((el) => {
            const image = el as HTMLImageElement;
            return image.complete && image.naturalWidth > 0;
          }),
        )
        .toBe(true);
      await expect(card.locator('.writing-card-title')).not.toHaveText('');
      await expect(card.locator('.writing-card-date')).not.toHaveText('');
      await expect(card.locator('.writing-card-excerpt')).not.toHaveText('');
    }

    const actions = page.locator('.writing-page-actions a');
    await expect(actions).toHaveCount(2);
    await expect(actions.nth(0)).toHaveAttribute('href', 'https://thisiscoffeetalk.substack.com');
    await expect(actions.nth(1)).toHaveAttribute('href', 'https://thisiscoffeetalk.substack.com/subscribe');
    await expect(page.locator('main a[href*="substack.com"]')).toHaveCount(2);

    const goalsBox = await page.locator('#goals').boundingBox();
    const actionsBox = await page.locator('.writing-page-actions').boundingBox();
    expect(goalsBox).not.toBeNull();
    expect(actionsBox).not.toBeNull();
    expect(actionsBox!.y).toBeGreaterThanOrEqual(goalsBox!.y + goalsBox!.height - 1);

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
