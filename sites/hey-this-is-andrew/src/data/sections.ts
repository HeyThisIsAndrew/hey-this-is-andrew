import goals from './goals.json';

export type PageSection = { id: string; label: string; kicker?: string };

export const HOME_SECTIONS: PageSection[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'directory', label: 'Brands' },
  { id: 'about', label: 'Meet The Creator' },
  { id: 'photos', label: 'Shot on the job.' },
  { id: 'work', label: 'Work' },
  { id: 'latest', label: 'Latest' },
  { id: 'services', label: 'What I do' },
  { id: 'goals', label: 'Goals' },
  { id: 'gear', label: 'Gear' },
  { id: 'newsletter', label: 'Newsletter' }
];

/* /build is one accordion: a row per goal group (goals.json, in its own
   order), then the Core Engine and the two sub-brand roadmaps. Each id is
   its row's heading, so the nav dropdown and the page cannot disagree. */
const GOAL_ROWS: PageSection[] = [...goals]
  .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
  .map((g) => ({ id: g.id, label: g.title }));

export const BUILD_SECTIONS: PageSection[] = [
  ...GOAL_ROWS,
  { id: 'core-engine', label: 'Core engine' },
  { id: 'be', label: 'BE Unconventional HQ', kicker: 'BE' },
  { id: 'ccc', label: 'Capture Create Caffeinate', kicker: 'CCC' },
];

export const ABOUT_SECTIONS: PageSection[] = [
  { id: 'story', label: 'Story' },
  { id: 'writing', label: 'Writing' },
  { id: 'press', label: 'Press kit' },
  { id: 'contact', label: 'Contact' }
];

export const GEAR_SECTIONS: PageSection[] = [
  { id: 'gear-bodies', label: 'Cameras', kicker: 'Bodies' },
  { id: 'gear-lenses', label: 'Lenses', kicker: 'Glass' },
  { id: 'gear-lighting', label: 'Lighting', kicker: 'Lights' },
  { id: 'gear-tools', label: 'Support & Power', kicker: 'Tools' },
  { id: 'gear-audio', label: 'Audio', kicker: 'Sound' },
  { id: 'brew', label: 'The Cafe', kicker: 'Coffee' },
  { id: 'gear-gaming', label: 'Gaming', kicker: 'Desk' }
];
