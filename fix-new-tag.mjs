import fs from 'fs';
let p = 'sites/hey-this-is-andrew/src/pages/kit.astro';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  '<NewTag tag="NEW" />',
  '<NewTag published={new Date().toISOString()} label="NEW" />'
);
c = c.replace(
  '<NewTag tag="UPDATED" />',
  '<NewTag published={new Date().toISOString()} label="UPDATED" />'
);

fs.writeFileSync(p, c);
