# EPIC-001 — Native Article Syndication

Implementation record. (`docs/` is gitignored — operator docs live in `scripts/*.md`.
The spec asked for `docs/epics/…`; this is the same content in the repo's actual
convention.)

Companion: `scripts/article-tagging-guide.md` (how to tag posts).
Prerequisite: `scripts/epic-000-audit.md` (component lock-in, Feed-item contract).

---

## What shipped

| Area | File |
|---|---|
| Section constants | `src/data/sections.js` |
| Transform pipeline | `src/lib/articles-transform.ts` |
| Snapshot reader | `src/lib/articles.ts` |
| Durable snapshot | `src/data/articles.json` |
| Sync script | `scripts/sync-articles.mjs` |
| Tests (39) | `scripts/articles.test.mjs` |
| Section index | `src/pages/intel/[...page].astro` |
| Category pages | `src/pages/intel/topic/[category]/[...page].astro` |
| Article reader | `src/pages/intel/[slug].astro` |
| Filter bar | `src/components/IntelFilters.astro` |
| Reader typography | `src/styles/modules/article.css` |

---

## The magazine layout

`/intel` deliberately does not look like the rest of the site. Owner direction
was that landing there should feel like arriving somewhere else, referencing
Substack's magazine template (primary), Medium, and the PlayStation Blog.

**Structure (page 1):**

```
filter bar        the Feed's own .quadrant-btn control
magazine spread   rails left + right, swappable centre feature
break strip       "Latest From The Channel" — 4 videos
archive grid      the Feed's card, paginated
```

Page 2+ drops the magazine and break strip — they are an opening statement, and
repeating them would just push the archive down. Category pages keep the
magazine, so filtering reshapes the spread rather than collapsing to a grid.

**The centre swaps in place.** Picking a rail item replaces the feature rather
than navigating. This is a progressive enhancement, not a JS-only feature:

- every rail item is a real `<a href="/intel/<slug>">`, so the page works with
  scripting disabled, stays fully crawlable, and keyboard nav is native;
- the script intercepts plain left-clicks only — modified clicks (new tab,
  middle-click) behave normally;
- the selection is mirrored into the URL hash, so a swapped state can be linked
  and is restored on load;
- the centre is an `aria-live="polite"` region with `aria-current` on the active
  rail item, so the swap is announced rather than silently mutating.

Covered by `scripts/e2e-intel-magazine.test.mjs` (9 assertions, registered in
`npm run test:e2e`), including the no-JS fallback and hash restore.

**Filter buttons use the Feed's actual control.** They were previously a
lookalike. `.quadrant-btn` and its hover/focus/active states were promoted from
`QuadrantFilter.astro`'s scoped `<style>` into `styles/modules/filters.css` so
both surfaces share one definition — verified with a 60-capture parity run
showing the Feed unchanged by the move.

---

## Decisions taken, and why

**Feed integration was one line, not a phase.** EPIC-000 established that the
Feed-item contract already carried articles — same `ContentCard`, same "Read
Now" CTA, same category filtering, no video-specific coupling. The only
article-specific behaviour was that `link` pointed at Substack. So integration
is `articleHref()`: an article we host resolves to `/intel/<slug>`, one we
don't still resolves to Substack. **52/52 screenshots byte-identical** before
and after, across 13 existing routes × 4 breakpoints.

**`ContentCard` needed one guard.** It forced `target="_blank"` on every
non-video card, which would have fired internal links into a new tab. It now
decides from the href: absolute URLs keep `target`/`rel`, relative ones don't.

**Categories live at `/intel/topic/<category>`, not `/intel/<category>`.**
The feed's pattern is a real static route per category, replicated here rather
than inventing a client-side filter. But `/intel/<slug>` is the article route,
so a post slugged `film` would shadow the Film category page. Nesting under
`/topic/` makes collision impossible. `RESERVED_SLUGS` guards the rest.

**Truncated posts get no local page.** A record whose feed body is missing or
truncated keeps its Feed card pointing at Substack. This is the spec's
defensive check, not a paywall feature — it exists so a truncated post never
becomes a thin local page competing with the Substack original in search.

**Category mapping drops `review` and `trailer` as keywords.** TV and games get
reviewed and trailered too; as Film keywords checked first, they swallowed
everything into Film. Caught by a test.

---

## Spec-vs-repo conflicts (repo won, per the spec's own rule)

1. **`src/consts.ts` was not created.** The repo's convention is
   `src/data/*.js`. Constants live in `src/data/sections.js`.
2. **Sanity is not used as the override layer.** CLAUDE.md documents a
   deliberate pivot away from Sanity as a runtime data source; `@sanity/client`
   is imported only by `scripts/`, never `src/`. Overrides are an optional
   `editorial` block on each snapshot record, preserved across syncs — the
   local-JSON equivalent, consistent with how videos already work.
3. **Tailwind Typography is not installed** and no `prose` class exists in the
   repo, so "Tailwind Typography owns body presentation entirely" could not
   hold. Reader typography is hand-written in `src/styles/modules/article.css`
   on the site's existing tokens, which matches the dark cinematic theme far
   better than overriding the plugin's light-mode defaults would.
4. **Canonical needed no new helper.** `Layout.astro` already builds a
   self-referencing canonical from one place. Article pages inherit it. The
   spec's "canonical construction lives in one centralized helper" was already
   satisfied.
5. **Images are not run through Astro's image pipeline.** See below.

---

## Known gaps — deliberate, flagged rather than hidden

**1. The archive is 2 records deep and neither has a body.**
`src/data/articles.json` was seeded from the legacy `cache/articles.json`,
which only ever stored metadata — no `content:encoded`. So both records are
`hasBody: false` and **no article pages exist yet**. They will appear
automatically the first time the sync runs with network access:

```bash
npm run sync-articles              # inspect the plan
npm run sync-articles -- --execute # write the snapshot
```

This is not a defect in the pipeline — it is the rolling-window archive loss
the spec predicted, already having happened before this work started.

**2. The live fetch path is untested against the real feed.**
Substack is unreachable from this environment (the network policy returns 403
on CONNECT). Everything downstream of the fetch — parsing, sanitization,
heading demotion, category mapping, merge semantics — is covered by 39 offline
tests against a fixture feed. The fetch itself, and its failure path, were
exercised live: the sync correctly reported `FEED FETCH FAILED: HTTP 403`, left
the snapshot untouched, and deleted nothing. **First real sync should be run
locally and its output read before committing the result.**

**3. Images are hotlinked to `substackcdn.com`, not run through Astro's
image pipeline.** The spec asked for the pipeline and said to flag it if
materially harder than expected. It is: `astro:assets` optimises local imports
and configured remote patterns at build time, but these URLs are only known
from the snapshot, and the build environment cannot reach the CDN to fetch
them. Doing this properly means downloading images during sync and committing
them as local assets — real work, and its own ticket. Cover images do carry
explicit `width`/`height` to protect CLS.

**4. The Substack embed subscribe form is not used.** Article pages use the
existing `<SubscribeCTA />` component. Embedding Substack's iframe would add a
third-party frame on every article page for the same action the existing CTA
already performs in the site's own styling. Worth a deliberate decision rather
than a silent swap.

**5. No existing in-page Substack links were rerouted.** The spec asked for two
specific links to be repointed for end-to-end testing. Every article surface
(Feed, homepage strip, `/links`, event and brand hubs) now routes through
`articleHref()`, so they will *all* repoint automatically once articles have
bodies — there is no separate hardcoded link left to change. Subscribe buttons,
footer and social links are untouched and still point at Substack, as required.

---

## Follow-ups

1. **Substack archive backfill** — posts outside the current RSS window. Now the
   priority item, not a nice-to-have: it is most of the archive.
2. **Article images through the build pipeline** — download-at-sync, commit as
   local assets. See gap 3.
3. **Contributors/team CMS for the byline** — `DEFAULT_BYLINE` in
   `src/data/sections.js` is a named constant so this becomes a one-line change
   per author. No existing issue covers it (confirmed in EPIC-000's audit).
4. **Decide on the Substack embed subscribe form** — gap 4.
5. **Canonical relationship between `/intel` and `/feed/articles`** — both list
   the same articles and both are sitemapped. Self-canonical on `/intel` with
   `/feed/articles` as a browse surface is the obvious shape.
6. **Pre-existing, unrelated:** `#modal-iframe` ships with `src=""` in the
   initial HTML, which resolves to the current page URL and loads the site
   inside itself — a violation of CLAUDE.md hard rule 4. The close handler
   correctly uses `about:blank`; only the initial attribute is wrong. Not
   touched here as it is outside this epic.

---

## Verification

- `npm test` — **143 tests across 9 suites**, including 39 new article tests
  covering sanitization (scripts, iframes, inline styles, `javascript:` URLs),
  heading demotion, category mapping, slugs, truncation detection, malformed
  items, and the never-delete merge contract.
- `npx astro check` — **0 errors / 0 warnings / 0 hints**.
- `node scripts/visual-parity.mjs --compare button-fix epic001` — **52/52
  byte-identical**, confirming no existing route moved.
- Article page verified against a temporary local fixture (not committed):
  exactly one `<h1>`, in-body `<h1>` demoted to `<h2>`, no script/iframe/inline
  style survived into the body, self-referencing canonical to the BUHQ URL, and
  `sameAs` pointing at the Substack permalink.
- Sync failure path verified live against an unreachable feed: loud error,
  snapshot untouched, nothing deleted, build still succeeds.
