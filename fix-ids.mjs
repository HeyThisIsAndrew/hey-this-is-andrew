import fs from 'fs';

let p = 'sites/hey-this-is-andrew/src/components/PhotographyPortfolio.astro';
let c = fs.readFileSync(p, 'utf8');
c = c.replace('id="photography"', 'id="photos"');
fs.writeFileSync(p, c);

p = 'sites/hey-this-is-andrew/src/components/SelectedWork.astro';
c = fs.readFileSync(p, 'utf8');
c = c.replace('id="projects"', 'id="work"');
fs.writeFileSync(p, c);

p = 'sites/hey-this-is-andrew/src/components/WorkWithAndrew.astro';
c = fs.readFileSync(p, 'utf8');
c = c.replace('id={home ? \'work\' : \'services\'}', 'id="services"');
fs.writeFileSync(p, c);
