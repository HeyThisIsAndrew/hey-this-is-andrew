import { getCollection } from 'astro:content';
import { REFERRALS } from '../../data/storefront';

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
    // Core Brand Pages
    {
      id: 'brand-be-unconventional-hq',
      title: 'BE Unconventional HQ',
      kicker: 'The flagship publication',
      url: `${base}/brands/be-unconventional-hq/`,
      type: 'brand',
      image: `${base}/brands/be-logo.png`,
      tags: ['be unconventional hq', 'hq', 'flagship', 'pop culture', 'entertainment', 'brand', 'movies', 'tv', 'gaming'],
      excludeFromDefault: false,
    },
    {
      id: 'brand-capture-create-caffeinate',
      title: 'Capture Create Caffeinate',
      kicker: 'Beverage & coffee production',
      url: `${base}/ccc/`,
      type: 'brand',
      image: `${base}/brands/ccc-logo.png`,
      tags: ['capture create caffeinate', 'ccc', 'coffee', 'cafe', 'cocktail', 'beverage', 'production', 'commercial', 'brand'],
      excludeFromDefault: false,
    },
    {
      id: 'brand-hey-thisisandrew',
      title: 'HEY_THISISANDREW',
      kicker: 'Personal brand',
      url: `${base}/`,
      type: 'brand',
      image: `${base}/brands/hey-thisisandrew.png`,
      tags: ['hey thisisandrew', 'andrew baxter', 'personal', 'creator', 'cinematographer', 'editor'],
      excludeFromDefault: false,
    },
    {
      id: 'brands-overview',
      title: 'Brands',
      kicker: 'The lanes',
      url: `${base}/brands/`,
      type: 'page',
      image: `${base}/brands/hey-thisisandrew.png`,
      tags: ['brands', 'portfolio', 'lanes', 'projects', 'overview'],
      excludeFromDefault: false,
    },
    {
      id: 'page-about',
      title: 'About Andrew',
      kicker: 'Profile & story',
      url: `${base}/about/`,
      type: 'page',
      image: `${base}/brands/hey-thisisandrew.png`,
      tags: ['about', 'bio', 'story', 'creator', 'partnerships', 'referrals'],
      excludeFromDefault: false,
    },
    {
      id: 'page-gear',
      title: 'Gear & Studio Kit',
      kicker: 'Cameras, lenses & audio',
      url: `${base}/gear/`,
      type: 'page',
      image: `${base}/gear/sony-a7iv.jpg`,
      tags: ['gear', 'kit', 'cameras', 'lenses', 'audio', 'lighting', 'studio', 'production'],
      excludeFromDefault: false,
    },
    {
      id: 'page-events',
      title: 'Events',
      kicker: 'Conventions & appearances',
      url: `${base}/events/`,
      type: 'page',
      tags: ['events', 'conventions', 'appearances', 'twitchcon'],
      excludeFromDefault: false,
    },
    {
      id: 'page-contact',
      title: 'Contact',
      kicker: 'Get in touch',
      url: `${base}/contact/`,
      type: 'page',
      tags: ['contact', 'email', 'inquiries', 'work', 'hire', 'get in touch'],
      excludeFromDefault: false,
    },

    // Referrals & Partnerships
    ...REFERRALS.map((r) => {
      const isMint = r.title.toLowerCase().includes('mint');
      return {
        id: `referral-${r.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        title: r.title,
        kicker: 'Referral',
        url: `${base}/about/#referrals`,
        type: 'referral',
        image: isMint ? `${base}/referrals/mint-mobile.png` : undefined,
        tags: [
          r.title.toLowerCase(),
          'referral',
          'partner',
          ...(isMint ? ['mint', 'mint mobile', 'wireless', 'phone', 'carrier', 'plan'] : []),
        ],
        excludeFromDefault: false,
      };
    }),

    // Projects: Selected Work
    ...projects.map((p) => ({
      id: p.id,
      title: p.data.title,
      kicker: p.data.role || 'Project',
      url: p.data.link || `${base}/#work`,
      type: 'project',
      excludeFromDefault: false,
    })),

    // Goals: /build
    ...goals.map((g) => ({
      id: `goal-${g.id}`,
      title: g.data.title,
      kicker: 'Goal',
      url: `${base}/build/#${g.id}`,
      type: 'goal',
      excludeFromDefault: false,
    })),

    // Gear Items with product images
    ...gear.flatMap((category) =>
      category.data.items
        .filter((item) => item.stores && item.stores.length > 0)
        .map((item, i) => ({
          id: `gear-${category.id}-${i}`,
          title: item.name,
          kicker: item.brand || category.data.category,
          url: `${base}/gear/`,
          type: 'gear',
          image: item.image ? `${base}${item.image}` : undefined,
          tags: [item.name, item.brand, category.data.category, item.tag].filter(Boolean),
          excludeFromDefault: true,
        })),
    ),
  ];

  return new Response(JSON.stringify(searchData), {
    headers: { 'Content-Type': 'application/json' },
  });
}
