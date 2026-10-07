import fs from 'fs';
let p = 'sites/hey-this-is-andrew/src/pages/press.astro';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  "const CONTACT_EMAIL = 'heythisisandrewb@gmail.com';",
  "import pressData from '../data/press.json';\n\nconst CONTACT_EMAIL = pressData.email;"
);

c = c.replace(
  "// TODO (Andrew): fill in each confirmed number as a string, e.g. '1,240'.\nconst STATS: { label: string; value: string | null; note: string }[] = [\n  { label: 'YouTube subscribers', value: null, note: 'Hey This Is Andrew' },\n  { label: 'Instagram followers', value: null, note: '@hey_thisisandrew' },\n  { label: 'TikTok followers', value: null, note: '@hey_thisisandrew' },\n];",
  "const STATS = pressData.stats;"
);

fs.writeFileSync(p, c);
