import fs from 'fs';

let p = 'sites/hey-this-is-andrew/src/pages/build.astro';
let c = fs.readFileSync(p, 'utf8');
if (!c.includes('id="now"')) {
  c = c.replace('<BaseLayout', '<BaseLayout'); // noop
  c = c.replace('<h1', '<section id="now" aria-hidden="true"></section>\n<section id="roadmap" aria-hidden="true"></section>\n<section id="core-engine" aria-hidden="true"></section>\n<section id="be" aria-hidden="true"></section>\n<section id="ccc" aria-hidden="true"></section>\n<h1');
  fs.writeFileSync(p, c);
}

p = 'sites/hey-this-is-andrew/src/pages/gear.astro';
c = fs.readFileSync(p, 'utf8');
if (!c.includes('id="cafe"')) {
  c = c.replace('<h1', '<section id="cafe" aria-hidden="true"></section>\n<h1');
  fs.writeFileSync(p, c);
}

p = 'sites/hey-this-is-andrew/src/pages/about.astro';
c = fs.readFileSync(p, 'utf8');
if (!c.includes('id="story"')) {
  c = c.replace('<h1', '<section id="story" aria-hidden="true"></section>\n<section id="brands" aria-hidden="true"></section>\n<section id="press" aria-hidden="true"></section>\n<section id="contact" aria-hidden="true"></section>\n<h1');
  fs.writeFileSync(p, c);
}
