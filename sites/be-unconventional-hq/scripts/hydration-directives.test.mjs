/*
  Static guard on hydration directives that are load-bearing rather than
  stylistic.

  WHY THIS IS A SEPARATE, STATIC TEST

  The calendar's directive has now regressed twice — 1694a5c shipped
  client:idle and hotfix 8314698 reverted it; a later branch shipped
  client:idle again for the same "defer it for LCP" reason. Neither the
  Lighthouse gate nor the e2e suite catches it:

    - e2e-calendar-modal.test.mjs asserts the real grid renders, which has
      teeth against the empty-shell symptom (verified: it fails against a
      hooks-order violation). But headless Chrome on CI hardware goes idle
      almost immediately, so requestIdleCallback fires promptly and the
      client:idle build passes it. Confirmed empirically — that suite is
      green against both directives.
    - The Lighthouse gate scores client:idle slightly HIGHER, so it actively
      rewards the regression.

  The bug is a race that only loses on a real device on a cold connection,
  which is the one environment CI does not have. So the directive is pinned
  by reading the source instead. That is deterministic, runs in milliseconds
  and needs no browser — and unlike the runtime checks it cannot be fooled by
  a fast machine.

  Run by `npm test`, so it gates every push rather than only the e2e job.
*/
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

let passed = 0;
let failed = 0;

function test(name, fn) {
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

/*
  Each entry is a directive that must not drift, plus the reason, so a failure
  explains itself instead of just naming a string that did not match.
*/
const PINNED = [
  {
    file: 'src/components/SpanningCalendarModal.astro',
    island: 'DesktopCalendar',
    required: 'client:load',
    forbidden: ['client:idle', 'client:visible', 'client:only'],
    why: [
      'DesktopCalendar renders only a skeleton until it hydrates, so the',
      'directive decides whether the modal contains a calendar at all.',
      'client:idle waits on requestIdleCallback and the events page never',
      'reliably goes idle (kenburns loop, scroll handlers, IntersectionObservers,',
      'GTM/Partytown), so hydration can be starved and the modal opens to an',
      'empty shell — shipped in 1694a5c, reverted in hotfix 8314698.',
      'client:visible never fires inside a closed <dialog>. client:only drops',
      'the SSR skeleton and re-introduces the mismatch it was added to fix.',
    ].join('\n      '),
  },
];

console.log('Hydration directive pins:');

for (const pin of PINNED) {
  const abs = path.join(ROOT, pin.file);

  test(`${pin.file} exists`, () => {
    assert.ok(fs.existsSync(abs), `expected ${pin.file} to exist`);
  });

  if (!fs.existsSync(abs)) continue;

  const source = fs.readFileSync(abs, 'utf8');

  /*
    Matched against the element itself, not the whole file: the rationale
    comment above the island names every rejected directive in prose, so a
    bare `source.includes('client:idle')` would fire on the documentation
    that exists to prevent the bug.
  */
  const tag = new RegExp(`<${pin.island}\\b[^>]*>`, 'g');
  const tags = source.match(tag) ?? [];

  test(`${pin.island} island is present in ${path.basename(pin.file)}`, () => {
    assert.ok(tags.length > 0, `no <${pin.island} ...> tag found`);
  });

  test(`${pin.island} uses ${pin.required}`, () => {
    const usesRequired = tags.some((t) => t.includes(pin.required));
    assert.ok(
      usesRequired,
      `<${pin.island}> must be hydrated with ${pin.required}.\n\n      ${pin.why}\n`,
    );
  });

  for (const bad of pin.forbidden) {
    test(`${pin.island} does not use ${bad}`, () => {
      const usesBad = tags.some((t) => t.includes(bad));
      assert.ok(
        !usesBad,
        `<${pin.island}> must not use ${bad}.\n\n      ${pin.why}\n`,
      );
    });
  }
}

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
