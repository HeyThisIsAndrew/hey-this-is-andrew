// Image hosts: Sanity asset ids (HQ's system) and in-repo paths.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { isSanityRef, parseImageRef, sanityImageUrl, uploadToSanity } from '../src/sanity.mjs';
import { resolveImage } from '../src/images.mjs';
import { createLocalCmsHandler } from '../src/middleware.mjs';

const REF = 'image-0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c-1600x900-jpg';
const S = { projectId: 'abc123', dataset: 'production' };

assert.equal(isSanityRef(REF), true);
assert.equal(isSanityRef('src/assets/a.png'), false);
assert.deepEqual(parseImageRef(REF), { id: '0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c', width: 1600, height: 900, ext: 'jpg' });
assert.equal(sanityImageUrl(REF, S), 'https://cdn.sanity.io/images/abc123/production/0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c-1600x900.jpg');
assert.equal(sanityImageUrl(REF, S, { w: 640, auto: 'format' }), 'https://cdn.sanity.io/images/abc123/production/0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c-1600x900.jpg?w=640&auto=format');

// resolveImage: local, remote, and the two failures
const logo = { src: '/x.png', width: 10, height: 10, format: 'png' };
const opts = { images: { '../assets/brand-logos/be.png': logo }, prefix: '../assets/', sanity: S, where: 'brands.be.logo' };
assert.equal(resolveImage('src/assets/brand-logos/be.png', opts), logo);
assert.deepEqual(resolveImage(REF, opts), { src: sanityImageUrl(REF, S), width: 1600, height: 900, remote: true });
assert.equal(resolveImage('', opts), undefined);
assert.throws(() => resolveImage('src/assets/nope.png', opts), /brands\.be\.logo/);
assert.throws(() => resolveImage(REF, { ...opts, sanity: undefined }), /no Sanity project/);

// uploadToSanity with a stand-in fetch: the request it makes, and its errors
let seen;
const okFetch = async (url, init) => { seen = { url, init }; return { ok: true, json: async () => ({ document: { _id: REF } }) }; };
assert.equal(await uploadToSanity(Buffer.from('x'), 'a b.jpg', { ...S, token: 't0k' }, okFetch), REF);
assert.equal(seen.url, 'https://abc123.api.sanity.io/v2024-03-01/assets/images/production?filename=a%20b.jpg');
assert.equal(seen.init.headers.Authorization, 'Bearer t0k');
assert.equal(seen.init.headers['Content-Type'], 'image/jpeg');
await assert.rejects(uploadToSanity(Buffer.from('x'), 'a.jpg', { ...S, token: '' }, okFetch), /No Sanity write token/);
await assert.rejects(uploadToSanity(Buffer.from('x'), 'a.jpg', { ...S, token: 't' }, async () => ({ ok: false, status: 401, json: async () => ({ message: 'Unauthorized' }) })), /401.*Unauthorized/);

// The API with imageHost: sanity answers an upload with the asset id
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'local-cms-img-'));
process.env.TEST_SANITY_TOKEN = 'abc';
const handler = createLocalCmsHandler({
  root,
  config: { imageHost: { type: 'sanity', ...S, tokenEnv: 'TEST_SANITY_TOKEN' }, collections: [{ name: 'a', file: 'a.json', fields: [{ key: 'x', type: 'asset' }] }] },
  fetchImpl: okFetch,
});
const res = await new Promise((resolve) => {
  const req = Readable.from([Buffer.from(JSON.stringify({ filename: 'Logo.png', data: `data:image/png;base64,${Buffer.from('png').toString('base64')}` }))]);
  Object.assign(req, { method: 'POST', url: '/api/local-cms/upload' });
  const out = { statusCode: 200, headersSent: false, setHeader() {}, end: (b) => resolve({ status: out.statusCode, body: JSON.parse(b) }) };
  handler(req, out, () => resolve({ status: 'next' }));
});
assert.equal(res.status, 200);
assert.equal(res.body.path, REF);
assert.equal(seen.init.headers.Authorization, 'Bearer abc');
assert.equal(fs.existsSync(path.join(root, 'src/assets/uploads')), false, 'nothing written to the repo when Sanity hosts images');
fs.rmSync(root, { recursive: true, force: true });

console.log('local-cms images: ok');
