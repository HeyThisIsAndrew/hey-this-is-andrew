/**
 * Instagram photos for the "Shot on the Job" grid (Capture Create
 * Caffeinate's account).
 *
 * The build reads only what scripts/sync-instagram.mjs has already
 * downloaded: src/data/instagram-feed.json plus the files in
 * src/assets/instagram/. No token is read here and no network request is
 * made. The access token lives only in the CCC_INSTAGRAM_ACCESS_TOKEN
 * repository secret and is never written to a file (a token file that used
 * to be written here was committed once); scripts/refresh-instagram-token.mjs
 * keeps it alive.
 */

import type { ImageMetadata } from 'astro';
import fs from 'node:fs';
import path from 'node:path';

export interface InstagramMediaItem {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  children?: {
    data: Array<{
      id: string;
      media_type: string;
      media_url: string;
    }>;
  };
}

export interface InstagramPhoto {
  id: string;
  /** The self-hosted file (src/assets/instagram). Never an Instagram CDN URL. */
  image: ImageMetadata;
  caption: string;
  fullCaption?: string;
  permalink: string;
  mediaType: string;
  category: 'cocktails' | 'bar' | 'product';
  location: string;
  venue?: string;
  event?: string;
  timestamp: string;
  orientation: 'vertical' | 'horizontal' | 'square';
}

// In-memory cache for process lifetime
let memoryPhotosCache: { data: InstagramPhoto[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes in memory

/**
 * CMS and Smart Default Location/Event extraction for Photography items
 */
export function extractPhotoLocation(caption: string, permalink = '', id = ''): {
  location: string;
  venue?: string;
  event?: string;
} {
  // 1. Check CMS overrides file
  try {
    const overridesFile = path.resolve(process.cwd(), 'src/data/portfolio-overrides.json');
    if (fs.existsSync(overridesFile)) {
      const { overrides } = JSON.parse(fs.readFileSync(overridesFile, 'utf8'));
      if (overrides) {
        const key = Object.keys(overrides).find(k => 
          (permalink && permalink.includes(k)) || 
          (id && id === k) ||
          (k && permalink === k)
        );
        if (key && overrides[key]) {
          return {
            location: overrides[key].location || overrides[key].venue || overrides[key].event,
            venue: overrides[key].venue,
            event: overrides[key].event,
          };
        }
      }
    }
  } catch {
    // Non-fatal
  }

  // 2. Smart default pattern matcher across captions, hashtags, and mentions
  const lower = caption.toLowerCase();

  if (lower.includes('desertescape') || lower.includes('desert escape') || lower.includes('palmsprings') || lower.includes('palm springs')) {
    return {
      location: 'Palm Springs',
      venue: 'Ace Hotel',
      event: 'Desert Escape 2026',
    };
  }

  if (lower.includes('stonegroovestillhouse') || lower.includes('stone groove')) {
    return {
      location: 'Stone Groove Stillhouse',
      venue: 'Stone Groove Stillhouse',
      event: 'Hi-Fi Bar · Anaheim',
    };
  }

  if (lower.includes('unsungbrewing') || lower.includes('unsung brewing')) {
    return {
      location: 'Unsung Brewing',
      venue: 'Unsung Brewing',
      event: 'Anaheim MAKE',
    };
  }

  if (lower.includes('anaheimmake') || lower.includes('anaheim make')) {
    return {
      location: 'Anaheim MAKE',
      venue: 'Anaheim MAKE Building',
    };
  }

  if (lower.includes('melroseumbrellaco') || lower.includes('melrose umbrella')) {
    return {
      location: 'Melrose Umbrella Co.',
      venue: 'Melrose Umbrella Co. · LA',
    };
  }

  if (lower.includes('neuehouse')) {
    return {
      location: 'NeueHouse',
      venue: 'NeueHouse Hollywood',
    };
  }

  if (lower.includes('mrblack') || lower.includes('mr black')) {
    return {
      location: 'Mr Black Spirits',
      venue: 'Craft Spirits Studio',
    };
  }

  if (lower.includes('nitro.press') || lower.includes('nitropress') || lower.includes('nitro press')) {
    return {
      location: 'Nitro Press',
      venue: 'Coffee & Nitro Studio',
    };
  }

  if (lower.includes('anaheim')) {
    return {
      location: 'Anaheim, CA',
    };
  }

  if (lower.includes('cocktail') || lower.includes('martini') || lower.includes('margarita') || lower.includes('carajillo')) {
    return {
      location: 'Craft Cocktail',
    };
  }

  if (lower.includes('coffee') || lower.includes('latte')) {
    return {
      location: 'Coffee & Studio',
    };
  }

  return {
    location: 'Field Work',
  };
}

/**
 * Categorize photo based on caption keywords
 */
function categorizePhoto(caption: string): 'cocktails' | 'bar' | 'product' {
  const lower = caption.toLowerCase();
  if (lower.includes('bar') || lower.includes('storefront') || lower.includes('hospitality') || lower.includes('bartender') || lower.includes('rail')) {
    return 'bar';
  }
  if (lower.includes('bottle') || lower.includes('nitro') || lower.includes('shelf') || lower.includes('latte') || lower.includes('coffee') || lower.includes('macro') || lower.includes('gear')) {
    return 'product';
  }
  return 'cocktails';
}

/**
 * The "Shot on the Job" photos, SELF-HOSTED ONLY (audit defect 5).
 *
 * Reads src/data/instagram-feed.json and returns only the photos whose image
 * is stored in src/assets/instagram/ (written by scripts/sync-instagram.mjs).
 * The files are imported through import.meta.glob, so pages render them with
 * Astro's <Image> (responsive widths, intrinsic width/height, no layout
 * shift). No remote Instagram URL reaches the page: those are signed and
 * expire. The build makes no network request here; freshness comes from the
 * sync, which the deploy workflow runs before every build.
 */
const LOCAL_PHOTOS = import.meta.glob<{ default: ImageMetadata }>('../assets/instagram/*.{webp,jpg,jpeg,png}', { eager: true });

function localImageFor(localImage: string): ImageMetadata | null {
  const file = localImage.split('/').pop() ?? '';
  const hit = Object.entries(LOCAL_PHOTOS).find(([k]) => k.endsWith(`/${file}`));
  return hit ? hit[1].default : null;
}

export async function getInstagramPhotos(limit = 32): Promise<InstagramPhoto[]> {
  const now = Date.now();
  if (memoryPhotosCache && now - memoryPhotosCache.timestamp < CACHE_TTL_MS) {
    return memoryPhotosCache.data.slice(0, limit);
  }

  let rows: any[] = [];
  try {
    const feedFile = path.resolve(process.cwd(), 'src/data/instagram-feed.json');
    if (fs.existsSync(feedFile)) rows = JSON.parse(fs.readFileSync(feedFile, 'utf8'));
  } catch {
    rows = [];
  }

  const photos: InstagramPhoto[] = [];
  let skipped = 0;
  for (const p of rows) {
    const image = typeof p.localImage === 'string' ? localImageFor(p.localImage) : null;
    if (!image) {
      skipped++;
      continue;
    }
    const caption = p.fullCaption || p.caption || '';
    const meta = extractPhotoLocation(caption, p.permalink, p.id);
    photos.push({
      id: p.id,
      image,
      caption: p.caption || 'Capture Create Caffeinate',
      fullCaption: p.fullCaption,
      permalink: p.permalink,
      mediaType: p.mediaType,
      category: p.category || categorizePhoto(caption),
      location: p.location || meta.location,
      venue: p.venue || meta.venue,
      event: p.event || meta.event,
      timestamp: p.timestamp,
      orientation: p.orientation || 'vertical',
    });
  }
  if (skipped) {
    console.warn(`[Instagram] ${skipped} photo(s) have no self-hosted file yet; run the sync (see src/data/instagram-media-todo.md).`);
  }

  memoryPhotosCache = { data: photos, timestamp: now };
  return photos.slice(0, limit);
}

/**
 * Backwards compatibility helper for other components requesting generic media
 */
export async function getInstagramMedia(limit = 12): Promise<InstagramMediaItem[]> {
  const photos = await getInstagramPhotos(limit);
  return photos.map((p) => ({
    id: p.id,
    caption: p.caption,
    media_type: p.mediaType === 'VIDEO' ? 'VIDEO' : 'IMAGE',
    media_url: p.image.src,
    permalink: p.permalink,
    timestamp: p.timestamp,
  }));
}
