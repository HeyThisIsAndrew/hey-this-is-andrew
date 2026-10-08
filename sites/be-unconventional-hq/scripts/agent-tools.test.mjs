/*
  The date and bounds logic behind the WebMCP tools (#192, task 3).

  ─── WHY THIS EXISTS SEPARATELY FROM THE BROWSER SUITE ────────────────────
  `scripts/e2e-webmcp.test.mjs` drives the real `document.modelContext` and
  proves the tools register and run. It cannot prove the events filter is
  right, because the content store holds no upcoming events: both entries are
  months past, so the end-to-end assertion runs against an empty array and
  would pass no matter what the filter did. This pins it against fixed dates.

  The timezone case below is the one that matters. `src/data/videos.json`
  stores calendar dates as "YYYY-MM-DD" strings, and `new Date("2026-09-03")`
  parses as UTC midnight, which is 2026-09-02 in California. An event would
  vanish from an agent's answer a day before it happened, for exactly the
  audience the site is aimed at. CLAUDE.md hard rule 1.
*/
import assert from 'node:assert/strict';
import { selectUpcomingEvents, clampLimit } from '../src/lib/agent-tools.ts';

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (error) { failures += 1; console.error(`  ✗ ${name}\n      ${error.message}`); }
}

const event = (title, date, endDate) => ({
  id: title, title, type: 'event', url: `/events/${title}`, date, endDate,
});

console.log('\nselectUpcomingEvents');

check('finished events are dropped', () => {
  const out = selectUpcomingEvents(
    [event('SDCC', '2026-07-22', '2026-07-26'), event('Future', '2026-12-01')],
    new Date('2026-09-03T12:00:00Z'),
  );
  assert.deepEqual(out.map((e) => e.title), ['Future']);
});

check('a multi-day event is still live on its LAST day, not completed', () => {
  /* An event is not over on its first morning, and it is not over on its last
     one either. Returning "completed" here would tell an agent the reader had
     missed something still happening. */
  const out = selectUpcomingEvents(
    [event('Comic Con', '2026-09-01', '2026-09-05')],
    new Date('2026-09-05T18:00:00Z'),
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].status, 'live');
});

check('a single-day event happening today reads as live, not completed', () => {
  const out = selectUpcomingEvents(
    [event('One Day', '2026-09-03')],
    new Date('2026-09-03T20:00:00Z'),
  );
  assert.equal(out[0]?.status, 'live');
});

check('an event starting today survives the UTC-vs-Pacific boundary', () => {
  /*
    The regression this guards. At 06:00 UTC on the 3rd it is still 23:00 on
    the 2nd in America/Los_Angeles, so "today" is 2026-09-02 and an event
    dated the 3rd is UPCOMING. Naive UTC date maths reports it as started, and
    a day later would report it finished and drop it entirely.
  */
  const out = selectUpcomingEvents(
    [event('Tomorrow In LA', '2026-09-03')],
    new Date('2026-09-03T06:00:00Z'),
  );
  assert.equal(out.length, 1, 'the event was dropped across the date boundary');
  assert.equal(out[0].status, 'upcoming');
});

check('cancelled events are withheld even when their date is ahead', () => {
  const cancelled = { ...event('Called Off', '2026-12-01'), status: 'cancelled' };
  /* `status` rides on the event document, and getEventStatus honours it over
     the calendar. An agent should not send someone to a cancelled event. */
  const out = selectUpcomingEvents([cancelled], new Date('2026-09-03T12:00:00Z'));
  assert.deepEqual(out, []);
});

check('results are soonest first regardless of input order', () => {
  const out = selectUpcomingEvents(
    [event('Later', '2026-12-01'), event('Sooner', '2026-10-01'), event('Middle', '2026-11-01')],
    new Date('2026-09-03T12:00:00Z'),
  );
  assert.deepEqual(out.map((e) => e.title), ['Sooner', 'Middle', 'Later']);
});

check('non-events and undated rows are ignored', () => {
  const out = selectUpcomingEvents(
    [
      { id: 'v', title: 'A video', type: 'video', url: '/v', date: '2026-12-01' },
      { id: 'e', title: 'Undated', type: 'event', url: '/e' },
      event('Real', '2026-12-02'),
    ],
    new Date('2026-09-03T12:00:00Z'),
  );
  assert.deepEqual(out.map((e) => e.title), ['Real']);
});

check('the limit is applied after sorting, not before', () => {
  /* Slicing first would return whichever two happened to be listed first,
     which is not the same as the two soonest. */
  const out = selectUpcomingEvents(
    [event('C', '2026-12-01'), event('A', '2026-10-01'), event('B', '2026-11-01')],
    new Date('2026-09-03T12:00:00Z'),
    2,
  );
  assert.deepEqual(out.map((e) => e.title), ['A', 'B']);
});

console.log('\nclampLimit');

check('a sane number passes through', () => {
  assert.equal(clampLimit(5, 10, 50), 5);
});

check('junk falls back to the default', () => {
  /* An agent can send anything. None of these should reach a slice(). */
  for (const bad of [undefined, null, 'ten', NaN, Infinity, 0, -3, {}]) {
    assert.equal(clampLimit(bad, 10, 50), 10, `clampLimit(${JSON.stringify(bad)}) was not defaulted`);
  }
});

check('an oversized request is capped rather than honoured', () => {
  assert.equal(clampLimit(9999, 10, 50), 50);
  assert.equal(clampLimit(Number.MAX_SAFE_INTEGER, 10, 50), 50);
});

check('a fractional limit is floored, not passed to slice()', () => {
  assert.equal(clampLimit(7.9, 10, 50), 7);
});

console.log(
  failures === 0
    ? '\n✅ WebMCP tool logic checks passed.\n'
    : `\n❌ ${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
