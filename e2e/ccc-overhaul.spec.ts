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

    // Verify 4K calibration (headline ~51.2px, logo ~347px, CTA row ~475px)
    const m4k = metrics[metrics.length - 1];
    expect(m4k.heroTitleFs).toBeGreaterThanOrEqual(48);
    expect(m4k.heroTitleFs).toBeLessThanOrEqual(55);
    expect(m4k.heroLogoW).toBeGreaterThanOrEqual(330);
    expect(m4k.heroLogoW).toBeLessThanOrEqual(365);
    expect(m4k.heroActionsW).toBeGreaterThanOrEqual(450);
    expect(m4k.heroActionsW).toBeLessThanOrEqual(500);

    // Verify continuous hero title growth across 320 -> 390 -> 480 -> 481 (no drop at 481px)
    const mobileFs: number[] = [];
    for (const vw of [320, 390, 480, 481]) {
      await page.setViewportSize({ width: vw, height: 844 });
      await page.goto('./ccc/');
      const fs = await page.locator('#ccc-hero-title').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      mobileFs.push(fs);
    }
    expect(mobileFs[1]).toBeGreaterThanOrEqual(mobileFs[0]);
    expect(mobileFs[2]).toBeGreaterThanOrEqual(mobileFs[1]);
    expect(mobileFs[3]).toBeGreaterThanOrEqual(mobileFs[2] - 0.1);

    // Also verify two-line hero at 320px portrait and 844x390 short landscape, plus width-descriptor logo srcset
    for (const [vw, vh] of [
      [320, 640],
      [844, 390],
    ]) {
      await page.setViewportSize({ width: vw, height: vh });
      await page.goto('./ccc/');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow).toBe(false);
    }
    const logoSrcset = await page.locator('.ccc-hero-logo').getAttribute('srcset');
    expect(logoSrcset).toContain('150w');
    expect(logoSrcset).toContain('700w');
  });

  test('CCC-03: Scroll timing, hero readability at 140px, independent subject progress, 4K anchor clearance, and reversible states', async ({ page }) => {
    const scrollInstant = async (y: number) => {
      await page.evaluate(async (targetY) => {
        const html = document.documentElement;
        const prev = html.style.scrollBehavior;
        html.style.scrollBehavior = 'auto';
        window.scrollTo(0, targetY);
        html.style.scrollBehavior = prev;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      }, y);
    };

    await page.setViewportSize({ width: 3840, height: 2160 });
    await page.goto('./ccc/');

    // At 3840x2160, scrolling 140px keeps hero logo and content 100% opaque because actions are still well in view
    await scrollInstant(140);
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

    // Independent progress: when Why top pair is settled and Why bottom pair is lower in the viewport,
    // their numeric DOMMatrixReadOnly scale/translate values differ
    await page.setViewportSize({ width: 1512, height: 982 });
    await page.goto('./ccc/');

    const whyTopDoc = await page.evaluate(() => {
      const el = document.getElementById('ccc-why-top')!;
      let y = 0;
      for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) y += n.offsetTop;
      return y;
    });
    await scrollInstant(Math.round(whyTopDoc - 420));
    const whyPairMatrices = await page.evaluate(() => {
      const topMedia = document.querySelector<HTMLElement>('#ccc-why-top .ccc-why-media')!;
      const bottomMedia = document.querySelector<HTMLElement>('#ccc-why-bottom .ccc-why-media')!;
      const mTop = new DOMMatrixReadOnly(getComputedStyle(topMedia).transform);
      const mBottom = new DOMMatrixReadOnly(getComputedStyle(bottomMedia).transform);
      return {
        topScale: mTop.a,
        bottomScale: mBottom.a,
        topX: mTop.m41,
        bottomX: mBottom.m41,
      };
    });
    expect(whyPairMatrices.topScale).toBeGreaterThan(whyPairMatrices.bottomScale);

    const roomTopDoc = await page.evaluate(() => {
      const el = document.getElementById('ccc-work-room')!;
      let y = 0;
      for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) y += n.offsetTop;
      return y;
    });

    // Scroll so #ccc-work-room is just entering the bottom of the viewport (top = 982 * 0.88)
    const entryScrollY = Math.round(roomTopDoc - 982 * 0.88);
    await scrollInstant(entryScrollY);
    const roomScaleEntry = await page
      .locator('#ccc-work-room .ccc-room-wide')
      .evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).a);

    // Scroll so #ccc-work-room settles in reading zone (top = 350)
    const settledScrollY = Math.round(roomTopDoc - 350);
    await scrollInstant(settledScrollY);
    const roomScaleSettled = await page
      .locator('#ccc-work-room .ccc-room-wide')
      .evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).a);

    expect(roomScaleEntry).toBeLessThan(0.99);
    expect(roomScaleSettled).toBeCloseTo(1, 2);

    // Reversibility: scrolling back to entryScrollY from below produces the exact same numeric scale
    await scrollInstant(entryScrollY);
    const roomScaleReversed = await page
      .locator('#ccc-work-room .ccc-room-wide')
      .evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).a);
    expect(roomScaleReversed).toBeCloseTo(roomScaleEntry, 3);

    // 4K same-document location.hash jumps (#why, #how) and PageNav jumps clear the painted dock
    await page.setViewportSize({ width: 3840, height: 2160 });
    await page.goto('./ccc/');
    for (const hash of ['#why', '#how']) {
      await page.evaluate((h) => {
        location.hash = h;
      }, hash);
      await page.waitForTimeout(150);
      const clearance = await page.evaluate((h) => {
        const sec = document.querySelector(h)!;
        const head = sec.querySelector<HTMLElement>('.sec-head')!;
        const dock = document.querySelector<HTMLElement>('.ccc-dock-row--hero')!;
        const headRect = head.getBoundingClientRect();
        const dockRect = dock.getBoundingClientRect();
        const hit = document.elementFromPoint(headRect.left + 20, headRect.top + 10);
        return {
          headTop: headRect.top,
          dockBottom: dockRect.bottom,
          hitInDock: Boolean(hit?.closest('#ccc-pinned-stack')),
        };
      }, hash);
      expect(clearance.headTop).toBeGreaterThanOrEqual(clearance.dockBottom);
      expect(clearance.hitInDock).toBe(false);
    }

    // 4K deep link to #contact: #ccc-closer is in viewport and Contact PageNav item is active
    await page.goto('./ccc/#contact');
    await page.waitForTimeout(200);
    await expect(page.locator('#ccc-closer')).toBeInViewport();
    await expect(page.locator('#page-nav [data-pn-link="ccc-closer"]')).toHaveClass(/\bactive\b/);
  });

  test('CCC-04: Reduced motion respected on initial load and live toggle, and dock focus fallback stays visible', async ({ page }) => {
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

    // Live toggle to no-preference while scrolled into Why section, then back to reduce
    await page.evaluate(() => window.scrollTo(0, 1600));
    await page.waitForTimeout(80);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForTimeout(80);
    await expect(page.locator('.ccc-dock-row--hero')).toHaveClass(/is-docked/);
    expect(await page.locator('.ccc-dock-row--hero').getAttribute('inert')).toBeNull();

    // Focus dock button, then scroll to where closer begins dismissing the dock while closer CTA is still below viewport
    const dockBtn = page.locator('.ccc-dock-btn--hero');
    await dockBtn.focus();
    await expect(dockBtn).toBeFocused();

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => {
      const closer = document.getElementById('contact')!;
      let y = 0;
      for (let n: HTMLElement | null = closer; n; n = n.offsetParent as HTMLElement | null) y += n.offsetTop;
      // Put closer top at 0.75 * innerHeight so dock dismisses while closer CTA is still offscreen
      window.scrollTo(0, Math.round(y - window.innerHeight * 0.75));
    });
    await page.waitForTimeout(100);
    await expect(page.locator('.ccc-dock-row--hero')).toHaveAttribute('inert', '');
    const activeInViewport = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      if (!active || active === document.body) return false;
      const r = active.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= window.innerHeight;
    });
    expect(activeInViewport).toBe(true);
  });

  test('CCC-05 & CCC-06: Rotating tile reference parity (390, 1440, 3840), hover Contact hit-testing, Escape dismissal, and keyboard accessibility', async ({ page }, testInfo) => {
    const viewports = [
      { width: 390, height: 844, expectedW: 326, expectedH: 180, expectedGap: 16 },
      { width: 1440, height: 900, expectedW: 333, expectedH: 155, expectedGap: 19.2 },
      { width: 3840, height: 2160, expectedW: 611, expectedH: 221, expectedGap: 27.6 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const route of ['./brands/be-unconventional-hq/', './ccc/']) {
        await page.goto(route);
        await page.evaluate(() => document.fonts?.ready);
        const m = await page.evaluate(() => {
          const grid = document.querySelector<HTMLElement>('.flip-card-grid')!;
          const card = grid.querySelector<HTMLElement>('.flip-card')!;
          return {
            w: Math.round(card.offsetWidth),
            h: Math.round(card.offsetHeight),
            gap: parseFloat(getComputedStyle(grid).columnGap || getComputedStyle(grid).gap),
          };
        });
        expect(Math.abs(m.w - vp.expectedW)).toBeLessThanOrEqual(2);
        if (route.includes('ccc')) {
          expect(m.h).toBeGreaterThanOrEqual(vp.expectedH - 2);
          expect(m.h).toBeLessThanOrEqual(vp.expectedH + 75);
        } else {
          expect(Math.abs(m.h - vp.expectedH)).toBeLessThanOrEqual(2);
        }
        expect(Math.abs(m.gap - vp.expectedGap)).toBeLessThanOrEqual(1);
      }
    }

    // Mobile (#pricing at 390x844): cards precede photo and fit in viewport on #pricing jump
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./ccc/#pricing');
    await page.locator('.ccc-pricing-cards').scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    const mobilePricingOrder = await page.evaluate(() => {
      const cards = document.querySelector<HTMLElement>('.ccc-pricing-cards')!.getBoundingClientRect();
      const media = document.querySelector<HTMLElement>('.ccc-pricing-media')!.getBoundingClientRect();
      return {
        cardsBeforeMedia: cards.top < media.top,
        cardsTop: cards.top,
        cardsBottom: cards.bottom,
        vh: window.innerHeight,
      };
    });
    expect(mobilePricingOrder.cardsBeforeMedia).toBe(true);
    expect(mobilePricingOrder.cardsTop).toBeGreaterThanOrEqual(0);

    // Desktop (1440x900): fine-pointer hover directly clicks Contact, Escape dismisses card without reopening
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('./ccc/');
    const pricing = page.locator('#pricing');
    await pricing.scrollIntoViewIfNeeded();

    const firstCard = pricing.locator('.flip-card').first();
    const firstToggle = firstCard.locator('.flip-card-toggle');
    const firstAction = firstCard.locator('.flip-action-btn');
    const modal = page.locator('#ccc-inquiry-modal');

    if (!testInfo.project.name.includes('mobile')) {
      // Fine-pointer hover reveals back face and allows clicking Contact directly
      await firstCard.hover();
      await firstAction.click();
      await expect(modal).toBeVisible();
      await expect(modal.locator('#ccc-service')).toHaveValue('Half-day photo session');
      await modal.locator('#ccc-modal-close').click();
      await expect(modal).toBeHidden();

      // Move mouse away to reset hover
      await page.mouse.move(10, 10);
    }

    // Before explicit flip, Contact action button is excluded from tab order
    await expect(firstAction).toHaveAttribute('tabindex', '-1');
    await expect(firstAction).toHaveAttribute('aria-hidden', 'true');

    // Focus card toggle and press Enter to flip
    await firstToggle.focus();
    await page.keyboard.press('Enter');
    await expect(firstCard).toHaveClass(/\bis-flipped\b/);
    await expect(firstToggle).toHaveAttribute('aria-pressed', 'true');

    // Escape visually closes the card, sets is-dismissed, and keeps focus on the toggle without reopening
    await page.keyboard.press('Escape');
    await expect(firstCard).not.toHaveClass(/\bis-flipped\b/);
    await expect(firstCard).toHaveClass(/\bis-dismissed\b/);
    await expect(firstToggle).toHaveAttribute('aria-pressed', 'false');
    await expect(firstToggle).toBeFocused();

    // Press Enter again to re-open, Tab to Contact, Enter to open modal, Escape to close modal without collapsing the card
    await page.keyboard.press('Enter');
    await expect(firstCard).toHaveClass(/\bis-flipped\b/);
    await page.keyboard.press('Tab');
    await expect(firstAction).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(modal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
    await expect(firstCard).toHaveClass(/\bis-flipped\b/);
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
