// NOW — the current-state readout. Updated by hand when the work changes;
// never fabricated. One file, so a future "update the now block" is trivial.
export interface NowItem {
  label: string;
  value: string;
}

export const NOW_MONTH = 'September 2026';

export const NOW_ITEMS: NowItem[] = [
  { label: 'Building', value: 'Creator automation system' },
  { label: 'Publishing', value: 'BE Unconventional HQ' },
  { label: 'Shooting', value: 'Hospitality photography' },
  { label: 'Working toward', value: 'New creative opportunities' },
  { label: 'Next', value: 'Something is brewing.' },
];
