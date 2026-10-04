// NOW: the current-state readout. The items live in now.json, edited by
// hand or in the local CMS (`pnpm dev`, then /local-cms); never fabricated.
// The month is the build's own, so every deploy shows the real month
// (it was a hand-typed string, and went stale).
import items from './now.json';

export interface NowItem {
  label: string;
  value: string;
}

/** Long month and year of the build, e.g. "October 2026" (en-US, UTC). */
export const NOW_MONTH = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export const NOW_ITEMS: NowItem[] = items as NowItem[];
