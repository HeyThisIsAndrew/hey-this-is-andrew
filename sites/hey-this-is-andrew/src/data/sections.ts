export type PageSection = { id: string; label: string; kicker?: string };

export const HOME_SECTIONS: PageSection[] = [
  { id: 'overview', label: 'Overview', kicker: '01' },
  { id: 'directory', label: 'Brands', kicker: '02' },
  { id: 'about', label: 'Meet The Creator', kicker: '03' },
  { id: 'photos', label: 'Shot on the job.', kicker: '04' },
  { id: 'work', label: 'Work', kicker: '05' },
  { id: 'latest', label: 'Latest', kicker: '06' },
  { id: 'goals', label: 'Goals', kicker: '07' },
  { id: 'services', label: 'What I do', kicker: '08' },
  { id: 'gear', label: 'Gear', kicker: '09' },
  { id: 'newsletter', label: 'Newsletter', kicker: '10' }
];

export const BUILD_SECTIONS: PageSection[] = [
  { id: 'now', label: 'Now', kicker: '01' },
  { id: 'roadmap', label: 'Milestone roadmap', kicker: '02' },
  { id: 'core-engine', label: 'Core engine', kicker: '03' },
  { id: 'be', label: 'BE Unconventional HQ', kicker: 'BE' },
  { id: 'ccc', label: 'Capture Create Caffeinate', kicker: 'CCC' },
  { id: 'goals', label: 'Goals', kicker: '04' }
];

export const GEAR_SECTIONS: PageSection[] = [
  { id: 'gear-bodies', label: 'Camera bodies', kicker: '01' },
  { id: 'gear-zooms', label: 'Zoom lenses', kicker: '02' },
  { id: 'gear-primes', label: 'Prime lenses', kicker: '03' },
  { id: 'gear-lighting', label: 'Lighting and flash', kicker: '04' },
  { id: 'gear-audio', label: 'Audio', kicker: '05' },
  { id: 'gear-tools', label: 'Tools', kicker: '06' },
  { id: 'cafe', label: 'Coffee bar', kicker: '07' }
];

export const ABOUT_SECTIONS: PageSection[] = [
  { id: 'story', label: 'Story', kicker: '01' },
  { id: 'brands', label: 'Brands I run', kicker: '02' },
  { id: 'press', label: 'Press kit', kicker: '03' },
  { id: 'contact', label: 'Contact', kicker: '04' }
];
