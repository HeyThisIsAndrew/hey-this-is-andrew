import fs from 'fs';
const p = 'packages/ui/package.json';
const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));

pkg.exports["./Accordion.astro"] = "./src/Accordion.astro";
pkg.exports["./AccordionRow.astro"] = "./src/AccordionRow.astro";
pkg.exports["./CommandPalette.astro"] = "./src/CommandPalette.astro";

fs.writeFileSync(p, JSON.stringify(pkg, null, 2));
