/**
 * THE homepage's single source of content.
 *
 * Every homepage section reads from `getHomepageFeed()`. Nothing on the page
 * types a headline, deck or date of its own: they all come from
 * src/data/articles.json and src/data/videos.json through the mappers in
 * src/lib/homepage-feed.ts, which is where the shaping and the dealing live
 * (and where scripts/homepage-feed.test.mjs tests them).
 *
 * This file is only the binding to the real stores. (Featured is dealt
 * separately, from /feed's own featured shelf: src/data/homepage-featured.ts.)
 */
import { getAllArticles, getPublishedArticles, articleHref, isExternalArticle, type ArticleRecord } from '../lib/articles';
import { pickFeaturedHighlights } from '../lib/featured-highlights';
import { getVideosUnified } from '../lib/videos-source';
import { localArticleImage } from '../lib/article-images';
import { getCardImageSources } from '../lib/card-images';
import { PUBLISH_TIME_ZONE } from '../lib/publish-timezone.js';
import {
  buildHomepageFeed,
  firstPartyHeroSrcset,
  mapArticle,
  mapVideo,
  type HomepageFeed,
  type HomeStory,
  type MapDeps,
  type RawArticle,
} from '../lib/homepage-feed';

const deps: MapDeps = {
  timeZone: PUBLISH_TIME_ZONE,
  articleHref: (a) => articleHref(a as ArticleRecord),
  isExternalArticle: (a) => isExternalArticle(a as ArticleRecord),
  /* Committed renditions first (the article path's rule, see
     lib/article-images.ts), the card proxy ladder otherwise. */
  articleImage: (raw) => localArticleImage(raw) ?? getCardImageSources(raw),
  videoImage: (raw) => getCardImageSources(raw),
};

let cached: Promise<HomepageFeed> | null = null;

export function getHomepageFeed(): Promise<HomepageFeed> {
  cached ??= (async () => {
    let articles: HomeStory[] = [];
    let videos: HomeStory[] = [];
    try {
      articles = getAllArticles()
        .map((a) => mapArticle(a as unknown as RawArticle, deps))
        .filter((s): s is HomeStory => s !== null);
    } catch (err) {
      console.error('[homepage-feed] articles unavailable:', err);
    }
    try {
      videos = (await getVideosUnified())
        .map((v) => mapVideo(v, deps))
        .filter((s): s is HomeStory => s !== null);
    } catch (err) {
      console.error('[homepage-feed] videos unavailable:', err);
    }
    /* The hero's category panels open on the production Featured
       Highlights mix. Ids in HomeStory's own format (see mapArticle /
       mapVideo), so the builder can match them without the raw records. */
    let heroPicks: string[] = [];
    try {
      heroPicks = pickFeaturedHighlights(await getVideosUnified(), getPublishedArticles(), (a) => articleHref(a))
        .map((item: any) => (item.youtubeId ? `video:${item.youtubeId}` : `article:${item.guid || item.slug || item.title}`));
    } catch (err) {
      console.error('[homepage-feed] highlight picks unavailable:', err);
    }
    /* No `featured` world here: the Featured section mirrors /feed's own
       featured shelf now (src/data/homepage-featured.ts), dealt after the
       hero by the page. */
    const feed = buildHomepageFeed(articles, videos, { heroPicks });
    /* The hero's art (the page's LCP image) comes from our own origin; see
       firstPartyHeroSrcset(). Copies, so no other section's story changes. */
    return {
      ...feed,
      hero: feed.hero.map((panel) => ({
        ...panel,
        story: { ...panel.story, imageSrcset: firstPartyHeroSrcset(panel.story.imageSrcset) },
      })),
    };
  })();
  return cached;
}

export type { HomeStory, HomepageFeed };
