import fs from 'fs';
const p = 'sites/hey-this-is-andrew/src/layouts/BaseLayout.astro';
let src = fs.readFileSync(p, 'utf8');
const htmlEnd = src.indexOf('</html>') + '</html>'.length;
src = src.slice(0, htmlEnd);
fs.writeFileSync(p, src + '\n');
