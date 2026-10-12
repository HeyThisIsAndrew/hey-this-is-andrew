import { getCollection } from 'astro:content';

// The search palette's index (@andrew/ui CommandPalette). Every URL carries
// the site's base: on GitHub Pages the site lives under /hey-this-is-andrew/,
// and root-relative links from here landed on the domain root.
const rawBase = import.meta.env.BASE_URL;
const base = rawBase === '/' ? '' : rawBase.replace(/\/$/, '');

export async function GET() {
  const projects = await getCollection('projects');
  const goals = await getCollection('goals');
  const gear = await getCollection('gear');

  const searchData = [
    // There is no page per project: a project is a row of Selected Work
    // (it opens in place), or its own external link.
    ...projects.map((p) => ({
      id: p.id,
      title: p.data.title,
      kicker: p.data.role || 'Project',
      url: p.data.link || `${base}/#work`,
      type: 'project',
      excludeFromDefault: false,
    })),
    // Each goal group is a row of the /build accordion, under its own id.
    ...goals.map((g) => ({
      id: `goal-${g.id}`,
      title: g.data.title,
      kicker: 'Goal',
      url: `${base}/build/#${g.id}`,
      type: 'goal',
      excludeFromDefault: false,
    })),
    // The full kit is its own page.
    ...gear.flatMap((category) =>
      category.data.items.map((item, i) => ({
        id: `gear-${category.id}-${i}`,
        title: item.name,
        kicker: item.brand || category.data.category,
        url: `${base}/gear/`,
        type: 'gear',
        excludeFromDefault: true,
      })),
    ),
  ];

  return new Response(JSON.stringify(searchData), {
    headers: { 'Content-Type': 'application/json' },
  });
}
