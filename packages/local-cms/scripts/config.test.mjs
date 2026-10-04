// Config validation, and the rule that the package is site-agnostic: no
// BE Unconventional HQ field (or any one site's field) is written in it.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateConfig, publicConfig } from '../src/config.mjs';

const ok = { collections: [{ name: 'now', file: 'src/data/now.json', fields: [{ key: 'label', type: 'text' }] }] };
assert.doesNotThrow(() => validateConfig(ok));
const bad = (cfg, re) => assert.throws(() => validateConfig(cfg), re);
bad({ collections: [] }, /non-empty/);
bad({ collections: [{ name: 'Now', file: 'a.json', fields: [{ key: 'a', type: 'text' }] }] }, /lowercase/);
bad({ collections: [{ name: 'a', file: '../escape.json', fields: [{ key: 'a', type: 'text' }] }] }, /relative \.json/);
bad({ collections: [{ name: 'a', file: '/abs.json', fields: [{ key: 'a', type: 'text' }] }] }, /relative \.json/);
bad({ collections: [{ name: 'a', file: 'a.yaml', fields: [{ key: 'a', type: 'text' }] }] }, /relative \.json/);
bad({ collections: [{ name: 'a', file: 'a.json', fields: [{ key: 'a', type: 'colour' }] }] }, /unknown type/);
bad({ collections: [{ name: 'a', file: 'a.json', fields: [{ key: 'a', type: 'select' }] }] }, /needs options/);
bad({ collections: [{ name: 'a', file: 'a.json', fields: [{ key: 'a', type: 'text' }, { key: 'a', type: 'text' }] }] }, /duplicate field/);
bad({ uploadDir: '../out', collections: ok.collections }, /uploadDir/);
assert.equal(JSON.stringify(publicConfig(ok)).includes(process.cwd()), false, 'no absolute paths to the browser');

// Site-agnostic: none of HQ's document fields, and no site's data paths.
const src = fs.readdirSync(new URL('../src/', import.meta.url)).map((f) => fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')).join('\n');
for (const hq of ['franchises', 'coverageType', 'youtubeSyncKeywords', 'featuredBrand', 'hubCategory', 'sanity', 'videos.json', 'now.json', 'brands.json']) {
  assert.equal(src.toLowerCase().includes(hq.toLowerCase()), false, `"${hq}" is site-specific and must not be in the package`);
}
console.log('local-cms config: ok');
