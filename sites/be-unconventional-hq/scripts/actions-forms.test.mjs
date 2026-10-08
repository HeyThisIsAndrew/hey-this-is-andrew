/*
  Offline guards for the Actions + invisible-Turnstile rewrite (#190 / #203).

  Two halves:

  1. `src/lib/action-http.ts` is real logic, so it is exercised directly. It
     decides what a visitor reads and what status an external caller gets when
     an action fails.

  2. The rest are source assertions over NewsletterForm.astro and
     src/actions/index.ts. A browser suite is the only thing that can prove the
     execute-mode flow end to end (scripts/e2e-newsletter-subscribe.test.mjs),
     and it needs a build and a server. These pin the invariants that were
     wrong once and would fail silently if they broke again: a bot check that
     accepts anything, a form that reads `getResponse()` synchronously, a
     widget bricked by one transient error. Each check names the failure it is
     guarding, so a future edit knows what it is being stopped from doing.
*/
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  actionErrorMessage,
  actionErrorStatus,
  respondToActionResult,
} from '../src/lib/action-http.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const form = read('src/components/NewsletterForm.astro');
const actions = read('src/actions/index.ts');
const subscribeRoute = read('src/pages/api/subscribe.ts');
const contactRoute = read('src/pages/api/contact.ts');

/**
 * Source with comments removed.
 *
 * These files explain themselves at length, so a plain `includes()` over the
 * raw text keeps matching the prose that DESCRIBES a pattern rather than the
 * code that uses it. Every "this must not appear" check runs against this.
 */
function code(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const formCode = code(form);
const actionsCode = code(actions);

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`  FAIL  ${name}\n        ${error.message}`);
  }
}

console.log('\naction-http: what a failure looks like to the caller');

check('a Zod input error reads as its field message, never the raw JSON dump', () => {
  /* Astro builds ActionInputError's `message` as
     `Failed to validate: [ …json… ]`. Rendering that into the subscribe band
     is what this exists to prevent. */
  const inputError = {
    type: 'AstroActionInputError',
    code: 'BAD_REQUEST',
    status: 400,
    message: 'Failed to validate: [\n  {\n    "code": "invalid_format"\n  }\n]',
    fields: { email: ['Please enter a valid email address.'] },
  };
  assert.equal(actionErrorMessage(inputError), 'Please enter a valid email address.');
  assert.doesNotMatch(actionErrorMessage(inputError), /Failed to validate/);
});

check('an input error with no usable field message still says something human', () => {
  const message = actionErrorMessage({
    type: 'AstroActionInputError',
    status: 400,
    message: 'Failed to validate: []',
    fields: {},
  });
  assert.doesNotMatch(message, /Failed to validate/);
  assert.match(message, /try again/i);
});

check("a handler's own 400 copy is passed through unchanged", () => {
  assert.equal(
    actionErrorMessage({
      type: 'AstroActionError',
      code: 'BAD_REQUEST',
      status: 400,
      message: 'Please complete the verification challenge.',
    }),
    'Please complete the verification challenge.',
  );
});

check('an unexpected 500 does not leak its internal message', () => {
  /* An exception that escapes the handler arrives with whatever it said — a
     stack frame, a binding name, a URL with a token in it. The old shim
     returned `err.message` straight to the client. */
  const message = actionErrorMessage({
    code: 'INTERNAL_SERVER_ERROR',
    status: 500,
    message: 'KV binding SUBSCRIBERS is not defined at worker.js:1200',
  });
  assert.equal(message, 'An unexpected error occurred.');
});

check("but a deliberate 500 the handler wrote for visitors survives", () => {
  assert.equal(
    actionErrorMessage({
      type: 'AstroActionError',
      code: 'INTERNAL_SERVER_ERROR',
      status: 500,
      message: 'Failed to send email. Please try again later.',
    }),
    'Failed to send email. Please try again later.',
  );
});

check('statuses are preserved, not flattened to 400', () => {
  assert.equal(actionErrorStatus({ status: 400 }), 400);
  assert.equal(actionErrorStatus({ status: 503 }), 503);
  assert.equal(actionErrorStatus({ status: 500 }), 500);
  assert.equal(actionErrorStatus(undefined), 500);
  assert.equal(actionErrorStatus({ status: 42 }), 500);
});

check('a successful result answers 200 with the action data', async () => {
  const response = respondToActionResult({ data: { success: true, message: 'ok' } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'application/json');
});

check('a failed result answers with { error } and the action status', async () => {
  const response = respondToActionResult({
    error: { type: 'AstroActionError', code: 'SERVICE_UNAVAILABLE', status: 503, message: 'Nope.' },
  });
  assert.equal(response.status, 503);
});

console.log('\nactions: the bot check cannot be talked out of running');

check('Turnstile is only "configured" when BOTH keys are present', () => {
  /* The secret verifies a token; the public key is what lets the browser
     produce one. Secret-only used to mean every submission failed against a
     challenge no page could render. */
  assert.match(actions, /Boolean\(secret\)\s*&&\s*Boolean\(siteKey\)/);
});

check('there is no email-prefix bypass of the bot check', () => {
  /* `e2e-test-` used to skip Turnstile unconditionally, so
     `e2e-test-me@spam.example` walked straight past it in production. CI
     builds with Cloudflare's always-passes TEST keys instead, which issues a
     real token through the real code path. */
  assert.doesNotMatch(actionsCode, /startsWith\(/);
  assert.doesNotMatch(actionsCode, /e2e-test-/);
});

check('CI still builds e2e with the always-passes test keys', () => {
  /* Removing the bypass makes the suites depend on this step, so it is now
     load-bearing rather than an optimisation. */
  const ci = read('.github/workflows/ci.yml');
  assert.match(ci, /PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA/);
  assert.match(ci, /TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA/);
});

check('both actions read secrets through the Workers env, not import.meta alone', () => {
  /* `import.meta.env` is substituted at build time, so a Workers runtime
     secret reads back undefined. The old contact route verified Turnstile
     with `secret: undefined`, which siteverify answers with success:false. */
  assert.match(actions, /from 'cloudflare:workers'/);
  assert.doesNotMatch(
    actionsCode,
    /secret:\s*import\.meta\.env/,
    'siteverify must not be handed a build-time-only secret',
  );
  assert.doesNotMatch(
    actionsCode,
    /Bearer \$\{import\.meta\.env/,
    'Resend must not be handed a build-time-only key',
  );
});

check('contact runs the same Turnstile gate as subscribe', () => {
  const calls = actionsCode.match(/await requireHuman\(/g) ?? [];
  assert.equal(calls.length, 2, 'expected both actions to gate on requireHuman');
});

check('submitted values are escaped before going into the contact email HTML', () => {
  assert.match(actions, /escapeHtml\(message\)/);
  assert.match(actions, /escapeHtml\(name\)/);
  assert.doesNotMatch(actionsCode, /<strong>Name:<\/strong> \$\{name\}/);
});

console.log('\nnewsletter form: the execute-mode invariants');

check('the widget renders in execute mode', () => {
  assert.match(form, /execution: 'execute'/);
});

check('it stays out of the layout until Cloudflare escalates', () => {
  /* Widget MODE is a dashboard property of the site key, so this is what
     keeps the band clear on a Managed key and makes the dashboard flip safe
     to do in either order. */
  assert.match(form, /appearance: 'interaction-only'/);
});

check('the token is awaited, never read synchronously from getResponse()', () => {
  /* Reading getResponse() at submit time is the visible-widget assumption
     the whole rewrite exists to remove. */
  assert.doesNotMatch(formCode, /getResponse/);
  assert.match(formCode, /await getTurnstileToken\(form\)/);
});

check('a fast submit waits for the lazy-loaded widget instead of erroring', () => {
  /* The API is only fetched on first interaction, so `widgetId` is null for
     the first moments of the page. The old code posted an empty token and
     told the reader to complete a challenge that had not loaded. */
  assert.match(form, /await withTimeout\(\s*widgetReady,/);
  assert.match(form, /WIDGET_MOUNT_TIMEOUT_MS/);
});

check('the childElementCount guard is gone', () => {
  /* Correct for a visible widget, meaningless in execute mode: a healthy
     invisible widget draws no children either, so it fired for everyone. */
  assert.doesNotMatch(formCode, /childElementCount/);
});

check('no copy tells the reader to complete something invisible', () => {
  assert.doesNotMatch(formCode, /verification challenge above/);
  assert.doesNotMatch(formCode, /failed to display/);
});

check('the submit lock covers the challenge, not just the request', () => {
  /* #188's single-request guarantee. In execute mode the wait BEFORE the
     network call is the long part, so the lock has to be taken before it. */
  const lock = form.indexOf("if (form.classList.contains('is-submitting')) return;");
  const verifying = form.indexOf("setStateForForm(form, 'submitting', 'Verifying…')");
  const challenge = form.indexOf('await getTurnstileToken(form)');
  assert.ok(lock > -1 && verifying > -1 && challenge > -1);
  assert.ok(lock < verifying, 'the lock must be checked before the form is locked');
  assert.ok(verifying < challenge, 'the form must be locked before the challenge runs');
});

check('the wait is bounded on both legs', () => {
  assert.match(form, /const WIDGET_MOUNT_TIMEOUT_MS = 10_000;/);
  assert.match(form, /const CHALLENGE_TIMEOUT_MS = 12_000;/);
});

check('an interactive challenge is not cut off by our own timer', () => {
  /* interaction-only means a real person may be mid-puzzle. Timing them out
     at 12s would fail a challenge they were about to pass. */
  assert.match(form, /'before-interactive-callback': \(\) => \{/);
  assert.match(form, /clearChallengeTimeout\(\);/);
});

check('every failure callback is wired', () => {
  for (const cb of ['timeout-callback', 'expired-callback', 'error-callback']) {
    assert.match(form, new RegExp(`'${cb}'`), `${cb} not wired`);
  }
});

check('one transient challenge error does not brick the widget', () => {
  /* error-callback fires for challenge failures too, so setting the
     permanent unavailable flag from it left the reader with no way back
     short of a reload. */
  const errorCallback = form.slice(
    form.indexOf("'error-callback': () => {"),
    form.indexOf("resolveWidgetReady(widgetId)"),
  );
  assert.match(errorCallback, /if \(pendingChallenge\) \{/);
  assert.ok(
    errorCallback.indexOf('if (pendingChallenge)') <
      errorCallback.indexOf('turnstileUnavailable = true'),
    'an in-flight challenge must be settled before the widget is condemned',
  );
});

check('each submit runs a fresh challenge rather than replaying a token', () => {
  const body = form.slice(form.indexOf('turnstile.reset(id);'));
  assert.match(body, /turnstile\.reset\(id\);\s*turnstile\.execute\(id\);/);
});

check('the form reports busy to assistive tech while it works', () => {
  assert.match(form, /form\.setAttribute\('aria-busy', 'true'\)/);
  assert.match(form, /form\.removeAttribute\('aria-busy'\)/);
});

check('the mount promise is reset on client-side navigation', () => {
  /* ClientRouter swaps in a fresh holder; the previous page's widget id is
     dead and its settled promise must not be what the next submit awaits. */
  assert.match(form, /resetWidgetReady\(\);/);
  assert.match(form, /astro:page-load/);
});

check('no em dashes in the copy the visitor reads', () => {
  const messages = [...form.matchAll(/setStateForForm\([\s\S]{0,400?}?\)/g)].map((m) => m[0]);
  for (const message of messages) {
    assert.ok(!message.includes('—'), `em dash in visitor copy: ${message.slice(0, 80)}`);
  }
});

console.log('\napi shims: the old URLs still answer');

check('both routes call the action through callAction', () => {
  /* Calling `actions.subscribe(body)` bare throws ActionCalledFromServerError
     — the handler needs an action API context as `this`. */
  assert.match(subscribeRoute, /context\.callAction\(actions\.subscribe, body/);
  assert.match(contactRoute, /context\.callAction\(actions\.contact, body/);
});

check('neither route carries the dead .safe / bare-call fallbacks', () => {
  for (const [name, source] of [['subscribe', subscribeRoute], ['contact', contactRoute]]) {
    assert.doesNotMatch(code(source), /\.safe\(/, `${name} still probes a non-existent .safe()`);
    assert.doesNotMatch(code(source), /result \|\| result/, `${name} still has \`result || result\``);
  }
});

check('both stay on-demand so the prerenderer does not try to GET them', () => {
  assert.match(subscribeRoute, /export const prerender = false;/);
  assert.match(contactRoute, /export const prerender = false;/);
});

check('a non-JSON body is rejected as a 400, not a 500', () => {
  for (const source of [subscribeRoute, contactRoute]) {
    assert.match(source, /Expected a JSON body\./);
  }
});

console.log(
  failures === 0
    ? '\nAll actions/forms checks passed.\n'
    : `\n${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
