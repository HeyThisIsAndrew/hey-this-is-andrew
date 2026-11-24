// node --test scripts/cloudflare.test.mjs   (also run by `pnpm check`)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allSites,
  changed,
  workspaceGraph,
  workspaceDepsOf,
  previewAlias,
  previewUrl,
  parseJsonc,
  buildShaIn,
  NEVER_DEPLOY,
  MAX_DNS_LABEL,
} from './cloudflare.mjs';

const sites = allSites();
const realGraph = workspaceGraph();
const dirs = (list) => list.map((s) => s.dir).sort();
const ALL = dirs(sites);

// The real graph, plus @andrew/content-pipeline (PR #9) used only by the
// personal site, unless the real repository already has it.
function graphWithContentPipeline() {
  const g = new Map([...realGraph].map(([k, v]) => [k, { ...v, deps: [...v.deps] }]));
  if (!g.has('@andrew/content-pipeline')) {
    g.set('@andrew/content-pipeline', { name: '@andrew/content-pipeline', folder: 'packages/content-pipeline', deps: [] });
    g.get('hey-this-is-andrew').deps.push('@andrew/content-pipeline');
  }
  return g;
}

test('the three Cloudflare sites are registered, and HQ is not', () => {
  assert.deepEqual(ALL, ['hey-this-is-andrew', 'netta-henna-and-feathered-soul', 'reelay']);
  assert.ok(NEVER_DEPLOY.has('be-unconventional-hq'));
  assert.ok(!ALL.includes('be-unconventional-hq'));
});

test('a change inside one site selects only that site', () => {
  assert.deepEqual(dirs(changed(null, null, { files: ['sites/reelay/src/pages/index.astro'], sites })), ['reelay']);
  assert.deepEqual(
    dirs(changed(null, null, { files: ['sites/netta-henna-and-feathered-soul/README.md', 'sites/reelay/package.json'], sites })),
    ['netta-henna-and-feathered-soul', 'reelay'],
  );
});

test('packages/content-pipeline selects only hey-this-is-andrew', () => {
  const graph = graphWithContentPipeline();
  const out = changed(null, null, { files: ['packages/content-pipeline/src/substack/sync.ts'], sites, graph });
  assert.deepEqual(dirs(out), ['hey-this-is-andrew']);
});

test('packages/ui and packages/tokens select every site that depends on them', () => {
  for (const pkg of ['ui', 'tokens']) {
    const expected = dirs(sites.filter((s) => workspaceDepsOf(s.pkgName, realGraph).has(`@andrew/${pkg}`)));
    assert.ok(expected.length >= 3, `all three sites use @andrew/${pkg}`);
    assert.deepEqual(dirs(changed(null, null, { files: [`packages/${pkg}/src/x.astro`], sites })), expected);
  }
});

test('dependencies are followed through other packages', () => {
  // A site that only lists @andrew/ui still depends on @andrew/tokens (ui uses it).
  const g = new Map(realGraph);
  g.set('only-ui-site', { name: 'only-ui-site', folder: 'sites/only-ui-site', deps: ['@andrew/ui'] });
  assert.ok(workspaceDepsOf('only-ui-site', g).has('@andrew/tokens'));
});

test('packages/local-cms selects only the sites that use it', () => {
  const out = dirs(changed(null, null, { files: ['packages/local-cms/src/index.ts'], sites }));
  assert.ok(!out.includes('reelay'), 'reelay does not use local-cms');
  assert.deepEqual(out, ['hey-this-is-andrew', 'netta-henna-and-feathered-soul']);
});

test('global build inputs select every site', () => {
  for (const f of ['pnpm-lock.yaml', 'pnpm-workspace.yaml', 'scripts/cloudflare.mjs', '.github/workflows/cloudflare.yml', '.github/workflows/cloudflare-preview.yml']) {
    assert.deepEqual(dirs(changed(null, null, { files: [f], sites })), ALL, f);
  }
  assert.deepEqual(dirs(changed(null, null, { files: ['package.json'], sites, rootWranglerChanged: true })), ALL);
});

test('everything else selects nothing', () => {
  for (const f of ['README.md', 'CLOUDFLARE.md', '.github/workflows/ci.yml', 'templates/site-starter/src/pages/index.astro', 'e2e/hero.spec.ts', 'scripts/new-site.mjs']) {
    assert.deepEqual(changed(null, null, { files: [f], sites }), [], f);
  }
  assert.deepEqual(changed(null, null, { files: ['package.json'], sites, rootWranglerChanged: false }), []);
});

test('changed() never selects be-unconventional-hq', () => {
  const everything = ['sites/be-unconventional-hq/src/pages/index.astro', 'packages/ui/src/Nav.astro', 'pnpm-lock.yaml'];
  for (const files of [[everything[0]], everything]) {
    assert.ok(!dirs(changed(null, null, { files, sites })).includes('be-unconventional-hq'));
  }
  assert.deepEqual(changed(null, null, { files: ['sites/be-unconventional-hq/package.json'], sites }), []);
  // An unknown base (first push) means "every site", which still excludes HQ.
  assert.ok(!dirs(changed('0000000000000000000000000000000000000000', 'HEAD')).includes('be-unconventional-hq'));
});

test('previewAlias keeps <alias>-<worker> within one DNS label', () => {
  const branches = [
    'main',
    'feat/substack-pipeline-and-pr-previews',
    'Fix/UPPER_case & spaces!!',
    '123-starts-with-a-digit',
    '---',
    '',
    'a'.repeat(200),
    `feature/${'very-long-branch-name-'.repeat(8)}`,
    'release/2026.11.24',
  ];
  const workers = [...sites.map((s) => s.worker), 'x', 'a-forty-character-worker-name-for-tests-', 'w'.repeat(50)];
  for (const worker of workers) {
    for (const branch of branches) {
      const alias = previewAlias(worker, branch);
      const label = `${alias}-${worker}`;
      assert.ok(label.length <= MAX_DNS_LABEL, `${label} is ${label.length} chars`);
      assert.match(alias, /^[a-z](?:[a-z0-9-]*[a-z0-9])?$/, `alias "${alias}" for "${branch}"`);
    }
  }
});

test('previewAlias is stable, readable and collision-resistant', () => {
  assert.equal(previewAlias('reelay', 'feat/New Nav'), 'feat-new-nav');
  assert.equal(previewAlias('reelay', 'feat/New Nav'), previewAlias('reelay', 'feat/New Nav'));
  assert.equal(previewAlias('reelay', '42-fix'), 'b-42-fix');
  const long = 'netta-henna-and-feathered-soul';
  const a = previewAlias(long, `feature/${'x'.repeat(40)}-one`);
  const b = previewAlias(long, `feature/${'x'.repeat(40)}-two`);
  assert.notEqual(a, b, 'long branches sharing a prefix get different aliases');
  assert.throws(() => previewAlias('w'.repeat(60), 'main'), /too long/);
});

test('previewUrl is the alias, the worker and the account subdomain', () => {
  const reelay = sites.find((s) => s.dir === 'reelay');
  assert.equal(previewUrl(reelay, 'feat/x'), 'https://feat-x-reelay.heythisisandrewb.workers.dev');
});

test('parseJsonc reads wrangler.jsonc comments without breaking URLs in strings', () => {
  assert.deepEqual(parseJsonc('{\n  // c\n  "a": "https://x.dev/y", /* b */ "n": [1,2,],\n}'), { a: 'https://x.dev/y', n: [1, 2] });
});

test('buildShaIn reads the build stamp', () => {
  const sha = 'a'.repeat(40);
  assert.equal(buildShaIn(`<head><meta name="build-sha" content="${sha}"></head>`), sha);
  assert.equal(buildShaIn('<head></head>'), '');
});

test('pnpmCommand runs JS pnpm with node and the native @pnpm/exe binary directly', async () => {
  const { pnpmCommand } = await import('./pnpm-command.mjs');
  assert.deepEqual(pnpmCommand({ npm_execpath: '/x/pnpm/bin/pnpm.cjs' }), [process.execPath, ['/x/pnpm/bin/pnpm.cjs']]);
  assert.deepEqual(pnpmCommand({ npm_execpath: '/Users/a/Library/pnpm/pnpm' }), ['/Users/a/Library/pnpm/pnpm', []]);
  assert.deepEqual(pnpmCommand({ npm_execpath: 'C:\\pnpm\\pnpm.exe' }), ['C:\\pnpm\\pnpm.exe', []]);
  const [cmd] = pnpmCommand({});
  assert.ok(['pnpm', 'corepack'].includes(cmd));
});
