import fs from 'fs';
let p = 'sites/hey-this-is-andrew/src/pages/events.astro';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  "import SectionHeader from '@andrew/ui/SectionHeader.astro';",
  "import SectionHeader from '@andrew/ui/SectionHeader.astro';\nimport eventsData from '../data/events.json';"
);

c = c.replace(
  "const UPCOMING: EventItem[] = [];\n\n// Past coverage: add entries with a url to the full breakdown.\nconst PAST: EventItem[] = [];",
  "const UPCOMING: EventItem[] = eventsData.upcoming;\nconst PAST: EventItem[] = eventsData.past;"
);

fs.writeFileSync(p, c);
