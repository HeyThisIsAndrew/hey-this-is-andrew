import fs from 'fs';
let p = 'ARCHITECTURE.md';
let c = fs.readFileSync(p, 'utf8');

const newParagraph = `
The \`@andrew/ui\` package is the universal component system for all sites in this monorepo. It houses every reusable UI primitive—from the navigation shell and brand accordions down to the photo elevator and typography tags. Because it wraps its own styles, scripts, and tokens, it can be exported cleanly to future projects or client sites using the same Astro base, ensuring design consistency without duplicating code.
`;

c = c.replace(
  "### Packages",
  "### Packages\n" + newParagraph
);

fs.writeFileSync(p, c);
