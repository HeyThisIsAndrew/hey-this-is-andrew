import fs from 'fs';
let p = 'sites/hey-this-is-andrew/src/pages/kit.astro';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  'title="UI Kit"',
  'title="UI Kit · HEY_THISISANDREW"'
);

c = c.replace(
  '<div class="container kit-page">',
  '<h1 class="vh">UI Kit</h1>\n  <div class="container kit-page">'
);

c = c.replace(
  'href="/#test"',
  'href="/#top"'
);

fs.writeFileSync(p, c);
