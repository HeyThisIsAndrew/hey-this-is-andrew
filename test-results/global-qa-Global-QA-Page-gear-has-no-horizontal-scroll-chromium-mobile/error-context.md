# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: global-qa.spec.ts >> Global QA >> Page /gear/ has no horizontal scroll
- Location: e2e/global-qa.spec.ts:7:9

# Error details

```
Error: page.evaluate: Execution context was destroyed, most likely because of a navigation
```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]:
  - link "Skip to content" [ref=f1e2] [cursor=pointer]:
    - /url: "#main-content"
  - banner [ref=f1e3]:
    - generic [ref=f1e4]:
      - link "HEY_THISISANDREW, home" [ref=f1e5] [cursor=pointer]:
        - /url: /hey-this-is-andrew/
        - img "HEY_THISISANDREW" [ref=f1e6]
      - navigation "Sections" [ref=f1e7]:
        - list [ref=f1e8]:
          - listitem [ref=f1e9]:
            - link "Home" [ref=f1e11] [cursor=pointer]:
              - /url: /hey-this-is-andrew/
            - menu "Home subsections" [ref=f1e14]:
              - list [ref=f1e16]:
                - menuitem "01Overview" [ref=f1e17] [cursor=pointer]: 01Overview→
                - menuitem "02Brands" [ref=f1e18] [cursor=pointer]: 02Brands→
                - menuitem "03Meet The Creator" [ref=f1e19] [cursor=pointer]: 03Meet The Creator→
                - menuitem "04Shot on the job." [ref=f1e20] [cursor=pointer]: 04Shot on the job.→
                - menuitem "05Work" [ref=f1e21] [cursor=pointer]: 05Work→
                - menuitem "06Latest" [ref=f1e22] [cursor=pointer]: 06Latest→
                - menuitem "07Goals" [ref=f1e23] [cursor=pointer]: 07Goals→
                - menuitem "08What I do" [ref=f1e24] [cursor=pointer]: 08What I do→
                - menuitem "09Gear" [ref=f1e25] [cursor=pointer]: 09Gear→
                - menuitem "10Newsletter" [ref=f1e26] [cursor=pointer]: 10Newsletter→
          - listitem [ref=f1e27]:
            - link "Build in Public" [ref=f1e29] [cursor=pointer]:
              - /url: /hey-this-is-andrew/build/
            - menu "Build in Public subsections" [ref=f1e32]:
              - list [ref=f1e34]:
                - menuitem "01Now" [ref=f1e35] [cursor=pointer]: 01Now→
                - menuitem "02Milestone roadmap" [ref=f1e36] [cursor=pointer]: 02Milestone roadmap→
                - menuitem "03Core engine" [ref=f1e37] [cursor=pointer]: 03Core engine→
                - menuitem "BEBE Unconventional HQ" [ref=f1e38] [cursor=pointer]: BEBE Unconventional HQ→
                - menuitem "CCCCapture Create Caffeinate" [ref=f1e39] [cursor=pointer]: CCCCapture Create Caffeinate→
                - menuitem "04Goals" [ref=f1e40] [cursor=pointer]: 04Goals→
          - listitem [ref=f1e41]:
            - link "Gear" [ref=f1e43] [cursor=pointer]:
              - /url: /hey-this-is-andrew/#gear
          - listitem [ref=f1e44]:
            - link "About" [ref=f1e46] [cursor=pointer]:
              - /url: /hey-this-is-andrew/about/
            - menu "About subsections" [ref=f1e49]:
              - list [ref=f1e51]:
                - menuitem "01Story" [ref=f1e52] [cursor=pointer]: 01Story→
                - menuitem "02Brands I run" [ref=f1e53] [cursor=pointer]: 02Brands I run→
                - menuitem "03Press kit" [ref=f1e54] [cursor=pointer]: 03Press kit→
                - menuitem "04Contact" [ref=f1e55] [cursor=pointer]: 04Contact→
      - generic [ref=f1e56]:
        - button "Search site" [ref=f1e57]
        - button "Menu" [ref=f1e61]
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
> 9  |       const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
     |                                      ^ Error: page.evaluate: Execution context was destroyed, most likely because of a navigation
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
  40 |     const targetId = await btn.getAttribute('aria-controls');
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