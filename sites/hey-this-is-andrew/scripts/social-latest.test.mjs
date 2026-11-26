import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const siteRoot = path.resolve(new URL('..', import.meta.url).pathname);
const raw = fs.readFileSync(path.join(siteRoot, 'src/data/social-latest.json'), 'utf8');
assert.equal(raw.includes('\u2014'), false, 'social-latest.json must not contain em dashes');

const data = JSON.parse(raw);

assert.deepEqual(
  Object.keys(data).sort(),
  ['brand', 'generated_at', 'latest', 'totals'],
  'top-level keys must match schema exactly',
);
assert.equal(data.brand, 'HTIA');
assert.equal(typeof data.generated_at, 'string');
assert.ok(Number.isFinite(Date.parse(data.generated_at)), 'generated_at must be a valid ISO timestamp');

assert.deepEqual(
  Object.keys(data.totals).sort(),
  ['facebook', 'instagram', 'tiktok', 'youtube'],
  'totals keys must match schema exactly',
);

const latestKeys = ['facebook', 'instagram_reels', 'tiktok', 'youtube', 'youtube_shorts'];
assert.deepEqual(
  Object.keys(data.latest).sort(),
  latestKeys,
  'latest keys must match schema exactly',
);

for (const key of latestKeys) {
  const items = data.latest[key];
  assert.ok(Array.isArray(items), `latest.${key} must be an array`);
  assert.ok(items.length <= 12, `latest.${key} should stay bounded`);

  for (const item of items) {
    assert.deepEqual(
      Object.keys(item).sort(),
      ['id', 'published_at', 'thumbnail', 'title', 'url', 'views'],
      `latest.${key} item must contain exact 6 keys`,
    );
    assert.equal(typeof item.id, 'string');
    if (item.title !== null) assert.equal(typeof item.title, 'string');
    if (item.url !== null) assert.equal(typeof item.url, 'string');
    if (item.published_at !== null) {
      assert.equal(typeof item.published_at, 'string');
      assert.ok(Number.isFinite(Date.parse(item.published_at)), `${key} published_at must parse as ISO date`);
    }
    if (item.views !== null) assert.equal(typeof item.views, 'number');
    if (item.thumbnail !== null) {
      assert.equal(typeof item.thumbnail, 'string');
      assert.ok(!item.thumbnail.includes('fbcdn.net') && !item.thumbnail.includes('cdninstagram.com'));
      if (item.thumbnail.startsWith('/social-thumbs/')) {
        const assetPath = path.join(siteRoot, 'public', item.thumbnail.slice(1));
        assert.ok(fs.existsSync(assetPath), `missing cached thumbnail at ${assetPath}`);
      }
    }
  }
}

console.log('social-latest: ok');
