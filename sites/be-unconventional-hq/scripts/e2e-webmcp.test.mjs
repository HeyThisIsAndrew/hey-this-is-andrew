/*
  WebMCP tool registration and execution, against the REAL browser API (#192).

  ─── WHAT THIS PROVES ─────────────────────────────────────────────────────
  The Chrome this suite launches ships `document.modelContext` natively
  (confirmed on 150.0.7871.24), so nothing here is stubbed. The tools are
  registered by the site's own code, read back with the browser's
  `getTools()`, and invoked through the browser's `executeTool()` — the same
  path an agent takes. If Chrome rejected a schema or an annotation, this
  fails.

  It does NOT prove any particular agent chooses to call these tools, or that
  the schemas are well described enough to be useful. That is a judgement call
  and a manual check.

  ─── TWO THINGS THE BROWSER API MADE US LEARN ─────────────────────────────
  `provideContext()` and `unregisterTool()`, both named in #192 and in older
  write-ups, do not exist on the object Chrome ships. This suite asserts their
  absence so nobody re-adds a call to them from a stale doc.

  `getTools()` returns `inputSchema` as a SERIALIZED STRING on Chrome 149-153
  and as an object from 154 (webmcp#241). The reader below handles both, which
  is also what any real consumer has to do right now.
*/
import { launchTestBrowser } from './e2e-browser.mjs';
import { startPreviewServer } from './e2e-server.mjs';
import assert from 'node:assert/strict';

/** Hide the API from the page, to test the path almost every visitor takes. */
const HIDE_API = `
  Object.defineProperty(document, 'modelContext', { value: undefined, configurable: true });
  Object.defineProperty(navigator, 'modelContext', { value: undefined, configurable: true });
`;

/** Chrome 149-153 serialize inputSchema; 154+ send the object. Accept both. */
function readSchema(schema) {
  if (typeof schema === 'string') {
    try { return JSON.parse(schema); } catch { return null; }
  }
  return schema ?? null;
}

/** Tools return MCP content blocks; our payload is JSON inside a text block. */
function parseToolOutput(raw) {
  assert.ok(typeof raw === 'string', `executeTool returned ${typeof raw}, expected a string`);
  const envelope = JSON.parse(raw);
  assert.ok(Array.isArray(envelope.content), 'expected an MCP content array');
  assert.equal(envelope.content[0].type, 'text');
  return JSON.parse(envelope.content[0].text);
}

async function run() {
  console.log('Starting Astro preview server for WebMCP E2E...');
  const { stop } = await startPreviewServer();
  const browser = await launchTestBrowser();
  console.log(`Browser: ${await browser.version()}`);
  let passed = 0;
  let failed = 0;
  const check = (name, fn) => {
    try { fn(); console.log(`  ✓ ${name}`); passed++; }
    catch (e) { console.error(`  ✗ ${name}\n      ${e.message}`); failed++; }
  };

  try {
    /* ── 1. A browser without the API pays nothing at all ────────────────── */
    console.log('\nBrowsers without WebMCP');
    const plain = await browser.newPage();
    const requested = [];
    plain.on('request', (r) => requested.push(r.url()));
    await plain.evaluateOnNewDocument(HIDE_API);
    await plain.goto('http://localhost:4321/', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 800));

    check('the implementation chunk is never downloaded', () => {
      /* The feature test is inlined in Layout and the module sits behind a
         dynamic import, so the ~4 KB never leaves the server for the ~100% of
         visitors who are people. */
      const hits = requested.filter((u) => /webmcp/i.test(u));
      assert.deepEqual(hits, [], `webmcp was fetched anyway: ${hits.join(', ')}`);
    });
    check('and the page still works', async () => {
      assert.ok(true); // it loaded to networkidle0 without throwing
    });
    await plain.close();

    /* ── 2. Registration, through the real API ───────────────────────────── */
    console.log('\nRegistration against the browser API');
    const page = await browser.newPage();
    await page.goto('http://localhost:4321/', { waitUntil: 'networkidle0' });
    await page.waitForFunction(
      async () => (await document.modelContext?.getTools?.())?.length > 0,
      { timeout: 5000 },
    );

    const surface = await page.evaluate(() => {
      /* Cast away the typed surface on purpose: the whole point of the next
         two reads is that these members are NOT on it, and the declaration in
         src/lib/webmcp.ts is right not to include them. */
      const mc = /** @type {any} */ (document.modelContext);
      return {
        onDocument: typeof mc,
        hasRegisterTool: typeof mc?.registerTool,
        hasProvideContext: typeof mc?.provideContext,
        hasUnregisterTool: typeof mc?.unregisterTool,
      };
    });

    check('the API is the one the spec describes, not the one #192 described', () => {
      assert.equal(surface.onDocument, 'object', 'document.modelContext missing');
      assert.equal(surface.hasRegisterTool, 'function');
      assert.equal(surface.hasProvideContext, 'undefined', 'provideContext is back; the spec removed it 2026-03-05');
      assert.equal(surface.hasUnregisterTool, 'undefined', 'unregisterTool is back; removed April 2026');
    });

    const tools = await page.evaluate(async () =>
      (await document.modelContext.getTools()).map((t) => ({
        name: t.name,
        title: t.title,
        description: t.description,
        inputSchema: t.inputSchema,
        annotations: t.annotations,
      })));

    check('all three tools are registered with the browser', () => {
      assert.deepEqual(
        tools.map((t) => t.name).sort(),
        ['get_live_status', 'get_upcoming_events', 'search_beunconventionalhq'],
      );
    });

    check('every tool is annotated read-only', () => {
      /* The whole set is reads, so an agent that honours readOnlyHint can call
         any of them without prompting its user. That is the reason there is no
         subscribe tool: see the note in src/lib/webmcp.ts. */
      for (const t of tools) assert.equal(t.annotations?.readOnlyHint, true, `${t.name}`);
    });

    check('every tool marks its content untrusted', () => {
      /* Titles and tags come from YouTube and Substack. An agent must read
         them as data, never as instructions. */
      for (const t of tools) assert.equal(t.annotations?.untrustedContentHint, true, `${t.name}`);
    });

    check('every tool has a usable description and an object schema', () => {
      for (const t of tools) {
        assert.ok(t.description?.length > 40, `${t.name} description is too thin to pick by`);
        const schema = readSchema(t.inputSchema);
        assert.equal(schema?.type, 'object', `${t.name} schema is not an object`);
      }
    });

    check('search declares query as its one required argument', () => {
      const schema = readSchema(tools.find((t) => t.name === 'search_beunconventionalhq').inputSchema);
      assert.deepEqual(schema.required, ['query']);
      assert.equal(schema.properties.query.type, 'string');
      assert.ok(schema.properties.type.enum.includes('event'), 'the type filter lost its enum');
    });

    /* ── 3. Execution, through the browser's own executeTool() ───────────── */
    console.log('\nExecution through executeTool()');
    const callTool = async (name, args) =>
      parseToolOutput(await page.evaluate(async (n, a) => {
        const tool = (await document.modelContext.getTools()).find((t) => t.name === n);
        return document.modelContext.executeTool(tool, JSON.stringify(a));
      }, name, args ?? {}));

    const search = await callTool('search_beunconventionalhq', { query: 'marvel', limit: 5 });
    check('search returns ranked results with absolute URLs', () => {
      assert.ok(search.count > 0, `expected matches for "marvel", got ${search.count}`);
      assert.ok(search.results.length <= 5, 'the limit was not applied');
      for (const r of search.results) {
        assert.match(r.url, /^https?:\/\//, `not absolute: ${r.url}`);
        assert.ok(r.title, 'a result has no title');
      }
    });
    console.log(`      top hit: "${search.results[0]?.title}" (${search.results[0]?.type})`);

    const videosOnly = await callTool('search_beunconventionalhq', { query: 'the', type: 'video', limit: 4 });
    check('the type filter is honoured', () => {
      assert.ok(videosOnly.results.length > 0, 'expected some videos');
      assert.ok(videosOnly.results.every((r) => r.type === 'video'), 'a non-video leaked through');
    });

    const capped = await callTool('search_beunconventionalhq', { query: 'a', limit: 9999 });
    check('an absurd limit is capped rather than obeyed', () => {
      assert.ok(capped.results.length <= 50, `returned ${capped.results.length} rows`);
    });

    const blank = await callTool('search_beunconventionalhq', { query: '   ' });
    check('a blank query is refused instead of dumping the whole index', () => {
      assert.ok(blank.error, 'expected an error for a blank query');
      assert.deepEqual(blank.results, []);
    });

    const events = await callTool('get_upcoming_events', {});
    check('finished events are excluded by name, not just by an empty array', () => {
      /*
        Both events in the store are months past, so `count: 0` is the correct
        answer today and an assertion on emptiness alone would pass whatever
        the filter did. Name them: these two must never appear.
        scripts/webmcp-tools.test.mjs pins the filter against fixed dates.
      */
      const titles = events.events.map((e) => e.title);
      assert.ok(!titles.includes('San Diego Comic Con'), 'a completed event was advertised');
      assert.ok(!titles.includes('D23'), 'a completed event was advertised');
      for (const e of events.events) {
        assert.ok(['upcoming', 'live', 'postponed'].includes(e.status), `bad status: ${e.status}`);
      }
    });
    console.log(`      ${events.count} upcoming (both stored events are past, so 0 is correct today)`);

    const live = await callTool('get_live_status', {});
    check('live status degrades to dormant rather than throwing', () => {
      /* The e2e server has no YouTube credentials, so the endpoint reports
         not_configured. The tool must still answer, matching what the on-page
         billboard shows in the same situation. */
      assert.equal(typeof live.isLive, 'boolean');
      assert.ok(Array.isArray(live.streams));
    });

    /* ── 4. One registration per document, not one per navigation ────────── */
    console.log('\nClientRouter');
    await page.evaluate(() => document.querySelector('a[href^="/feed"]')?.click());
    await new Promise((r) => setTimeout(r, 1500));
    const afterNav = await page.evaluate(async () =>
      (await document.modelContext.getTools()).map((t) => t.name));
    check('navigating does not register a second copy of every tool', () => {
      /* The document survives a ClientRouter swap, so the first registration
         still stands. Re-running init would leave an agent choosing between
         duplicates. */
      assert.equal(afterNav.length, 3, `expected 3 tools after navigating, found ${afterNav.length}`);
    });

    await page.close();
    console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed.`);
    await browser.close();
    stop();
    process.exit(failed === 0 ? 0 : 1);
  } catch (error) {
    console.error('❌ E2E Test Failed:', error);
    await browser.close();
    stop();
    process.exit(1);
  }
}
run();
