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
    const interactives = page.locator('a:not(.press-link a):not(.footer-privacy):not([target="_blank"]), button, input, [role="button"]');
    const count = await interactives.count();
    for (let i = 0; i < count; i++) {
      const box = await interactives.nth(i).boundingBox();
      if (!box) continue;
      if (box.width > 0 && box.height > 0) {
        // Exempt: the skip link, dense tabs, page-nav dots, and anything a
        // person cannot see or reach (an unflipped card's back face).
        const isExempt = await interactives.nth(i).evaluate(el => el.classList.contains('skip-link') || el.classList.contains('filter-tab') || el.hasAttribute('data-pn-link') || getComputedStyle(el).visibility === 'hidden' || Boolean(el.closest('[aria-hidden="true"], [inert]')));
        if (!isExempt) {
          expect(box.width).toBeGreaterThanOrEqual(43.5);
          expect(box.height).toBeGreaterThanOrEqual(43.5);
        }
      }
    }
  });

  test('Expanders expand, focus, and deep-link', async ({ page }) => {
    // ExpandSection's only page now is the component showroom.
    await page.goto('./kit/');
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

    // Panel 0 (BE): primary button appears on resting panel, other buttons hidden
    const bePanel = panels.nth(0);
    await expect(bePanel).toHaveClass(/is-open/);
    const bePrimaryBtn = bePanel.locator('.bacc-primary-btn');
    await expect(bePrimaryBtn).toBeVisible();
    await expect(bePrimaryBtn).toContainText('Explore');
    await expect(bePanel.locator('.bacc-actions')).toBeHidden();

    // Clicking the primary button opens brand view with all buttons in even size and zero duplicates
    await bePrimaryBtn.click();
    await expect(viewport).toHaveClass(/is-zoomed/);
    const captionActions = viewport.locator('.bacc-caption .bacc-actions .bacc-cta');
    await expect(captionActions).toHaveCount(3);
    // Strict guarantee: exactly three visible action buttons in the caption, no duplicate bottom CTA
    await expect(viewport.locator('.bacc-caption .bacc-cta:visible')).toHaveCount(3);
    await expect(captionActions.nth(0)).toContainText('Explore');
    await expect(captionActions.nth(1)).toContainText('Site');
    await expect(captionActions.nth(2)).toContainText('YouTube');
    const beBtnWidths = await captionActions.evaluateAll((btns) =>
      btns.map((b) => Math.round(b.getBoundingClientRect().width))
    );
    expect(Math.abs(beBtnWidths[0] - beBtnWidths[1])).toBeLessThanOrEqual(2);
    expect(Math.abs(beBtnWidths[1] - beBtnWidths[2])).toBeLessThanOrEqual(2);

    await page.keyboard.press('Escape');
    await expect(viewport).not.toHaveClass(/is-zoomed/);

    // Clicking the image also opens brand view with even-sized buttons
    await bePanel.locator('.bacc-media').click({ force: true });
    await expect(viewport).toHaveClass(/is-zoomed/);
    await page.keyboard.press('Escape');
    await expect(viewport).not.toHaveClass(/is-zoomed/);

    // Panel 1 (CCC): primary button appears on resting panel, click opens brand view
    const cccPanel = panels.nth(1);
    await cccPanel.locator('[data-bacc-trigger]').click();
    await expect(cccPanel).toHaveClass(/is-open/);
    const cccPrimaryBtn = cccPanel.locator('.bacc-primary-btn');
    await expect(cccPrimaryBtn).toBeVisible();
    await expect(cccPrimaryBtn).toContainText('Explore');
    await cccPrimaryBtn.click();
    await expect(viewport).toHaveClass(/is-zoomed/);
    const cccActions = viewport.locator('.bacc-caption .bacc-actions .bacc-cta');
    await expect(cccActions).toHaveCount(3);
    await expect(viewport.locator('.bacc-caption .bacc-cta:visible')).toHaveCount(3);
    const cccBtnWidths = await cccActions.evaluateAll((btns) =>
      btns.map((b) => Math.round(b.getBoundingClientRect().width))
    );
    expect(Math.abs(cccBtnWidths[0] - cccBtnWidths[1])).toBeLessThanOrEqual(2);
    expect(Math.abs(cccBtnWidths[1] - cccBtnWidths[2])).toBeLessThanOrEqual(2);

    await page.keyboard.press('Escape');
    await expect(viewport).not.toHaveClass(/is-zoomed/);

    // Panel 2 (Sip the Magic)
    const stmPanel = panels.nth(2);
    await stmPanel.locator('[data-bacc-trigger]').click();
    await expect(stmPanel).toHaveClass(/is-open/);
    await stmPanel.locator('.bacc-media').click({ force: true });
    await expect(viewport).toHaveClass(/is-zoomed/);
    await page.keyboard.press('Escape');
    await expect(viewport).not.toHaveClass(/is-zoomed/);
  });

  test('Latest filters: Video and Writing toggle, equal widths, deep links', async ({ page }) => {
    await page.goto('./latest/');
    const tabs = page.locator('#latest .filter-tab');
    await expect(tabs).toHaveText(['Video', 'Writing']);
    const [a, b] = await tabs.evaluateAll((ts) => ts.map((t) => t.getBoundingClientRect().width));
    expect(Math.abs(a - b)).toBeLessThan(1);
    const unfiltered = (kind: string) => page.locator(`#latest-list [data-kind="${kind}"]:not([hidden])`).count();
    await expect(tabs.nth(0)).toHaveAttribute('aria-pressed', 'false');
    await expect(tabs.nth(1)).toHaveAttribute('aria-pressed', 'false');
    const writingCount = await unfiltered('writing');
    expect(writingCount).toBeGreaterThan(0);
    await tabs.nth(0).click();
    await expect(tabs.nth(0)).toHaveAttribute('aria-pressed', 'true');
    expect(await unfiltered('writing')).toBe(0);
    await tabs.nth(0).click();
    await expect(tabs.nth(0)).toHaveAttribute('aria-pressed', 'false');
    expect(await unfiltered('writing')).toBe(writingCount);
    await page.goto('./latest/?filter=writing#latest');
    await expect(tabs.nth(1)).toHaveAttribute('aria-pressed', 'true');
    expect(await unfiltered('video')).toBe(0);
  });

  test('/build redirects to /writing/#goals and /writing goals modal works', async ({ page }) => {
    await page.goto('./build/');
    await expect(page).toHaveURL(/\/writing\/#goals$/);

    const boxes = page.locator('#goals .goal-box');
    await expect(boxes).toHaveCount(4);
    await expect(page.locator('#goals .goal-preview-label')).toHaveCount(4);

    // No empty anchor sections: every id on the page is unique.
    const dupes = await page.evaluate(() => {
      const seen = new Map<string, number>();
      document.querySelectorAll('[id]').forEach((el) => seen.set(el.id, (seen.get(el.id) ?? 0) + 1));
      return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
    });
    expect(dupes).toEqual([]);

    const boxCount = await boxes.count();
    for (let i = 0; i < boxCount; i++) {
      const box = boxes.nth(i);
      const groupId = await box.getAttribute('data-goal-trigger');
      await box.scrollIntoViewIfNeeded();
      await box.click();

      const modal = page.locator('dialog#goal-modal[open]');
      await expect(modal).toBeVisible();
      const visiblePanels = modal.locator('[data-goal-panel]:not([hidden])');
      await expect(visiblePanels).toHaveCount(1);
      expect(await visiblePanels.first().getAttribute('data-goal-panel')).toBe(groupId);

      if (i === 0) {
        await modal.locator('[data-goal-modal-close]').click();
      } else if (i === 1) {
        await page.keyboard.press('Escape');
      } else {
        await page.mouse.move(5, 5);
        await page.mouse.down();
        await page.mouse.up();
      }
      await expect(page.locator('dialog#goal-modal[open]')).toHaveCount(0);
    }
  });

  test('Brands mobile footer stays single-row with no overflow at 390px', async ({ page, viewport }) => {
    if (viewport?.width !== 390) test.skip();
    await page.goto('./brands/');
    await page.waitForLoadState('networkidle');

    const metrics = await page.evaluate(() => {
      const footer = document.querySelector<HTMLElement>('.site-footer');
      const items = Array.from(document.querySelectorAll<HTMLElement>('.site-footer .socials li'));
      const ys = items.map((el) => Math.round(el.getBoundingClientRect().top));
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        socialCount: items.length,
        rowSpread: ys.length > 0 ? Math.max(...ys) - Math.min(...ys) : -1,
        footerHeight: footer ? footer.getBoundingClientRect().height : -1,
      };
    });

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
    expect(metrics.socialCount).toBe(7);
    expect(metrics.rowSpread).toBeLessThanOrEqual(2);
    expect(metrics.footerHeight).toBeLessThan(140);
  });

  test('What I Do pillar cards flip in place; the UGC back carries its two links', async ({ page }) => {
    await page.goto('./');
    const homepage = page.url();
    await expect(page.locator('main > :is(#goals, #latest, #explore)')).toHaveCount(0);
    const cards = page.locator('#services .flip-card');
    await expect(page.locator('#services .stat-value')).toHaveText(['Building in Public', 'Creator and Coffee Drinker', 'UGC']);
    for (let index = 0; index < 3; index++) {
      const toggle = cards.nth(index).locator('.flip-card-toggle');
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await toggle.click({ force: true });
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      expect(page.url()).toBe(homepage);
    }
    const actions = cards.nth(2).locator('.flip-action-btn');
    await expect(actions).toHaveText([/Send a product/, /Cohley profile/]);
    for (const action of await actions.all()) await expect(action).toHaveJSProperty('tabIndex', 0);
    await expect(actions.nth(0)).toHaveAttribute('href', /^mailto:/);
    await expect(actions.nth(1)).toHaveAttribute('href', 'https://connect.cohley.com/public/profile/andrew-baxter/');
  });

  test('Creator portrait, headline and story are available on the About page', async ({ page }) => {
    await page.goto('./about/');
    const about = page.locator('#about');
    await expect(about.locator('.about-portrait')).toBeVisible();
    await expect(about.locator('.about-headline')).toBeVisible();
    await expect(about.locator('.about-body')).toHaveText([
      /building three brands in public/i,
      /My workflow uses/i,
      /The through line is simple/i,
    ]);
    await expect(page.locator('#writing')).toHaveCount(0);
    await expect(page.locator('.press-bio')).toHaveCount(0);
    await expect(page.locator('#goals')).toHaveCount(0);
  });

  test('Links: a video loads nothing from YouTube until play, and unloads on close', async ({ page }) => {
    const embeds: string[] = [];
    page.on('request', (r) => { if (/youtube(-nocookie)?\.com\/embed\//.test(r.url())) embeds.push(r.url()); });
    await page.route('https://www.youtube-nocookie.com/embed/**', (route) => route.fulfill({ body: '' }));
    // The links hub's "From the build" cards are the player's triggers now.
    await page.goto('./links/');
    const player = page.locator('#video-player');
    const frame = player.locator('iframe');
    await expect(player).toBeHidden();
    await expect(frame).not.toHaveAttribute('src', /youtube/);
    expect(embeds).toEqual([]);
    const video = page.locator('[data-video-player][data-video-url]').first();
    await video.click();
    await expect(player).toBeVisible();
    await expect(frame).toHaveAttribute('src', /^https:\/\/www\.youtube-nocookie\.com\/embed\//);
    const src = await frame.getAttribute('src');
    expect(src).not.toMatch(/autoplay=1/);
    await expect(frame).toHaveAttribute('allow', /fullscreen/);
    await expect(frame).toBeInViewport();
    await player.getByRole('button', { name: 'Close video player' }).click();
    await expect(player).toBeHidden();
    await expect(frame).toHaveAttribute('src', 'about:blank');
  });

  test('Search: the nav button opens it, and the index loads under the base path', async ({ page, isMobile }) => {
    const index = page.waitForResponse((r) => r.url().endsWith('/hey-this-is-andrew/api/search.json'));
    await page.goto('./');
    if (isMobile) {
      // One search on a phone: inside the Menu, not beside it too.
      await expect(page.locator('#nav-search-trigger')).toBeHidden();
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

  test('About quote: cinematic serif, sentence case, responsive attribution', async ({ page, isMobile }) => {
    await page.goto('./about/');
    const q = page.locator('.quote-band--cinematic blockquote p');
    await expect(q).toHaveCSS('text-transform', 'none');
    await expect(q).toHaveCSS('font-family', /Cinzel/i);
    await expect(page.locator('.quote-band--cinematic cite')).toHaveCSS(
      'text-align',
      isMobile ? 'left' : 'center',
    );
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

  test('Brands dropdown & BE Unconventional HQ hub page', async ({ page, isMobile }) => {
    await page.goto('./');
    if (isMobile) {
      await page.locator('.menu-btn').click();
      const subLinks = page.locator('.mobile-sub-link');
      await expect(subLinks).toHaveCount(2);
      await subLinks.filter({ hasText: /BE Unconventional HQ/i }).click();
    } else {
      // 861px and 899px keep "Build in Public" on one line, so the nav is
      // as tall there as at 1099 (its height is padding plus the tallest
      // control; a wrapped link would add a line).
      await page.setViewportSize({ width: 1099, height: 844 });
      const baseNavH = await page.evaluate(() => Math.round(document.querySelector('.site-nav')!.getBoundingClientRect().height));
      for (const vw of [861, 899]) {
        await page.setViewportSize({ width: vw, height: 844 });
        const navMetrics = await page.evaluate(() => {
          const nav = document.querySelector<HTMLElement>('.site-nav')!;
          const bip = Array.from(document.querySelectorAll<HTMLElement>('.desktop-nav .nav-link')).find((el) =>
            el.textContent?.includes('Build in Public')
          )!;
          return {
            navH: Math.round(nav.getBoundingClientRect().height),
            bipH: Math.round(bip.getBoundingClientRect().height),
          };
        });
        expect(navMetrics.navH).toBe(baseNavH);
        expect(navMetrics.bipH).toBeLessThanOrEqual(45);
      }

      await page.setViewportSize({ width: 1440, height: 900 });
      const brandsItem = page.locator('.desktop-nav .nav-item').filter({ has: page.locator('.nav-link', { hasText: 'Brands' }) });
      const brandsMainLink = brandsItem.locator('.nav-link', { hasText: 'Brands' });

      // Keyboard ArrowDown opens dropdown; Escape closes it without reopening on focus return; ArrowDown reopens
      await brandsMainLink.focus();
      await page.keyboard.press('ArrowDown');
      await expect(brandsMainLink).toHaveAttribute('aria-expanded', 'true');
      await expect(brandsItem).toHaveClass(/\bis-open\b/);

      await page.keyboard.press('Escape');
      await expect(brandsMainLink).toHaveAttribute('aria-expanded', 'false');
      await expect(brandsItem).not.toHaveClass(/\bis-open\b/);
      await expect(brandsMainLink).toBeFocused();

      await page.keyboard.press('ArrowDown');
      await expect(brandsMainLink).toHaveAttribute('aria-expanded', 'true');

      const dropdownLinks = brandsItem.locator('.dropdown-link');
      await expect(dropdownLinks).toHaveCount(2);
      await dropdownLinks.filter({ hasText: /BE Unconventional HQ/i }).click();
    }
    await page.waitForURL('**/brands/be-unconventional-hq/');
    await expect(page.locator('#hq-hero-title')).toContainText(/Where nerd culture/i);

    // Verify hero title strict 2-line lockup across screen widths (line 1: Where nerd culture, line 2: gets cinematic)
    for (const w of [320, 390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width: w, height: 900 });
      const lines = await page.evaluate(() => {
        const title = document.querySelector<HTMLElement>('#hq-hero-title')!;
        const spans = Array.from(title.querySelectorAll<HTMLElement>('.hq-hero-line'));
        return {
          count: spans.length,
          line1Text: spans[0]?.textContent?.trim(),
          line2Text: spans[1]?.textContent?.trim(),
          line1Top: spans[0]?.offsetTop,
          line2Top: spans[1]?.offsetTop,
        };
      });
      expect(lines.count).toBe(2);
      expect(lines.line1Text?.toLowerCase()).toContain('where nerd culture');
      expect(lines.line2Text?.toLowerCase()).toContain('gets cinematic');
      expect(lines.line2Top).toBeGreaterThan(lines.line1Top!);
    }
    await page.setViewportSize({ width: 1440, height: 900 });

    // Current-page semantics: parent Brands link has .active without aria-current="page"; child HQ link has aria-current="page"
    const desktopBrandsLink = page.locator('.desktop-nav .nav-link', { hasText: 'Brands' });
    await expect(desktopBrandsLink).toHaveClass(/\bactive\b/);
    expect(await desktopBrandsLink.getAttribute('aria-current')).toBeNull();
    const desktopHqSubLink = page
      .locator('.desktop-nav .nav-item')
      .filter({ has: page.locator('.nav-link', { hasText: 'Brands' }) })
      .locator('.dropdown-link')
      .filter({ hasText: /BE Unconventional HQ/i });
    await expect(desktopHqSubLink).toHaveAttribute('aria-current', 'page');
    const mobileHqSubLink = page.locator('.mobile-sub-link').filter({ hasText: /BE Unconventional HQ/i });
    await expect(mobileHqSubLink).toHaveAttribute('aria-current', 'page');

    // Publication Section: Live latest content rendering
    const missionMedia = page.locator('#mission .hq-why-media');
    await expect(missionMedia).toHaveCount(2);
    const missionLinks = page.locator('#mission .hq-why-link');
    if ((await missionLinks.count()) === 2) {
      await expect(missionLinks.first()).toHaveAttribute('href', /beunconventionalhq\.com/);
      await expect(missionMedia.first().locator('.hq-why-badge')).toContainText(/Latest Article/i);
      await expect(missionMedia.nth(1).locator('.hq-why-badge')).toContainText(/Latest Video/i);
    }
    const missionSec = page.locator('#mission');
    await missionSec.scrollIntoViewIfNeeded();

    await page.setViewportSize({ width: 390, height: 844 });
    await missionSec.scrollIntoViewIfNeeded();
    await page.setViewportSize({ width: 1440, height: 900 });

    // Closer Press button (renamed from "Press inquiry" in 3f07156) routes to Collaborations
    const pressBtn = page.locator('#visit .hq-actions a', { hasText: /^\s*Press\b/i });
    await expect(pressBtn).toHaveAttribute('href', 'https://beunconventionalhq.com/collaborations');

    // Coverage Flip Cards on HQ Hub
    const coverageCards = page.locator('#coverage .hq-card');
    await expect(coverageCards).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      const card = coverageCards.nth(i);
      // Front face: no "Editorial" kicker, contains title
      await expect(card.locator('.hq-card-front .hq-card-kicker')).toHaveCount(0);
      await expect(card.locator('.hq-card-front .hq-card-title')).toBeVisible();
      // Back face contains line text
      await expect(card.locator('.hq-card-back .hq-card-back-line')).toBeAttached();
    }

    // Flip interaction on coverage card
    const firstCoverageCard = coverageCards.first();
    await firstCoverageCard.scrollIntoViewIfNeeded();
    await expect(firstCoverageCard).not.toHaveClass(/\bis-flipped\b/);
    await firstCoverageCard.click();
    await expect(firstCoverageCard).toHaveClass(/\bis-flipped\b/);
    await page.waitForTimeout(650);

    await page.keyboard.press('Escape');
    await expect(firstCoverageCard).not.toHaveClass(/\bis-flipped\b/);
    await page.waitForTimeout(650);

    await page.setViewportSize({ width: 390, height: 844 });
    await firstCoverageCard.scrollIntoViewIfNeeded();
    await firstCoverageCard.click();
    await expect(firstCoverageCard).toHaveClass(/\bis-flipped\b/);
    await page.waitForTimeout(650);
    await page.setViewportSize({ width: 1440, height: 900 });

    // Flip cards on HQ Hub
    const flipCards = page.locator('#pillars .flip-card');
    await expect(flipCards).toHaveCount(4);
    await flipCards.first().click();
    await expect(flipCards.first()).toHaveClass(/\bis-flipped\b/);

    // Reduced motion and inert dock at page top on HQ Hub
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(80);
    await expect(page.locator('.hq-dock-row--hero')).toHaveAttribute('inert', '');
    await page.evaluate(() => window.scrollTo(0, 140));
    await page.waitForTimeout(80);
    const hqHeroReduced = await page.evaluate(() => {
      const logo = document.querySelector<HTMLElement>('.hq-hero-logo')!;
      const inner = document.querySelector<HTMLElement>('.hq-hero-inner')!;
      return {
        logoOpacity: getComputedStyle(logo).opacity,
        logoTransform: getComputedStyle(logo).transform,
        innerOpacity: getComputedStyle(inner).opacity,
      };
    });
    expect(hqHeroReduced.logoOpacity).toBe('1');
    expect(hqHeroReduced.logoTransform).toBe('none');
    expect(hqHeroReduced.innerOpacity).toBe('1');
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
