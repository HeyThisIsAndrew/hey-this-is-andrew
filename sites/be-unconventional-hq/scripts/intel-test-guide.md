# /intel — testing guide

Mock content is currently loaded so the section can be tested before real
articles exist.

```bash
npm run mock-articles              # regenerate (24 articles, default)
npm run mock-articles -- --count 40
npm run mock-articles -- --restore # put your real snapshot back
npm run build                      # rebuild after either
npm run dev                        # or run the dev server
```

**Your real snapshot is safe.** It was copied to `src/data/articles.real.json`
before anything was overwritten. `--restore` puts it back.

**Before deploying, run `--restore`.** As a backstop, every mock record carries
`isMock: true` and `scripts/sync-articles.mjs` deletes those before merging, so
a real sync clears them automatically. That guard exists because the merge is
otherwise never-delete by design.

---

## What the mock set contains

24 articles, deliberately uneven — uniform test data hides bugs.

| Variation | Count | What it exercises |
|---|---|---|
| Cover image + rich body | 14 | The normal path |
| Video embed in body | 4 | Figure/caption rendering |
| Video + multiple inline images | 3 | Long, media-heavy articles |
| **No cover image** | 4 | The branded logo + title fallback |
| Very long headline | 1 | Clamping in rails and cards |
| Very short body | 1 | Truncation safety net → **no local page**, card stays pointed at Substack |
| `General` category | 1 | A post with no filter button, by design |

Spread across categories: Film 7, TV 5, Games 6, Events 5, General 1.

Enough for **2 pages** — 7 in the magazine spread, 12 on page 1's archive,
the rest on `/intel/2`.

⚠️ Mock covers come from `picsum.photos`, so they need network access. If you
see broken images everywhere, that's the placeholder host, not the site.

---

## Please focus testing here

### 1. The magazine (highest risk — it's the newest, most custom code)

- Click each rail tile. The centre should swap **without a page load**.
- The tile you clicked should highlight; the previous one should un-highlight.
- **The centre article always has a tile.** Nothing should ever disappear from
  the rails. (This was the bug you found — please try hard to break it again.)
- The URL should gain `#some-slug`. Copy that URL, open it fresh — it should
  open with that article already in the centre.
- Click the centre feature itself → should open that article's page.
- **Middle-click / Cmd-click a rail tile** → should open the article in a new
  tab, not swap the centre.

### 2. Filters

- Should look and behave exactly like the Feed's. Compare side by side.
- Click a category → filters. Click the **same** category again → clears.
- **Games and Events have mock content now**, so to test the empty state,
  regenerate with a small count (`--count 6`) or check a category you know is
  thin. An empty category should show *"No items found for this filter."* with
  a **Clear Filters** button — identical to the Feed.
- All four buttons must always be present, even for empty categories.

### 3. Article pages

- Every card and rail tile should go to `/intel/<slug>` — **not** to Substack.
  The one exception is the short/truncated post, which correctly still points
  at Substack because we have no full body for it.
- Check the reading column: headings, lists, pull quotes, figures, captions.
- Check the attribution footer links back to Substack.
- Confirm exactly **one `<h1>`** per article page (the title).

### 4. The image fallback

Four articles have no cover. They should show the **site logo over the article
title**, not an empty box. Check it in three places:
- a rail tile (small)
- the centre feature (large)
- the archive grid card below

Then click a cover-less article in the rails and confirm the centre switches
cleanly **from** a fallback **to** a real image, and back.

### 5. Responsive

Please check **390px, 768px, 1024px and landscape phone**:
- The magazine should collapse to feature-first, then rails
- The filter row should go two-up on mobile
- Nothing should scroll sideways

### 6. Footer (changed this session)

- Logo is larger and the text lockup is gone; the link and hover should feel
  unchanged.
- Check mobile portrait **and landscape** — you flagged this specifically.

---

## Known issues — please don't re-report

1. **Mock covers may not load** without network — `picsum.photos`.
2. **Article images are hotlinked**, not run through Astro's image pipeline.
   Known follow-up; it will affect Lighthouse's image scores.
3. **The Substack embed subscribe form isn't used** — article pages use the
   existing `SubscribeCTA`. Pending your decision.
4. **`General` has no filter button.** Intentional — it's the fallback bucket.

---

## Lighthouse: yes, you can run it now — with two caveats

Mock content makes Lighthouse **meaningful** where it previously wasn't: there
are now real article pages with real body copy, real headings, real internal
links and a populated index.

**Trustworthy now:**
- **Accessibility** — heading order, contrast, focus states, ARIA on the
  magazine. Fully valid; the markup is what will ship.
- **SEO** — canonicals, meta, structured data, crawlable links. Valid.
- **Best Practices** — valid.
- **CLS and layout stability** — valid; the width/height reservations are real.

**Not yet trustworthy:**
- **LCP and total image weight.** Mock covers are hotlinked `picsum.photos`
  files at 1456×816, unoptimised. Real Substack covers will differ in size and
  host. Treat any image-related performance number as indicative, not final —
  and expect it to improve once article images go through the build pipeline.

**Suggested command:**

```bash
npm run build
npm run lighthouse    # scripts/lighthouse-check.mjs
```

Run it against **both** `/intel` and one article page — they're very different
pages and only one of them has a large hero image.

If you want a clean baseline for the *page structure* without image noise,
regenerate the mock set so every article uses the branded fallback instead of
a remote cover — say the word and I'll add a `--no-images` flag.
