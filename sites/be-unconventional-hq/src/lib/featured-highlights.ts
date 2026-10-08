/**
 * The production "Featured Highlights" pick, as ONE pure function.
 *
 * It used to live inline in FeaturedHighlights.astro. The homepage hero now
 * uses the same mix for its category panels (Andrew preferred it: a featured
 * or recent video per category, the channel's best performer, and the newest
 * article), so it is shared here rather than copied, and a change to the
 * pick changes both. The logic is moved verbatim.
 *
 *   1. Manually `featured` videos first (at most two), then the newest
 *      videos from categories not yet used, to two.
 *   2. The best-performing video (viewCount) not already picked, from an
 *      unused category if there is one.
 *   3. The newest published article, linked to its local page.
 *   Returned newest first.
 *
 * DOM-free and store-free: callers pass the stores in, so the test suite can
 * run it with plain `node`.
 */
export function pickFeaturedHighlights(
  allVideos: any[],
  allArticles: any[],
  articleHref: (article: any) => string,
): any[] {
  const videos = Array.isArray(allVideos) ? allVideos.filter(Boolean) : [];
  const articles = Array.isArray(allArticles) ? allArticles.filter(Boolean) : [];

  // Pick the first published article
  let article = articles.length > 0 ? articles[0] : null;
  if (article) {
    // Override the Substack link with the local Intel page link
    article = { ...article, link: articleHref(article) };
  }

  // 1. Manually featured videos take absolute priority
  const recentVideos = videos.filter((v) => v.featured).slice(0, 2);
  const usedCategories = new Set<string>(recentVideos.map((v) => v.category));

  // Then fill up to 2 with the most recent videos (preferably from distinct categories to ensure variety)
  for (const video of videos) {
    if (recentVideos.length >= 2) break;
    if (!recentVideos.some((v) => v.youtubeId === video.youtubeId)) {
      if (!usedCategories.has(video.category) || recentVideos.length === 0) {
        recentVideos.push(video);
        usedCategories.add(video.category);
      }
    }
  }

  // If we couldn't find distinct categories to fill to 2, just fill with the next most recent
  if (recentVideos.length < 2) {
    for (const video of videos) {
      if (recentVideos.length >= 2) break;
      if (!recentVideos.some((v) => v.youtubeId === video.youtubeId)) {
        recentVideos.push(video);
      }
    }
  }

  // 2. Best performing video (highest viewCount) that isn't already selected, and ideally from a new category
  const availableForBest = videos.filter((v) => !recentVideos.some((rv) => rv.youtubeId === v.youtubeId));
  availableForBest.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
  let bestPerforming = availableForBest.find((v) => !usedCategories.has(v.category));
  if (!bestPerforming && availableForBest.length > 0) bestPerforming = availableForBest[0];

  const selectedVideos = [...recentVideos, bestPerforming].filter(Boolean);

  // Mix them into a single highlighted list and sort by date descending
  return [...selectedVideos, article].filter(Boolean).sort((a: any, b: any) => {
    const dateA = new Date(a.publishedAt || a.isoDate || a.date).getTime();
    const dateB = new Date(b.publishedAt || b.isoDate || b.date).getTime();
    return dateB - dateA;
  });
}
