# Feed + Featured reorganization audit

**Audit only. No code, CSS, routes, components or CMS data were changed, and
nothing was committed.** Every number below was measured against the restored
build (`a9091968`), `src/data/videos.json` and `src/data/articles.json`.

---

## 1. Current architecture

### The four surfaces, and what each one actually is

| Route | What it browses | Structure |
|---|---|---|
| `/feed` | **stories** | 6 sections, 14 rows, horizontal rails |
| `/featured` | **hubs (brands)** | 4 accordion rows, deck of hub cards + stage |
| `/featured/<slug>` | one hub's coverage | hero, recent rail, filtered grid |
| `/feed/videos`, `/feed/articles` | the same 14 rows, type-narrowed | archive |

The important distinction, because it shapes everything below: **`/featured`
contains almost no stories.** Its built page holds 18 hub cards across 4
accordion rows and 6 content cards total. It is a brand directory. `/feed` is
the only surface that browses stories at scale.

### `/feed`

`src/pages/feed/index.astro` (51 lines) loads `getAllFeedItems()` and hands the
whole list to `FeedGrid.astro` (2,397 lines), which does everything.

Section definitions are a **hardcoded array** in `FeedGrid.astro`
(`SECTION_DEFS`), 6 sections over 14 rows:

```
The Latest   -> All Content (41) · All Videos (29) · All Articles (12)
Franchises   -> DC (7) · Marvel (6) · Star Wars (0, dropped)
Film         -> Film (22)
TV           -> TV (14)
Games        -> All Games (3) · PlayStation (2) · Nintendo (0) · Xbox (1)
Streaming    -> HBO Max (7) · Netflix (5) · Prime Video (4)
```

Plus `PRESTIGE_ROW` (Lanterns, 7) which sits outside the sections and leads the
page. Empty rows are dropped before render, which is why Star Wars and Nintendo
do not appear.

Row membership is decided by three matchers in the same file:
`matchesHub()` (hub slug, then `relatedBrandSlug`, then the hub's own
`youtubeSyncKeywords` via `getHubMatchTags()`), `hasTopic()` (Tier-1 topic with
a `games`/`gaming` alias), and `hasTag()` (a literal tag name, used only by
Lanterns).

Ordering inside every row is newest-first, honouring `sortDate`.

**As of `a9091968` the five non-Latest sections are collapsed by default** and
open on click; The Latest is open on arrival.

### `/featured`

`src/pages/featured/index.astro` (3,712 lines). Reads `getFeaturedBrandsLocal()`
and groups by **`hubCategory`**, a field on the hub document:

```
universes -> "Franchises"  (4 hubs)
streaming -> "Streamers"   (6 hubs)
studios   -> "Studios"     (5 hubs)
gaming    -> "Games"       (3 hubs)
```

Row order is a `desiredOrder` array in the page; the labels live in
`src/lib/hub-labels.ts` and are shared with the hub pages. Each row is an
accordion (`<h2>` wrapping a `<button>`, `aria-expanded`, `aria-controls`) with
a deck of hub cards and a stage that shows the hub's logo or trailer.

**Everything about a hub is already CMS-driven**: `hubCategory`, `brandColor`,
`description`, `logo`, `heroImage`, `backdrops`, `trailerUrl`,
`youtubeSyncKeywords`. Adding a hub is a data edit; adding a *category* is a
code change, by design.

---

## 2. Current repetition, measured

Parsed out of the built `/feed`:

| | |
|---|---|
| Rows | 14 |
| Unique stories | 41 |
| Tile placements | **160** |
| Average per story | **3.90** |
| Maximum for one story | **6** |
| Stories appearing exactly once | **0** |

Distribution: 2x 2 items, 3x 17, 4x 13, 5x 1, **6x 8 items**.

### Where it comes from

The eight 6x items are all Lanterns, and their route is identical:

```
lanterns · all-content · all-videos · dc-comics · topic-tv · hbo-max
```

Per row: `all-content 41 · all-videos 29 · topic-film 22 · topic-tv 14 ·
all-articles 12 · lanterns 7 · dc-comics 7 · hbo-max 7 · marvel-comics 6 ·
netflix 5 · prime-video 4 · topic-games 3 · playstation 2 · xbox 1`.

### The single biggest source, and it is not the taxonomy

**The Latest section is 82 of the 160 placements. 51% of the page.**

And `all-content` is *exactly* `all-videos ∪ all-articles`. Verified as a set
identity, not an approximation. One list, rendered three times under three
headings, on a page whose problem is that things appear too many times.

This is the clearest **meaningless repetition** on the site. Nothing is being
discovered in "All Videos" that was not already in the row directly above it.

### Meaningful vs meaningless, on your definition

**Meaningful** (different discovery intent, same story):
- Lanterns Ep5 in **Lanterns** (the show), **DC** (the franchise), **HBO Max**
  (where to watch), **TV** (the medium). Four different questions a reader
  might be answering.

**Meaningless** (one taxonomy rendered several ways):
- **All Content / All Videos / All Articles** — one list, three headings.
- **PlayStation (2) and Xbox (1) as separate sections** next to All Games (3).
  Three headings over what is, at this volume, three stories.
- **HBO Max / Netflix / Prime Video as three headings** when the reader's
  question is "what's on streaming".

---

## 3. CMS taxonomy audit

| Field | Populated | Actually drives the frontend? |
|---|---|---|
| `topics` | 216 docs | **Yes** — Film/TV/Games rows, `/category/*` |
| `hubs` | 80 docs | **Yes** — the primary hub taxonomy |
| `youtubeSyncKeywords` | 41 docs | **Yes** — hub matching for articles, YouTube sync |
| `hubCategory` | 18 hubs | **Yes, but only on `/featured`.** `/feed` ignores it |
| `brandColor` | 20 docs | **Yes** — row accents, hub glow |
| `coverageType` | **29 / 29 videos** | **Barely** — paints a metadata label. Nothing else |
| `series` | 8 docs | **No. Read by nothing on the frontend** |
| `featured` | 1 doc | Only `FeaturedHighlights.astro` on the homepage. `/feed` ignores it |
| `badge1` | 4 docs | Yes, as a brand-slot override |
| `sortDate` | 2 docs | **Yes** — episode ordering |
| `relatedBrandSlug` | 1 doc | Yes, in `matchesHub()` |
| `franchises` | **0** | No |
| `characters` | **0** | No |
| `badge2`, `badge3` | **0** | Available, unused |
| `pinnedCoverage`, `excludeCoverage` | **0** | Read by `hub-coverage.ts`, never exercised |
| `relatedMedia`, `editorialNotes` | **0** | No |

### The three findings that matter

**`hubCategory` is the consolidation you are describing, and it already
exists.** It is populated on all 18 hubs, already grouped, already labelled
"Franchises / Streamers / Studios / Games", already shared between `/featured`
and the hub pages. `/feed` simply does not read it. No new field is needed to
build consolidated rails.

**`series` is populated and read by nothing.** Five videos carry
`series: "Lanterns"`, yet the Lanterns row matches on a raw YouTube tag
(`hasTag(i, 'lanterns')`). The editorial field exists and the page ignores it.

**`coverageType` is on all 29 published videos and only paints a badge.** It is
the one field that knows a review from a vlog, and nothing selects or orders
with it.

---

## 4. Featured page audit

### What it is

A hub directory. Four accordion rows by `hubCategory`, each a deck of hub cards
with a cinematic stage. It answers "which brands does BE cover", not "what
should I read".

### What it already gives us

The grouping vocabulary. `hubCategory` + `HUB_CATEGORY_LABELS` is a working,
CMS-editable, already-labelled four-bucket consolidation of 18 hubs. Building
`/feed` rails on the same buckets means the two pages agree by construction: the
row a reader opens on `/featured` and the rail they scroll on `/feed` are the
same set, named the same way, maintained in one place.

Two hubs' categories can be changed in the CMS and both pages follow.

### What it cannot do as-is

`/featured` has no story rails. Its rows contain brand cards. So it cannot
*become* the consolidated story browsing surface without adding a story rail
per row, which is a structural change to a page you designed.

### The opportunity, stated as a question rather than a plan

Each accordion row could gain one story rail under its deck ("Latest in
Streamers", drawn from every hub in that row). That would make `/featured` a
genuine browse surface rather than a directory, using the existing deck design
untouched above it. **This is a structural change to your page and I am not
proposing it as decided — flagged for your call in §6.**

---

## 5. Lanterns

### Exactly how it works today

`PRESTIGE_ROW` in `FeedGrid.astro`, a literal:

```ts
const PRESTIGE_ROW: RowDef = {
  id: 'lanterns',
  title: 'Lanterns',
  variant: 'prestige',
  accentColor: '#10B981',
  bannerArt: 'lanterns-key-art',
  bannerLogo: 'lanterns-logo',
  match: (i) => hasTag(i, 'lanterns'),
};
```

It sits **outside** `SECTION_DEFS` and leads the page, above the sections. It
gets its own treatment: a full-bleed key-art banner (`FeedRowBanner.astro`), a
brand lockup with the DC roundel resolved from whichever hub its items resolve
to, a green wash across the whole row, and `variant="featured"` tiles that are
larger than every other card on the page. It matches 7 pieces (5 videos, 2
articles) and the artwork is found by filename convention under
`src/assets/rows/`.

**This works and should not be redesigned.** It is the single best thing on the
page and it is the model for what the rest should feel like.

### Can it become the model for other curated sections?

Yes, and almost nothing has to change to make it repeatable. The treatment is
already generic: the banner, the lockup, the accent and the large tiles are all
driven by props, and only four values are show-specific — the title, the accent
hex, the artwork basenames and the match.

Three of those four already have a home in the CMS or a convention:

- the title and the match: **`series`**, which is already populated with
  "Lanterns" on 5 videos, "The Umbrella Academy" on 2 and "X-Men '97" on 1
- the artwork: the existing filename convention
- the accent: nothing holds it today (`#10B981` is typed into the component)

So a second curated section — RESIDENT EVIL, THE BOYS, MARVEL — is close to a
data edit rather than a code edit. **What it needs is a decision from you about
which collection is currently featured, and a place to store the accent.** Both
are in §6.

I am not proposing replacing your Lanterns section with a generic system. I am
proposing the section stays exactly as it is and stops being the only one
possible.

---

## 6. Proposed information architecture

### `/feed` — the story browser

```
HERO                          unchanged
────────────────────────────────────────────────────────────
CURATED COLLECTIONS           editorially chosen, 1 to 3 of them
   LANTERNS                   exactly as it is today
   (RESIDENT EVIL)            same treatment, when you want one
────────────────────────────────────────────────────────────
THE LATEST                    ONE rail, chronological
────────────────────────────────────────────────────────────
FRANCHISES                    one rail, every `universes` hub
STREAMERS                     one rail, every `streaming` hub
STUDIOS                       one rail, every `studios` hub      ← new
GAMES                         one rail, `gaming` hubs + the Games topic
────────────────────────────────────────────────────────────
FILM                          one rail  ── see the open question below
TV                            one rail  ──
```

| Section | Contains | Source | Curated or dynamic | Duplication control |
|---|---|---|---|---|
| Curated collections | One show or property | `series` | **Editorial** | None needed. Its whole job is to repeat a story in a stronger context |
| The Latest | Everything, newest first | all items | Dynamic | Capped; no longer split by medium |
| Franchises | DC, Marvel, Star Wars, Harry Potter | `hubCategory: universes` | Dynamic | One rail replaces up to 4 headings |
| Streamers | HBO Max, Netflix, Prime, Disney+, Peacock, Apple TV+ | `hubCategory: streaming` | Dynamic | One rail replaces up to 6 |
| Studios | Warner Bros, Sony, Universal, A24, Disney | `hubCategory: studios` | Dynamic | **17 stories that are invisible today** |
| Games | PlayStation, Xbox, Nintendo + topic | `hubCategory: gaming` + `topics` | Dynamic | One rail replaces 4 headings |
| Film / TV | Medium | `topics` | Dynamic | Highest overlap with everything else |

### What this measures

Modelled against the real store:

| | Today | Proposed |
|---|---|---|
| Rows / rails | 14 | **8** |
| Unique stories | 41 | 40 |
| Placements | 160 | **113** |
| Average per story | 3.90 | **2.83** |
| Maximum | 6 | 6 |
| Appearing once | 0 | 8 |

With every rail capped at 12: **82 placements, average 2.56.**

Nothing is removed. Studios is *added*. The average falls because one list stops
being printed three times, not because browse paths were deleted.

### `/featured` — the hub browser

**Recommendation: leave it as it is.** Its responsibility is different from the
Feed's and the split is already clean:

- `/feed` answers *what should I read right now*
- `/featured` answers *which brands does BE cover, and take me to one*
- `/featured/<slug>` answers *everything BE has on this brand*

The consolidation you want is a **Feed** change that borrows Featured's
vocabulary, not a Featured change.

---

## 7. Consolidation opportunities, with the honest caveat

**Consolidation does not reduce repetition. It reduces sections.** Measured:

| Category | Split across hubs | Consolidated |
|---|---|---|
| universes | 13 placements | **13 stories** |
| streaming | 17 placements | **17 stories** |
| studios | 17 placements | **17 stories** |
| gaming | 3 placements | 2 stories |

The hubs inside a category barely overlap, so merging them is close to
lossless. That is *good news* for the idea, but it means the case for it is
clarity, not de-duplication. I want to be straight about that because the two
get conflated.

The real wins:

**1. Studios becomes visible.** 17 stories, including **Warner Bros with 11 —
the single largest hub in the store** — have no presence on `/feed` at all,
because `SECTION_DEFS` is hand-written and omits the category. Consolidating on
`hubCategory` fixes this as a side effect.

**2. Empty rails stop being a problem.** Six hubs currently match nothing
(Star Wars, Harry Potter, Peacock, Apple TV+, Nintendo, Disney). Today they are
dropped rows. Consolidated, they simply contribute nothing until they do.

**3. New hubs appear automatically.** Adding a hub today requires editing
`SECTION_DEFS`. On `hubCategory` it is a CMS edit, matching how `/featured`
already behaves.

**4. Three rows become one, four times over.**

### The open question I need you to settle

**Do Film and TV stay as rails?** They are the highest-overlap sections: TV
overlaps Streamers on 13 of 17 stories and Franchises on 8 of 13. A Lanterns
review is genuinely in Lanterns, Latest, Franchises, Streamers, Studios and TV —
six rails, which is where the max of 6 survives.

| Option | Rails | Placements | Avg | Max | Once |
|---|---|---|---|---|---|
| **A.** Keep Film/TV/Games as rails | 8 | 113 | 2.83 | 6 | 8 |
| **B.** Same, capped at 12 | 8 | 82 | 2.56 | 6 | 8 |
| **C.** Drop Film/TV/Games rails | 5 | 55 | **1.96** | **5** | 18 |
| **D.** Keep Film/TV, drop Studios | 7 | 70 | 2.26 | 5 | 12 |

I lean **B**. C is the cleanest number and I do not recommend it: medium is a
real way people browse entertainment, and "TV" is a more natural entry point
than "Streamers" for a lot of readers. But it is your call and the numbers are
there.

---

## 8. What must not change

**Visual system — all of it.** Typography, spacing, colour tokens, card
treatment (`ContentCard.astro`), rail behaviour, chevrons, snap, hover, the
navbar, the footer, the page shell, the hero. None of the proposal touches CSS
beyond adding rails that use the classes that already exist.

**Lanterns.** The section, its banner, the green, the large tiles, its position
leading the page, the DC lockup. If anything changes it is only *how it decides
which show it is*, and only with your approval.

**`/featured` and `/featured/<slug>`.** The deck, the stage, the trailer
behaviour, the accordion, the four categories, the hub hero. No change proposed.

**The hub/event coverage system.** `collectHubCoverage()`, `getHubMatchTags()`,
the exclusion and pinning overrides, the one-tag-list-per-hub rule. The proposal
reads these; it does not alter them.

**`FeedRowBanner.astro`, `FeedSpotlightHero.astro`, `ContentCard.astro`.**
Reused untouched.

**The editorial data from Phases 0 and 1.** `coverageType` on 29 videos, the 24
editorial excerpts, the copy normaliser, the metadata slots, `sortDate`.

**Events, About, Intel, navigation, `/category/*`.** Out of scope entirely.

---

## 9. Phased implementation plan

Nothing below is started. Each phase is separately reviewable.

### Phase 1 — data and wiring, no visible change
- Read `hubCategory` in `FeedGrid.astro` instead of the hand-written hub list.
  The rails become derived; `SECTION_DEFS` shrinks to the parts that are
  genuinely editorial decisions.
- Decide where a curated collection's **accent colour** lives. My
  recommendation is the smallest thing that works, and I will not add a field
  without your say-so (§ open decisions).
- No CMS fields added for the rails themselves. `hubCategory` already carries it.

### Phase 2 — Feed organization
- The Latest becomes one rail. **This removes the "All Videos" and "All
  Articles" headings**, which are set-identical to it. Needs your approval,
  because it is the one place the proposal removes something.
- Franchises / Streamers / Studios / Games become four consolidated rails.
- Film and TV per your choice of A–D.
- Curated collections tier: Lanterns unchanged, with room for a second.
- Decide whether the accordion from `a9091968` stays. With 8 rails instead of
  14 rows it may no longer be needed, and rails you can see are more
  Netflix-like than rails you have to open.

### Phase 3 — Featured organization
- Default: **no change.**
- Optional, only if you want it: one story rail per accordion row.

### Phase 4 — cleanup and performance
- `/feed/videos` and `/feed/articles` keep working and stop being linked
  prominently. Not deleted, not the answer to anything.
- Image requests fall with the row count; re-measure rather than assume.
- Retire genuinely dead fields or wire them, deliberately either way:
  `franchises`, `characters`, `relatedMedia`, `badge2/3` are all empty.

---

## Open decisions I need before writing any code

1. **Film/TV/Games as rails, or not?** Options A–D above. I lean B.
2. **May The Latest become one rail?** It removes two headings that are exact
   duplicates of it, and it is 51% of the current page.
3. **May the curated collection match on `series` instead of the raw
   `lanterns` tag?** It changes nothing on screen today and is what makes a
   second curated section a data edit. Lanterns itself stays exactly as
   designed.
4. **Where does a curated collection's accent live?** Nothing holds it today.
5. **Does the accordion stay** now that there would be 8 rails rather than 14
   rows?
6. **Story rails on `/featured`** — yes, no, or later?

**STOP. Nothing implemented. Awaiting your review.**
