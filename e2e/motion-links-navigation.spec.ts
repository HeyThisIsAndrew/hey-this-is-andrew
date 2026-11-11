import { test, expect, type Page } from '@playwright/test';
const base = '/hey-this-is-andrew/';
async function navigateWithHeader(page: Page, name: string) {
  const menu = page.locator('.site-nav .menu-btn');
  if (await menu.isVisible()) {
    await menu.click();
    await page.locator('#mobile-menu').getByRole('link', {name, exact:true}).first().click();
  } else await page.locator('.desktop-nav').getByRole('link', {name, exact:true}).first().click();
  await page.waitForFunction(() => document.querySelector('main')?.getAttribute('data-chrome-wired') === '1');
}

for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 900 }, { width: 3840, height: 2160 }]) {
  test(`product grid has contained text and wider desktop cards at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(`${base}gear/`);
    await page.locator('[data-all-toggle]').click();
    const grid = page.locator('#gear-all-products');
    await expect(grid).toHaveAttribute('data-open', 'true');
    await expect(page.locator('#gear-decks-view')).toBeHidden();
    await expect(grid.locator('.all-grid-card:visible')).toHaveCount(45);
    const results = await grid.locator('.all-grid-card').evaluateAll(cards => cards.map(card => {
      const outer = card.getBoundingClientRect();
      return { ratio: outer.width / outer.height, width: outer.width, issues: Array.from(card.querySelectorAll('.all-card-name, .all-card-spec, .all-card-type, .all-card-cta')).filter(el => { const r = el.getBoundingClientRect(); return r.left < outer.left - 1 || r.right > outer.right + 1 || r.bottom > outer.bottom + 1 || el.scrollWidth > el.clientWidth + 1; }).map(el => el.textContent) };
    }));
    expect(results.flatMap(card => card.issues)).toEqual([]);
    if (viewport.width >= 1100) {
      expect(results.every(card => card.ratio > 1.1)).toBe(true);
      const columns = await grid.locator('.all-grid-cards').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
      expect(columns).toBeLessThanOrEqual(3);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
}

test('gear collapse finishes smoothly without the padded-height pause or delayed snap', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto(`${base}gear/`);
  const samples = await page.locator('#gear-bodies').evaluate(async section => {
    const body = section.querySelector<HTMLElement>('.gear-accordion-body')!;
    const deck = section.querySelector('.gear-deck')!;
    const glow = section.querySelector('.deck-glow')!;
    const containedGlow = glow.getBoundingClientRect().top >= deck.getBoundingClientRect().top - 1 && getComputedStyle(deck).overflow === 'clip';
    section.querySelector<HTMLButtonElement>('.gear-accordion-header')!.click();
    const values: {time:number;height:number}[] = [];
    const start = performance.now();
    await new Promise<void>(resolve => {
      const frame = () => { values.push({time:performance.now()-start,height:body.getBoundingClientRect().height}); if(performance.now()-start < 600) requestAnimationFrame(frame); else resolve(); }; requestAnimationFrame(frame);
    });
    return {containedGlow, values};
  });
  expect(samples.containedGlow).toBe(true);
  expect(samples.values.at(-1)!.height).toBeLessThanOrEqual(1.1);
  const tail = samples.values.filter(sample => sample.time > 330);
  expect(Math.max(...tail.map(sample => sample.height)) - Math.min(...tail.map(sample => sample.height))).toBeLessThan(8);
  await page.locator('#gear-lenses .gear-accordion-header').click();
  await expect(page.locator('#gear-lenses')).toHaveClass(/is-settled/);
  await page.locator('#gear-lenses .gear-accordion-header').evaluate(el => { (el as HTMLButtonElement).click(); (el as HTMLButtonElement).click(); });
  await expect(page.locator('#gear-lenses .gear-accordion-body')).toHaveAttribute('data-open','true');
  await expect(page.locator('#gear-lenses')).toHaveClass(/is-settled/);
});

for (const width of [390, 1440]) {
  test(`links identity, shared social icons and accessible QR dialog at ${width}`, async ({ page }) => {
    await page.setViewportSize({width,height:900});
    const requests: string[] = [];
    page.on('request', request => requests.push(request.url()));
    await page.goto(`${base}links/`);
    await expect(page.locator('h1')).toHaveCount(0);
    await expect(page.locator('#scroll-progress')).toHaveCount(0);
    await expect(page.locator('.links-profile img[alt="HEY_THISISANDREW"]')).toHaveAttribute('src', /hey-thisisandrew\..*\.png/);
    await expect(page.locator('img[alt="HEY_THISISANDREW"]')).toHaveCount(1);
    await expect(page.locator('.links-actions a')).toHaveCount(1);
    await expect(page.locator('.links-actions a')).toHaveText(/Explore the full site/);
    await expect(page.locator('.links-socials a')).toHaveCount(7);
    await expect(page.locator('.links-socials svg')).toHaveCount(7);
    await expect(page.locator('a[href^="mailto:"]:not(dialog a)')).toHaveCount(0);
    await expect(page.locator('.links-content-grid .latest-card')).toHaveCount(2);
    await expect(page.locator('a[href$="rss.xml"]')).toHaveCount(0);
    const trigger=page.getByRole('button',{name:'Open my links QR code'});
    await trigger.click();
    const dialog=page.getByRole('dialog',{name:'Keep in touch'});
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.qr-code svg')).toBeVisible();
    await expect(dialog.getByRole('link',{name:'Open my links'})).toHaveAttribute('href','https://heythisisandrew.github.io/hey-this-is-andrew/links/');
    await expect(dialog.getByRole('link',{name:'Contact'})).toHaveAttribute('href','mailto:heythisisandrewb@gmail.com');
    await expect(dialog.locator('img')).toHaveCount(0);
    // Opening focuses the dialog, never the X, so no square is drawn round it.
    await expect(dialog.getByRole('button',{name:'Close QR code'})).not.toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await dialog.getByRole('button',{name:'Close QR code'}).click();
    await expect(dialog).toBeHidden();
    expect(requests.some(url=>url.includes('api.qrserver.com'))).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test(`router keeps menus, gear and brand navigation working on repeat visits at ${width}`, async ({ page }) => {
    await page.setViewportSize({width,height:900});
    await page.goto(`${base}gear/`);
    await page.evaluate(()=>{(window as any).__navigationIdentity='same-document';});
    for (let round=0;round<2;round++) {
      await navigateWithHeader(page,'Brands');
      await expect(page).toHaveURL(`${base}brands/`);
      await expect(page.getByRole('heading',{level:1,name:'Brands',exact:true})).toBeVisible();
      await expect(page.locator('.brand-tile')).toHaveCount(3);
      await expect(page.locator('.brand-tile[href]')).toHaveCount(2);
      await expect(page.locator('[data-bacc]')).toHaveCount(0);
      await page.getByRole('link',{name:'Explore BE Unconventional HQ',exact:true}).click();
      await expect(page).toHaveURL(`${base}brands/be-unconventional-hq/`);
      await navigateWithHeader(page,'Gear');
      await expect(page).toHaveURL(`${base}gear/`);
      await page.locator('#gear-search-input').fill('90mm');
      await expect(page.locator('#gear-lenses .deck-card.active .card-title')).toContainText('90mm');
      await page.locator('#gear-search-clear').click();
      expect(await page.evaluate(()=>(window as any).__navigationIdentity)).toBe('same-document');
    }
    await navigateWithHeader(page,'Home');
    await expect(page.locator('[data-bacc]')).toHaveAttribute('data-ready','1');
    const last=page.locator('[data-bacc-trigger]').last();
    await last.click();
    await expect(last).toHaveAttribute('aria-expanded','true');
    await expect(page.locator('.photo-wall')).toHaveAttribute('data-elevator-wired','1');
    expect(await page.evaluate(()=>(window as any).__navigationIdentity)).toBe('same-document');
  });
}

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`view history closes locally and page history still navigates with ${reducedMotion} motion`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await page.goto(base);
    await page.evaluate(() => { (window as any).__homeRoot = document.querySelector('main'); });
    const viewport = page.locator('[data-bacc-viewport]');
    await page.locator('[data-bacc-panel]').first().locator('.bacc-primary-btn').click();
    await expect(viewport).toHaveClass(/is-zoomed/);
    await page.evaluate(() => history.back());
    await expect(viewport).not.toHaveClass(/is-zoomed/);
    expect(await page.evaluate(() => (window as any).__homeRoot === document.querySelector('main'))).toBe(true);
    await page.locator('.photo-wall').scrollIntoViewIfNeeded();
    await page.locator('.photo-item').first().evaluate((el: HTMLElement) => el.click());
    await expect(page.locator('html')).toHaveClass(/photo-zoom-open/);
    await page.keyboard.press('Escape');
    await expect(page.locator('html')).not.toHaveClass(/photo-zoom-open/);
    expect(await page.evaluate(() => (window as any).__homeRoot === document.querySelector('main'))).toBe(true);
    await navigateWithHeader(page, 'Gear');
    await expect(page).toHaveURL(`${base}gear/`);
    await page.evaluate(() => history.back());
    await expect(page).toHaveURL(base);
    await expect(page.locator('[data-bacc]')).toBeVisible();
  });
}
