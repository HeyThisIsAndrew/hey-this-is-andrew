import fs from 'fs';
let p = 'sites/hey-this-is-andrew/src/pages/kit.astro';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  "<BrandAccordion />",
  "<BrandAccordion panels={[{ id: 'demo1', name: 'Brand One', kicker: 'Kicker', headline: 'Brand One Headline', deck: 'Deck', wordmark: 'BRAND 1', comingSoon: false }]} />"
);

fs.writeFileSync(p, c);
