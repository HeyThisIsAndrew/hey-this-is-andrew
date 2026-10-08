import { execSync } from 'child_process';
import fs from 'fs';

const isRemote = process.argv.includes('--remote');
const targetFlag = isRemote ? '--remote' : '--local';
const targetName = isRemote ? 'Production/Remote' : 'Local';

console.log(`Fetching ${targetName} KV keys for cleanup...`);
try {
  const keysJson = execSync(`npx wrangler kv key list --binding KV ${targetFlag}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
  const keys = JSON.parse(keysJson);

  const testKeys = keys
    .map(k => k.name)
    .filter(name => name.includes('e2e-test-') || name.includes('test@example.com') || name.includes('test@gmail.com'));

  if (testKeys.length === 0) {
    console.log(`No test emails found in ${targetName} KV.`);
    process.exit(0);
  }

  console.log(`Found ${testKeys.length} test emails. Running bulk delete...`);

  fs.writeFileSync('kv-delete-batch.json', JSON.stringify(testKeys, null, 2));

  // The yes pipeline skips the interactive prompt from wrangler
  execSync(`yes | npx wrangler kv bulk delete --binding KV kv-delete-batch.json ${targetFlag}`, { stdio: 'inherit' });
  console.log(`Successfully deleted ${testKeys.length} test emails from ${targetName} KV!`);
} catch (e) {
  console.error(`KV cleanup skipped or failed:`, e.message);
  if (isRemote) {
    console.error('\nNOTE: If you got an authentication error, run `npx wrangler login` first to authenticate with Cloudflare.');
  }
} finally {
  if (fs.existsSync('kv-delete-batch.json')) {
    fs.unlinkSync('kv-delete-batch.json');
  }
}
