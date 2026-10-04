// Every image field the local CMS edits resolves here, whichever host holds
// it: a path under src/assets (an import Astro optimises at build) or a
// Sanity asset id (Sanity's CDN), when local-cms.config.mjs sets
// imageHost: { type: 'sanity', ... }. See docs/local-cms-plan.md.
import type { ImageMetadata } from 'astro';
import type { RemoteImage } from '@andrew/ui/types';
import { resolveImage } from '@andrew/local-cms/images';
import cmsConfig from '../../local-cms.config.mjs';

/* The folders an image field may point into. Instagram photos and raw
   masters are left out: they are not picked in the CMS. */
const IMAGES = import.meta.glob<ImageMetadata>('../assets/{brand-logos,hero-media,uploads,projects}/**/*.{png,jpg,jpeg,webp}', {
  eager: true,
  import: 'default',
});

const host = cmsConfig.imageHost;
const sanity = host?.type === 'sanity' ? { projectId: host.projectId, dataset: host.dataset } : undefined;

/** An image field's value as something <Image> renders (undefined if empty). */
export function image(value: string | undefined | null, where: string): ImageMetadata | RemoteImage | undefined {
  return resolveImage(value, { images: IMAGES, prefix: '../assets/', sanity, where }) as ImageMetadata | RemoteImage | undefined;
}
