import { launchTestBrowser } from './e2e-browser.mjs';
import { startPreviewServer } from './e2e-server.mjs';
import assert from 'node:assert/strict';

// Helper to start the server, wait for it to be ready, run tests, and kill it.
async function runTests() {
  console.log('Starting Astro preview server...');
  const { stop } = await startPreviewServer();

  console.log('Server is running. Launching Puppeteer...');
  const browser = await launchTestBrowser();
  let exitCode = 0;

  try {
    const page = await browser.newPage();
    
    // We assume there's at least one featured slug and event slug.
    // To make it robust, we'll navigate to /events, click the first event, and test there.


    console.log('Navigating to /featured to find a featured detail page...');
    await page.goto('http://localhost:4321/featured');
    await page.waitForSelector('a[href^="/featured/"]', { timeout: 3000 }).catch(() => {});
    const featuredLink = await page.$('a[href^="/featured/"]');
    if (!featuredLink) {
      throw new Error('Production data missing: No featured collections found on /featured. E2E tests require at least one valid featured fixture.');
    }
    const featuredHref = await page.evaluate(el => el.href, featuredLink);
    console.log(`Testing featured page: ${featuredHref}`);
    await page.goto(featuredHref);
    await testFilterInteractions(page, 'Featured Detail');

    await testDeepLinkFromEvent(page);

    console.log('✅ All E2E filter tests passed.');
  } catch (error) {
    console.error('❌ E2E Test Failed:', error);
    exitCode = 1;
  } finally {
    await browser.close();
    stop();
    process.exit(exitCode);
  }
}

/*
  ─── EVERY QUERY BELOW IS SCOPED, AND THAT IS THE POINT ───────────────────

  This file used to read `.content-card` and `.filter-btn` across the whole
  document, which is the same mistake the handler it tests once made. A hub
  with an Upcoming Events section renders <EventCard/> as `.content-card`
  with NO data-type, so "only articles should be visible" would have failed
  on a card the filter is not supposed to touch, and reported a bug that
  wasn't there. The hub page that happens to sort first on /featured has no
  upcoming events today, so it passed by luck.

  `[data-coverage="hub"]` is the section the filters own. Anything outside it
  is checked separately, and the check is that it was left ALONE.
*/
const SCOPE = '[data-coverage="hub"]';

/*
  ─── WAIT FOR THE FILTER, DO NOT GUESS HOW LONG IT TAKES ────────────────────

  Every assertion below used to follow `setTimeout(r, 100)`. That was written
  when the filter set `display` synchronously. It does not any more: hiding a
  card fades it over FADE_MS (180ms) and only removes it from the layout once
  it is invisible, which is the behaviour the owner asked for.

  So the sleep was 100ms against a change that cannot complete in under 180ms —
  a guaranteed failure rather than a flaky one, which is why CI had been red on
  this suite across every run including a docs-only commit.

  Waiting on the CONDITION instead of on a duration fixes it for good and
  decouples the test from FADE_MS: retune the animation and this still passes.
*/
async function waitForFilter(page, scope, expectedType) {
  await page.waitForFunction(
    (sel, type) => {
      const cards = [...document.querySelectorAll(`${sel} .content-card`)];
      if (cards.length === 0) return false;
      const visible = cards.filter((el) => el.style.display !== 'none');
      /* Settled means: every visible card matches, and the ones that do not
         have actually left the layout rather than merely started fading. */
      return visible.length > 0 && visible.every((el) => el.getAttribute('data-type') === type);
    },
    { timeout: 5000 },
    scope,
    expectedType,
  );
}

async function testFilterInteractions(page, contextName) {
  // Check if page has content
  const emptyState = await page.$('.empty-state');
  if (emptyState) {
    console.log(`⚠️  Notice: ${contextName} page has no content (showing "coming soon"). Skipping filter tests for this page.`);
    return;
  }

  // Wait for the filters to be present and hydrated in the DOM
  await page.waitForSelector(`${SCOPE} .filter-btn[data-bound="true"]`, { timeout: 5000 });

  // Get the coverage grid's cards — not the page's.
  const cards = await page.$$(`${SCOPE} .content-card`);
  console.log(`[${contextName}] Found ${cards.length} content cards.`);

  /*
    Cards OUTSIDE the coverage section, counted before anything is clicked.
    Upcoming Events lives here. The filter must not move this number.
  */
  const outsideBefore = await page.$$eval('.content-card', (els, scope) =>
    els.filter(el => !el.closest(scope)).length, SCOPE);

  if (cards.length === 0) {
    throw new Error(`[${contextName}] Expected to find .content-card elements, found 0.`);
  }

  // Find filter buttons
  const articleBtn = await page.$(`${SCOPE} .filter-btn[data-filter="article"]`);
  const videoBtn = await page.$(`${SCOPE} .filter-btn[data-filter="video"]`);
  
  assert.ok(articleBtn, `[${contextName}] Article filter button not found`);
  assert.ok(videoBtn, `[${contextName}] Video filter button not found`);

  // Test: Click Article Filter
  await page.evaluate(btn => btn.click(), articleBtn);
  await waitForFilter(page, SCOPE, 'article');
  
  let isArticleBtnActive = await page.evaluate(el => el.classList.contains('active'), articleBtn);
  assert.equal(isArticleBtnActive, true, `[${contextName}] Article button should be active`);
  
  // Verify visibility
  const visibleCardsAfterArticleClick = await page.$$eval(`${SCOPE} .content-card`, els =>
    els.filter(el => el.style.display !== 'none').map(el => el.getAttribute('data-type'))
  );
  
  const hasInvalidArticleTypes = visibleCardsAfterArticleClick.some(t => t !== 'article');
  assert.equal(hasInvalidArticleTypes, false, `[${contextName}] Only articles should be visible`);

  // Test: Click Video Filter
  await page.evaluate(btn => btn.click(), videoBtn);
  await waitForFilter(page, SCOPE, 'video');
  
  let isVideoBtnActive = await page.evaluate(el => el.classList.contains('active'), videoBtn);
  assert.equal(isVideoBtnActive, true, `[${contextName}] Video button should be active`);
  
  // Verify visibility
  const visibleCardsAfterVideoClick = await page.$$eval(`${SCOPE} .content-card`, els =>
    els.filter(el => el.style.display !== 'none').map(el => el.getAttribute('data-type'))
  );

  /*
    The reported bug, as an assertion: pressing a filter emptied a section
    that had nothing to do with it.
  */
  const outsideDuring = await page.$$eval('.content-card', (els, scope) =>
    els.filter(el => !el.closest(scope) && el.style.display !== 'none').length, SCOPE);
  assert.equal(outsideDuring, outsideBefore,
    `[${contextName}] the filter hid ${outsideBefore - outsideDuring} card(s) outside the coverage section`);
  
  const hasInvalidVideoTypes = visibleCardsAfterVideoClick.some(t => t !== 'video');
  assert.equal(hasInvalidVideoTypes, false, `[${contextName}] Only videos should be visible`);

  // Click again to unfilter (all)
  await page.evaluate(btn => btn.click(), videoBtn);
  /* Showing is the faster path — `display` is restored immediately and the
     fade-in happens on the next frame — but it is still not synchronous, so
     this waits for the count rather than assuming a frame has passed. */
  await page.waitForFunction(
    (sel, total) =>
      [...document.querySelectorAll(`${sel} .content-card`)].filter((el) => el.style.display !== 'none').length === total,
    { timeout: 5000 },
    SCOPE,
    cards.length,
  );

  isVideoBtnActive = await page.evaluate(el => el.classList.contains('active'), videoBtn);
  assert.equal(isVideoBtnActive, false, `[${contextName}] Video button should toggle off`);
  
  const visibleCardsAfterToggleOff = await page.$$eval(`${SCOPE} .content-card`, els =>
    els.filter(el => el.style.display !== 'none').length
  );
  assert.equal(visibleCardsAfterToggleOff, cards.length, `[${contextName}] All cards should be visible again`);
  
  console.log(`  ✓ ${contextName} interactions verified`);
}

/*
  ─── THE DEEP LINK, WALKED THE WAY IT WAS REPORTED ────────────────────────

  "Scroll down to the featured associate page for marvel and click the link
  to deep link to the marvel featured page / Scroll down to filters button
  and tap article or video / Observe the tiles break and the filter buttons
  can not be deselected."

  The cause was ClientRouter: it does not unload a page's module on
  navigation, so the event page's filter handler kept running on the hub and
  fought the hub's own. A fresh page.goto CANNOT catch that — the bug only
  exists when both modules are alive at once, which needs a real client-side
  navigation. So this clicks through rather than navigating.
*/
async function testDeepLinkFromEvent(page) {
  console.log('Walking an event -> franchise hub deep link...');
  await page.goto('http://localhost:4321/events');
  const eventHrefs = await page.evaluate(() =>
    [...new Set(Array.from(document.querySelectorAll('a[href^="/events/"]'))
      .map(a => a.getAttribute('href'))
      .filter(h => h && h !== '/events' && h !== '/events/' && !h.startsWith('/events/archive')))]);
  if (eventHrefs.length === 0) {
    console.log('⚠️  Notice: no event detail pages found. Skipping the deep-link case.');
    return;
  }

  /*
    Only SOME events name a franchise hub, so take the first one that does
    rather than the first one listed. Picking blindly made this case skip
    itself on whichever event happened to sort first.
  */
  let eventHref = null;
  let hubHref = null;
  for (const href of eventHrefs) {
    await page.goto(`http://localhost:4321${href}`);
    const found = await page.evaluate(() =>
      document.querySelector('a[href^="/featured/"]')?.getAttribute('href') ?? null);
    if (found) { eventHref = href; hubHref = found; break; }
  }
  if (!hubHref) {
    console.log(`⚠️  Notice: no event links to a franchise hub (${eventHrefs.length} checked). Skipping the deep-link case.`);
    return;
  }
  console.log(`  deep link: ${eventHref} -> ${hubHref}`);

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {}),
    page.evaluate(() => document.querySelector('a[href^="/featured/"]').click()),
  ]);
  await new Promise(r => setTimeout(r, 500));

  const landed = await page.evaluate(() => window.location.pathname);
  assert.ok(landed.startsWith('/featured/'),
    `Deep link went to ${landed} instead of the franchise hub`);

  const hasFilters = await page.$(`${SCOPE} .filter-btn`);
  if (!hasFilters) {
    console.log(`  ✓ deep link reached ${landed}; it renders no filter row, so there is nothing to hijack`);
    return;
  }
  await testFilterInteractions(page, `Deep-linked hub (${landed})`);
}

runTests();
