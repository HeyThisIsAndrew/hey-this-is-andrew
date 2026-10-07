import fs from 'fs';
let p = 'sites/hey-this-is-andrew/src/components/PhotographyPortfolio.astro';

let c = `---
import { getInstagramPhotos } from '../lib/instagram';
import PhotoElevator from '@andrew/ui/PhotoElevator.astro';

const instagramPhotos = await getInstagramPhotos(32);
const categoryLabels: Record<'cocktails' | 'bar' | 'product', string> = {
  cocktails: 'Cocktails',
  bar: 'Bars',
  product: 'Product',
};

const rawDisplayPhotos = instagramPhotos.map((p) => ({
  id: p.id,
  image: p.image,
  caption: p.caption,
  category: p.category,
  location: p.location || (p.category === 'bar' ? 'Bar & Venue' : categoryLabels[p.category]),
  venue: p.venue,
  event: p.event,
  permalink: p.permalink,
  video: p.mediaType === 'VIDEO' && Boolean(p.permalink),
}));

const seenIds = new Set<string>();
const seenUrls = new Set<string>();
const seenCaps = new Set<string>();
const displayPhotos = [];

for (const p of rawDisplayPhotos) {
  if (seenIds.has(p.id) || seenUrls.has(p.image.src)) continue;
  if (p.caption && p.caption !== 'Capture Create Caffeinate' && seenCaps.has(p.caption)) continue;
  seenIds.add(p.id);
  seenUrls.add(p.image.src);
  if (p.caption) seenCaps.add(p.caption);
  displayPhotos.push(p);
}
---
<PhotoElevator
  photos={displayPhotos}
  emptyText="There are no self-hosted photos in <code>src/assets/instagram/</code>. To view the photos, run the <a href=\\"https://github.com/HeyThisIsAndrew/hey-this-is-andrew/blob/main/docs/instagram-sync.md\\">Instagram Sync script</a>."
/>
`;

fs.writeFileSync(p, c);
