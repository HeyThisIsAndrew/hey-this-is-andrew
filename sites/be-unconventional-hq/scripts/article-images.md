# Article image renditions — operator notes

`scripts/sync-article-images.mjs` downloads the oversized images referenced by
`src/data/articles.json`, resizes them into `public/article-images/`, and writes
`src/data/article-images.json` mapping each source URL to a local `src` and
`srcset`.

```bash
npm run sync:article-images                        # preview, writes nothing
npm run sync:article-images -- --execute           # the real thing
npm run sync:article-images -- --execute --refresh # refetch everything
```

Runs automatically at the end of `.github/workflows/sync-articles.yml`, so a
newly published post gets renditions on the same run that imports it.

## Why this exists

Substack article records carry the **raw upload**. Measured across the three
articles in the store:

| | |
|---|---|
| Raw S3 images | 10 |
| Weight as served before | **22.54 MB** |
| Weight now, at the 720w default | **262 KB** |
| Committed to the repo (all four widths) | 1.8 MB |

Several were 3840×2160, rendering into a column about 720 px wide.

## Why not a live proxy — this was tried and reverted

An earlier attempt rewrote the same `src` attributes to **wsrv.nl**. It made
the page dramatically worse on a real phone: the gallery images were blank, and
stayed blank while sliding through them. Two compounding reasons:

- wsrv.nl has a **cold cache**. Serving one of these meant fetching a ~1 MB 4K
  JPEG from S3, decoding, resizing and re-encoding — once per URL *and per
  srcset width* — on first request.
- `SubstackGallery`'s lightbox reassigns `img.src` on **every slide**, with no
  srcset and nothing preloaded, so each swipe paid that cost again.

A committed local file cannot be cold, cannot expire, cannot rate-limit and
cannot 403. That is the entire difference. **If you are ever tempted to swap
this for a proxy again, read `scripts/articles.test.mjs` first** — there are
guards specifically preventing it, and they were falsified to prove they fire.

## What is deliberately skipped

URLs already on `substackcdn.com` carry their own transforms
(`w_1456,c_limit,f_auto,q_auto:good`). They are already renditions on a warm
CDN and are not where the weight is: of 23 unique image URLs, those 13 are
fine and the 10 raw S3 ones were the whole 22.54 MB.

The skip pattern lives in **two** places and they must agree —
`ALREADY_OPTIMISED` in `scripts/sync-article-images.mjs` and in
`src/lib/article-images-transform.ts`. The script decides what to *download*,
the library decides what to *look up*; if they disagree a file is fetched and
then never used.

## The never-break contract

- **Dry-run by default.** `--execute` to write anything.
- **An image that cannot be fetched is skipped, not failed.** It keeps its
  original URL and renders exactly as it does today. One unreachable host must
  never fail the sync.
- **The manifest is merged, never truncated**, so a run with no network cannot
  empty it.
- **A run that changes nothing writes nothing**, so it cannot trigger a
  pointless rebuild.
- **Every lookup returns `null` when uncertain** and the caller falls back to
  the original URL. An article published between syncs, an image behind a
  blocked host, and a checkout where the sync has never run all render as they
  do now. This can make pages faster; it has no path to making them broken.

## Two bugs worth remembering

**The manifest wrote `{}` for every entry.** The sync used
`JSON.stringify(manifest, Object.keys(manifest).sort(), 2)` to sort keys. That
second argument is a **property allowlist applied at every level**, so it
stripped the nested `src`/`srcset`. The manifest had the right number of
entries, every file was on disk, and every lookup returned `null` — the feature
was completely inert while looking correct in the diff. Caught by checking the
built HTML, not by review. Sort by rebuilding the object instead.

**The test for it passed vacuously.** "Every manifest entry points at a file
that is actually committed" found nothing missing, because with `{}` entries
there were no paths to check. It now asserts entries are non-empty *first*.

## Repo weight

Four widths per image (480/720/1080/1440), WebP q80, `withoutEnlargement` so a
small original is never upscaled into a bigger file. A width that would have
been an upscale is dropped from the srcset entirely, so the browser is never
offered two identical candidates at different descriptors.

Orphans are pruned on every run, driven by the set the manifest references —
never a wildcard delete.
