# Feed editorial pass: investigation and implementation plan

Status: **plan awaiting review. No code changed.**

Answers §35 of the design critique, then proposes the work. Every number below
was measured against `src/data/videos.json`, `src/data/articles.json` and the
built `dist/client/feed/index.html` (built 2026-09-16 21:13), not estimated.

---

## Part 1: What the investigation found

### 1.1 The repetition is real, and it is worse than reported

Parsed every `data-row` block out of the built `/feed`:

| | |
|---|---|
| Unique items on the page | **41** |
| Tile placements | **160** |
| Average appearances per item | **3.9x** |
| Items appearing exactly once | **0** |
| Items appearing 6 times | **8** |

Per row: `all-content` 41, `all-videos` 29, `topic-film` 22, `topic-tv` 14,
`all-articles` 12, `lanterns` 7, `dc-comics` 7, `hbo-max` 7, `marvel-comics` 6,
`netflix` 5, `prime-video` 4, `topic-games` 3, `playstation` 2, `xbox` 1.

The critique named Lanterns Episode 5 in six places. That is exact, and seven
other items are in six places too. **No item on the feed appears only once.**

The same component builds `/feed/videos` (11 rows over 29 videos) and
`/feed/articles` (12 rows over 12 articles). `/feed/articles` renders one row
per article.

> Note: the header comment in `src/pages/feed/articles/index.astro` claims that
> route "builds NO rows" because rows match on `hubs`/`youtubeTags` which
> articles lack. That was true once. `matchesHub()` step 3 now reads article
> `tags` through `getHubMatchTags()`, so the route builds 12 rows. The comment
> is stale and should be corrected whatever else happens.

### 1.2 The page weight is dominated by invisible text

`/feed/index.html` is **1.20 MB** with **298 `<img>` tags**.

The largest single contributor is not images. `ContentCard.astro:259` writes
`data-preview={excerpt}` on every card, where `excerpt` falls back to the raw
YouTube description:

| | |
|---|---|
| `data-preview` attributes on /feed | 160 |
| Mean length | **1,990 characters** |
| Total | **~318 KB, or 26% of the page** |
| Containing affiliate/subscribe/gear text | **102 of 160** |
| Occurrences of `amzn.to` in the HTML | **219** |

Sample of what ships inside a card attribute:

```
🎥 MY CINEMATIC FILMING GEAR
Want to replicate the visual style of our deep dives? This is the exact kit we use:
✅ Primary Cinema Camera | Sony A7IV: https://amzn.to/3RAmcEy
✅ B-Roll & B-Cam | Sony A7C R: https://amzn.to/4dWoUeT
```

`FeedSpotlightHero.astro:2227` reads that attribute and paints it into the hero
when a tile is clicked, so this is not purely dead weight. It is clamped to 3-4
lines, which usually hides the gear list.

### 1.3 Creator-era copy that IS visible

**14 of 29 published videos open with a hashtag block or emoji banner** inside
the first 280 characters, which is the window the hero shows:

```
#TheOdysseyMovie #christophernolan #trailerreaction #movie #tomholland
#sinnersmovie #ryancoogler #michaelbjordan 🚨 Movie Review: Sinners (2025) 🚨
```

`ContentCard.astro:72` strips leading hashtag clusters. `FeedSpotlightHero.astro:73`
does not: `heroDescription = latestVideo.description` is raw. **Two code paths,
one cleaned.** The hero is the first thing a PR contact sees.

All 30 video descriptions contain at least one creator-era signal somewhere.

### 1.4 The metadata system is not just inconsistent, it is positionally broken

`getDisplayTags()` (`src/lib/tags.ts`) builds `[brand, type, extra]` then ends
with `.filter(Boolean)`. **The filter collapses the array, so slot 2 slides
into slot 1 when no brand resolves.** The same visual position means "studio"
on one card and "editorial type" on another.

Run over all 41 feed items, 5 render a broken pair:

```
[]           <- The Monkey - Movie Review
[REVIEW]     <- Boy Kills World! Out Of Theater Reaction
[]           <- WonderCon Vlog Day 1: What Happened To WonderCon!?
[REVIEW]     <- Godzilla x Kong: The New Empire First Impression Out Of The...
[ANALYSIS]   <- The Wrong War: Why the Fight for Physical Media Has Become...
```

Two of those are worse than mis-slotted. "Boy Kills World! Out Of Theater
Reaction" and "Godzilla x Kong ... First Impression" are labelled **REVIEW**,
because the regex matched a stray `review` tag. The label is factually wrong,
and it is wrong on exactly the creator-era pieces the critique wants demoted.

Type-slot distribution across 41 items: REVIEW 26, ANALYSIS 3, TRAILER 2,
PREMIERE 2, NEWS 2, COMMENTARY 1, none 5.

### 1.5 THE KEY FINDING: the editorial fields already exist and are all empty

This is the finding that changes the shape of the work.

| Field | On the type | Carried by `videos.ts` | Editable in Local CMS | Populated |
|---|---|---|---|---|
| `coverageType` | yes | yes (L128) | yes | **0 / 30** |
| `featured` | yes | yes (L115) | yes | **0 / 30** |
| `series` | yes | yes | yes | **0 / 30** |
| `franchises` | yes | yes | yes | **0 / 30** (empty arrays) |
| `badge1` / `badge2` / `badge3` | yes | yes (L107-109) | yes (L1725-1735) | **0 / 30** |
| `sortDate` | yes | yes | yes | 2 / 30 |
| `editorialNotes` | yes | yes (L131) | yes | 0 / 30 |

`badge1`/`badge2` are read by `getDisplayTags()` as a manual override that beats
every regex. **The standardized metadata system the critique asks for in §7 is
already built end to end. It has no data in it.**

Articles are further along: `editorial.title`, `editorial.excerpt` (labelled
"Override Excerpt (Standfirst)"), `editorial.category`, `editorial.sortWeight`
and `editorial.hidden` all exist, are merged in `src/lib/articles.ts:60-79`,
survive the Substack sync (`articles-transform.ts:686`), and are exposed in the
CMS at `LocalCmsApp.tsx:2652`. One of 12 articles uses them.

**Videos have no equivalent of `editorial.excerpt`.** That is the one genuinely
missing field in the whole brief.

### 1.6 Featured Series is hardcoded, in violation of §31

`PRESTIGE_ROW` is a literal in `FeedGrid.astro:174-196`: `id: 'lanterns'`,
`accentColor: '#10B981'`, `bannerArt: 'lanterns-key-art'`, and
`match: (i) => hasTag(i, 'lanterns')`. The banner art is a build-time
`import.meta.glob` over `src/assets/rows/`, so changing the featured series
today means an editor cannot do it: it is a code edit plus an asset commit.

The critique's §31 is correct and this is the clearest violation of it.

### 1.7 Featured vs Latest have already collapsed

`FeedSpotlightHero.astro:41` is `videos[0]`, the newest **video**, chosen by
date. It cannot ever feature an article. `PRESTIGE_ROW` leads with the newest
Lanterns item. Both resolve to Lanterns Episode 5 today, so the top of `/feed`
states the same thing twice before the rows begin.

Nothing on `/feed` is curated. `featured: true` is set on zero documents.

### 1.8 Content priority and the old-content problem

Published videos split cleanly by era:

- **2026-05 to 2026-09: 12 videos.** Reviews and analysis. Current editorial.
- **2025-02 to 2025-04: 7 videos.** Movie reviews. Still editorial.
- **2024-03 to 2024-08: 10 videos.** "Out Of Theater Reaction", "First
  Impression", "WonderCon Vlog Day 1", "Premiere Vlog", "Trailer is INSANE! 👀".

The critique names five of those ten by title. The split is real, but **the
honest discriminator is format, not age.** A 2025 SINNERS review is not creator
-era; a 2024 vlog is. Sorting by date would bury the former with the latter.

`coverageType` is the field for this, and it already exists (§1.5).

### 1.9 Duplicate data fetching

`/feed/index.astro` calls `getAllFeedItems()` -> `getVideosUnified()`.
`FeedSpotlightHero.astro:19` calls `getVideosUnified()` again.
`FeedGrid.astro` calls `getFeaturedBrandsLocal()` and `getEventsLocal()`;
`FeedSpotlightHero` calls both again; `ContentCard` calls both **per card**.

All build-time, so the cost is build seconds, not runtime. The real cost is that
the hero derives its lead independently of the feed's own item list, which is
why it can never show an article (§1.7).

### 1.10 Existing archive routes: the gateways already have destinations

| Destination | Route | Shape | Status |
|---|---|---|---|
| All Articles | `/intel` + `/intel/2..` | paginated, 12/page | **ready** |
| Film / TV / Games / Events | `/category/<slug>/[...page]` | paginated, 12/page | **ready** |
| All Videos | `/feed/videos` | rows clone of /feed | needs conversion |
| Franchise / streamer hubs | `/featured/<slug>` | hub page | ready |

`src/pages/category/[category]/[...page].astro` is the reusable archive pattern:
`FeedLayout` + `paginate(pageSize: 12)` + `CardGrid` + `ContentCard` +
`Pagination`. **No new component is needed for the gateways.**

### 1.11 Streaming can be demoted safely

`site.nav` (`src/data/site.js:24-30`) is Feed, Intel, Events, Featured, About.
Streaming is not in it. It exists only as a `SECTION_DEFS` entry and a
`/featured#streaming` accordion. The critique's §12 caveat ("do not implement
this automatically if the navigation depends on Streaming") is satisfied:
**nothing depends on it.**

---

## Part 2: Where I would push back

**a. The repetition is a symptom of one decision, not six.** Every row draws
from the same unpartitioned `allItems`. Fixing the presentation of individual
rows will not reduce repetition. Only giving each level a disjoint, budgeted
slice will. That is why Phase 2 below is one change, not eleven.

**b. Five of six P0 items are blocked on data, not code.** The components can be
rebuilt in a day and will look exactly as wrong, because `coverageType`,
`featured` and `badge1/2` are empty. Phase 1 is unglamorous and it is the
critical path. This is good news: it is content entry, not schema work.

**c. §8 and §9 partially reverse a deliberate recent decision.** `/feed`,
`/feed/videos` and `/feed/articles` were de-paginated on purpose, and
`astro.config.mjs` now has `redirects` forwarding `/feed/videos/2` and `/3`
to `/feed/videos`. Turning them back into paginated archives means **those
redirects must be removed in the same commit**, or page 2 will 301 to page 1
and the archive will silently be one page deep. I agree with the direction; I
am naming the trap because it will not show up as an error.

**d. I would not date-cut the archive.** Format is the honest signal (§1.8).
Prioritize by `coverageType`, which fixes §6 and §10 with one field.

**e. The metadata slot bug should be fixed before any data entry.** It is ~10
lines. Fixing it after populating `badge1/2` would mask whether the data or the
renderer was at fault.

**f. Four items in the critique are outside the Feed** (§22 About copy, §23 gear
framing, §24-25 press CTA, §26 footer weight). They are small, located, and
unrelated to the Feed architecture. I would ship them as one separate copy
commit rather than tangling them into a structural change.

---

## Part 3: The plan

### Phase 0: Correctness, before anything is rebuilt
Small, independently shippable, no design decisions.

| # | Change | File |
|---|---|---|
| 0.1 | Stop collapsing metadata slots: return a fixed-shape pair, render an empty slot as absent rather than shifting slot 2 up | `src/lib/tags.ts` |
| 0.2 | Truncate `data-preview` to ~320 chars (the hero clamps to 3-4 lines anyway). **Removes ~300 KB, 25% of /feed, with zero visual change** | `ContentCard.astro:259` |
| 0.3 | Route the hero's description through the same cleaner the card uses | `FeedSpotlightHero.astro:73` |
| 0.4 | Correct the stale "builds NO rows" comment | `src/pages/feed/articles/index.astro` |
| 0.5 | Test: assert no rendered excerpt or `data-preview` contains `amzn.to`, `subscribe`, a leading hashtag run, or a gear-list emoji | `scripts/editorial-copy.test.mjs` (new) |

### Phase 1: Populate the editorial layer (content work, mostly yours)
Everything here already exists in the CMS. Nothing to build except one field.

| # | Change | Where |
|---|---|---|
| 1.1 | Add `editorial.excerpt` to video docs, mirroring the article implementation exactly (type, merge, sync carry-forward, CMS textarea). **The one new field in this plan** | `videos.ts`, `sync-youtube.mjs`, `LocalCmsApp.tsx` |
| 1.2 | Card/hero excerpt cascade becomes `editorial.excerpt -> preview -> excerpt -> (never the raw description)`. A video with no editorial excerpt shows **title and metadata only** | `ContentCard.astro:65`, `FeedSpotlightHero.astro:73` |
| 1.3 | Fix the `coverageType` vocabulary to a closed set: `REVIEW / ANALYSIS / NEWS / REPORTING / INTERVIEW / REACTION / VLOG`. Make it the first source `getDisplayTags()` reads, above the regex | `tags.ts`, `LocalCmsApp.tsx` |
| 1.4 | **You populate** `coverageType` on 30 videos and `editorial.excerpt` on the ~12 current ones. I can draft the excerpts from the existing descriptions for your edit | CMS |
| 1.5 | **You set** `featured: true` on the handful that lead The Latest | CMS |

Phase 1.4 and 1.5 are the gate. Phase 2 will not look right until they are done.

### Phase 2: Partition the feed (the structural change, P0 §1/§2/§9)

One change, at `FeedGrid.astro`'s data layer rather than its markup: build the
levels as an **ordered, budgeted, consuming pass** over `allItems`.

```
hero        1 item   (curated: featured -> newest)
featured    6 items  (the series package)
latest      8 items  (1 lead + 7, excludes what the levels above took)
videos      6 items  (excludes the above)
articles    6 items  (excludes the above)
explore     0 items  (franchise and category TILES, not content)
```

Result: **~27 tiles, from 167.** Nothing repeats, because each level consumes
what it shows. The "explore" level carries no items at all, which is what turns
§10 and §11 from archive dumps into discovery.

The existing `matchesHub()` / `hasTopic()` / `hasTag()` matchers are kept
verbatim; they stop being row bodies and become the thing that counts stories
per franchise for the discovery tiles. Franchise tiles read
`getFeaturedBrandsLocal()`, which is already CMS-driven, so §10's "DC / 6
stories" comes out of existing data.

Streaming stops being a section and becomes tiles inside Explore (§12, safe per
§1.11).

### Phase 3: Featured Series becomes a content type (P0 §3, §31)

Replace the `PRESTIGE_ROW` literal with a `_type: 'featuredSeries'` document
carrying `title`, `matchTag`, `accentColor`, `hubSlug`, `bannerArt`,
`bannerLogo`, `active`. Art moves from `src/assets/rows/` to the CMS asset
pipeline the hubs already use (`urlFor()`, with `collectAssetLibrary()` reuse).

Acceptance test: point it at Resident Evil in the CMS with no code change and no
commit, and the row re-labels, re-colours and re-populates. That is §31's
requirement stated as something that can fail in CI.

Featured Series gets the dominant-plus-supporting layout (§2): the lead tile at
the existing `--feed-card-featured` size, the rest at `--feed-card`.

### Phase 4: Archive gateways (P0 §4, §8)

- `/feed/videos` -> paginated grid archive on the `/category/[category]` pattern.
- `/feed/articles` -> **delete and 301 to `/intel`**, which is already the
  article archive. Two routes for one thing is the problem in miniature.
- **Remove the `/feed/videos/2`, `/feed/videos/3` redirects from
  `astro.config.mjs` in the same commit** (Part 2c).
- "View All Videos" / "View All Articles" become real CTAs under the 6-item rows.

### Phase 5: Copy and non-Feed (P1 §22-26)

| Item | Location |
|---|---|
| "unfiltered honesty" -> "thoughtful criticism, reporting, and industry analysis" | `about.astro:133`, and the default in `local-content.ts:213` |
| Gear line reframed as production standard | `about.astro:52-53` |
| Press CTA: lead with screeners/review copies/credentials/interviews, demote partnerships | `about.astro:260` |
| Footer support block quieter, below the primary columns | `Footer.astro`, `ReferralLinks.astro`, `src/data/referrals.js` |

### Phase 6: P2 polish
Mobile editorial hierarchy, accessibility audit, image loading, search ranking
(§27's order: title > franchise > studio > type > date, in `search-index.ts`).

---

## Part 4: What this plan does not do

- No visual redesign. No new type scale, no new card shape, no gradients,
  no serif display faces, no shadows, no glassmorphism. §32 holds.
- No content deleted. Everything stays reachable through the archives.
- No new taxonomy. The six existing editorial fields plus one new excerpt field.
- `HeroTrailer.astro` untouched (hard rule 2).
- No `overflow: hidden` introduced on any iframe ancestor (hard rule 3).
- No em dashes in any copy written (house style).

## Part 5: Sequencing

Phase 0 ships on its own today and is worth shipping regardless: it removes a
quarter of the page weight and fixes two factually wrong labels.

Phase 1.1-1.3 is mine and is quick. **Phase 1.4-1.5 is yours and is the gate.**

Phases 2-4 are one branch. Phase 5 is a separate copy commit. Phase 6 follows
the Antigravity responsive audit (`scripts/antigravity-responsive-audit.md`).
