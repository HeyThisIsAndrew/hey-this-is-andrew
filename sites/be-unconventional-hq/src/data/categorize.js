/**
 * Video categorisation: the keyword scorer behind the canonical categories.
 *
 * ─── WHAT THIS IS ─────────────────────────────────────────────────────────
 * `categorize(text)` scores a string against weighted keyword signals and
 * returns one of the labels in CATEGORIES (src/data/constants.js), falling
 * back to 'General'. It is passed into `getUnifiedVideos()` by
 * src/lib/videos-source.ts, so every video, short and live stream the site
 * renders is categorised through here.
 *
 * ─── WHY IT LIVES IN ITS OWN FILE NOW ─────────────────────────────────────
 * This was the tail end of `src/data/content-source.js`, a 279-line module
 * that fetched Substack's RSS feed and scraped the YouTube channel page. All
 * of that is gone: article syncing is `scripts/sync-articles.mjs` (Substack's
 * posts API) and video syncing is `scripts/sync-youtube.mjs`, both writing to
 * src/data/articles.json and src/data/videos.json. The fetchers had no callers
 * left, and the only live export was this one, sitting under a filename that
 * promised a content source.
 *
 * ─── HOW TO CHANGE THE CATEGORIES ─────────────────────────────────────────
 * The LABELS are CATEGORIES in src/data/constants.js and must stay in step
 * with the keys below. A label here with no entry there is a category nothing
 * can filter by. Note that the local sync's own topic seeds are a separate
 * mechanism (TIER1_TOPIC_SEEDS in scripts/sync-youtube.mjs, per CLAUDE.md
 * hard rule 5); this scorer is what the SITE uses at render time.
 *
 * Weights are deliberate: a 3 is a phrase that only appears in one kind of
 * content ("box office", "season 4"), a 1 is a hint that needs company
 * ("review", "game"). 'Netflix' is a key here without being a browsable
 * CATEGORY, which is intentional and predates this move.
 */

const SIGNALS = {
  Film: [
    [
      3,
      /\b(movie review|out of (the )?theat(er|re)|in theat(er|re)s|4dx|box office|first impression|trailer reaction)\b/,
    ],
    [
      3,
      /\b(odyssey|accountant|warfare|sinners|the amateur|minecraft movie|alien:? ?romulus|romulus|fall guy|boy kills world|monkey man|godzilla|kong|batman|dune|nosferatu|mortal kombat 2)\b/,
    ],
    [2, /\b(movie|film|cinema|cinematic|theatrical|theat(er|re))\b/],
    [1, /\b(review|reaction|trailer)\b/],
  ],
  TV: [
    [3, /\b(season \d+|episode|spoiler-free|series premiere)\b/],
    [
      3,
      /\b(syfy|hulu|hbo|disney\+|prime video|peacock|paramount\+|apple tv)\b/,
    ],
    [
      3,
      /\b(final space|umbrella academy|resident alien|the boys|invincible|succession|the last of us|severance|house of the dragon|wednesday|daredevil|loki)\b/,
    ],
    [2, /\b(series|tv show|finale|binge|streaming)\b/],
  ],
  Games: [
    [
      3,
      /\b(gameplay|playthrough|game review|boss fight|speedrun|elden ring|zelda|mario|mortal kombat 1|playstation|xbox|nintendo|steam deck)\b/,
    ],
    [2, /\b(gaming|gamer|video game)\b/],
    [1, /\bgame\b/],
  ],
  Events: [
    [
      3,
      /\b(wondercon|comic-? ?con|sdcc|expo|festival|red carpet|premiere|convention|bts filming|foodtopia)\b/,
    ],
    [2, /\b(vlog|on location|live coverage|behind the scenes)\b/],
    [1, /\bcon\b/],
  ],
  Netflix: [
    [3, /\b(netflix)\b/],
  ],
};

const ORDER = ['Film', 'TV', 'Games', 'Events', 'Netflix'];

export function categorize(text) {
  const pool = (text || '').toLowerCase();
  let best = 'General';
  let bestScore = 0;
  for (const cat of ORDER) {
    const score = SIGNALS[cat].reduce(
      (sum, [weight, re]) => sum + (re.test(pool) ? weight : 0),
      0
    );
    if (score > bestScore) {
      bestScore = score;
      best = cat;
    }
  }
  return best;
}
