import fs from 'fs';
let p = 'sites/hey-this-is-andrew/astro.config.mjs';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  "'/latest': withBase('/#latest'),",
  "'/latest': withBase('/#latest'),\n    '/goals': withBase('/build/#goals'),\n    '/goals/': withBase('/build/#goals'),"
);
c = c.replace(
  "&& !page.includes('/latest/'),",
  "&& !page.includes('/latest/') && !page.includes('/goals/'),"
);

fs.writeFileSync(p, c);

p = 'sites/hey-this-is-andrew/src/pages/sitemap.astro';
c = fs.readFileSync(p, 'utf8');
c = c.replace("{ path: '/goals/', title: 'Goals', desc: 'The Big Goals and every public milestone checklist.' },", "");
fs.writeFileSync(p, c);
