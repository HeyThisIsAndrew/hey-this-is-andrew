import { test, expect } from '@playwright/test';

test.describe('Gear page verification', () => {
  test('Gear page displays verified items, real images, and affiliate links', async ({ page }) => {
    // Navigate to gear page
    await page.goto('/hey-this-is-andrew/gear/');
    await expect(page).toHaveTitle(/Gear · HEY_THISISANDREW/);

    // 1. Verify Hero Box (Camera Bodies)
    const heroBox = page.locator('#gear-bodies');
    await expect(heroBox).toBeVisible();

    // Verify 5 active camera items
    const cameraRows = heroBox.locator('.camera-item-row');
    await expect(cameraRows).toHaveCount(5);

    // Check first camera (Sony a7IV) is selected by default
    const previewImg = page.locator('#preview-camera-img');
    await expect(previewImg).toBeVisible();
    await expect(previewImg).toHaveAttribute('src', /\/hey-this-is-andrew\/gear\/sony-a7iv\.jpg$/);

    // Verify preview image actually loaded (naturalWidth > 0)
    const imgLoaded = await previewImg.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
    expect(imgLoaded).toBe(true);

    // Check preview button has correct affiliate URL
    const previewBtn = page.locator('#preview-camera-btn');
    await expect(previewBtn).toHaveAttribute('href', 'https://link.amazon/B0aDbXAM1');
    await expect(previewBtn).toContainText('View Sony a7IV on Amazon');

    // Click second camera (Sony a7CR)
    await cameraRows.nth(1).click();
    await expect(previewImg).toHaveAttribute('src', /\/hey-this-is-andrew\/gear\/sony-a7cr\.jpg$/);
    await expect(previewBtn).toHaveAttribute('href', 'https://link.amazon/B02X4KrnH');
    await expect(previewBtn).toContainText('View Sony a7CR on Amazon');

    // Click iPhone 17 Pro Max
    await cameraRows.nth(2).click();
    await expect(previewImg).toHaveAttribute('src', /\/hey-this-is-andrew\/gear\/iphone-17-pro-max\.jpg$/);
    await expect(previewBtn).toHaveAttribute('href', 'https://link.amazon/B0hZ10de1');

    // 2. Verify Collage Boxes (Lenses, Lighting, Support)
    const lensesBox = page.locator('#gear-lenses');
    await expect(lensesBox).toBeVisible();
    const lensRows = lensesBox.locator('.collage-item-row');
    await expect(lensRows).toHaveCount(8);

    const lensImg = page.locator('#img-gear-lenses');
    await expect(lensImg).toBeVisible();
    await expect(lensImg).toHaveAttribute('src', /\/hey-this-is-andrew\/gear\/sony-24-70-gm\.jpg$/);

    // Click Viltrox 85mm
    await lensRows.nth(7).click();
    await expect(lensImg).toHaveAttribute('src', /\/hey-this-is-andrew\/gear\/viltrox-85-evo\.jpg$/);
    const lensCta = page.locator('#cta-gear-lenses');
    await expect(lensCta).toHaveAttribute('href', 'https://link.amazon/B03iIx6Ml');

    // Verify Lighting Box
    const lightingBox = page.locator('#gear-lighting');
    await expect(lightingBox).toBeVisible();
    const lightingRows = lightingBox.locator('.collage-item-row');
    await expect(lightingRows).toHaveCount(2);

    const lightingImg = page.locator('#img-gear-lighting');
    await expect(lightingImg).toBeVisible();
    await expect(lightingImg).toHaveAttribute('src', /\/hey-this-is-andrew\/gear\/amaran-200d\.jpg$/);

    // Verify Tools & Support Box
    const toolsBox = page.locator('#gear-tools');
    await expect(toolsBox).toBeVisible();
    const toolRows = toolsBox.locator('.collage-item-row');
    await expect(toolRows).toHaveCount(3);

    const toolsImg = page.locator('#img-gear-tools');
    await expect(toolsImg).toBeVisible();
    await expect(toolsImg).toHaveAttribute('src', /\/hey-this-is-andrew\/gear\/peak-design-carbon-tripod\.jpg$/);

    // 3. Verify Audio is NOT rendered (Andrew does not own any of those items)
    const audioBox = page.locator('#gear-audio');
    await expect(audioBox).toHaveCount(0);
    const audioChip = page.locator('.gear-chip[data-cat="audio"]');
    await expect(audioChip).toHaveCount(0);

    // 4. Verify Cafe Section items
    const cafeSection = page.locator('#brew');
    await expect(cafeSection).toBeVisible();

    // Verify active cafe links
    const ascasoLink = cafeSection.locator('a[aria-label="View Ascaso Steel Duo PID on Amazon"]');
    await expect(ascasoLink).toHaveAttribute('href', 'https://link.amazon/B0cCrykft');

    const staggLink = cafeSection.locator('a[aria-label="View Fellow Stagg EKG on Amazon"]');
    await expect(staggLink).toHaveAttribute('href', 'https://link.amazon/B0fbGKgld');

    const carafeLink = cafeSection.locator('a[aria-label="View Fellow Mighty Small Carafe on Amazon"]');
    await expect(carafeLink).toHaveAttribute('href', 'https://link.amazon/B01DJcTby');

    const scaleLink = cafeSection.locator('a[aria-label="View Fellow Scale on Amazon"]');
    await expect(scaleLink).toHaveAttribute('href', 'https://link.amazon/B06NamWQ9');

    const nitroLink = cafeSection.locator('a[aria-label="View Nitro Press on Amazon"]');
    await expect(nitroLink).toHaveAttribute('href', 'https://link.amazon/B04f3JDzo');

    // Verify removed cafe items are NOT present
    const harioLink = cafeSection.locator('text=Hario Switch');
    await expect(harioLink).toHaveCount(0);
    const odeLink = cafeSection.locator('text=Fellow Ode');
    await expect(odeLink).toHaveCount(0);

    // 5. Test Category Chips Filtering
    const lensesChip = page.locator('.gear-chip[data-cat="lenses"]');
    await lensesChip.click();
    await expect(heroBox).toBeHidden();
    await expect(lensesBox).toBeVisible();
    await expect(lightingBox).toBeHidden();
    await expect(toolsBox).toBeHidden();

    const allChip = page.locator('.gear-chip[data-cat="all"]');
    await allChip.click();
    await expect(heroBox).toBeVisible();
    await expect(lensesBox).toBeVisible();
    await expect(lightingBox).toBeVisible();
    await expect(toolsBox).toBeVisible();

    // 6. Test Instant Search Filter
    const searchInput = page.locator('#gear-search-input');
    await searchInput.fill('Amaran');
    await expect(heroBox).toBeHidden();
    await expect(lensesBox).toBeHidden();
    await expect(lightingBox).toBeVisible();
    await expect(toolsBox).toBeHidden();

    // Clear search
    const clearBtn = page.locator('#gear-search-clear');
    await clearBtn.click();
    await expect(heroBox).toBeVisible();
    await expect(lensesBox).toBeVisible();
  });
});
