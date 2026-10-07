import fs from 'fs';
const p = 'sites/hey-this-is-andrew/src/lib/spatial.ts';
let c = fs.readFileSync(p, 'utf8');
c = c.replace(/return Promise\.race\(\[[\s\S]*?\]\)[^;]*;/m, 'const p1 = anim.finished.catch(() => {});\n  const p2 = new Promise<void>((resolve) => window.setTimeout(resolve, duration + 200));\n  return Promise.race([p1, p2]).then(() => {});');
fs.writeFileSync(p, c);
