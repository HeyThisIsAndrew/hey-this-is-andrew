import fs from 'fs';
let p = 'sites/hey-this-is-andrew/src/pages/press.astro';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  "const CONTACT_EMAIL = 'heythisisandrew@gmail.com';",
  "import pressData from '../data/press.json';\n\nconst CONTACT_EMAIL = pressData.email;"
);

c = c.replace(/const STATS = \[\s*\{[\s\S]*?\],\s*\}\s*,?\s*\];/, "const STATS = pressData.stats;");
c = c.replace(/const ASSETS = \[\s*\{[\s\S]*?\},\s*\];/, "const ASSETS = pressData.assets.map(a => ({...a, href: `${base}${a.href}`}));");

c = c.replace(
  /<p>\s*HEY_THISISANDREW is the work of[\s\S]*?<\/p>\s*<\/div>/,
  `{pressData.bio.map(pText => (
            <p set:html={pText.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')} />
          ))}
        </div>`
);

fs.writeFileSync(p, c);
