import fs from 'fs';
const p = 'sites/hey-this-is-andrew/src/components/GoalsChecklist.astro';
let src = fs.readFileSync(p, 'utf8');

src = src.replace('border-radius: 0;', 'border-radius: 4px;');
src = src.replace('border: 1.5px solid var(--muted);', 'border: 1px solid rgba(255,255,255,0.2);\n    background: rgba(255,255,255,0.03);\n    box-shadow: inset 0 2px 4px rgba(0,0,0,0.4);');
src = src.replace('border-radius: 0;', 'border-radius: 2px;');

fs.writeFileSync(p, src);
