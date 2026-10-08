/*
  ONE PROJECT ID, EVERYWHERE.

  scripts/import-hub-artwork.mjs shipped with a project id it had invented.
  Nothing about that failed loudly: the write token authenticated fine, and
  all 23 uploads came back "Unauthorized - Session does not match project
  host", which reads like a bad credential and is not one. A whole import run
  was spent finding out.

  So every place in the repo that names a Sanity project has to agree with
  src/lib/sanity-project.ts, which is the one module both the site and the
  standalone scripts can import.
*/
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed += 1;
  } catch (error) {
    console.log(`  ✗ ${name}\n    ${error.message}`);
    failed += 1;
  }
}

console.log('\nSanity project identity');

const SHARED = readFileSync(join(root, 'src/lib/sanity-project.ts'), 'utf8');
const shared = SHARED.match(/projectId:\s*'([^']+)'/);

/* Everything a person edits. node_modules and build output are not ours. */
const SKIP = new Set(['node_modules', 'dist', '.git', '.astro', 'public', '.wrangler']);
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|mjs|astro|json)$/.test(name)) out.push(full);
  }
  return out;
}

test('the shared module declares a project id', () => {
  assert.ok(shared, 'src/lib/sanity-project.ts must declare projectId');
});

test('every hardcoded project id in the repo matches it', () => {
  const id = shared[1];
  const wrong = [];
  for (const file of walk(root)) {
    const rel = relative(root, file);
    if (rel === 'src/lib/sanity-project.ts') continue;
    const body = readFileSync(file, 'utf8');
    for (const m of body.matchAll(/projectId['"]?\s*[:=]\s*['"]([^'"]+)['"]/g)) {
      if (m[1] !== id) wrong.push(`${rel}: ${m[1]}`);
    }
  }
  assert.deepEqual(wrong, [], `these name a different project than ${id}`);
});

test('scripts that upload assets read the id, never repeat it', () => {
  /*
    A script may not carry its own copy. It has no page to render, so a wrong
    one is invisible until every upload has already failed.
  */
  const body = readFileSync(join(root, 'scripts/import-hub-artwork.mjs'), 'utf8');
  assert.match(body, /import \{ SANITY_PROJECT \} from '\.\.\/src\/lib\/sanity-project\.ts'/,
    'the importer must read the shared project, not declare one');
  assert.doesNotMatch(body, /projectId\s*=\s*'/, 'no local copy of the project id');
});

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed.\n`);
process.exit(failed === 0 ? 0 : 1);
