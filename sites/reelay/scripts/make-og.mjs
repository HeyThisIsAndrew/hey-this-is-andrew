#!/usr/bin/env node
/**
 * make-og.mjs: render one 1200×630 Open Graph image per page into
 * public/og/<slug>.png (slug = the page path with / as -, "home" for /).
 * Run after a build when a page's title changes:
 *   ASTRO_TELEMETRY_DISABLED=1 npm run build && npm run og
 * It reads each built page's <title> and description, so the image always
 * says what the page says. Needs Playwright's Chromium (set
 * PW_EXECUTABLE_PATH to use a preinstalled one). The PNGs are committed, so
 * a normal build never needs a browser.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const out = path.join(root, 'public/og');
fs.mkdirSync(out, { recursive: true });

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(d, e.name)) : e.name === 'index.html' ? [path.join(d, e.name)] : []);
const pages = walk(dist).map((f) => {
  const html = fs.readFileSync(f, 'utf8');
  const rel = path.relative(dist, path.dirname(f));
  const slug = rel ? rel.split(path.sep).join('-') : 'home';
  const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, '’').replace(/&quot;/g, '"');
  const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '';
  const title = decode(h1.replace(/<br\b[^>]*>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
    || decode((html.match(/<title>([^<]*)<\/title>/) || [])[1] || 'Reelay').split(':')[0].trim();
  const eyebrow = decode((html.match(/<p class="eyebrow[^"]*"[^>]*>([^<]*)<\/p>/) || [])[1] || 'Reelay Studio');
  return { slug, title: slug === 'home' ? 'Publish everywhere. Never lose control.' : title, eyebrow: slug === 'home' ? 'Reelay Studio' : eyebrow };
});

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const mark = `<svg viewBox="0 0 32 32" width="88" height="88"><defs><linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c2c30"/><stop offset="1" stop-color="#0c0c0e"/></linearGradient><linearGradient id="r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe2a8"/><stop offset=".5" stop-color="#f0b44c"/><stop offset="1" stop-color="#df6f3c"/></linearGradient></defs><rect width="32" height="32" rx="8" fill="url(#t)"/><circle cx="16" cy="16" r="9" fill="none" stroke="url(#r)" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="12.6 2.3" transform="rotate(-80 16 16)"/><path d="M14 12.6v6.8l5.4-3.4z" fill="#f5f5f7"/></svg>`;
const template = (p) => `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:1200px;height:630px;background:#000;overflow:hidden}
  body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Inter Variable","Inter",system-ui,sans-serif;color:#f5f5f7;position:relative}
  .glow{position:absolute;left:-10%;right:-10%;bottom:-55%;height:100%;background:radial-gradient(42% 42% at 62% 50%,rgba(240,150,40,.55),rgba(220,90,40,.18) 45%,transparent 72%);filter:blur(12px)}
  .wrap{position:absolute;inset:72px 84px;display:flex;flex-direction:column}
  .brand{display:flex;align-items:center;gap:22px;font-size:40px;font-weight:600;letter-spacing:-.02em}
  .eyebrow{margin-top:auto;font-size:30px;font-weight:600;background:linear-gradient(92deg,#fff3d6,#f5c56b 40%,#e8913a);-webkit-background-clip:text;color:transparent}
  h1{margin:14px 0 0;font-size:${p.title.length > 44 ? 64 : p.title.length > 28 ? 76 : 92}px;line-height:1.02;font-weight:700;letter-spacing:-.045em;max-width:1000px;text-wrap:balance}
</style></head><body><div class="glow"></div><div class="wrap"><div class="brand">${mark}Reelay</div><div class="eyebrow">${esc(p.eyebrow)}</div><h1>${esc(p.title)}</h1></div></body></html>`;

const { createRequire } = await import('node:module');
const require = createRequire(path.join(root, '../../node_modules/.pnpm/@playwright+test@1.64.0/node_modules/@playwright/test/'));
const { chromium } = require('@playwright/test');
const executablePath = process.env.PW_EXECUTABLE_PATH;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const p of pages) {
  await page.setContent(template(p), { waitUntil: 'load' });
  await page.screenshot({ path: path.join(out, `${p.slug}.png`) });
  console.log(`og/${p.slug}.png  ${p.eyebrow} · ${p.title}`);
}
await browser.close();
