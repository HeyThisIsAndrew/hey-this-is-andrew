import fs from 'fs';
let p = 'packages/ui/src/PhotoElevator.astro';
let c = fs.readFileSync(p, 'utf8');
c = c.replace('alt={p.caption}', 'alt=""');
fs.writeFileSync(p, c);
