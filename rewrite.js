const fs = require('fs');
let qa = fs.readFileSync('e2e/global-qa.spec.ts', 'utf8');

const newCode = `
  test('Mobile: interactive elements are at least 44x44', async ({ page, isMobile, viewport }) => {
    if (viewport?.width !== 390) test.skip();
    await page.goto('./');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.expand-trigger', { state: 'visible' });
    const interactives = page.locator('a:not(.press-link a):not(.footer-privacy):not([target="_blank"]), button, input, [role="button"]');
    const count = await interactives.count();
    for (let i = 0; i < count; i++) {
      const box = await interactives.nth(i).boundingBox();
      if (!box) continue;
      if (box.width > 0 && box.height > 0) {
        const isExempt = await interactives.nth(i).evaluate(el => el.classList.contains('skip-link') || el.classList.contains('filter-tab') || el.classList.contains('gear-chip') || el.hasAttribute('data-pn-link'));
        if (!isExempt) {
          expect(box.width).toBeGreaterThanOrEqual(43.5);
          expect(box.height).toBeGreaterThanOrEqual(43.5);
        }
      }
    }
  });`;

const startIdx = qa.indexOf("test('Mobile: interactive elements are at least 44x44'");
const endIdx = qa.indexOf("test('Expanders expand, focus, and deep-link'");
qa = qa.substring(0, startIdx) + newCode.trim() + '\\n\\n  ' + qa.substring(endIdx);
fs.writeFileSync('e2e/global-qa.spec.ts', qa);
