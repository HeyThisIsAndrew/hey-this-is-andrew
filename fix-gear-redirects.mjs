import fs from 'fs';
let p = 'sites/hey-this-is-andrew/astro.config.mjs';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  "'/services': withBase('/#services'),",
  "'/services': withBase('/#services'),\n    '/gear': withBase('/#gear'),"
);
c = c.replace(
  "&& !page.includes('/services/'),",
  "&& !page.includes('/services/') && !page.includes('/gear/'),"
);

fs.writeFileSync(p, c);

p = 'sites/hey-this-is-andrew/src/pages/sitemap.astro';
c = fs.readFileSync(p, 'utf8');
c = c.replace("{ path: '/gear/', title: 'Gear', desc: 'The exact kit behind commercial shoots, beverage captures, and YouTube productions.' },", "");
fs.writeFileSync(p, c);

p = 'sites/hey-this-is-andrew/src/data/nav.ts';
c = fs.readFileSync(p, 'utf8');
c = c.replace(/\n\s*\{\n\s*label: 'Gear',\n\s*href: page\('gear'\),\n\s*section: 'gear',\n\s*spy: \['gear'\],\n\s*subsections: toSubsections\(GEAR_SECTIONS, page\('gear'\)\),\n\s*\},/g, "");
fs.writeFileSync(p, c);

