import fs from 'fs';
let p = 'sites/hey-this-is-andrew/astro.config.mjs';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  "'/gear': withBase('/#gear'),",
  "'/gear': withBase('/#gear'),\n    '/now': withBase('/#about'),\n    '/now/': withBase('/#about'),"
);

fs.writeFileSync(p, c);

p = 'sites/hey-this-is-andrew/src/pages/sitemap.astro';
c = fs.readFileSync(p, 'utf8');
c = c.replace("{ path: '/now/', title: 'Now', desc: 'What Andrew is working on right now.' },", "");
fs.writeFileSync(p, c);
