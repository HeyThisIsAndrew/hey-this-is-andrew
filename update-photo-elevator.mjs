import fs from 'fs';
let p = 'packages/ui/src/PhotoElevator.astro';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  "import { getInstagramPhotos } from '../lib/instagram';",
  ""
);

c = c.replace(
  "import SectionHeader from '@andrew/ui/SectionHeader.astro';",
  "import SectionHeader from './SectionHeader.astro';" // It's in the same dir now!
);

const beforeInterface = `
// Self-hosted photos only (src/assets/instagram, via the sync:instagram script).
const instagramPhotos = await getInstagramPhotos(32);
const categoryLabels: Record<'cocktails' | 'bar' | 'product', string> = {
  cocktails: 'Cocktails',
  bar: 'Bars',
  product: 'Product',
};
`;

c = c.replace(beforeInterface, "");

const interfaceString = `interface DisplayPhoto {
  id: string;
  image: ImageMetadata;
  caption: string;
  category: 'cocktails' | 'bar' | 'product' | string;
  location: string;
  venue?: string;
  event?: string;
  permalink?: string;
  /** An Instagram reel: its frame shows here, the film plays on Instagram. */
  video: boolean;
}`;

c = c.replace(/interface DisplayPhoto \{[\s\S]*?video: boolean;\n\}/, interfaceString);

const processingString = `const rawDisplayPhotos: DisplayPhoto[] = instagramPhotos.map((p) => ({
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

// Deduplicate displayPhotos by ID, URL, and caption so each project appears exactly once
const seenIds = new Set<string>();
const seenUrls = new Set<string>();
const seenCaps = new Set<string>();
const displayPhotos: DisplayPhoto[] = [];

for (const p of rawDisplayPhotos) {
  if (seenIds.has(p.id) || seenUrls.has(p.image.src)) continue;
  if (p.caption && p.caption !== 'Capture Create Caffeinate' && seenCaps.has(p.caption)) continue;
  seenIds.add(p.id);
  seenUrls.add(p.image.src);
  if (p.caption) seenCaps.add(p.caption);
  displayPhotos.push(p);
}`;

c = c.replace(processingString, `export interface Props {
  photos: DisplayPhoto[];
  emptyText?: string;
}

const { photos: displayPhotos, emptyText = 'No photos configured yet.' } = Astro.props;`);

c = c.replace(
  "There are no self-hosted photos in <code>src/assets/instagram/</code>",
  "{emptyText}"
);

c = c.replace(
  "run the <a href=\"https://github.com/HeyThisIsAndrew/hey-this-is-andrew/blob/main/docs/instagram-sync.md\">Instagram Sync script</a>",
  "Provide an array of DisplayPhoto to the photos prop."
);

fs.writeFileSync(p, c);
