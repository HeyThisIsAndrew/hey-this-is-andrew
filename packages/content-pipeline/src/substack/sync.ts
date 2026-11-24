/**
 * Orchestrates Substack post fetching, sanitization/transformation, and atomic snapshot merging.
 * Dry-run by default (`execute: false`). Throws on fetch or parse failure while leaving any
 * existing snapshot untouched.
 */
import { withFileLock } from '../file-lock.ts';
import { mergeSnapshot, readSnapshot, writeSnapshotAtomic } from '../snapshot.ts';
import { fetchAllPosts, type FetchPostsResult, type SubstackSourceOptions } from './client.ts';
import {
  buildArticleRecord,
  parsePostsResponse,
  type ArticleRecord,
  type RawFeedItem,
  type TransformConfig,
} from './transform.ts';

export interface SkippedItem {
  index: number;
  title: string;
  reason: string;
}

export interface ArticleSyncPlan {
  merged: ArticleRecord[];
  added: number;
  updated: number;
  skipped: SkippedItem[];
  parsed: number;
}

export interface SyncSubstackConfig {
  publicationUrl: string;
  feedUrl?: string;
  relayUrl?: string;
  snapshotPath: string;
  transform?: TransformConfig;
  execute?: boolean;
  fetchPosts?: (opts: SubstackSourceOptions) => Promise<FetchPostsResult>;
  now?: Date;
  log?: Pick<Console, 'log' | 'warn' | 'error'>;
}

export interface SyncSubstackResult extends ArticleSyncPlan {
  source: string;
  pages: number;
  fetched: number;
  wrote: boolean;
}

/** Transform normalized feed items and plan a snapshot merge without writing to disk. */
export function planArticleSync(
  rawItems: RawFeedItem[],
  existing: ArticleRecord[] = [],
  now = new Date(),
  transformConfig: TransformConfig = {},
): ArticleSyncPlan {
  const records: ArticleRecord[] = [];
  const skipped: SkippedItem[] = [];

  for (const [index, raw] of rawItems.entries()) {
    let record: ArticleRecord | null = null;
    try {
      record = buildArticleRecord(raw, now, transformConfig);
    } catch (err: unknown) {
      skipped.push({
        index,
        title: raw?.title ?? '(untitled)',
        reason: err instanceof Error ? err.message : String(err),
      });
      continue;
    }
    if (!record) {
      skipped.push({
        index,
        title: raw?.title ?? '(untitled)',
        reason: 'missing title or guid/link',
      });
      continue;
    }
    records.push(record);
  }

  const { merged, added, updated } = mergeSnapshot(existing, records);
  return { merged, added, updated, skipped, parsed: records.length };
}

/** Fetch Substack posts, transform them, and merge into the durable JSON snapshot. */
export async function syncSubstackArticles(
  config: SyncSubstackConfig,
): Promise<SyncSubstackResult> {
  const {
    publicationUrl,
    feedUrl,
    relayUrl,
    snapshotPath,
    transform = {},
    execute = false,
    fetchPosts = fetchAllPosts,
    now = new Date(),
    log = console,
  } = config;

  const existing = readSnapshot(snapshotPath);
  log.log(`[articles] Snapshot holds ${existing.length} record(s).`);

  const { posts, pages, source } = await fetchPosts({
    publicationUrl,
    feedUrl,
    relayUrl,
  });

  const rawItems = parsePostsResponse(posts, publicationUrl);
  const plan = planArticleSync(rawItems, existing, now, transform);

  if (!plan.parsed || plan.skipped.length) {
    throw new Error(
      `Incomplete article sync: ${plan.parsed} parsed, ${plan.skipped.length} skipped; refusing to write`,
    );
  }

  log.log(
    `[articles] ${source} returned ${posts.length} post(s) across ${pages} page(s); ${plan.parsed} parsed cleanly.`,
  );
  log.log(
    `[articles] ${plan.added} new, ${plan.updated} updated, ${plan.merged.length} total after merge.`,
  );

  for (const record of plan.merged.filter((r) => !r.hasBody)) {
    log.warn(`[articles] No full body for "${record.title}"; its card links externally.`);
  }

  if (!execute) {
    log.log(`[dry-run] Nothing written. Pass --execute to write ${snapshotPath}.`);
    return { ...plan, source, pages, fetched: posts.length, wrote: false };
  }

  let wrote = false;
  let finalPlan = plan;

  await withFileLock(snapshotPath, async () => {
    const latest = readSnapshot(snapshotPath);
    finalPlan = planArticleSync(rawItems, latest, now, transform);
    if (JSON.stringify(latest) === JSON.stringify(finalPlan.merged)) {
      log.log('[articles] No content changes; snapshot left untouched.');
      return;
    }
    writeSnapshotAtomic(snapshotPath, finalPlan.merged);
    wrote = true;
    log.log(`[articles] ✓ Wrote ${finalPlan.merged.length} record(s) to ${snapshotPath}`);
  });

  return { ...finalPlan, source, pages, fetched: posts.length, wrote };
}
