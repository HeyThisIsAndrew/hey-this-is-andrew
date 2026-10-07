import fs from 'fs';
const pkgPath = 'packages/ui/package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.exports = {
  "./types": "./src/types.ts",
  "./icons": "./src/icons.ts",
  "./BrandAccordion.astro": "./src/BrandAccordion.astro",
  "./ChromeMeta.astro": "./src/ChromeMeta.astro",
  "./FilterTabs.astro": "./src/FilterTabs.astro",
  "./Footer.astro": "./src/Footer.astro",
  "./Nav.astro": "./src/Nav.astro",
  "./NewTag.astro": "./src/NewTag.astro",
  "./PageNav.astro": "./src/PageNav.astro",
  "./QuoteBand.astro": "./src/QuoteBand.astro",
  "./SectionHeader.astro": "./src/SectionHeader.astro",
  "./ViewAllLink.astro": "./src/ViewAllLink.astro",
  "./styles/base.css": "./src/styles/base.css",
  "./styles/chips.css": "./src/styles/chips.css",
  "./styles/cta.css": "./src/styles/cta.css",
  "./scripts/section-anchors.ts": "./src/scripts/section-anchors.ts"
};
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
