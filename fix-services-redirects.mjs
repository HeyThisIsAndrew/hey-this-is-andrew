import fs from 'fs';
let p = 'sites/hey-this-is-andrew/astro.config.mjs';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  "'/goals': withBase('/build/#goals'),",
  "'/goals': withBase('/build/#goals'),\n    '/services': withBase('/#services'),\n    '/services/': withBase('/#services'),"
);
c = c.replace(
  "&& !page.includes('/goals/'),",
  "&& !page.includes('/goals/') && !page.includes('/services/'),"
);

fs.writeFileSync(p, c);

p = 'sites/hey-this-is-andrew/src/pages/sitemap.astro';
c = fs.readFileSync(p, 'utf8');
c = c.replace("{ path: '/services/', title: 'What I do', desc: 'Beverage and hospitality photography, short-form video, UGC, and event coverage.' },", "");
fs.writeFileSync(p, c);
