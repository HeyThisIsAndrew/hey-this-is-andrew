import fs from 'fs';
let p = 'packages/ui/package.json';
let c = JSON.parse(fs.readFileSync(p, 'utf8'));
c.exports['./ExpandSection.astro'] = './src/ExpandSection.astro';
fs.writeFileSync(p, JSON.stringify(c, null, 2) + '\n');
