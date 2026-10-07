import fs from 'fs';
const p = 'sites/hey-this-is-andrew/astro.config.mjs';
let c = fs.readFileSync(p, 'utf8');

// Update redirects
c = c.replace(
  "'/feed': withBase('/latest/'),",
  "'/feed': withBase('/#latest'),\n    '/work': withBase('/#work'),\n    '/work/': withBase('/#work'),"
);

// Update sitemap filter
c = c.replace(
  "filter: (page) => !page.includes('/preview/') && !page.includes('/404') && !page.includes('/events/'),",
  "filter: (page) => !page.includes('/preview/') && !page.includes('/404') && !page.includes('/events/') && !page.includes('/work/'),"
);

fs.writeFileSync(p, c);
