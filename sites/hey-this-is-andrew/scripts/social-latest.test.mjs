import assert from 'node:assert/strict';
import fs from 'node:fs';

const raw = fs.readFileSync(new URL('../src/data/social-latest.json', import.meta.url), 'utf8');
assert.equal(raw.includes('\u2014'), false, 'social-latest.json must not contain em dashes');

const data = JSON.parse(raw);

assert.deepEqual(
  Object.keys(data).sort(),
  ['platforms', 'site', 'updated_at'],
  'top-level keys must match schema exactly',
);
assert.equal(data.site, 'hey-this-is-andrew');
assert.equal(typeof data.updated_at, 'string');
assert.ok(Number.isFinite(Date.parse(data.updated_at)), 'updated_at must be a valid ISO timestamp');

const expectedPlatforms = ['facebook', 'instagram', 'tiktok', 'youtube'];
assert.deepEqual(
  Object.keys(data.platforms).sort(),
  expectedPlatforms,
  'platforms keys must be youtube, instagram, tiktok, facebook',
);

for (const plat of expectedPlatforms) {
  const entry = data.platforms[plat];
  if (entry === null) continue;

  assert.deepEqual(
    Object.keys(entry).sort(),
    ['followers', 'handle', 'latest', 'views_28d', 'watch_hours_12mo'],
    `${plat} must contain exact schema keys`,
  );
  if (entry.handle !== null) assert.equal(typeof entry.handle, 'string');
  if (entry.followers !== null) assert.equal(typeof entry.followers, 'number');
  if (entry.views_28d !== null) assert.equal(typeof entry.views_28d, 'number');
  if (plat !== 'youtube') {
    assert.equal(entry.watch_hours_12mo, null, `${plat}.watch_hours_12mo must be null outside youtube`);
  } else if (entry.watch_hours_12mo !== null) {
    assert.equal(typeof entry.watch_hours_12mo, 'number');
  }

  assert.ok(Array.isArray(entry.latest), `${plat}.latest must be an array`);
  assert.ok(entry.latest.length <= 5, `${plat}.latest must contain at most 5 items`);

  for (const item of entry.latest) {
    assert.deepEqual(
      Object.keys(item).sort(),
      ['published_at', 'title', 'url', 'views'],
      `${plat}.latest item must contain exact keys`,
    );
    if (item.title !== null) assert.equal(typeof item.title, 'string');
    if (item.url !== null) assert.equal(typeof item.url, 'string');
    if (item.published_at !== null) {
      assert.equal(typeof item.published_at, 'string');
      assert.ok(Number.isFinite(Date.parse(item.published_at)), `${plat} item published_at must parse as ISO date`);
    }
    if (item.views !== null) assert.equal(typeof item.views, 'number');
  }
}

console.log('social-latest: ok');
