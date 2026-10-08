# Search Console coverage — diagnosis, 2026-08-26

Supersedes `GSC_REMEDIATION_REPORT.md` and `GSC_TODO_POST_ACTIONS.md` (both
deleted). Their diagnosis was wrong on the two buckets that mattered: it
attributed "Excluded by noindex" to `/links`, `/media-kit` and
`/collaborations/press-kit`, and it called the redirect and canonical buckets
healthy. Neither holds. The real causes are below.

Source data: GSC export 2026-08-26, sitemap scope "all known pages", 27 URLs
across five buckets.

---

## The short version

Twenty-seven URLs. **Two** underlying causes, plus one thing that is simply
a young site being crawled slowly.

1. **A redirect stub that was not a redirect.** `src/pages/category/[slug].astro`
   did `return Astro.redirect('/feed?category=' + slug)`. In a static Astro
   build that does not emit a 301. It writes an HTML file, and Astro's
   template for it carries a `noindex` **and** a canonical pointing at the
   redirect target. That single file produced the entire "Excluded by
   noindex" bucket (4 URLs) and taught Google about every `?category=` URL in
   the redirect and canonical buckets (4 more). It was deleted on 2026-08-19
   in `87c450d`. The URLs it created are still in Google's records.

2. **A route rename with no forwarding.** The same commit renamed
   `src/pages/feed/[category]/` to `src/pages/category/[category]/`. Internal
   links were updated, so nothing looked broken, but `/feed/film`, `/feed/tv`
   and `/feed/film/2` had already been discovered from the sitemap and became
   unforwarded 404s (3 URLs).

3. **Never-crawled, with no bug behind it.** The remaining 10 URLs are real,
   linked, sitemapped pages that Google has known about since 2026-08-07 and
   has simply not fetched. The sitemap carried **no `<lastmod>` on any of its
   50 entries**, which is the single most useful signal it could have been
   sending.

The 2026-08-07 spike from 0 to 18 lines up to the day with commit `694dce4`
("update sitemap filter for gsc remediation"), which shipped
`GSC_TODO_POST_ACTIONS.md` instructing a sitemap delete-and-resubmit.
Re-submitting resets discovery for every URL in the file. That is the spike.

---

## Evidence

Everything below was read from the repo or reproduced by building it. Nothing
is inferred from how Astro "usually" behaves.

### The noindex stub, reproduced

The deleted file (`git show 87c450d^:src/pages/category/[slug].astro`):

```astro
---
import { categories } from '../../data/categories.js';
export async function getStaticPaths() {
  return categories.map((cat) => ({ params: { slug: cat.slug }, props: { category: cat } }));
}
return Astro.redirect(`/feed?category=${Astro.params.slug}`);
---
```

Recreated verbatim in this repo at its current Astro version and built. The
emitted `/category/tv/index.html`:

```html
<!doctype html><title>Redirecting to: /feed?category=tv">
<meta http-equiv="refresh" content="2;url=/feed?category=tv">
<meta name="robots" content="noindex">
<link rel="canonical" href="https://beunconventionalhq.com/feed?category=tv">
```

The template is `node_modules/astro/dist/core/routing/3xx.js:12-19`, reached
from `dist/core/build/generate.js:348` for any prerendered route returning a
3xx. Config `redirects` do NOT go through it — the Cloudflare adapter turns
those into real 301s in `dist/client/_redirects`. Only `Astro.redirect()`
inside a page does. That distinction is now pinned by
`scripts/seo-routing.test.mjs`.

Three consequences, all visible in the export:

- `/category/tv`, `/category/tv/`, `/category/events`, `/category/gaming`
  → 200 with `noindex` → **"Excluded by noindex"**.
- The canonical taught Google that `/feed?category=<slug>` was a real URL.
  That is the only reason those query URLs are in the index at all; nothing
  on the site links to them.
- `content="2;url=..."` is a meta refresh, which Google treats as a redirect.

### The query-parameter URLs

`/feed?category=tv` and `?category=gaming` are in "Page with redirect".
`?category=events` is in "Alternate page with proper canonical tag". Same URL
shape, three URLs, two labels. There is no rule in the code producing the
difference, and there is no server-side redirect at any layer:

- **Edge:** confirmed by the Cloudflare audit — no Redirect Rules, no Bulk
  Redirects, and the only Page Rule matches `www.*`.
- **App:** `src/pages/feed/[...page].astro` contains no `Astro.redirect()`.
  Query strings are not part of Astro route matching, so all three serve the
  same static `/feed/index.html`, whose canonical is
  `https://beunconventionalhq.com/feed` (`src/layouts/Layout.astro:56-60`
  builds it from `Astro.url.pathname`, which never contains the query).

What *does* change the URL is client-side JavaScript:
`src/components/FeedGrid.astro:80-94` reads `?category=`, deletes it, and
calls `history.replaceState` to put the value in the hash. When Google renders
the page it observes the URL change to `/feed#tv`, which normalizes to `/feed`
— a client-side redirect. When Google does not render (crawl without
rendering, which is common and unpredictable), it sees only the canonical tag
— an alternate page.

So: **one cause, two labels, depending on whether Googlebot rendered that
particular fetch.** Both resolve to `/feed`, which is the correct
destination. No fix is needed for the query URLs themselves; they will age
out now that nothing points at them.

**Correction to the Cloudflare audit:** it concluded that if GSC shows a
redirect on `/feed?category=tv`, "the only place it could originate is inside
`src/pages/feed/[...page].astro`". That is wrong. It considered server-side
layers only. The redirect is client-side, in `FeedGrid.astro`, and no amount
of reading the route file will find it.

### The dead `/feed/<category>` paths

`src/layouts/FeedLayout.astro:5` still documents `/feed/[category]` as a live
route. It has not been one since `87c450d`. `/feed/film`, `/feed/tv` and
`/feed/film/2` were 404ing with no forwarding. Fixed: see the redirect block
in `astro.config.mjs`.

### The never-crawled ten

Not a crawl-depth problem. `/about`, `/events` and `/featured` are in
`site.nav` (`src/data/site.js:24-30`) and rendered server-side by both the
navbar (`Navbar.astro:10`, `:44`) and the footer (`Footer.astro:83-85`), so
they are one click from the homepage and present in the HTML of every page.
`robots.txt` allows everything except `/admin` and `/local-cms`. All ten are
in the sitemap.

What was missing was any freshness signal. The built sitemap had **zero**
`<lastmod>`, `<changefreq>` and `<priority>` across all 50 entries. Fixed:
`<lastmod>` is now stamped on the 8 article pages from the date each article
actually carries. Deliberately not stamped on hub and feed pages, which have
no single modification date — a lastmod invented for a page that did not
change teaches a crawler to ignore the field.

Beyond that, this is a young domain with low crawl demand. There is no
further code fix; it needs links and time.

### The three crawled-not-indexed articles

The slugs in the export are **not** truncated by us. They match
`src/data/articles.json` exactly. Substack generates truncated slugs and the
sync preserves them (`toSlug` in `src/lib/articles-transform.ts`). Renaming
them now would cost the crawl history they already have, for a ranking factor
that barely exists. Leave them.

The pages themselves are structurally fine: title, meta description,
self-referential canonical, `NewsArticle`/`Review`/`Article` JSON-LD branching
on `contentType`, a visible byline and a visible publish date
(`src/pages/intel/[slug].astro`). "Crawled, currently not indexed" on a
three-week-old site with eight articles is Google declining on perceived
value, not on a technical defect. The lever is more articles and more inbound
links, not more markup.

---

## Every URL

| URL | GSC bucket | Verdict | Evidence | Fix | Priority |
| --- | --- | --- | --- | --- | --- |
| `/category/tv` | Excluded by noindex | **Bug, already fixed** | Astro redirect stub emitted `noindex` (reproduced above) | Stub deleted in `87c450d`; page now 200 with no robots meta | P0 done |
| `/category/tv/` | Excluded by noindex | **Bug, already fixed** | Same file; slashed form is a separate GSC URL | Same. `wrangler.jsonc:34-36` `drop-trailing-slash` 301s it to the bare form | P0 done |
| `/category/events` | Excluded by noindex | **Bug, already fixed** | Same file | Same | P0 done |
| `/category/gaming` | Excluded by noindex | **Bug, already fixed** | Same file | Same | P0 done |
| `/feed?category=tv` | Page with redirect | **Expected** | `FeedGrid.astro:89` `history.replaceState` during render | None. Nothing links here any more | P2 |
| `/feed?category=gaming` | Page with redirect | **Expected** | Same | None | P2 |
| `http://…/feed?category=tv` | Page with redirect | **Expected** | Cloudflare "Always Use HTTPS" | None | P2 |
| `/feed?category=events` | Alternate page, proper canonical | **Expected** | `Layout.astro:56-60` canonical is `/feed` | None. This is the canonical tag working | P2 |
| `http://beunconventionalhq.com/` | Page with redirect | **Expected** | Cloudflare "Always Use HTTPS" | None | P2 |
| `http://www.…/` | Page with redirect | **Expected** | Always Use HTTPS, then the www Page Rule | None (see the Page Rule note below) | P2 |
| `https://www.…/` | Page with redirect | **Expected** | www→apex Page Rule | None | P2 |
| `/feed/film` | Discovered, never crawled | **Bug, fixed here** | Route renamed in `87c450d`, no forwarding left | 301 → `/category/film` | P0 |
| `/feed/film/2` | Discovered, never crawled | **Bug, fixed here** | Same | 301 → `/category/film/2` | P0 |
| `/feed/tv` | Discovered, never crawled | **Bug, fixed here** | Same | 301 → `/category/tv` | P0 |
| `/about` | Discovered, never crawled | **Expected** | In nav, footer and sitemap; no blocker found | `lastmod` added; otherwise crawl demand | P1 |
| `/events` | Discovered, never crawled | **Expected** | Same | Same | P1 |
| `/events/d23-2026` | Discovered, never crawled | **Expected** | Real event doc in `videos.json` | Same | P1 |
| `/featured` | Discovered, never crawled | **Expected** | In nav | Same | P1 |
| `/category/film` | Discovered, never crawled | **Expected now** | Was a `noindex` stub until 2026-08-19, now a real page | Re-inspect in GSC | P1 |
| `/feed/2` | Discovered, never crawled | **Needs a decision** | Real paginated route, in sitemap | See pagination below | P1 |
| `/feed/articles` | Discovered, never crawled | **Expected** | Real route, in sitemap | Crawl demand | P1 |
| `/feed/videos` | Discovered, never crawled | **Expected** | Real route, in sitemap | Crawl demand | P1 |
| `/intel/topic/events` | Discovered, never crawled | **Expected** | Real route; built for all four categories even when empty | Crawl demand | P1 |
| `/intel/topic/gaming` | Discovered, never crawled | **Expected** | Same | Crawl demand | P1 |
| `/intel/the-viral-billboard-worked-why-netflixs` | Crawled, not indexed | **Expected** | Slug matches `articles.json` exactly; page markup is complete | None technical | P1 |
| `/intel/god-of-war-was-this-casting-preordained` | Crawled, not indexed | **Expected** | Same | None technical | P1 |
| `/intel/the-wrong-war-why-the-fight-for-physical` | Crawled, not indexed | **Expected** | Same | None technical | P1 |

---

## Open decisions

### Two taxonomies

The site has both `/category/<slug>` (all content) and `/intel/topic/<slug>`
(articles only). That is not an accident of migration: they cover different
content sets, and `/intel/topic/` exists because a flat `/intel/<category>`
would collide with an article slugged `film`
(`src/pages/intel/topic/[category]/[...page].astro:8-13`).

They are also near-duplicates for a crawler on a site with 8 articles, since
`/intel/topic/film` is a subset of `/category/film`. Recommendation: keep both
for now, revisit once `/intel` has enough articles that the topic pages stand
on their own. If you want to cut one, cut `/intel/topic/` and redirect each to
`/category/<slug>` — but do it in the `redirects` map, never with
`Astro.redirect()` in a page, for the reason this whole document exists.

### Pagination

`/feed/2` and `/category/film/2` are currently fully indexable and in the
sitemap. Recommendation: **leave them indexable**. On a news and entertainment
site, page 2 holds real, distinct articles that exist nowhere else in a
crawlable path. Canonicalising them to page 1 tells Google the content is
duplicate, which it is not, and can orphan everything below the fold of page
1. `noindex,follow` keeps discovery but discards the pages themselves, which
is a reasonable second choice.

The tradeoff of leaving them indexable, stated plainly: thin pages compete for
the same crawl budget as the articles, and on a young domain that budget is
the binding constraint. Revisit if page 3 and beyond start appearing in
"Crawled, currently not indexed".

### The www Page Rule

The Cloudflare audit recommends migrating the legacy www→apex Page Rule to a
Redirect Rule. That is sound advice and worth doing, but it changes nothing in
this report: the four `http://` and `www` rows are correctly-behaving 301s
either way.

Note one error in the migration instructions as given: it says to choose
**Static** with the URL `https://beunconventionalhq.com${http.request.uri.path}`.
A Static redirect takes a literal URL and would send every www request to that
string verbatim. To reference `http.request.uri.path` you must choose
**Dynamic** and write the expression, e.g.
`concat("https://beunconventionalhq.com", http.request.uri.path)`.

---

## What changed in the repo

| File | Change |
| --- | --- |
| `astro.config.mjs` | 5 legacy `/feed/<category>` paths now 301 to `/category/<slug>`; those paths added to the sitemap exclusion list; `<lastmod>` stamped on article pages |
| `scripts/seo-routing.test.mjs` | New. Fails if any page uses `Astro.redirect()`, if a redirect source is also in the sitemap, or if the legacy forwarding or `lastmod` is removed |
| `scripts/notify-indexing-api.mjs` | New. Google Indexing API notifier. See `scripts/indexing-api.md` |
| `scripts/indexing-api.test.mjs` | New. Offline guards for the notifier's URL validator and article-eligibility rule |
| `.github/workflows/sync-articles.yml` | Snapshots article URLs before the sync; submits newly published ones after the deploy is live |
| `GSC_REMEDIATION_REPORT.md`, `GSC_TODO_POST_ACTIONS.md` | Deleted. Superseded by this file |

---

## Manual follow-up in Search Console

Do these after the deploy carrying the changes above.

1. **Nothing to validate yet on the noindex bucket.** Confirm first: URL
   Inspection on `https://beunconventionalhq.com/category/tv` → "View crawled
   page" → check the HTML has no `<meta name="robots">`. A `curl -I` cannot
   tell you this: the directive is in the body, and HEAD returns headers only.
2. Once confirmed, **Pages → Excluded by 'noindex' → Validate Fix.**
3. **Pages → Discovered, currently not indexed.** Inspect `/feed/film`,
   `/feed/tv` and `/feed/film/2`. They should now report a redirect. No
   validation button applies; they will drop out.
4. **Do not delete and re-submit the sitemap.** The old TODO file told you to,
   and that is what produced the 2026-08-07 discovery spike. The sitemap URL
   is unchanged and Google re-reads it on its own. Submitting it once, if it
   is not already listed, is fine; re-submitting to force a re-read is not.
5. **Request indexing** on the three crawled-not-indexed articles, once each.
   Repeating it does not help.
6. Leave "Alternate page with proper canonical tag" alone. It is a report, not
   an error.
