import fs from 'fs';
let p = 'sites/hey-this-is-andrew/src/pages/kit.astro';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  'href="/#top"',
  'href="/"'
);

fs.writeFileSync(p, c);
