import fs from 'fs';
const p = 'packages/ui/src/CommandPalette.astro';
let src = fs.readFileSync(p, 'utf8');
src = src.replace("fetch(this.dataset.endpoint || '/api/search-index.json')", "fetch(document.getElementById('cmd-palette-backdrop').dataset.endpoint || '/api/search-index.json')");
fs.writeFileSync(p, src);
