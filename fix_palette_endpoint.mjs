import fs from 'fs';
const p = 'packages/ui/src/CommandPalette.astro';
let src = fs.readFileSync(p, 'utf8');

src = src.replace("---", "---\ninterface Props {\n  endpoint?: string;\n}\nconst { endpoint = '/api/search-index.json' } = Astro.props;\n");

src = src.replace("fetch('/api/search-index.json')", "fetch(this.dataset.endpoint || '/api/search-index.json')");
src = src.replace('<div id="cmd-palette-backdrop"', '<div id="cmd-palette-backdrop" data-endpoint={endpoint}');
fs.writeFileSync(p, src);
