/**
 * Pure, framework-agnostic helpers for event data.
 *
 * Nothing in here imports Astro or Sanity, and nothing constructs a `Date`
 * from a calendar string — that is the whole point. Event dates are stored as
 * plain "YYYY-MM-DD" strings (see schema/event.ts). The instant you do
 * `new Date("2026-07-22")` the runtime reads it as midnight UTC and then
 * renders it in the viewer's timezone, so anyone west of UTC sees "Jul 21".
 * We avoid that by treating the calendar date as text: split it, look the
 * month name up in a table, and compare dates as strings (ISO dates sort
 * chronologically as plain text, as long as both operands are the same
 * precision — see toYMD/getEventStatus).
 *
 * Because these are pure functions they can be unit-tested with plain Node,
 * with no build step and no network — which is how they are verified.
 */

export type EventStatus = 'upcoming' | 'live' | 'completed' | 'cancelled' | 'postponed';

/** The editorial-only status stored on the document (see schema). */
export type EventStatusOverride = 'scheduled' | 'cancelled' | 'postponed';

export interface EventLocation {
  venue?: string;
  city?: string;
  region?: string;
  country?: string;
}

export interface EventLike {
  startDate?: string | null;
  endDate?: string | null;
  status?: EventStatusOverride | string | null;
  location?: EventLocation | string | null;
}

export interface ParsedDate {
  year: number;
  /** 1-12 (human month, not the 0-11 a Date would give). */
  month: number;
  day: number;
  /** Short English month name, e.g. "Jul". */
  monthShort: string;
}

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/**
 * Reference timezone for deciding "what day is it" when deriving status. The
 * brand is US/California-based; a few hours' skew at the midnight boundary is
 * immaterial for an upcoming/live/completed decision. Injectable for tests.
 */
export const REFERENCE_TZ = 'America/Los_Angeles';

/**
 * Split a "YYYY-MM-DD" (or a longer "YYYY-MM-DDThh:mm:ssZ") string into its
 * parts WITHOUT constructing a Date. Any time component is ignored. Returns
 * null for anything that isn't a valid calendar date so callers can fall back.
 */
export function parseEventDate(value?: string | null): ParsedDate | null {
  if (typeof value !== 'string') return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day, monthShort: MONTHS_SHORT[month - 1] };
}

/**
 * Parse "YYYY-MM-DD" into a LOCAL-midnight Date, for the rare code that needs
 * real date arithmetic (day-of-week, month-grid placement) rather than display.
 * Built from components — new Date(y, m-1, d) — so getDate(), getDay() and
 * getMonth() are stable in the local zone. This is the safe counterpart to
 * `new Date("2026-07-22")`, which is parsed as midnight UTC and then reads a day
 * earlier for viewers west of UTC. Returns an Invalid Date for unparseable
 * input, so existing `Number.isNaN(d.getTime())` guards keep working unchanged.
 */
export function parseEventDateToLocal(value?: string | null): Date {
  const p = parseEventDate(value);
  if (!p) return new Date(NaN);
  return new Date(p.year, p.month - 1, p.day);
}

export interface DateRangeOptions {
  /** Include the year in the output. Default true. */
  year?: boolean;
  /** Separator between days/dates. Default en-dash "–". */
  dash?: string;
}

/**
 * Format a calendar date range for display, Date-free.
 *
 *   formatEventDateRange("2026-07-22", "2026-07-26")               -> "Jul 22–26, 2026"
 *   formatEventDateRange("2026-07-22", "2026-07-26", {year:false}) -> "Jul 22–26"
 *   formatEventDateRange("2026-07-22")                             -> "Jul 22, 2026"
 *   formatEventDateRange("2026-07-30", "2026-08-02")               -> "Jul 30 – Aug 2, 2026"
 *   formatEventDateRange("2025-12-30", "2026-01-02")               -> "Dec 30, 2025 – Jan 2, 2026"
 */
export function formatEventDateRange(
  start?: string | null,
  end?: string | null,
  options: DateRangeOptions = {}
): string {
  const { year = true, dash = '–' } = options;
  const s = parseEventDate(start);
  if (!s) return 'Date TBD';
  const e = end ? parseEventDate(end) : null;
  const yr = year ? `, ${s.year}` : '';

  // Single day (no end, or end === start).
  if (!e || (e.year === s.year && e.month === s.month && e.day === s.day)) {
    return `${s.monthShort} ${s.day}${yr}`;
  }
  // Same month & year: "Jul 22–26".
  if (s.year === e.year && s.month === e.month) {
    return `${s.monthShort} ${s.day}${dash}${e.day}${yr}`;
  }
  // Same year, crossing months: "Jul 30 – Aug 2, 2026".
  if (s.year === e.year) {
    return `${s.monthShort} ${s.day} ${dash} ${e.monthShort} ${e.day}${yr}`;
  }
  // Crossing years: always show both years regardless of the `year` option,
  // otherwise the range is ambiguous.
  return `${s.monthShort} ${s.day}, ${s.year} ${dash} ${e.monthShort} ${e.day}, ${e.year}`;
}

/**
 * Format a structured location for display. Falls back gracefully when parts
 * are missing (no trailing comma), and passes a legacy string through
 * untouched so a not-yet-migrated document never renders "[object Object]".
 *
 *   formatLocation({ city: "San Diego", region: "CA" })          -> "San Diego, CA"
 *   formatLocation({ city: "San Diego" })                        -> "San Diego"
 *   formatLocation({ country: "Japan" })                         -> "Japan"
 *   formatLocation({ venue:"Hall H", city:"San Diego", region:"CA" }, { includeVenue:true })
 *                                                                 -> "Hall H, San Diego, CA"
 */
export function formatLocation(
  location?: EventLocation | string | null,
  options: { includeVenue?: boolean } = {}
): string {
  if (!location) return '';
  if (typeof location === 'string') return location; // legacy / un-migrated
  const primary =
    [location.city, location.region].filter(Boolean).join(', ') ||
    location.country ||
    '';
  if (options.includeVenue && location.venue) {
    return primary ? `${location.venue}, ${primary}` : location.venue;
  }
  return primary;
}

/**
 * Today's date as "YYYY-MM-DD" in the given timezone. The `en-CA` locale emits
 * ISO-ordered date parts, so this is a clean way to get a comparable calendar
 * day for "now" without hand-assembling it. Injectable `date` for tests.
 */
export function toYMD(date: Date = new Date(), timeZone: string = REFERENCE_TZ): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Resolve an event's DISPLAYED lifecycle status.
 *
 * Editorial states (cancelled / postponed) are stored on the document and win.
 * Everything else is derived from the calendar dates vs. today — so no one has
 * to hand-flip an event from "upcoming" to "live" to "completed" as time
 * passes. Comparison is string-based on same-precision "YYYY-MM-DD" values,
 * which is why an event whose last day is *today* correctly reads as "live"
 * rather than "completed".
 */
export function getEventStatus(
  event: EventLike,
  now: Date = new Date(),
  timeZone: string = REFERENCE_TZ
): EventStatus {
  if (event?.status === 'cancelled') return 'cancelled';
  if (event?.status === 'postponed') return 'postponed';

  const start = typeof event?.startDate === 'string' ? event.startDate.slice(0, 10) : null;
  if (!start) return 'upcoming'; // no date yet — safest default is "not over"

  const end =
    typeof event?.endDate === 'string' && event.endDate ? event.endDate.slice(0, 10) : start;
  const today = toYMD(now, timeZone);

  if (today < start) return 'upcoming';
  if (today > end) return 'completed';
  return 'live';
}

/**
 * ─── THE EVENT-TYPE TAG ────────────────────────────────────────────────────
 *
 * The hero eyebrow on /events/[slug] used to render the literal string
 * "LIVE EVENT" for any event whose `category` was unset — which is every
 * event in the store, because `category` is a HUB category (Franchises,
 * Studios, Streaming, Gaming) belonging to featuredBrand documents, not
 * something an event document has ever carried. So BlizzCon, a convention
 * eight months away, announced itself as a LIVE EVENT.
 *
 * `eventType` is the field that actually answers "what kind of thing is
 * this": a dropdown on the Event schema, mirrored in the local CMS. These
 * labels are the display half of that dropdown and the two lists must stay
 * in step — schema/event.ts holds the authoritative option values.
 *
 * `other` deliberately falls through to the generic "Event" rather than
 * rendering the word "Other", which tells a visitor nothing.
 */
export const EVENT_TYPE_LABELS: Record<string, string> = {
  /*
    "Convention", not "Convention & Expo".

    The VALUE still says convention-expo, because it is stored data on
    fourteen documents and renaming it is a migration for no gain. Only the
    words a reader sees changed, and they changed for two reasons.

    It read as a hedge. The two terms were merged precisely because the
    distinction was one no event here makes, so naming both was the merge
    apologising for itself. Every event on this site that holds this value is
    a convention; even CinemaCon, the obvious candidate for the other half,
    bills itself as "the official convention of the National Association of
    Theatre Owners".

    And it was too long for the card. At 393px "Convention & Expo" broke to
    two lines inside a flex item, which stranded the bullet and the year
    beside the short one — see the note in EventCard.astro.
  */
  'convention-expo': 'Convention',
  premiere: 'Premiere',
  screening: 'Screening',
  showcase: 'Showcase',
  festival: 'Festival',
  'industry-awards': 'Industry Awards',
  'brand-activation': 'Brand Activation',
  other: 'Event',
};

/*
  ─── RETIRED VALUES STILL HAVE TO RENDER ──────────────────────────────────

  `convention`, `expo` and `award_show` were replaced by press-grade terms and
  the documents holding them were migrated in the same commit. These aliases
  are not that migration's leftovers — they are the safety net for the copies
  of the store this repository does not control: a Sanity document that was
  never re-exported, a branch that predates the migration, a JSON file an
  editor kept locally.

  Without them a stale value falls through to titleCaseToken() and renders
  "Award Show" — close enough to look correct and wrong enough that nobody
  would ever notice the migration had missed a document.

  They are DELIBERATELY absent from the dropdowns, so nothing new can be
  written on them. Safe to delete once you are confident no unmigrated copy of
  the store exists.
*/
const RETIRED_EVENT_TYPE_LABELS: Record<string, string> = {
  convention: 'Convention',
  expo: 'Convention',
  award_show: 'Industry Awards',
};

/**
 * The label for an event's type tag.
 *
 * Order of preference: the `eventType` dropdown, then a legacy `category`
 * value (string or Sanity-style object) for documents that predate the
 * dropdown, then the neutral "Event". Never a hardcoded lifecycle word —
 * whether an event is live is `getEventStatus()`'s job, and the status
 * indicator already says so.
 */
export function getEventTypeLabel(event: {
  eventType?: string | null;
  category?: unknown;
} | null | undefined): string {
  const type = typeof event?.eventType === 'string' ? event.eventType.trim() : '';
  if (type) return EVENT_TYPE_LABELS[type] ?? RETIRED_EVENT_TYPE_LABELS[type] ?? titleCaseToken(type);

  const category = event?.category;
  if (typeof category === 'string' && category.trim()) return titleCaseToken(category.trim());
  if (category && typeof category === 'object') {
    const named = category as { title?: string; name?: string };
    const label = named.title || named.name;
    if (label) return label;
  }
  return 'Event';
}

/** "award_show" / "press-day" -> "Award Show" / "Press Day". */
function titleCaseToken(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
