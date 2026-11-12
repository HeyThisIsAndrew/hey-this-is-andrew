import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Corrective Pass Verification', () => {
  test('Gate 3 & 4: Zero invented gear or CCC pricing on homepage or built site', async ({ page }) => {
    await page.goto('./');

    const content = await page.content();
    expect(content).not.toContain('Sony A7S III');
    expect(content).not.toContain('Sigma 24-70');
    expect(content).not.toContain('Godox AD200');
    expect(content).not.toContain('$950');
    expect(content).not.toContain('$550');
    expect(content).not.toContain('$1,200');
    expect(content.toLowerCase()).not.toContain('founding rate');
    expect(content.toLowerCase()).not.toContain('starting rate');

    // projects.json is empty array
    const projectsPath = path.resolve('sites/hey-this-is-andrew/src/data/projects.json');
    const projectsRaw = fs.readFileSync(projectsPath, 'utf8').trim();
    expect(JSON.parse(projectsRaw)).toEqual([]);
  });

  test('Gate 4: /ccc/ shows "What is included" with zero pricing numbers', async ({ page }) => {
    await page.goto('./ccc/');

    const pricingSection = page.locator('#pricing');
    await expect(pricingSection).toBeVisible();
    await expect(pricingSection.locator('.sec-eyebrow')).toContainText('What is included');
    await expect(pricingSection.locator('.section-title')).toContainText('Every shoot includes');

    const content = await page.content();
    expect(content).not.toContain('$950');
    expect(content).not.toContain('$550');
    expect(content).not.toContain('$1,200');
    expect(content.toLowerCase()).not.toContain('founding rate');
    expect(content.toLowerCase()).not.toContain('starting rate');
  });

  test('Gate 5: NEEWER NP-FZ100 batteries link restored on gear page', async ({ page }) => {
    await page.goto('./gear/');
    const neewerLink = page.locator('a[href="https://link.amazon/B0e6I51ln"]');
    await expect(neewerLink.first()).toBeAttached();
  });

  test('Gate 6: Selected Work on homepage renders video-led without brand project cards', async ({ page }) => {
    // Desktop 1440x900
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('./');

    const workSec = page.locator('#work');
    await expect(workSec).toBeVisible();
    await expect(workSec.locator('.sw-feature')).toBeVisible();
    await expect(workSec.locator('.sw-projects')).toHaveCount(0);
    await expect(workSec.locator('.sw-archive')).toBeVisible();

    await workSec.screenshot({ path: 'test-results/selected-work-desktop.png' });

    // Mobile touch 390x844
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./');
    const workSecMobile = page.locator('#work');
    await expect(workSecMobile).toBeVisible();
    await expect(workSecMobile.locator('.sw-projects')).toHaveCount(0);
    await workSecMobile.screenshot({ path: 'test-results/selected-work-mobile.png' });
  });

  test('Gate 7: Modal fallback on 501 mailto and success state on mocked 200', async ({ page }) => {
    await page.goto('./ccc/');

    // 1. Test fallback on 501
    const startBtn = page.locator('[data-open-ccc-modal]').first();
    await startBtn.click();
    const modal = page.locator('#ccc-inquiry-modal');
    await expect(modal).toBeVisible();

    await modal.locator('#ccc-name').fill('Test User');
    await modal.locator('#ccc-email').fill('test@example.com');
    await modal.locator('#ccc-venue').fill('The Speakeasy');
    await modal.locator('#ccc-service').selectOption('Half-day photo session');

    await modal.locator('button[type="submit"]').click();

    // With 501, confirm box appears with mailto fallback
    const confirmBox = modal.locator('#ccc-confirm-box');
    await expect(confirmBox).toBeVisible();
    await expect(modal.locator('#ccc-confirm-msg')).toHaveText('Your inquiry is ready to send');
    const mailtoHref = await modal.locator('#ccc-mailto-link').getAttribute('href');
    expect(mailtoHref).toContain('mailto:capturecreatecaffeinate@gmail.com');

    // Close modal
    await modal.locator('#ccc-modal-close').click();
    await expect(modal).toBeHidden();

    // 2. Test mocked 200 success state
    await page.route('**/api/contact', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await startBtn.click();
    await expect(modal).toBeVisible();
    await modal.locator('#ccc-name').fill('Jane Doe');
    await modal.locator('#ccc-email').fill('jane@bar.com');
    await modal.locator('#ccc-venue').fill('Velvet Lounge');
    await modal.locator('#ccc-service').selectOption('Half-day photo session');

    await modal.locator('button[type="submit"]').click();

    await expect(confirmBox).toBeVisible();
    await expect(modal.locator('#ccc-confirm-msg')).toHaveText('Thanks. We will get back to you to schedule a call.');
    await expect(modal.locator('.ccc-copy-wrap')).toBeHidden();
  });

  test('Gate 8: /api/contact route returns 501 with valid JSON', async () => {
    // 1. Verify source module export and 501 response
    const contactRoute = await import('../sites/hey-this-is-andrew/src/pages/api/contact.ts');
    expect(typeof contactRoute.POST).toBe('function');
    const res = await contactRoute.POST({} as any);
    expect(res.status).toBe(501);
    const json = await res.json();
    expect(json).toEqual({
      error: 'not_configured',
      message: 'Contact endpoint is not live yet.',
    });

    // 2. Verify static build artifact also exists with matching payload
    const distArtifactPath = path.resolve('sites/hey-this-is-andrew/dist/api/contact');
    expect(fs.existsSync(distArtifactPath)).toBe(true);
    const distContent = JSON.parse(fs.readFileSync(distArtifactPath, 'utf8'));
    expect(distContent).toEqual({
      error: 'not_configured',
      message: 'Contact endpoint is not live yet.',
    });
  });

  test('Gate 9: Tiles global single-line text and zero box-boundary overflow', async ({ page }) => {
    const viewports = [
      { width: 390, height: 844 },
      { width: 820, height: 1180 },
      { width: 1440, height: 900 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('./ccc/');
      await page.evaluate(() => document.fonts?.ready);

      const tileStats = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.ccc-pricing-cards .flip-card'));
        return cards.map((card) => {
          const val = card.querySelector<HTMLElement>('.stat-value');
          const front = card.querySelector<HTMLElement>('.flip-card-front');
          const valRect = val?.getBoundingClientRect();
          const frontRect = front?.getBoundingClientRect();
          const computed = val ? getComputedStyle(val) : null;
          return {
            text: val?.textContent?.trim(),
            whiteSpace: computed?.whiteSpace,
            scrollWidth: val?.scrollWidth ?? 0,
            clientWidth: val?.clientWidth ?? 0,
            overflowsCard: Boolean(
              valRect && frontRect && (valRect.left < frontRect.left - 1 || valRect.right > frontRect.right + 1)
            ),
          };
        });
      });

      expect(tileStats.length).toBe(3);
      for (const stat of tileStats) {
        expect(stat.whiteSpace).toBe('nowrap');
        expect(stat.scrollWidth).toBeLessThanOrEqual(stat.clientWidth + 1);
        expect(stat.overflowsCard).toBe(false);
      }
    }
  });

  test('Gate 10: BeUnconventionalHQ coverage cards icon sizing and flip text legibility', async ({ page }) => {
    // 1. Mobile viewport (390x844)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./brands/be-unconventional-hq/');
    await page.evaluate(() => document.fonts?.ready);
    // The card art is lazy and sits far below the fold: measure it once it
    // has loaded, as a reader scrolling there sees it.
    await page.locator('#coverage').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('#coverage .hq-card-img')].every((i) => i.complete && i.naturalWidth > 0));

    const mobileCards = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('#coverage .hq-card'));
      return cards.map((c) => {
        const cardEl = c as HTMLElement;
        const media = c.querySelector<HTMLElement>('.hq-card-media');
        const img = c.querySelector<HTMLElement>('.hq-card-img');
        const backTitle = c.querySelector<HTMLElement>('.hq-card-back-title');
        const backLine = c.querySelector<HTMLElement>('.hq-card-back-line');
        return {
          cardH: cardEl.offsetHeight,
          mediaW: media?.offsetWidth ?? 0,
          imgH: img?.getBoundingClientRect().height ?? 0,
          backTitleFontSize: backTitle ? parseFloat(getComputedStyle(backTitle).fontSize) : 0,
          backLineFontSize: backLine ? parseFloat(getComputedStyle(backLine).fontSize) : 0,
        };
      });
    });

    expect(mobileCards.length).toBe(4);
    for (const card of mobileCards) {
      expect(card.cardH).toBeGreaterThanOrEqual(90);
      expect(card.mediaW).toBeGreaterThanOrEqual(95);
      expect(card.imgH).toBeGreaterThanOrEqual(60);
      expect(card.backTitleFontSize).toBeGreaterThanOrEqual(13);
    }

    // 2. Desktop viewport (1440x900)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('./brands/be-unconventional-hq/');
    await page.evaluate(() => document.fonts?.ready);
    // The card art is lazy and sits far below the fold: measure it once it
    // has loaded, as a reader scrolling there sees it.
    await page.locator('#coverage').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('#coverage .hq-card-img')].every((i) => i.complete && i.naturalWidth > 0));

    const desktopCards = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('#coverage .hq-card'));
      return cards.map((c) => {
        const img = c.querySelector<HTMLElement>('.hq-card-img');
        const backTitle = c.querySelector<HTMLElement>('.hq-card-back-title');
        return {
          imgH: img?.getBoundingClientRect().height ?? 0,
          backTitleFontSize: backTitle ? parseFloat(getComputedStyle(backTitle).fontSize) : 0,
        };
      });
    });

    expect(desktopCards.length).toBe(4);
    for (const card of desktopCards) {
      expect(card.imgH).toBeGreaterThanOrEqual(80);
      expect(card.backTitleFontSize).toBeGreaterThanOrEqual(13);
    }
  });
});
