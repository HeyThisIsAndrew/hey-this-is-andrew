import { getCollection } from 'astro:content';

export async function GET() {
  const projects = await getCollection('projects');
  const goals = await getCollection('goals');
  const gear = await getCollection('gear');

  const searchData = [
    ...projects.map(p => ({
      id: p.id,
      title: p.data.title,
      kicker: p.data.role || 'Project',
      url: `/projects/${p.id}/`,
      type: 'project',
      excludeFromDefault: false
    })),
    ...goals.map(g => ({
      id: `goal-${g.id}`,
      title: g.data.title,
      kicker: 'Goal',
      url: `/build/#goal-${g.id}`,
      type: 'goal',
      excludeFromDefault: false
    })),
    ...gear.flatMap(category => category.data.items.map((item, i) => ({
      id: `gear-${category.id}-${i}`,
      title: item.name,
      kicker: item.brand || category.data.category,
      url: `/#gear`,
      type: 'gear',
      excludeFromDefault: true
    })))
  ];

  return new Response(JSON.stringify(searchData), {
    headers: { 'Content-Type': 'application/json' }
  });
}
