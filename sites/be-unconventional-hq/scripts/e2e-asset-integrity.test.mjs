/*
  Every same-origin asset the built HTML points at must actually exist.

  ─── WHY THIS SUITE EXISTS ────────────────────────────────────────────────
  A card watermark shipped as `<img src={logoImage.src}>`, which resolves to
  `/assets/logo-mark.<hash>.webp`. That file is never written: with
  `@astrojs/cloudflare`, compile-time image optimization emits only the
  TRANSFORMED renditions (`logo-mark.<hash>_<variant>.webp`), so the raw path
  404s in production while working perfectly in dev, where the dev server
  serves the original on demand. Nothing in the build, the type check or the
  unit suites objects — the reference is a valid string, it just points at
  nothing.

  It was not a cosmetic loss either. That <img> is a sibling of the cover
  inside `.content-card-media`; Layout.astro's fail-safe marks the shared
  CONTAINER on any image error, and home-cards.css then hides every `> img`
  in it. One missing 6 KB watermark blacked out the thumbnail on every video
  card on the homepage.

  So this checks the one property that would have caught it: a same-origin
  URL in the output resolves to a file on disk. No browser needed — it reads
  `dist/`, which is why it is fast enough to sit in front of the browser
  suites.

  Deliberately SAME-ORIGIN ONLY. Remote covers (i.ytimg.com, substackcdn)
  legitimately 404 from time to time; that is exactly what the runtime
  fail-safe is for, and asserting on the network would make this flaky.
*/
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist', 'client');

function htmlFilesIn(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) htmlFilesIn(full, out);
    else if (entry.endsWith('.html')) out.push(full);
  }
  return out;
}

/*
  Only the directories the BUILD generates. `public/` is copied verbatim and
  a stale reference there is a different (and much louder) problem; scoping
  here keeps the failure message pointing at the real cause.
*/
const GENERATED = ['/assets/', '/_astro/'];

function referencedUrls(html) {
  const urls = new Set();

  // src="…" and href="…"
  for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) urls.add(url);

  // srcset="a 480w, b 1280w" — split candidates, keep the URL half.
  for (const [, value] of html.matchAll(/srcset="([^"]+)"/g)) {
    for (const part of value.split(',')) {
      const candidate = part.trim().split(/\s+/)[0];
      if (candidate) urls.add(candidate);
    }
  }

  // url(...) inside inline <style> blocks — this is how the brand fallback
  // mark is injected, and it is just as capable of pointing at nothing.
  for (const [, url] of html.matchAll(/url\(["']?([^"')]+)["']?\)/g)) urls.add(url);

  return [...urls];
}

if (!existsSync(DIST)) {
  console.error(`❌ Asset integrity: no build at ${DIST}. Run \`npm run build\` first.`);
  process.exit(1);
}

const pages = htmlFilesIn(DIST);
assert.ok(pages.length > 0, 'expected built HTML pages in dist/client');

const missing = [];
let checked = 0;

for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  for (const url of referencedUrls(html)) {
    if (!GENERATED.some((prefix) => url.startsWith(prefix))) continue;
    checked++;
    // Strip any query/hash before touching the filesystem.
    const clean = url.split(/[?#]/)[0];
    if (!existsSync(join(DIST, clean))) {
      missing.push({ page: page.slice(DIST.length) || '/index.html', url });
    }
  }
}

if (missing.length > 0) {
  console.error(`\n❌ Asset integrity: ${missing.length} generated asset reference(s) point at nothing.\n`);
  // One line per distinct URL; the same missing asset usually repeats on
  // every page and every card, and 300 identical lines helps nobody.
  const byUrl = new Map();
  for (const m of missing) {
    if (!byUrl.has(m.url)) byUrl.set(m.url, []);
    byUrl.get(m.url).push(m.page);
  }
  for (const [url, pagesFor] of byUrl) {
    console.error(`  ${url}`);
    console.error(`    referenced by ${pagesFor.length} page(s), e.g. ${pagesFor[0]}`);
  }
  console.error(
    '\n  If this is an image imported from src/assets, pass it through getImage()' +
      '\n  rather than using `.src` directly — the raw path is not emitted when' +
      '\n  compile-time image optimization is on.\n',
  );
  process.exit(1);
}

console.log(
  `\n✅ Asset integrity: ${checked} generated asset reference(s) across ${pages.length} page(s) all resolve.`,
);
