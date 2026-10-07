import fs from 'fs';
let p = 'sites/hey-this-is-andrew/astro.config.mjs';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  "'/work': withBase('/#work'),",
  "'/work': withBase('/#work'),\n    '/latest': withBase('/#latest'),"
);

c = c.replace(
  "&& !page.includes('/work/'),",
  "&& !page.includes('/work/') && !page.includes('/latest/'),"
);

fs.writeFileSync(p, c);
