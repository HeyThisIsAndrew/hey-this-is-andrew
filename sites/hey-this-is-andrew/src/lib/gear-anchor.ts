/**
 * The id of one gear item's card on /gear/ (GearGrid.astro), so a link can
 * point at the item itself: /gear/#gear-item-sony-a7iv. GearGrid opens the
 * item's section and brings the card to the front when the hash names it.
 * The homepage Gear carousel (GearCarousel.astro) links to these.
 */
export function gearItemId(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ø/g, 'o')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `gear-item-${slug}`;
}

// Section DOM ids on /gear/ predate the page (anchors, the nav, the sitemap,
// site search): every category is gear-<id> except the Cafe Bar, #brew.
const SECTION_ID: Record<string, string> = { cafe: 'brew' };
// The short names the /gear/ filter chips use.
const CHIP: Record<string, string> = { bodies: 'Cameras', tools: 'Support', cafe: 'Cafe' };

/** The id of a category's section on /gear/, e.g. gear-lenses, brew. */
export function gearSectionId(categoryId: string): string {
  return SECTION_ID[categoryId] || `gear-${categoryId}`;
}

/** A category's short name (Cameras, Lenses, Support, Cafe...). */
export function gearChipLabel(categoryId: string, category: string): string {
  return CHIP[categoryId] || category;
}
