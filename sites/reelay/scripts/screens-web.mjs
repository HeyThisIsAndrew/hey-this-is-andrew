/**
 * screens-web.mjs: web-sized copies of the real app screenshots.
 *
 *   node scripts/screens-web.mjs
 *
 * The captures in public/screens/ are 2880 x 1800 PNGs (500 to 650 KB each),
 * which is right for the record and far too heavy for a page. This writes
 * public/screens/web/<id>-<theme>-<width>.webp at 1440 and 960 wide for the
 * slots the homepage's workflow story shows. The audit fails while a copy is
 * missing or older than its PNG, so a new capture can't ship stale.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** The slots the workflow story uses, and the widths it asks for. */
export const WEB_SLOTS = ['library-grid', 'command-center', 'board'];
export const WEB_WIDTHS = [960, 1440];
export const THEMES = ['light', 'dark'];

export const webFile = (id, theme, w) => path.join(root, 'public/screens/web', `${id}-${theme}-${w}.webp`);
export const srcFile = (id, theme) => path.join(root, 'public/screens', `${id}-${theme}@2x.png`);

/** Every derivative that is missing or older than its source. */
export function stale() {
  const out = [];
  for (const id of WEB_SLOTS) for (const t of THEMES) {
    if (!fs.existsSync(srcFile(id, t))) continue;
    const srcTime = fs.statSync(srcFile(id, t)).mtimeMs;
    for (const w of WEB_WIDTHS) {
      const f = webFile(id, t, w);
      if (!fs.existsSync(f) || fs.statSync(f).mtimeMs < srcTime) out.push(path.relative(root, f));
    }
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { default: sharp } = await import('sharp');
  fs.mkdirSync(path.join(root, 'public/screens/web'), { recursive: true });
  for (const id of WEB_SLOTS) for (const t of THEMES) {
    if (!fs.existsSync(srcFile(id, t))) { console.warn(`skip ${id}-${t}: no capture`); continue; }
    for (const w of WEB_WIDTHS) {
      await sharp(srcFile(id, t)).resize({ width: w }).webp({ quality: 82 }).toFile(webFile(id, t, w));
      console.log(`wrote ${path.relative(root, webFile(id, t, w))} (${Math.round(fs.statSync(webFile(id, t, w)).size / 1024)} KB)`);
    }
  }
}
