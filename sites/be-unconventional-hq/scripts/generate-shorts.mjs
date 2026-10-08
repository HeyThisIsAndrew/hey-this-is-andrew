/**
 * Sanity → src/data/shorts.json generator (Discovery Row data, ticket #31).
 *
 * Queries PUBLISHED Shorts from Sanity, groups them into the site's category
 * pools via editorial topics, and writes the same file shape the hand-seeded
 * shorts.json used — so ShortsRow/CinematicShortCard need zero changes.
 *
 * Editorial gate: only contentStatus == "published" docs appear, same rule as
 * the site's video pages. Categories come from topics[] (editor-controlled),
 * not regex guessing.
 *
 * Run:  node scripts/generate-shorts.mjs          (writes src/data/shorts.json)
 *       node scripts/generate-shorts.mjs --check  (prints what would change, no write)
 *
 * Reads .env for SANITY_* overrides; public published docs need no token.
 * The builder is pure and exported for offline unit tests (no I/O on import).
 */
import { fileURLToPath } from 'node:url';
import { writeFile, readFile } from 'node:fs/promises';
import { config } from 'dotenv';
import { mapSanityVideo } from '../src/lib/videos.ts';

config();

/** Max cards kept per category — plenty for a 4-slot daily rotation. */
export const MAX_PER_CATEGORY = 12;

export const PUBLISHED_SHORTS_QUERY = `*[_type == "short" && contentStatus == "published"] | order(publishedAt desc){
  youtubeId, title, thumbnailUrl, durationSeconds, isShort, publishedAt, "topics": topics[]->slug.current, featured
}`;

/**
 * Pure: Sanity docs → the shorts.json shape. Grouping key is the mapped
 * CATEGORY, lowercased ("events", "games", …) — exactly what ShortsRow's
 * `category` prop looks up. Not the topic slug: a short tagged with the topic
 * `gaming` groups under `games`, because #146 renamed the category and left
 * the slug alone. Unmatched topics land under "general" so nothing
 * silently disappears; that pool just isn't rendered anywhere yet.
 */
export function buildShortsData(docs, now = new Date()) {
  const categories = {};
  for (const doc of docs ?? []) {
    const mapped = mapSanityVideo(doc);
    if (!mapped || !mapped.isShort) continue; // defensive: shorts only
    const key = (mapped.category || 'General').toLowerCase();
    categories[key] ??= [];
    if (categories[key].length >= MAX_PER_CATEGORY) continue;
    categories[key].push({
      id: mapped.youtubeId,
      title: mapped.title,
      thumbnailUrl: mapped.thumbnail,
      editorialTag: doc.topics?.[0] ?? undefined,
    });
  }
  return { lastUpdated: now.toISOString(), categories };
}

// ── Runner (only when invoked directly; imports stay I/O-free) ───────────────
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const { createClient } = await import('@sanity/client');
  const client = createClient({
    projectId: process.env.SANITY_PROJECT_ID ?? '38nhxsib',
    dataset: process.env.SANITY_DATASET ?? 'production',
    apiVersion: '2024-03-01',
    useCdn: false,
    token: process.env.SANITY_WRITE_TOKEN, // optional; public reads work without it
  });

  const OUT = new URL('../src/data/shorts.json', import.meta.url);
  const checkOnly = process.argv.includes('--check');

  let docs;
  try {
    docs = await client.fetch(PUBLISHED_SHORTS_QUERY);
  } catch (err) {
    console.error(`✖ Could not reach Sanity: ${err.message}`);
    console.error('  Check network access and SANITY_PROJECT_ID/SANITY_DATASET, then retry.');
    process.exit(1);
  }
  const data = buildShortsData(docs);
  const counts = Object.entries(data.categories)
    .map(([k, v]) => `${k}: ${v.length}`)
    .join(', ');
  console.log(`Fetched ${docs.length} published Shorts → pools { ${counts || 'none'} }`);

  if (docs.length === 0) {
    console.log('No published Shorts in Sanity yet — leaving the existing shorts.json untouched.');
    process.exit(0);
  }

  const next = JSON.stringify(data, null, 2) + '\n';
  const current = await readFile(OUT, 'utf-8').catch(() => '');
  if (next === current) {
    console.log('shorts.json already up to date.');
  } else if (checkOnly) {
    console.log('--check: shorts.json WOULD change (run without --check to write).');
  } else {
    await writeFile(OUT, next);
    console.log('Wrote src/data/shorts.json — commit the change to publish it.');
  }
}
