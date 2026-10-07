import fs from 'fs';

let p = 'sites/hey-this-is-andrew/astro.config.mjs';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  "'/cafe/': withBase('/#brew'),",
  "'/cafe/': withBase('/#brew'),\n    '/brands/hey-this-is-andrew': withBase('/#about'),\n    '/brands/hey-this-is-andrew/': withBase('/#about'),\n    '/brands/be-unconventional-hq': withBase('/#about'),\n    '/brands/be-unconventional-hq/': withBase('/#about'),\n    '/brands/capture-create-caffeinate': withBase('/#about'),\n    '/brands/capture-create-caffeinate/': withBase('/#about'),"
);

fs.writeFileSync(p, c);

p = 'sites/hey-this-is-andrew/src/pages/sitemap.astro';
c = fs.readFileSync(p, 'utf8');
c = c.replace(/\{\s*path: '\/brands\/hey-this-is-andrew\/',[\s\S]*?\},/g, "");
c = c.replace(/\{\s*path: '\/brands\/be-unconventional-hq\/',[\s\S]*?\},/g, "");
c = c.replace(/\{\s*path: '\/brands\/capture-create-caffeinate\/',[\s\S]*?\},/g, "");
fs.writeFileSync(p, c);

