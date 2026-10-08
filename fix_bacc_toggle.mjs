import fs from 'fs';
const p = 'packages/ui/src/BrandAccordion.astro';
let src = fs.readFileSync(p, 'utf8');

src = src.replace('.bacc-toggle:hover {', '.bacc-toggle:hover,\n  .bacc-toggle:focus-visible {');
src = src.replace('.bacc-toggle:hover,', '.bacc-toggle:focus-visible {\n    outline: 2px solid var(--focus-ring);\n    outline-offset: 2px;\n  }\n  .bacc-toggle:hover,');

fs.writeFileSync(p, src);
