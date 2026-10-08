/*
  Broadcast detection, air-date selection and thumbnail normalisation
  (src/lib/platforms/youtube.ts).

  Written against a real production failure. A livestream titled
  "FUTURAMA PANEL LIVE!" synced as:

      _type: "video"      isLive: false
      publishedAt: 2026-07-10T21:58:39Z      (it aired on the 31st)
      thumbnailUrl: .../maxresdefault_live.jpg   (broken once it ended)

  ...and so appeared in Recent Videos, three weeks mis-dated, with a grey
  placeholder where the thumbnail should be. Three separate defects, one
  root cause: the sync never asked YouTube whether the video was a broadcast.

  Offline and pure: plain `node scripts/youtube-live.test.mjs`.
*/
import assert from 'node:assert/strict';
import {
  detectIsLive,
  pickPublishedAt,
  pickThumbnail,
  normalizeThumbnailUrl,
} from '../src/lib/platforms/youtube.ts';

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
  The actual API shape for the stream that caused this, reconstructed from the
  record it produced in src/data/videos.json. Note the tags: no `live` among
  them, which is precisely why the old tag-sniffing check missed it.
*/
const FUTURAMA = {
  id: 'WI0QcnH_Bgw',
  snippet: {
    title: 'FUTURAMA PANEL LIVE!',
    publishedAt: '2026-07-10T21:58:39Z',
    liveBroadcastContent: 'none', // already ended by the time the sync ran
    tags: ['Movies', 'Film', 'TV', 'Gaming', 'Events'],
    thumbnails: { maxres: { url: 'https://i.ytimg.com/vi/WI0QcnH_Bgw/maxresdefault_live.jpg' } },
  },
  liveStreamingDetails: {
    scheduledStartTime: '2026-07-10T22:00:00Z',
    actualStartTime: '2026-08-01T02:55:12Z',
    actualEndTime: '2026-08-01T03:30:44Z',
  },
};

/*
  A "go live now" from the phone app: plus button, Live, straight on air.
  Nothing was scheduled, so there is NO scheduledStartTime — only an actual
  start. This is the shape that actually caused the incident.

  publishedAt is 21 days before the stream happened. That is not a scheduling
  artifact (this broadcast was never scheduled); mobile live appears to reuse a
  persistent broadcast resource, so publishedAt reports when that resource
  first existed rather than when this stream ran. Whatever the cause, the field
  cannot be trusted for a broadcast.
*/
const UNSCHEDULED_MOBILE_LIVE = {
  id: 'WI0QcnH_Bgw',
  snippet: {
    title: 'FUTURAMA PANEL LIVE!',
    publishedAt: '2026-07-10T21:58:39Z',
    liveBroadcastContent: 'none',
    tags: ['Movies', 'Film', 'TV', 'Gaming', 'Events'],
    thumbnails: { maxres: { url: 'https://i.ytimg.com/vi/WI0QcnH_Bgw/maxresdefault_live.jpg' } },
  },
  liveStreamingDetails: {
    // No scheduledStartTime — it was never scheduled.
    actualStartTime: '2026-08-01T02:55:12Z',
    actualEndTime: '2026-08-01T03:04:40Z',
  },
};

const ORDINARY_UPLOAD = {
  id: 'z7gN_79C3BM',
  snippet: {
    title: 'Marvel Just Announced EVERYTHING for SDCC 2026',
    publishedAt: '2026-07-10T16:00:00Z',
    liveBroadcastContent: 'none',
    tags: ['Movies', 'Film', 'Marvel'],
    thumbnails: { maxres: { url: 'https://i.ytimg.com/vi/z7gN_79C3BM/maxresdefault.jpg' } },
  },
  // no liveStreamingDetails — this is the discriminator
};

console.log('Broadcast detection:');

test('an ENDED broadcast is detected even with liveBroadcastContent "none"', () => {
  /*
    The regression case. By the time a sync runs the stream is usually over,
    so liveBroadcastContent has already fallen back to "none" — the only
    lasting evidence is liveStreamingDetails, which YouTube keeps forever.
  */
  assert.equal(detectIsLive(FUTURAMA), true);
});

test('a broadcast is detected without any "live" tag', () => {
  assert.ok(
    !FUTURAMA.snippet.tags.some((t) => t.toLowerCase().includes('live')),
    'fixture must not carry a live tag, or it proves nothing',
  );
  assert.equal(detectIsLive(FUTURAMA), true);
});

test('a currently-live video is detected', () => {
  const item = { snippet: { liveBroadcastContent: 'live', tags: [] } };
  assert.equal(detectIsLive(item), true);
});

test('an upcoming/scheduled stream is detected', () => {
  const item = {
    snippet: { liveBroadcastContent: 'upcoming', tags: [] },
    liveStreamingDetails: { scheduledStartTime: '2026-09-01T18:00:00Z' },
  };
  assert.equal(detectIsLive(item), true);
});

test('an ordinary upload is NOT a broadcast', () => {
  assert.equal(detectIsLive(ORDINARY_UPLOAD), false);
});

test('the legacy tag heuristic still counts, so nothing silently un-lives', () => {
  // Kept as an OR: it can only add. A video a human tagged `live` before this
  // change must not flip back to a normal video on the next sync.
  for (const tag of ['live', 'Live Stream', 'LIVES']) {
    assert.equal(detectIsLive({ snippet: { liveBroadcastContent: 'none', tags: [tag] } }), true, tag);
  }
});

test('missing/garbage input does not throw', () => {
  for (const item of [null, undefined, {}, { snippet: null }, { snippet: { tags: 'nope' } }]) {
    assert.equal(detectIsLive(item), false, JSON.stringify(item));
  }
});

console.log('\nAir date:');

test('a broadcast is dated by actualStartTime, not publishedAt', () => {
  // The bug: publishedAt is when the broadcast was CREATED (10 July); it
  // actually aired on the 31st (early UTC on the 1st).
  assert.equal(pickPublishedAt(FUTURAMA), '2026-08-01T02:55:12Z');
  assert.notEqual(pickPublishedAt(FUTURAMA), FUTURAMA.snippet.publishedAt);
});

test('an un-aired stream falls back to scheduledStartTime', () => {
  const upcoming = {
    snippet: { publishedAt: '2026-07-01T00:00:00Z' },
    liveStreamingDetails: { scheduledStartTime: '2026-09-01T18:00:00Z' },
  };
  assert.equal(pickPublishedAt(upcoming), '2026-09-01T18:00:00Z');
});

test('an UNSCHEDULED mobile live is dated by when it went on air', () => {
  // The real incident. A stream started from the phone that afternoon was
  // stamped 21 days earlier by publishedAt; actualStartTime is the only field
  // that reflects when it actually happened.
  assert.equal(pickPublishedAt(UNSCHEDULED_MOBILE_LIVE), '2026-08-01T02:55:12Z');
  assert.notEqual(
    pickPublishedAt(UNSCHEDULED_MOBILE_LIVE),
    UNSCHEDULED_MOBILE_LIVE.snippet.publishedAt,
  );
});

test('...and is still detected as a broadcast with no scheduledStartTime', () => {
  // liveBroadcastContent has already reverted to "none" and there is no live
  // tag, so liveStreamingDetails is the only thing identifying it.
  assert.equal(detectIsLive(UNSCHEDULED_MOBILE_LIVE), true);
});

test('an ordinary upload keeps snippet.publishedAt', () => {
  assert.equal(pickPublishedAt(ORDINARY_UPLOAD), '2026-07-10T16:00:00Z');
});

test('no date anywhere yields an empty string, never undefined', () => {
  assert.equal(pickPublishedAt({}), '');
  assert.equal(pickPublishedAt(null), '');
});

console.log('\nThumbnail normalisation:');

test('the _live suffix is stripped', () => {
  assert.equal(
    normalizeThumbnailUrl('https://i.ytimg.com/vi/WI0QcnH_Bgw/maxresdefault_live.jpg'),
    'https://i.ytimg.com/vi/WI0QcnH_Bgw/maxresdefault.jpg',
  );
});

test('every live rendition variant normalises', () => {
  for (const r of ['maxresdefault', 'sddefault', 'hqdefault', 'mqdefault']) {
    assert.equal(
      normalizeThumbnailUrl(`https://i.ytimg.com/vi/abc/${r}_live.jpg`),
      `https://i.ytimg.com/vi/abc/${r}.jpg`,
      r,
    );
  }
});

test('a query string survives the strip', () => {
  assert.equal(
    normalizeThumbnailUrl('https://i.ytimg.com/vi/abc/hqdefault_live.jpg?sqp=xyz'),
    'https://i.ytimg.com/vi/abc/hqdefault.jpg?sqp=xyz',
  );
});

test('an ordinary thumbnail is untouched', () => {
  const url = 'https://i.ytimg.com/vi/abc/maxresdefault.jpg';
  assert.equal(normalizeThumbnailUrl(url), url);
});

test('a video id containing "_live" is not mangled', () => {
  // Ids can contain underscores; only the trailing rendition suffix may go.
  const url = 'https://i.ytimg.com/vi/a_live_b/maxresdefault.jpg';
  assert.equal(normalizeThumbnailUrl(url), url);
});

test('empty input yields empty output', () => {
  assert.equal(normalizeThumbnailUrl(''), '');
});

test('pickThumbnail normalises what it selects', () => {
  assert.equal(
    pickThumbnail(FUTURAMA.snippet.thumbnails),
    'https://i.ytimg.com/vi/WI0QcnH_Bgw/maxresdefault.jpg',
  );
});

test('pickThumbnail still prefers the largest rendition', () => {
  const thumbs = {
    maxres: { url: 'https://i.ytimg.com/vi/abc/maxresdefault.jpg' },
    high: { url: 'https://i.ytimg.com/vi/abc/hqdefault.jpg' },
  };
  assert.equal(pickThumbnail(thumbs), 'https://i.ytimg.com/vi/abc/maxresdefault.jpg');
  assert.equal(pickThumbnail(null), '');
});

console.log('\nEnd-to-end: the record this produces:');

test('FUTURAMA would now be typed `live` and dated to its air time', () => {
  /*
    Mirrors planVideoSync's typing rule (scripts/sync-youtube.mjs): short ->
    live -> video, unless a human set manualTypeOverride. `live` is what keeps
    it out of getVideosUnified(), which filters on effectiveType === 'video'.
  */
  const isShort = false;
  const isLive = detectIsLive(FUTURAMA);
  const docType = isShort ? 'short' : isLive ? 'live' : 'video';

  assert.equal(docType, 'live', 'must not be typed `video` — that is what put it in Recent Videos');
  assert.equal(pickPublishedAt(FUTURAMA), '2026-08-01T02:55:12Z');
  assert.ok(!pickThumbnail(FUTURAMA.snippet.thumbnails).includes('_live'));
});

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
