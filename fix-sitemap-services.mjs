import fs from 'fs';
let p = 'sites/hey-this-is-andrew/src/pages/sitemap.astro';
let c = fs.readFileSync(p, 'utf8');
c = c.replace("{ path: '/services/', title: 'Services', desc: 'What I do: photography, short-form video, UGC, editing, and event coverage.' },", "");
fs.writeFileSync(p, c);
