import fs from 'fs';
let p = 'sites/hey-this-is-andrew/src/pages/kit.astro';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  "import PhotoElevator from '@andrew/ui/PhotoElevator.astro';",
  "import PhotoElevator from '@andrew/ui/PhotoElevator.astro';\nimport { homeUrl } from '../data/nav';"
);

c = c.replace(
  'href="/"',
  'href={homeUrl}'
);

fs.writeFileSync(p, c);
