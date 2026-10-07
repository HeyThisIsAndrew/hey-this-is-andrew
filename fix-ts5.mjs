import fs from 'fs';
const p = 'sites/hey-this-is-andrew/src/lib/spatial.ts';
let c = fs.readFileSync(p, 'utf8');
c = c.replace(/return Promise\.race\(\[\s*animation\.finished,\s*new Promise\(\(resolve\) => setTimeout\(resolve, timeoutMs\)\)\s*\]\);/g, 'return Promise.race([animation.finished, new Promise((resolve) => setTimeout(resolve, timeoutMs))]).then(() => {});');
c = c.replace(/return Promise\.race\(\[\n\s*animation\.finished,\n\s*new Promise\(\(resolve\) => setTimeout\(resolve, timeoutMs\)\)\n\s*\]\);/g, 'return Promise.race([animation.finished, new Promise((resolve) => setTimeout(resolve, timeoutMs))]).then(() => {});');
// if it has cast
c = c.replace(/return Promise\.race\(\[\s*animation\.finished,\s*new Promise\(\(resolve\) => setTimeout\(resolve, timeoutMs\)\)\s*\]\) as any;/g, 'return Promise.race([animation.finished, new Promise((resolve) => setTimeout(resolve, timeoutMs))]).then(() => {});');
fs.writeFileSync(p, c);
