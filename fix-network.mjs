import fs from 'fs';
let p = 'sites/hey-this-is-andrew/src/lib/network.ts';
let c = fs.readFileSync(p, 'utf8');
c = c.replace("work/#projects", "#work");
fs.writeFileSync(p, c);
