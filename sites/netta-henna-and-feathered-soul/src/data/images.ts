// Every image field the local CMS edits resolves here: a path under
// src/assets (an import Astro optimises) or a Sanity asset id (Sanity's CDN)
// when local-cms.config.mjs sets imageHost: { type: 'sanity', ... }.
import type { ImageMetadata } from 'astro';
import type { RemoteImage } from '@andrew/ui/types';
import { resolveImage } from '@andrew/local-cms/images';
import cmsConfig from '../../local-cms.config.mjs';

const IMAGES = import.meta.glob<ImageMetadata>('../assets/**/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' });
const host = cmsConfig.imageHost;
const sanity = host?.type === 'sanity' ? { projectId: host.projectId, dataset: host.dataset } : undefined;

export function image(value: string | undefined | null, where: string): ImageMetadata | RemoteImage | undefined {
  return resolveImage(value, { images: IMAGES, prefix: '../assets/', sanity, where }) as ImageMetadata | RemoteImage | undefined;
}
