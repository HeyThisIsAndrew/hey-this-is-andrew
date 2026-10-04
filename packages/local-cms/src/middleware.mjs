/*
  The local CMS API, as Vite dev-server middleware. It exists only while
  `astro dev` runs (configureServer never runs for `astro build`), so none of
  it ships. Every route is under /api/local-cms/:

    GET  config              the collections and their fields (no absolute paths)
    GET  data/<collection>   the collection's JSON file
    POST data/<collection>   overwrite it: validated (store.mjs), pretty-printed,
                             written atomically (temp file, then rename)
    GET  assets              image files under assetsDir, as site-relative paths
    GET  asset?path=...      one of those files (for previews)
    POST upload              { filename, data: <data URL> } -> an image saved
                             under uploadDir, never overwriting a file

  Only the files named in the config can be written, and paths never leave
  the site's root.
*/
import fs from 'node:fs';
import path from 'node:path';
import { validateConfig, publicConfig } from './config.mjs';
import { validateStorePayload, serializeStore } from './store.mjs';

const MAX_STORE_BYTES = 5 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > limit) {
        reject(Object.assign(new Error('Payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

/** A path under `base`, or null if it would leave it. */
function inside(base, rel) {
  const abs = path.resolve(base, rel);
  return abs === base || abs.startsWith(base + path.sep) ? abs : null;
}

function listImages(root, dir) {
  const base = path.resolve(root, dir);
  const out = [];
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (IMAGE_EXT.has(path.extname(e.name).toLowerCase())) out.push(path.relative(root, p).split(path.sep).join('/'));
    }
  };
  walk(base);
  return out.sort();
}

function safeName(name) {
  const ext = path.extname(name).toLowerCase();
  const stem = path.basename(name, path.extname(name)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'image';
  return { stem, ext };
}

/**
 * @param {{ root: string, config: import('./config.mjs').LocalCmsConfig }} opts
 * @returns {(req: import('http').IncomingMessage, res: import('http').ServerResponse, next: () => void) => void}
 */
export function createLocalCmsHandler({ root, config }) {
  validateConfig(config);
  const siteRoot = path.resolve(root);
  const assetsDir = config.assetsDir ?? 'src/assets';
  const uploadDir = config.uploadDir ?? 'src/assets/uploads';
  const byName = new Map(config.collections.map((c) => [c.name, c]));

  return (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://local');
    const at = url.pathname.indexOf('/api/local-cms/');
    if (at < 0) return next();
    const route = url.pathname.slice(at + '/api/local-cms/'.length);

    (async () => {
      if (route === 'config' && req.method === 'GET') return send(res, 200, publicConfig(config));

      if (route.startsWith('data/')) {
        const c = byName.get(route.slice(5));
        if (!c) return send(res, 404, { success: false, error: 'Unknown collection' });
        const file = inside(siteRoot, c.file);
        if (!file) return send(res, 400, { success: false, error: 'Bad path' });
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : '[]');
          return;
        }
        if (req.method === 'POST') {
          const body = await readBody(req, MAX_STORE_BYTES);
          const check = validateStorePayload(body, c.file, c);
          if (!check.ok) return send(res, check.status, { success: false, error: check.error });
          const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
          fs.writeFileSync(tmp, serializeStore(check.parsed), 'utf-8');
          fs.renameSync(tmp, file);
          return send(res, 200, { success: true, count: check.parsed.length });
        }
      }

      if (route === 'assets' && req.method === 'GET') return send(res, 200, { assetsDir, files: listImages(siteRoot, assetsDir) });

      if (route === 'asset' && req.method === 'GET') {
        const rel = url.searchParams.get('path') ?? '';
        const abs = inside(path.resolve(siteRoot, assetsDir), path.relative(assetsDir, rel));
        const ext = path.extname(rel).toLowerCase();
        if (!abs || !IMAGE_EXT.has(ext) || !fs.existsSync(abs)) return send(res, 404, { error: 'Not found' });
        res.setHeader('Content-Type', MIME[ext]);
        res.setHeader('Cache-Control', 'no-store');
        fs.createReadStream(abs).pipe(res);
        return;
      }

      if (route === 'upload' && req.method === 'POST') {
        const body = JSON.parse(await readBody(req, MAX_UPLOAD_BYTES * 1.4));
        const { stem, ext } = safeName(String(body.filename ?? ''));
        if (!IMAGE_EXT.has(ext)) return send(res, 400, { error: `Only ${[...IMAGE_EXT].join(', ')} images` });
        const m = /^data:image\/[a-z+]+;base64,(.+)$/.exec(String(body.data ?? ''));
        if (!m) return send(res, 400, { error: 'Expected a base64 data URL' });
        const buffer = Buffer.from(m[1], 'base64');
        if (buffer.length > MAX_UPLOAD_BYTES) return send(res, 413, { error: 'Image too large' });
        const dir = inside(siteRoot, uploadDir);
        if (!dir) return send(res, 400, { error: 'Bad upload dir' });
        fs.mkdirSync(dir, { recursive: true });
        let name = `${stem}${ext}`;
        for (let n = 2; fs.existsSync(path.join(dir, name)); n++) name = `${stem}-${n}${ext}`;
        fs.writeFileSync(path.join(dir, name), buffer);
        return send(res, 200, { path: `${uploadDir.replace(/\/$/, '')}/${name}` });
      }

      return send(res, 404, { error: 'Unknown local CMS route' });
    })().catch((err) => {
      if (res.headersSent) return;
      send(res, err?.status ?? 500, { success: false, error: err instanceof Error ? err.message : String(err) });
    });
  };
}

/** The Vite plugin: the handler on the dev server only. */
export function localCmsVitePlugin(opts) {
  const handler = createLocalCmsHandler(opts);
  return {
    name: 'andrew-local-cms-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(handler);
    },
  };
}
