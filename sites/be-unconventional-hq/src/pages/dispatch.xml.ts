/**
 * RSS 2.0 feed for THE HQ DISPATCH, the weekly newsletter Kit sends
 * (issue #266). Kit polls this; readers never see it.
 *
 * Separate from /rss.xml on purpose: that one is the Google News feed and
 * stays exactly as it is. What goes in an item, and why the image is the
 * first thing in content:encoded, is in src/lib/dispatch-feed.ts. The images
 * themselves are built ahead of time by scripts/sync-dispatch-images.mjs.
 * Operator notes: scripts/hq-dispatch.md.
 */
import rss from '@astrojs/rss';
import { getPublishedArticles, RESERVED_SLUGS } from '../lib/articles.ts';
import { getVideosUnified } from '../lib/videos-source.ts';
import {
  selectDispatchEntries,
  dispatchImageUrl,
  dispatchContentHtml,
  type DispatchImageManifest,
} from '../lib/dispatch-feed.ts';
import manifest from '../data/dispatch-images.json';
import { site } from '../data/site.js';

export async function GET(context: { site?: URL | string }) {
  const siteUrl = context.site?.toString() ?? site.url;

  /* Same eligibility the article route applies (see rss.xml.ts). */
  const articles = getPublishedArticles().filter((post) => !RESERVED_SLUGS.has(post.slug));
  const videos = await getVideosUnified();
  const entries = selectDispatchEntries(articles, videos, siteUrl);
  const images = manifest as DispatchImageManifest;

  return rss({
    title: 'THE HQ DISPATCH',
    description: 'Coverage from the HQ.',
    site: siteUrl,
    trailingSlash: false,
    items: entries.map((entry) => ({
      title: entry.title,
      link: entry.link,
      pubDate: entry.pubDate,
      description: entry.summary,
      categories: entry.categories,
      content: dispatchContentHtml(entry, dispatchImageUrl(entry, images, siteUrl)),
    })),
    customData: '<language>en-us</language>',
  });
}
