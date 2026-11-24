/**
 * Build responsive local WebP renditions ahead of time for unoptimized Substack article images.
 * Skips URLs already on `substackcdn.com`, resizes via `sharp` without enlargement,
 * and merges entries into a persistent manifest without truncating on partial failures.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { ALREADY_OPTIMISED } from '../substack/images-transform.ts';
import type { ArticleRecord } from '../substack/transform.ts';

export interface OptimizeImagesConfig {
  articlesPath: string;
  manifestPath: string;
  mediaDir: string;
  mediaPublicPath?: string;
  widths?: number[];
  srcWidth?: number;
  webpQuality?: number;
  execute?: boolean;
  forceRefresh?: boolean;
  fetchImpl?: typeof fetch;
  log?: Pick<Console, 'log' | 'warn' | 'error'>;
}

export interface OptimizeImagesResult {
  articlesCount: number;
  urlsCount: number;
  built: number;
  reused: number;
  skipped: number;
  pruned: number;
  totalBytes: number;
  wroteManifest: boolean;
}

const DEFAULT_WIDTHS = [480, 720, 1080, 1440];
const DEFAULT_SRC_WIDTH = 720;
const DEFAULT_WEBP_QUALITY = 80;

function keyFor(url: string): string {
  return crypto.createHash('sha256').update(url).digest('hex').slice(0, 16);
}

/** Collect every unoptimized HTTP(S) image URL referenced by article covers and body HTML. */
export function collectSourceUrls(articles: ArticleRecord[]): string[] {
  const urls = new Set<string>();
  for (const article of articles) {
    if (article?.image) urls.add(String(article.image));
    for (const tag of String(article?.bodyHtml ?? '').match(/<img\b[^>]*>/gi) || []) {
      const src = tag.match(/\ssrc=["']([^"']+)["']/i)?.[1];
      if (src) urls.add(src);
    }
  }
  return [...urls].filter((url) => /^https?:\/\//i.test(url) && !ALREADY_OPTIMISED.test(url));
}

async function fetchImage(url: string, fetchImpl: typeof fetch): Promise<Buffer> {
  const res = await fetchImpl(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length === 0) throw new Error('empty body');
  return buffer;
}

async function buildRenditions(
  buffer: Buffer,
  key: string,
  opts: {
    mediaDir: string;
    mediaPublicPath: string;
    widths: number[];
    srcWidth: number;
    webpQuality: number;
  },
): Promise<{ src: string; srcset: string; bytes: number }> {
  const meta = await sharp(buffer).metadata();
  const intrinsic = meta.width || Math.max(...opts.widths);
  const widths = opts.widths.filter((w) => w <= intrinsic);
  if (widths.length === 0) widths.push(intrinsic);

  const written: Array<{ width: number; filename: string; bytes: number }> = [];
  for (const width of widths) {
    const out = await sharp(buffer)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: opts.webpQuality })
      .toBuffer();
    const filename = `${key}-${width}.webp`;
    await fs.writeFile(path.join(opts.mediaDir, filename), out);
    written.push({ width, filename, bytes: out.length });
  }

  const pick = written.find((w) => w.width === opts.srcWidth) || written[written.length - 1];
  const publicBase = opts.mediaPublicPath.replace(/\/+$/, '');
  return {
    src: `${publicBase}/${pick.filename}`,
    srcset: written.map((w) => `${publicBase}/${w.filename} ${w.width}w`).join(', '),
    bytes: written.reduce((sum, w) => sum + w.bytes, 0),
  };
}

async function pruneOrphans(
  manifest: Record<string, { src?: string; srcset?: string }>,
  mediaDir: string,
): Promise<number> {
  const keep = new Set<string>();
  for (const entry of Object.values(manifest)) {
    for (const candidate of String(entry?.srcset ?? '').split(',')) {
      const file = candidate.trim().split(' ')[0]?.split('/').pop();
      if (file) keep.add(file);
    }
    const src = String(entry?.src ?? '').split('/').pop();
    if (src) keep.add(src);
  }

  let removed = 0;
  for (const file of await fs.readdir(mediaDir).catch(() => [] as string[])) {
    if (file.startsWith('.') || keep.has(file)) continue;
    await fs.unlink(path.join(mediaDir, file)).catch(() => {});
    removed++;
  }
  return removed;
}

/** Generate responsive WebP renditions and update the article-images manifest. */
export async function syncArticleImages(
  config: OptimizeImagesConfig,
): Promise<OptimizeImagesResult> {
  const {
    articlesPath,
    manifestPath,
    mediaDir,
    mediaPublicPath = '/article-images',
    widths = DEFAULT_WIDTHS,
    srcWidth = DEFAULT_SRC_WIDTH,
    webpQuality = DEFAULT_WEBP_QUALITY,
    execute = false,
    forceRefresh = false,
    fetchImpl = fetch,
    log = console,
  } = config;

  const articlesRaw = JSON.parse(await fs.readFile(articlesPath, 'utf8')) as unknown;
  const list: ArticleRecord[] = Array.isArray(articlesRaw) ? (articlesRaw as ArticleRecord[]) : [];
  const urls = collectSourceUrls(list);

  let manifest: Record<string, { src: string; srcset: string }> = {};
  try {
    const parsed = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as Record<
      string,
      { src: string; srcset: string }
    > | null;
    if (parsed && typeof parsed === 'object') manifest = parsed;
  } catch {
    // first run
  }
  const before = JSON.stringify(manifest);

  log.log(
    `[article-images] ${list.length} article(s), ${urls.length} image(s) that are not already CDN renditions.`,
  );

  if (!execute) {
    const missing = urls.filter((u) => !manifest[u]);
    log.log(`[article-images] [dry-run] ${missing.length} would be downloaded:`);
    for (const url of missing.slice(0, 20)) log.log(`   ${url.slice(0, 110)}`);
    log.log('[article-images] [dry-run] Pass --execute to write.');
    return {
      articlesCount: list.length,
      urlsCount: urls.length,
      built: 0,
      reused: urls.length - missing.length,
      skipped: 0,
      pruned: 0,
      totalBytes: 0,
      wroteManifest: false,
    };
  }

  await fs.mkdir(mediaDir, { recursive: true });
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });

  let built = 0;
  let skipped = 0;
  let reused = 0;
  let totalBytes = 0;

  for (const url of urls) {
    if (manifest[url] && !forceRefresh) {
      reused++;
      continue;
    }
    try {
      const buffer = await fetchImage(url, fetchImpl);
      const rendition = await buildRenditions(buffer, keyFor(url), {
        mediaDir,
        mediaPublicPath,
        widths,
        srcWidth,
        webpQuality,
      });
      manifest[url] = { src: rendition.src, srcset: rendition.srcset };
      totalBytes += rendition.bytes;
      built++;
      log.log(
        `[article-images]   ✓ ${(buffer.length / 1024 / 1024).toFixed(2)} MB → ${(
          rendition.bytes / 1024
        ).toFixed(0)} KB  ${url.slice(0, 70)}`,
      );
    } catch (err: unknown) {
      skipped++;
      const msg = err instanceof Error ? err.message : String(err);
      log.warn(`[article-images]   ! skipped (${msg}) ${url.slice(0, 70)}`);
    }
  }

  const pruned = await pruneOrphans(manifest, mediaDir);
  if (pruned > 0) log.log(`[article-images] Pruned ${pruned} orphaned file(s).`);

  const sorted = Object.fromEntries(
    Object.keys(manifest)
      .sort()
      .map((key) => [key, manifest[key]]),
  );
  const after = JSON.stringify(sorted, null, 2);

  let wroteManifest = false;
  if (before === JSON.stringify(sorted)) {
    log.log('[article-images] No change. Manifest left untouched.');
  } else {
    await fs.writeFile(manifestPath, `${after}\n`);
    wroteManifest = true;
    log.log(`[article-images] ✓ Wrote ${manifestPath}`);
  }

  log.log(
    `[article-images] ${built} built, ${reused} already present, ${skipped} skipped (those keep their original URL). ${(
      totalBytes /
      1024 /
      1024
    ).toFixed(2)} MB written.`,
  );

  return {
    articlesCount: list.length,
    urlsCount: urls.length,
    built,
    reused,
    skipped,
    pruned,
    totalBytes,
    wroteManifest,
  };
}
