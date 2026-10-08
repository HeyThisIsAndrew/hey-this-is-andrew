/*
  THE TAB ICON MUST BE ONE SAFARI CAN ACTUALLY DRAW.

  THE REPORT, WITH A SCREENSHOT
  iPad, Safari: press "See more on Instagram" in the carousel rail and the tab
  strip paints Instagram's glyph beside this site's own tab — our title, our
  URL, their icon — and it stays wrong until a full reload.

  WHAT IT IS NOT
  Not a metadata overwrite. Every Instagram link on the site carries
  `target="_blank" rel="noopener noreferrer"`, and the icon <link> set is
  byte-identical before and after the navigation. Both facts are asserted
  below, because "nothing is rewriting our head" is the claim that makes the
  legal worry go away and it should not rest on someone remembering it.

  WHAT IT IS
  Which icon Safari can USE. Safari's support for `rel="icon"` with
  `image/svg+xml` is unreliable on iOS/iPadOS: it accepts the declaration and
  may then fail to rasterise a tab icon from it. A tab with no icon it can
  paint keeps painting whatever it last resolved — and a `_blank` open to
  Instagram is how a foreign icon gets into that slot. A hard reload re-runs
  resolution, finds the .ico, and the crown returns. That is the reported
  behaviour exactly.

  So a raster icon must be declared BEFORE any SVG-only icon.

  WHAT THIS CAN AND CANNOT TEST
  There is no WebKit here and Chromium resolves either ordering correctly, so
  the iPad symptom is not reproducible in this sandbox. What is checkable — and
  what would catch the ordering being flipped back, or the .ico being dropped
  for being "redundant" — is the invariant itself: a usable raster icon comes
  first, and the whole set survives the navigations the bug was reported
  against.
*/
import { launchTestBrowser } from './e2e-browser.mjs';
import { startPreviewServer } from './e2e-server.mjs';
import assert from 'node:assert/strict';

const RASTER_TYPES = ['.ico', '.png'];

async function runTests() {
  console.log('Starting Astro preview server for Favicon E2E...');
  const { stop } = await startPreviewServer();

  console.log('Server is running. Launching Puppeteer...');
  const browser = await launchTestBrowser();
  let exitCode = 0;
  let passed = 0;
  const pass = (msg) => {
    console.log(`  ✓ ${msg}`);
    passed++;
  };

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 1366, hasTouch: true, isMobile: true });
    await page.goto('http://localhost:4321/', { waitUntil: 'networkidle2' });

    const readIcons = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')].map((l) => ({
          rel: l.getAttribute('rel'),
          type: l.getAttribute('type') || '',
          href: new URL(l.getAttribute('href'), location.href).pathname,
          sizes: l.getAttribute('sizes') || '',
        }))
      );

    const icons = await readIcons();

    /* ─── THE ORDERING INVARIANT — THE ACTUAL FIX ─────────────────────────── */

    const tabIcons = icons.filter((i) => i.rel.split(/\s+/).includes('icon'));
    assert.ok(
      tabIcons.length > 0,
      'No `rel="icon"` declared at all. Safari then has nothing of ours to ' +
        'paint in the tab strip and will keep whatever it last resolved — ' +
        'including the icon of a site opened from one of our _blank links.'
    );

    const firstRasterAt = tabIcons.findIndex((i) =>
      RASTER_TYPES.some((ext) => i.href.endsWith(ext))
    );
    const firstSvgAt = tabIcons.findIndex(
      (i) => i.type === 'image/svg+xml' || i.href.endsWith('.svg')
    );

    assert.notEqual(
      firstRasterAt,
      -1,
      'No raster `rel="icon"` (.ico/.png) is declared — only an SVG. Safari on ' +
        'iOS/iPadOS may accept an SVG icon declaration and still fail to ' +
        'rasterise a tab icon from it, leaving the tab painting a foreign ' +
        'icon inherited across a _blank navigation. Keep /favicon.ico.'
    );
    pass(`a raster tab icon is declared (${tabIcons[firstRasterAt].href})`);

    if (firstSvgAt !== -1) {
      assert.ok(
        firstRasterAt < firstSvgAt,
        `The SVG icon is declared BEFORE the raster one ` +
          `(svg at index ${firstSvgAt}, raster at ${firstRasterAt}). That is the ` +
          `reported iPad bug: pressing "See more on Instagram" leaves this ` +
          `site's tab showing Instagram's glyph until a hard reload. Declare ` +
          `/favicon.ico first — engines that really support SVG icons still ` +
          `prefer the SVG, and Safari lands on a bitmap it can definitely draw.`
      );
      pass('the raster icon is declared before the SVG (Safari-safe ordering)');
    }

    const raster = tabIcons[firstRasterAt];
    assert.notEqual(
      raster.sizes,
      '',
      `The raster icon ${raster.href} declares no \`sizes\`. Without it the ` +
        `icon algorithm has no dimensions to rank by, which is the ambiguity ` +
        `this ordering exists to remove.`
    );
    pass(`the raster icon declares sizes="${raster.sizes}"`);

    /* Every declared icon must actually be fetchable — a 404 is the same
       failure mode as declaring nothing at all. */
    for (const icon of icons) {
      const status = await page.evaluate(
        (href) => fetch(href, { method: 'GET' }).then((r) => r.status).catch(() => 0),
        icon.href
      );
      assert.equal(
        status,
        200,
        `${icon.href} (rel="${icon.rel}") returned ${status}. A declared icon ` +
          `that does not resolve leaves the tab with nothing of ours to paint.`
      );
    }
    pass(`all ${icons.length} declared icons resolve 200`);

    /* ─── NOTHING REWRITES OUR HEAD — THE "IS THIS A LEGAL PROBLEM" CLAIM ─── */

    const serialise = (list) =>
      list.map((i) => `${i.rel}|${i.type}|${i.href}|${i.sizes}`).join(' ~ ');
    const onLoad = serialise(icons);

    /*
      EVERY off-site link, not just Instagram.

      The report arrived as an Instagram bug and was very nearly fixed as one.
      Then: "it also occurred with the Threads and TikTok icon too… the links
      in the footer all need to be checked too." That is the observation that
      identified this correctly — the tab does not care WHOSE icon it kept, so
      auditing one destination proves nothing about the rest.

      So this sweeps every external link on every route rather than one host,
      and the sweep is what found three unrelated gaps that predate the
      Instagram report: the Amazon storefront on /links navigating in place
      while every sibling around it opened in a new tab, and the YouTube
      handle on the press kit and media kit carrying target="_blank" with no
      `rel` at all — an open reverse-tabnabbing handle on both.

      Links to our OWN production domain are exempt: they are written absolute
      but are not off-site, and forcing them into a new tab would be wrong.
    */
    const OWN_HOSTS = ['beunconventionalhq.com', 'www.beunconventionalhq.com'];
    const AUDIT_ROUTES = [
      '/', '/feed', '/intel', '/events', '/featured', '/about', '/links',
      '/collaborations', '/collaborations/press-kit', '/media-kit', '/privacy',
    ];

    let audited = 0;
    const offenders = [];

    for (const route of AUDIT_ROUTES) {
      const auditPage = await browser.newPage();
      await auditPage.setViewport({ width: 1024, height: 1366 });
      let reachable = true;
      try {
        const res = await auditPage.goto(`http://localhost:4321${route}`, {
          waitUntil: 'networkidle2',
          timeout: 30000,
        });
        if (!res || res.status() >= 400) reachable = false;
      } catch {
        reachable = false;
      }
      if (!reachable) {
        await auditPage.close();
        continue;
      }

      /* The carousel's "See more on Instagram" CTA — the element actually
         reported — is injected by script, so give it a beat to appear. */
      await new Promise((r) => setTimeout(r, 1200));

      const found = await auditPage.evaluate(
        (ownHosts) =>
          [...document.querySelectorAll('a[href]')]
            .map((a) => {
              let u;
              try {
                u = new URL(a.getAttribute('href'), location.href);
              } catch {
                return null;
              }
              if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
              if (u.host === location.host) return null;
              if (ownHosts.includes(u.host)) return null;
              return {
                host: u.host,
                target: a.getAttribute('target') || '',
                rel: a.getAttribute('rel') || '',
                label: (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 40),
              };
            })
            .filter(Boolean),
        OWN_HOSTS
      );

      for (const link of found) {
        audited++;
        const relOk = link.rel.includes('noopener') && link.rel.includes('noreferrer');
        if (link.target !== '_blank' || !relOk) {
          offenders.push(`${route} → ${link.host} [${link.label}] target="${link.target}" rel="${link.rel}"`);
        }
      }
      await auditPage.close();
    }

    assert.ok(
      audited > 50,
      `Only ${audited} external links were audited across ${AUDIT_ROUTES.length} ` +
        `routes. That is too few to be looking at the real surface — the ` +
        `carousel and footer alone should contribute far more. Did the pages ` +
        `fail to render?`
    );

    assert.equal(
      offenders.length,
      0,
      `${offenders.length} external link(s) are not \`target="_blank"\` with ` +
        `\`rel="noopener noreferrer"\`:\n    ${offenders.join('\n    ')}\n` +
        `  Without _blank the reader leaves the site in place, and coming back ` +
        `is a second way for the tab to end up holding a foreign icon. Without ` +
        `noopener+noreferrer the opened page keeps a handle on this document.`
    );
    pass(`all ${audited} external links across ${AUDIT_ROUTES.length} routes are _blank + noopener noreferrer`);

    /* Client-side navigation: ClientRouter swaps the <head>, so this is where
       the icon set could silently be lost. */
    await page.evaluate(() => {
      const link = document.querySelector('a[href="/feed"], a[href^="/feed"]');
      if (link) link.click();
      else location.href = '/feed';
    });
    await new Promise((r) => setTimeout(r, 1200));
    const afterNav = serialise(await readIcons());
    assert.equal(
      afterNav,
      onLoad,
      `The icon set changed across client-side navigation.\n  before: ${onLoad}\n  after:  ${afterNav}\n` +
        `ClientRouter swaps the document head; the icons must survive it.`
    );
    pass('the icon set survives client-side navigation');

    await page.goBack({ waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 800));
    const afterBack = serialise(await readIcons());
    assert.equal(
      afterBack,
      onLoad,
      `The icon set changed across back-navigation.\n  before: ${onLoad}\n  after:  ${afterBack}`
    );
    pass('the icon set survives back-navigation');

    console.log(`\n✅ Favicon E2E tests passed (${passed} checks).`);
  } catch (error) {
    console.error('\n❌ Favicon E2E failed:', error.message);
    exitCode = 1;
  } finally {
    await browser.close();
    stop();
    process.exit(exitCode);
  }
}

runTests();
