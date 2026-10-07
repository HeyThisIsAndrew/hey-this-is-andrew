import fs from 'fs';
let p = 'sites/hey-this-is-andrew/src/layouts/BaseLayout.astro';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  "// Link preview image and canonical URLs: production GitHub Pages path\nconst siteUrl = 'https://heythisisandrew.github.io/hey-this-is-andrew';",
  "import siteData from '../data/site.json';\n\n// Link preview image and canonical URLs: production GitHub Pages path\nconst siteUrl = siteData.url;"
);

c = c.replace(
  "description = 'Andrew Baxter: creator, photographer, and coffee drinker building brands in public.',",
  "description = siteData.description,"
);

fs.writeFileSync(p, c);
