# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: global-qa.spec.ts >> Global QA >> Expanders expand, focus, and deep-link
- Location: e2e/global-qa.spec.ts:37:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.getAttribute: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('.expand-trigger').first()

```

# Page snapshot

```yaml
- main [ref=e2]:
  - 'heading "404: Not Found" [level=1] [ref=e7]'
  - generic [ref=e8]: "Path: /"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Global QA', () => {
  4  |   const pages = ['/', '/build/', '/gear/', '/about/'];
  5  | 
  6  |   for (const p of pages) {
  7  |     test(`Page ${p} has no horizontal scroll`, async ({ page }) => {
  8  |       await page.goto(p);
  9  |       const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  10 |       const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  11 |       if (scrollWidth > clientWidth) console.warn('Horizontal scroll detected on', p, scrollWidth, clientWidth);
  12 |     });
  13 |   }
  14 | 
  15 |   test('Mobile: interactive elements are at least 44x44', async ({ page, isMobile, viewport }) => {
  16 |     if (viewport?.width !== 390) test.skip();
  17 |     await page.goto('/');
  18 |     await page.waitForLoadState('networkidle');
  19 |     await page.waitForSelector('.expand-trigger', { state: 'visible' });
  20 |     const interactives = page.locator('a, button, input, [role="button"]');
  21 |     const count = await interactives.count();
  22 |     for (let i = 0; i < count; i++) {
  23 |       const box = await interactives.nth(i).boundingBox();
  24 |       if (!box) continue;
  25 |       if (box.width > 0 && box.height > 0) {
  26 |         if (!await interactives.nth(i).evaluate(el => el.classList.contains('skip-link'))) expect(box.width).toBeGreaterThanOrEqual(43.5);
  27 |         if ((box.height < 43.5 || box.width < 43.5) && !await interactives.nth(i).evaluate(el => el.classList.contains('skip-link') || el.closest('.skip-link'))) {
  28 |           const html = await interactives.nth(i).evaluate(el => el.outerHTML);
  29 |           console.log('Failing element:', html, box);
  30 |         }
  31 |         expect(box.width).toBeGreaterThanOrEqual(43.5);
  32 |         if (!await interactives.nth(i).evaluate(el => el.classList.contains('skip-link'))) expect(box.height).toBeGreaterThanOrEqual(43.5);
  33 |       }
  34 |     }
  35 |   });
  36 | 
  37 |   test('Expanders expand, focus, and deep-link', async ({ page }) => {
  38 |     await page.goto('/');
  39 |     const btn = page.locator('.expand-trigger').first();
> 40 |     const targetId = await btn.getAttribute('aria-controls');
     |                                ^ Error: locator.getAttribute: Test timeout of 30000ms exceeded.
  41 |     if (!targetId) return;
  42 | 
  43 |     await btn.click();
  44 |     await expect(btn).toHaveAttribute('aria-expanded', 'true');
  45 |     await expect(page.locator(`#${targetId}`)).toBeVisible();
  46 |     await expect(page.url()).toContain(`#${targetId}`);
  47 | 
  48 |     await page.reload();
  49 |     await expect(page.locator('button[aria-controls="' + targetId + '"]')).toHaveAttribute('aria-expanded', 'true');
  50 |     await expect(page.locator(`#${targetId}`)).toBeVisible();
  51 |   });
  52 | 
  53 |   test('Dropdown fully visible without white bar overlap', async ({ page, isMobile }) => {
  54 |     if (isMobile) test.skip();
  55 |     await page.goto('/');
  56 |     await page.evaluate(() => {
  57 |       document.documentElement.style.height = '5000px';
  58 |       window.scrollTo(0, 3000);
  59 |       const progress = document.querySelector('#scroll-progress') as HTMLElement;
  60 |       if (progress) progress.style.transform = 'scaleX(1)';
  61 |     });
  62 |     const dropdownToggle = page.locator('.nav-link[aria-haspopup="true"]').first();
  63 |     await dropdownToggle.hover();
  64 |     const dropdown = page.locator('.dropdown-menu').first();
  65 |     await expect(dropdown).toBeVisible();
  66 | 
  67 |     // Check z-index manually
  68 |     const progressZ = await page.evaluate(() => {
  69 |       const p = document.querySelector('#scroll-progress');
  70 |       return p ? parseInt(window.getComputedStyle(p).zIndex) : 0;
  71 |     });
  72 |     const menuZ = await page.evaluate(() => {
  73 |       const m = document.querySelector('.dropdown-menu');
  74 |       return m ? parseInt(window.getComputedStyle(m).zIndex) : 0;
  75 |     });
  76 |     if (progressZ && menuZ) {
  77 |       expect(progressZ).toBeLessThan(menuZ);
  78 |     }
  79 |   });
  80 | 
  81 |   test('/press lands on /about/#press in view', async ({ page }) => {
  82 |     await page.goto('/press/');
  83 |     await page.waitForTimeout(2000);
  84 |     const url = page.url();
  85 |     expect(url).toContain('/about/#press');
  86 |     const press = page.locator('#press');
  87 |     await expect(press).toBeInViewport();
  88 |   });
  89 | 
  90 |   test('/work lands on /#work expanded', async ({ page }) => {
  91 |     await page.goto('/work/');
  92 |     await page.waitForURL('**/#work');
  93 |     const btn = page.locator('button[aria-controls="work-expanded"]');
  94 |     if (await btn.count() > 0) {
  95 |       await expect(btn).toHaveAttribute('aria-expanded', 'true');
  96 |     }
  97 |   });
  98 | });
  99 | 
```