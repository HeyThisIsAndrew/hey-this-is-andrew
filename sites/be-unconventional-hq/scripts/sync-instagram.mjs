/**
 * Instagram → Local JSON ingestion sync
 *
 * Pulls the linked Instagram Professional account's media from the Meta Graph API
 * and saves it to src/data/instagram.json for build-time generation.
 *
 * Dry-run by default; pass --execute to write src/data/instagram.json.
 */
import fs from 'node:fs/promises';
import sharp from 'sharp';

/*
  ─── WHY THIS DOWNLOADS THE MEDIA INSTEAD OF STORING ITS URL ────────────────

  Instagram's CDN URLs are SIGNED AND TIME-LIMITED. The `oe=` query parameter
  is a hex expiry timestamp, typically two to three days out. This script used
  to write those URLs straight into src/data/instagram.json, which meant the
  entire feed went dead a few days after every sync, no matter what any code
  did with it.

  That is not a hypothetical. It was reported from production with a
  screenshot of the rail showing nothing but broken images, and measured on
  the spot: 188 of 188 stored URLs had already expired, the last of them
  earlier the same morning. Nothing in the site was broken — the data had
  simply rotted on schedule, as it always would.

  So the media is fetched ONCE, here, and written to public/instagram/. Those
  files never expire, are served from our own origin, and remove the
  /api/proxy round trip on every tile.

  ADDITIVE ON PURPOSE. Each item keeps its original `displayUrl` and gains a
  `localImage` only when the download succeeded. The components prefer
  `localImage` and fall back to `displayUrl`, so a sync that partially fails —
  or a checkout where this has never been run — behaves exactly as before
  rather than rendering nothing.
*/
const MEDIA_DIR = new URL('../public/instagram/', import.meta.url);
const MEDIA_PUBLIC_PATH = '/instagram';

/*
  ─── EVERY STORED IMAGE IS A RESIZED WEBP ───────────────────────────────────

  Instagram serves originals: 1080x1920, 1290x2294, whatever was uploaded.
  The tile renders at 220x275 CSS pixels. Storing the original meant shipping
  roughly ten times the pixels the page can use, and committing them: 50 posts
  came to 8.5 MB in the repository, averaging 174 KB each, and the homepage's
  two largest resources were both Instagram photos at 94 KB and 76 KB.

  So each image is resized to 440px wide — 2x the tile's 220px, which covers
  retina — and encoded as WebP. Measured over five real files from the feed:
  932 KB became 164 KB, an 82% reduction, and 8.5 MB extrapolates to ~1.5 MB.

  `withoutEnlargement` so a small original is never upscaled into a bigger
  file than it started as.

  NOT cropped to the tile's exact 4:5. The browser already crops with
  `object-fit`, and baking a crop in here would silently mangle every stored
  image the day the tile's aspect ratio changes. Resizing by width alone keeps
  the whole picture and still removes the overwhelming majority of the bytes.

  A failed conversion falls back to storing the original bytes rather than
  losing the image — a big file renders, a missing one does not.
*/
const TARGET_WIDTH = 440;
const WEBP_QUALITY = 82;
const STORED_EXTENSION = '.webp';

async function toStoredFormat(buffer, id) {
  try {
    return await sharp(buffer)
      .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
  } catch (err) {
    console.warn(
      `[instagram]   ! ${id}: could not resize (${err.message}), storing the original`
    );
    return buffer;
  }
}

/**
 * Download one media URL into public/instagram/.
 * Returns the public path, or null if anything went wrong — callers keep the
 * remote URL in that case rather than losing the item.
 */
async function downloadMedia(url, id, existingByIchId, forceRefresh = false) {
  if (!url) return null;

  /*
    ALREADY HAVE IT? DON'T REFETCH — UNLESS ASKED TO.

    At four scheduled runs a day, refetching all 50 covers every time is 200
    needless downloads daily, so the default is to keep what is on disk and
    let only the URL signature rotate.

    ─── THE ASSUMPTION THIS USED TO MAKE, AND WHY IT WAS WRONG ───────────────

    The original note here claimed "the media for a given post id never
    changes — Instagram does not let you swap the photo on a published post."
    That is true of a photo post and FALSE of a reel: the cover can be changed
    after publishing, and the owner did exactly that after a reel published
    without one and stored as a 894-byte near-black frame (640x1136, mean
    brightness 2/255). Updating the cover on Instagram changed nothing on the
    site, because this shortcut never looked again.

    Comparing URLs cannot detect it — Instagram re-signs them every fetch, so
    they always differ — and comparing content would mean downloading, which
    is the cost the shortcut exists to avoid. So the escape hatch is explicit:
    `--refresh-media` refetches everything, for the run where a cover changed.
  */
  const existing = forceRefresh ? undefined : existingByIchId?.get(String(id));
  /* Only skip a file already in the CURRENT stored format. Anything else is
     from before images were resized, and must be refetched so it is not left
     as a full-size original forever. */
  if (existing && existing.endsWith(STORED_EXTENSION)) {
    return `${MEDIA_PUBLIC_PATH}/${existing}`;
  }
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) {
      console.warn(`[instagram]   ! ${id}: media fetch returned ${res.status}, keeping remote URL`);
      return null;
    }
    const original = Buffer.from(await res.arrayBuffer());
    if (original.length === 0) {
      console.warn(`[instagram]   ! ${id}: empty body, keeping remote URL`);
      return null;
    }

    const stored = await toStoredFormat(original, id);
    /* The Graph API id is opaque and unique, so it is a safe filename. */
    const filename = `${String(id).replace(/[^a-zA-Z0-9_-]/g, '')}${STORED_EXTENSION}`;
    await fs.writeFile(new URL(filename, MEDIA_DIR), stored);
    return `${MEDIA_PUBLIC_PATH}/${filename}`;
  } catch (err) {
    console.warn(`[instagram]   ! ${id}: download failed (${err.message}), keeping remote URL`);
    return null;
  }
}

/**
 * Delete downloaded images no longer referenced by the feed.
 *
 * The sync keeps the latest 50 posts, so every run pushes older ones out of
 * the window. Without this the folder only ever grows — and since a workflow
 * now runs this daily and COMMITS the result, that growth would be permanent
 * repository weight for images nothing renders.
 *
 * Deliberately conservative: it only ever removes files inside
 * public/instagram/, only ones absent from the set just written, and it is
 * unreachable on a dry run because the only caller is localiseMedia(), which
 * itself only runs under --execute. A delete failure is logged and ignored —
 * an orphaned file is clutter, not a broken feed, and is not worth failing a
 * sync over.
 */
async function pruneOrphanedMedia(items) {
  /* One file per post — the cover. Carousel slides are not downloaded, so
     anything on disk that is not a current post's cover is an orphan from a
     previous run or from the revision that did download slides. */
  const keep = new Set(
    items
      .map((item) => item.localImage)
      .filter(Boolean)
      .map((p) => p.slice(`${MEDIA_PUBLIC_PATH}/`.length))
  );

  let removed = 0;
  let existing;
  try {
    existing = await fs.readdir(MEDIA_DIR);
  } catch {
    return; // nothing downloaded yet
  }

  for (const filename of existing) {
    if (keep.has(filename)) continue;
    try {
      await fs.unlink(new URL(filename, MEDIA_DIR));
      removed++;
    } catch (err) {
      console.warn(`[instagram]   ! could not remove orphan ${filename}: ${err.message}`);
    }
  }

  if (removed > 0) {
    console.log(`[instagram] Pruned ${removed} image(s) no longer in the feed.`);
  }
}

/**
 * Fetch every item's display image to disk and attach `localImage`.
 * Sequential on purpose: 50 items is small, and hammering the CDN in parallel
 * is a good way to get rate-limited mid-sync and end up with a half-downloaded
 * feed.
 */
async function localiseMedia(items, forceRefresh = false) {
  await fs.mkdir(MEDIA_DIR, { recursive: true });

  if (forceRefresh) {
    console.log(
      '[instagram] --refresh-media: refetching every cover, ignoring what is ' +
        'already on disk (use this when a reel cover changed).'
    );
  }

  /* id -> filename for everything already downloaded, read once rather than
     stat-ing per item. */
  const existingByIchId = new Map();
  for (const filename of await fs.readdir(MEDIA_DIR).catch(() => [])) {
    const id = filename.replace(/\.[^.]+$/, '');
    existingByIchId.set(id, filename);
  }

  let ok = 0;
  let total = 0;
  let fetched = 0;
  for (const item of items) {
    total++;
    const had = existingByIchId.has(String(item.id));
    const local = await downloadMedia(item.displayUrl, item.id, existingByIchId, forceRefresh);
    if (local && (!had || forceRefresh)) fetched++;
    if (local) {
      item.localImage = local;
      ok++;
    }

    /*
      ONLY THE POST'S COVER. Carousel slides are deliberately NOT downloaded.

      An earlier revision fetched every child thumbnail, because the gallery
      unpacked albums into one tile per slide. It no longer does — a post is
      one tile, showing its cover (see getGalleryPosts in src/lib/instagram.ts
      for why: a single ten-image post would otherwise fill the entire row).

      Downloading the slides would mean committing 106 files instead of 50 for
      this feed, every one of them for an image nothing renders.
    */
  }
  console.log(
    `[instagram] ${ok}/${total} post images available in public/instagram/ ` +
      `(${fetched} newly downloaded, ${ok - fetched} already present)`
  );
  await pruneOrphanedMedia(items);
  if (ok < total) {
    console.warn(
      `[instagram] ${total - ok} image(s) kept their expiring remote URL and ` +
        `will break when it lapses. Re-run the sync to retry them.`
    );
  }
  return items;
}

/*
  ─── DO NOT REWRITE THE FILE FOR A CHANGED SIGNATURE ────────────────────────

  Instagram re-signs its CDN URLs on every fetch, so `displayUrl` differs on
  every single sync even when the post, its caption and its image are all
  identical. Writing that back means a commit, and a commit means a Cloudflare
  rebuild — four times a day, for nothing.

  The signature lives entirely in the query string, and none of it is content.
  So the comparison is made against a normalised copy with query strings
  dropped, and the file is only written when something real changed: a new
  post, an edited caption, a post deleted.

  The URLs are still STORED with their query strings — they remain the
  fallback for an item whose download failed, and a signed URL without its
  signature is useless. Only the CHANGE DETECTION ignores them.
*/
function stableShape(items) {
  return JSON.stringify(items, (_key, value) =>
    typeof value === 'string' && value.startsWith('https://')
      ? value.split('?')[0]
      : value
  );
}

async function fetchInstagramMedia() {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    /*
      SKIP, LOUDLY — do not throw.

      This used to be a hard error, which is right for `npm run sync:instagram`
      run deliberately and wrong for everything else. An unconfigured Instagram
      sync must never take a working YouTube sync down with it, and it did:
      the 2026-08-14 scheduled run finished the YouTube half and then failed
      the job on this path.

      Returning null (rather than an empty array) lets the caller tell "not
      configured, leave the data alone" apart from "configured, and the account
      genuinely has no media" — the second would otherwise blank
      src/data/instagram.json, which is exactly the never-delete contract the
      articles sync documents.
    */
    console.warn(
      '[instagram] META_ACCESS_TOKEN not set — skipping the Instagram sync.\n' +
        '[instagram] src/data/instagram.json is left untouched. Set the token in\n' +
        '[instagram] .env (local) or as a repository secret (CI) to enable it.'
    );
    return null;
  }

  // 1. Get the Facebook Page linked to this account
  const pageRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${token}`, { signal: AbortSignal.timeout(15000) });
  if (!pageRes.ok) throw new Error(`Failed to fetch pages: ${pageRes.statusText}`);
  const pageData = await pageRes.json();
  
  if (!pageData.data || pageData.data.length === 0) {
    throw new Error('No Facebook Pages found for this Meta token.');
  }
  
  const page = pageData.data[0];
  const pageToken = page.access_token;
  console.log(`[instagram] Found Page: ${page.name}`);

  // 2. Get the linked Instagram Business Account
  const igRes = await fetch(`https://graph.facebook.com/v19.0/${page.id}?fields=instagram_business_account&access_token=${pageToken}`, { signal: AbortSignal.timeout(15000) });
  if (!igRes.ok) throw new Error(`Failed to fetch Instagram account: ${igRes.statusText}`);
  const igData = await igRes.json();
  
  if (!igData.instagram_business_account) {
    throw new Error('No Instagram Business Account linked to this Facebook Page.');
  }
  const igId = igData.instagram_business_account.id;
  console.log(`[instagram] Found linked IG Account: ${igId}`);

  /*
    3. Fetch the latest media (limit 50 to keep the build fast and the payload
       small).

    ─── `is_shared_to_feed` IS THE WHOLE POINT OF THE EXTRA FIELDS ────────────

    The brief: "if it's not present on my feed then it should not appear" in
    the homepage carousel. Nothing already stored can answer that — every reel
    has a `/reel/` permalink and `media_type: VIDEO` whether or not it is on
    the profile grid, so the two cases are indistinguishable in the old shape.

    The Graph API answers it directly. For a reel, `is_shared_to_feed` is true
    when it appears in BOTH the Feed and Reels tabs, and false when it lives
    in the Reels tab only — which is exactly the distinction being asked for.
    `media_product_type` (FEED | REELS | AD | STORY) is stored alongside it as
    the corroborating signal, and because it makes a surprising feed
    diagnosable without another API round trip.

    ─── AND WHY THE REQUEST IS TRIED TWICE ───────────────────────────────────

    Field availability varies by account type and API version, and an
    unrecognised field is a 400 for the WHOLE request — not a null column. So
    a rejected field here would take down a sync that was working fine, on a
    schedule, for a feature that is only an enhancement. The retry drops the
    optional fields and carries on with exactly the old behaviour: no
    `isSharedToFeed` recorded, so nothing gets filtered, so the carousel keeps
    rendering what it renders today. Degrade, never fail.
  */
  const BASE_FIELDS =
    'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,' +
    'children{id,media_type,media_url,thumbnail_url}';
  const OPTIONAL_FIELDS = 'is_shared_to_feed,media_product_type';

  const mediaUrl = (fields) =>
    `https://graph.facebook.com/v19.0/${igId}/media?fields=${fields}&limit=50&access_token=${pageToken}`;

  let mediaRes = await fetch(mediaUrl(`${BASE_FIELDS},${OPTIONAL_FIELDS}`), { signal: AbortSignal.timeout(15000) });
  if (!mediaRes.ok) {
    console.warn(
      `[instagram] ! media request with feed-visibility fields returned ` +
        `${mediaRes.status} ${mediaRes.statusText}. Retrying without them — ` +
        `posts will not be filtered by feed visibility this run.`
    );
    mediaRes = await fetch(mediaUrl(BASE_FIELDS), { signal: AbortSignal.timeout(15000) });
  }
  if (!mediaRes.ok) throw new Error(`Failed to fetch media: ${mediaRes.statusText}`);
  const mediaData = await mediaRes.json();

  if (!Array.isArray(mediaData.data)) return [];

  return mediaData.data.reduce((acc, item) => {
    if (!item || (!item.media_url && !item.thumbnail_url)) return acc;

    // Normalization: Ensure we always have a display URL.
    // Video items return thumbnail_url, Images return media_url.
    const displayUrl = item.thumbnail_url || item.media_url;
    
    // Process Carousel Children safely
    const children = Array.isArray(item.children?.data) 
      ? item.children.data.reduce((childAcc, child) => {
          if (!child || (!child.media_url && !child.thumbnail_url)) return childAcc;
          childAcc.push({
            id: child.id,
            mediaType: child.media_type,
            url: child.media_url,
            thumbnailUrl: child.thumbnail_url || child.media_url,
          });
          return childAcc;
        }, [])
      : [];

    acc.push({
      id: item.id,
      caption: item.caption || '',
      mediaType: item.media_type,
      displayUrl,
      videoUrl: item.media_type === 'VIDEO' ? item.media_url : undefined,
      permalink: item.permalink,
      timestamp: item.timestamp,
      /*
        Recorded ONLY when the API actually said so. `undefined` (the field was
        not returned, or the retry above dropped it) must stay distinguishable
        from an explicit `false`: the gallery hides false and keeps unknown, so
        conflating them would silently empty the rail.
      */
      isSharedToFeed:
        typeof item.is_shared_to_feed === 'boolean' ? item.is_shared_to_feed : undefined,
      mediaProductType: item.media_product_type || undefined,
      children,
    });
    return acc;
  }, []);
}

async function run() {
  const isExecute = process.argv.includes('--execute');
  /* Refetch covers already on disk. Off by default — see downloadMedia(). */
  const forceRefresh = process.argv.includes('--refresh-media');
  const outPath = new URL('../src/data/instagram.json', import.meta.url);

  try {
    const media = await fetchInstagramMedia();

    /* null means "not configured" — distinct from an empty array, which would
       mean the account really has no media. Neither should ever blank the
       existing data, but only the first is a clean, expected exit. */
    if (media === null) {
      console.log('[instagram] Skipped (no credentials). Nothing written.');
      return;
    }

    console.log(`[instagram] Fetched ${media.length} media items.`);

    /*
      Say out loud how many posts the carousel will hide, and why. This filter
      is applied at RENDER time from stored data, so without this line the
      first sync that returns `is_shared_to_feed` could quietly remove most of
      the homepage rail and the only evidence would be the diff.
    */
    const hidden = media.filter((m) => m.isSharedToFeed === false).length;
    const unknown = media.filter((m) => m.isSharedToFeed === undefined).length;
    console.log(
      `[instagram] Feed visibility: ${media.length - hidden - unknown} shared to feed, ` +
        `${hidden} reels-tab only (will be hidden from the carousel), ` +
        `${unknown} not reported by the API (kept — see getGalleryPosts).`
    );
    if (hidden > 0 && hidden === media.length) {
      console.warn(
        '[instagram] ! EVERY post reports is_shared_to_feed=false. The carousel ' +
          'falls back to showing all posts rather than rendering an empty row — ' +
          'check the account type before trusting this field.'
      );
    }

    if (media.length === 0) {
      console.warn(
        '[instagram] The API returned zero items. Refusing to overwrite\n' +
          '[instagram] src/data/instagram.json with an empty feed — that is far more\n' +
          '[instagram] likely to be a bad token or a rate limit than a genuinely empty\n' +
          '[instagram] account. Nothing written.'
      );
      return;
    }

    if (isExecute) {
      /* Download BEFORE writing the JSON: the file should never claim a
         `localImage` that is not on disk. */
      await localiseMedia(media, forceRefresh);

      /* Only write when something other than a URL signature moved — see
         stableShape() above. */
      let previous = null;
      try {
        previous = JSON.parse(await fs.readFile(outPath, 'utf8'));
      } catch {
        /* first run, or unreadable — fall through and write */
      }

      if (previous && stableShape(previous) === stableShape(media)) {
        console.log(
          `[instagram] No content change (only URL signatures moved). ` +
            `Leaving src/data/instagram.json untouched so this does not ` +
            `trigger a rebuild.`
        );
        return;
      }

      await fs.writeFile(outPath, JSON.stringify(media, null, 2));
      console.log(`[instagram] ✓ Wrote to src/data/instagram.json`);
      console.log(`[instagram]   Remember to commit public/instagram/ along with it.`);
    } else {
      console.log(
        `[dry-run] Nothing written and nothing downloaded. Pass --execute to write ` +
          `src/data/instagram.json and populate public/instagram/.`
      );
    }
  } catch (err) {
    console.error('[instagram] ❌ Sync failed:', err.message);
    process.exit(1);
  }
}

// Support running directly via Node
if (import.meta.url.startsWith('file:') && process.argv[1] === new URL(import.meta.url).pathname) {
  run();
}
