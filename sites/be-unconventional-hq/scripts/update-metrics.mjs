/**
 * Video metrics updater (epic #34, Mandate 3/5).
 *
 * For every published video, record today's view count into a bounded rolling
 * window on a companion `videoMetrics` document, then compute 7-day view
 * velocity (views gained over the trailing week). The Essential-5 shelf (T7)
 * orders by this velocity — computed here, written to Sanity, queried
 * statically by Astro, so the YouTube API is NEVER hit at render time.
 *
 * v1 uses view-count DELTAS from data the sync already stores — no Analytics
 * OAuth. Single-writer (only this script touches videoMetrics), idempotent by
 * date, bounded window — no races, no document bloat.
 *
 * Run:  node scripts/update-metrics.mjs           (writes)
 *       node scripts/update-metrics.mjs --dry-run  (prints, no writes)
 *
 * The pure functions are exported for offline tests; importing does no I/O.
 */
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

config();

export const MAX_SNAPSHOTS = 14;
export const VELOCITY_WINDOW_DAYS = 7;

/** Deterministic Sanity _id for a video's metrics doc. */
export function metricsDocId(youtubeId) {
  return `metrics-${youtubeId}`;
}

const DAY_MS = 86_400_000;
const toMs = (ymd) => Date.parse(`${ymd}T00:00:00Z`);

/**
 * Append (or update) a daily snapshot. Idempotent by date — re-running the
 * same day overwrites that day's count (latest wins) instead of duplicating.
 * Keeps the list sorted ascending and trimmed to the last MAX_SNAPSHOTS.
 */
export function appendSnapshot(snapshots, date, viewCount, maxLen = MAX_SNAPSHOTS) {
  const rest = (snapshots ?? []).filter((s) => s.date !== date);
  const next = [...rest, { date, viewCount }].sort((a, b) => a.date.localeCompare(b.date));
  return next.slice(-maxLen);
}

/**
 * Views gained over the trailing VELOCITY_WINDOW_DAYS. Baseline = the earliest
 * snapshot on/after (latest date − window); velocity = latest − baseline view
 * count. One snapshot (or all inside one day) → 0. Clamped at 0 to ignore any
 * count corrections that would read as negative.
 */
export function computeVelocity7d(snapshots, windowDays = VELOCITY_WINDOW_DAYS) {
  const sorted = [...(snapshots ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) return 0;
  const latest = sorted[sorted.length - 1];
  const cutoff = toMs(latest.date) - windowDays * DAY_MS;
  const baseline = sorted.find((s) => toMs(s.date) >= cutoff) ?? sorted[0];
  if (baseline === latest) return 0;
  return Math.max(0, (latest.viewCount ?? 0) - (baseline.viewCount ?? 0));
}

/**
 * Plan the metrics upsert for one video given its current view count and the
 * existing metrics doc (or null). Pure — returned as data for tests.
 */
export function planMetricsUpdate(youtubeId, viewCount, existing, todayYmd, now = new Date()) {
  const snapshots = appendSnapshot(existing?.snapshots, todayYmd, viewCount);
  return {
    _id: metricsDocId(youtubeId),
    createIfNotExists: { _id: metricsDocId(youtubeId), _type: 'videoMetrics', youtubeId },
    patch: {
      set: {
        youtubeId,
        snapshots,
        viewVelocity7d: computeVelocity7d(snapshots),
        lastComputedAt: now.toISOString(),
      },
    },
  };
}

// ── Runner ───────────────────────────────────────────────────────────────────

const COMMIT_CHUNK = 100;

export async function run() {
  const dryRun = process.argv.includes('--dry-run');
  const {
    SANITY_PROJECT_ID = '38nhxsib',
    SANITY_DATASET = 'production',
    SANITY_API_VERSION = '2024-03-01',
    SANITY_WRITE_TOKEN,
  } = process.env;

  if (!dryRun && !SANITY_WRITE_TOKEN) {
    console.error('✖ Writing requires SANITY_WRITE_TOKEN (or pass --dry-run).');
    process.exit(1);
  }

  const { createClient } = await import('@sanity/client');
  const sanity = createClient({
    projectId: SANITY_PROJECT_ID,
    dataset: SANITY_DATASET,
    apiVersion: SANITY_API_VERSION,
    token: SANITY_WRITE_TOKEN,
    useCdn: false,
  });

  // Brand-timezone calendar day, matching the rest of the platform's dates.
  const todayYmd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const [videos, metricsDocs] = await Promise.all([
    sanity.fetch(`*[_type == "video" && defined(youtubeId)]{youtubeId, viewCount}`),
    sanity.fetch(`*[_type == "videoMetrics"]{_id, youtubeId, snapshots}`),
  ]);
  const byId = new Map(metricsDocs.map((m) => [m.youtubeId, m]));
  console.log(`${videos.length} video(s); ${metricsDocs.length} existing metrics doc(s). Day: ${todayYmd}`);

  const now = new Date();
  const plans = videos
    .filter((v) => typeof v.viewCount === 'number')
    .map((v) => {
      const plan = planMetricsUpdate(v.youtubeId, v.viewCount, byId.get(v.youtubeId) ?? null, todayYmd, now);
      console.log(`• ${v.youtubeId}  views ${v.viewCount}  velocity/7d ${plan.patch.set.viewVelocity7d}`);
      return plan;
    });

  if (dryRun) {
    console.log(`\nDRY RUN — ${plans.length} metrics doc(s) would be upserted.`);
    return;
  }

  let written = 0;
  for (let i = 0; i < plans.length; i += COMMIT_CHUNK) {
    const tx = sanity.transaction();
    for (const plan of plans.slice(i, i + COMMIT_CHUNK)) {
      tx.createIfNotExists(plan.createIfNotExists);
      tx.patch(plan._id, { set: plan.patch.set });
    }
    await tx.commit();
    written += Math.min(COMMIT_CHUNK, plans.length - i);
    console.log(`  …committed ${written}/${plans.length}`);
  }
  console.log(`\n✔ Updated ${written} metrics doc(s).`);
}

import fs from 'node:fs';
import path from 'node:path';
import { withFileLock } from './file-lock.mjs';

async function runLocal() {
  const dryRun = process.argv.includes('--dry-run');
  const videosPath = path.resolve(fileURLToPath(import.meta.url), '../../src/data/videos.json');
  
  await withFileLock(videosPath, async () => {
    // Read local JSON
    let videosData;
    try {
      videosData = JSON.parse(fs.readFileSync(videosPath, 'utf8'));
    } catch (e) {
      throw new Error('Failed to parse videos.json: ' + e.message);
    }
    const videos = videosData.filter(d => d._type === 'video');
    
    const todayYmd = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    console.log(`${videos.length} video(s) found in local JSON. Day: ${todayYmd}`);

    const now = new Date();
    let updatedCount = 0;

    for (const v of videos) {
      if (typeof v.viewCount !== 'number') continue;
      
      // Existing metrics (if any) are stored on the doc itself now
      const existing = v.metrics ? { snapshots: v.metrics.snapshots } : null;
      const plan = planMetricsUpdate(v.youtubeId, v.viewCount, existing, todayYmd, now);
      
      // Assign new metrics directly to the document
      v.metrics = {
        snapshots: plan.patch.set.snapshots,
        viewVelocity7d: plan.patch.set.viewVelocity7d,
        lastComputedAt: plan.patch.set.lastComputedAt,
      };
      
      console.log(`• ${v.youtubeId}  views ${v.viewCount}  velocity/7d ${v.metrics.viewVelocity7d}`);
      updatedCount++;
    }

    if (dryRun) {
      console.log(`\nDRY RUN — ${updatedCount} local metrics doc(s) would be updated.`);
      return;
    }

    // Write back to videos.json atomically
    const tmpPath = `${videosPath}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(videosData, null, 2));
    fs.renameSync(tmpPath, videosPath);
    console.log(`\n✔ Updated ${updatedCount} metrics directly in videos.json.`);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  // Use runLocal by default for the new local-cms paradigm.
  // The Sanity run() function is preserved above for fallback/parity reference.
  runLocal().catch((err) => {
    console.error('Metrics update failed:', err?.message || err);
    process.exit(1);
  });
}
