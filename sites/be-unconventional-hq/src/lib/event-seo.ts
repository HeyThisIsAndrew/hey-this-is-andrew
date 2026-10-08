/**
 * What an event page tells Google and a social card.
 *
 * ─── WHY THIS IS A MODULE AND NOT TWO COPIES ───────────────────────────────
 * EventAnnouncement.astro and EventFeatured.astro are near-identical twins,
 * and every time something has been written into both of them by hand the two
 * have drifted. The hub card heading was hardcoded in one and missing from the
 * other; the coverage filter existed in both and was wrong in both. Metadata
 * is worse than either, because nothing on the page shows you it is wrong.
 *
 * Pure on purpose: no videos.json import, so `node` can run the suite against
 * it (see scripts/event-seo.test.mjs). The image URL is passed IN rather than
 * built here, because building it needs urlFor(), which lives in
 * local-content.ts, which does import the store.
 */
import { formatEventDateRange, formatLocation, getEventTypeLabel } from './events.ts';

/**
 * Values an editor types to mean "not filled in yet".
 *
 * ─── WHY METADATA FILTERS THEM AND THE PAGE DOES NOT ───────────────────────
 * "Venue: TBD" is useful ON the page: it tells a reader the venue genuinely
 * is not announced, which is different from the site not knowing. In a meta
 * description or a schema.org node it is neither useful nor true, and it is
 * the version that gets crawled, cached and shown in a result.
 *
 * The Doomsday premiere shipped a description reading "Premiere at TBD, Los
 * Angeles, CA." Without this it reads "Premiere in Los Angeles, CA", which
 * is correct and says the same amount.
 */
const PLACEHOLDER_VALUE = /^(tbd|tba|tbc|n\/?a|none|unknown|to be (announced|confirmed|determined)|coming soon)\.?$/i;

/** True when a field holds an editor's "not yet" marker rather than a fact. */
export function isPlaceholderValue(value: unknown): boolean {
  return typeof value === 'string' && PLACEHOLDER_VALUE.test(value.trim());
}

/** Google truncates a description around 160 characters and ignores very short ones. */
export const DESCRIPTION_MIN = 120;
export const DESCRIPTION_MAX = 160;

/**
 * A sentence about THIS event, not a template with a name dropped in.
 *
 * The pages shipped with `Coverage of ${event.title}` — 26 characters for
 * "Coverage of BlizzCon", which is under every length Google will use and
 * says nothing a searcher could act on. This assembles what the document
 * actually knows (kind, place, dates) and degrades one clause at a time when
 * a field is missing, rather than emitting an empty gap.
 */
export function buildEventDescription(event: any, siteName = 'BE Unconventional HQ'): string {
  const title = String(event?.title ?? '').trim() || 'this event';
  const kind = getEventTypeLabel(event) ?? '';
  const dates = formatEventDateRange(event?.startDate, event?.endDate);

  /*
    "at the convention center" but "in San Diego". A venue takes "at" and a
    bare city takes "in", and formatLocation returns either shape depending on
    what the document has, so the preposition is chosen from which one came
    back rather than hardcoded.
  */
  const rawVenue =
    event?.location && typeof event.location === 'object' ? String(event.location.venue ?? '') : '';
  const venue = isPlaceholderValue(rawVenue) ? '' : rawVenue;
  /*
    `includeVenue` only when the venue is a real one. A placeholder drops out
    and formatLocation falls back to "City, Region" on its own.
  */
  const place = formatLocation(event?.location, { includeVenue: Boolean(venue) });
  const at = venue && place.startsWith(venue);

  /*
    ─── NO INDEFINITE ARTICLE, DELIBERATELY ────────────────────────────────

    The first version read "a ${kind}" and produced "a industry awards" for
    The Oscars and The Game Awards. Fixing that with an a/an rule would still
    leave the plural label reading wrong, so the clause is its own sentence
    instead and the article disappears with the problem.

      BE Unconventional HQ coverage of The Oscars. Industry awards at Dolby
      Theatre, Los Angeles, CA. Mar 14, 2027.
  */
  const where = place ? `${at ? 'at' : 'in'} ${place}` : '';
  const middle = kind && where ? `${kind} ${where}` : kind || (where ? where[0].toUpperCase() + where.slice(1) : '');

  const sentences = [`${siteName} coverage of ${title}`, middle, dates].filter(Boolean);
  let out = `${sentences.join('. ')}.`;

  /*
    ─── THE TAIL IS ALL OR NOTHING ─────────────────────────────────────────

    A short event name leaves this under the floor, so a tail is appended.
    The first version appended one fixed tail and then trimmed the result to
    the ceiling, which cut it mid-clause: "News, video coverage and everything
    we." The longest tail that FITS is used instead, and if none fits the
    description simply stays short, because a truthful short sentence beats a
    long one that stops in the middle of itself.
  */
  if (out.length < DESCRIPTION_MIN) {
    const tails = [
      ' News, video coverage and everything we publish, in one place.',
      ' News, video and everything we publish, in one place.',
      ' Everything we publish about it, in one place.',
      ' Everything we publish, in one place.',
    ];
    const fits = tails.find((tail) => out.length + tail.length <= DESCRIPTION_MAX);
    if (fits) out += fits;
  }

  /*
    Last resort, and it should never fire on real data: an event whose own
    title is longer than the ceiling. Cuts at a word boundary, because a
    description broken mid-word looks like a bug in a search result.
  */
  if (out.length > DESCRIPTION_MAX) {
    const cut = out.slice(0, DESCRIPTION_MAX);
    const lastSpace = cut.lastIndexOf(' ');
    out = `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[.,\s]+$/, '')}.`;
  }

  return out;
}

/**
 * The `<title>`.
 *
 * Layout.astro renders `<title>{title}</title>` verbatim: it appends nothing.
 * The event pages passed `event.title` alone, so every one of them shipped a
 * title with no brand on it at all, unlike every other route on the site.
 *
 * `pageTitle()` from data/content.js is the site-wide helper and appends the
 * REAL site name. Do not hand-write the suffix: "| Be Unconventional" is the
 * wrong brand, and the point of the helper is that nobody has to remember
 * which.
 */
export function buildEventTitleName(event: any): string {
  const title = String(event?.title ?? '').trim();
  if (!title) return 'Event Coverage';
  /* "SDCC Coverage", not "SDCC Coverage Coverage". */
  return /\bcoverage\b/i.test(title) ? title : `${title} Coverage`;
}

/**
 * schema.org/Event.
 *
 * ─── DATES STAY STRINGS (HARD RULE 1) ─────────────────────────────────────
 * schema.org accepts a plain "YYYY-MM-DD" for startDate and endDate, and that
 * is exactly what the document stores. Passing them through `new Date()` to
 * "normalise" them is the UTC-shift bug that this codebase has a hard rule
 * about: west of Greenwich it moves a convention to the day before.
 *
 * Returns null when there is nothing truthful to say. A partial Event node
 * without a name or a start date is worse than none: Search Console reports
 * it as an error against the page.
 */
export function buildEventSchema(
  event: any,
  { url, imageUrl, description }: { url?: string; imageUrl?: string; description?: string } = {},
): Record<string, any> | null {
  const name = String(event?.title ?? '').trim();
  const startDate = typeof event?.startDate === 'string' ? event.startDate.slice(0, 10) : '';
  if (!name || !startDate) return null;

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name,
    startDate,
  };

  const endDate = typeof event?.endDate === 'string' ? event.endDate.slice(0, 10) : '';
  if (endDate) schema.endDate = endDate;

  /*
    `status` stores only the EDITORIAL states; upcoming/live/completed are
    derived from the dates at render time and are NOT statuses schema.org
    wants here. Anything else is a scheduled event.
  */
  const status = String(event?.status ?? '').toLowerCase();
  schema.eventStatus =
    status === 'cancelled'
      ? 'https://schema.org/EventCancelled'
      : status === 'postponed'
        ? 'https://schema.org/EventPostponed'
        : 'https://schema.org/EventScheduled';

  const location = event?.location;
  if (typeof location === 'string' && location.trim() && !isPlaceholderValue(location)) {
    schema.location = { '@type': 'Place', name: location.trim(), address: location.trim() };
  } else if (location && typeof location === 'object') {
    const address: Record<string, any> = { '@type': 'PostalAddress' };
    if (location.city) address.addressLocality = location.city;
    if (location.region) address.addressRegion = location.region;
    if (location.country) address.addressCountry = location.country;

    const placeName = (!isPlaceholderValue(location.venue) && location.venue)
      || formatLocation(location)
      || undefined;
    if (placeName || Object.keys(address).length > 1) {
      schema.location = { '@type': 'Place' };
      if (placeName) schema.location.name = placeName;
      if (Object.keys(address).length > 1) schema.location.address = address;
    }
  }
  /*
    An Event with no location at all is incomplete to Google. Saying so
    honestly beats inventing a venue: this is the one case where the node is
    still emitted, because name + date is genuinely useful on its own.
  */

  if (imageUrl) schema.image = [imageUrl];
  if (url) schema.url = url;

  const text = description || event?.description;
  if (typeof text === 'string' && text.trim()) schema.description = text.trim();

  const organizer = String(event?.organizer ?? '').trim();
  if (organizer) {
    schema.organizer = { '@type': 'Organization', name: organizer };
    const site = String(event?.officialWebsite ?? '').trim();
    if (/^https?:\/\//i.test(site)) schema.organizer.url = site;
  }

  return schema;
}
