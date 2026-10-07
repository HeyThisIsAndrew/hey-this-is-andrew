import fs from 'fs';
const p = 'sites/hey-this-is-andrew/scripts/controls.test.mjs';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  "const baseCss = read(new URL('../../../packages/ui/src/styles/base.css', import.meta.url));\nassert.match(baseCss, /\\.dropdown-menu \\{[^}]*z-index: 150;/, 'dropdown menu z-index is 150');",
  "const navAstro = read(new URL('../../../packages/ui/src/Nav.astro', import.meta.url));\nassert.match(navAstro, /\\.dropdown-menu \\{[^}]*z-index: 150;/, 'dropdown menu z-index is 150');"
);

fs.writeFileSync(p, c);
