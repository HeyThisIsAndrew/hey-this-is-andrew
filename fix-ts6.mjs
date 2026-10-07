import fs from 'fs';
const p = 'sites/hey-this-is-andrew/src/lib/spatial.ts';
let c = fs.readFileSync(p, 'utf8');
c = c.replace('return Promise.race([\n      animation.finished,\n      new Promise((resolve) => setTimeout(resolve, timeoutMs))\n    ]);', 'return Promise.race([\n      animation.finished,\n      new Promise((resolve) => setTimeout(resolve, timeoutMs))\n    ]).then(() => {}) as unknown as Promise<void>;');
c = c.replace('return Promise.race([\n      animation.finished,\n      new Promise((resolve) => setTimeout(resolve, timeoutMs))\n    ])', 'return Promise.race([\n      animation.finished,\n      new Promise((resolve) => setTimeout(resolve, timeoutMs))\n    ]).then(() => {}) as unknown as Promise<void>;');
fs.writeFileSync(p, c);
