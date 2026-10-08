import movieImg from '../assets/categories/movies.png';
import tvImg from '../assets/categories/tv.png';
import gamingImg from '../assets/categories/gaming.png';
import eventsImg from '../assets/categories/events.png';

/**
 * Content pillars surfaced on the homepage. Each links to the Videos page
 * pre-filtered via a URL hash (e.g. /videos#games).
 */
export const categories = [
  {
    slug: 'film',
    label: 'Film',
    blurb: 'Reviews, reactions & deep dives',
    image: movieImg,
    action: 'Read Reviews',
  },
  {
    slug: 'tv',
    label: 'TV',
    blurb: 'Episode breakdowns & season verdicts',
    image: tvImg,
    action: 'Binge',
  },
  {
    slug: 'games',
    label: 'Games',
    blurb: 'Coverage, reviews & culture',
    image: gamingImg,
    action: 'Press Start',
  },
  {
    slug: 'events',
    label: 'Events',
    blurb: 'Premieres & live, on-location coverage',
    image: eventsImg,
    action: 'On Location',
  },
];
