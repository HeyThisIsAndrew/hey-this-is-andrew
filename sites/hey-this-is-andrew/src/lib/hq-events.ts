import eventsSeed from '../data/events.json';

export const HQ_INDEX_URL = 'https://beunconventionalhq.com/api/search-index.json';
export const HQ_EVENTS_CUTOFF = '2026-11-09';

export interface EventItem {
  id: string;
  name: string;
  url: string;
  image: string;
  dates: string;
  location: string;
  blurb: string;
  source: string;
  rawDate: string;
}

export interface EventsData {
  upcoming: EventItem[];
  cccCoverage: EventItem[];
  past: EventItem[];
}

export interface RawHqSearchItem {
  id?: string;
  title?: string;
  type?: string;
  url?: string;
  image?: string;
  date?: string;
  endDate?: string;
  status?: string;
  tags?: string[];
}

export const EVENT_LOCATIONS: Record<string, string> = {
  'pax-west-2027': 'Seattle, WA',
  'sdcc-2027': 'San Diego, CA',
  'anime-expo-2027': 'Los Angeles, CA',
  'pax-east-2027': 'Boston, MA',
  'wondercon-2027': 'Anaheim, CA',
  'sxsw-2027': 'Austin, TX',
  'oscars-2027': 'Los Angeles, CA',
  'game-developers-conference-gdc-2027': 'San Francisco, CA',
  'avengers-doomsday-premiere': 'Los Angeles, CA',
  'the-game-awards-2026': 'Los Angeles, CA',
  'pax-unplugged-2026': 'Philadelphia, PA',
  'twitchcon-san-diego-2026': 'San Diego, CA',
  'la-comic-con-2026': 'Los Angeles, CA',
  'pax-aus-2026': 'Melbourne, Australia',
  'new-york-comic-con-nycc-2026': 'New York, NY',
  'blizzcon-2026': 'Anaheim, CA',
  'd23-2026': 'Anaheim, CA',
  'sdcc-2026': 'San Diego, CA',
};

export const EVENT_BLURBS: Record<string, string> = {
  'pax-west-2027':
    'Flagship celebration of gaming culture featuring major publisher expos, indie game showcases, musical performances, and esports competitions in Seattle.',
  'sdcc-2027':
    'The premier pop culture and comics convention featuring Hall H studio panels, exclusive previews, interactive multimedia, and expansive exhibits in San Diego.',
  'anime-expo-2027':
    "North America's largest celebration of Japanese pop culture and anime, featuring panels, workshops, performance showcases, and an expansive exhibit hall in Los Angeles.",
  'pax-east-2027':
    'Major East Coast gaming celebration featuring developer panels, expo halls, new game demos, tournaments, and community events in Boston.',
  'wondercon-2027':
    'Comic-Con sister convention featuring 900+ exhibitors, exclusive studio programming, artist panels, and cosplay showcase at the Anaheim Convention Center.',
  'sxsw-2027':
    'Celebration of the convergence of tech, film, music, education, and culture featuring conference sessions, screenings, and showcases in Austin.',
  'oscars-2027':
    'The 99th Academy Awards honoring the highest achievements in film, broadcast live worldwide from the Dolby Theatre at Ovation Hollywood.',
  'game-developers-conference-gdc-2027':
    'Global games industry conference bringing developers, studios, and innovators together at the Moscone Center for technical sessions and exhibitions.',
  'avengers-doomsday-premiere':
    "Red carpet world premiere coverage, cast interviews, and dispatches for Marvel Studios' Avengers: Doomsday in Los Angeles.",
  'the-game-awards-2026':
    'Annual video game awards ceremony hosted by Geoff Keighley honoring creative excellence with world premieres, new game reveals, and musical performances.',
  'pax-unplugged-2026':
    'Dedicated tabletop gaming convention featuring massive game libraries, developer tournaments, and showcase halls at the Pennsylvania Convention Center.',
  'twitchcon-san-diego-2026':
    'Annual convention celebrating livestreaming culture, creator communities, and esports tournaments at the San Diego Convention Center.',
  'la-comic-con-2026':
    'Sprawling celebration of pop culture in the entertainment capital, featuring independent creators, gaming activations, and fandom showcases at the Los Angeles Convention Center.',
  'pax-aus-2026':
    "Australia's biggest celebration of video and tabletop gaming, featuring hands-on publisher demos, indie showcases, and industry panels at the Melbourne Convention & Exhibition Centre.",
  'new-york-comic-con-nycc-2026':
    'East Coast premier pop culture convention uniting major film, television, comic, and gaming reveals under one roof at the Javits Center.',
  'blizzcon-2026':
    'Celebration of the Blizzard entertainment universe featuring developer panels, deep dives, and competitive tournaments at the Anaheim Convention Center.',
  'd23-2026':
    'The Ultimate Disney Fan Event featuring massive showcases, studio sneak peeks, and creative experiences across Disney, Marvel, Star Wars, and Pixar.',
  'sdcc-2026':
    'Full on-location convention coverage of San Diego Comic-Con, including Hall H studio reveals, exhibit floor highlights, and pop culture dispatches.',
};

export const COHLEY_SUMMIT: EventItem = {
  id: 'cohley-summit-2026',
  name: 'Cohley Summit',
  location: 'Fairmont Miramar Hotel, Santa Monica, CA',
  dates: 'Nov 12, 2026',
  blurb:
    'Brand and creator marketing summit focusing on content strategies, creator partnerships, and community retention.',
  url: 'https://www.cohley.com/',
  source: 'Attending',
  rawDate: '2026-11-12',
  image: '',
};

export const CCC_COVERAGE_ITEMS: EventItem[] = [
  {
    id: 'ccc-desert-escape-2026',
    name: 'Desert Escape at Ace Hotel Palm Springs',
    location: 'Palm Springs, CA',
    dates: 'April 2026',
    blurb:
      'On-location beverage and hospitality photography, vertical video, and social reels captured for Desert Escape at the Ace Hotel and Swim Club.',
    url: '/hey-this-is-andrew/ccc/#video',
    source: 'Capture Create Caffeinate',
    rawDate: '2026-04-01',
    image: '/hey-this-is-andrew/_astro/s08-video-desert-2-marquee.DFG4O2zo.jpg',
  },
  {
    id: 'ccc-stone-groove-stillhouse-2026',
    name: 'Stone Groove Stillhouse Launch',
    location: 'Anaheim, CA',
    dates: 'June 2026',
    blurb:
      'Bar and cocktail photography, atmospheric HiFi lounge stills, and launch reels created for Stone Groove Stillhouse at Anaheim MAKE.',
    url: '/hey-this-is-andrew/ccc/#work',
    source: 'Capture Create Caffeinate',
    rawDate: '2026-06-01',
    image: '/hey-this-is-andrew/instagram/18094736273575574.webp',
  },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatEventDates(startDateStr: string, endDateStr?: string): string {
  if (!startDateStr) return '';
  const [sY, sM, sD] = startDateStr.split('-').map(Number);
  if (!sY || !sM || !sD) return startDateStr;

  if (!endDateStr || startDateStr === endDateStr) {
    return `${MONTHS[sM - 1]} ${sD}, ${sY}`;
  }

  const [eY, eM, eD] = endDateStr.split('-').map(Number);
  if (!eY || !eM || !eD) {
    return `${MONTHS[sM - 1]} ${sD}, ${sY}`;
  }

  if (sY === eY && sM === eM) {
    return `${MONTHS[sM - 1]} ${sD}-${eD}, ${sY}`;
  }

  if (sY === eY) {
    return `${MONTHS[sM - 1]} ${sD} - ${MONTHS[eM - 1]} ${eD}, ${sY}`;
  }

  return `${MONTHS[sM - 1]} ${sD}, ${sY} - ${MONTHS[eM - 1]} ${eD}, ${eY}`;
}

export function upgradeImageUrl(url: string | undefined): string {
  if (!url) return '';
  return url.replace(/w=\d+/, 'w=800');
}

export function mapHqEventItem(item: RawHqSearchItem): EventItem | null {
  if (!item || item.type !== 'event' || !item.id) return null;
  const id = item.id;
  const name = item.title || id;
  const rawUrl = item.url || '';
  const url = rawUrl.startsWith('http') ? rawUrl : `https://beunconventionalhq.com${rawUrl}`;
  const image = upgradeImageUrl(item.image);
  const rawDate = item.date || '';
  const dates = formatEventDates(rawDate, item.endDate);
  const location = EVENT_LOCATIONS[id] || 'TBA';
  const blurb = EVENT_BLURBS[id] || `${name} coverage from BE Unconventional HQ.`;

  return {
    id,
    name,
    url,
    image,
    dates,
    location,
    blurb,
    source: 'BE Unconventional HQ',
    rawDate,
  };
}

export function parseSearchIndexEvents(items: unknown[]): { upcoming: EventItem[]; past: EventItem[] } {
  const hqEvents: EventItem[] = [];
  for (const raw of items) {
    const mapped = mapHqEventItem(raw as RawHqSearchItem);
    if (mapped) {
      hqEvents.push(mapped);
    }
  }

  const upcomingHq: EventItem[] = [];
  const pastHq: EventItem[] = [];

  for (const ev of hqEvents) {
    if (ev.rawDate >= HQ_EVENTS_CUTOFF) {
      upcomingHq.push(ev);
    } else {
      pastHq.push(ev);
    }
  }

  const upcomingMap = new Map<string, EventItem>();
  upcomingMap.set(COHLEY_SUMMIT.id, COHLEY_SUMMIT);
  for (const ev of upcomingHq) {
    upcomingMap.set(ev.id, ev);
  }

  const upcoming = Array.from(upcomingMap.values()).sort((a, b) =>
    a.rawDate.localeCompare(b.rawDate)
  );

  const past = pastHq.sort((a, b) => b.rawDate.localeCompare(a.rawDate));

  return { upcoming, past };
}

async function fetchJson(url: string, timeout: number): Promise<unknown> {
  try {
    const response = await fetch(url, {
      credentials: 'omit',
      signal: AbortSignal.timeout(timeout),
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

export async function fetchLiveEvents(
  url = HQ_INDEX_URL,
  timeout = 3000
): Promise<EventsData | null> {
  const payload = await fetchJson(url, timeout);
  if (!Array.isArray(payload)) return null;
  const { upcoming, past } = parseSearchIndexEvents(payload);
  if (upcoming.length === 0 && past.length === 0) return null;
  return {
    upcoming,
    cccCoverage: CCC_COVERAGE_ITEMS,
    past,
  };
}

export async function getEventsForBuild(): Promise<EventsData> {
  const live = await fetchLiveEvents();
  if (live) return live;
  return eventsSeed as EventsData;
}
