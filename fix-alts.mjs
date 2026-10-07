import fs from 'fs';

let p = 'sites/hey-this-is-andrew/src/components/AboutSection.astro';
let c = fs.readFileSync(p, 'utf8');
c = c.replace('alt="Andrew Baxter"', 'alt=""');
fs.writeFileSync(p, c);

// Photo elevator (the Instagram photos missing alts?)
// Wait, the error is 'img missing alt attribute' on index.html
// Let's see PhotoElevator.astro.
