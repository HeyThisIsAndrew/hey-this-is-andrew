/**
 * screens-manifest.mjs: SCREENS.md, written from src/data/screens.json.
 *
 *   node scripts/screens-manifest.mjs          rewrite SCREENS.md
 *
 * The audit (audit-dist.mjs) imports manifest() and fails when SCREENS.md
 * differs from it, so the capture list can't drift from the slots the pages
 * render (it once still said "N of 7 connected" after the app moved to six
 * cards and a Snapchat strip).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const manifestPath = path.join(root, 'SCREENS.md');

/** The files a slot needs in public/screens/. */
export const slotFiles = (s) => (s.kind === 'image'
  ? s.themes.map((t) => `${s.id}-${t}@2x.png`)
  : [`${s.id}.mp4`, `${s.id}.vtt`, `${s.id}-poster.png`]);

export function manifest() {
  const { slots } = JSON.parse(fs.readFileSync(path.join(root, 'src/data/screens.json'), 'utf8'));
  const rows = slots.map((s) => `| \`${s.id}\` | ${s.kind}${s.optional ? ' *optional*' : ''} | ${s.themes.join(', ')} | ${s.width} × ${s.height} | \`${s.page}\` | ${s.title} | ${slotFiles(s).map((f) => `\`${f}\``).join(' ')} |`);
  return `# Screenshot and screencast slots

Generated from \`src/data/screens.json\` (the registry the pages and the audit read) by
\`node scripts/screens-manifest.mjs\`. Don't edit it by hand: change the JSON and rerun it. The audit fails while they differ.

**Rules:** a demo profile only, never real customer data. Images are PNG at 2x of the CSS size (the Size column),
named \`public/screens/<id>-light@2x.png\` and \`public/screens/<id>-dark@2x.png\` (the app in Light and in Dark). The
page swaps them with the visitor's colour scheme. Screencasts are \`public/screens/<id>.mp4\` (H.264), with
\`<id>.vtt\` English captions and \`<id>-poster.png\`. They never autoplay; no audio is needed.
A slot renders the moment all of its files exist. Until then the page shows a "Screenshot to come" card, and
\`npm run test\` lists it (\`REELAY_RELEASE=1\` makes it fatal).

**Help Center videos** are the slots marked *optional* (\`help-tour-*\`, \`help-*\`): one per tour step and guide,
written by \`npm run help -- <app checkout>\`, which also copies the app's help text and screenshots in. Record each
from the demo profile following that guide's steps. A guide shows its video the moment the files exist; until then it
shows nothing in its place, and the audit only counts them.

| Slot id | Kind | Themes | Size (px) | Page | What it shows | Files |
|---|---|---|---|---|---|---|
${rows.join('\n')}
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.writeFileSync(manifestPath, manifest());
  console.log(`Wrote ${path.relative(process.cwd(), manifestPath)}`);
}
