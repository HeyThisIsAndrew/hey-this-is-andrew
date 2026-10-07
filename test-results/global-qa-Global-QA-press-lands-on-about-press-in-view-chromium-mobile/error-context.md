# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: global-qa.spec.ts >> Global QA >> /press lands on /about/#press in view
- Location: e2e/global-qa.spec.ts:81:7

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected substring: "/about/#press"
Received string:    "http://localhost:3000/press/"
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Skip to content" [ref=e2] [cursor=pointer]:
    - /url: "#main-content"
  - banner [ref=e3]:
    - generic [ref=e4]:
      - link "HEY_THISISANDREW, home" [ref=e5] [cursor=pointer]:
        - /url: /hey-this-is-andrew/
        - img "HEY_THISISANDREW" [ref=e6]
      - navigation "Sections" [ref=e7]:
        - list [ref=e8]:
          - listitem [ref=e9]:
            - link "Home" [ref=e11] [cursor=pointer]:
              - /url: /hey-this-is-andrew/
            - menu "Home subsections" [ref=e14]:
              - list [ref=e16]:
                - menuitem "01Overview" [ref=e17] [cursor=pointer]: 01Overview→
                - menuitem "02Brands" [ref=e18] [cursor=pointer]: 02Brands→
                - menuitem "03Meet The Creator" [ref=e19] [cursor=pointer]: 03Meet The Creator→
                - menuitem "04Shot on the job." [ref=e20] [cursor=pointer]: 04Shot on the job.→
                - menuitem "05Work" [ref=e21] [cursor=pointer]: 05Work→
                - menuitem "06Latest" [ref=e22] [cursor=pointer]: 06Latest→
                - menuitem "07Goals" [ref=e23] [cursor=pointer]: 07Goals→
                - menuitem "08What I do" [ref=e24] [cursor=pointer]: 08What I do→
                - menuitem "09Gear" [ref=e25] [cursor=pointer]: 09Gear→
                - menuitem "10Newsletter" [ref=e26] [cursor=pointer]: 10Newsletter→
          - listitem [ref=e27]:
            - link "Build in Public" [ref=e29] [cursor=pointer]:
              - /url: /hey-this-is-andrew/build/
            - menu "Build in Public subsections" [ref=e32]:
              - list [ref=e34]:
                - menuitem "01Now" [ref=e35] [cursor=pointer]: 01Now→
                - menuitem "02Milestone roadmap" [ref=e36] [cursor=pointer]: 02Milestone roadmap→
                - menuitem "03Core engine" [ref=e37] [cursor=pointer]: 03Core engine→
                - menuitem "BEBE Unconventional HQ" [ref=e38] [cursor=pointer]: BEBE Unconventional HQ→
                - menuitem "CCCCapture Create Caffeinate" [ref=e39] [cursor=pointer]: CCCCapture Create Caffeinate→
                - menuitem "04Goals" [ref=e40] [cursor=pointer]: 04Goals→
          - listitem [ref=e41]:
            - link "Gear" [ref=e43] [cursor=pointer]:
              - /url: /hey-this-is-andrew/#gear
          - listitem [ref=e44]:
            - link "About" [ref=e46] [cursor=pointer]:
              - /url: /hey-this-is-andrew/about/
            - menu "About subsections" [ref=e49]:
              - list [ref=e51]:
                - menuitem "01Story" [ref=e52] [cursor=pointer]: 01Story→
                - menuitem "02Brands I run" [ref=e53] [cursor=pointer]: 02Brands I run→
                - menuitem "03Press kit" [ref=e54] [cursor=pointer]: 03Press kit→
                - menuitem "04Contact" [ref=e55] [cursor=pointer]: 04Contact→
      - generic [ref=e56]:
        - button "Search site" [ref=e57]
        - button "Menu" [ref=e61]
  - main [ref=e63]:
    - heading "Press kit for HEY_THISISANDREW" [level=1] [ref=e64]
    - region [ref=e66]:
      - generic [ref=e67]:
        - generic [ref=e68]:
          - paragraph [ref=e69]:
            - generic [aria-hidden] [ref=e70]: "01"
            - generic [ref=e71]: Press & partnerships
          - generic [ref=e72]:
            - heading "Press kit" [level=2] [ref=e73]
            - link "Direct link to Press kit section (click to copy)" [ref=e74] [cursor=pointer]:
              - /url: "#press-heading"
              - generic [aria-hidden] [ref=e75]: "#"
              - generic [aria-hidden]: COPIED
          - paragraph [ref=e76]: Everything a brand or outlet needs to feature Andrew. For anything else, reach out directly.
        - generic [ref=e79]:
          - generic [ref=e80]:
            - heading "Bio" [level=2] [ref=e81]
            - paragraph [ref=e82]: HEY_THISISANDREW is the work of Andrew Baxter, creator, photographer, and coffee drinker building brands in public and figuring it out as I go.
            - paragraph [ref=e83]:
              - text: Right now I'm building three brands and documenting the whole journey.
              - strong [ref=e84]: BE Unconventional HQ
              - text: covers movies, TV, games, and events.
              - strong [ref=e85]: Capture Create Caffeinate
              - text: is beverage photography for bars and restaurants. Everything runs through this site as the hub.
            - paragraph [ref=e86]: "The through line is simple: be yourself, put the work out there, and show the process, not just the result."
          - generic [ref=e87]:
            - heading "Audience" [level=2] [ref=e88]
            - generic [ref=e89]:
              - generic [ref=e90]:
                - term [ref=e91]: Not yet confirmed
                - definition [ref=e93]: YouTube
                - definition [ref=e94]: Subscribers on @HeyThisIsAndrew
              - generic [ref=e95]:
                - term [ref=e96]: Not yet confirmed
                - definition [ref=e98]: Instagram
                - definition [ref=e99]: Followers on @HeyThisIsAndrew
              - generic [ref=e100]:
                - term [ref=e101]: Not yet confirmed
                - definition [ref=e103]: Newsletter
                - definition [ref=e104]: Subscribers to the weekly drop
              - generic [ref=e105]:
                - term [ref=e106]: Not yet confirmed
                - definition [ref=e108]: Monthly reach
                - definition [ref=e109]: Average views across all platforms
            - paragraph [ref=e110]: Numbers are updated as they are confirmed. No estimates published here.
        - generic [ref=e111]:
          - heading "Brand assets" [level=2] [ref=e112]
          - list [ref=e113]:
            - listitem [ref=e114]:
              - generic [ref=e115]:
                - heading "Wordmark lockup" [level=3] [ref=e116]
                - paragraph [ref=e117]: HEY_THISISANDREW knocked out to solid white on pure black. 1200 x 630.
              - link "Download" [ref=e118] [cursor=pointer]:
                - /url: /hey-this-is-andrew/og-image.png
          - paragraph [ref=e121]: High resolution versions, product shots, and additional formats are available on request.
        - generic [ref=e122]:
          - heading "Past partnerships" [level=2] [ref=e123]
          - paragraph [ref=e124]: No brand partnerships to list yet. The first ones will be documented here, the same way everything else on this site is documented.
        - generic [ref=e125]:
          - heading "Press contact" [level=2] [ref=e126]
          - paragraph [ref=e127]: For screeners, review copies, event credentials, partnerships, and media inquiries, email works best.
          - link "heythisisandrew@gmail.com" [ref=e128] [cursor=pointer]:
            - /url: mailto:heythisisandrew@gmail.com?subject=Press%20inquiry
  - contentinfo [ref=e131]:
    - generic [ref=e132]:
      - generic [ref=e133]:
        - link "HEY_THISISANDREW, home" [ref=e134] [cursor=pointer]:
          - /url: /hey-this-is-andrew/
          - img "HEY_THISISANDREW" [ref=e135]
        - paragraph [ref=e136]: Creator, photographer, coffee drinker.
      - navigation "Explore" [ref=e137]:
        - paragraph [ref=e138]: Explore
        - list [ref=e139]:
          - listitem [ref=e140]:
            - link "Home" [ref=e141] [cursor=pointer]:
              - /url: /hey-this-is-andrew/
          - listitem [ref=e142]:
            - link "Build in Public" [ref=e143] [cursor=pointer]:
              - /url: /hey-this-is-andrew/build/
          - listitem [ref=e144]:
            - link "Gear" [ref=e145] [cursor=pointer]:
              - /url: /hey-this-is-andrew/#gear
          - listitem [ref=e146]:
            - link "About" [ref=e147] [cursor=pointer]:
              - /url: /hey-this-is-andrew/about/
      - generic [ref=e148]:
        - paragraph [ref=e149]: Follow
        - list "Social links" [ref=e150]:
          - listitem [ref=e151]:
            - link "YouTube" [ref=e152] [cursor=pointer]:
              - /url: https://www.youtube.com/@HeyThisIsAndrew
          - listitem [ref=e156]:
            - link "Instagram" [ref=e157] [cursor=pointer]:
              - /url: https://www.instagram.com/hey_thisisandrew/
          - listitem [ref=e162]:
            - link "TikTok" [ref=e163] [cursor=pointer]:
              - /url: https://tiktok.com/@hey_thisisandrew
          - listitem [ref=e166]:
            - link "Threads" [ref=e167] [cursor=pointer]:
              - /url: https://www.threads.net/@hey_thisisandrew
          - listitem [ref=e170]:
            - link "Substack" [ref=e171] [cursor=pointer]:
              - /url: https://thisiscoffeetalk.substack.com/
          - listitem [ref=e174]:
            - link "LinkedIn" [ref=e175] [cursor=pointer]:
              - /url: https://www.linkedin.com/in/andrewlwyrbaxter/
    - generic [ref=e178]:
      - paragraph [ref=e179]: © 2026 Andrew Baxter. All rights reserved.
      - paragraph [ref=e180]:
        - link "Privacy" [ref=e181] [cursor=pointer]:
          - /url: /hey-this-is-andrew/privacy/
        - link "Sitemap" [ref=e182] [cursor=pointer]:
          - /url: /hey-this-is-andrew/sitemap/
      - paragraph [ref=e183]: Built in public with Astro.
      - paragraph [ref=e184]: All process, no perfectionism.
  - button "Back to top" [ref=e185]
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
> 85 |     expect(url).toContain('/about/#press');
     |                 ^ Error: expect(received).toContain(expected) // indexOf
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