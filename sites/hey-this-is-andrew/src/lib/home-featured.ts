/**
 * What the homepage's Selected work features: the latest video and the two
 * featured projects. One function, so Latest (right below it) can leave the
 * same items out instead of listing them a second time.
 */
import { getCollection } from 'astro:content';
import { getLatestVideo } from './latest-content';
import { youtubeId } from './youtube-id';

export async function getHomeFeatured() {
  const latestVideo = await getLatestVideo();
  const projects = (await getCollection('projects'))
    .sort((a, b) => Number(b.data.featured) - Number(a.data.featured) || +b.data.date - +a.data.date)
    .slice(0, 2);
  return { latestVideo, projects };
}

/** Keys of the featured items: their titles (normalised), and for the
 *  video its YouTube id and URL. Latest leaves out anything matching any
 *  of them. Matching on titles alone let one video appear in both sections
 *  under two different titles (YouTube can serve the channel page and the
 *  feed different titles for the same video). */
export async function getHomeFeaturedTitles(): Promise<Set<string>> {
  const { latestVideo, projects } = await getHomeFeatured();
  const norm = (t: string) => t.trim().toLowerCase();
  const keys = new Set(projects.map((p) => norm(p.data.title)));
  if (latestVideo) {
    keys.add(norm(latestVideo.title));
    keys.add(latestVideo.url);
    const id = youtubeId(latestVideo.url);
    if (id) keys.add(`yt:${id}`);
  }
  return keys;
}

/** Whether a feed item is one of the featured ones (see above). */
export function isFeatured(keys: Set<string>, item: { title: string; url?: string }): boolean {
  if (keys.has(item.title.trim().toLowerCase())) return true;
  if (item.url && keys.has(item.url)) return true;
  const id = youtubeId(item.url);
  return Boolean(id && keys.has(`yt:${id}`));
}
