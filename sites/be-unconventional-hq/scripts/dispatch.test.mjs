/**
 * Offline unit tests for src/lib/dispatch.ts (Dispatch Log grouping, #34 T4).
 *
 * Run:  node scripts/dispatch.test.mjs
 */
import assert from 'node:assert/strict';
import { groupIntoDispatchDays } from '../src/lib/dispatch.ts';

let passed = 0;
const test = (name, fn) => {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err.message}`);
    process.exitCode = 1;
  }
};

const item = (title, timestamp, kind = 'video') => ({ title, timestamp, kind });
// SDCC 2026 runs Jul 23–26. Noon UTC ≈ same calendar day in the brand TZ (LA).
const START = '2026-07-23';

console.log('dispatch.ts');

test('start date is Day 1', () => {
  const days = groupIntoDispatchDays([item('Keynote', '2026-07-23T19:00:00Z')], START);
  assert.equal(days.length, 1);
  assert.equal(days[0].label, 'Day 1');
});

test('subsequent days count up', () => {
  const days = groupIntoDispatchDays(
    [item('a', '2026-07-23T19:00:00Z'), item('b', '2026-07-24T19:00:00Z'), item('c', '2026-07-26T19:00:00Z')],
    START,
  );
  assert.deepEqual(days.map((d) => d.label), ['Day 1', 'Day 2', 'Day 4']);
});

test('pre-event coverage collapses into a single leading Day 0', () => {
  const days = groupIntoDispatchDays(
    [item('line1', '2026-07-21T19:00:00Z'), item('line2', '2026-07-22T19:00:00Z'), item('keynote', '2026-07-23T19:00:00Z')],
    START,
  );
  assert.deepEqual(days.map((d) => d.label), ['Day 0', 'Day 1']);
  assert.equal(days[0].items.length, 2, 'both pre-event items share Day 0');
});

test('Day 0 always leads even if added out of order', () => {
  const days = groupIntoDispatchDays(
    [item('keynote', '2026-07-23T19:00:00Z'), item('line', '2026-07-22T19:00:00Z')],
    START,
  );
  assert.equal(days[0].label, 'Day 0');
  assert.equal(days[1].label, 'Day 1');
});

test('items within a day sort ascending by timestamp', () => {
  const days = groupIntoDispatchDays(
    [item('evening', '2026-07-23T23:00:00Z'), item('morning', '2026-07-23T16:00:00Z')],
    START,
  );
  assert.deepEqual(days[0].items.map((i) => i.title), ['morning', 'evening']);
});

test('days sort ascending (diary reads forward)', () => {
  const days = groupIntoDispatchDays(
    [item('c', '2026-07-26T19:00:00Z'), item('a', '2026-07-23T19:00:00Z'), item('b', '2026-07-24T19:00:00Z')],
    START,
  );
  assert.deepEqual(days.map((d) => d.ymd), ['2026-07-23', '2026-07-24', '2026-07-26']);
});

test('mixed media coexist in the same day bucket', () => {
  const days = groupIntoDispatchDays(
    [item('short', '2026-07-23T16:00:00Z', 'short'), item('article', '2026-07-23T18:00:00Z', 'article')],
    START,
  );
  assert.equal(days[0].items.length, 2);
  assert.deepEqual(days[0].items.map((i) => i.kind), ['short', 'article']);
});

test('dateLabel is a Date-free short date', () => {
  const days = groupIntoDispatchDays([item('k', '2026-07-24T19:00:00Z')], START);
  assert.equal(days[0].dateLabel, 'Jul 24');
});

test('unparseable timestamps are dropped, not crashed on', () => {
  const days = groupIntoDispatchDays(
    [item('good', '2026-07-23T19:00:00Z'), item('bad', 'not-a-date'), item('empty', '')],
    START,
  );
  assert.equal(days.length, 1);
  assert.equal(days[0].items.length, 1);
});

test('missing/invalid event start → empty (no diary possible)', () => {
  assert.deepEqual(groupIntoDispatchDays([item('a', '2026-07-23T19:00:00Z')], null), []);
  assert.deepEqual(groupIntoDispatchDays([item('a', '2026-07-23T19:00:00Z')], undefined), []);
});

test('empty input → empty output', () => {
  assert.deepEqual(groupIntoDispatchDays([], START), []);
  assert.deepEqual(groupIntoDispatchDays(undefined, START), []);
});

test('datetime-precision event start is sliced safely', () => {
  const days = groupIntoDispatchDays([item('k', '2026-07-23T19:00:00Z')], '2026-07-23T00:00:00Z');
  assert.equal(days[0].label, 'Day 1');
});

console.log(
  process.exitCode ? `FAILED (${passed} passed)` : `All ${passed} tests passed.`,
);
