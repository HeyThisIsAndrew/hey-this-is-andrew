import fs from 'fs';
let p = 'sites/hey-this-is-andrew/src/pages/gear.astro';
let c = fs.readFileSync(p, 'utf8');
if (!c.includes('id="cafe"')) {
  c = c.replace('<section id="kit"', '<section id="cafe" aria-hidden="true"></section>\n  <section id="kit"');
  fs.writeFileSync(p, c);
}
p = 'sites/hey-this-is-andrew/src/pages/build.astro';
c = fs.readFileSync(p, 'utf8');
if (!c.includes('id="goals"')) {
  c = c.replace('<section id="brand-roadmap-dashboard"', '<section id="goals" aria-hidden="true"></section>\n    <section id="brand-roadmap-dashboard"');
  fs.writeFileSync(p, c);
}
