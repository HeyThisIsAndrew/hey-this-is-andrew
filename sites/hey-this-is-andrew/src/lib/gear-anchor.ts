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
