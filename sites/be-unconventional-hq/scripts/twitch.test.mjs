/**
 * Offline unit tests for src/lib/platforms/twitch.ts and the Twitch live
 * provider — stubbed fetch, no network, no credentials.
 *
 * Run:  node scripts/twitch.test.mjs
 */
import assert from 'node:assert/strict';
import { createTwitchClient, TwitchApiError } from '../src/lib/platforms/twitch.ts';
import { checkLiveStatus, createTwitchLiveProvider } from '../src/lib/live-status.ts';

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

const TOKEN_RESPONSE = { access_token: 'app-token-1', expires_in: 3600 };
const LIVE_STREAM = {
  data: [{ id: '9001', type: 'live', title: 'SDCC Simulcast', user_login: 'beunconventionalhq' }],
};
const OFFLINE = { data: [] };

/** Stub fetch: token endpoint → token; helix streams → given payload. Records calls. */
function stubFetch(streamsPayload, { tokenResponse = TOKEN_RESPONSE, streamsStatus = 200 } = {}) {
  const calls = { token: 0, streams: 0, authHeaders: [] };
  const impl = async (url, init) => {
    if (String(url).includes('id.twitch.tv/oauth2/token')) {
      calls.token++;
      return new Response(JSON.stringify(tokenResponse), { status: 200 });
    }
    calls.streams++;
    calls.authHeaders.push(init?.headers?.Authorization);
    return new Response(JSON.stringify(streamsPayload), { status: streamsStatus });
  };
  return { impl, calls };
}

const client = (stub, nowImpl) =>
  createTwitchClient({ clientId: 'cid', clientSecret: 'sec', fetchImpl: stub.impl, nowImpl });

console.log('twitch.ts');

await test('live channel → isLive with stream id + title', async () => {
  const stub = stubFetch(LIVE_STREAM);
  const status = await client(stub).getLiveStatus('beunconventionalhq');
  assert.deepEqual(status, { isLive: true, streamId: '9001', title: 'SDCC Simulcast' });
});

await test('offline channel → isLive false, null id', async () => {
  const stub = stubFetch(OFFLINE);
  assert.deepEqual(await client(stub).getLiveStatus('x'), { isLive: false, streamId: null });
});

await test('token fetched once and reused across calls (lazy + cached)', async () => {
  const stub = stubFetch(OFFLINE);
  const c = client(stub);
  await c.getLiveStatus('x');
  await c.getLiveStatus('x');
  assert.equal(stub.calls.token, 1, 'token endpoint hit more than once');
  assert.equal(stub.calls.streams, 2);
  assert.equal(stub.calls.authHeaders[1], 'Bearer app-token-1');
});

await test('token refreshed after expiry (with safety margin)', async () => {
  let now = 0;
  const stub = stubFetch(OFFLINE);
  const c = client(stub, () => now);
  await c.getLiveStatus('x');
  now = (3600 - 60) * 1000 + 1; // 1ms past the margin-adjusted expiry
  await c.getLiveStatus('x');
  assert.equal(stub.calls.token, 2);
});

await test('helix error surfaces as TwitchApiError with status', async () => {
  const stub = stubFetch({}, { streamsStatus: 429 });
  await assert.rejects(
    () => client(stub).getLiveStatus('x'),
    (err) => err instanceof TwitchApiError && err.status === 429,
  );
});

await test('provider maps a live stream to LiveStreamInfo with channel URL', async () => {
  const stub = stubFetch(LIVE_STREAM);
  const provider = createTwitchLiveProvider({ client: client(stub), channelLogin: 'beunconventionalhq' });
  assert.deepEqual(await provider.check(), {
    platform: 'twitch',
    videoId: '9001',
    title: 'SDCC Simulcast',
    url: 'https://www.twitch.tv/beunconventionalhq',
  });
});

await test('provider integrates with checkLiveStatus error isolation', async () => {
  const failing = createTwitchLiveProvider({
    client: { getLiveStatus: async () => { throw new TwitchApiError('boom', 500); } },
    channelLogin: 'x',
  });
  const live = createTwitchLiveProvider({ client: client(stubFetch(LIVE_STREAM)), channelLogin: 'y' });
  const result = await checkLiveStatus([failing, live]);
  assert.equal(result.isLive, true);
  assert.equal(result.streams[0].platform, 'twitch');
  assert.deepEqual(result.errors, [{ platform: 'twitch', message: 'boom' }]);
});

console.log(
  process.exitCode ? `FAILED (${passed} passed)` : `All ${passed} tests passed.`,
);
