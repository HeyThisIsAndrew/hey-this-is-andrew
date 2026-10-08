/**
 * RSS 2.0 feed for Google Publisher Center and Google News ingestion.
 *
 * ─── THE TRAILING SLASH IS THE WHOLE POINT ────────────────────────────────
 * `@astrojs/rss` defaults `trailingSlash` to TRUE, so a relative item link
 * comes out as `/intel/<slug>/`. This site's canonical form is the BARE one:
 * `wrangler.jsonc` sets `assets.html_handling: "drop-trailing-slash"`, every
 * internal link is written without a slash, Layout.astro emits a slash-free
 * canonical, and the sitemap's `serialize` strips any slash it finds.
 *
 * A feed that ships the slashed form therefore advertises a URL that 301s on
 * every fetch, and it disagrees with the canonical tag on the page it points
 * at. That is precisely the defect scripts/gsc-coverage-2026-08-26.md was
 * written about, aimed this time at the one surface whose entire job is
 * handing Google a list of URLs. `trailingSlash: false` is what keeps the
 * feed, the sitemap and the canonical tag saying the same thing.
 *
 * scripts/seo-routing.test.mjs pins it.
 */
import rss from '@astrojs/rss';
import { getPublishedArticles, RESERVED_SLUGS } from '../lib/articles.ts';
import { ARTICLE_SECTION, articlePath } from '../data/sections.js';
import { site } from '../data/site.js';

export async function GET(context: { site?: URL | string }) {
  /*
    Same eligibility the route itself applies. src/pages/intel/[slug].astro
    filters RESERVED_SLUGS out of getStaticPaths, so an article slugged
    `topic` or `page` has no page — and a feed item pointing at a 404 is
    worse than a missing one.
  */
  const articles = getPublishedArticles().filter((post) => !RESERVED_SLUGS.has(post.slug));

  return rss({
    title: site.name,
    description: ARTICLE_SECTION.description,
    site: context.site?.toString() ?? site.url,
    trailingSlash: false,
    items: articles.map((post) => ({
      title: post.title,
      pubDate: new Date(post.isoDate),
      description: post.excerpt,
      /* Never hand-build this path — articlePath() is the one place that
         knows where an article lives. See src/data/sections.js. */
      link: articlePath(post.slug),
    })),
    customData: '<language>en-us</language>',
  });
}
