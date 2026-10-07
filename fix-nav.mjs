import fs from 'fs';
let p = 'sites/hey-this-is-andrew/src/data/nav.ts';
let c = fs.readFileSync(p, 'utf8');

const gearNav = `  {
    label: 'Build in Public',
    href: page('build'),
    section: 'build',
    subsections: toSubsections(BUILD_SECTIONS, page('build')),
  },
  {
    label: 'Gear',
    href: homeUrl + '#gear',
    section: 'gear',
    spy: ['gear'],
    subsections: [],
  },`;

c = c.replace(/\{\s*label: 'Build in Public',[\s\S]*?\},[\s\S]*?\{\s*label: 'Gear',[\s\S]*?\},/, gearNav);

fs.writeFileSync(p, c);
