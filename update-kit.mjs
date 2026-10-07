import fs from 'fs';
let p = 'sites/hey-this-is-andrew/src/components/KitSection.astro';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  "import GearGrid from './GearGrid.astro';",
  "import GearGrid from './GearGrid.astro';\nimport CafeSection from './CafeSection.astro';"
);

c = c.replace(
  "<GearGrid categories={gear} />\n      </div>",
  "<GearGrid categories={gear} />\n        <CafeSection />\n      </div>"
);

fs.writeFileSync(p, c);
