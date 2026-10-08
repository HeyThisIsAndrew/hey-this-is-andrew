/**
 * YouTube → Local JSON ingestion sync — Taxonomy-as-Code edition.
 *
 * Local-JSON counterpart to the old Sanity sync: pulls the channel's uploads
 * from the YouTube Data API v3 and upserts a video/short/live doc per video
 * into src/data/videos.json, using the same three-field-class contract
 * (FACTUAL/DERIVED/EDITORIAL - see planVideoSync).
 *
 * Hub taxonomy (topics is still Tier-1-seed-only; hubs come from the
 * featuredBrand/event docs already living in videos.json) is rebuilt from
 * each doc's `youtubeSyncKeywords`, keyed by `slug.current` - the local
 * equivalent of the old "build the dictionary FROM SANITY every run".
 *
 * Dry-run by default; pass --execute to write src/data/videos.json. Pure
 * planning functions are exported for offline tests; importing this module
 * performs zero I/O.
 */
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import fs from 'node:fs';
import { withFileLock } from './file-lock.mjs';

import { createYouTubeClient } from '../src/lib/platforms/youtube.ts';

config();

export function videoDocId(youtubeId) {
  return `youtube-${youtubeId}`;
}

export const UNCATEGORIZED_TOPIC_ID = 'topic-uncategorized';

export const TIER1_TOPIC_SEEDS = Object.freeze([
  { _id: 'topic-film', title: 'Film', slug: 'film', isTier1Category: true, keywords: ['film', 'movie', 'movies'] },
  { _id: 'topic-tv', title: 'TV', slug: 'tv', isTier1Category: true, keywords: ['tv', 'television', 'tv show', 'series'] },
  { _id: 'topic-gaming', title: 'Games', slug: 'gaming', isTier1Category: true, keywords: ['gaming', 'game', 'games', 'video game', 'video games'] },
  { _id: 'topic-events', title: 'Events', slug: 'events', isTier1Category: true, keywords: ['event', 'events', 'convention'] },
  { _id: UNCATEGORIZED_TOPIC_ID, title: 'Uncategorized', slug: 'uncategorized', isTier1Category: false, keywords: [] },
]);

export function normalizeTag(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Local equivalent of the old `*[_type in ["featuredBrand", "event"]]`
 * dictionary source: featuredBrand/event docs, keyed by slug, contribute
 * their youtubeSyncKeywords as hub match keywords.
 */
export function extractHubSeeds(existingDocs) {
  return existingDocs
    .filter((d) => (d?._type === 'featuredBrand' || d?._type === 'event') && d?.slug?.current)
    .map((d) => ({ slug: d.slug.current, keywords: d.youtubeSyncKeywords ?? [] }));
}

export function extractTopicSeeds(existingDocs) {
  return existingDocs
    .filter((d) => d?._type === 'topic' && d?.slug?.current)
    .map((d) => ({
      _id: d._id,
      title: d.title,
      slug: d.slug.current,
      isTier1Category: d.isTier1Category ?? false,
      keywords: d.youtubeSyncKeywords ?? []
    }));
}

export function buildTaxonomyDictionary({ topics = [], hubs = [] }) {
  const tier1 = new Map();
  const hubMap = new Map();
  const collisions = [];

  const add = (map, keyword, id, kind) => {
    const key = normalizeTag(keyword);
    if (!key) return;
    const existing = map.get(key);
    if (existing && existing !== id) {
      collisions.push({ keyword: key, kind, kept: existing, ignored: id });
      return;
    }
    map.set(key, id);
  };

  for (const t of topics) {
    if (!t?.isTier1Category) continue;
    for (const k of t.keywords ?? []) add(tier1, k, t.slug, 'topic');
  }
  for (const h of hubs) {
    for (const k of h?.keywords ?? []) add(hubMap, k, h.slug, 'hub');
  }
  return { tier1, hubs: hubMap, collisions };
}

export function matchVideoTags(youtubeTags, dict) {
  const topicIds = [];
  const hubIds = [];
  const tags = Array.isArray(youtubeTags) ? youtubeTags : [];
  for (const raw of tags) {
    const key = normalizeTag(raw);
    const topicId = dict.tier1.get(key);
    if (topicId && !topicIds.includes(topicId)) topicIds.push(topicId);
    const hubId = dict.hubs.get(key);
    if (hubId && !hubIds.includes(hubId)) hubIds.push(hubId);
  }
  const requiresReview = topicIds.length === 0;
  if (requiresReview) topicIds.push('uncategorized');
  return { topicIds, hubIds, requiresReview };
}

export function mapVideoToSyncedFields(video, now = new Date()) {
  return {
    youtubeId: video.id,
    title: video.title,
    description: video.description,
    thumbnailUrl: video.thumbnail,
    durationSeconds: video.durationSeconds,
    isShort: video.isShort,
    isLive: video.isLive,
    isEvent: video.isEvent,
    viewCount: video.viewCount,
    publishedAt: video.publishedAt,
    youtubeTags: video.tags,
    platform: 'youtube',
    lastSyncedAt: now.toISOString(),
  };
}

export function planVideoSync(video, match, existingDoc, now = new Date()) {
  const _id = videoDocId(video.id);

  // 1. Calculate the standard synced factual fields
  const syncedFields = mapVideoToSyncedFields(video, now);

  // 2. Check for manual type override
  let docType = existingDoc?.manualTypeOverride || null;
  if (!docType) {
    if (video.isShort) docType = 'short';
    else if (video.isLive) docType = 'live';
    else docType = 'video';
  }

  // 3. Determine Taxonomy (respecting manualTaxonomyOverride)
  const manualTaxonomyOverride = existingDoc?.manualTaxonomyOverride ?? false;
  const topics = manualTaxonomyOverride ? (existingDoc?.topics ?? []) : match.topicIds;
  const hubs = manualTaxonomyOverride ? (existingDoc?.hubs ?? []) : match.hubIds;
  const requiresReview = manualTaxonomyOverride ? (existingDoc?.requiresReview ?? false) : match.requiresReview;

  // 4. Determine contentStatus (never overwrite a human's choice; promote if tags fixed)
  let contentStatus = existingDoc?.contentStatus;
  if (!contentStatus || contentStatus === 'needs-review') {
      contentStatus = requiresReview ? 'needs-review' : 'published';
  }

  return {
    _id,
    _type: docType,
    ...syncedFields,

    // Editorial fields
    contentStatus,
    manualTypeOverride: existingDoc?.manualTypeOverride ?? '',
    featured: existingDoc?.featured ?? false,
    franchises: existingDoc?.franchises ?? [],
    characters: existingDoc?.characters ?? [],
    coverageType: existingDoc?.coverageType ?? '',
    series: existingDoc?.series ?? '',
    /* Collection-level editorial. EDITORIAL class (hard rule 5): seeded by a
       human, never written by this script, wiped on the next run if not carried. */
    featuredSeries: existingDoc?.featuredSeries ?? false,
    seriesAccent: existingDoc?.seriesAccent ?? '',
    editorialNotes: existingDoc?.editorialNotes ?? '',
    /* The hand-written standfirst. EDITORIAL class (hard rule 5): seeded by a
       human, never written by this script, and wiped on the next run if it is
       not carried here. */
    editorial: existingDoc?.editorial ?? undefined,
    /* Ordering override. Publish order and episode order are different things:
       the Lanterns ep 2 review went out after the ep 3 review, so by date the
       row read 5, 4, 2, 3. Carried forward explicitly, like every editorial
       field here, or a sync run would drop it. */
    sortDate: existingDoc?.sortDate ?? '',
    /*
       ─── THE FEED HERO'S OVERRIDES, AND THE CHIP ─────────────────────────

       These three were read by the site and carried by nobody, which is the
       one combination this function cannot survive: the doc is REBUILT from
       the fields named here, so anything absent is not merely un-updated, it
       is erased.

       It had already happened. `badge1` on the Coyote vs. Acme doc reads
       "KETCHUP ENTERTAINMENT" on the feature branch and is GONE on main,
       where the scheduled sync writes. That chip is the only thing naming the
       distributor on /feed, and nothing reported it, because a field that
       quietly becomes empty looks exactly like a field an editor never set.

       `customHeroLogo` and `customHeroBrandLabel` had no value in the store
       yet, so they had nothing to lose. They do now, and they would have been
       wiped on the next run. */
    badge1: existingDoc?.badge1 ?? '',
    customHeroLogo: existingDoc?.customHeroLogo ?? '',
    customHeroBrandLabel: existingDoc?.customHeroBrandLabel ?? '',

    // Taxonomy fields
    topics,
    hubs,
    requiresReview,
    manualTaxonomyOverride,
  };
}

async function collectUploadIds(yt, channelId) {
  const ids = [];
  let pageToken;
  do {
    const { videos, nextPageToken } = await yt.getUploads(channelId, pageToken);
    ids.push(...videos.map((v) => v.id));
    pageToken = nextPageToken;
  } while (pageToken);
  return ids;
}

async function run() {
  const {
    YOUTUBE_API_KEY,
    YOUTUBE_CHANNEL_ID,
  } = process.env;

  if (!YOUTUBE_API_KEY) return fail('YOUTUBE_API_KEY is required.');
  if (!YOUTUBE_CHANNEL_ID) return fail('YOUTUBE_CHANNEL_ID is required.');

  const execute = process.argv.includes('--execute');

  const outPath = fileURLToPath(new URL('../src/data/videos.json', import.meta.url));

  await withFileLock(outPath, async () => {
    let existingDocsMap = new Map();
    if (fs.existsSync(outPath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(outPath, 'utf8'));
        for (const d of existing) {
          existingDocsMap.set(d._id, d);
        }
      } catch (e) {
        return fail(`Catastrophic failure: Failed to parse existing ${outPath}. Halting to prevent data loss. Error: ${e.message}`);
      }
    }

  const allDocs = Array.from(existingDocsMap.values());
  const hubSeeds = extractHubSeeds(allDocs);
  let topicSeeds = extractTopicSeeds(allDocs);
  
  let needsTopicBootstrap = false;
  if (topicSeeds.length === 0) {
    topicSeeds = TIER1_TOPIC_SEEDS;
    needsTopicBootstrap = true;
  }

  const dict = buildTaxonomyDictionary({ topics: topicSeeds, hubs: hubSeeds });

  const yt = createYouTubeClient({ apiKey: YOUTUBE_API_KEY });
  console.log(`\nFetching uploads for channel ${YOUTUBE_CHANNEL_ID}…`);
  const ids = await collectUploadIds(yt, YOUTUBE_CHANNEL_ID);
  console.log(`Found ${ids.length} uploads. Fetching details…`);
  const videos = await yt.getVideoDetails(ids);

  const now = new Date();
  const syncedDocs = videos.filter(v => v && v.id).map((v) => {
    const match = matchVideoTags(v.tags, dict);
    const existingDoc = existingDocsMap.get(videoDocId(v.id));
    return planVideoSync(v, match, existingDoc, now);
  });

  const syncedIds = new Set(syncedDocs.map(d => d._id));

  /*
    ─── RETIREMENT ────────────────────────────────────────────────────────

    Everything the API no longer returns used to be preserved verbatim,
    forever. That is half right: the never-delete contract exists so a bad
    API response cannot wipe the store, and it must stay. But "preserve the
    record" was implemented as "keep publishing it", and those are different
    things.

    The consequence, from a real incident: a livestream was captured while it
    was public, then set to private on YouTube, then deleted outright. The
    API stopped returning it at the first of those steps — and the site kept
    serving it through all three, because nothing here ever reconsiders a doc
    it can no longer see. Making a video private on YouTube had no effect on
    the site at all.

    A doc YouTube no longer returns is now RETIRED rather than republished:
    contentStatus moves off `published`, which is what every page filters on,
    so it leaves the site. The doc itself is kept, with its editorial fields
    and a timestamp, so this is reversible and auditable — if the video comes
    back (privacy flipped, a transient omission), the next sync re-syncs it
    and planVideoSync's existing "never demote a status a human set" rule is
    untouched.

    THE SAFETY FLOOR is the important part. A partial API response — a quota
    error mid-pagination, a transient outage — would otherwise retire the
    whole catalogue in one run. So retirement only happens when this run
    plausibly saw everything: it must have returned at least one video, and
    at least half of what we already knew about. Below that we assume the
    fetch is incomplete and preserve exactly as before, loudly.
  */
  const isYouTubeDoc = (d) =>
    d?.platform === 'youtube' || String(d?._id ?? '').startsWith('youtube-');

  const knownYouTubeDocs = Array.from(existingDocsMap.values()).filter(isYouTubeDoc);
  const fetchLooksComplete =
    syncedDocs.length > 0 &&
    (knownYouTubeDocs.length === 0 || syncedDocs.length >= knownYouTubeDocs.length * 0.5);

  const retired = [];
  const preservedDocs = Array.from(existingDocsMap.values())
    .filter((d) => !syncedIds.has(d._id))
    .map((d) => {
      // Only YouTube-sourced docs. Events, featured brands and topic seeds
      // are not in the API's answer and must never be touched by this.
      if (!fetchLooksComplete || !isYouTubeDoc(d)) return d;
      if (d.contentStatus !== 'published') return d;
      retired.push(d);
      return { ...d, contentStatus: 'retired', retiredAt: now.toISOString() };
    });

  if (!fetchLooksComplete && knownYouTubeDocs.length > 0) {
    console.warn(
      `\n[warn] Only ${syncedDocs.length} video(s) came back against ${knownYouTubeDocs.length} known — ` +
        'assuming an incomplete fetch and skipping retirement. Nothing was unpublished.'
    );
  }
  for (const d of retired) {
    console.log(`[retire] ${d._id} — "${d.title}" is no longer returned by YouTube (deleted, private or unlisted).`);
  }

  let docs = [...syncedDocs, ...preservedDocs];

  if (needsTopicBootstrap) {
    const bootstrapDocs = TIER1_TOPIC_SEEDS.map(t => ({
      _id: t._id,
      _type: 'topic',
      title: t.title,
      slug: { _type: 'slug', current: t.slug },
      isTier1Category: t.isTier1Category,
      youtubeSyncKeywords: [...t.keywords],
      emptyStateMessage: ''
    }));
    docs = [...docs, ...bootstrapDocs];
  }

  const needsReviewCount = syncedDocs.filter((d) => d.requiresReview).length;

    if (!execute) {
      console.log(`\n[dry-run] Would sync ${docs.length} docs (${syncedDocs.length} from YouTube, ${preservedDocs.length} preserved, ${retired.length} retired) to ${outPath}.`);
      console.log(`[dry-run] ${needsReviewCount} video(s) would need review (no Tier-1/hub tag match).`);
      console.log('[dry-run] Pass --execute to write.');
      return;
    }

    const tmpPath = `${outPath}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(docs, null, 2));
    fs.renameSync(tmpPath, outPath);
    console.log(`\n✔ Synced ${docs.length} videos locally to ${outPath}.`);
  });
}

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  run().catch((err) => {
    console.error('Sync failed:', err?.message || err);
    process.exit(1);
  });
}
