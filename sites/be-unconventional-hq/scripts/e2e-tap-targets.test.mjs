/**
 * A tap on a card's IMAGE does what the card does.
 *
 * ─── THE BUG THIS GUARDS ──────────────────────────────────────────────────
 * From a user test: readers tapped the artwork of a story, a video or a hero,
 * expecting to open it, and nothing happened; only a small text link worked.
 * One tester tapped the image again and again before hunting for the link.
 * Measured on the built site before the fix, on a phone and on desktop:
 * the homepage hero's article panels, the Featured lead video, the Featured
 * show logo, the Inside HQ portrait, the /feed hub banner, the /feed, hub and
 * event stage panes, the /events hero and the /about founder photo were all
 * dead to a tap; and the hero's pause/play control was UNDER the open panel
 * on a phone, so pressing it started the video instead.
 *
 * ─── HOW IT TESTS ─────────────────────────────────────────────────────────
 * BEHAVIOUR, not markup. A static probe (does elementFromPoint land in an
 * <a> or <button>?) reported the Featured lead card, which is played by a
 * click handler on the card, as dead when it was not, and could not tell a
 * client-side navigation from nothing. So each check really clicks (a touch
 * tap on the phone viewport) and records what happened:
 *   nav     a navigation was requested (a real one, or Astro's ClientRouter,
 *           which fetches instead of navigating; both are caught and stopped)
 *   tab     a new tab opened (the Instagram tiles are outbound)
 *   play    a YouTube frame appeared or changed its src, or the modal opened
 *   state   something on the card changed (a rail promoting its item)
 *   nothing none of the above
 * External hosts are stubbed, so YouTube's API never loads and the Featured
 * lead card exercises its fallback (the video modal). That is deliberate: it
 * is the path that used to do nothing, and it is deterministic.
 *
 * Owner decisions this encodes (2026-09): a video card's image plays like its
 * play button; the author portraits link to /author; a page's OWN hero
 * backdrop stays inert (the /about publication logo below).
 *
 * Pages whose content changes (which event, which hub) are resolved from the
 * build, and a check whose card is not on today's page is reported as
 * skipped, never passed silently and never failed.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchTestBrowser } from './e2e-browser.mjs';
import { startPreviewServer } from './e2e-server.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist/client');
const BASE = 'http://localhost:4321';

const PHONE = { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 };
const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 1 };

/** The first built page under `dir` whose HTML contains `needle`. */
function findPage(dir, needle) {
  const base = path.join(DIST, dir);
  if (!fs.existsSync(base)) return null;
  for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(base, entry.name, 'index.html');
    if (fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes(needle)) return `/${dir}/${entry.name}`;
  }
  return null;
}

const openHeroPanel = (kind) => `(() => {
  const panels = [...document.querySelectorAll('[data-acc-panel]')];
  const i = panels.findIndex((p) => ${kind === 'video' ? '' : '!'}p.querySelector('.acc-play-overlay'));
  if (i < 0) return false;
  document.querySelectorAll('[data-acc-trigger]')[i].click();
  return true;
})()`;
const pickRailCard = `(() => { const c = document.querySelector('.hub-rail-card'); if (!c) return false; c.click(); scrollTo({ top: 0, behavior: 'instant' }); return true; })()`;

const EVENT = findPage('events', 'class="hub-rail-card');
const HUB = findPage('featured', 'class="hub-rail-card');

const CHECKS = [
  // Homepage
  { name: 'hero article panel: its art opens the article', route: '/', setup: openHeroPanel('article'), target: '[data-acc-panel].is-open .acc-media', at: [0.5, 0.35], expect: ['nav'] },
  { name: 'hero article panel: its deck opens the article', route: '/', setup: openHeroPanel('article'), target: '[data-acc-panel].is-open .acc-deck', at: [0.5, 0.5], expect: ['nav'] },
  { name: 'hero video panel: its art plays', route: '/', setup: openHeroPanel('video'), target: '[data-acc-panel].is-open .acc-media', at: [0.5, 0.35], expect: ['play'] },
  { name: 'hero pause/play control is on top (not the panel under it)', route: '/', target: '.acc-toggle:not([hidden])', at: [0.5, 0.5], expect: ['state'] },
  { name: 'spotlight banner art', route: '/', target: '.spotlight--banner .spotlight-slide.is-current', at: [0.5, 0.5], expect: ['nav'] },
  { name: 'Intel feature image', route: '/', target: '.intel-spread .intel-feature-image', at: [0.5, 0.5], expect: ['nav'] },
  { name: 'Featured show logo', route: '/', target: '.fw-logo', at: [0.5, 0.5], expect: ['nav'] },
  { name: 'Featured lead video: image plays', route: '/', target: '.featured-highlights .fh-hero-card.active .content-card-media', at: [0.3, 0.3], expect: ['play'] },
  { name: 'Featured lead video: title plays', route: '/', target: '.featured-highlights .fh-hero-card.active .content-card-title', at: [0.5, 0.5], expect: ['play'] },
  { name: 'Inside HQ portrait opens the author page', route: '/', target: '.ihq-photo', at: [0.5, 0.5], expect: ['nav'] },
  { name: 'Watching rail card image plays', route: '/', target: '.watching .content-card-media', at: [0.5, 0.5], expect: ['play'] },
  { name: 'Instagram tile opens the post', route: '/', target: '.ig-carousel-tile', at: [0.5, 0.5], expect: ['tab'] },
  // /feed
  { name: '/feed stage pane runs its control', route: '/feed', target: '.hub-stage-item.active .hub-stage-item-still', at: [0.5, 0.35], expect: ['play', 'nav'] },
  { name: '/feed hub banner art opens the hub', route: '/feed', target: '.feed-row-banner-art', at: [0.5, 0.4], expect: ['nav'] },
  { name: '/feed hub banner logo opens the hub', route: '/feed', target: '.feed-row-banner-logo', at: [0.5, 0.5], expect: ['nav'] },
  { name: '/feed card image (promotes into the stage)', route: '/feed', target: '.video-card-home.variant-default .content-card-media', at: [0.5, 0.5], expect: ['play', 'nav', 'state'] },
  // Other hubs of cards
  { name: '/intel feature image', route: '/intel', target: '.intel-feature-image', at: [0.5, 0.5], expect: ['nav'] },
  { name: '/intel card image', route: '/intel', target: '.video-card-home .content-card-media', at: [0.5, 0.5], expect: ['play', 'nav'] },
  { name: '/featured deck card art', route: '/featured', target: '.deck-card-image', at: [0.5, 0.5], expect: ['nav'] },
  { name: '/events hero art opens the event', route: '/events', target: '.event-hero--index', at: [0.75, 0.4], expect: ['nav'] },
  { name: 'event page stage pane runs its control', route: EVENT, setup: pickRailCard, target: '.hub-stage-item.active .hub-stage-item-still', at: [0.5, 0.35], expect: ['nav', 'play'] },
  { name: 'hub page stage pane runs its control', route: HUB, setup: pickRailCard, target: '.hub-stage-item.active .hub-stage-item-still', at: [0.5, 0.35], expect: ['nav', 'play'] },
  { name: 'author page card image', route: '/author/andrew-baxter', target: '.video-card-home .content-card-media', at: [0.5, 0.5], expect: ['play', 'nav'] },
  { name: '/about founder photo opens the author page', route: '/about', target: '.founder-img', allowHidden: true, at: [0.5, 0.5], expect: ['nav'] },
  // Deliberately inert (owner's call): the page's own hero.
  { name: '/about publication logo stays inert (the page\'s own hero)', route: '/about', target: '.about-profile-img', at: [0.5, 0.5], expect: ['nothing'] },
];

async function runCheck(browser, viewport, check) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.setRequestInterception(true);
  let navigation = null;
  let armed = false;
  page.on('request', (request) => {
    const url = request.url();
    if (armed && request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      navigation = url;
      return request.abort();
    }
    if (!url.startsWith(BASE)) return request.respond({ status: 204, body: '' });
    return request.continue();
  });
  let tab = null;
  const onTarget = (target) => { if (target.opener() === page.target()) tab = target.url() || 'about:blank'; };
  browser.on('targetcreated', onTarget);

  try {
    await page.goto(BASE + check.route, { waitUntil: 'load', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 400));
    // Render everything once (content-visibility sections, scroll reveals).
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += 600) {
        scrollTo({ top: y, behavior: 'instant' });
        await new Promise((r) => setTimeout(r, 30));
      }
      scrollTo({ top: 0, behavior: 'instant' });
    });
    if (check.setup) {
      const ok = await page.evaluate(check.setup);
      if (!ok) return { result: 'SKIP', note: 'setup found nothing to open on this page today' };
      await new Promise((r) => setTimeout(r, 1100));
    }
    const box = await page.evaluate(async (selector, allowHidden) => {
      for (const el of document.querySelectorAll(selector)) {
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || el.closest('[inert]')) continue;
        // Loop clones are aria-hidden + tabindex=-1 wrappers; skip them unless
        // the check targets an image inside a deliberate aria-hidden tap link.
        if (!allowHidden && el.closest('[aria-hidden="true"][tabindex="-1"]')) continue;
        el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
        await new Promise((r) => setTimeout(r, 250));
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        if (r.width > 20 && r.height > 12 && cx > 0 && cx < innerWidth && cy > 0 && cy < innerHeight) {
          return { x: r.left, y: r.top, w: r.width, h: r.height };
        }
      }
      return null;
    }, check.target, Boolean(check.allowHidden));
    if (!box) return { result: 'SKIP', note: `no visible ${check.target} on this page today` };

    const x = box.x + box.w * check.at[0];
    const y = box.y + box.h * check.at[1];
    const hit = await page.evaluate((x, y) => {
      const h = document.elementFromPoint(x, y);
      return h ? h.tagName.toLowerCase() + (typeof h.className === 'string' && h.className ? '.' + h.className.split(' ').filter(Boolean)[0] : '') : 'none';
    }, x, y);

    await page.evaluate(() => {
      const w = window;
      w.__tapNav = null;
      if (!w.__tapNavHook) {
        w.__tapNavHook = true;
        document.addEventListener('astro:before-preparation', (e) => { w.__tapNav = e.to.href; e.preventDefault(); });
      }
      w.__tapFrames = document.querySelectorAll('iframe').length;
      w.__tapSrcs = [...document.querySelectorAll('iframe')].map((f) => f.src).join('|');
      w.__tapMutations = 0;
      new MutationObserver((m) => { w.__tapMutations += m.length; }).observe(document.body, {
        subtree: true, childList: true, attributes: true,
        attributeFilter: ['class', 'open', 'aria-expanded', 'aria-hidden', 'hidden', 'aria-label'],
      });
    });

    armed = true;
    if (viewport.hasTouch) await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);
    await new Promise((r) => setTimeout(r, 900));
    armed = false;

    const after = await page.evaluate(() => {
      const frames = [...document.querySelectorAll('iframe')];
      const srcs = frames.map((f) => f.src).join('|');
      return {
        nav: window.__tapNav,
        newFrame: frames.length > window.__tapFrames,
        srcChanged: srcs !== window.__tapSrcs && frames.some((f) => /youtube/.test(f.src)),
        modal: Boolean(document.querySelector('#video-modal.active')),
        mutations: window.__tapMutations,
      };
    });
    let result = 'nothing';
    if (navigation || after.nav) result = 'nav';
    else if (tab) result = 'tab';
    else if (after.newFrame || after.srcChanged || after.modal) result = 'play';
    else if (after.mutations > 0) result = 'state';
    return { result, note: `${navigation || after.nav || tab || ''} [hit ${hit}]`.trim() };
  } finally {
    browser.off('targetcreated', onTarget);
    await page.close();
  }
}

async function runTests() {
  const { stop } = await startPreviewServer();
  const browser = await launchTestBrowser();
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let exitCode = 0;
  try {
    for (const [label, viewport] of [['phone', PHONE], ['desktop', DESKTOP]]) {
      console.log(`\nTap targets, ${label} (${viewport.width}x${viewport.height})`);
      for (const check of CHECKS) {
        if (!check.route) {
          skipped++;
          console.log(`  - ${check.name}: skipped, no such page in this build`);
          continue;
        }
        const { result, note } = await runCheck(browser, viewport, check);
        if (result === 'SKIP') {
          skipped++;
          console.log(`  - ${check.name}: skipped (${note})`);
          continue;
        }
        try {
          assert.ok(check.expect.includes(result), `expected ${check.expect.join(' or ')}, got ${result}`);
          passed++;
          console.log(`  ✓ ${check.name} -> ${result} ${note}`);
        } catch (error) {
          failed++;
          console.error(`  ✗ ${check.name} (${check.route})\n      ${error.message} ${note}`);
        }
      }
    }
    console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed, ${skipped} skipped.`);
    if (failed > 0) exitCode = 1;
  } catch (error) {
    console.error('❌ E2E Test Failed:', error);
    exitCode = 1;
  } finally {
    await browser.close();
    stop();
    process.exit(exitCode);
  }
}

runTests();
