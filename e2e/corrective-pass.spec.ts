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
});
