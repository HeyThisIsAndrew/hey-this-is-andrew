// The accordion's panels. Add, remove or reorder freely; panel 0 opens first.
import type { AccordionPanel } from '@andrew/ui/types';
import art from '../assets/panel-art.jpg';

export const PANELS: AccordionPanel[] = [
  {
    id: 'first',
    name: 'First Brand',
    kicker: 'Example',
    headline: 'A HEADLINE FOR THE FIRST BRAND.',
    deck: 'One line about what this brand does.',
    cta: 'Visit the first brand',
    url: 'https://example.com/',
    wordmark: 'ONE',
    mediaSrc: art,
    accent: 'brand',
  },
  {
    id: 'second',
    name: 'Second Brand',
    kicker: 'Example',
    headline: 'A HEADLINE FOR THE SECOND BRAND.',
    deck: 'Panels without art render a monochrome teaser card.',
    cta: 'Visit the second brand',
    url: 'https://example.com/',
    wordmark: 'TWO',
  },
  {
    id: 'coming-soon',
    name: 'Coming Soon',
    kicker: 'In the works',
    headline: 'SOMETHING NEW.',
    deck: 'A coming-soon panel: no link, a teaser tag instead.',
    wordmark: 'NEW',
    comingSoon: true,
    teaserTag: 'In the works',
  },
];
