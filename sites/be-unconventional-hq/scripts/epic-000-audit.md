# EPIC-000 — Component System Lock-In & Config Centralization

Audit + outcome record. (`docs/` is gitignored — operator docs live in `scripts/*.md`.)

Branch: `claude/new-session-x50pg6`. Baseline for every claim below: `origin/main` @ `d6d0ee6`.

---

## 1. GitHub issue reconciliation

11 open issues at audit time: #60, #59, #52, #50, #49, #42, #40, #38, #30, #26, #12.

### Covered here

| Issue | Disposition |
|---|---|
| **#50** — extract Section/Grid/SectionHeader layout components | **Partially covered.** The component set from #50's implementation-plan comment is built (`Section`, `Grid`, `SectionHeader`, plus `Container` and `Flex`), and `index.astro` is migrated. **Leave open** for the remaining page migrations (`about`, `events`, `featured`), which #50's own comment argues should land incrementally with visual review between steps. |

#### #50's two open questions — answered

1. **Spacing scale vs literal values?** → **Literal values.** A named scale would have to pick a canonical value for spacing that is currently irregular, which changes rendered output. Parity first; a scale is its own visual-review-gated ticket.
2. **`ContentCard` granularity — extract a `Card` wrapper or move styles to CSS classes?** → **Neither, yet.** `ContentCard` is the single most reused primitive on the site (feed, category pages, homepage, featured, events) and is already single-source. Restructuring it carries the highest blast radius of anything in scope for zero parity gain. Left untouched deliberately.

### Left open — broader than this epic

- **#42** (journalism strip), **#40** (SDCC events), **#38** (About overhaul) — features, not extraction. #38's "add bylines to existing articles" bullet overlaps EPIC-001's byline decision; noted, not folded in.
- **#30** (EPIC 7 parking lot) — two items intersect and should stay parked: the contrast-palette decision (CLAUDE.md already records the muted greys as a deliberate trade-off), and **orphan destinations** (`/videos`, `/articles`, `/press-kit` sitemapped but unlinked). The latter needs an owner decision before EPIC-001 adds `/intel` alongside the existing `/feed/articles` route.
- **#60** (104 KB render-blocking CSS) — not extraction work, but it shares surface area. This epic *reduces* the page-level CSS (nine dead `.container` blocks removed, four duplicated `.feed-page` blocks collapsed to one). #60's "document composition before changing" criterion is unaffected; the change is subtractive.
- **#49**, **#52**, **#26**, **#12** — unrelated.

### Disputed

- **No open issue is labelled or described as a blocker.** A repo-wide search for "blocker" returns only #19 and #28, both closed. The only blocking relationship in play is EPIC-000 → EPIC-001.
- **#26** carries a comment claiming the Twitch work is complete and the issue is "ready to be closed". That is overstated: it verifies the Twitch adapter exists on `main`, but the issue body lists three other open stories (0-quota pre-check gate, observability logging, billboard polish). **Recommend keeping #26 open.** No action taken.

### Prototype branches

Five `prototype/ticket-*` branches were referenced in issue comments. They were absent from the remote at audit time and were pushed mid-session. `prototype/ticket-50-layout-components` has been **merged into this branch**, so that work is preserved rather than reimplemented. The other four (#38, #40, #42, #52) are untouched and remain open for their own tickets.

---

## 2. Component extraction — what was and wasn't needed

Audited first, changed second. Several items in the epic's scope list turned out to need no work:

| Scope item | Finding |
|---|---|
| `<Navbar />` | **Already single-source.** Only `Layout.astro` imports it; all 14 pages route through Layout. No duplication. |
| `<Footer />` | **Already single-source.** Same as above. |
| Page header / hero pattern | **Already componentized** as `PageTitle.astro`. |
| Card/row primitives | **Already single-source** as `ContentCard.astro` — and already renders articles (see §4). |
| Button variants | Real duplicate found; **deliberately not fixed** — see §5. |
| Page container / grid wrapper | Real duplication found and fixed — see below. |
| "the 70/30 asymmetrical grid" | Exists on `events.astro` (documented in a comment there as the split below the hero). Not duplicated, not touched. |

### What actually changed

**Four near-identical feed routes → one shared layout.** `/feed`, `/feed/videos`, `/feed/articles` and `/feed/[category]` were ~90% copies of each other — same chrome, same heading, same filter bar, same `<style>` block — differing only in title, description and data source. Extracted to `src/layouts/FeedLayout.astro`. EPIC-001's `/intel` page would have forked this a fifth time.

**Item-shaping logic → `src/lib/feed-items.ts`.** Each feed route built its merge/normalise/sort inline *twice* (once in `getStaticPaths`, once in the component body) because `getStaticPaths` runs in an isolated scope and cannot see frontmatter helpers. Eight copies of that logic, now one.

**Nine scoped `.container` overrides → `src/styles/modules/layout.css`.** `.container` moved out of `latest.css` (an odd home for a global primitive) into a dedicated module imported immediately after it, so its cascade position is unchanged.

**Layout components** (`Section`, `Grid`, `SectionHeader`, `Container`, `Flex`) per #50's spec. `SectionHeader` takes `reveal` / `animateOnScroll` props because the site uses three variants of that wrapper (9 × `animate-on-scroll`, 6 × bare, 2 × `reveal animate-on-scroll`); the merged prototype hardcoded the 2-usage variant.

---

## 3. The container geometry finding (read this before touching `.container`)

**A page has more than one `.container`.** The navbar has its own. Measuring `document.querySelector('.container')` returns the navbar's and gives the wrong answer — this cost a full wrong turn during this work.

Measured on `main`, `main .container`:

| Surface | max-width | padding-inline |
|---|---|---|
| Navbar / homepage / shared components (`.container`) | 1536px | `clamp()` → 20px @320, 46px @1440 |
| Feed / events / featured page bodies (now `.container-page`) | 1536px | fixed 32px at every width |
| `/collaborations` body (now `.container-narrow`) | **1000px** | fixed 32px |

The interior pages carried `class="container"` *plus* a scoped override. The override won on `max-width` and `padding`, but the element still inherited `width: 100%` from the global rule. Replacing the pair with a single class must therefore restate `width: 100%` — omitting it let `/events` overflow its viewport by 9px at 320px.

**The two gutter conventions are not reconciled here.** Unifying them is a visual change on every interior page. Logged as a follow-up.

---

## 4. Feed-item contract (the EPIC-001 deliverable)

**Question the epic asks: can an article slot into the existing Feed without a visual or structural change?**

**Answer: yes — and it already does.** This is not a forward-looking design; it is what `main` ships today.

`/feed` already merges `getArticles()` with videos and renders both through the same `ContentCard`. The contract is:

```ts
interface FeedItem {
  title: string;          // required — card heading
  link: string;           // required — card href
  date: string;           // required — badge text + sort key
  image?: string;         // card thumbnail (videos pass `thumbnail`, normalised to `image`)
  category?: string;      // badge label fallback
  tags?: string[];        // drives client-side category filtering via data-categories
  type: 'article' | 'video';
}
```

Verified properties:

- **No video-specific coupling.** There is no `duration` field. `ContentCard` branches on `contentType === 'video' || type === 'video'` purely to choose a modal-open handler over an anchor, and to label the CTA "Watch Now" vs **"Read Now"** — the article path already exists and is already styled.
- **Filtering is generic.** `data-categories` is built from `tags` + `category`, so articles participate in the quadrant filter with no extra work.
- **The only article-specific behaviour is the link target.** Articles render as `href={item.link}` with `target="_blank" rel="noopener noreferrer"` — i.e. straight out to Substack.

**Consequence for EPIC-001:** its Phase 2 ("Feed integration") is essentially already built. The work reduces to pointing `item.link` at the internal `/intel/<slug>` route and dropping `target="_blank"` for articles. No new card variant, no Feed redesign, no contract change.

---

## 5. The one intentional visual change — `Button.astro` (APPROVED, shipped)

`Button.astro` re-declared `.cta-button-primary` in a scoped `<style>`, duplicating `styles/modules/buttons.css`. The copy was identical except that it omitted `white-space: nowrap`.

The duplicate was not inert. `about.css:240` holds a *global* `@media (max-width: 768px)` override (`padding: 1rem 2rem; font-size: 0.75rem`) that shrinks every button on mobile. `Button.astro`'s scoped copy sat later in the cascade at equal specificity and suppressed it. 17 buttons are written with the raw class and obeyed the mobile rule; the single `<Button />` instance — "Back to Home" on the 404 page — did not, and rendered at desktop size on phones.

**Owner approved the fix; the duplicate is deleted.** Verified after:

| viewport | `/404` | `/about` | `/collaborations` |
|---|---|---|---|
| 390px | `16px 32px` / `12px` | `16px 32px` / `12px` | `16px 32px` / `12px` |
| 1440px | `16px 48px` / `12.8px` | `16px 48px` / `12.8px` | `16px 48px` / `12.8px` |

Blast radius, measured: **3 of 52 captures changed** — `404@320`, `404@390`, `404@768`. `404@1440` is unchanged, confirming the change is confined to the mobile breakpoint, and the other 12 routes are untouched.

Remaining smell, logged below: a global `.cta-button-primary` override living inside `about.css` is why this was hard to spot in the first place.

---

## 6. Verification

`scripts/visual-parity.mjs` was added for this work — issues #50 and #60 both state the repo has no visual regression tooling, which is now out of date. It serves the built `dist/client`, screenshots 13 routes × 4 widths (320/390/768/1440), and hashes each capture; a pure refactor should produce byte-identical output.

```
npm run build && node scripts/visual-parity.mjs --save baseline
# ...refactor...
npm run build && node scripts/visual-parity.mjs --save after
node scripts/visual-parity.mjs --compare baseline after
```

The harness was validated for determinism first (two consecutive captures with no code change: 52/52 identical), so a hash mismatch is a real signal rather than rendering noise.

**Result: 52/52 byte-identical for the extraction work** (`baseline` → `final`), then **3 intended changes** from the approved Button fix (`final` → `button-fix`), all three confined to the 404 page below 768px. Net against the original baseline: 49 identical, 3 intentionally changed.
Plus `npm test` 104/104 passing across 8 suites, and `npx astro check` at 0 errors / 0 warnings / 0 hints (unchanged from baseline).

---

## 7. Follow-up tickets to log

1. **Reconcile the two container gutters** — `.container` (responsive clamp) vs `.container-page` (fixed 2rem). Visual change on every interior page; needs a deliberate pass. §3.
2. ~~**`Button.astro` duplicate + the 404 mobile button inconsistency**~~ — **DONE.** Approved and shipped, see §5.
3. **Move the global `.cta-button-primary` mobile override out of `about.css`** into `buttons.css`, where the base rule lives. A site-wide button rule sitting in a page-specific module is exactly why the §5 bug survived unnoticed. Pure move, but it changes cascade order, so it wants its own visual-parity run.
4. **Contributors/team CMS for byline** — EPIC-001 asked whether this already exists as an issue. **It does not.** #38 covers the *content* ("add Andrew Baxter as Founder & Editor") but there is no contributors data-layer ticket.
5. **Sitewide hardcoded-string audit** — 24 literal `"BE Unconventional HQ"` occurrences despite `site.name` existing. Out of scope here per the epic's own instruction to log rather than absorb.
6. **`/intel` and `/feed/articles` coexist — DECIDED (owner, this session).** EPIC-001's dedicated article section does *not* replace the existing `/feed/articles` route; both ship. `/feed/articles` stays the type-filtered view of the main Feed, `/intel` becomes the dedicated section with its own category filtering.

   Two consequences EPIC-001 must handle rather than discover late:
   - **Both routes list the same articles**, so they are duplicate-content candidates. `/feed/articles` is already in the sitemap. Decide the canonical relationship during EPIC-001's SEO phase — self-canonical on `/intel`, with `/feed/articles` left as a browse surface, is the obvious shape.
   - **Both must link cards to the same place** (`/intel/<slug>`), or the two surfaces will disagree about where an article lives. Since both render through the shared `ContentCard`, this is one change, not two — see the Feed-item contract in §4.

---

## 8. Notes for EPIC-001 (repo-vs-spec conflicts)

Per EPIC-001's "if anything conflicts with the repo, the repo wins" rule:

- **`src/consts.ts` should not be created.** The repo convention is `src/data/*.js` (`site.js`, `constants.js`, `categories.js`). The `Intel` section constant belongs there.
- **The Sanity override layer conflicts with the documented architecture.** CLAUDE.md records a deliberate pivot away from Sanity as a runtime data source; `@sanity/client` is imported only by `scripts/`, never by `src/`. The established override mechanism is now `/local-cms` over `src/data/videos.json`. Recommend articles follow the local-JSON pattern.
- **Category labels are `Film`, not `Movies`** — `CATEGORIES` is `['Film', 'TV', 'Games', 'Events', 'General']`. The tagging guide must match, or tag mapping silently fails.
- **`sanitize-html` is not installed.**
- **The article archive is already 2 records deep** (`src/data/cache/articles.json`). EPIC-001's correction #2 treats rolling-window archive loss as a future risk; it has already happened. The backfill follow-up is most of the archive, not polish.
- **`QuadrantFilter`'s `isNavMode` prop is dead** — the component destructures only `showTypes`. Call sites pass `isNavMode` and it does nothing. Preserved as-is (passing it through `FeedLayout`) to avoid changing behaviour, but do not build on it.
