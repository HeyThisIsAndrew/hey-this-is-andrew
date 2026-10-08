/**
 * One-time Sanity migration script for leaked Shorts and Live Streams.
 *
 * Queries for all documents currently assigned `_type == "video"` that have
 * either `isShort == true` or `isLive == true`.
 * It executes a transactional delete and create to move them to their correct
 * document types (`short` or `live`) while preserving all editorial fields.
 *
 * Run:  node scripts/migrate-leaks.mjs          (Dry-run by default)
 *       node scripts/migrate-leaks.mjs --execute
 */
import { config } from 'dotenv';
import { createClient } from '@sanity/client';

config();

async function run() {
  const execute = process.argv.includes('--execute');
  const {
    SANITY_PROJECT_ID = '38nhxsib',
    SANITY_DATASET = 'production',
    SANITY_API_VERSION = '2024-03-01',
    SANITY_WRITE_TOKEN,
  } = process.env;

  if (execute && !SANITY_WRITE_TOKEN) {
    console.error('✖ --execute requires SANITY_WRITE_TOKEN.');
    process.exit(1);
  }

  const sanity = createClient({
    projectId: SANITY_PROJECT_ID,
    dataset: SANITY_DATASET,
    apiVersion: SANITY_API_VERSION,
    token: SANITY_WRITE_TOKEN,
    useCdn: false,
  });

  console.log('Querying for leaked documents...');
  
  // Find all leaked videos (where _type is video but they are actually shorts or live)
  const query = `*[_type == "video" && (isShort == true || isLive == true)]`;
  const leaks = await sanity.fetch(query);

  if (leaks.length === 0) {
    console.log('✔ No leaks found. All documents are correctly typed.');
    return;
  }

  console.log(`Found ${leaks.length} leaked documents. Planning migration...`);

  const plans = leaks.map((doc) => {
    const correctType = doc.isShort ? 'short' : 'live';
    return {
      _id: doc._id,
      oldType: doc._type,
      newType: correctType,
      fullNewDoc: { ...doc, _type: correctType },
      title: doc.title,
    };
  });

  for (const plan of plans) {
    console.log(`• ${plan._id}  ${(plan.title || '').slice(0, 56).padEnd(56)} ${plan.oldType} → ${plan.newType}`);
  }

  if (!execute) {
    console.log(`\nDRY RUN — ${plans.length} document(s) would be migrated. Re-run with --execute to commit changes.`);
    return;
  }

  const COMMIT_CHUNK = 50;
  let migrated = 0;

  for (let i = 0; i < plans.length; i += COMMIT_CHUNK) {
    const chunk = plans.slice(i, i + COMMIT_CHUNK);
    
    const deleteTx = sanity.transaction();
    for (const plan of chunk) {
      deleteTx.delete(plan._id);
    }
    await deleteTx.commit();

    const createTx = sanity.transaction();
    for (const plan of chunk) {
      createTx.create(plan.fullNewDoc);
    }
    await createTx.commit();
    
    migrated += chunk.length;
    console.log(`  …migrated ${migrated}/${plans.length}`);
  }

  console.log(`\n✔ Successfully migrated ${migrated} documents to their correct schemas.`);
}

run().catch((err) => {
  console.error('Migration failed:', err?.message || err);
  process.exit(1);
});
