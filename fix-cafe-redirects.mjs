import fs from 'fs';
let p = 'sites/hey-this-is-andrew/astro.config.mjs';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  "'/now/': withBase('/#about'),",
  "'/now/': withBase('/#about'),\n    '/cafe': withBase('/#brew'),\n    '/cafe/': withBase('/#brew'),"
);

fs.writeFileSync(p, c);

p = 'sites/hey-this-is-andrew/src/pages/sitemap.astro';
c = fs.readFileSync(p, 'utf8');
c = c.replace("{ path: '/cafe/', title: 'Coffee Bar', desc: 'The exact espresso and pour over bar behind the studio.' },", "");
fs.writeFileSync(p, c);
