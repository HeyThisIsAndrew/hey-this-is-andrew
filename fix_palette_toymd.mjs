import fs from 'fs';
const p = 'packages/ui/src/CommandPalette.astro';
let src = fs.readFileSync(p, 'utf8');
src = src.replace("import { toYMD } from '../lib/events.ts';", "const toYMD = (d) => { const date = new Date(d); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }; // simplified, wait, the comment says avoid new Date(). So: const toYMD = (d) => String(d).split('T')[0];");
fs.writeFileSync(p, src);
