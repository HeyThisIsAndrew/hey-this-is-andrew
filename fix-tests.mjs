import fs from 'fs';

let qa = fs.readFileSync('e2e/global-qa.spec.ts', 'utf8');

qa = qa.replace(
  "const pages = ['/', '/build/', '/about/'];",
  "const pages = ['.', './build/', './about/'];"
);

qa = qa.replace(/await page\.goto\('\/'\);/g, "await page.goto('.');");
qa = qa.replace(/await page\.goto\('press\/'\);/g, "await page.goto('./press/');");
qa = qa.replace(/await page\.goto\('work\/'\);/g, "await page.goto('./work/');");

fs.writeFileSync('e2e/global-qa.spec.ts', qa);

let press = fs.readFileSync('sites/hey-this-is-andrew/src/pages/press.astro', 'utf8');
press = press.replace(
  '<meta http-equiv="refresh" content={`0;url=${target}`} />',
  '<meta http-equiv="refresh" content={`0;url=${target}`} />\n  <script define:vars={{ target }}>window.location.replace(target);</script>'
);
fs.writeFileSync('sites/hey-this-is-andrew/src/pages/press.astro', press);

let gear = fs.readFileSync('sites/hey-this-is-andrew/src/pages/gear.astro', 'utf8');
gear = gear.replace(
  '<meta http-equiv="refresh" content={`0;url=${target}`} />',
  '<meta http-equiv="refresh" content={`0;url=${target}`} />\n  <script define:vars={{ target }}>window.location.replace(target);</script>'
);
fs.writeFileSync('sites/hey-this-is-andrew/src/pages/gear.astro', gear);

