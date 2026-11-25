export type PageSection = { id: string; label: string; kicker?: string };

export const HOME_SECTIONS: PageSection[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'directory', label: 'Brands' },
  { id: 'gear', label: 'Gear' },
  { id: 'services', label: 'What I do' },
  { id: 'newsletter', label: 'Newsletter' }
];

export const BUILD_SECTIONS: PageSection[] = [
  { id: 'writing', label: 'Writing' },
  { id: 'goals', label: 'Goals' },
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
