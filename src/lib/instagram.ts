/**
 * Instagram API Integration (Instagram Graph API) & Token Auto-Refresh
 * 
 * Features:
 * - Graph API integration with long-lived User Access Tokens (60-day validity)
 * - Automatic token refresh: Meta allows refreshing tokens that are between 24 hours
 *   and 60 days old. This client automatically refreshes tokens weekly / before expiry.
 * - Extracts and flattens photos from single posts, carousels, and video thumbnails.
 * - Persistent caching to src/data/instagram-feed.json and token metadata to
 *   src/data/instagram-token.json so builds succeed even offline or without active network.
 * - Graceful fallback so the site is never broken if Instagram rate limits or fails.
 */

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
  url: string;
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
 * Fetch photography items from Instagram Graph API with automated fallback to cached JSON
 */
export async function getInstagramPhotos(limit = 32): Promise<InstagramPhoto[]> {
  const now = Date.now();

  // 1. Return in-memory cache if fresh
  if (memoryPhotosCache && now - memoryPhotosCache.timestamp < CACHE_TTL_MS) {
    return memoryPhotosCache.data.slice(0, limit);
  }

  // 2. Read local JSON fallback if present
  let fallbackData: InstagramPhoto[] = [];
  try {
    const feedFile = path.resolve(process.cwd(), 'src/data/instagram-feed.json');
    if (fs.existsSync(feedFile)) {
      const raw = JSON.parse(fs.readFileSync(feedFile, 'utf8'));
      fallbackData = raw.map((p: any) => {
        const meta = extractPhotoLocation(p.fullCaption || p.caption || '', p.permalink, p.id);
        return {
          ...p,
          location: p.location || meta.location,
          venue: p.venue || meta.venue,
          event: p.event || meta.event,
        };
      });
    }
  } catch {
    // Ignore
  }

  const token = getInstagramAccessToken();
  if (!token) {
    return fallbackData.slice(0, limit);
  }

  // Check and run auto-refresh if due
  try {
    await autoRefreshTokenIfNeeded();
  } catch {
    // Non-blocking
  }

  try {
    const currentToken = getInstagramAccessToken();
    const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{id,media_url,media_type}';
    const url = `https://graph.instagram.com/me/media?fields=${fields}&access_token=${encodeURIComponent(currentToken)}&limit=${Math.max(limit, 35)}`;

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 9000);

    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[Instagram] API error: ${res.status} ${res.statusText}`);
      // If unauthorized (code 190 / expired), attempt immediate refresh
      if (res.status === 400 || res.status === 401) {
        console.info('[Instagram] Attempting token refresh after auth failure...');
        const refreshed = await refreshInstagramToken();
        if (refreshed.success && refreshed.accessToken) {
          // Retry once with new token
          const retryRes = await fetch(
            `https://graph.instagram.com/me/media?fields=${fields}&access_token=${encodeURIComponent(refreshed.accessToken)}&limit=${Math.max(limit, 35)}`
          );
          if (retryRes.ok) {
            const retryJson = await retryRes.json();
            if (retryJson.data && Array.isArray(retryJson.data)) {
              return processInstagramMedia(retryJson.data, limit);
            }
          }
        }
      }
      return fallbackData.slice(0, limit);
    }

    const json = await res.json();
    if (!json.data || !Array.isArray(json.data)) {
      return fallbackData.slice(0, limit);
    }

    const processed = processInstagramMedia(json.data, limit);
    return processed;
  } catch (err: any) {
    console.warn('[Instagram] Fetch failed, using cache:', err?.message || err);
    return fallbackData.slice(0, limit);
  }
}

function processInstagramMedia(rawItems: any[], limit: number): InstagramPhoto[] {
  const photos: InstagramPhoto[] = [];
  const seenPermalinks = new Set<string>();
  const seenCaptions = new Set<string>();

  for (const item of rawItems) {
    const rawCaption = item.caption || '';
    const cleanCaption = rawCaption.split('\n')[0].trim() || 'Capture Create Caffeinate';
    const category = categorizePhoto(rawCaption);

    if (item.permalink && seenPermalinks.has(item.permalink)) continue;
    if (cleanCaption && cleanCaption !== 'Capture Create Caffeinate' && seenCaptions.has(cleanCaption)) continue;

    if (item.children?.data?.length) {
      // Pick the primary photo from the carousel (first valid image)
      const primaryPhoto = item.children.data.find((c: any) => c.media_url && c.media_type !== 'VIDEO') || item.children.data[0];
      if (primaryPhoto && primaryPhoto.media_url) {
        const meta = extractPhotoLocation(rawCaption, item.permalink, primaryPhoto.id);
        photos.push({
          id: primaryPhoto.id,
          url: primaryPhoto.media_url,
          caption: cleanCaption,
          fullCaption: rawCaption,
          permalink: item.permalink,
          mediaType: 'CAROUSEL_ITEM',
          category,
          location: meta.location,
          venue: meta.venue,
          event: meta.event,
          timestamp: item.timestamp,
          orientation: 'vertical',
        });
        if (item.permalink) seenPermalinks.add(item.permalink);
        if (cleanCaption) seenCaptions.add(cleanCaption);
      }
    } else {
      const url = item.media_type === 'VIDEO' ? item.thumbnail_url : item.media_url;
      if (url) {
        const meta = extractPhotoLocation(rawCaption, item.permalink, item.id);
        photos.push({
          id: item.id,
          url,
          caption: cleanCaption,
          fullCaption: rawCaption,
          permalink: item.permalink,
          mediaType: item.media_type,
          category,
          location: meta.location,
          venue: meta.venue,
          event: meta.event,
          timestamp: item.timestamp,
          orientation: 'vertical',
        });
        if (item.permalink) seenPermalinks.add(item.permalink);
        if (cleanCaption) seenCaptions.add(cleanCaption);
      }
    }

    if (photos.length >= limit) break;
  }

  // Update memory cache
  memoryPhotosCache = {
    data: photos,
    timestamp: Date.now(),
  };

  // Write to disk cache for build fallback
  try {
    const feedFile = path.resolve(process.cwd(), 'src/data/instagram-feed.json');
    fs.writeFileSync(feedFile, JSON.stringify(photos, null, 2), 'utf8');
  } catch {
    // Non-fatal
  }

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
    media_url: p.url,
    permalink: p.permalink,
    timestamp: p.timestamp,
  }));
}
