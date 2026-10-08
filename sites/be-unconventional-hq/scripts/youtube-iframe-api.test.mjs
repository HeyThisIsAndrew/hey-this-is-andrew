/*
  loadYouTubeAPI() (src/lib/youtube-iframe-api.ts) must inject the IFrame API
  even when something else already defined `onYouTubeIframeAPIReady`.

  ─── THE BUG THIS GUARDS ──────────────────────────────────────────────────
  On production, Google Tag Manager's YouTube trigger defines that callback
  ~150ms into the page and waits for a jsapi player before loading the API.
  The homepage Featured shelf took the callback as proof the API was already
  coming, chained onto it and injected nothing. Both waited on the other: no
  player, no muted preview, on every visit. Local dev loads no GTM, so it
  only ever reproduced on the live site.

  Driven with stub window/document objects, so it runs under plain node.
*/
import assert from 'node:assert/strict';
import { loadYouTubeAPI, IFRAME_API_SRC } from '../src/lib/youtube-iframe-api.ts';

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

/** A document just rich enough for the loader: script tags in <head>. */
function fakeDocument(existingSrcs = []) {
  const scripts = [];
  const listeners = new Map();
  const make = (src) => {
    const el = {
      tagName: 'SCRIPT',
      src,
      onerror: null,
      addEventListener(type, fn) {
        listeners.set(el, { ...(listeners.get(el) || {}), [type]: fn });
      },
      fire(type) {
        if (type === 'error' && el.onerror) el.onerror();
        listeners.get(el)?.[type]?.();
      },
    };
    return el;
  };
  const head = {
    appendChild(el) {
      scripts.push(el);
      el.parentNode = head;
    },
    insertBefore(el, ref) {
      scripts.splice(scripts.indexOf(ref), 0, el);
      el.parentNode = head;
    },
  };
  existingSrcs.forEach((src) => head.appendChild(make(src)));
  return {
    head,
    scripts,
    createElement: () => make(''),
    getElementsByTagName: () => scripts,
    querySelector(sel) {
      const needle = sel.match(/src\*="([^"]+)"/)?.[1];
      return scripts.find((s) => needle && s.src.includes(needle)) || null;
    },
  };
}

const settle = () => new Promise((r) => setTimeout(r, 0));
const apiScripts = (doc) => doc.scripts.filter((s) => s.src === IFRAME_API_SRC);

console.log('loadYouTubeAPI');

await test('an existing callback (GTM) does NOT stop the API being injected', async () => {
  const doc = fakeDocument(['https://beunconventionalhq.com/nlsh/']);
  let gtmCalls = 0;
  const win = { onYouTubeIframeAPIReady: () => gtmCalls++ };

  const loaded = loadYouTubeAPI(win, doc);
  assert.equal(apiScripts(doc).length, 1, 'the loader deferred to a callback that was never going to load anything');

  win.YT = { Player: function Player() {} };
  win.onYouTubeIframeAPIReady();
  assert.equal(await loaded, win.YT);
  assert.equal(gtmCalls, 1, "GTM's own callback must still fire, or its video analytics stop");
});

await test('with no prior callback it injects once and resolves with YT', async () => {
  const doc = fakeDocument();
  const win = {};
  const loaded = loadYouTubeAPI(win, doc);
  assert.equal(apiScripts(doc).length, 1);
  win.YT = { Player: function Player() {} };
  win.onYouTubeIframeAPIReady();
  assert.equal(await loaded, win.YT);
});

await test('a script tag already in flight is reused, not duplicated', async () => {
  const doc = fakeDocument([IFRAME_API_SRC]);
  const win = { onYouTubeIframeAPIReady: () => {} };
  const loaded = loadYouTubeAPI(win, doc);
  assert.equal(apiScripts(doc).length, 1);
  win.YT = { Player: function Player() {} };
  win.onYouTubeIframeAPIReady();
  assert.equal(await loaded, win.YT);
});

await test('an API that is already up resolves at once and injects nothing', async () => {
  const doc = fakeDocument();
  const win = { YT: { Player: function Player() {} } };
  assert.equal(await loadYouTubeAPI(win, doc), win.YT);
  assert.equal(apiScripts(doc).length, 0);
});

await test('a blocked script resolves null (the static-carousel fallback)', async () => {
  const doc = fakeDocument();
  const win = {};
  const warn = console.warn;
  console.warn = () => {};
  const loaded = loadYouTubeAPI(win, doc);
  apiScripts(doc)[0].fire('error');
  assert.equal(await loaded, null);
  console.warn = warn;
});

await test('a throwing earlier callback does not cost us the player', async () => {
  const doc = fakeDocument();
  const win = {
    onYouTubeIframeAPIReady: () => {
      throw new Error('third party');
    },
  };
  const warn = console.warn;
  console.warn = () => {};
  const loaded = loadYouTubeAPI(win, doc);
  win.YT = { Player: function Player() {} };
  win.onYouTubeIframeAPIReady();
  await settle();
  assert.equal(await loaded, win.YT);
  console.warn = warn;
});

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
