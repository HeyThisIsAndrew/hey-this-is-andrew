/*
  The agent discovery documents describe things that actually exist (#192).

  ─── WHY THIS SUITE IS THE POINT OF THE TICKET ────────────────────────────
  These files are read by machines that cannot tell an aspiration from a fact.
  The first draft of them shipped:

    /.well-known/openid-configuration  ->  /oauth/authorize, /oauth/token
    /auth.md                           ->  "obtain an API key from the
                                            developer portal"

  Neither endpoint existed. Neither did the portal. An agent following either
  gets a 404 after deciding the site supports something it does not, which is
  strictly worse than the site saying nothing at all: a missing
  `.well-known` file is a clean "no", and a present one that lies is a dead
  end the agent has to discover by failing.

  So the rule these tests enforce is simply: every same-origin URL any
  discovery document names must resolve to a file we ship or a route we serve.
  A missing `.well-known` file is fine. A lying one is not.
*/
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const PAGES = path.join(ROOT, 'src', 'pages');
const SITE = 'https://beunconventionalhq.com';

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (error) { failures += 1; console.error(`  ✗ ${name}\n      ${error.message}`); }
}

/**
 * Does this site-relative path actually resolve?
 *
 * Either a file in `public/` (served verbatim) or a route under `src/pages/`.
 * Route matching is deliberately literal: these documents should name concrete
 * endpoints, not patterns.
 */
function pathResolves(pathname) {
  const clean = pathname.replace(/^\//, '').split('?')[0];
  if (!clean) return true; // the site root
  if (fs.existsSync(path.join(PUBLIC, clean))) return true;

  const candidates = [
    `${clean}.ts`, `${clean}.astro`, `${clean}.js`,
    path.join(clean, 'index.astro'), path.join(clean, 'index.ts'),
  ];
  if (candidates.some((c) => fs.existsSync(path.join(PAGES, c)))) return true;

  /* `/api/search-index.json` is served by `search-index.json.ts`, so the
     extension is part of the route name rather than a file type. */
  return fs.existsSync(path.join(PAGES, `${clean}.ts`));
}

/**
 * Paths that exist only after a build, so they are not on disk to check.
 *
 * Kept to things whose generator is verified separately below, rather than
 * being a general escape hatch: an unverifiable entry here would defeat the
 * point of the suite.
 */
const BUILD_GENERATED = new Set(['/sitemap-index.xml']);

/** Every same-origin URL anywhere inside a JSON document or markdown file. */
function siteUrlsIn(text) {
  const found = new Set();
  for (const m of text.matchAll(new RegExp(`${SITE}([^"'\\s)\\]]*)`, 'g'))) {
    /* Markdown wraps URLs in backticks and sentences end in punctuation;
       neither is part of the path. */
    found.add((m[1] || '/').replace(/[`.,;:)\]]+$/, ''));
  }
  /* Relative hrefs count too: the skills index uses them. */
  for (const m of text.matchAll(/"(?:url|href)"\s*:\s*"(\/[^"]*)"/g)) found.add(m[1]);
  return [...found];
}

const DISCOVERY_FILES = [
  '.well-known/agent-skills/index.json',
  '.well-known/api-catalog',
  '.well-known/ai-catalog.json',
  '.well-known/mcp/server-card.json',
  '.well-known/mcp.json',
  'auth.md',
];

console.log('\nEvery discovery document describes something real');

check('every same-origin URL they name resolves to a file or a route', () => {
  const broken = [];
  for (const rel of DISCOVERY_FILES) {
    for (const url of siteUrlsIn(read(path.join('public', rel)))) {
      /* Fragments and mailto are not paths. */
      if (url.startsWith('#') || url.includes('@')) continue;
      if (BUILD_GENERATED.has(url)) continue;
      if (!pathResolves(url)) broken.push(`${rel} -> ${url}`);
    }
  }
  assert.deepEqual(broken, [], `discovery documents point at nothing:\n        ${broken.join('\n        ')}`);
});

check('the one build-generated path really is generated', () => {
  /* /sitemap-index.xml is skipped by the resolver above because it does not
     exist until `astro build` runs. That skip is only safe while the sitemap
     integration is actually configured, so check that rather than assume it. */
  const config = read('astro.config.mjs');
  assert.match(config, /@astrojs\/sitemap/, 'the api-catalog links a sitemap nothing generates');
});

check('the OAuth documents are gone, not merely emptied', () => {
  /* There is no OAuth server and no plan for one. A 404 is the correct,
     honest answer to a client asking whether this site does OAuth. */
  for (const f of ['openid-configuration', 'oauth-protected-resource']) {
    assert.ok(
      !fs.existsSync(path.join(PUBLIC, '.well-known', f)),
      `${f} is back; it advertises endpoints this site does not serve`,
    );
  }
});

check('no discovery document mentions a developer portal or an API key', () => {
  /* Both were invented by the first draft of auth.md. Neither exists. */
  for (const rel of DISCOVERY_FILES) {
    const text = read(path.join('public', rel)).toLowerCase();
    const claim = /developer portal|obtain an api key|bearer token/.test(text);
    const disclaimer = /there is no developer portal|no api key/.test(text);
    assert.ok(!claim || disclaimer, `${rel} claims an auth system that does not exist`);
  }
});

console.log('\nAgent Skills Discovery');

const skills = readJson('public/.well-known/agent-skills/index.json');

check('the index matches the published schema', () => {
  assert.equal(skills.$schema, 'https://schemas.agentskills.io/discovery/0.2.0/schema.json');
  assert.ok(Array.isArray(skills.skills) && skills.skills.length > 0, 'no skills published');
  for (const s of skills.skills) {
    for (const field of ['name', 'type', 'description', 'url', 'digest']) {
      assert.ok(s[field], `skill "${s.name}" is missing ${field}`);
    }
    assert.match(s.name, /^[a-z0-9-]{1,64}$/, `bad skill name: ${s.name}`);
    assert.ok(['skill-md', 'archive'].includes(s.type));
    assert.ok(s.description.length <= 1024);
  }
});

check('every declared digest matches the file it describes', () => {
  /*
    The digest is the whole point of the format: a client fetches the skill and
    verifies it against this hash. A stale digest is not a cosmetic problem, it
    makes the skill fail verification and be discarded — silently, from our
    side. Editing SKILL.md without regenerating this is the obvious way to
    break it, so this test exists to make that impossible to miss.
  */
  for (const s of skills.skills) {
    const file = path.join(PUBLIC, s.url.replace(/^\//, ''));
    assert.ok(fs.existsSync(file), `skill artifact missing: ${s.url}`);
    const actual = 'sha256:' + crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    assert.equal(s.digest, actual, `digest is stale for ${s.name}; regenerate it`);
  }
});

console.log('\nRFC 9727 api-catalog');

const catalog = readJson('public/.well-known/api-catalog');

check('it is a linkset, not an empty placeholder', () => {
  assert.ok(Array.isArray(catalog.linkset), 'no linkset array');
  assert.ok(catalog.linkset.length > 0, 'the linkset is empty');
  for (const ctx of catalog.linkset) {
    assert.ok(ctx.anchor, 'a linkset context has no anchor');
    const rels = Object.keys(ctx).filter((k) => k !== 'anchor');
    assert.ok(rels.length > 0, 'a linkset context declares no relations');
  }
});

check('it is served as application/linkset+json', () => {
  /* The file has no extension, so without this header Cloudflare serves it as
     octet-stream and a conforming client ignores it. */
  const headers = read('public/_headers');
  assert.match(headers, /\/\.well-known\/api-catalog\s*\n\s*Content-Type: application\/linkset\+json/);
});

check('it lists the MCP endpoint among its items', () => {
  const items = catalog.linkset.flatMap((c) => c.item ?? []);
  assert.ok(items.some((i) => i.href.endsWith('/api/mcp')), '/api/mcp is not in the catalog');
});

console.log('\nARD manifest');

const ard = readJson('public/.well-known/ai-catalog.json');

check('it matches the ARD schema', () => {
  assert.equal(ard.specVersion, '1.0');
  assert.ok(Array.isArray(ard.entries) && ard.entries.length > 0, 'no entries');
  for (const e of ard.entries) {
    for (const field of ['identifier', 'displayName', 'type']) {
      assert.ok(e[field], `entry is missing ${field}`);
    }
    assert.match(e.identifier, /^urn:air:[^:]+:[^:]+:[^:]+$/, `bad URN: ${e.identifier}`);
    /* The schema's one-of: url or data, never both. */
    assert.ok(
      Boolean(e.url) !== Boolean(e.data),
      `entry ${e.identifier} must carry exactly one of url or data`,
    );
  }
});

console.log('\nMCP server card');

check('both card paths exist and agree', () => {
  /* SEP-1649 put the card at /.well-known/mcp/server-card.json; SEP-2127
     superseded it with /.well-known/mcp.json. Publishing both is two small
     files instead of a bet on which revision a client implements. */
  const a = readJson('public/.well-known/mcp/server-card.json');
  const b = readJson('public/.well-known/mcp.json');
  assert.deepEqual(a, b, 'the two server cards have drifted apart');
});

check('the card points at the MCP route this repo actually serves', () => {
  const card = readJson('public/.well-known/mcp/server-card.json');
  const remote = card.remotes?.[0];
  assert.ok(remote, 'the card declares no remotes');
  assert.equal(remote.type, 'streamable-http');
  assert.equal(remote.url, `${SITE}/api/mcp`);
  assert.ok(
    fs.existsSync(path.join(PAGES, 'api', 'mcp.ts')),
    'the card advertises /api/mcp but no such route exists',
  );
});

check('the card advertises no authentication, matching the server', () => {
  const card = readJson('public/.well-known/mcp/server-card.json');
  assert.equal(card.remotes[0].authentication?.type, 'none');
  const route = read('src/pages/api/mcp.ts');
  assert.ok(
    !/Authorization|Bearer|api[-_]?key/i.test(route.replace(/\/\*[\s\S]*?\*\//g, '')),
    'the route checks a credential the card says is not needed',
  );
});

check('every tool named on the card is a tool the server implements', () => {
  const card = readJson('public/.well-known/mcp/server-card.json');
  const shared = read('src/lib/agent-tools.ts');
  for (const t of card.tools ?? []) {
    assert.ok(shared.includes(`'${t.name}'`), `card names ${t.name}, which is not defined`);
  }
});

console.log('\nLink headers (RFC 8288)');

check('the api-catalog relation is advertised on every route', () => {
  const headers = read('public/_headers');
  assert.match(headers, /Link: <\/\.well-known\/api-catalog>; rel="api-catalog"/);
});

console.log(
  failures === 0
    ? '\n✅ Agent discovery checks passed.\n'
    : `\n❌ ${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
