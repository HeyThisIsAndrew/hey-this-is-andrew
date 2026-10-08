/**
 * Visual parity harness for pure refactors.
 *
 * Serves the built `dist/client` output statically and screenshots a fixed set
 * of routes at four viewport widths, hashing each capture. Run it once before a
 * refactor (`--save baseline`) and again after (`--save after`), then diff the
 * two manifests (`--compare baseline after`).
 *
 * A structural refactor that changes no rendered output produces byte-identical
 * screenshots, so a hash mismatch is a real regression signal rather than a
 * judgement call. Captures land in `.visual-parity/` (gitignored).
 *
 * Usage:
 *   npm run build && node scripts/visual-parity.mjs --save baseline
 *   ...refactor...
 *   npm run build && node scripts/visual-parity.mjs --save after
 *   node scripts/visual-parity.mjs --compare baseline after
 */
import puppeteer from 'puppeteer';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const distDir = path.join(projectRoot, 'dist', 'client');
const outRoot = path.join(projectRoot, '.visual-parity');

/** Routes covering every page touched by the layout-component refactor. */
const ROUTES = [
  '/',
  '/about',
  '/feed',
  '/feed/2',
  '/feed/videos',
  '/feed/articles',
  '/feed/film',
  '/feed/gaming',
  '/intel',
  '/intel/topic/film',
  '/events',
  '/featured',
  '/collaborations',
  '/links',
  '/404',
];

/** Breakpoints: small phone, modern phone, tablet, desktop. */
const WIDTHS = [320, 390, 768, 1440];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
};

function serve() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const candidates = [
      path.join(distDir, urlPath),
      path.join(distDir, urlPath, 'index.html'),
      path.join(distDir, `${urlPath}.html`),
    ];
    for (const candidate of candidates) {
      // Guard against path traversal escaping the dist root.
      if (!candidate.startsWith(distDir)) continue;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        res.writeHead(200, { 'Content-Type': MIME[path.extname(candidate)] ?? 'application/octet-stream' });
        fs.createReadStream(candidate).pipe(res);
        return;
      }
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  });
  return new Promise((resolve) => {
    server.listen(0, () => resolve({ server, port: server.address().port }));
  });
}

async function capture(label) {
  if (!fs.existsSync(distDir)) {
    console.error(`[visual-parity] No build found at ${distDir}. Run \`npm run build\` first.`);
    process.exit(1);
  }

  const outDir = path.join(outRoot, label);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const { server, port } = await serve();
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  });
  const page = await browser.newPage();

  // Motion would make captures nondeterministic; the site's reveal animations
  // are scroll/IntersectionObserver driven, so freeze them and force the
  // end-state that a fully-scrolled page would settle into.
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);

  const manifest = {};

  for (const route of ROUTES) {
    for (const width of WIDTHS) {
      await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
      const response = await page.goto(`http://localhost:${port}${route}`, {
        waitUntil: 'networkidle0',
        timeout: 60000,
      }).catch(() => null);

      const status = response ? response.status() : 0;
      if (status !== 200) {
        console.warn(`[visual-parity] ${route} @${width} -> HTTP ${status}, skipped`);
        continue;
      }

      // Settle the reveal animations: mark every observer-driven element as
      // already revealed so the capture is the resting state, not mid-fade.
      await page.evaluate(() => {
        document.querySelectorAll('.reveal, .animate-on-scroll').forEach((el) => {
          el.setAttribute('data-state', 'in');
          el.style.opacity = '1';
          el.style.transform = 'none';
          el.style.transition = 'none';
          el.style.animation = 'none';
        });
      });
      await new Promise((r) => setTimeout(r, 250));

      const name = `${route === '/' ? 'home' : route.slice(1).replace(/\//g, '_')}@${width}.png`;
      const file = path.join(outDir, name);
      const buffer = await page.screenshot({ path: file, fullPage: true });
      const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
      manifest[name] = hash;
      console.log(`[visual-parity] ${name} ${hash}`);
    }
  }

  await browser.close();
  server.close();

  fs.writeFileSync(path.join(outRoot, `${label}.json`), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\n[visual-parity] Captured ${Object.keys(manifest).length} screenshots -> ${outDir}`);
}

function compare(a, b) {
  const load = (label) => {
    const file = path.join(outRoot, `${label}.json`);
    if (!fs.existsSync(file)) {
      console.error(`[visual-parity] Missing manifest: ${file}`);
      process.exit(1);
    }
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  };

  const before = load(a);
  const after = load(b);
  const names = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();

  const changed = [];
  const missing = [];
  for (const name of names) {
    if (!(name in before)) missing.push(`only in ${b}: ${name}`);
    else if (!(name in after)) missing.push(`only in ${a}: ${name}`);
    else if (before[name] !== after[name]) changed.push(name);
  }

  console.log(`\n[visual-parity] ${names.length} captures compared (${a} -> ${b})`);
  missing.forEach((m) => console.log(`  ! ${m}`));

  if (changed.length === 0) {
    console.log('  ✓ All screenshots byte-identical. Visual parity confirmed.');
  } else {
    console.log(`  ✗ ${changed.length} screenshot(s) differ:`);
    changed.forEach((name) => {
      console.log(`      ${name}`);
      console.log(`        ${a}: ${path.join(outRoot, a, name)}`);
      console.log(`        ${b}: ${path.join(outRoot, b, name)}`);
    });
  }

  if (changed.length > 0 || missing.length > 0) process.exitCode = 1;
}

const args = process.argv.slice(2);
const saveIdx = args.indexOf('--save');
const cmpIdx = args.indexOf('--compare');

if (saveIdx !== -1) {
  await capture(args[saveIdx + 1] ?? 'baseline');
} else if (cmpIdx !== -1) {
  compare(args[cmpIdx + 1] ?? 'baseline', args[cmpIdx + 2] ?? 'after');
} else {
  console.log('Usage: node scripts/visual-parity.mjs --save <label> | --compare <labelA> <labelB>');
  process.exit(1);
}
