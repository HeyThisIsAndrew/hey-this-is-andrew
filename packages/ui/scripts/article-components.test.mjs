import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const uiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(uiDir, 'package.json'), 'utf8'));

const COMPONENTS = [
  'SubstackGallery.astro',
  'MagazineSpread.astro',
  'TableOfContents.astro',
  'ArticleReader.astro',
];

for (const name of COMPONENTS) {
  test(`${name} exists and is exported by @andrew/ui`, () => {
    const exportTarget = pkg.exports[`./${name}`];
    assert.equal(exportTarget, `./src/${name}`);
    assert.ok(fs.existsSync(path.join(uiDir, exportTarget)));
  });
}

test('SubstackGallery uses native <dialog>, modern scroll containment, status region, and tokens', () => {
  const src = fs.readFileSync(path.join(uiDir, 'src/SubstackGallery.astro'), 'utf8');
  assert.match(src, /createElement\(['"]dialog['"]\)/);
  assert.match(src, /\.showModal\(\)/);
  assert.match(src, /:modal\s*\{[^}]*overscroll-behavior:\s*contain/);
  assert.match(src, /::backdrop\s*\{[^}]*overflow:\s*hidden;[^}]*overscroll-behavior:\s*contain/);
  assert.match(src, /overscroll-behavior-x:\s*contain/);
  assert.match(src, /role['"],\s*['"]status['"]/);
  assert.doesNotMatch(src, /body\.style\.position\s*=\s*['"]fixed['"]/);
  assert.doesNotMatch(src, /#cc0000|204,\s*0,\s*0/i);
  assert.match(src, /var\(--color-accent/);
  assert.match(src, /var\(--focus-ring/);
});

test('MagazineSpread, TableOfContents, and ArticleReader use @andrew/tokens without HQ red', () => {
  for (const name of ['MagazineSpread.astro', 'TableOfContents.astro', 'ArticleReader.astro']) {
    const src = fs.readFileSync(path.join(uiDir, 'src', name), 'utf8');
    assert.doesNotMatch(src, /#cc0000|204,\s*0,\s*0|#ef4444/i, `${name} must not hardcode HQ red`);
    assert.match(src, /var\(--/, `${name} must read design tokens`);
  }

  const magazine = fs.readFileSync(path.join(uiDir, 'src/MagazineSpread.astro'), 'utf8');
  assert.match(magazine, /history\.replaceState/);
  assert.match(magazine, /astro:page-load/);
  assert.doesNotMatch(magazine, /\.innerHTML\s*=/);

  const toc = fs.readFileSync(path.join(uiDir, 'src/TableOfContents.astro'), 'utf8');
  assert.match(toc, /IntersectionObserver/);
  assert.match(toc, /astro:before-swap/);

  const reader = fs.readFileSync(path.join(uiDir, 'src/ArticleReader.astro'), 'utf8');
  assert.match(reader, /<SubstackGallery\s*\/>/);
  assert.match(reader, /<TableOfContents\b/);
  assert.match(reader, /44rem/);
});
