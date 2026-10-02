/**
 * What the homepage's Selected work features: the latest video and the two
 * featured projects. One function, so Latest (right below it) can leave the
 * same items out instead of listing them a second time.
 */
import { getCollection } from 'astro:content';
import { getLatestVideo } from './latest-content';

export async function getHomeFeatured() {
  const latestVideo = await getLatestVideo();
  const projects = (await getCollection('projects'))
    .sort((a, b) => Number(b.data.featured) - Number(a.data.featured) || +b.data.date - +a.data.date)
    .slice(0, 2);
  return { latestVideo, projects };
}

/** Titles of the featured items, normalised for comparison. */
export async function getHomeFeaturedTitles(): Promise<Set<string>> {
  const { latestVideo, projects } = await getHomeFeatured();
  const norm = (t: string) => t.trim().toLowerCase();
  return new Set([...(latestVideo ? [norm(latestVideo.title)] : []), ...projects.map((p) => norm(p.data.title))]);
}
