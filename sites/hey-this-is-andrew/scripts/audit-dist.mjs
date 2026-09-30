#!/usr/bin/env node
/**
 * scripts/audit-dist.mjs: checks the BUILT site (run after `npm run build`).
 *
 *   npm run test:dist
 *
 * Every page must carry the same chrome and head (defect 36), and the brand
 * and link rules must hold on every page:
 *   - exactly one site header, one footer, one <h1>, the favicon set,
 *     a <title> carrying HEY_THISISANDREW, a description, a canonical
 *   - dark theme shipped on <html>; no theme toggle rendered
 *   - no double-underscore wordmark, no em dash in visible text
 *   - no Instagram CDN URL anywhere (photos are self-hosted)
 *   - every internal link and image resolves to a built file
 *   - every target="_blank" link has rel="noopener"
 *   - no dead anchors: every internal link with a #fragment points at a page
 *     that has an element with that id
 */
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(process.argv[2] || 'dist');
const base = (process.env.ASTRO_BASE || '/').replace(/\/?$/, '/');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const pages = walk(dist).filter((f) => f.endsWith('.html'));
const failures = [];
const fail = (page, msg) => failures.push(`${path.relative(dist, page)}: ${msg}`);

const count = (html, re) => (html.match(re) || []).length;
const visibleText = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');

const idCache = new Map();
function idsOf(file) {
  if (!idCache.has(file)) {
    const html = fs.readFileSync(file, 'utf8');
    idCache.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  }
  return idCache.get(file);
}
function pageFile(url, fromPage) {
  let u = url.split('#')[0].split('?')[0];
  if (!u) return fromPage;
  if (!u.startsWith(base)) return null;
  u = decodeURIComponent(u.slice(base.length));
  const p = path.join(dist, u);
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return p.endsWith('.html') ? p : null;
  if (fs.existsSync(path.join(p, 'index.html'))) return path.join(p, 'index.html');
  return null;
}

function resolveLocal(url) {
  let u = url.split('#')[0].split('?')[0];
  if (!u) return true;
  if (!u.startsWith(base)) return false;
  u = decodeURIComponent(u.slice(base.length));
  const p = path.join(dist, u);
  return fs.existsSync(p) && fs.statSync(p).isFile() ? true : fs.existsSync(path.join(p, 'index.html')) || fs.existsSync(p + '.html');
}

for (const page of pages) {
  const raw = fs.readFileSync(page, 'utf8');
  // Redirect stubs (Astro `redirects`) are not pages: check only the target.
  if (/<meta http-equiv="refresh"/i.test(raw)) {
    const to = (raw.match(/content="\d+;\s*url=([^"]+)"/i) || [])[1];
    if (!to || !resolveLocal(to)) fail(page, `redirect to a missing page: ${to}`);
    continue;
  }
  // Attribute scans ignore inline scripts (their regexes look like markup).
  const html = raw.replace(/<script\b(?![^>]*type="application\/(?:ld\+)?json")[^>]*>[\s\S]*?<\/script>/gi, '<script></script>');
  if (count(html, /<header[^>]*class="[^"]*site-nav/g) !== 1) fail(page, 'site header count != 1');
  if (count(html, /<footer[^>]*class="[^"]*site-footer/g) !== 1) fail(page, 'site footer count != 1');
  if (count(html, /<h1[\s>]/g) !== 1) fail(page, `h1 count = ${count(html, /<h1[\s>]/g)}`);
  if (!/<html[^>]*data-theme="dark"/.test(html)) fail(page, 'html not data-theme="dark"');
  if (/id="nav-theme-toggle"/.test(html)) fail(page, 'theme toggle rendered');
  for (const icon of ['favicon.ico', 'favicon.svg', 'favicon-32.png', 'apple-touch-icon.png']) {
    if (!html.includes(`${base}${icon}`)) fail(page, `missing ${icon} link`);
  }
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  if (!title.includes('HEY_THISISANDREW')) fail(page, `title lacks wordmark: "${title}"`);
  if (!/<meta name="description" content="[^"]+"/.test(html)) fail(page, 'missing meta description');
  if (!/<link rel="canonical" href="https:\/\/[^"]+"/.test(html)) fail(page, 'missing canonical');
  if (/HEY__|(^|[^Y])_THISISANDREW/.test(visibleText(html))) fail(page, 'double-underscore wordmark');
  if (/—/.test(visibleText(html))) fail(page, 'em dash in visible text');
  if (/cdninstagram\.com|fbcdn\.net/.test(html)) fail(page, 'Instagram CDN URL in page');
  for (const m of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) {
    if (!/rel="[^"]*noopener/.test(m[0])) fail(page, `target=_blank without noopener: ${m[0].slice(0, 80)}`);
  }
  for (const m of html.matchAll(/\s(href|src)="([^"]+)"/g)) {
    const url = m[2];
    if (/^(https?:|mailto:|tel:|data:|#|javascript:)/.test(url) || url.startsWith('//')) continue;
    if (!resolveLocal(url)) fail(page, `broken ${m[1]}: ${url}`);
  }
  for (const m of html.matchAll(/\shref="([^"]*#[^"]+)"/g)) {
    const url = m[1];
    if (/^(https?:|mailto:|tel:)/.test(url)) continue;
    const frag = decodeURIComponent(url.split('#')[1]);
    if (!frag || frag === 'top') continue;
    const file = pageFile(url, page);
    if (!file) continue; // broken page links are reported above
    if (!idsOf(file).has(frag)) fail(page, `dead anchor: ${url}`);
  }
  for (const m of html.matchAll(/\ssrcset="([^"]+)"/g)) {
    for (const part of m[1].split(',')) {
      const url = part.trim().split(/\s+/)[0];
      if (url && !/^https?:/.test(url) && !resolveLocal(url)) fail(page, `broken srcset: ${url}`);
    }
  }
}

console.log(`audit-dist: ${pages.length} pages checked.`);
if (failures.length) {
  console.error(failures.map((f) => `  FAIL ${f}`).join('\n'));
  process.exit(1);
}
console.log('audit-dist: ok');
