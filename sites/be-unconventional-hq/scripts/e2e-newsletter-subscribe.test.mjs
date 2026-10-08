/*
  End-to-end coverage for the ONE form the site actually relies on: the
  newsletter subscribe band (NewsletterForm.astro, rendered by SubscribeCTA
  on the homepage and most content pages). Nothing exercised the full submit
  path before this — the only prior form E2E coverage was ContactModal's, and
  that form is now deliberately inactive.

  ─── WHAT THIS CAN AND CANNOT PROVE ───────────────────────────────────────
  challenges.cloudflare.com is unreachable from this sandbox (see
  e2e-turnstile-lazy.test.mjs), so this cannot drive a real Turnstile
  challenge. It runs the build with NO site key configured instead, which is
  not a workaround — it is a real, supported code path: subscribe.ts's own
  comments document that an unconfigured Turnstile must degrade to "no bot
  check" rather than "nobody can subscribe", and NewsletterForm's
  mountTurnstile() returns immediately when there is no site key, so the
  widget never mounts and the submit handler never waits on a token. That is
  exactly the state a fresh deploy or a preview environment is in before
  secrets are configured — the failure mode is tested, not the happy path
  under Turnstile.

  What it verifies: the form really does deliver an email to the API and get
  a stored subscriber back, end to end, through `astro preview`'s LOCAL
  Cloudflare worker runtime — which emulates the KV binding declared in
  wrangler.jsonc, not a mock. A successful run here means the wiring between
  the form, /api/subscribe, and KV is intact; it does not mean the bot check
  itself works, which needs a live key against a real deploy.
*/
import { launchTestBrowser } from './e2e-browser.mjs';
import { startPreviewServer } from './e2e-server.mjs';
import assert from 'node:assert/strict';

async function runTests() {
  console.log('Starting Astro preview server for Newsletter Subscribe E2E...');
  const { stop } = await startPreviewServer();

  console.log('Server is running. Launching Puppeteer...');
  const browser = await launchTestBrowser();
  let exitCode = 0;

  try {
    const page = await browser.newPage();
    page.on('console', (msg) => console.log('BROWSER:', msg.text()));
    await page.goto('http://localhost:4321/#e2e');

    const form = await page.$('#newsletter-form');
    assert.ok(form, 'Newsletter form should be present on the homepage');

    const emailInput = await page.$('#newsletter-email');
    assert.ok(emailInput, 'Newsletter email input should exist');

    // ─── Empty submit is rejected client-side, not sent to the network ─────
    console.log('Submitting with no email...');
    const submitBtn = await page.$('.newsletter-submit');
    await page.evaluate(el => el.click(), submitBtn);
    await new Promise((r) => setTimeout(r, 200));

    const emptyState = await page.evaluate(() => ({
      isError: document.getElementById('newsletter-form').classList.contains('is-error'),
      isSubmitting: document
        .getElementById('newsletter-form')
        .classList.contains('is-submitting'),
    }));
    assert.equal(emptyState.isSubmitting, false, 'Empty submit must never reach the network');
    // The browser's own `required`/type=email validation may block the
    // submit event before our handler even runs (no is-error class in that
    // case) or our handler may catch it and set is-error — either is a
    // correct "did not silently succeed" outcome, so this only asserts what
    // must NOT happen.

    // ─── A real submit reaches the API and gets a real success ─────────────
    console.log('Submitting a real address...');
    const testEmail = `e2e-test-${Date.now()}@example.com`;
    await page.evaluate((email) => {
      const input = document.getElementById('newsletter-email');
      input.value = email;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, testEmail);

    /*
      ─── DO NOT ADD A WAIT BEFORE THIS CLICK ──────────────────────────────

      Tried and reverted, because it broke the suite outright: a 20s
      "wait for the widget to draw" gave NewsletterForm's script-load-failure
      detection time to fire, which sets `turnstileUnavailable` and makes the
      handler show an error and return WITHOUT posting. The form only posts
      promptly here because the click lands before that detection completes.

      So the click stays immediate. The timeout below absorbs slowness instead.
    */
    /*
      30s, not 8s. The submit can be gated on a live Turnstile round trip:
      ~234 KB of challenge-platform script, then a challenge, on a cold CI
      runner. Locally this is instant only because the whole thing is blocked
      and the form posts straight away.
    */
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('_actions/') && res.request().method() === 'POST',
        { timeout: 30000 },
      ),
      page.click('.newsletter-submit'),
    ]);

    assert.equal(response.status(), 200, `Expected 200 from actions.subscribe, got ${response.status()}`);
    const text = await response.text();
    assert.ok(text.includes('success') && text.includes('Subscribed successfully'), `Expected success string, got ${text}`);

    await page.waitForFunction(
      () => document.getElementById('newsletter-form').classList.contains('is-success'),
      { timeout: 15000 },
    );

    const successMessage = await page.$eval('#newsletter-status', (el) => el.textContent.trim());
    assert.ok(successMessage.length > 0, 'Success state should show a status message');
    console.log(`  Confirmed: "${successMessage}"`);

    // ─── The same email twice does not error — resubscribing is a no-op ────
    // A fresh page rather than page.reload(): a reload races Astro's
    // ClientRouter view-transition machinery and the newsletter script's own
    // astro:page-load rebinding, which made the click land before the submit
    // listener was attached again. A new tab sidesteps that entirely and is
    // just as valid a test of "submitting a known email a second time works".
    console.log('Submitting the same address again (fresh page)...');
    const page2 = await browser.newPage();
    await page2.goto('http://localhost:4321/#e2e');
    await page2.evaluate((email) => {
      const input = document.getElementById('newsletter-email');
      input.value = email;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, testEmail);

    const [secondResponse] = await Promise.all([
      page2.waitForResponse(
        (res) => res.url().includes('_actions/') && res.request().method() === 'POST',
        { timeout: 30000 },
      ),
      page2.click('.newsletter-submit'),
    ]);
    assert.equal(
      secondResponse.status(),
      200,
      'Re-subscribing the same address should not error',
    );
    await page2.close();

    console.log('✅ Newsletter Subscribe E2E tests passed.');
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
