/*
  Turnstile is loaded on interaction, not on page view.

  ─── WHAT THIS CAN AND CANNOT PROVE ───────────────────────────────────────
  challenges.cloudflare.com is unreachable from CI and from the dev sandbox,
  and pointing a test at Cloudflare's real challenge endpoint would be both
  flaky and rude. So the request is INTERCEPTED and fulfilled with a stub
  that behaves like the real API's explicit-render mode: it defines
  `window.turnstile` and invokes the `onload` callback named in the URL.

  That makes this an honest test of OUR half of the contract:
    - nothing is requested until the reader touches a form
    - the request is made on first interaction, exactly once
    - every widget container gets rendered, with the site key and the
      data-callback globals the components declare
    - widgets still mount after a client-side navigation, which the implicit
      renderer never did

  It also covers the execute-mode flow added in #190 the same way: the stub's
  `execute()` decides whether a token arrives, so the form's wait, its
  timeout, its lock and its recovery are all exercised without Cloudflare.

  It does NOT prove a real challenge solves, that Cloudflare accepts the
  rendered widget, or that the subscribe action validates the resulting
  token. Those need a live key against the deploy preview and are listed on
  the PR.
*/
import { launchTestBrowser } from './e2e-browser.mjs';
import { startPreviewServer } from './e2e-server.mjs';
import assert from 'node:assert/strict';

const TURNSTILE_HOST = 'challenges.cloudflare.com';

/**
 * Stand-in for api.js in explicit-render mode. Records every render() call on
 * the page so assertions can inspect what we asked Cloudflare to draw.
 */
function stubScript(onloadName) {
  return `
    window.__tsRenders = [];
    window.turnstile = {
      render: function (el, opts) {
        var id = 'w' + window.__tsRenders.length;
        window.__tsRenders.push({
          id: id,
          sitekey: opts && opts.sitekey,
          size: opts && opts.size,
          hasCallback: !!(opts && opts.callback),
          hasErrorCallback: !!(opts && opts['error-callback']),
          hasExpiredCallback: !!(opts && opts['expired-callback']),
          elementId: el && el.id,
          elementClass: el && el.className,
        });
        el.setAttribute('data-stub-widget', id);
        return id;
      },
      getResponse: function () { return 'stub-token'; },
      reset: function () {},
      remove: function () {},
    };
    if (typeof window[${JSON.stringify(onloadName)}] === 'function') {
      window[${JSON.stringify(onloadName)}]();
    }
  `;
}

let passed = 0;
let failed = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${error.message}`);
    failed++;
  }
}

async function newInstrumentedPage(browser) {
  const page = await browser.newPage();
  const requests = [];
  await page.setRequestInterception(true);

  page.on('request', (req) => {
    const url = req.url();
    if (!url.includes(TURNSTILE_HOST)) {
      req.continue().catch(() => {});
      return;
    }
    requests.push(url);
    // Echo back the onload callback name the loader put in the query string,
    // which is also an assertion that it asked for explicit mode properly.
    const onload = new URL(url).searchParams.get('onload') || '';
    req
      .respond({
        status: 200,
        contentType: 'application/javascript',
        body: stubScript(onload),
      })
      .catch(() => {});
  });

  return { page, requests };
}

async function runTests() {
  console.log('Starting Astro preview server for Turnstile lazy-load E2E...');
  const { stop } = await startPreviewServer();
  console.log('Server is running. Launching Puppeteer...');
  const browser = await launchTestBrowser();
  let exitCode = 0;

  try {
    // ─── 1. Nothing on page load ──────────────────────────────────────────
    const { page, requests } = await newInstrumentedPage(browser);
    await page.setViewport({ width: 390, height: 844 });
    await page.goto('http://localhost:4321/', { waitUntil: 'networkidle0' });

    check('no Turnstile request on page load', () => {
      assert.deepEqual(
        requests,
        [],
        `expected zero requests to ${TURNSTILE_HOST}, got:\n    ${requests.join('\n    ')}`,
      );
    });

    /*
      The only widget the live site mounts is the newsletter one. The contact
      modal's `.cf-turnstile` is deliberately not rendered while that form is
      inactive (ContactModal.astro's RENDER_TURNSTILE flag) — a widget for a
      form nobody can reach is a live Turnstile session on every page view,
      which is what earned the 429 on api.js that PageSpeed flagged.
    */
    const preRender = await page.evaluate(() => ({
      newsletterHolder: !!document.getElementById('newsletter-turnstile'),
      contactWidgets: document.querySelectorAll('.cf-turnstile').length,
      rendered: document.querySelectorAll('[data-stub-widget]').length,
      apiPresent: typeof window.turnstile !== 'undefined',
    }));

    check('the newsletter widget container exists but nothing is rendered yet', () => {
      assert.ok(preRender.newsletterHolder, 'expected #newsletter-turnstile to be server-rendered');
      assert.equal(preRender.rendered, 0);
      assert.equal(preRender.apiPresent, false, 'window.turnstile must not exist before interaction');
    });

    check('the inactive contact form mounts NO widget', () => {
      assert.equal(
        preRender.contactWidgets,
        0,
        'contact modal is inactive — mounting its widget costs a Turnstile session per page view',
      );
    });

    // ─── 2. First interaction triggers the load ───────────────────────────
    /*
      Focus the NEWSLETTER form, not the contact one. The only .cf-turnstile
      on the homepage lives inside the contact modal, which is closed — and
      .focus() on a field in a hidden subtree is a no-op that fires no
      focusin, so triggering from there would test nothing. The newsletter
      form is visible in the subscribe band and is what a reader actually
      touches first.
    */
    const focused = await page.evaluate(() => {
      const field = document.querySelector('#newsletter-form input[type=email]');
      if (!field) return false;
      field.focus();
      return true;
    });
    assert.ok(focused, 'could not find the newsletter email field');

    await page.waitForFunction(() => document.querySelectorAll('[data-stub-widget]').length > 0, {
      timeout: 5000,
    });

    check('focusing the form requests Turnstile exactly once', () => {
      assert.equal(requests.length, 1, `expected 1 request, got ${requests.length}`);
    });

    check('it asks for explicit render mode with an onload callback', () => {
      const url = new URL(requests[0]);
      assert.equal(url.searchParams.get('render'), 'explicit');
      assert.ok(url.searchParams.get('onload'), 'onload callback name missing from the URL');
    });

    const renders = await page.evaluate(() => window.__tsRenders);

    check('the newsletter widget is rendered with its site key', () => {
      const nl = renders.find((r) => r.elementId === 'newsletter-turnstile');
      assert.ok(nl, `newsletter widget never rendered; got ${JSON.stringify(renders)}`);
      assert.ok(nl.sitekey, 'render() called without a sitekey');
    });

    check('exactly ONE widget is rendered — no session for the dead form', () => {
      assert.equal(
        renders.length,
        1,
        `expected only the newsletter widget; got ${JSON.stringify(renders)}`,
      );
      assert.equal(renders[0].elementId, 'newsletter-turnstile');
    });

    // ─── 3. Interacting again does not re-request or double-render ────────
    await page.evaluate(() => {
      const field = document.querySelector('#newsletter-form input[type=email]');
      field.blur();
      field.focus();
    });
    await new Promise((r) => setTimeout(r, 300));

    check('a second interaction does not request the script again', () => {
      assert.equal(requests.length, 1, `expected still 1 request, got ${requests.length}`);
    });

    const afterSecond = await page.evaluate(() => window.__tsRenders.length);
    check('and does not render the same container twice', () => {
      assert.equal(afterSecond, renders.length);
    });

    /*
      The newsletter widget renders itself with an options object and carries
      no data-* callbacks, so the assertions above never exercise the OTHER
      path: renderPendingWidgets reading `data-callback` and friends off a
      `.cf-turnstile` container and resolving those names as window globals.
      That is the path the contact form would use if it were re-enabled, so it
      must not rot while the form is switched off.

      Inject exactly the container that component ships and fire the
      astro:page-load sweep the renderer listens on.
    */
    const attributeRender = await page.evaluate(async () => {
      window.onTurnstileSuccess = () => {};
      window.onTurnstileError = () => {};
      window.onTurnstileExpired = () => {};

      const el = document.createElement('div');
      el.className = 'cf-turnstile';
      el.setAttribute('data-sitekey', 'test-site-key');
      el.setAttribute('data-size', 'flexible');
      el.setAttribute('data-callback', 'onTurnstileSuccess');
      el.setAttribute('data-error-callback', 'onTurnstileError');
      el.setAttribute('data-expired-callback', 'onTurnstileExpired');
      document.body.appendChild(el);

      document.dispatchEvent(new Event('astro:page-load'));
      await new Promise((r) => setTimeout(r, 200));

      return window.__tsRenders.find((r) => (r.elementClass || '').includes('cf-turnstile'));
    });

    check('the renderer wires data-* callbacks through as window globals', () => {
      assert.ok(attributeRender, 'the injected .cf-turnstile container was never rendered');
      assert.equal(attributeRender.sitekey, 'test-site-key');
      assert.equal(attributeRender.hasCallback, true, 'success callback not passed');
      assert.equal(attributeRender.hasErrorCallback, true, 'error callback not passed');
      assert.equal(attributeRender.hasExpiredCallback, true, 'expired callback not passed');
    });


    await page.close();

    // ─── 4. Widgets still mount after a client-side navigation ────────────
    /*
      This is the bug the implicit renderer had and never fixed: its scan runs
      once, at script load, so a ClientRouter navigation left a fresh, empty
      container behind. Deferring the load would have made that permanent, so
      the explicit re-render on astro:page-load is load-bearing.
    */
    const nav = await newInstrumentedPage(browser);
    await nav.page.setViewport({ width: 390, height: 844 });
    await nav.page.goto('http://localhost:4321/', { waitUntil: 'networkidle0' });

    await nav.page.evaluate(() => {
      document.querySelector('#newsletter-form input[type=email]').focus();
    });
    await nav.page.waitForFunction(() => document.querySelectorAll('[data-stub-widget]').length > 0, {
      timeout: 5000,
    });

    const navigated = await nav.page.evaluate(async () => {
      const link = Array.from(document.querySelectorAll('a[href]')).find((a) => {
        const href = a.getAttribute('href') || '';
        return href.startsWith('/') && !href.startsWith('//') && href !== '/' && !href.includes('#');
      });
      if (!link) return null;
      link.click();
      return link.getAttribute('href');
    });

    if (navigated) {
      await nav.page.waitForFunction(
        (from) => window.location.pathname !== from,
        { timeout: 8000 },
        '/',
      ).catch(() => {});
      await new Promise((r) => setTimeout(r, 800));

      const afterNav = await nav.page.evaluate(() => ({
        containers: document.querySelectorAll('.cf-turnstile').length,
        rendered: document.querySelectorAll('[data-stub-widget]').length,
        requests: null,
      }));

      check(`after navigating to ${navigated}, every container is still rendered`, () => {
        if (afterNav.containers === 0) return; // that page has no form; nothing to assert
        assert.ok(
          afterNav.rendered >= afterNav.containers,
          `${afterNav.containers} container(s) but only ${afterNav.rendered} rendered — ` +
            'the astro:page-load re-render did not run',
        );
      });

      check('the script is not re-requested after navigation', () => {
        assert.equal(nav.requests.length, 1, `expected 1 request, got ${nav.requests.length}`);
      });
    } else {
      console.log('  (no internal link found to exercise ClientRouter — skipped)');
    }

    await nav.page.close();

    /*
      ─── A WIDGET THAT RENDERS BUT NEVER DRAWS ─────────────────────────────

      turnstile.render() returning an id does not mean the reader can see
      anything. A site key scoped to the production hostname refuses to draw
      on a preview deploy, silently — confirmed against the real site, which
      works on beunconventionalhq.com and fails on *.workers.dev. A sustained
      429 on the challenge endpoint looks identical.

      Before this, that state told the reader to "complete the verification
      challenge above" while pointing at empty space. This drives exactly that
      condition — a stub that accepts render() and draws nothing — and asserts
      the form says something true and offers a way out instead.
    */
    /*
      ─── EXECUTE MODE (#190) ────────────────────────────────────────────────
      The scenario that used to sit here — "the widget renders but draws no
      children, so something is wrong" — was retired, not lost. In execute
      mode a HEALTHY widget also draws nothing, so drawing nothing stopped
      being evidence of anything. What replaces it is the contract that
      actually holds now: pressing Subscribe runs the challenge, the form
      waits for the token, and every way that wait can end is handled.

      These stubs implement `execute()` because the form calls it. A stub
      without it would make the form fail for the wrong reason and the
      assertions below would pass without testing anything.
    */
    async function runExecuteScenario(executeBody, act) {
      const page = await browser.newPage();
      await page.setViewport({ width: 390, height: 844 });
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const url = req.url();
        if (!url.includes(TURNSTILE_HOST)) {
          req.continue().catch(() => {});
          return;
        }
        const onload = new URL(url).searchParams.get('onload') || '';
        req
          .respond({
            status: 200,
            contentType: 'application/javascript',
            body: `
              window.__tsExecutes = 0;
              window.__tsCallback = null;
              window.turnstile = {
                render: function (el, opts) {
                  window.__tsCallback = opts && opts.callback;
                  return 'execute-widget-1';
                },
                reset: function () {},
                remove: function () {},
                execute: function () { window.__tsExecutes++; ${executeBody} },
              };
              if (typeof window[${JSON.stringify(onload)}] === 'function') {
                window[${JSON.stringify(onload)}]();
              }
            `,
          })
          .catch(() => {});
      });

      await page.goto('http://localhost:4321/', { waitUntil: 'networkidle0' });
      await page.evaluate(() => {
        document.querySelector('#newsletter-form input[type=email]').focus();
      });
      await new Promise((r) => setTimeout(r, 600));
      await page.evaluate(() => {
        const input = document.querySelector('#newsletter-form input[type=email]');
        input.value = 'e2e-execute@example.com';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });

      await act(page);

      const state = await page.evaluate(() => {
        const form = document.getElementById('newsletter-form');
        return {
          message: document.getElementById('newsletter-status').textContent.trim(),
          isError: form.classList.contains('is-error'),
          isSuccess: form.classList.contains('is-success'),
          isSubmitting: form.classList.contains('is-submitting'),
          ariaBusy: form.getAttribute('aria-busy'),
          executes: window.__tsExecutes,
          hasIframe: !!document.querySelector('#newsletter-turnstile iframe'),
        };
      });
      await page.close();
      return state;
    }

    console.log('Execute mode: the happy path...');

    const spammed = await runExecuteScenario(
      // A token, one tick later, the way a real silent challenge resolves.
      'setTimeout(function () { if (window.__tsCallback) window.__tsCallback("execute-token"); }, 50);',
      async (page) => {
        /* Spam-click. #188's guarantee has to survive the challenge wait
           being the long part of the flow. */
        await page.evaluate(() => {
          const button = document.querySelector('.newsletter-submit');
          button.click();
          button.click();
          button.click();
        });
        await new Promise((r) => setTimeout(r, 2500));
      },
    );

    check('a token arrives and the form posts successfully', () => {
      assert.equal(spammed.isSuccess, true, `expected success, got: "${spammed.message}"`);
      assert.match(spammed.message, /on the list/i);
    });

    check('nothing is drawn in the subscribe band on the silent path', () => {
      assert.equal(spammed.hasIframe, false);
    });

    check('spam-clicking Subscribe runs exactly ONE challenge', () => {
      assert.equal(
        spammed.executes,
        1,
        `expected 1 execute() for 3 clicks, got ${spammed.executes}`,
      );
    });

    check('aria-busy is cleared once the form settles', () => {
      assert.equal(spammed.ariaBusy, null);
    });

    console.log('Execute mode: the challenge never calls back...');

    const stalled = await runExecuteScenario(
      // Silence. No callback, no error-callback, no timeout-callback.
      '/* never calls back */',
      async (page) => {
        await page.evaluate(() => document.querySelector('.newsletter-submit').click());
        /* Just past CHALLENGE_TIMEOUT_MS (12s) in NewsletterForm.astro. */
        await new Promise((r) => setTimeout(r, 14000));
      },
    );

    check('a stalled challenge fails instead of spinning forever', () => {
      assert.equal(stalled.isError, true, `expected the error state, got: "${stalled.message}"`);
      assert.match(stalled.message, /anti-spam check/i);
    });

    check('...and never tells the reader to complete something invisible', () => {
      assert.ok(
        !/complete the verification challenge/i.test(stalled.message),
        `told the reader to complete a challenge that is not on screen: "${stalled.message}"`,
      );
    });

    check('...and leaves the form usable rather than locked', () => {
      assert.equal(stalled.isSubmitting, false, 'the form is still locked in is-submitting');
      assert.equal(stalled.ariaBusy, null, 'the form still reports itself busy');
    });

    console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed.`);
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
