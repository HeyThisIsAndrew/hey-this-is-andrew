import fs from 'fs';
const p = 'sites/hey-this-is-andrew/scripts/audit-dist.mjs';
let c = fs.readFileSync(p, 'utf8');

const regexSnippet = `
  for (const m of html.matchAll(/\\shref="([^"]*#[^"]+)"/g)) {
    const url = m[1];
    if (/^(https?:|mailto:|tel:)/.test(url)) continue;
    const frag = decodeURIComponent(url.split('#')[1]);
    if (!frag || frag === 'top') continue;
    const file = pageFile(url, page);
    if (!file) continue; // broken page links are reported above
    if (!idsOf(file).has(frag)) fail(page, \`dead anchor: \${url}\`);
  }

  // Check dropdowns DOM order vs page sections
  // Only the dropdown for the current page (e.g. Home dropdown on Home page).
  // To keep it simple: the dropdown lists anchors on its own page, in exact order.
  // Actually, let's just find the dropdown that corresponds to this page.
  // We can look for .nav-link with aria-current="page" and check its dropdown.
  const currentPageItemRegex = /<a[^>]*aria-current="page"[^>]*>([\\s\\S]*?)<\\/li>/g;
  const currentItemMatch = [...html.matchAll(currentPageItemRegex)][0];
  if (currentItemMatch) {
    const dropdownHtml = (currentItemMatch[1].match(/<ul class="dropdown-list">([\\s\\S]*?)<\\/ul>/) || [])[1];
    if (dropdownHtml) {
      const dropLinks = [...dropdownHtml.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
      const sectionIds = [...html.matchAll(/<section[^>]+id="([^"]+)"/g)].map(m => m[1]);
      let expectedIndex = 0;
      for (const link of dropLinks) {
        if (link.startsWith('http')) continue; // Skip external (like Amazon)
        const hash = link.split('#')[1];
        if (!hash) continue;
        const foundIndex = sectionIds.indexOf(hash);
        if (foundIndex === -1) {
          fail(page, \`dropdown link \${link} not found on page\`);
        } else if (foundIndex < expectedIndex) {
          fail(page, \`dropdown link \${link} is out of DOM order\`);
        } else {
          expectedIndex = foundIndex;
        }
      }
    }
  }
`;

c = c.replace(
  "  for (const m of html.matchAll(/\\shref=\"([^\"]*#[^\"]+)\"/g)) {\n    const url = m[1];\n    if (/^(https?:|mailto:|tel:)/.test(url)) continue;\n    const frag = decodeURIComponent(url.split('#')[1]);\n    if (!frag || frag === 'top') continue;\n    const file = pageFile(url, page);\n    if (!file) continue; // broken page links are reported above\n    if (!idsOf(file).has(frag)) fail(page, `dead anchor: ${url}`);\n  }",
  regexSnippet
);

fs.writeFileSync(p, c);
