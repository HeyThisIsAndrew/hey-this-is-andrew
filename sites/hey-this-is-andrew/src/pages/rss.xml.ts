// RSS for the writing: Substack notes from the build and BE Unconventional
// HQ articles, the same items the Latest feed's "Writing" filter shows.
import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getNetworkFeed } from '../lib/network';

export async function GET(context: APIContext) {
  const items = (await getNetworkFeed(60)).filter((i) => i.kind === 'article' || i.kind === 'note');
  return rss({
    title: 'HEY_THISISANDREW: writing',
    description: 'Notes from the build and articles across the brands, by Andrew Baxter.',
    site: new URL(import.meta.env.BASE_URL, context.site ?? 'https://heythisisandrew.github.io').href,
    items: items.map((i) => ({
      title: i.title,
      link: i.url,
      pubDate: new Date(i.date),
      description: i.excerpt,
    })),
  });
}
