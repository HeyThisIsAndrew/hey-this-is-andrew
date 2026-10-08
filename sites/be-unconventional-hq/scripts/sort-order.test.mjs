/**
 * The editorial ordering override.
 *
 * ─── WHAT THIS IS GUARDING ──────────────────────────────────────────────────
 * Publish order and episode order are different things. The Lanterns episode 2
 * review went out on 2026-09-02 and the episode 3 review on 2026-09-01, because
 * that is the order they were finished in. By publish date every row containing
 * them read 5, 4, 2, 3 — the reviews out of sequence with the show.
 *
 * `sortDate` fixes the ORDER without touching the date anyone sees. The failure
 * mode it has is silence: the field is carried by the sync, stored in the JSON,
 * shown in the CMS, and STILL never reaches the feed unless it is also named in
 * the video mapping's whitelist. The first attempt did exactly that and nothing
 * moved, so the whitelist is asserted here explicitly.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(join(here, '..', ...p), 'utf8');
const store = JSON.parse(read('src', 'data', 'videos.json'));
const docs = Array.isArray(store) ? store : store.documents || store.items || [];

test('sortDate survives every hop between the store and the feed', () => {
  /*
    THE WHITELIST IS THE TRAP. `mapDoc` in videos.ts names each field it copies,
    so a field the sync preserves perfectly is still dropped here.
  */
  const videos = read('src', 'lib', 'videos.ts');
  assert.match(videos, /sortDate: doc\.sortDate/, 'the video mapping must copy it, or it never arrives');

  /* And the sync must carry it, or the next run silently clears it. */
  const sync = read('scripts', 'sync-youtube.mjs');
  assert.match(
    sync,
    /sortDate: existingDoc\?\.sortDate/,
    'an editorial field not listed in the sync is wiped on the next run',
  );

  /* And the sort must actually prefer it. */
  const items = read('src', 'lib', 'feed-items.ts');
  assert.match(items, /item\.sortDate \|\| item\.date/, 'the override has to win over the publish date');
  assert.match(
    items,
    /function byNewest[\s\S]{0,160}sortTime\(b\) - sortTime\(a\)/,
    'there is one sort; it must be the one that reads the override',
  );

  /* And an editor must be able to set it. */
  const cms = read('src', 'components', 'admin', 'LocalCmsApp.tsx');
  assert.match(cms, /update\('sortDate'/, 'the CMS must expose the field');
});

/*
  The date a READER sees is never the override. Claiming a piece went out on a
  day it did not is a lie rather than a preference, and it would reach the
  cards, the metadata and the feeds.
*/
test('the override changes order only, never the published date', () => {
  const items = read('src', 'lib', 'feed-items.ts');
  assert.doesNotMatch(
    items,
    /date:\s*\w+\.sortDate/,
    'sortDate must never be assigned onto the item date',
  );
});

test('the Lanterns reviews are in episode order', () => {
  const reviews = [];
  for (const doc of docs) {
    if (doc._type !== 'video') continue;
    const m = /Lanterns Episode (\d+) Review/.exec(doc.title || '');
    if (m) reviews.push({ ep: Number(m[1]), doc });
  }
  assert.ok(reviews.length >= 4, `expected the review videos in the store, found ${reviews.length}`);

  /* Newest first is how every row renders, so descending episode number must
     match descending sort date. */
  const keyed = reviews.map(({ ep, doc }) => ({
    ep,
    t: new Date(doc.sortDate || doc.publishedAt).getTime(),
  }));

  for (const a of keyed) {
    for (const b of keyed) {
      if (a.ep <= b.ep) continue;
      assert.ok(
        a.t > b.t,
        `episode ${a.ep} must sort ahead of episode ${b.ep}; ` +
          `got ${new Date(a.t).toISOString().slice(0, 10)} vs ${new Date(b.t).toISOString().slice(0, 10)}`,
      );
    }
  }
});
