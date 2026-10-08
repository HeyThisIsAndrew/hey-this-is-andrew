/**
 * Migration: event `datetime` fields -> `date`, plus location/status backfill.
 *
 * Rewrites existing `event` documents to match the refactored schema:
 *   - startDate / endDate : "2026-07-22T00:00:00Z" -> "2026-07-22"
 *   - location (string)   -> { city, region? }  (best-effort; refine in Studio)
 *   - status (missing)    -> "scheduled"
 *
 * SAFETY
 *   - Dry-run by default. Prints planned patches, writes NOTHING.
 *     Pass --execute to actually apply them.
 *   - Idempotent. Re-running after a successful run is a no-op.
 *   - Requires a write token in SANITY_WRITE_TOKEN. Read-only fetch needs no
 *     token, but applying patches does.
 *
 * USAGE
 *   node scripts/migrations/2026-event-dates-to-date.mjs            # dry run
 *   SANITY_WRITE_TOKEN=sk... node scripts/migrations/2026-event-dates-to-date.mjs --execute
 *
 * The transform functions are exported and pure so they can be unit-tested
 * without any network access. The runner at the bottom only executes when this
 * file is invoked directly (not when imported), the same guard pattern as
 * Python's `if __name__ == "__main__":`.
 */
import { fileURLToPath } from 'node:url';
import { createClient } from '@sanity/client';

// ── Pure transforms (unit-testable, no I/O) ──────────────────────────────────

/**
 * "2026-07-22T00:00:00Z" -> "2026-07-22".
 * Idempotent: an already-date string returns itself. Non-strings pass through.
 */
export function toDateString(value) {
  if (typeof value !== 'string' || value.length < 10) return value;
  return value.slice(0, 10);
}

/**
 * Legacy string location -> structured object. Best-effort split on the first
 * comma ("San Diego, CA" -> { city: "San Diego", region: "CA" }). An empty
 * string becomes undefined (the caller unsets it). Objects pass through.
 */
export function parseLocation(value) {
  if (value == null || typeof value === 'object') return value;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const [city, ...rest] = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  const region = rest.join(', ');
  return region ? { city, region } : { city };
}

/**
 * Given an event document, return { set, unset } describing the minimal change
 * needed. Empty set + empty unset means the doc is already migrated.
 */
export function planEventMigration(doc) {
  const set = {};
  const unset = [];

  const start = toDateString(doc.startDate);
  if (start !== doc.startDate) set.startDate = start;

  if (doc.endDate) {
    const end = toDateString(doc.endDate);
    if (end !== doc.endDate) set.endDate = end;
  }

  if (typeof doc.location === 'string') {
    const parsed = parseLocation(doc.location);
    if (parsed) set.location = parsed;
    else unset.push('location');
  }

  if (!doc.status) set.status = 'scheduled';

  return { set, unset };
}

// ── Network runner (only runs when invoked directly) ─────────────────────────

async function run() {
  const execute = process.argv.includes('--execute');
  const token = process.env.SANITY_WRITE_TOKEN;

  if (execute && !token) {
    console.error('✖ --execute requires SANITY_WRITE_TOKEN in the environment.');
    process.exit(1);
  }

  const client = createClient({
    projectId: '38nhxsib',
    dataset: 'production',
    apiVersion: '2024-03-01',
    token, // undefined is fine for the read-only dry run
    useCdn: false, // never migrate off a cached view of the data
  });

  const events = await client.fetch('*[_type == "event"]{ _id, title, startDate, endDate, location, status }');
  console.log(`Found ${events.length} event document(s).\n`);

  const tx = client.transaction();
  let changed = 0;

  for (const doc of events) {
    const { set, unset } = planEventMigration(doc);
    const hasChange = Object.keys(set).length > 0 || unset.length > 0;
    if (!hasChange) {
      console.log(`• ${doc.title || doc._id}: already migrated, skipping.`);
      continue;
    }
    changed++;
    console.log(`• ${doc.title || doc._id}:`);
    if (Object.keys(set).length) console.log(`    set  : ${JSON.stringify(set)}`);
    if (unset.length) console.log(`    unset: ${JSON.stringify(unset)}`);

    if (execute) {
      let patch = client.patch(doc._id);
      if (Object.keys(set).length) patch = patch.set(set);
      if (unset.length) patch = patch.unset(unset);
      tx.patch(patch);
    }
  }

  console.log(`\n${changed} document(s) need changes.`);
  if (!execute) {
    console.log('DRY RUN — nothing was written. Re-run with --execute to apply.');
    return;
  }
  if (changed === 0) {
    console.log('Nothing to write.');
    return;
  }
  await tx.commit();
  console.log('✔ Migration committed.');
}

// Python's `if __name__ == "__main__":` — only run when executed directly.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  run().catch((err) => {
    console.error('Migration failed:', err.message);
    process.exit(1);
  });
}
