/**
 * Dispatch Log grouping (epic #34, Mandate 1).
 *
 * Turns a flat list of event coverage (videos, articles) into a chronological
 * field diary: entries bucketed by calendar day in the brand timezone,
 * labelled relative to the event's start date ("Day 0" = before doors open,
 * "Day 1" = the event's first date, and so on). Labels are fully automatic —
 * zero manual entry, per the owner's decision. Six items in a diary read as a
 * narrative; the same six in a grid read as a failed inventory.
 *
 * Date rules follow CLAUDE.md #1: the event's startDate is a calendar string
 * (never `new Date(calendarString)`); item timestamps are real instants, so
 * Date is legitimate there, collapsed to a brand-timezone calendar day via
 * toYMD() before any comparison.
 */
import { parseEventDateToLocal, parseEventDate, toYMD } from './events.ts';

export interface DispatchItem {
  /** 'video' | 'short' | 'article' — picks the renderer. */
  kind: string;
  title: string;
  /** ISO timestamp (videos) or parseable date string (articles). */
  timestamp: string;
  url?: string;
  videoId?: string | null;
  thumbnail?: string;
  /** Carrier: grouping preserves any extra display fields (date, excerpt,
   *  contentType…) callers attach, so they survive into the rendered diary. */
  [key: string]: unknown;
}

export interface DispatchDay {
  /** "Day 0", "Day 1", … (Day 0 = everything before the event starts). */
  label: string;
  /** "Jul 24" style display date of the bucket. */
  dateLabel: string;
  /** YYYY-MM-DD bucket key (brand timezone). */
  ymd: string;
  items: DispatchItem[];
}

/** Day offset of `ymd` relative to the event's start date (0 = start day). */
function dayOffset(ymd: string, eventStartYmd: string): number {
  const a = parseEventDateToLocal(ymd).getTime();
  const b = parseEventDateToLocal(eventStartYmd).getTime();
  return Math.round((a - b) / 86_400_000);
}

/** "Jul 24" from a YYYY-MM-DD string, Date-free. */
function shortDate(ymd: string): string {
  const p = parseEventDate(ymd);
  return p ? `${p.monthShort} ${p.day}` : ymd;
}

/**
 * Group coverage into chronological dispatch days.
 *
 * - Bucketing: each item's timestamp → brand-timezone calendar day.
 * - Labels: days before the event start collapse into a single "Day 0"
 *   bucket (the road in); the start date is "Day 1"; counting continues past
 *   the event's end (wrap-up coverage stays in the diary).
 * - Ordering: days ascending (a diary reads forward); items within a day
 *   ascending by timestamp.
 * - Items with unparseable timestamps are dropped (they cannot be placed in
 *   a chronology); callers keep showing them elsewhere if needed.
 */
export function groupIntoDispatchDays(
  items: readonly DispatchItem[],
  eventStartDate: string | null | undefined,
): DispatchDay[] {
  const startParsed = parseEventDate(eventStartDate);
  if (!startParsed) return [];
  const startYmd = eventStartDate!.slice(0, 10);

  const buckets = new Map<string, DispatchItem[]>();
  for (const item of items ?? []) {
    const t = new Date(item.timestamp);
    if (Number.isNaN(t.getTime())) continue;
    const itemYmd = toYMD(t);
    // Pre-event coverage collapses into one "road in" bucket keyed on a
    // sentinel so multiple pre-days don't fragment the diary's opening.
    const key = dayOffset(itemYmd, startYmd) < 0 ? `pre:${startYmd}` : itemYmd;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(item);
  }

  const days: DispatchDay[] = [];
  for (const [key, bucketItems] of buckets) {
    bucketItems.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    if (key.startsWith('pre:')) {
      // Display date = the latest pre-event day present, kept simple: label only.
      const lastPre = toYMD(new Date(bucketItems[bucketItems.length - 1].timestamp));
      days.push({ label: 'Day 0', dateLabel: shortDate(lastPre), ymd: lastPre, items: bucketItems });
    } else {
      const n = dayOffset(key, startYmd) + 1; // start date = Day 1
      days.push({ label: `Day ${n}`, dateLabel: shortDate(key), ymd: key, items: bucketItems });
    }
  }

  days.sort((a, b) => {
    // Day 0 always leads; the rest sort by calendar day.
    const aPre = a.label === 'Day 0' ? -1 : 0;
    const bPre = b.label === 'Day 0' ? -1 : 0;
    if (aPre !== bPre) return aPre - bPre;
    return a.ymd.localeCompare(b.ymd);
  });
  return days;
}
