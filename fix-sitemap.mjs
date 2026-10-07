import fs from 'fs';
let p = 'sites/hey-this-is-andrew/astro.config.mjs';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  "filter: (page) => !page.includes('/preview/') && !page.includes('/404')",
  "filter: (page) => !page.includes('/preview/') && !page.includes('/404') && !page.includes('/kit/')"
);

fs.writeFileSync(p, c);
