/**
 * Offline unit tests for scripts/update-metrics.mjs (#34 T6).
 *
 * Run:  node scripts/metrics.test.mjs
 */
import assert from 'node:assert/strict';
import {
  appendSnapshot,
  computeVelocity7d,
  planMetricsUpdate,
  metricsDocId,
  MAX_SNAPSHOTS,
} from './update-metrics.mjs';

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

const snap = (date, viewCount) => ({ date, viewCount });

console.log('update-metrics.mjs');

// ── appendSnapshot ───────────────────────────────────────────────────────────
test('appendSnapshot: adds a new day, keeps ascending order', () => {
  const out = appendSnapshot([snap('2026-07-10', 100)], '2026-07-11', 150);
  assert.deepEqual(out, [snap('2026-07-10', 100), snap('2026-07-11', 150)]);
});

test('appendSnapshot: idempotent by date — same day overwrites, no dupes', () => {
  const out = appendSnapshot([snap('2026-07-11', 100)], '2026-07-11', 175);
  assert.deepEqual(out, [snap('2026-07-11', 175)]);
});

test('appendSnapshot: re-sorts an out-of-order insert', () => {
  const out = appendSnapshot([snap('2026-07-11', 100)], '2026-07-10', 50);
  assert.deepEqual(out.map((s) => s.date), ['2026-07-10', '2026-07-11']);
});

test('appendSnapshot: bounded to MAX_SNAPSHOTS (keeps newest)', () => {
  let list = [];
  for (let d = 1; d <= MAX_SNAPSHOTS + 5; d++) {
    list = appendSnapshot(list, `2026-07-${String(d).padStart(2, '0')}`, d * 10);
  }
  assert.equal(list.length, MAX_SNAPSHOTS);
  assert.equal(list[list.length - 1].date, `2026-07-${MAX_SNAPSHOTS + 5}`);
  assert.equal(list[0].date, '2026-07-06'); // first 5 dropped
});

test('appendSnapshot: null/undefined history → single-entry list', () => {
  assert.deepEqual(appendSnapshot(undefined, '2026-07-11', 10), [snap('2026-07-11', 10)]);
});

// ── computeVelocity7d ────────────────────────────────────────────────────────
test('velocity: single snapshot → 0 (no delta yet)', () => {
  assert.equal(computeVelocity7d([snap('2026-07-11', 100)]), 0);
});

test('velocity: full 7-day window delta', () => {
  const list = [snap('2026-07-04', 1000), snap('2026-07-11', 1700)];
  assert.equal(computeVelocity7d(list), 700);
});

test('velocity: baseline is the earliest snapshot INSIDE the 7-day window', () => {
  // 07-01 is outside the window (>7d before 07-11); baseline should be 07-05.
  const list = [snap('2026-07-01', 500), snap('2026-07-05', 1000), snap('2026-07-11', 1600)];
  assert.equal(computeVelocity7d(list), 600); // 1600 - 1000
});

test('velocity: partial history (<7 days) uses the oldest available', () => {
  const list = [snap('2026-07-09', 200), snap('2026-07-11', 260)];
  assert.equal(computeVelocity7d(list), 60);
});

test('velocity: clamps negative (count correction) to 0', () => {
  const list = [snap('2026-07-04', 1000), snap('2026-07-11', 900)];
  assert.equal(computeVelocity7d(list), 0);
});

test('velocity: empty → 0', () => {
  assert.equal(computeVelocity7d([]), 0);
  assert.equal(computeVelocity7d(undefined), 0);
});

// ── planMetricsUpdate ────────────────────────────────────────────────────────
test('plan: new video seeds doc + first snapshot, velocity 0', () => {
  const p = planMetricsUpdate('vid1', 100, null, '2026-07-11', new Date('2026-07-11T12:00:00Z'));
  assert.equal(p._id, 'metrics-vid1');
  assert.equal(p.createIfNotExists._type, 'videoMetrics');
  assert.deepEqual(p.patch.set.snapshots, [snap('2026-07-11', 100)]);
  assert.equal(p.patch.set.viewVelocity7d, 0);
  assert.equal(p.patch.set.lastComputedAt, '2026-07-11T12:00:00.000Z');
});

test('plan: existing doc appends today and recomputes velocity', () => {
  const existing = { snapshots: [snap('2026-07-04', 1000)] };
  const p = planMetricsUpdate('vid1', 1700, existing, '2026-07-11');
  assert.equal(p.patch.set.snapshots.length, 2);
  assert.equal(p.patch.set.viewVelocity7d, 700);
});

test('plan: same-day re-run is idempotent (overwrites today, no dupe)', () => {
  const first = planMetricsUpdate('vid1', 100, null, '2026-07-11');
  const second = planMetricsUpdate('vid1', 120, { snapshots: first.patch.set.snapshots }, '2026-07-11');
  assert.equal(second.patch.set.snapshots.length, 1);
  assert.equal(second.patch.set.snapshots[0].viewCount, 120);
});

test('metricsDocId is deterministic', () => {
  assert.equal(metricsDocId('abc'), 'metrics-abc');
});

console.log(
  process.exitCode ? `FAILED (${passed} passed)` : `All ${passed} tests passed.`,
);
