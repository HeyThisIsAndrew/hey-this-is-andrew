/**
 * RSS 2.0 feed for Events.
 *
 * Dedicated feed for events that won't pollute the Publisher Center
 * articles feed, but remains fully compliant with Google Search Console
 * and RSS readers looking for syndication.
 */
import rss from '@astrojs/rss';
import { getEventsLocal } from '../../lib/local-content.ts';
import { site } from '../../data/site.js';

export async function GET(context: { site?: URL | string }) {
  const events = getEventsLocal();

  return rss({
    title: `${site.name} - Events`,
    description: "Upcoming and past gaming, film, and entertainment events.",
    site: context.site?.toString() ?? site.url,
    trailingSlash: false,
    items: events.map((event) => {
      // Use the startDate for the pubDate if it exists, otherwise fallback to created/updated
      const stamp = event.startDate || event._updatedAt || event._createdAt || new Date().toISOString();
      return {
        title: event.title,
        pubDate: new Date(stamp),
        description: event.description || `Join us for ${event.title}`,
        link: `/events/${event.slug?.current}`,
      };
    }),
    customData: '<language>en-us</language>',
  });
}
