import fs from 'fs';
let p = 'sites/hey-this-is-andrew/src/data/brands.json';
let c = fs.readFileSync(p, 'utf8');
c = c.replace('"media": "src/assets/hero-media/hey-thisisandrew.jpg"', '"media": "src/assets/hero-media/portrait.jpg"');
fs.writeFileSync(p, c);
