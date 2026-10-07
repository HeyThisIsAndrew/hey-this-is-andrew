import fs from 'fs';

let p = 'sites/hey-this-is-andrew/src/pages/build.astro';
let c = fs.readFileSync(p, 'utf8');
if (!c.includes('id="goals"')) {
  c = c.replace('<h1', '<section id="goals" aria-hidden="true"></section>\n<h1');
  fs.writeFileSync(p, c);
}

p = 'sites/hey-this-is-andrew/src/pages/gear.astro';
c = fs.readFileSync(p, 'utf8');
if (!c.includes('id="cafe"')) {
  c = c.replace('<h1', '<section id="cafe" aria-hidden="true"></section>\n<h1');
  fs.writeFileSync(p, c);
}

