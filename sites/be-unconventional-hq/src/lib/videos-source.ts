import { categorize } from '../data/categorize.js';
import { getUnifiedVideos, type UnifiedVideo } from './videos.ts';
import localVideos from '../data/videos.json';

export async function getVideosUnified(): Promise<UnifiedVideo[]> {
  const mockClient = {
    fetch: async () => {
      return (Array.isArray(localVideos) ? localVideos : []).filter(v => {
        const effectiveType = v.manualTypeOverride || v._type;
        return effectiveType === "video" && (v.contentStatus === "published" || !v.contentStatus);
      });
    }
  };
  return await getUnifiedVideos(mockClient, { categorize }, '');
}

export async function getShortsUnified(): Promise<UnifiedVideo[]> {
  const mockClient = {
    fetch: async () => {
      return (Array.isArray(localVideos) ? localVideos : []).filter(v => {
        const effectiveType = v.manualTypeOverride || v._type;
        return effectiveType === "short" && v.contentStatus === "published";
      });
    }
  };
  return await getUnifiedVideos(mockClient, { categorize }, '');
}

export async function getLiveStreamsUnified(): Promise<UnifiedVideo[]> {
  const mockClient = {
    fetch: async () => {
      return (Array.isArray(localVideos) ? localVideos : []).filter(v => {
        const effectiveType = v.manualTypeOverride || v._type;
        return effectiveType === "live" && v.contentStatus === "published";
      });
    }
  };
  return await getUnifiedVideos(mockClient, { categorize }, '');
}
