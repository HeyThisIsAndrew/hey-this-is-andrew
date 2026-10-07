import fs from 'fs';
let p = 'sites/hey-this-is-andrew/scripts/audit-dist.mjs';
let c = fs.readFileSync(p, 'utf8');

const replacement = `
  for (const m of html.matchAll(/<img\\b[^>]*>/g)) {
    const img = m[0];
    if (!/\\balt\\b/.test(img)) {
      fail(page, 'img missing alt attribute');
    } else {
      const altMatch = img.match(/\\balt="([^"]*)"/);
      if (altMatch) {
        const alt = altMatch[1];
        if (alt !== "" && alt !== "HEY_THISISANDREW") {
          fail(page, \`img alt must be empty or HEY_THISISANDREW, got: "\${alt}"\`);
        }
      } else {
        // boolean alt attribute without equals, perfectly fine and means empty string
      }
    }
  }
`;

// wait I need to replace the old block
// I'll just use a regex to replace it
c = c.replace(/for \(const m of html\.matchAll\(\/<img\\b\[\^>\]\*>\/g\)\) \{[\s\S]*?\}\s*\}\s*\}/, replacement.trim());
fs.writeFileSync(p, c);
