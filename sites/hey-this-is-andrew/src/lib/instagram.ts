/**
 * Instagram API Integration (Instagram Graph API) & Token Auto-Refresh
 * 
 * Features:
 * - Graph API integration with long-lived User Access Tokens (60-day validity)
 * - Automatic token refresh: Meta allows refreshing tokens that are between 24 hours
 *   and 60 days old. This client automatically refreshes tokens weekly / before expiry.
 * - Extracts and flattens photos from single posts, carousels, and video thumbnails.
 * - Persistent caching to src/data/instagram-feed.json so builds succeed offline.
 * - Token metadata may be written to src/data/instagram-token.json on a LOCAL
 *   machine only: that file is gitignored and must never be committed. The
 *   access token lives only in the INSTAGRAM_ACCESS_TOKEN repository secret.
 * - Graceful fallback so the site is never broken if Instagram rate limits or fails.
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

export interface TokenRefreshResult {
  success: boolean;
  accessToken?: string;
  expiresIn?: number;
  expiresAt?: string;
  error?: string;
}

interface TokenMetadata {
  accessToken: string;
  refreshedAt: string;
  expiresIn: number;
  expiresAt: string;
  username?: string;
}

// In-memory cache for process lifetime
let memoryPhotosCache: { data: InstagramPhoto[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes in memory

/**
 * Resolve the current Instagram access token across environment variables,
 * local dev environment configs, and the cached token file.
 */
export function getInstagramAccessToken(): string {
  // 1. Check process.env / import.meta.env
  let token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token && typeof import.meta !== 'undefined' && (import.meta as any).env) {
    token = (import.meta as any).env.INSTAGRAM_ACCESS_TOKEN;
  }

  // 2. Check /app/.dev.env.json if in cloud dev environment
  if (!token) {
    try {
      const devEnvPath = '/app/.dev.env.json';
      if (fs.existsSync(devEnvPath)) {
        const raw = fs.readFileSync(devEnvPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.INSTAGRAM_ACCESS_TOKEN) {
          token = parsed.INSTAGRAM_ACCESS_TOKEN;
        }
      }
    } catch {
      // Ignore file read error
    }
  }

  // 3. Check cached token metadata file
  if (!token) {
    try {
      const tokenFile = path.resolve(process.cwd(), 'src/data/instagram-token.json');
      if (fs.existsSync(tokenFile)) {
        const parsed = JSON.parse(fs.readFileSync(tokenFile, 'utf8')) as TokenMetadata;
        if (parsed.accessToken) {
          token = parsed.accessToken;
        }
      }
    } catch {
      // Ignore
    }
  }

  return (token || '').trim();
}

/**
 * Read cached token metadata (refreshedAt, expiresAt, etc.)
 */
export function getTokenMetadata(): TokenMetadata | null {
  try {
    const tokenFile = path.resolve(process.cwd(), 'src/data/instagram-token.json');
    if (fs.existsSync(tokenFile)) {
      return JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
    }
  } catch {
    // Ignore
  }
  return null;
}

/**
 * Save refreshed token to disk (both metadata file and .dev.env.json if writable)
 */
function saveTokenMetadata(meta: TokenMetadata): void {
  try {
    const tokenFile = path.resolve(process.cwd(), 'src/data/instagram-token.json');
    const dir = path.dirname(tokenFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(tokenFile, JSON.stringify(meta, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not write src/data/instagram-token.json:', err);
  }

  // Also update /app/.dev.env.json if writable so restart retains new token
  try {
    const devEnvPath = '/app/.dev.env.json';
    if (fs.existsSync(devEnvPath)) {
      const raw = fs.readFileSync(devEnvPath, 'utf8');
      const parsed = JSON.parse(raw);
      parsed.INSTAGRAM_ACCESS_TOKEN = meta.accessToken;
      fs.writeFileSync(devEnvPath, JSON.stringify(parsed, null, 2), 'utf8');
    }
  } catch {
    // Ignore
  }

  // Update process.env in current process
  process.env.INSTAGRAM_ACCESS_TOKEN = meta.accessToken;
}

/**
 * Refresh an Instagram long-lived user access token.
 * Meta Endpoint: GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token={token}
 */
export async function refreshInstagramToken(tokenToRefresh?: string): Promise<TokenRefreshResult> {
  const token = tokenToRefresh || getInstagramAccessToken();
  if (!token) {
    return { success: false, error: 'No Instagram access token available to refresh' };
  }

  try {
    const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`;
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 10000);

    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`Instagram refresh API error: ${res.status} ${res.statusText}`, errText);
      return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }

    const json = await res.json();
    if (!json.access_token) {
      return { success: false, error: 'No access_token returned by Meta' };
    }

    const expiresIn = typeof json.expires_in === 'number' ? json.expires_in : 5184000; // default 60 days
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    const meta: TokenMetadata = {
      accessToken: json.access_token,
      refreshedAt: new Date().toISOString(),
      expiresIn,
      expiresAt,
      username: 'capturecreatecaffeinate',
    };

    saveTokenMetadata(meta);
    console.info(`[Instagram] Token refreshed successfully. Valid until: ${expiresAt} (~${Math.round(expiresIn / 86400)} days)`);

    return {
      success: true,
      accessToken: json.access_token,
      expiresIn,
      expiresAt,
    };
  } catch (err: any) {
    console.warn('[Instagram] Token refresh failed:', err?.message || err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Automatically refresh the token if it hasn't been refreshed in 7 days
 * or if it is within 14 days of expiring.
 */
export async function autoRefreshTokenIfNeeded(): Promise<boolean> {
  const token = getInstagramAccessToken();
  if (!token) return false;

  const meta = getTokenMetadata();
  const now = Date.now();

  if (meta?.refreshedAt) {
    const refreshedTime = new Date(meta.refreshedAt).getTime();
    const daysSinceRefresh = (now - refreshedTime) / (1000 * 60 * 60 * 24);

    // Meta only allows refresh after at least 24 hours. Refresh once per week (7 days).
    if (daysSinceRefresh < 7) {
      return false; // Still fresh, no refresh needed
    }
  }

  // Trigger background refresh
  const result = await refreshInstagramToken(token);
  return result.success;
}

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
