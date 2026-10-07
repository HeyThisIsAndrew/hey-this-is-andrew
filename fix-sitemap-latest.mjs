import fs from 'fs';
let p = 'sites/hey-this-is-andrew/src/pages/sitemap.astro';
let c = fs.readFileSync(p, 'utf8');
c = c.replace("{ path: '/latest/', title: 'Latest', desc: 'Every recent video, article, and dispatch across the brands, with filters.' },", "");
fs.writeFileSync(p, c);
