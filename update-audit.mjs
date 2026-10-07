import fs from 'fs';
let p = 'sites/hey-this-is-andrew/scripts/audit-dist.mjs';
let c = fs.readFileSync(p, 'utf8');

const imageAltCheck = `
  for (const m of html.matchAll(/<img\\b[^>]*>/g)) {
    const img = m[0];
    const altMatch = img.match(/\\balt="([^"]*)"/);
    if (!altMatch) {
      fail(page, 'img missing alt attribute');
    } else {
      const alt = altMatch[1];
      if (alt !== "" && alt !== "HEY_THISISANDREW") {
        fail(page, \`img alt must be empty or HEY_THISISANDREW, got: "\${alt}"\`);
      }
    }
  }
`;

c = c.replace(
  "  for (const m of html.matchAll(/\\ssrcset=\"([^\"]+)\"/g)) {",
  imageAltCheck + "\n  for (const m of html.matchAll(/\\ssrcset=\"([^\"]+)\"/g)) {"
);

fs.writeFileSync(p, c);
