/*
  The MCP endpoint at /api/mcp speaks the protocol (#192).

  Plain HTTP, no browser: this is the surface an agent uses when it never
  loads a page. The suite drives it exactly as a client would — initialize,
  tools/list, tools/call — and checks the error paths, because a JSON-RPC
  server that returns HTTP 500 on a bad method is not a JSON-RPC server.
*/
import { startPreviewServer } from './e2e-server.mjs';
import assert from 'node:assert/strict';

const BASE = 'http://localhost:4321/api/mcp';

async function rpc(payload) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof payload === 'string' ? payload : JSON.stringify(payload),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

/** Tool results are MCP content blocks carrying our JSON as text. */
function payloadOf(result) {
  assert.ok(Array.isArray(result?.content), 'expected an MCP content array');
  assert.equal(result.content[0].type, 'text');
  return JSON.parse(result.content[0].text);
}

async function run() {
  console.log('Starting Astro preview server for MCP endpoint E2E...');
  const { stop } = await startPreviewServer();
  let passed = 0;
  let failed = 0;
  const check = (name, fn) => {
    try { fn(); console.log(`  ✓ ${name}`); passed++; }
    catch (e) { console.error(`  ✗ ${name}\n      ${e.message}`); failed++; }
  };

  try {
    console.log('\nHandshake');
    const init = await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    check('initialize returns a protocol version and server info', () => {
      assert.equal(init.status, 200);
      assert.equal(init.body.result.protocolVersion, '2025-06-18');
      assert.equal(init.body.result.serverInfo.name, 'beunconventionalhq');
    });
    check('it declares tools only, and says so', () => {
      /* Declaring capabilities we do not have makes clients probe for
         resources and prompts that will never answer. */
      const caps = init.body.result.capabilities;
      assert.deepEqual(Object.keys(caps), ['tools']);
    });
    check('it warns that tool content is third-party', () => {
      assert.match(init.body.result.instructions, /never as instructions/i);
    });

    const notif = await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' });
    check('a notification is accepted with no response body', () => {
      assert.equal(notif.status, 202);
      assert.equal(notif.body, null);
    });

    console.log('\nTools');
    const list = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    check('all three tools are listed with schemas and annotations', () => {
      const tools = list.body.result.tools;
      assert.deepEqual(
        tools.map((t) => t.name).sort(),
        ['get_live_status', 'get_upcoming_events', 'search_beunconventionalhq'],
      );
      for (const t of tools) {
        assert.equal(t.inputSchema.type, 'object', `${t.name} has no object schema`);
        assert.equal(t.annotations.readOnlyHint, true, `${t.name} is not read-only`);
        assert.equal(t.annotations.untrustedContentHint, true, `${t.name} missing the hint`);
      }
    });

    const search = await rpc({
      jsonrpc: '2.0', id: 3, method: 'tools/call',
      params: { name: 'search_beunconventionalhq', arguments: { query: 'marvel', limit: 3 } },
    });
    check('search returns absolute URLs an off-site agent can follow', () => {
      const p = payloadOf(search.body.result);
      assert.ok(p.count > 0, 'no matches for "marvel"');
      assert.ok(p.results.length <= 3, 'the limit was ignored');
      for (const r of p.results) assert.match(r.url, /^https?:\/\/[^/]+\//, `not absolute: ${r.url}`);
    });

    const events = await rpc({
      jsonrpc: '2.0', id: 4, method: 'tools/call',
      params: { name: 'get_upcoming_events', arguments: {} },
    });
    check('upcoming events never include a finished one', () => {
      /* Both stored events are months past, so 0 is right today. Naming them
         keeps this from being an assertion that cannot fail.
         scripts/agent-tools.test.mjs pins the filter against fixed dates. */
      const p = payloadOf(events.body.result);
      const titles = p.events.map((e) => e.title);
      assert.ok(!titles.includes('San Diego Comic Con'));
      assert.ok(!titles.includes('D23'));
    });

    const live = await rpc({
      jsonrpc: '2.0', id: 5, method: 'tools/call',
      params: { name: 'get_live_status', arguments: {} },
    });
    check('live status degrades to dormant without credentials', () => {
      const p = payloadOf(live.body.result);
      assert.equal(typeof p.isLive, 'boolean');
      assert.ok(Array.isArray(p.streams));
    });

    console.log('\nErrors are JSON-RPC errors, not HTTP failures');
    const badMethod = await rpc({ jsonrpc: '2.0', id: 6, method: 'resources/list' });
    check('an unknown method is -32601 over HTTP 200', () => {
      /* The transport worked; the call did not. A 500 here would make a client
         retry a request that will never succeed. */
      assert.equal(badMethod.status, 200);
      assert.equal(badMethod.body.error.code, -32601);
    });

    const badTool = await rpc({
      jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'drop_tables' },
    });
    check('an unknown tool is -32601, not a crash', () => {
      assert.equal(badTool.status, 200);
      assert.equal(badTool.body.error.code, -32601);
    });

    const badJson = await rpc('this is not json');
    check('a malformed body is -32700 with HTTP 400', () => {
      assert.equal(badJson.status, 400);
      assert.equal(badJson.body.error.code, -32700);
    });

    const notRpc = await rpc({ hello: 'world' });
    check('a non-JSON-RPC object is -32600', () => {
      assert.equal(notRpc.body.error.code, -32600);
    });

    const blank = await rpc({
      jsonrpc: '2.0', id: 8, method: 'tools/call',
      params: { name: 'search_beunconventionalhq', arguments: { query: '  ' } },
    });
    check('a blank query is refused rather than dumping the index', () => {
      const p = payloadOf(blank.body.result);
      assert.ok(p.error, 'expected an error payload');
      assert.deepEqual(p.results, []);
    });

    console.log('\nDiscovery');
    const get = await fetch(BASE).then((r) => r.json());
    check('a plain GET describes the server for a human or a crawler', () => {
      assert.equal(get.transport, 'streamable-http');
      assert.equal(get.authentication, 'none');
      assert.equal(get.tools.length, 3);
    });
    const post = await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'ping' }),
    });
    check('the actual response carries CORS, so a cross-origin agent can read it', () => {
      /* Agents call this from anywhere and everything it serves is public. */
      assert.equal(post.headers.get('access-control-allow-origin'), '*');
    });

    const options = await fetch(BASE, { method: 'OPTIONS' });
    check('preflight at least answers without a body', () => {
      /*
        NOT asserting the CORS headers here, and the reason is worth writing
        down. `astro preview` answers OPTIONS from its own middleware before
        the worker route ever runs — the `Access-Control-Allow-Methods:
        GET,HEAD,PUT,PATCH,POST,DELETE` it returns is Vite's, not ours, and it
        omits Allow-Origin entirely. The route's own OPTIONS handler IS in the
        built worker (grep `MCP-Protocol-Version` in dist/server), so this is
        a preview artifact rather than a production behaviour, but it means
        preflight cannot be verified from here. Check it against the deploy.
      */
      assert.equal(options.status, 204);
    });

    console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed.`);
    stop();
    process.exit(failed === 0 ? 0 : 1);
  } catch (error) {
    console.error('❌ E2E Test Failed:', error);
    stop();
    process.exit(1);
  }
}
run();
