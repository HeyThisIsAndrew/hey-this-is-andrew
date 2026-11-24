#!/usr/bin/env node
import path from 'node:path';
import { syncSubstackArticles } from '../src/substack/sync.ts';

function readArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  const prefixed = process.argv.find((a) => a.startsWith(`${flag}=`));
  return prefixed ? prefixed.slice(flag.length + 1) : undefined;
}

const publicationUrl = readArg('--pub') ?? process.env.SUBSTACK_PUBLICATION_URL;
const feedUrl = readArg('--feed') ?? process.env.SUBSTACK_FEED_URL;
const relayUrl = readArg('--relay') ?? process.env.SUBSTACK_RELAY_URL;
const out = readArg('--out') ?? path.resolve(process.cwd(), 'src/data/articles.json');
const timeZone = readArg('--timezone');
const execute = process.argv.includes('--execute');

if (!publicationUrl) {
  console.error(
    'Usage: sync-substack --pub <publicationUrl> [--feed <url>] [--relay <url>] [--out <snapshot.json>] [--timezone <iana>] [--execute]',
  );
  process.exit(1);
}

try {
  await syncSubstackArticles({
    publicationUrl,
    feedUrl,
    relayUrl,
    snapshotPath: path.resolve(process.cwd(), out),
    transform: timeZone ? { timeZone } : undefined,
    execute,
  });
} catch (err) {
  console.error(`[articles] ✗ SYNC FAILED: ${err instanceof Error ? err.message : String(err)}`);
  console.error('[articles] Snapshot left untouched.');
  process.exitCode = 1;
}
