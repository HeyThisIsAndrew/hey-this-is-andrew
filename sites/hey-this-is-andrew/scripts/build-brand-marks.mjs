/**
 * Builds the HEY_THISISANDREW wordmark and the H_ favicon set from Syne 800
 * glyph outlines, so the marks never depend on a font being installed.
 *
 *   npm run build:marks
 *
 * Outputs (committed; rerun only when the mark changes):
 *   src/assets/brand-logos/hey-thisisandrew.svg   stacked lockup, HEY_ over THISISANDREW
 *   src/assets/brand-logos/hey-thisisandrew-line.svg   single line
 *   public/favicon.svg, favicon-16.png, favicon-32.png, favicon-48.png,
 *   favicon-64.png, apple-touch-icon.png (180), icon-512.png, favicon.ico
 *   public/og-image.png   1200x630 link preview
 *
 * Brand rule: the underscore appears EXACTLY ONCE in every lockup.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import opentype from 'opentype.js';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const fontFile = require.resolve('@fontsource/syne/files/syne-latin-800-normal.woff');
const font = opentype.parse(fs.readFileSync(fontFile).buffer.slice(0));

const INK = '#F5F5F5';
const BG = '#080808';

/** Path data plus its tight bounds for one line of text at `size`. */
function line(text, size, x = 0, y = 0) {
  const p = font.getPath(text, x, y, size);
  return { d: p.toPathData(2), box: p.getBoundingBox() };
}

function svgDoc(w, h, body, { bg } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
    (bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : '') + body + `</svg>\n`;
}

/* Stacked lockup: HEY_ over THISISANDREW, left aligned, one underscore. */
function stacked(size = 200, gap = 0.3) {
  const a = line('HEY_', size, 0, size);
  // Second line starts `gap` below the lowest point of the first (the
  // underscore), measured from the real glyph bounds.
  const probe = line('THISISANDREW', size, 0, size);
  const shift = a.box.y2 + size * gap - probe.box.y1;
  const b = line('THISISANDREW', size, 0, size + shift);
  const minX = Math.min(a.box.x1, b.box.x1);
  const minY = Math.min(a.box.y1, b.box.y1);
  const maxX = Math.max(a.box.x2, b.box.x2);
  const maxY = Math.max(a.box.y2, b.box.y2);
  const w = Math.ceil(maxX - minX), h = Math.ceil(maxY - minY);
  const body = `<g fill="${INK}" transform="translate(${(-minX).toFixed(2)} ${(-minY).toFixed(2)})"><path d="${a.d}"/><path d="${b.d}"/></g>`;
  return { w, h, body };
}

function single(size = 200) {
  const a = line('HEY_THISISANDREW', size, 0, size);
  const w = Math.ceil(a.box.x2 - a.box.x1), h = Math.ceil(a.box.y2 - a.box.y1);
  return { w, h, body: `<g fill="${INK}" transform="translate(${(-a.box.x1).toFixed(2)} ${(-a.box.y1).toFixed(2)})"><path d="${a.d}"/></g>` };
}

/* Favicon: H_ centred on a square, sized so the H stays legible at 16px. */
function faviconSvg() {
  const S = 64;
  const PAD = 4; // keeps the mark off the edge of a 16px tab icon
  const probe = line('H_', 100, 0, 100);
  const pw = probe.box.x2 - probe.box.x1, ph = probe.box.y2 - probe.box.y1;
  const size = 100 * Math.min((S - PAD * 2) / pw, (S - PAD * 2) / ph);
  const a = line('H_', size, 0, size);
  const bw = a.box.x2 - a.box.x1, bh = a.box.y2 - a.box.y1;
  const tx = (S - bw) / 2 - a.box.x1;
  const ty = (S - bh) / 2 - a.box.y1;
  return svgDoc(S, S, `<path fill="${INK}" transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)})" d="${a.d}"/>`, { bg: BG });
}

/** ICO container holding PNG images (supported by every current browser). */
function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(pngs.length, 4);
  const dir = Buffer.alloc(16 * pngs.length);
  let offset = 6 + dir.length;
  pngs.forEach(({ size, buf }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o);
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2); dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4); dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(buf.length, o + 8); dir.writeUInt32LE(offset, o + 12);
    offset += buf.length;
  });
  return Buffer.concat([header, dir, ...pngs.map((p) => p.buf)]);
}

const out = (rel, data) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
  console.log('wrote', rel);
};

const st = stacked();
out('src/assets/brand-logos/hey-thisisandrew.svg', svgDoc(st.w, st.h, st.body));
const sl = single();
out('src/assets/brand-logos/hey-thisisandrew-line.svg', svgDoc(sl.w, sl.h, sl.body));

const fav = faviconSvg();
out('public/favicon.svg', fav);
const pngs = [];
for (const size of [16, 32, 48, 64, 180, 512]) {
  const buf = await sharp(Buffer.from(fav), { density: Math.max(72, (72 * size) / 64 * 4) })
    .resize(size, size, { kernel: 'lanczos3' }).png().toBuffer();
  if ([16, 32, 48].includes(size)) pngs.push({ size, buf });
  const name = size === 180 ? 'apple-touch-icon.png' : size === 512 ? 'icon-512.png' : `favicon-${size}.png`;
  out(`public/${name}`, buf);
}
out('public/favicon.ico', ico(pngs));

/* Link preview: the stacked lockup centred on the site black. */
{
  const W = 1200, H = 630, maxW = 620;
  const scale = maxW / st.w;
  const w = st.w * scale, h = st.h * scale;
  const body = `<g transform="translate(${((W - w) / 2).toFixed(2)} ${((H - h) / 2).toFixed(2)}) scale(${scale.toFixed(4)})">${st.body}</g>`;
  out('public/og-image.png', await sharp(Buffer.from(svgDoc(W, H, body, { bg: BG }))).png().toBuffer());
}
