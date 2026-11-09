import { test, expect } from '@playwright/test';

const viewports = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'ipad-820', width: 820, height: 1180 },
  { name: 'mobile-390', width: 390, height: 844 },
];

for (const vp of viewports) {
  test.describe(`Events page layout at ${vp.name} (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(`has no horizontal overflow at ${vp.name}`, async ({ page }) => {
      await page.goto('./events/');

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });

    test(`cards fill the grid with no dead zone at ${vp.name}`, async ({ page }) => {
      await page.goto('./events/');

      const container = page.locator('.events-page');
      await expect(container).toBeVisible();

      const lists = page.locator('.events-list');
      const listCount = await lists.count();
      expect(listCount).toBe(3);

      for (let i = 0; i < listCount; i++) {
        const list = lists.nth(i);
        const listBox = await list.boundingBox();
        expect(listBox).not.toBeNull();

        const cards = list.locator('.event-card');
        const cardCount = await cards.count();
        expect(cardCount).toBeGreaterThan(0);

        if (vp.width >= 720 && cardCount >= 2) {
          // In a 2-column grid, card 0 (left) and card 1 (right) form the first row.
          // The combined span from card 0 left edge to card 1 right edge should fill the grid.
          const card0Box = await cards.nth(0).boundingBox();
          const card1Box = await cards.nth(1).boundingBox();
          expect(card0Box).not.toBeNull();
          expect(card1Box).not.toBeNull();

          if (card0Box && card1Box && listBox) {
            const cardRowSpan = (card1Box.x + card1Box.width) - card0Box.x;
            // The card span should match the grid list width within 2px (subpixel/border rounding).
            // A 163px dead zone would fail this check.
            const gapToGrid = Math.abs(listBox.width - cardRowSpan);
            expect(gapToGrid).toBeLessThanOrEqual(2);

            // Also check that the right margin from card 1 to grid container is minimal.
            const rightMargin = (listBox.x + listBox.width) - (card1Box.x + card1Box.width);
            expect(Math.abs(rightMargin)).toBeLessThanOrEqual(2);
          }
        } else {
          // On mobile single column, each card should fill the grid width.
          const card0Box = await cards.nth(0).boundingBox();
          expect(card0Box).not.toBeNull();
          if (card0Box && listBox) {
            const widthDiff = Math.abs(listBox.width - card0Box.width);
            expect(widthDiff).toBeLessThanOrEqual(2);
          }
        }
      }
    });

    test(`every card shows an image or visual container at ${vp.name}`, async ({ page }) => {
      await page.goto('./events/');

      const cards = page.locator('.event-card');
      const cardCount = await cards.count();
      expect(cardCount).toBe(21);

      for (let i = 0; i < cardCount; i++) {
        const card = cards.nth(i);
        const thumb = card.locator('.event-thumb');
        await expect(thumb).toBeVisible();

        const img = thumb.locator('img');
        const fallback = thumb.locator('.event-thumb-fallback');

        const hasImg = (await img.count()) > 0;
        const hasFallback = (await fallback.count()) > 0;

        // Must have either an img or a fallback monogram container
        expect(hasImg || hasFallback).toBe(true);

        if (hasImg) {
          await expect(img).toBeVisible();
          const imgBox = await img.boundingBox();
          expect(imgBox).not.toBeNull();
          expect(imgBox!.width).toBeGreaterThan(0);
          expect(imgBox!.height).toBeGreaterThan(0);
        } else {
          await expect(fallback).toBeVisible();
          const monogram = fallback.locator('.event-monogram');
          await expect(monogram).toBeVisible();
          const monogramText = await monogram.textContent();
          expect(monogramText?.trim().length).toBeGreaterThan(0);
        }
      }
    });

    test(`zero dashed empty boxes appear anywhere on the page at ${vp.name}`, async ({ page }) => {
      await page.goto('./events/');

      const dashedElementsCount = await page.evaluate(() => {
        const all = Array.from(document.querySelectorAll('*'));
        const dashed = all.filter((el) => {
          const style = window.getComputedStyle(el);
          const hasDashedBorder =
            style.borderStyle.includes('dashed') ||
            style.borderTopStyle === 'dashed' ||
            style.borderRightStyle === 'dashed' ||
            style.borderBottomStyle === 'dashed' ||
            style.borderLeftStyle === 'dashed';
          const hasDashedOutline = style.outlineStyle === 'dashed';
          return hasDashedBorder || hasDashedOutline;
        });
        return dashed.length;
      });

      expect(dashedElementsCount).toBe(0);
    });
  });
}

test.describe('Events page content and sections audit', () => {
  test('verifies exact section counts and content', async ({ page }) => {
    await page.goto('./events/');

    // Section 1: Upcoming (13 items)
    const upcomingSection = page.locator('section[aria-labelledby="upcoming-heading"]');
    await expect(upcomingSection).toBeVisible();
    const upcomingCards = upcomingSection.locator('.event-card');
    await expect(upcomingCards).toHaveCount(13);

    // Section 2: Capture Create Caffeinate (2 items)
    const cccSection = page.locator('section[aria-labelledby="ccc-heading"]');
    await expect(cccSection).toBeVisible();
    const cccCards = cccSection.locator('.event-card');
    await expect(cccCards).toHaveCount(2);

    // Section 3: Past coverage (6 items)
    const pastSection = page.locator('section[aria-labelledby="past-heading"]');
    await expect(pastSection).toBeVisible();
    const pastCards = pastSection.locator('.event-card');
    await expect(pastCards).toHaveCount(6);

    // Cohley Summit under Upcoming with Attending badge
    const cohleyCard = upcomingCards.filter({ hasText: 'Cohley Summit' });
    await expect(cohleyCard).toHaveCount(1);
    await expect(cohleyCard.locator('.event-badge')).toHaveText('Attending');
    await expect(cohleyCard.locator('.event-meta')).toContainText('Nov 12, 2026');
    await expect(cohleyCard.locator('.event-meta')).toContainText('Fairmont Miramar Hotel, Santa Monica, CA');
    await expect(cohleyCard.locator('a.event-link')).toHaveAttribute('href', 'https://www.cohley.com/');

    // CCC coverage entries
    const desertEscapeCard = cccCards.filter({ hasText: 'Desert Escape at Ace Hotel Palm Springs' });
    await expect(desertEscapeCard).toHaveCount(1);
    await expect(desertEscapeCard.locator('.event-badge')).toHaveText('Capture Create Caffeinate');

    const stoneGrooveCard = cccCards.filter({ hasText: 'Stone Groove Stillhouse Launch' });
    await expect(stoneGrooveCard).toHaveCount(1);
    await expect(stoneGrooveCard.locator('.event-badge')).toHaveText('Capture Create Caffeinate');
  });
});

test.describe('Events reachability audit', () => {
  test('About dropdown contains Events link', async ({ page }) => {
    await page.goto('./');
    const aboutDropdownEventsLink = page.locator('.desktop-nav .dropdown-menu[aria-label="About subsections"] a[href$="/events/"]');
    await expect(aboutDropdownEventsLink).toHaveCount(1);
    await expect(aboutDropdownEventsLink).toContainText('Events');
  });

  test('Footer Explore navigation contains Events link', async ({ page }) => {
    await page.goto('./');
    const footerEventsLink = page.locator('footer.site-footer a[href$="/events/"]');
    await expect(footerEventsLink).toHaveCount(1);
    await expect(footerEventsLink).toContainText('Events');
  });

  test('Sitemap page lists Events without Coming Soon', async ({ page }) => {
    await page.goto('./sitemap/');
    const sitemapEventsLink = page.locator('main a[href$="/events/"]');
    await expect(sitemapEventsLink).toBeVisible();
    const fullText = await sitemapEventsLink.textContent();
    expect(fullText).toContain('Events');
    expect(fullText).not.toContain('Coming Soon');

    // Entire page must not mention Coming Soon for Events
    const sitemapContent = await page.locator('main').innerText();
    expect(sitemapContent).not.toMatch(/Events.*Coming Soon/i);
  });
});

test.describe('Reduced motion emulation', () => {
  test.use({ reducedMotion: 'reduce' });

  test('all content is visible and transitions are immediate', async ({ page }) => {
    await page.goto('./events/');

    // Page title and sections visible
    await expect(page.locator('h1.events-title')).toBeVisible();
    await expect(page.locator('section[aria-labelledby="upcoming-heading"]')).toBeVisible();
    await expect(page.locator('section[aria-labelledby="ccc-heading"]')).toBeVisible();
    await expect(page.locator('section[aria-labelledby="past-heading"]')).toBeVisible();

    // All 21 cards are visible
    const cards = page.locator('.event-card');
    await expect(cards).toHaveCount(21);
    for (let i = 0; i < 21; i++) {
      await expect(cards.nth(i)).toBeVisible();
    }

    // Verify transition-duration is set to 0.01ms or 0s
    const transitionDuration = await page.evaluate(() => {
      const card = document.querySelector('.event-card');
      if (!card) return '';
      return window.getComputedStyle(card).transitionDuration;
    });

    // Expect transition duration to be near-zero (0.01ms = 1e-05s or 0s)
    const durationSeconds = parseFloat(transitionDuration);
    expect(durationSeconds).toBeLessThanOrEqual(0.001);
  });
});
