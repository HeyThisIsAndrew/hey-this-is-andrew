/*
  src/lib/youtube-start.ts: one press starts the video.

  Both heroes used to post `playVideo` on the iframe's `load` event, which
  arrives before YouTube's player inside the frame is listening, so the
  command was lost and the reader had to press play twice. These drive the
  starter with a fake frame and fake player messages and pin the contract:
  nothing is asked of the player until it says it is ready, the ask repeats
  until it reports PLAYING and then stops, only this frame's own player is
  believed, and the caller's frame is always revealed exactly once, but
  never on a cancel.
*/
import assert from 'node:assert/strict';
import { playWhenReady } from '../src/lib/youtube-start.ts';

const ORIGIN = 'https://www.youtube-nocookie.com';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

globalThis.window = new EventTarget();

function fakeFrame() {
  const posted = [];
  const frame = new EventTarget();
  frame.src = 'https://www.youtube-nocookie.com/embed/abc?enablejsapi=1';
  frame.contentWindow = {
    postMessage(message, origin) {
      posted.push({ ...JSON.parse(message), origin });
    },
  };
  return { frame, posted };
}

function fromPlayer(frame, data, { origin = ORIGIN, source = frame.contentWindow } = {}) {
  const event = new Event('message');
  Object.assign(event, { data: JSON.stringify(data), origin, source });
  window.dispatchEvent(event);
}

const plays = (posted) => posted.filter((m) => m.func === 'playVideo').length;
const handshakes = (posted) => posted.filter((m) => m.event === 'listening').length;

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err.message}`);
    failed++;
  }
}

const FAST = { handshakeEveryMs: 10, retryEveryMs: 20, revealAfterMs: 400, giveUpMs: 800 };

console.log('The YouTube starter waits for the player:');

await test('nothing is asked before load, and only the handshake before ready', async () => {
  const { frame, posted } = fakeFrame();
  const cancel = playWhenReady(frame, FAST);
  assert.equal(posted.length, 0, 'nothing may be posted before the frame loads');
  frame.dispatchEvent(new Event('load'));
  await wait(35);
  assert.ok(handshakes(posted) >= 2, 'the handshake repeats until the player answers');
  assert.equal(plays(posted), 0, 'playVideo before onReady is the double press');
  assert.ok(posted.every((m) => m.origin === ORIGIN), 'targeted at the player origin, never "*"');
  cancel();
});

await test('onReady from this frame starts it; strangers are ignored', async () => {
  const { frame, posted } = fakeFrame();
  let revealed = 0;
  const cancel = playWhenReady(frame, { ...FAST, onReady: () => revealed++ });
  frame.dispatchEvent(new Event('load'));
  fromPlayer(frame, { event: 'onReady' }, { origin: 'https://evil.example' });
  fromPlayer(frame, { event: 'onReady' }, { source: {} });
  assert.equal(plays(posted), 0, 'a message from another origin or frame must not start it');
  assert.equal(revealed, 0);
  fromPlayer(frame, { event: 'onReady' });
  assert.equal(plays(posted), 1, 'playVideo is sent the moment the player is ready');
  assert.equal(revealed, 1, 'the caller is told once, to reveal the frame');
  const shakes = handshakes(posted);
  await wait(30);
  assert.equal(handshakes(posted), shakes, 'the handshake stops once the player has answered');
  cancel();
});

await test('playVideo repeats until the player reports playing, then everything stops', async () => {
  const { frame, posted } = fakeFrame();
  playWhenReady(frame, FAST);
  frame.dispatchEvent(new Event('load'));
  fromPlayer(frame, { event: 'initialDelivery', info: { playerState: -1 } });
  await wait(50);
  assert.ok(plays(posted) >= 2, 'a refused or dropped play is asked again');
  fromPlayer(frame, { event: 'infoDelivery', info: { playerState: 1 } });
  const count = posted.length;
  await wait(60);
  assert.equal(posted.length, count, 'once PLAYING, nothing more is sent');
});

await test('onStateChange 1 also counts as playing, and onError stops it', async () => {
  const a = fakeFrame();
  playWhenReady(a.frame, FAST);
  a.frame.dispatchEvent(new Event('load'));
  fromPlayer(a.frame, { event: 'onReady' });
  fromPlayer(a.frame, { event: 'onStateChange', info: 1 });
  const n = a.posted.length;
  await wait(50);
  assert.equal(a.posted.length, n);

  const b = fakeFrame();
  playWhenReady(b.frame, FAST);
  b.frame.dispatchEvent(new Event('load'));
  fromPlayer(b.frame, { event: 'onReady' });
  fromPlayer(b.frame, { event: 'onError', info: 150 });
  const m = b.posted.length;
  await wait(50);
  assert.equal(b.posted.length, m, 'an embed the owner disallows is not asked to play forever');
});

await test('a player that never answers is still revealed, once', async () => {
  const { frame } = fakeFrame();
  let revealed = 0;
  playWhenReady(frame, { ...FAST, onReady: () => revealed++ });
  frame.dispatchEvent(new Event('load'));
  await wait(450);
  assert.equal(revealed, 1, 'a hidden frame must not stay invisible over the art');
  await wait(450);
  assert.equal(revealed, 1, 'and giving up does not reveal it twice');
});

await test('cancelling reveals nothing and sends nothing more', async () => {
  const { frame, posted } = fakeFrame();
  let revealed = 0;
  const cancel = playWhenReady(frame, { ...FAST, onReady: () => revealed++ });
  frame.dispatchEvent(new Event('load'));
  cancel();
  const n = posted.length;
  fromPlayer(frame, { event: 'onReady' });
  await wait(450);
  assert.equal(posted.length, n);
  assert.equal(revealed, 0, 'a frame being taken down is not revealed on the way out');
});

await test('an about:blank load is not talked to', async () => {
  const { frame, posted } = fakeFrame();
  const cancel = playWhenReady(frame, FAST);
  frame.src = 'about:blank';
  frame.dispatchEvent(new Event('load'));
  await wait(30);
  assert.equal(posted.length, 0);
  cancel();
});

console.log(`\n${failed ? '❌' : '✅'} ${passed} passed, ${failed} failed.`);
if (failed) process.exit(1);
