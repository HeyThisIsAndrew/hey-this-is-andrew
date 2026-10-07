import fs from 'fs';
let p = 'sites/hey-this-is-andrew/src/pages/sitemap.astro';
let c = fs.readFileSync(p, 'utf8');
c = c.replace("{ path: '/gear/', title: 'Gear', desc: 'Complete inventory of camera bodies, lenses, lighting, and audio equipment.' },", "");
fs.writeFileSync(p, c);

p = 'sites/hey-this-is-andrew/src/components/SiteSearch.astro';
c = fs.readFileSync(p, 'utf8');
c = c.replace("const gearUrl = base ? `${base}/gear/` : '/gear/';", "const gearUrl = base ? `${base}/#gear` : '/#gear';");
fs.writeFileSync(p, c);
