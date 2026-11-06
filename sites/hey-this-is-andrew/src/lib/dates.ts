/**
 * Dates from feeds (YouTube, Substack, BE Unconventional HQ), shown the way
 * the publisher shows them: in Pacific time, where Andrew and the brands are.
 *
 * The build runs in UTC, so a post published at 8pm on Oct 29 in California
 * (03:00 UTC on Oct 30) used to read "Oct 30" here and "Oct 29" on BE
 * Unconventional HQ. A bare date ("2026-10-29") has no time and is shown as
 * written, never shifted.
 */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function formatFeedDate(value: string | Date, opts: Intl.DateTimeFormatOptions): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(+d)) return '';
  const timeZone = typeof value === 'string' && DATE_ONLY.test(value) ? 'UTC' : 'America/Los_Angeles';
  return d.toLocaleDateString('en-US', { ...opts, timeZone });
}
