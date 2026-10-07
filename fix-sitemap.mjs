import fs from 'fs';
let p = 'sites/hey-this-is-andrew/src/pages/sitemap.astro';
let c = fs.readFileSync(p, 'utf8');
c = c.replace("{ path: '/work/', title: 'Work', desc: 'Photography, videos, projects, and the production workflow.' },", "");
fs.writeFileSync(p, c);
