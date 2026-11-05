import { test, expect } from '@playwright/test';

test.describe('Gear page verification', () => {
  test('Gear page displays verified items, real images, and affiliate links', async ({ page }) => {
    // Navigate to gear page
    await page.goto('/hey-this-is-andrew/gear/');
    await expect(page).toHaveTitle(/Gear · HEY_THISISANDREW/);

    // 1. Verify Hero Box (Camera Bodies - 1st group, expanded by default)
    const heroBox = page.locator('#gear-bodies');
    await expect(heroBox).toBeVisible();
    await expect(heroBox).toHaveClass(/is-expanded/);

    // Verify 5 active camera items in thumbnail rail
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

    // 2. Verify Accordion Groups: Lenses, Lighting, Support
    // Expand Lenses group
    const lensesBox = page.locator('#gear-lenses');
    await expect(lensesBox).toBeVisible();
    await lensesBox.locator('.gear-accordion-header').click();
    await expect(lensesBox).toHaveClass(/is-expanded/);
    await expect(heroBox).toHaveClass(/is-collapsed/); // Only one group open at a time

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

    // Test "All View" Toggle on Lenses (sections with > 6 items)
    const allToggleBtn = lensesBox.locator('[data-all-toggle="lenses"]');
    await expect(allToggleBtn).toBeVisible();
    await allToggleBtn.click();
    const allGrid = lensesBox.locator('#all-grid-lenses');
    await expect(allGrid).toBeVisible();
    await expect(allGrid.locator('.all-grid-card')).toHaveCount(8);

    // Return to carousel view
    const backBtn = lensesBox.locator('[data-back-carousel="lenses"]').first();
    await backBtn.click();
    await expect(allGrid).toBeHidden();
    await expect(lensesBox.locator('[data-deck-container="lenses"]')).toBeVisible();

    // Expand Lighting Box
    const lightingBox = page.locator('#gear-lighting');
    await expect(lightingBox).toBeVisible();
    await lightingBox.locator('.gear-accordion-header').click();
    await expect(lightingBox).toHaveClass(/is-expanded/);
    await expect(lensesBox).toHaveClass(/is-collapsed/);

    const lightingRows = lightingBox.locator('.collage-item-row');
    await expect(lightingRows).toHaveCount(2);

    const lightingImg = page.locator('#img-gear-lighting');
    await expect(lightingImg).toBeVisible();
    await expect(lightingImg).toHaveAttribute('src', /\/hey-this-is-andrew\/gear\/amaran-200d\.jpg$/);

    // Expand Tools & Support Box
    const toolsBox = page.locator('#gear-tools');
    await expect(toolsBox).toBeVisible();
    await toolsBox.locator('.gear-accordion-header').click();
    await expect(toolsBox).toHaveClass(/is-expanded/);
    await expect(lightingBox).toHaveClass(/is-collapsed/);

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

    // Verify hero CTA initial item (Ascaso)
    const cafeHeroCta = cafeSection.locator('#cafe-hero-cta');
    await expect(cafeHeroCta).toHaveAttribute('href', 'https://link.amazon/B0cCrykft');

    // Verify active cafe links in the full grid catalog
    const cafeGrid = cafeSection.locator('#cafe-all-grid');
    const ascasoLink = cafeGrid.locator('a[aria-label="View Ascaso Steel Duo PID on Amazon"]');
    await expect(ascasoLink).toHaveAttribute('href', 'https://link.amazon/B0cCrykft');

    const staggLink = cafeGrid.locator('a[aria-label="View Fellow Stagg EKG on Amazon"]');
    await expect(staggLink).toHaveAttribute('href', 'https://link.amazon/B0fbGKgld');

    const carafeLink = cafeGrid.locator('a[aria-label="View Fellow Mighty Small Carafe on Amazon"]');
    await expect(carafeLink).toHaveAttribute('href', 'https://link.amazon/B01DJcTby');

    const scaleLink = cafeGrid.locator('a[aria-label="View Fellow Scale on Amazon"]');
    await expect(scaleLink).toHaveAttribute('href', 'https://link.amazon/B06NamWQ9');

    const nitroLink = cafeGrid.locator('a[aria-label="View Nitro Press on Amazon"]');
    await expect(nitroLink).toHaveAttribute('href', 'https://link.amazon/B04f3JDzo');

    const roasterLink = cafeGrid.locator('a[aria-label="Visit James Coffee Co. website"]');
    await expect(roasterLink).toHaveAttribute('href', 'https://jamescoffeeco.com');

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

  const auditViewports = [
    { name: 'desktop-1920', width: 1920, height: 1080 },
    { name: 'desktop-1440', width: 1440, height: 900 },
    { name: 'mobile-390-portrait', width: 390, height: 844 },
    { name: 'mobile-844-landscape', width: 844, height: 390 },
  ];

  for (const vp of auditViewports) {
    test(`Gear cinematic layout and accordion collapse verified at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/hey-this-is-andrew/gear/');

      // 1. Verify all 5 accordion section headers are present in order
      const sections = page.locator('.gear-accordion-section');
      await expect(sections).toHaveCount(5);
      const sectionIds = ['gear-bodies', 'gear-lenses', 'gear-lighting', 'gear-tools', 'brew'];
      for (let i = 0; i < sectionIds.length; i++) {
        await expect(sections.nth(i)).toHaveId(sectionIds[i]);
      }

      // 2. Default state: Exactly 1 open (Cameras / gear-bodies)
      const bodiesSec = page.locator('#gear-bodies');
      await expect(bodiesSec).toHaveClass(/is-expanded/);
      for (let i = 1; i < 5; i++) {
        await expect(sections.nth(i)).toHaveClass(/is-collapsed/);
      }

      // 3. Section Collapse Bug Fix: Clicking an open section collapses it (0 sections open)
      await bodiesSec.locator('.gear-accordion-header').click();
      await expect(bodiesSec).toHaveClass(/is-collapsed/);
      for (let i = 0; i < 5; i++) {
        await expect(sections.nth(i)).toHaveClass(/is-collapsed/);
      }

      // 4. Clicking a collapsed section opens it and collapses all others
      const lensesSec = page.locator('#gear-lenses');
      await lensesSec.locator('.gear-accordion-header').click();
      await expect(lensesSec).toHaveClass(/is-expanded/);
      await expect(bodiesSec).toHaveClass(/is-collapsed/);

      // 5. Verify Hero Deck in Lenses
      const lensHeroTitle = lensesSec.locator('#title-gear-lenses');
      await expect(lensHeroTitle).toContainText('Sony FE 24-70mm f/2.8 GM');

      // Test deck prev/next buttons inside deck stage
      const nextBtn = lensesSec.locator('[data-deck-next="lenses"]');
      await nextBtn.click();
      await expect(lensHeroTitle).toContainText('Sony FE 16-35mm f/2.8 GM II');

      const prevBtn = lensesSec.locator('[data-deck-prev="lenses"]');
      await prevBtn.click();
      await expect(lensHeroTitle).toContainText('Sony FE 24-70mm f/2.8 GM');

      // Test peeking slats on desktop viewports
      if (vp.width >= 1000) {
        const slatNext1 = lensesSec.locator('.deck-slat.next-1');
        await expect(slatNext1).toBeVisible();
        await slatNext1.click();
        await expect(lensHeroTitle).toContainText('Sony FE 16-35mm f/2.8 GM II');
      }

      // 6. Test All toggle in Lenses
      const allToggle = lensesSec.locator('[data-all-toggle="lenses"]');
      await expect(allToggle).toBeVisible();
      await allToggle.click();
      const allGrid = lensesSec.locator('#all-grid-lenses');
      await expect(allGrid).toBeVisible();
      await expect(allGrid.locator('.all-grid-card')).toHaveCount(8);

      const backBtn = lensesSec.locator('[data-back-carousel="lenses"]').first();
      await backBtn.click();
      await expect(allGrid).toBeHidden();

      // 7. Test Cafe Bar Section
      const cafeSec = page.locator('#brew');
      await cafeSec.locator('.gear-accordion-header').click();
      await expect(cafeSec).toHaveClass(/is-expanded/);
      await expect(lensesSec).toHaveClass(/is-collapsed/);

      const cafeHeroTitle = cafeSec.locator('#cafe-hero-name');
      await expect(cafeHeroTitle).toContainText('Ascaso Steel Duo PID');

      // 8. Verify No Horizontal Overflow
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(hasHorizontalOverflow).toBe(false);
    });
  }
});
