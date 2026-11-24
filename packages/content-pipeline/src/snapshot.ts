/**
 * Durable JSON snapshot helpers for Substack articles.
 * Implements never-delete merging, editorial preservation, and atomic writes.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { ArticleRecord } from './substack/transform.ts';

/**
 * Merge freshly parsed records into an existing durable snapshot.
 *
 * - Never deletes records that have aged out of Substack's rolling feed.
 * - Matches by GUID first, then slug fallback, keeping original GUID stable.
 * - Preserves `firstSeen`, previously captured `bodyHtml`, and human `editorial` overrides.
 * - Keeps `lastUpdated` unchanged when content is identical to prevent redundant builds.
 */
export function mergeSnapshot(
  existing: ArticleRecord[],
  incoming: ArticleRecord[],
): { merged: ArticleRecord[]; added: number; updated: number } {
  const byGuid = new Map<string, ArticleRecord>();
  const bySlug = new Map<string, string>();

  for (const record of Array.isArray(existing) ? existing : []) {
    if (record?.guid) {
      byGuid.set(record.guid, record);
      if (record?.slug) bySlug.set(record.slug, record.guid);
    }
  }

  let added = 0;
  let updated = 0;

  for (const record of Array.isArray(incoming) ? incoming : []) {
    const priorGuid = byGuid.has(record.guid) ? record.guid : bySlug.get(record.slug ?? '');
    const prior = priorGuid ? byGuid.get(priorGuid) : null;

    if (!prior) {
      byGuid.set(record.guid, record);
      if (record?.slug) bySlug.set(record.slug, record.guid);
      added += 1;
      continue;
    }

    const next: ArticleRecord = {
      ...prior,
      ...record,
      guid: prior.guid,
      firstSeen: prior.firstSeen ?? record.firstSeen,
      bodyHtml:
        prior.hasBody && !record.hasBody ? prior.bodyHtml : record.bodyHtml || prior.bodyHtml,
      hasBody: record.hasBody || prior.hasBody,
      tags: record.tags || [],
      category: record.category || prior.category || '',
      contentType: record.contentType || prior.contentType || '',
      ...(prior.editorial ? { editorial: prior.editorial } : {}),
    };

    const stripUpdated = ({ lastUpdated: _lastUpdated, ...rest }: ArticleRecord) => rest;
    if (JSON.stringify(stripUpdated(prior)) === JSON.stringify(stripUpdated(next))) {
      byGuid.set(priorGuid!, prior);
    } else {
      byGuid.set(priorGuid!, next);
      updated += 1;
    }
  }

  return {
    merged: [...byGuid.values()].sort(
      (a, b) => new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime(),
    ),
    added,
    updated,
  };
}

/** Read an article snapshot JSON array from disk, returning `[]` if missing and filtering mock items. */
export function readSnapshot(snapshotFile: string): ArticleRecord[] {
  try {
    const raw = fs.readFileSync(snapshotFile, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) throw new Error('Article snapshot is not an array');
    return (parsed as ArticleRecord[]).filter((record) => !record?.isMock);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return [];
    throw error;
  }
}

/** Write records atomically via a temporary sibling file + rename. */
export function writeSnapshotAtomic(snapshotFile: string, records: ArticleRecord[]): void {
  fs.mkdirSync(path.dirname(snapshotFile), { recursive: true });
  const temporary = `${snapshotFile}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(records, null, 2)}\n`);
    fs.renameSync(temporary, snapshotFile);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}
