import fs from 'fs';
let p = 'sites/hey-this-is-andrew/scripts/controls.test.mjs';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  "const elevator = read(new URL('../src/components/PhotographyPortfolio.astro', import.meta.url));",
  "const elevator = read(new URL('../../../packages/ui/src/PhotoElevator.astro', import.meta.url));"
);

fs.writeFileSync(p, c);
