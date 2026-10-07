import fs from 'fs';
const p = 'sites/hey-this-is-andrew/scripts/controls.test.mjs';
let c = fs.readFileSync(p, 'utf8');

// Add test for z-index
c = c.replace(
  "assert.match(global, /\\.back-to-top \\{[^}]*width: var\\(--btn-h-md\\);[^}]*padding: 0;/, 'back-to-top is a square md control with no UA padding');",
  "assert.match(global, /\\.back-to-top \\{[^}]*width: var\\(--btn-h-md\\);[^}]*padding: 0;/, 'back-to-top is a square md control with no UA padding');\n\n// 4.1 White bar z-index below dropdown\nassert.match(global, /\\.scroll-progress-bar \\{[^}]*z-index: 140;/, 'white bar z-index is 140');\nconst baseCss = read(new URL('../../../packages/ui/src/styles/base.css', import.meta.url));\nassert.match(baseCss, /\\.dropdown-menu \\{[^}]*z-index: 150;/, 'dropdown menu z-index is 150');"
);

fs.writeFileSync(p, c);
