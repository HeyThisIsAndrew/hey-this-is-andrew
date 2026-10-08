/**
 * Offline unit tests for src/lib/live-status.ts — no network, no credentials.
 *
 * Run:  node scripts/live-status.test.mjs
 * (Node 22.18+ strips the imported TypeScript's types natively.)
 */
import assert from 'node:assert/strict';
import {
  checkLiveStatus,
  createYouTubeLiveProvider,
} from '../src/lib/live-status.ts';
import { createYouTubeClient } from '../src/lib/platforms/youtube.ts';

let passed = 0;
const test = async (name, fn) => {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err.message}`);
    process.exitCode = 1;
  }
};

/** Stub fetch returning a canned YouTube search.list payload. */
const fetchReturning = (payload, status = 200) => async () =>
  new Response(JSON.stringify(payload), { status });

const LIVE_PAYLOAD = {
  items: [{ id: { videoId: 'dQw4w9WgXcQ' }, snippet: { title: 'SDCC Live Show' } }],
};
const OFFLINE_PAYLOAD = { items: [] };

// Real YouTube client with a stubbed fetch → exercises the full mapping path
// (search.list response → LiveStatus → LiveStreamInfo) without any network.
const provider = (fetchImpl) =>
  createYouTubeLiveProvider({
    client: createYouTubeClient({ apiKey: 'k', fetchImpl }),
    channelId: 'UCx',
  });

console.log('live-status.ts');

await test('YouTube provider maps a live search hit to LiveStreamInfo', async () => {
  const info = await provider(fetchReturning(LIVE_PAYLOAD)).check();
  assert.deepEqual(info, {
    platform: 'youtube',
    videoId: 'dQw4w9WgXcQ',
    title: 'SDCC Live Show',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  });
});

await test('YouTube provider returns null when the channel is offline', async () => {
  assert.equal(await provider(fetchReturning(OFFLINE_PAYLOAD)).check(), null);
});

await test('checkLiveStatus: offline everywhere → isLive false, no errors', async () => {
  const result = await checkLiveStatus([provider(fetchReturning(OFFLINE_PAYLOAD))]);
  assert.equal(result.isLive, false);
  assert.deepEqual(result.streams, []);
  assert.deepEqual(result.errors, []);
  assert.ok(!Number.isNaN(Date.parse(result.checkedAt)), 'checkedAt is ISO-8601');
});

await test('checkLiveStatus: one live provider → isLive true with the stream', async () => {
  const result = await checkLiveStatus([provider(fetchReturning(LIVE_PAYLOAD))]);
  assert.equal(result.isLive, true);
  assert.equal(result.streams.length, 1);
  assert.equal(result.streams[0].videoId, 'dQw4w9WgXcQ');
});

await test('error isolation: a failing provider cannot mask a live one', async () => {
  const failing = {
    platform: 'twitch',
    check: async () => {
      throw new Error('twitch quota exceeded');
    },
  };
  const result = await checkLiveStatus([failing, provider(fetchReturning(LIVE_PAYLOAD))]);
  assert.equal(result.isLive, true, 'still live despite the other provider failing');
  assert.equal(result.streams[0].platform, 'youtube');
  assert.deepEqual(result.errors, [
    { platform: 'twitch', message: 'twitch quota exceeded' },
  ]);
});

await test('API-level failure (403 quota) surfaces as an error entry, not a throw', async () => {
  const result = await checkLiveStatus([
    provider(fetchReturning({ error: { message: 'quotaExceeded' } }, 403)),
  ]);
  assert.equal(result.isLive, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].platform, 'youtube');
});

await test('simulcast: two live providers → two streams', async () => {
  const fakeTwitch = {
    platform: 'twitch',
    check: async () => ({
      platform: 'twitch',
      videoId: '123',
      title: 'Simulcast',
      url: 'https://twitch.tv/beunconventionalhq',
    }),
  };
  const result = await checkLiveStatus([provider(fetchReturning(LIVE_PAYLOAD)), fakeTwitch]);
  assert.equal(result.streams.length, 2);
  assert.equal(result.isLive, true);
});

console.log(
  process.exitCode ? `FAILED (${passed} passed)` : `All ${passed} tests passed.`,
);
