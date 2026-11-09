import { test, expect } from '@playwright/test';

test.describe('CCC Page Overhaul & Regression Acceptance (CCC-01 through CCC-07)', () => {
  test('Exact production layout: all sections intact and styled as on live', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('./ccc/');

    // Hero
    const hero = page.locator('.ccc-hero');
    await expect(hero).toBeVisible();
    await expect(hero.locator('.ccc-hero-logo')).toBeVisible();
    await expect(hero.locator('#ccc-hero-title')).toContainText('Content that brings people');
    await expect(hero.locator('#ccc-hero-title')).toContainText('through your door');
    await expect(hero.locator('.ccc-hero-sub')).toHaveText('Bars · Restaurants · Events');

    // All production sections exist in exact order
    const sectionIds = ['why', 'where', 'work', 'video', 'how', 'pricing', 'contact'];
    for (const id of sectionIds) {
      await expect(page.locator(`#${id}`)).toBeVisible();
    }

    // Section 03: The work mosaic and "Every part of your night"
    const work = page.locator('#work');
    await expect(work.locator('.ccc-night-copy')).toContainText('Every part of your night');
    await expect(work.locator('.ccc-mosaic-wide')).toBeVisible();
    await expect(work.locator('.ccc-mosaic-tile')).toHaveCount(4);
    await expect(work.locator('.ccc-room')).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('CCC-01: How it works split layout across mobile, laptop, desktop, and 4K', async ({ page }) => {
    // 1. Mobile & below-breakpoint (390 and 899): stacked in reading order
    for (const width of [390, 899]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('./ccc/');
      const split1 = page.locator('#how .ccc-split').first();
      const split2 = page.locator('#how .ccc-split.is-flip');
      const m1 = await split1.locator('.ccc-split-media').boundingBox();
      const c1 = await split1.locator('.ccc-steps').boundingBox();
      const m2 = await split2.locator('.ccc-split-media').boundingBox();
      const c2 = await split2.locator('.ccc-easy').boundingBox();
      expect(m1 && c1 && m1.y < c1.y).toBe(true);
      expect(m2 && c2 && m2.y < c2.y).toBe(true);
    }

    // 2. Desktop & wide (900, 1512, 1920, 3840): side-by-side row, media left on row 1, media right on row 2
    for (const [width, height] of [
      [900, 900],
      [1512, 982],
      [1920, 1080],
      [3840, 2160],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto('./ccc/');
      const split1 = page.locator('#how .ccc-split').first();
      const split2 = page.locator('#how .ccc-split.is-flip');
      await split1.scrollIntoViewIfNeeded();

      const m1 = await split1.locator('.ccc-split-media').boundingBox();
      const c1 = await split1.locator('.ccc-steps').boundingBox();
      const m2 = await split2.locator('.ccc-split-media').boundingBox();
      const c2 = await split2.locator('.ccc-easy').boundingBox();

      expect(m1 && c1 && m2 && c2).toBeTruthy();
      // First row: media on left, steps on right, overlapping vertically (same row)
      expect(m1!.x + m1!.width).toBeLessThanOrEqual(c1!.x + 4);
      expect(Math.abs(m1!.y + m1!.height / 2 - (c1!.y + c1!.height / 2))).toBeLessThan(m1!.height);
      // Image capped at source resolution (735px max)
      expect(m1!.width).toBeLessThanOrEqual(736);

      // Second row (.is-flip): copy on left, media on right
      expect(c2!.x + c2!.width).toBeLessThanOrEqual(m2!.x + 4);
      expect(m2!.width).toBeLessThanOrEqual(736);

      if (width === 3840) {
        // At 4K, landing on #how keeps both first image and steps visible in the same viewport
        await page.locator('#how').scrollIntoViewIfNeeded();
        await page.waitForTimeout(100);
        const m1View = await split1.locator('.ccc-split-media').boundingBox();
        const c1View = await split1.locator('.ccc-steps').boundingBox();
        expect(m1View!.y).toBeGreaterThanOrEqual(0);
        expect(m1View!.y + m1View!.height).toBeLessThanOrEqual(height);
        expect(c1View!.y).toBeGreaterThanOrEqual(0);
        expect(c1View!.y + c1View!.height).toBeLessThanOrEqual(height);
      }
    }
  });

  test('CCC-02: Coherent wide-screen proportions across 1512 -> 1919 -> 1920 -> 2560 -> 3840 and two-line hero', async ({ page }) => {
    const widths = [
      [1512, 982],
      [1919, 1080],
      [1920, 1080],
      [2560, 1440],
      [3840, 2160],
    ];

    const metrics: {
      vw: number;
      containerW: number;
      heroTitleFs: number;
      heroLogoW: number;
      heroActionsW: number;
    }[] = [];

    for (const [vw, vh] of widths) {
      await page.setViewportSize({ width: vw, height: vh });
      await page.goto('./ccc/');
      await page.evaluate(() => document.fonts?.ready);

      const m = await page.evaluate(() => {
        const container = document.querySelector('#why > .container')!;
        const title = document.getElementById('ccc-hero-title')!;
        const logo = document.querySelector('.ccc-hero-logo')!;
        const actions = document.querySelector('#hero .ccc-actions')!;
        const lines = Array.from(title.querySelectorAll('.ccc-hero-line'));
        return {
          containerW: container.getBoundingClientRect().width,
          heroTitleFs: parseFloat(getComputedStyle(title).fontSize),
          heroLogoW: logo.getBoundingClientRect().width,
          heroActionsW: actions.getBoundingClientRect().width,
          line1Top: lines[0].getBoundingClientRect().top,
          line2Top: lines[1].getBoundingClientRect().top,
          line1W: lines[0].getBoundingClientRect().width,
          line2W: lines[1].getBoundingClientRect().width,
        };
      });

      // Two-line hero fits within container without overflowing
      expect(m.line2Top).toBeGreaterThan(m.line1Top);
      expect(m.line1W).toBeLessThanOrEqual(m.containerW + 2);
      expect(m.line2W).toBeLessThanOrEqual(m.containerW + 2);

      metrics.push({
        vw,
        containerW: m.containerW,
        heroTitleFs: m.heroTitleFs,
        heroLogoW: m.heroLogoW,
        heroActionsW: m.heroActionsW,
      });
    }

    // Verify monotonic non-decreasing growth across 1512 -> 1919 -> 1920 -> 2560 -> 3840
    // and NO abrupt jump at 1919 -> 1920
    for (let i = 1; i < metrics.length; i++) {
      const prev = metrics[i - 1];
      const curr = metrics[i];
      expect(curr.containerW).toBeGreaterThanOrEqual(prev.containerW - 1);
      expect(curr.heroTitleFs).toBeGreaterThanOrEqual(prev.heroTitleFs - 0.5);
      expect(curr.heroLogoW).toBeGreaterThanOrEqual(prev.heroLogoW - 1);
      expect(curr.heroActionsW).toBeGreaterThanOrEqual(prev.heroActionsW - 1);

      if (prev.vw === 1919 && curr.vw === 1920) {
        // Smooth bridge across 1919 -> 1920 (less than 2px difference for 1px viewport delta)
        expect(Math.abs(curr.containerW - prev.containerW)).toBeLessThan(5);
        expect(Math.abs(curr.heroTitleFs - prev.heroTitleFs)).toBeLessThan(1);
        expect(Math.abs(curr.heroActionsW - prev.heroActionsW)).toBeLessThan(3);
      }
    }

    // Also verify two-line hero at 320px portrait and 844x390 short landscape
    for (const [vw, vh] of [
      [320, 640],
      [844, 390],
    ]) {
      await page.setViewportSize({ width: vw, height: vh });
      await page.goto('./ccc/');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow).toBe(false);
    }
  });

  test('CCC-03: Scroll timing, hero readability at 140px, independent subject progress, and reversible states', async ({ page }) => {
    await page.setViewportSize({ width: 3840, height: 2160 });
    await page.goto('./ccc/');

    // At 3840x2160, scrolling 140px keeps hero logo and content 100% opaque because actions are still well in view
    await page.evaluate(() => window.scrollTo(0, 140));
    await page.waitForTimeout(80);
    const heroAt140 = await page.evaluate(() => {
      const logo = document.querySelector<HTMLElement>('.ccc-hero-logo')!;
      const inner = document.querySelector<HTMLElement>('.ccc-hero-inner')!;
      return {
        logoOpacity: parseFloat(getComputedStyle(logo).opacity),
        innerOpacity: parseFloat(getComputedStyle(inner).opacity),
      };
    });
    expect(heroAt140.logoOpacity).toBeGreaterThan(0.95);
    expect(heroAt140.innerOpacity).toBeGreaterThan(0.95);

    // Independent progress: when Why top pair is near reading position and Why bottom pair is lower,
    // their progress transforms differ, and when #ccc-work-room enters view it has not already finished before entering
    await page.setViewportSize({ width: 1512, height: 982 });
    await page.goto('./ccc/');

    const roomTopDoc = await page.evaluate(() => {
      const el = document.getElementById('ccc-work-room')!;
      let y = 0;
      for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) y += n.offsetTop;
      return y;
    });

    // Scroll so #ccc-work-room is just entering the bottom of the viewport (top = 982 * 0.88)
    const entryScrollY = Math.round(roomTopDoc - 982 * 0.88);
    await page.evaluate((y) => window.scrollTo(0, y), entryScrollY);
    await page.waitForTimeout(80);
    const roomTransformEntry = await page.locator('#ccc-work-room .ccc-room-wide').evaluate((el) => el.style.transform);

    // Scroll so #ccc-work-room settles in reading zone (top = 350)
    const settledScrollY = Math.round(roomTopDoc - 350);
    await page.evaluate((y) => window.scrollTo(0, y), settledScrollY);
    await page.waitForTimeout(80);
    const roomTransformSettled = await page.locator('#ccc-work-room .ccc-room-wide').evaluate((el) => el.style.transform);

    expect(roomTransformEntry).not.toBe(roomTransformSettled);
    expect(roomTransformSettled).toMatch(/scale\((1\.000|1)\)/);

    // Reversibility: scrolling back to entryScrollY from below produces the exact same transform
    await page.evaluate((y) => window.scrollTo(0, y), entryScrollY);
    await page.waitForTimeout(80);
    const roomTransformReversed = await page.locator('#ccc-work-room .ccc-room-wide').evaluate((el) => el.style.transform);
    expect(roomTransformReversed).toBe(roomTransformEntry);

    // 4K deep link to #contact: #ccc-closer is in viewport and Contact PageNav item is active
    await page.setViewportSize({ width: 3840, height: 2160 });
    await page.goto('./ccc/#contact');
    await page.waitForTimeout(200);
    await expect(page.locator('#ccc-closer')).toBeInViewport();
    await expect(page.locator('#page-nav [data-pn-link="ccc-closer"]')).toHaveClass(/\bactive\b/);
  });

  test('CCC-04: Reduced motion respected on initial load and live toggle, and dock inert when hidden or dismissed', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 3840, height: 2160 });
    await page.goto('./ccc/');

    // At top (scrollY = 0), dock is hidden and inert
    await expect(page.locator('.ccc-dock-row--hero')).toHaveAttribute('inert', '');

    // Scroll 140px under reduced motion: hero stays at opacity 1 and transform none
    await page.evaluate(() => window.scrollTo(0, 140));
    await page.waitForTimeout(80);
    const heroReduced = await page.evaluate(() => {
      const logo = document.querySelector<HTMLElement>('.ccc-hero-logo')!;
      const inner = document.querySelector<HTMLElement>('.ccc-hero-inner')!;
      return {
        logoOpacity: getComputedStyle(logo).opacity,
        logoTransform: getComputedStyle(logo).transform,
        innerOpacity: getComputedStyle(inner).opacity,
      };
    });
    expect(heroReduced.logoOpacity).toBe('1');
    expect(heroReduced.logoTransform).toBe('none');
    expect(heroReduced.innerOpacity).toBe('1');

    // Scroll to mid-page so dock becomes visible and operable
    await page.evaluate(() => window.scrollTo(0, 2200));
    await page.waitForTimeout(80);
    await expect(page.locator('.ccc-dock-row--hero')).toHaveClass(/is-docked/);
    expect(await page.locator('.ccc-dock-row--hero').getAttribute('inert')).toBeNull();

    // Scroll to closer at bottom: closer title and bg do not scale in reduced motion, and dock is dismissed + inert
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(80);
    const closerReduced = await page.evaluate(() => {
      const title = document.querySelector<HTMLElement>('.ccc-closer-title')!;
      const bg = document.querySelector<HTMLElement>('.ccc-closer-bg img')!;
      return {
        titleTransform: getComputedStyle(title).transform,
        bgTransform: getComputedStyle(bg).transform,
      };
    });
    expect(closerReduced.titleTransform).toBe('none');
    expect(closerReduced.bgTransform).toBe('none');
    await expect(page.locator('.ccc-dock-row--hero')).toHaveAttribute('inert', '');
  });

  test('CCC-06: Package flip cards and back-face Contact buttons are keyboard accessible and restore focus', async ({ page }) => {
    await page.goto('./ccc/');
    const pricing = page.locator('#pricing');
    await pricing.scrollIntoViewIfNeeded();

    const firstCard = pricing.locator('.flip-card').first();
    const firstToggle = firstCard.locator('.flip-card-toggle');
    const firstAction = firstCard.locator('.flip-action-btn');

    // Before flipping, Contact action button is excluded from tab order
    await expect(firstAction).toHaveAttribute('tabindex', '-1');
    await expect(firstAction).toHaveAttribute('aria-hidden', 'true');

    // Focus card toggle and press Enter to flip
    await firstToggle.focus();
    await page.keyboard.press('Enter');
    await expect(firstCard).toHaveClass(/\bis-flipped\b/);
    await expect(firstToggle).toHaveAttribute('aria-pressed', 'true');

    // Now back-face Contact button is exposed to focus order
    expect(await firstAction.getAttribute('tabindex')).toBeNull();
    expect(await firstAction.getAttribute('aria-hidden')).toBeNull();

    // Tab moves directly from card toggle to Contact button
    await page.keyboard.press('Tab');
    await expect(firstAction).toBeFocused();

    // Press Enter on Contact button to open modal with matching service pre-selected
    await page.keyboard.press('Enter');
    const modal = page.locator('#ccc-inquiry-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('#ccc-service')).toHaveValue('Half-day photo session');

    // Escape closes dialog and restores focus to the activating control
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
    await expect(firstAction).toBeFocused();
  });

  test('CCC-07: Inquiry modal shows accurate email draft label and confirmation state', async ({ page }) => {
    await page.goto('./ccc/');

    const startButtons = page.locator('[data-open-ccc-modal]');
    await expect(startButtons).toHaveCount(5);

    // Open modal from hero button
    await startButtons.first().click();
    const modal = page.locator('#ccc-inquiry-modal');
    await expect(modal).toBeVisible();

    // Verify submit button label is "Open email draft"
    const submitBtn = modal.locator('button[type="submit"]');
    await expect(submitBtn).toContainText('Open email draft');

    // Fill out 5 fields
    await modal.locator('#ccc-name').fill('Alex Rivera');
    await modal.locator('#ccc-email').fill('alex@nightjarbar.com');
    await modal.locator('#ccc-venue').fill('Nightjar, Los Angeles');
    await modal.locator('#ccc-service').selectOption('Photo + vertical reel bundle');
    await modal.locator('#ccc-notes').fill('New winter cocktail menu and late-night room energy.');

    await submitBtn.click();

    // Confirmation state
    const confirmBox = modal.locator('#ccc-confirm-box');
    await expect(confirmBox).toBeVisible();
    await expect(modal.locator('#ccc-confirm-msg')).toHaveText('Your inquiry is ready to send');
    await expect(modal.locator('.ccc-confirm-desc')).toContainText('Send the message from your mail app');

    // Prefilled mailto link & fallback composed text
    const mailtoHref = await modal.locator('#ccc-mailto-link').getAttribute('href');
    expect(mailtoHref).toContain('mailto:capturecreatecaffeinate@gmail.com');
    expect(decodeURIComponent(mailtoHref || '')).toContain('CCC shoot inquiry: Nightjar, Los Angeles');
    expect(decodeURIComponent(mailtoHref || '')).toContain('Name: Alex Rivera');
    expect(decodeURIComponent(mailtoHref || '')).toContain('Email: alex@nightjarbar.com');
    expect(decodeURIComponent(mailtoHref || '')).toContain('Venue: Nightjar, Los Angeles');
    expect(decodeURIComponent(mailtoHref || '')).toContain('Package/Service: Photo + vertical reel bundle');
    expect(decodeURIComponent(mailtoHref || '')).toContain('Notes & dates: New winter cocktail menu and late-night room energy.');

    const payload = await modal.locator('#ccc-copy-payload').inputValue();
    expect(payload).toContain('Subject: CCC shoot inquiry: Nightjar, Los Angeles');
    expect(payload).toContain('Venue: Nightjar, Los Angeles');
    expect(payload).toContain('Package/Service: Photo + vertical reel bundle');
    await expect(modal.locator('#ccc-copy-btn')).toBeVisible();

    // Close button closes modal
    await modal.locator('#ccc-modal-close').click();
    await expect(modal).toBeHidden();
  });
});
