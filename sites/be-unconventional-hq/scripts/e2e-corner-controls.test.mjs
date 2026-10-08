/*
  THE TOP-RIGHT CORNER CONTROLS MUST BE FORGIVING TO PRESS.

  WHAT WAS REPORTED
  iPhone, landscape: "scroll down until the nav bar appears — both the
  hamburger and the X are difficult to press", and "this is happening for any
  area where the X button is present."

  WHY THOSE ARE ONE BUG
  The hamburger, the X it becomes, the category overlay's close and the video
  modal's close are the same control in three costumes, and they shared two
  properties:

    1. EXACTLY 44×44 — Apple's minimum, with no margin for error.
    2. All in the TOP-RIGHT CORNER. In landscape that corner is cut by the
       display's rounded corner, and on a notched iPhone a downward swipe
       there opens Control Centre — so iOS is watching the same strip for a
       system gesture while the page waits for a tap. The failure that
       produces is an unreliable button, not a dead one, which is how it was
       reported.

  WHAT THIS CAN AND CANNOT TEST
  Chromium hit-tests these correctly and reports env(safe-area-inset-*) as 0,
  so it CANNOT reproduce the iOS behaviour — measured 100% reachable at every
  landscape size before the fix, while the reader could not press the button.
  Testing the symptom is therefore not available.

  So this asserts the property that makes the symptom survivable, and which IS
  measurable anywhere: each control's effective hit area — the pseudo-element
  expansion included — must be comfortably larger than the bare minimum, and
  must grow DOWN and INWARD rather than toward the screen edges, since
  expanding into the corner would push the target further into the strip iOS
  is contending for.

  It also pins the thing that is easy to break while "tidying": the close
  buttons must keep their own positioning. An earlier draft of the fix added
  `position: relative` to all three selectors, which would have reset
  `.modal-close` and `.close-fullscreen-btn` out of their corners entirely —
  a11y.css is imported last, so it wins.
*/
import { launchTestBrowser } from './e2e-browser.mjs';
import { startPreviewServer } from './e2e-server.mjs';
import assert from 'node:assert/strict';

const VIEWPORTS = [
  { width: 956, height: 440, label: 'iPhone 17 Pro Max landscape' },
  { width: 844, height: 390, label: 'iPhone 14 Pro landscape' },
  { width: 390, height: 844, label: 'iPhone 14 Pro portrait' },
];

/* 44×44 = 1936px². The expansion adds 16px of width and 14px of height, so a
   correct implementation lands at 60×58 = 3480px². Assert a clear majority of
   that gain rather than the exact number, so a future tweak to the insets does
   not fail the build for no reason. */
const MIN_EFFECTIVE_AREA = 2800;

async function runTests() {
  console.log('Starting Astro preview server for Corner Controls E2E...');
  const { stop } = await startPreviewServer();

  console.log('Server is running. Launching Puppeteer...');
  const browser = await launchTestBrowser();
  let exitCode = 0;
  let passed = 0;

  try {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage();
      await page.setViewport({ ...vp, hasTouch: true, isMobile: true });
      await page.goto('http://localhost:4321/', { waitUntil: 'networkidle2' });

      /* Land in the state the report describes: splash dismissed, scrolled
         down, navbar showing and settled. The navbar's return transition runs
         500ms on a 300ms delay — sample before that and you measure a moving
         target, not the resting one. */
      await page.evaluate(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        document.querySelector('.hero-cta')?.click();
        await wait(1300);
        const root = document.documentElement;
        const p = root.style.scrollBehavior;
        root.style.scrollBehavior = 'auto';
        void root.offsetHeight;
        window.scrollTo(0, 900);
        root.style.scrollBehavior = p;
        await wait(900);
      });

      const measure = async (selector, label) =>
        page.evaluate(
          (selector, label) => {
            const el = document.querySelector(selector);
            if (!el) return { label, missing: true };
            const box = el.getBoundingClientRect();
            const cs = getComputedStyle(el);

            /* Walk outward from the button's own box and ask the document
               what is at each point. Anything that hit-tests back to the
               button — including its ::before — counts as target. */
            const PAD = 60;
            let minX = Infinity;
            let maxX = -Infinity;
            let minY = Infinity;
            let maxY = -Infinity;
            let hits = 0;
            for (let x = box.left - PAD; x <= box.right + PAD; x += 2) {
              for (let y = box.top - PAD; y <= box.bottom + PAD; y += 2) {
                if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
                const hit = document.elementFromPoint(x, y);
                if (!hit || !(hit === el || el.contains(hit))) continue;
                hits += 4; // each sample stands for a 2×2 block
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            }

            return {
              label,
              position: cs.position,
              touchAction: cs.touchAction,
              topEdgeGap: Math.round(box.top),
              box: { w: Math.round(box.width), h: Math.round(box.height) },
              /* How far the effective area reaches past the visual box on
                 each side. Positive = expanded that way. */
              growLeft: Math.round(box.left - minX),
              growRight: Math.round(maxX - box.right),
              growUp: Math.round(box.top - minY),
              growDown: Math.round(maxY - box.bottom),
              area: hits,
            };
          },
          selector,
          label
        );

      const check = (m) => {
        assert.ok(!m.missing, `${vp.label}: ${m.label} not found`);
        assert.ok(
          m.area >= MIN_EFFECTIVE_AREA,
          `${vp.label}: ${m.label} has only ${m.area}px² of effective tap area ` +
            `(box ${m.box.w}×${m.box.h}). A bare 44×44 in the top-right corner is ` +
            `what was reported as "difficult to press" — the invisible ::before ` +
            `expansion in a11y.css is missing or has been overridden.`
        );
        assert.ok(
          m.growDown > 0 || m.growLeft > 0,
          `${vp.label}: ${m.label} does not expand down or inward at all`
        );
        /*
          The page is zoomable by design, so without this iOS holds every tap
          on these buttons open waiting to see whether it is the first half of
          a double-tap-to-zoom. `manipulation` opts the control out of that and
          nothing else — pinch-zoom and panning are untouched.
        */
        assert.equal(
          m.touchAction,
          'manipulation',
          `${vp.label}: ${m.label} has touch-action "${m.touchAction}". On a ` +
            `zoomable page iOS defers the tap for double-tap-to-zoom detection, ` +
            `which is a large part of why these corner buttons read as ` +
            `unreliable. It must be "manipulation" (never "none" — see splash.css).`
        );
        /*
          NO ASSERTION ON DISTANCE FROM THE TOP EDGE, DELIBERATELY.

          An earlier fix moved these controls down out of the contested top
          strip by growing the landscape header (padding 0.4rem -> 1.15rem,
          control 44px -> 56px). It worked for the tap target and broke two
          other things: `.hero { padding-top: 5.5rem }` and `.nav-container {
          padding-top: calc(... + 4.25rem) }` are both measured against a ~55px
          bar, so a ~85px bar pushed the hero under the header and exposed the
          section heading beneath it. Reported from a device as "the banner is
          now covering the nav bar".

          That approach was reverted. The margin for error now comes entirely
          from hit area, which costs no layout — so a test that demanded top
          clearance would be asserting the approach that caused a regression.
        */
        assert.ok(
          m.growUp <= 0 && m.growRight <= 0,
          `${vp.label}: ${m.label} expands toward the screen edge ` +
            `(up ${m.growUp}px, right ${m.growRight}px). That pushes the target ` +
            `further into the corner strip iOS contends with for Control Centre — ` +
            `the expansion must go down and inward only.`
        );
        console.log(
          `  ✓ ${vp.label}: ${m.label} — ${m.area}px² effective ` +
            `(+${m.growLeft} left, +${m.growDown} down), ${m.topEdgeGap}px below top`
        );
        passed++;
      };

      check(await measure('.nav-toggle', 'hamburger'));

      // Open the menu: the same element becomes the X.
      await page.evaluate(async () => {
        document.querySelector('.nav-toggle')?.click();
        await new Promise((r) => setTimeout(r, 600));
      });
      check(await measure('.nav-toggle', 'X (close)'));

      /* The close buttons must still be positioned in their corners. This is
         the regression the earlier draft of the fix would have caused. */
      const positions = await page.evaluate(() => {
        const read = (sel) => {
          const el = document.querySelector(sel);
          return el ? getComputedStyle(el).position : null;
        };
        return {
          modalClose: read('.modal-close'),
          fullscreenClose: read('.close-fullscreen-btn'),
        };
      });

      for (const [name, pos] of Object.entries(positions)) {
        if (pos === null) continue; // not present on this route
        assert.ok(
          pos === 'absolute' || pos === 'fixed',
          `${vp.label}: .${name} computed position is "${pos}". The hit-area rule ` +
            `in a11y.css must not add \`position: relative\` to the close buttons — ` +
            `a11y.css is imported last, so that resets them out of their corners.`
        );
        console.log(`  ✓ ${vp.label}: ${name} keeps position: ${pos}`);
        passed++;
      }

      await page.close();
    }

    /*
      THE TRADE THIS FIX MAKES, AND THE LIMIT ON IT.

      The reachable band now extends ~34px BELOW the control, because on iOS
      the touch region is displaced downward from the painted glyph. That band
      is invisible, so if any other link or button falls inside it, that
      control silently stops working and nothing on screen explains why —
      strictly worse than the bug being fixed.

      So: walk the expanded region on every route that matters and assert that
      the only thing hit-testable inside it is the intended control (or inert
      page background).
    */
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 956, height: 440, hasTouch: true, isMobile: true });

      for (const route of ['/', '/feed', '/events', '/intel', '/featured']) {
        await page.goto(`http://localhost:4321${route}`, { waitUntil: 'networkidle2' });

        const stolen = await page.evaluate(async () => {
          const wait = (ms) => new Promise((r) => setTimeout(r, ms));
          const root = document.documentElement;
          root.classList.remove('splash-armed', 'splash-lifting', 'splash-dropping');
          window.__hqScrollLock?.release?.();
          window.scrollTo(0, 700);
          /* The navbar's return transition is 500ms on a 300ms delay. Sample
             before it settles and the bar is still translated off-screen, so
             the band gets measured against page content instead of the bar —
             which reports overlaps that do not exist. */
          await wait(1100);

          const toggle = document.querySelector('.nav-toggle');
          if (!toggle) return [];
          const b = toggle.getBoundingClientRect();
          const navEl = document.getElementById('navbar');
          const nav = navEl ? navEl.getBoundingClientRect() : null;

          const victims = new Set();
          /*
            Only points the band ACTUALLY covers matter, and the precise way to
            ask that is the hit stack: if the toggle is on top at this point,
            anything actionable BENEATH it in the same stack is a control the
            band is swallowing.

            Scanning a rectangle and flagging every actionable element inside
            it is not the same question — it reports content that merely sits
            near the band, which is how an earlier version of this check
            produced a false `a.cat` failure.
          */
          const PAD = 60;
          for (let x = b.left - PAD; x <= b.right + PAD; x += 3) {
            for (let y = b.top - PAD; y <= b.bottom + PAD; y += 3) {
              if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
              /*
                Points inside the navbar's own box are not at issue: the bar is
                opaque and fixed, so it already covers whatever scrolls under
                it. Only band area reaching PAST the bar can take a tap that
                would otherwise have gone somewhere real.
              */
              if (nav && x >= nav.left && x <= nav.right && y >= nav.top && y <= nav.bottom) continue;

              const stack = document.elementsFromPoint(x, y);
              if (!stack.length) continue;
              const top = stack[0];
              if (!(top === toggle || toggle.contains(top))) continue; // not our band

              for (const el of stack.slice(1)) {
                if (el === toggle || toggle.contains(el)) continue;
                if (el.contains(toggle)) continue; // ancestors are not victims
                const actionable = el.closest('a, button, [role="button"], input, select, textarea');
                if (actionable && !toggle.contains(actionable) && !actionable.contains(toggle)) {
                  victims.add(
                    actionable.tagName.toLowerCase() +
                      (actionable.className
                        ? '.' + actionable.className.toString().trim().split(/\s+/)[0]
                        : '')
                  );
                }
              }
            }
          }
          return [...victims];
        });

        assert.deepEqual(
          stolen,
          [],
          `${route}: the nav toggle's invisible hit band overlaps other controls ` +
            `(${stolen.join(', ')}). Those would silently stop responding with nothing ` +
            `on screen to explain it. Shrink the expansion in a11y.css or move what ` +
            `is underneath.`
        );
        console.log(`  ✓ ${route}: expanded hit band steals nothing`);
        passed++;
      }
      await page.close();
    }

    /*
      THE CATEGORY OVERLAY'S CLOSE BUTTON — CHECKED WHERE IT ACTUALLY EXISTS.

      This is the regression that shipped. `a11y.css` is imported last, so a
      bare `.nav-toggle { position: relative }` there beat filters.css's
      `position: absolute` — and the category overlay's close button carries
      BOTH classes (`class="close-fullscreen-btn nav-toggle menu-open"`, on
      purpose, so the two controls animate identically). The button fell out
      of the corner into normal flow, landing in the middle of the overlay on
      /feed and /intel in both orientations.

      The earlier version of this file "checked" it — on `/`, where the
      overlay does not exist, so the check read null and skipped. A guard that
      silently no-ops is not a guard. It is opened here, on a route that has
      one, and asserted to be in the corner it is drawn in.
    */
    for (const vp of [
      { width: 956, height: 440, label: 'landscape' },
      { width: 390, height: 844, label: 'portrait' },
    ]) {
      for (const route of ['/feed', '/intel']) {
        const page = await browser.newPage();
        await page.setViewport({ ...vp, hasTouch: true, isMobile: true });
        await page.goto(`http://localhost:4321${route}`, { waitUntil: 'networkidle2' });

        const seen = await page.evaluate(async () => {
          const overlay = document.querySelector('.category-fullscreen-overlay');
          if (!overlay) return null;
          overlay.classList.add('active', 'is-open', 'open');
          await new Promise((r) => setTimeout(r, 400));

          const btn = document.querySelector('.close-fullscreen-btn');
          if (!btn) return null;
          const b = btn.getBoundingClientRect();
          const items = [...document.querySelectorAll('.category-fullscreen-overlay .cat-btn')].map(
            (a) => Math.round(a.getBoundingClientRect().top)
          );
          const content = document.querySelector('.category-fullscreen-overlay .fullscreen-content');
          return {
            position: getComputedStyle(btn).position,
            fromTop: Math.round(b.top),
            fromRight: Math.round(innerWidth - b.right),
            rows: new Set(items).size,
            items: items.length,
            scrolls: content ? content.scrollHeight > content.clientHeight + 1 : false,
          };
        });
        await page.close();

        if (!seen) continue;
        const where = `${route} ${vp.label}`;

        assert.ok(
          seen.position === 'absolute' || seen.position === 'fixed',
          `${where}: the categories close button computes position "${seen.position}". ` +
            `It shares the .nav-toggle class with the navbar's hamburger, so an ` +
            `unscoped .nav-toggle rule in a11y.css (imported last) resets it into ` +
            `normal flow and it lands in the middle of the overlay. Scope such rules ` +
            `to "#navbar .nav-toggle".`
        );
        assert.ok(
          seen.fromRight < 120 && seen.fromTop < 120,
          `${where}: the categories close button is ${seen.fromTop}px from the top and ` +
            `${seen.fromRight}px from the right — it is not in its corner.`
        );

        if (vp.label === 'landscape' && seen.items > 1) {
          assert.equal(
            seen.rows,
            1,
            `${where}: the category list renders on ${seen.rows} rows. In a ~440px ` +
              `landscape viewport a column of ${seen.items} overflows and turns the ` +
              `overlay into a scroller; it must lay out as a row, the same way ` +
              `.nav-list does on these screens.`
          );
          assert.equal(
            seen.scrolls,
            false,
            `${where}: the category overlay scrolls. In landscape the list must fit.`
          );
        }

        console.log(
          `  ✓ ${where}: close button in corner (${seen.position}), ` +
            `${seen.items} categories on ${seen.rows} row(s)`
        );
        passed++;
      }
    }

    /*
      ━━━ SIBLING CONTROLS INSIDE THE BAR MUST NOT SWALLOW EACH OTHER ━━━

      THE BLIND SPOT THAT LET A REAL BUG THROUGH.

      The steal-check above deliberately skips every point inside the navbar's
      own box, on the reasoning that "the bar is opaque and fixed, so it
      already covers whatever scrolls under it". That was sound when the bar's
      right side held exactly one control.

      It stopped being sound when the search button was added beside the
      hamburger. The hamburger's band expands LEFT — a11y.css says so
      explicitly, "across the empty middle of the bar where nothing else is
      interactive" — and the search button was then placed in precisely that
      space. The band covered the whole button, `.nav-toggle` carries the
      higher z-index, and every tap on the magnifying glass opened the menu
      instead. Reported from a device in landscape as the search icon being
      unpressable.

      The check above could not see it, because the entire collision happens
      INSIDE the bar, which is the region it skips.

      So this checks the other question: for each control in the bar, is every
      point of its own visible box actually reachable, or is a neighbour on top
      of it? Page content under the bar is still not at issue. Its siblings are.
    */
    {
      const page = await browser.newPage();
      for (const vp of VIEWPORTS) {
        await page.setViewport({ ...vp, hasTouch: true, isMobile: true });
        await page.goto('http://localhost:4321/intel', { waitUntil: 'networkidle2' });

        const report = await page.evaluate(async () => {
          const wait = (ms) => new Promise((r) => setTimeout(r, ms));
          document.documentElement.classList.remove('splash-armed', 'splash-lifting', 'splash-dropping');
          await wait(600);

          /* visibility:hidden cannot be hit, so it is not a neighbour that can
             steal anything. The category overlay's close button reuses
             .nav-toggle and would otherwise be measured as if it were here. */
          const onScreen = (el) =>
            el && el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden';

          const controls = [...document.querySelectorAll('#navbar button, #navbar a')].filter(onScreen);

          return controls.map((el) => {
            const r = el.getBoundingClientRect();
            let reachable = 0;
            let total = 0;
            const thieves = new Set();
            for (let dx = 2; dx < r.width; dx += 3) {
              for (let dy = 2; dy < r.height; dy += 3) {
                const x = Math.round(r.left + dx);
                const y = Math.round(r.top + dy);
                if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
                total++;
                const hit = document.elementFromPoint(x, y);
                if (hit === el || el.contains(hit)) { reachable++; continue; }
                const other = hit && hit.closest('button, a');
                if (other && other !== el && !el.contains(other) && !other.contains(el)) {
                  thieves.add(
                    other.tagName.toLowerCase() +
                      (other.className ? '.' + other.className.toString().trim().split(/\s+/)[0] : '')
                  );
                }
              }
            }
            return {
              name: el.tagName.toLowerCase() +
                (el.className ? '.' + el.className.toString().trim().split(/\s+/)[0] : ''),
              label: el.getAttribute('aria-label') || el.textContent.trim().slice(0, 20),
              w: Math.round(r.width),
              h: Math.round(r.height),
              reachablePct: total ? Math.round((reachable / total) * 100) : null,
              thieves: [...thieves],
            };
          });
        });

        for (const c of report) {
          if (c.reachablePct === null) continue;
          assert.equal(
            c.thieves.length,
            0,
            `${vp.label}: "${c.label}" (${c.name}) is only ${c.reachablePct}% reachable — ` +
              `${c.thieves.join(', ')} sits on top of it. A neighbour's invisible hit band ` +
              `is covering a control that is right there on screen, so it looks pressable ` +
              `and is not. Cap the expansion in a11y.css so it stops at the gap.`
          );
        }

        /*
          And the search button specifically must be a real target, not a
          zero-size one. Its desktop copy shipped with an SVG that had no
          width, no height and nothing in CSS sizing it, so the button computed
          0x0. Scripted clicks still worked, which is exactly why nothing
          caught it: `.click()` does not care about size, and a person has
          nothing to aim at.
        */
        const search = report.find((c) => /Search/i.test(c.label || ''));
        assert.ok(search, `${vp.label}: there is no visible search control in the navbar`);
        assert.ok(
          search.w >= 44 && search.h >= 44,
          `${vp.label}: the search control is ${search.w}x${search.h}, under the 44px ` +
            `minimum the rest of these controls hold to`
        );

        console.log(
          `  ✓ ${vp.label}: ${report.filter((c) => c.reachablePct !== null).length} nav controls, ` +
            `none covering another; search ${search.w}x${search.h}`
        );
        passed++;
      }
      await page.close();
    }

    console.log(`\n✅ Corner Controls E2E tests passed (${passed} checks).`);
  } catch (error) {
    console.error('\n❌ Corner Controls E2E failed:', error.message);
    exitCode = 1;
  } finally {
    await browser.close();
    stop();
    process.exit(exitCode);
  }
}

runTests();
