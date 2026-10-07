import fs from 'fs';
let p = 'sites/hey-this-is-andrew/astro.config.mjs';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(/\n\s*['"]\/goals\/['"]:.*?,/g, '');
c = c.replace(/\n\s*['"]\/services\/['"]:.*?,/g, '');

fs.writeFileSync(p, c);
