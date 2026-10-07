import fs from 'fs';
let p = 'sites/hey-this-is-andrew/src/pages/kit.astro';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  '<FilterTabs targetId="filter-target" />',
  "<FilterTabs target=\"filter-target\" label=\"Filter items\" tabs={[{key: 'all', label: 'All'}, {key: 'film', label: 'Film'}, {key: 'photo', label: 'Photo'}]} />"
);

c = c.replace(
  "<QuoteBand />",
  "<QuoteBand eyebrow=\"Testimonial\" quote=\"This is a very good quote.\" attribution=\"- Test User\" />"
);

c = c.replace(
  "<NewTag />",
  "<NewTag tag=\"NEW\" />"
);

c = c.replace(
  "<NewTag />",
  "<NewTag tag=\"UPDATED\" />"
);

fs.writeFileSync(p, c);
