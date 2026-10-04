// The API against a throwaway site folder: reads, guarded writes, path
// safety, uploads. No server: the handler is called with fake req/res.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { createLocalCmsHandler } from '../src/middleware.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'local-cms-'));
fs.mkdirSync(path.join(root, 'src/data'), { recursive: true });
fs.mkdirSync(path.join(root, 'src/assets/logos'), { recursive: true });
const store = path.join(root, 'src/data/items.json');
const original = '[\n  {\n    "label": "Building",\n    "value": "x"\n  }\n]\n';
fs.writeFileSync(store, original);
fs.writeFileSync(path.join(root, 'src/assets/logos/a.png'), Buffer.from([137, 80, 78, 71]));
fs.writeFileSync(path.join(root, 'secret.txt'), 'nope');

const handler = createLocalCmsHandler({
  root,
  config: { collections: [{ name: 'items', file: 'src/data/items.json', itemLabel: 'label', fields: [{ key: 'label', type: 'text', required: true }, { key: 'value', type: 'text', required: true }] }] },
});

function call(method, url, body) {
  return new Promise((resolve) => {
    const req = Readable.from(body === undefined ? [] : [Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))]);
    Object.assign(req, { method, url });
    const headers = {};
    const chunks = [];
    const res = {
      statusCode: 200, headersSent: false,
      setHeader: (k, v) => { headers[k.toLowerCase()] = v; },
      write: (c) => chunks.push(Buffer.from(c)),
      end: (c) => { if (c) chunks.push(Buffer.from(c)); res.headersSent = true; resolve({ status: res.statusCode, headers, body: Buffer.concat(chunks).toString() }); },
      on: () => res, once: () => res, emit: () => true,
    };
    // streams piped into res (asset previews)
    res.write = (c) => { chunks.push(Buffer.from(c)); return true; };
    handler(req, res, () => resolve({ status: 'next' }));
  });
}

const r1 = await call('GET', '/api/local-cms/data/items');
assert.equal(r1.body, original, 'GET returns the file');
assert.equal((await call('GET', '/somewhere/else')).status, 'next', 'other URLs pass through');
assert.equal((await call('GET', '/api/local-cms/data/nope')).status, 404);

for (const bad of ['[]', 'null', '{}', '[{"label":"Building","value":""}]']) {
  const r = await call('POST', '/api/local-cms/data/items', bad);
  assert.equal(r.status, 400, `${bad} refused`);
  assert.equal(fs.readFileSync(store, 'utf8'), original, `${bad} leaves the file untouched`);
}
const w = await call('POST', '/api/local-cms/data/items', '[{"label":"Building","value":"y"},{"label":"Next","value":"z"}]');
assert.equal(w.status, 200);
assert.equal(fs.readFileSync(store, 'utf8'), '[\n  {\n    "label": "Building",\n    "value": "y"\n  },\n  {\n    "label": "Next",\n    "value": "z"\n  }\n]\n', 'written pretty-printed');
assert.deepEqual(fs.readdirSync(path.dirname(store)).filter((f) => f.endsWith('.tmp')), [], 'no temp file left behind');

const assets = JSON.parse((await call('GET', '/api/local-cms/assets')).body);
assert.deepEqual(assets.files, ['src/assets/logos/a.png']);
assert.equal((await call('GET', '/api/local-cms/asset?path=src/assets/logos/a.png')).status, 200);
assert.equal((await call('GET', '/api/local-cms/asset?path=src/assets/../../secret.txt')).status, 404, 'no reading outside assetsDir');
assert.equal((await call('GET', '/api/local-cms/asset?path=../secret.txt')).status, 404);

const png = `data:image/png;base64,${Buffer.from([137, 80, 78, 71]).toString('base64')}`;
const u1 = JSON.parse((await call('POST', '/api/local-cms/upload', { filename: 'My Logo!.PNG', data: png })).body);
assert.equal(u1.path, 'src/assets/uploads/my-logo.png');
const u2 = JSON.parse((await call('POST', '/api/local-cms/upload', { filename: 'my-logo.png', data: png })).body);
assert.equal(u2.path, 'src/assets/uploads/my-logo-2.png', 'never overwrites');
assert.equal((await call('POST', '/api/local-cms/upload', { filename: 'x.svg', data: png })).status, 400, 'images only (no svg)');
assert.equal((await call('POST', '/api/local-cms/upload', { filename: '../../evil.png', data: png })).status, 200);
assert.ok(fs.existsSync(path.join(root, 'src/assets/uploads/evil.png')), 'a path in the name is stripped');

fs.rmSync(root, { recursive: true, force: true });
console.log('local-cms middleware: ok');
