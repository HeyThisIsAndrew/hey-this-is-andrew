import fs from 'fs';
let p = 'sites/hey-this-is-andrew/src/layouts/BaseLayout.astro';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  "const siteTitle = Astro.props.title || 'HEY_THISISANDREW';\nconst siteDesc = Astro.props.description || 'Hey This Is Andrew: creative entrepreneurship, photography, and building brands in public.';\nconst siteUrl = 'https://heythisisandrew.github.io/hey-this-is-andrew';",
  "import siteData from '../data/site.json';\n\nconst siteTitle = Astro.props.title || siteData.title;\nconst siteDesc = Astro.props.description || siteData.description;\nconst siteUrl = siteData.url;"
);

c = c.replace(
  "const canonical = new URL(Astro.url.pathname, 'https://heythisisandrew.github.io').href;",
  "const canonical = new URL(Astro.url.pathname, new URL(siteData.url).origin).href;"
);

fs.writeFileSync(p, c);
