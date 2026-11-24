#!/usr/bin/env node
import path from 'node:path';
import { syncArticleImages } from '../src/images/optimizer.ts';

function readArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  const prefixed = process.argv.find((a) => a.startsWith(`${flag}=`));
  return prefixed ? prefixed.slice(flag.length + 1) : undefined;
}

const articlesPath = path.resolve(
  process.cwd(),
  readArg('--articles') ?? 'src/data/articles.json',
);
const manifestPath = path.resolve(
  process.cwd(),
  readArg('--manifest') ?? 'src/data/article-images.json',
);
const mediaDir = path.resolve(
  process.cwd(),
  readArg('--media-dir') ?? 'public/article-images',
);
const mediaPublicPath = readArg('--public-path') ?? '/article-images';
const execute = process.argv.includes('--execute');
const forceRefresh = process.argv.includes('--refresh');

try {
  await syncArticleImages({
    articlesPath,
    manifestPath,
    mediaDir,
    mediaPublicPath,
    execute,
    forceRefresh,
  });
} catch (err) {
  console.error(
    `[article-images] Failed: ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exitCode = 1;
}
