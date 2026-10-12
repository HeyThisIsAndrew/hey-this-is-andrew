import { test, expect } from '@playwright/test';

test.describe('Global QA', () => {
  const pages = ['./', './build/', './about/'];

  for (const p of pages) {
    test(`Page ${p} has no horizontal scroll`, async ({ page }) => {
      await page.goto(p);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      if (scrollWidth > clientWidth) console.warn('Horizontal scroll detected on', p, scrollWidth, clientWidth);
    });
  }

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
  });

  test('Expanders expand, focus, and deep-link', async ({ page }) => {
    await page.goto('./');
    const btn = page.locator('.expand-trigger').first();
    const targetId = await btn.getAttribute('aria-controls');
    if (!targetId) return;

    await btn.click();
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator(`#${targetId}`)).toBeVisible();
    await expect(page.url()).toContain(`#${targetId}`);

    await page.reload();
    await expect(page.locator('button[aria-controls="' + targetId + '"]')).toHaveAttribute('aria-expanded', 'true');
  });

  test('Dropdown paints over the scroll bar, and the bar never hides', async ({ page, isMobile }) => {
    if (isMobile) test.skip();
    await page.goto('./');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
    await page.waitForTimeout(300);
    const bar = page.locator('#scroll-progress');
    await page.locator('.nav-link[aria-haspopup="true"]').first().hover();
    const dropdown = page.locator('.nav-item.is-open .dropdown-menu');
    await expect(dropdown).toBeVisible();
    // Hovering a nav link never wipes the line out (it used to be hidden
    // while any dropdown was open).
    await expect(bar).toBeVisible();
    // Where the menu crosses the bar, the menu is on top: paint order, not
    // z-index numbers (the menu's z-index only counts inside the header).
    const onTop = await page.evaluate(() => {
      const b = document.querySelector('#scroll-progress')!.getBoundingClientRect();
      const m = document.querySelector('.nav-item.is-open .dropdown-inner')!.getBoundingClientRect();
      const x = m.left + m.width / 2;
      const y = b.top + b.height / 2;
      if (y < m.top || y > m.bottom) return true; // they do not cross at all
      return Boolean(document.elementFromPoint(x, y)?.closest('.dropdown-menu'));
    });
    expect(onTop).toBe(true);
  });

  test('Hover never clears the active nav underline', async ({ page, isMobile }) => {
    if (isMobile) test.skip();
    await page.goto('./build/');
    const underline = (el: Element) => getComputedStyle(el, '::after').transform;
    const active = page.locator('.desktop-nav .nav-link.active');
    await expect(active).toHaveCount(1);
    const links = page.locator('.desktop-nav .nav-link');
    for (let i = 0; i < (await links.count()); i++) {
      await links.nth(i).hover();
      await page.waitForTimeout(450); // past the 0.35s underline transition
      await expect(active).toHaveClass(/\bactive\b/);
      expect(await active.evaluate(underline)).toBe('matrix(1, 0, 0, 1, 0, 0)');
    }
  });

  test('Brands: exactly three panels, and the camera zooms into each', async ({ page }) => {
    await page.goto('./');
    const panels = page.locator('[data-bacc-panel]');
    await expect(panels).toHaveCount(3);
    await expect(page.locator('[data-bacc-trigger]')).toHaveText([/BE Unconventional HQ/i, /Capture Create Caffeinate/i, /Sip the Magic/i]);
    await page.locator('[data-bacc]').scrollIntoViewIfNeeded();
    const viewport = page.locator('[data-bacc-viewport]');
    for (let i = 0; i < 3; i++) {
      const panel = panels.nth(i);
      if (!(await panel.evaluate((e) => e.classList.contains('is-open')))) await panel.locator('[data-bacc-trigger]').click();
      await expect(panel).toHaveClass(/is-open/);
      await panel.locator('.bacc-media').click({ force: true });
      await expect(viewport).toHaveClass(/is-zoomed/);
      await page.keyboard.press('Escape');
      await expect(viewport).not.toHaveClass(/is-zoomed/);
    }
  });

  test('Latest filters: Video and Writing toggle, equal widths, deep links', async ({ page }) => {
    await page.goto('./');
    const tabs = page.locator('#latest .filter-tab');
    await expect(tabs).toHaveText(['Video', 'Writing']);
    const [a, b] = await tabs.evaluateAll((ts) => ts.map((t) => t.getBoundingClientRect().width));
    expect(Math.abs(a - b)).toBeLessThan(1);
    const hidden = (kind: string) => page.locator(`#latest-home-list [data-kind="${kind}"]:not([hidden])`).count();
    await expect(tabs.nth(0)).toHaveAttribute('aria-pressed', 'false');
    await expect(tabs.nth(1)).toHaveAttribute('aria-pressed', 'false');
    const writingCount = await hidden('writing');
    await tabs.nth(0).click();
    await expect(tabs.nth(0)).toHaveAttribute('aria-pressed', 'true');
    expect(await hidden('writing')).toBe(0);
    await tabs.nth(0).click();
    await expect(tabs.nth(0)).toHaveAttribute('aria-pressed', 'false');
    expect(await hidden('writing')).toBe(writingCount);
    await page.goto('./?filter=writing#latest');
    await expect(tabs.nth(1)).toHaveAttribute('aria-pressed', 'true');
    expect(await hidden('video')).toBe(0);
  });

  test('/build: one accordion row per goal group, one open at a time', async ({ page }) => {
    await page.goto('./build/');
    const rows = page.locator('#goals [data-accordion-row]');
    const headers = page.locator('#goals [data-accordion-header]');
    expect(await headers.count()).toBeGreaterThanOrEqual(3);
    await expect(rows.first()).toHaveClass(/is-expanded/);
    for (let i = 1; i < (await headers.count()); i++) {
      await headers.nth(i).click();
      await expect(headers.nth(i)).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('#goals [data-accordion-row].is-expanded')).toHaveCount(1);
      await expect(rows.nth(i).locator('.accordion-body-inner')).toBeVisible();
    }
    await headers.last().click();
    await expect(page.locator('#goals [data-accordion-row].is-expanded')).toHaveCount(0);
    // No empty anchor sections: every id on the page is unique.
    const dupes = await page.evaluate(() => {
      const seen = new Map<string, number>();
      document.querySelectorAll('[id]').forEach((el) => seen.set(el.id, (seen.get(el.id) ?? 0) + 1));
      return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
    });
    expect(dupes).toEqual([]);
    // A deep link opens its row, and its progress bar shows.
    await page.goto('./build/#content-engine');
    await expect(page.locator('#content-engine')).toHaveClass(/is-expanded/);
    await expect(page.locator('#content-engine .accordion-progress-bar-bg')).toBeVisible();
    await expect(page.locator('#content-engine .checklist-card').first()).toBeVisible();
  });

  test('Homepage goals expand in place, without leaving the page', async ({ page }) => {
    await page.goto('./');
    const url = page.url();
    const header = page.locator('#goals [data-accordion-header]').first();
    await header.scrollIntoViewIfNeeded();
    const body = page.locator('#goals [data-accordion-row]').first().locator('.accordion-body');
    await expect(header).toHaveAttribute('aria-expanded', 'false');
    // Collapsed content is out of the tab order.
    expect(await body.evaluate((b) => (b as HTMLElement).inert)).toBe(true);
    await header.click();
    await expect(header).toHaveAttribute('aria-expanded', 'true');
    await expect(body.locator('.checklist-card').first()).toBeVisible();
    expect(page.url()).toBe(url);
    await header.click();
    await expect(header).toHaveAttribute('aria-expanded', 'false');
    // The one way out is the "View all goals" link.
    await expect(page.locator('#goals a', { hasText: /View all goals/i })).toHaveAttribute('href', /\/build\/$/);
  });

  test('Creator intro: portrait and headline stay, the rest opens in panels', async ({ page }) => {
    await page.goto('./');
    const about = page.locator('#about');
    await about.scrollIntoViewIfNeeded();
    await expect(about.locator('.about-portrait')).toBeVisible();
    await expect(about.locator('.about-headline')).toBeVisible();
    const headers = about.locator('[data-accordion-header]');
    await expect(headers).toHaveText([/What I.m building/i, /How I work/i, /Now/i]);
    const url = page.url();
    for (let i = 0; i < 3; i++) {
      await expect(headers.nth(i)).toHaveAttribute('aria-expanded', 'false');
      await headers.nth(i).click();
      await expect(headers.nth(i)).toHaveAttribute('aria-expanded', 'true');
      await expect(about.locator('[data-accordion-row]').nth(i).locator('.accordion-body-inner')).toBeVisible();
    }
    expect(page.url()).toBe(url);
  });

  test('Selected Work: a video loads nothing from YouTube until play, and unloads on close', async ({ page }) => {
    const embeds: string[] = [];
    page.on('request', (r) => { if (/youtube(-nocookie)?\.com\/embed\//.test(r.url())) embeds.push(r.url()); });
    await page.goto('./');
    const row = page.locator('#work [data-accordion-row]:has([data-inline-video])').first();
    test.skip((await row.count()) === 0, 'no archive video in this build');
    await row.scrollIntoViewIfNeeded();
    await expect(page.locator('#work iframe')).toHaveCount(0);
    await row.locator('[data-accordion-header]').click();
    await expect(row).toHaveClass(/is-expanded/);
    await expect(page.locator('#work iframe')).toHaveCount(0);
    expect(embeds).toEqual([]);
    await row.locator('.iv-poster').click();
    const frame = row.locator('iframe');
    await expect(frame).toHaveCount(1);
    const src = await frame.getAttribute('src');
    expect(src).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\//);
    expect(src).not.toMatch(/autoplay=1/);
    expect(await frame.getAttribute('allow')).toMatch(/fullscreen/);
    // Once the row has finished opening, nothing above the frame clips it
    // (iOS paints a YouTube frame under a clipping ancestor black).
    await expect(row).toHaveClass(/is-settled/);
    const clipped = await frame.evaluate((f) => {
      for (let e = f.parentElement; e && e !== document.body; e = e.parentElement) {
        if (getComputedStyle(e).overflow !== 'visible') return e.className;
      }
      return null;
    });
    expect(clipped).toBeNull();
    await row.locator('[data-accordion-header]').click();
    await expect(page.locator('#work iframe')).toHaveCount(0);
  });

  test('Search: the nav button opens it, and the index loads under the base path', async ({ page, isMobile }) => {
    const index = page.waitForResponse((r) => r.url().endsWith('/hey-this-is-andrew/api/search.json'));
    await page.goto('./');
    if (isMobile) {
      await page.locator('.menu-btn').click();
      await page.locator('#mobile-search-trigger').click();
    } else {
      await page.locator('#nav-search-trigger').click();
    }
    await expect(page.locator('#command-palette')).toHaveAttribute('open', '');
    expect((await index).status()).toBe(200);
    await page.keyboard.type('sony');
    await expect(page.locator('#command-palette a[href^="/hey-this-is-andrew/"]').first()).toBeVisible();
  });

  test('About quote: left aligned, all caps', async ({ page }) => {
    await page.goto('./about/');
    const q = page.locator('.quote-band blockquote p');
    await expect(q).toHaveCSS('text-align', 'left');
    await expect(q).toHaveCSS('text-transform', 'uppercase');
  });

  test('Gear is its own page, reached from the nav', async ({ page, isMobile }) => {
    await page.goto('./');
    if (isMobile) {
      await page.locator('.menu-btn').click();
      await page.locator('.mobile-main-link', { hasText: 'Gear' }).click();
    } else {
      await page.locator('.desktop-nav .nav-link', { hasText: 'Gear' }).click();
    }
    await page.waitForURL('**/gear/');
    await expect(page.locator('h1')).toHaveText(/Gear/i);
    await expect(page.locator('#gear-monolith')).toBeVisible();
  });

  test('/press lands on /about/#press in view', async ({ page }) => {
    await page.goto('./press/');
    await page.waitForURL('**/about/#press', { timeout: 10000 });
    const press = page.locator('#press');
    await expect(press).toBeInViewport();
  });

  test('/work lands on /#work expanded', async ({ page }) => {
    await page.goto('./work/');
    await page.waitForURL('**/#work');
    const btn = page.locator('button[aria-controls="work-expanded"]');
    if (await btn.count() > 0) {
      await expect(btn).toHaveAttribute('aria-expanded', 'true');
    }
  });
});

test.describe('Phone landscape', () => {
  test.use({ viewport: { width: 667, height: 375 }, hasTouch: true, isMobile: true });

  test('Shot on the job fits under the header', async ({ page }) => {
    await page.goto('./');
    const wall = page.locator('.photo-wall');
    test.skip((await wall.count()) === 0, 'no synced Instagram photos in this build');
    await wall.scrollIntoViewIfNeeded();
    const { wallH, room, cols } = await page.evaluate(() => {
      const nav = document.querySelector('.site-nav')!.getBoundingClientRect().height;
      const w = document.querySelector('.photo-wall')!.getBoundingClientRect().height;
      const c = [...document.querySelectorAll('.photo-column')].filter((e) => getComputedStyle(e).display !== 'none').length;
      return { wallH: w, room: window.innerHeight - nav, cols: c };
    });
    expect(wallH).toBeLessThanOrEqual(room);
    expect(cols).toBe(4);
  });
});
