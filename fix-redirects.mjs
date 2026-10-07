import fs from 'fs';
let p = 'sites/hey-this-is-andrew/astro.config.mjs';
let c = fs.readFileSync(p, 'utf8');
c = c.replace("'/work/': withBase('/#work'),", "");
fs.writeFileSync(p, c);
