/**
 * Instagram API Integration (Instagram Graph API)
 * 
 * Note: Instagram Basic Display API was officially deprecated by Meta in Dec 2024.
 * This client uses the Instagram Graph API with long-lived User Access Tokens.
 * 
 * Features:
 * - Time-based caching (TTL 1 hour) to strictly avoid hitting Instagram rate limits
 * - Filters for IMAGE and CAROUSEL_ALBUM media types
 * - Safe fallback if env tokens are missing or unreachable
 */

export interface InstagramMediaItem {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
}

interface CacheEntry {
  data: InstagramMediaItem[];
  timestamp: number;
}

// In-memory server cache (1 hour TTL)
const CACHE_TTL_MS = 60 * 60 * 1000;
let memoryCache: CacheEntry | null = null;

export async function getInstagramMedia(limit = 12): Promise<InstagramMediaItem[]> {
  const token = import.meta.env.INSTAGRAM_ACCESS_TOKEN || process.env.INSTAGRAM_ACCESS_TOKEN;

  if (!token) {
    return [];
  }

  // Check cache
  const now = Date.now();
  if (memoryCache && now - memoryCache.timestamp < CACHE_TTL_MS) {
    return memoryCache.data.slice(0, limit);
  }

  try {
    const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';
    const url = `https://graph.instagram.com/me/media?fields=${fields}&access_token=${encodeURIComponent(token)}&limit=${Math.max(limit, 20)}`;

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 8000);

    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`Instagram API error: ${res.status} ${res.statusText}`);
      return memoryCache ? memoryCache.data.slice(0, limit) : [];
    }

    const json = await res.json();
    if (!json.data || !Array.isArray(json.data)) {
      return memoryCache ? memoryCache.data.slice(0, limit) : [];
    }

    // Filter to images and carousels (or videos with thumbnail)
    const items: InstagramMediaItem[] = json.data
      .filter((item: any) => item.media_url || item.thumbnail_url)
      .map((item: any) => ({
        id: item.id,
        caption: item.caption || '',
        media_type: item.media_type,
        media_url: item.media_type === 'VIDEO' ? (item.thumbnail_url || item.media_url) : item.media_url,
        thumbnail_url: item.thumbnail_url,
        permalink: item.permalink,
        timestamp: item.timestamp,
      }));

    memoryCache = {
      data: items,
      timestamp: now,
    };

    return items.slice(0, limit);
  } catch (err: any) {
    console.warn('Instagram fetch failed:', err?.message || err);
    return memoryCache ? memoryCache.data.slice(0, limit) : [];
  }
}
