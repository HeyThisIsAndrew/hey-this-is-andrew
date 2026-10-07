import fs from 'fs';
let p = 'sites/hey-this-is-andrew/src/data/brands.json';
let data = JSON.parse(fs.readFileSync(p, 'utf8'));

// BE Unconventional
data[0].stats = [
  { value: 'Film', label: 'Reviews and breakdowns' },
  { value: 'TV', label: 'Episode coverage' },
  { value: 'Games', label: 'Design and story analysis' },
  { value: 'Events', label: 'Premieres and conventions' }
];
data[0].copy = [
  "BE Unconventional HQ is an editorial publication for film, television, gaming, and live events. No clickbait, no artificial outrage, just unfiltered honesty and expertise-driven analysis.",
  "Screeners, review copies, event credentials, and partnership requests all start in one place. The brand is built for studios and publishers who want coverage that treats their work with the seriousness it deserves."
];

// CCC
data[1].offers = [
  {
    title: 'Photography',
    desc: 'Menus, drinks, interiors, and process. Shot for the way people actually scroll.',
  },
  {
    title: 'Short-form video',
    desc: 'Pours, plating, and atmosphere cut for Reels, TikTok, and Shorts.',
  },
  {
    title: 'Four-hour shoots',
    desc: 'One session, a full library. No disruption to service, no multi-day production.',
  }
];
data[1].copy = [
  "Capture Create Caffeinate is a hospitality content brand for bars, restaurants, and events. The work is photography and short-form video that makes a room look like the best version of itself, delivered fast enough to post the same week.",
  "Every shoot is built around one idea: your food and drinks are the marketing. Great photos are presented as the photographer's work, never as the kitchen's claim."
];

// HTIA (from hey-this-is-andrew.astro)
data.push({
  id: "htia",
  name: "Hey This Is Andrew",
  kicker: "Studio Brand",
  headline: "THE WORK BEHIND THE WORK.",
  deck: "Documenting the creative process.",
  cta: "Watch the build",
  url: "https://www.youtube.com/@HeyThisIsAndrew",
  logo: "src/assets/brand-logos/hey-thisisandrew.png",
  wordmark: "HTIA",
  media: "src/assets/hero-media/hey-thisisandrew.jpg",
  copy: [
    "This is the parent studio brand. It documents creative entrepreneurship, photography, and building out the other lanes. Everything learned on client shoots and studio setups is shared here."
  ]
});

fs.writeFileSync(p, JSON.stringify(data, null, 2));
