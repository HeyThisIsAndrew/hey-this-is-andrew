# BE Unconventional HQ — agent guide

Cinematic entertainment-media site. Astro 7 (static output + `@astrojs/cloudflare`),
Tailwind v4 (via `@tailwindcss/vite`). Video/short/live/event/featuredBrand content
is a local JSON store (`src/data/videos.json`) — see "Data flow" below for the
architecture pivot away from Sanity as the runtime data source. Deployed on Cloudflare.

**Status: V4 is final.** The design is locked and the site is in bug-fix and
maintenance mode. Fix bugs and keep things working; do not redesign or add
features unless the owner asks.

## Commands

- `npm test` — offline unit suites (no network/credentials): events date helpers,
  live-status, video merge, taxonomy sync. Run before committing lib changes.
- `npm run build` — production build. Fully offline: video/short/live/event/
  featuredBrand data is bundled from `src/data/videos.json` at build time, no
  network fetch involved. (Article syncs from Substack's posts API can still fail
  offline; those pages try/catch to empty data by design, so the build still
  proves compilation.)
- `npx astro check` — type check. The bar is: introduce zero NEW errors (baseline
  is 0/0/0 as of the Astro 7 migration — CI will show any new count directly).
- `npm run dev` — dev server. It no longer refreshes a content cache first:
  the legacy RSS/scrape cache and its `refresh-content` script are deleted
  (see "Data flow"). Content comes from `npm run sync` and is committed.
- `npm run deploy` — wrangler deploy of the built worker (`dist/server`).
  Production target is **Cloudflare Workers**, NOT Pages — Pages serves only
  `dist/client` and 404s every `/api/*` route (@astrojs/cloudflare v13 is
  Workers-only). **Production deploys from GitHub Actions**
  (`.github/workflows/deploy.yml`), not Cloudflare Workers Builds, whose
  queue stuck on 2026-09-24 and left the site on a pre-merge version with
  nothing saying so. The workflow stamps the commit into the page
  (`<meta name="build-sha">`) and FAILS unless production serves it
  afterwards. Runbook: `scripts/deploy.md`.

## Hard rules (learned the expensive way)

1. **Calendar dates are `YYYY-MM-DD` strings.** Never `new Date("YYYY-MM-DD")` —
   it UTC-shifts to the prior day west of Greenwich. Use `src/lib/events.ts`
   (`parseEventDateToLocal`, `toYMD`, `getEventStatus`, `formatEventDateRange`).
   Compare dates as same-precision strings. `scripts/events.test.mjs` guards this.
2. *(Retired in V4: HeroTrailer.astro was deleted once nothing rendered it.
   The number is kept because code cites the rules by number.)*
3. **No `overflow: hidden` on any ancestor of a YouTube iframe** — iOS Safari
   renders the iframe as a black box. Isolate clipping to sibling background
   wrappers (see `.event-hero-bg-wrapper` in the `[slug]` pages).
   `content-visibility: auto` clips too (it implies paint containment): the
   homepage's below-the-fold sections use it for the mobile layout cost, and
   each drops it via `:has(iframe)`; Featured (a player host) is never in the
   list. `scripts/home-content-visibility.test.mjs` guards it.
4. **Never assign an iframe `src = ''`** — it resolves to the current page URL
   and silently reloads the site inside the iframe. Use `'about:blank'`.
5. **`videos.json` docs have THREE field classes** (epic #34, pivoted off Sanity):
   FACTUAL (YouTube facts — synced every run), DERIVED (topics/hubs/requiresReview
   — recomputed from YouTube tags every run UNLESS `manualTaxonomyOverride` is on:
   the Sync Lock), EDITORIAL (featured, notes, … — seeded once, never overwritten).
   Clean Tier-1 tag matches auto-publish; the sync never demotes a status a human
   set. Topic keywords are hardcoded seeds (`TIER1_TOPIC_SEEDS` in
   `scripts/sync-youtube.mjs` — Tier-1 categories are fixed, not editor-managed).
   Hub keywords (`youtubeSyncKeywords` on `event`/`featuredBrand` docs) are read
   from `src/data/videos.json` itself (`extractHubSeeds()`) — this is the local
   equivalent of the old "build the dictionary FROM SANITY every run"; still
   never hardcode hub keywords in the script. `scripts/sync-youtube.mjs` is
   dry-run by default — pass `--execute` to write.
6. **No `filter: drop-shadow` on `<img>`** — known iOS Safari rendering bugs.
7. **Rearrange layouts with responsive CSS / grid areas, not JS reordering or
   duplicated per-breakpoint markup.**
8. **See `scripts/astro-declined-features.md`** for why incremental builds, LQIP placeholders, and the Sanity content loader are explicitly declined. Do not re-propose them.
9. *(Retired in V4: the homepage splash intro, Hero.astro and splash.css were
   deleted. The number is kept because code cites the rules by number.)*
10. **`.spotlight-slide` ships `opacity: 0; visibility: hidden`, so the first
   slide's `is-current` must be rendered SERVER-SIDE** (`index === 0` in
   HomeSpotlightBar.astro). When only the script applied it, the band was
   blank without JS — measured on the built site, 0 of 3 slides visible in
   both instances — and the homepage's LCP element (that slide's art) sat
   decoded and hidden waiting for the bundle: LCP phases were load delay 13ms,
   load duration 125ms, render delay **1016ms**. Never make the first slide's
   visibility depend on JS again.
11. **There is more than one YouTube player, and a fix to one is not a fix to
   the site.** They are `#video-modal` (Layout.astro, opened by a card),
   `#hero-iframe` (FeedSpotlightHero, the /feed hero stage), FeaturedHighlights
   (homepage shelf, via the IFrame API, ONE player reused across every slide),
   and the event/hub stages.
   A reader trapped by a YouTube sign-in wall on /feed was "fixed" in the modal
   alone, which was the one player he was not using. Fixing that then covered
   two players and stopped, so the hub and event stages went a second round
   without a door: **the escape hatch is on every player EXCEPT the two event
   stages** (EventFeatured, EventAnnouncement), which the owner removed on
   purpose: an event page is the HQ's hub for someone else's event, not a
   funnel to that event's YouTube channel, and the link sat over the player.
   A refused embed there has no door; that trade is accepted, so do not
   "restore" it. The homepage hero accordion's inline player is the sixth and
   carries one, rendered always but HIDDEN on phone portrait (also the
   owner's call: the portrait hero was too busy, and the embed shows
   YouTube's own logo link).
   The article video tile (`<youtube-embed>`, YouTubeEmbed.astro) is the
   seventh: it opened `#video-modal` until 2026-10 and now plays in place
   (the owner is retiring the modal on desktop), through `playWhenReady`,
   with its "Watch on YouTube" link rendered under the tile from the start. FeaturedHighlights (the homepage Featured box) went
   without one until the site-wide audit: its door is the lead card's own
   "Watch now" (with the YouTube mark), a real link to the video on YouTube.
   A link cannot sit in a `role="button"` (axe nested-interactive), so a hero
   video card (`isHeroPlayer` in ContentCard) is NOT the button: its play
   mark is a real `<button>` and the card's inline-play handler ignores
   clicks on links. A second link under the card duplicated it and was
   removed (the owner's call). Otherwise
   `scripts/embed-escape.test.mjs` asserts every one of them in a single file,
   for the reason event-hero-lockup.test.mjs gives. The three stages
   (`/featured/[slug]`, EventFeatured, EventAnnouncement) are near-identical
   triplets, so they carry only the markup: the rule is global in
   `styles/modules/stage-watch.css` and the wiring is `src/lib/stage-watch-link.ts`,
   mounted once from Layout. It reads the id back off the FRAME with
   `parseVideoId()`, not out of an event detail, because each of those files
   assigns the frame a src in FOUR places and the two ambient ones hold a
   `data-src` with no id in scope at all. `parseVideoId()` did not recognise a
   `youtube-nocookie.com/embed/` URL until then, which is every embed the site
   serves, and its host is now anchored so `evil-youtube.com` no longer parses
   as YouTube. **No embed carries `autoplay=1` with sound.** The stage did and the
   modal did not, and that was the only difference between the player that
   walled him and the player that played for him on the same machine; an embed
   that starts itself is what YouTube's bot check looks for, and it is decided
   per viewer, so it reproduces for one reader and for nobody testing it. The
   stage starts through the jsapi `playVideo` command instead, so the visitor
   still gets one click. **That command must wait for the player's `onReady`**:
   both heroes once sent it on the iframe's `load` event, which fires a few
   hundred ms before YouTube's player inside the frame is listening, so it
   was dropped and every reader pressed play twice. The homepage hero and the
   /feed hero now start through `src/lib/youtube-start.ts` (`playWhenReady`),
   which handshakes until the player answers, asks on `onReady`, retries until
   PLAYING, and keeps the frame transparent until then; a new player should
   use it too. iOS Safari may still refuse an unmuted start that is not inside
   the reader's own gesture, which leaves YouTube's own play button: one more
   tap, never a dead end. `scripts/youtube-start.test.mjs` guards the helper.
   **The three hub/event stages (`/featured/[slug]`, EventFeatured,
   EventAnnouncement) now start through `playWhenReady` too** (owner's call,
   2026-09): no src on them carries `autoplay=1`, the ambient trailer
   included, and each of their FOUR frame loads is followed by
   `startStage(frame)`. They still try sound first on a press and reload muted
   if the player has not reached PLAYING within `HUB_START_GRACE_MS` (3s,
   longer than the old 1.5s because the start now waits for `onReady`), and
   they still never unmute a video that is ALREADY running. That muted
   fallback is the path to test on a real iPhone. **Every YouTube frame the
   site writes must allow fullscreen**: the fullscreen fix once landed on two
   players and left these three with `allow="autoplay; encrypted-media"`, so
   YouTube's fullscreen button was dead on every hub and event hero.
   `scripts/embed-escape.test.mjs` asserts both over every file that writes an
   iframe, and fails when a new one is added without being listed. **The "Watch on YouTube" link is rendered ALWAYS**, never
   gated on detecting the failure: a detector that silently stops firing puts
   the reader back in the trap with nothing on screen saying so. **On the hub
   stage (`/featured/[slug]`) it lives in the hero's action row beside Play
   trailer, never over the stage**: as stage chrome it sat bottom left, which
   is where every rail pane puts its own Play / Read button, and the two
   overlapped at every width. It names the video the stage is SHOWING (the
   active rail pane's video, else the frame's) and is hidden for an article
   pane and for the hub's own TRAILER. The trailer exception is the owner's
   call ("the trailer is its own thing"); it is decided by content, not by
   detecting a failure, so it does not break the rule above.
12. **Pausing an embed belongs to `src/lib/embed-pause.ts` and nowhere else.**
   Mounted once from Layout, it pauses every playing embed on
   `document.hidden` and resumes only what it paused. Reported as duplicate
   audio: a video opened in a new tab while the homepage shelf played on
   behind it. FeaturedHighlights already paused on its own "Watch now" click
   and still lost the case, because a middle click fires `auxclick` and "Open
   link in new tab" from the context menu fires no click at all. **Pausing per
   route is how you miss routes.** Two things it must never do: decide
   muted-ness from the embed URL (the event and hub stages ship `mute=1` and
   then unmute by command, so the src lies about the sound) and touch the DOM on the
   message path (a playing embed posts several `infoDelivery` messages a
   second). It also owns the two other ways a video plays on
   behind the reader: a click on any `target="_blank"` link pauses what is
   playing and marks it NOT to be resumed on return (the reader went to
   watch it on YouTube; `leftForLink` survives a PLAYING report already in
   flight), and a frame scrolled out of the viewport is paused, resuming on
   the way back only if it is a BACKGROUND embed, never a video the reader
   started. Background means `data-embed-ambient="1"` on the frame, set by
   whoever starts it on the reader's behalf: FeaturedHighlights' muted preview
   (on `onReady`) and a hub/event stage when it loads its trailer (cleared when
   the reader picks a video). It used to mean `autoplay=1` in the src, which
   hard rule 11 has removed from every live player (and the global QA sweep
   fails the build if a shipped script contains it). Components may stop their own rotation timers on scroll,
   never their players: FeaturedHighlights used to pause and play its own.
   `scripts/embed-pause.test.mjs` guards all of it.

## Data flow

**Architecture pivot (in progress):** video/short/live/event/featuredBrand content
moved from Sanity (live GROQ queries) to a local JSON store, `src/data/videos.json`
— a statically-imported bundle, not a runtime fetch, so pages render real content
with zero network access. `scripts/sync-youtube.mjs` is the YouTube → local JSON
sync (see hard rule 5). Sanity is still used for two things: image hosting (event/
featuredBrand `logo`/`heroImage` are real Sanity asset references; `urlFor()` in
`src/lib/local-content.ts` builds `cdn.sanity.io` URLs from a static
`{projectId, dataset}` config — no live client needed) and the Studio at `/admin`.

- **Videos/shorts/live:** pages call `getVideosUnified()` / `getShortsUnified()` /
  `getLiveStreamsUnified()` (`src/lib/videos-source.ts`) — filters
  `src/data/videos.json` through the same merge logic (`src/lib/videos.ts`) that
  used to run against Sanity. **The legacy RSS/scrape cache is GONE, not just
  unused.** `src/data/cache/videos.json`, `src/data/cache/articles.json`,
  their only reader (`src/data/feeds.js`, which nothing imported), both
  writers (`scripts/fetch-feeds.mjs` and the orphaned `scripts/fetch-rss.mjs`)
  and the `refresh-content` / `build:live` / `start:full` npm scripts were all
  deleted together. Every one of them was dead, and the cost of leaving them
  was not theoretical: `npm run dev` re-fetched the YouTube RSS on every run
  and rewrote a file nothing read, so a retitled video would show up as an
  unrelated diff in whatever PR was open. `src/data/cache/` still exists for
  `channel-stats.json` and `social-stats.json`, which `/media-kit` does read.
  Video categorisation (`categorize()`) survived that module as
  `src/data/categorize.js`.
- **Articles:** Substack's internal `/api/v1/posts` JSON endpoint via
  `scripts/sync-articles.mjs` (no Sanity schema ever). Replaced the public `/feed`
  RSS source because RSS's `<category>` element drops most of a post's tags —
  the JSON API's `postTags` carries the full set, which the category/content-type
  mapping and "More From" related-article matching both depend on. Same
  never-delete merge contract as the RSS era (`mergeSnapshot()` in
  `src/lib/articles-transform.ts`); only the fetch and raw-shape mapping changed.
  Undocumented endpoint, so treat it like the YouTube sync's Sync Lock: loud,
  non-fatal failures only — a broken/blocked endpoint must never blank
  `src/data/articles.json`.
- **Events / featured brands:** `getEventsLocal()` / `getFeaturedBrandsLocal()`
  (`src/lib/local-content.ts`), filtering `src/data/videos.json` by `_type`. CLS-
  prevention image dimensions are parsed from the Sanity asset `_ref`'s own
  `image-<hash>-<W>x<H>-<ext>` naming convention, not a GROQ `asset->metadata`
  dereference. "Hub coverage" (videos tagged to a specific event/brand) matches
  `video.hubs` (slugs) against `event.slug.current` / `brand.slug.current` — hubs
  are slugs in the local sync, not Sanity `_id` references, so this replaces the
  old `references($hubId)` GROQ query, it isn't a shortcut around it.
- **Coverage matching is ONE function**, `collectHubCoverage()` in
  `src/lib/hub-coverage.ts`, shared by `/featured/[slug]` and `/events/[slug]`.
  Videos come from `video.hubs` when anything is hub-tagged, and fall back to
  exact NORMALIZED tag matching otherwise; articles have no `hubs` field (they
  sync from Substack) so they are always tag-matched. Never substring-match:
  the event page used to, and it returned zero articles for all 19 events
  while looking like the events simply had no coverage. Shorts and live
  streams are excluded at each CALL SITE, not inside the matcher, so the
  decision stays visible — and so an event page and its overflow feed derive
  the identical list.
  **There is ONE tag list per hub: `youtubeSyncKeywords`, labelled "Tags" in
  the CMS.** There used to be two — a `coverageTags` the site read and a
  `youtubeSyncKeywords` the sync read — and keeping them in step meant
  copy-pasting the same list into two boxes, which is how they drifted. They
  are merged. The one list feeds both `extractHubSeeds()` during the YouTube
  sync AND `getHubMatchTags()` when the site matches articles, so a tag added
  for one purpose serves the other. `getHubMatchTags()` still reads a
  `coverageTags` if it finds one, purely so an un-migrated document does not
  silently lose its coverage; no document in the store carries the field and
  `scripts/event-coverage.test.mjs` fails if one reappears.
- **Tags compare with their spaces closed up** (`compactTag`), so
  "SDCC 2026", "SDCC2026" and "sdcc-2026" are one tag. That is a strict
  widening of exact matching, not a step back toward substrings: "marvel"
  and "marvelstudios" are still different. **The YEAR is what separates one
  edition from the next** — "SDCC 2026" never matches "SDCC 2027" — so every
  recurring event's tags must name its year, in either the four-digit form
  ("pax west 2026") or the two-digit one ("paxwest26") the channel and
  attendees actually write. `scripts/event-coverage.test.mjs` fails if a
  seeded non-premiere event carries a tag naming neither, which is what a
  bare "pax" would be: a tag that claims every edition there has ever been.
- **`excludeCoverage` is the override**, listing article slugs/guids, YouTube
  ids or `_id`s to drop from a hub whatever the tags say. It exists for the
  one case tagging cannot settle: a retrospective, where a post about SDCC
  written in 2027 could be about either edition. **Do not infer the edition
  from the publish date.** It reads plausibly and gets retrospectives
  backwards silently, and wrong coverage on an event page is worse than none
  because nobody notices it. Exclusions apply to hub-TAGGED videos too, so an
  editor never has to know which code path put an item on the page.
- **Event pages cap coverage at six** (`COVERAGE_PAGE_LIMIT`) and overflow to
  `/events/<slug>/coverage`, paginated at 12 — the same display-cap-plus-
  overflow-route pattern "Past Event Archive" uses on `/events`. The overflow
  route builds only for events that have coverage.
- **The "Official <X> Hub" card is `HubCard.astro`**, used by the event
  template AND the article rail. Its heading comes from the hub's own
  `hubCategory` via `getHubKindHeading()` in `src/lib/hub-labels.ts`
  (Franchise / Streamer / Studio / Gaming, falling back to a bare "Official
  Hub"). It was hardcoded as "Official Franchise Hub", which called Netflix a
  franchise. `gaming` is **"Gaming"**, not "Game": the labels are written out
  rather than de-pluralised because that is the one case chopping an "s"
  gets wrong. `hub-labels.ts` is separate from `local-content.ts` because the
  latter statically imports `videos.json`, which plain `node` refuses without
  a type attribute, so the labels were untestable there.
- **An event is TOLD its hub, an article infers one.** Events carry
  `relatedBrandSlug` (editorial, set in the CMS). Articles sync from Substack
  and have no such field, so `findHubForItem()` (`hub-coverage.ts`) scores
  each hub by how many of its tags the piece carries and returns the best.
  Scoring, not first-match: the Spider-Man review is tagged for Marvel
  Studios, the MCU, Marvel AND Sony Pictures. Ties break on slug so builds
  are deterministic. Known limit, accepted: scoring rewards the hub with the
  LONGEST keyword list, so a GTA piece that mentions Netflix lands on
  Netflix. **`pinnedCoverage`** on a hub doc is the override and beats
  scoring outright; it also adds the item to that hub's coverage, because
  "belongs to this hub" has to mean both. **Precedence is
  `excludeCoverage` > `pinnedCoverage` > tags**, since exclude is what an
  editor reaches for to undo a mistake.
- **Event page metadata is `src/lib/event-seo.ts`**, shared by both event
  templates so they cannot drift: the og:image (a 1200x630 crop of the hero,
  not the site default), the `<title>` via the site-wide `pageTitle()` helper
  (Layout appends NOTHING to `<title>`, so a page that does not call it ships
  brandless), a 120-160 character description built from the event's own kind,
  place and dates, and `schema.org/Event` into Layout's `<slot name="head">`.
  Dates go in as the stored `YYYY-MM-DD` strings (hard rule 1) and an event
  missing a name or a start date emits NO node, because Search Console reports
  a partial one as an error.
- **`script-src` must never allow `data:`.** A QA swarm reported the CSP
  blocking a `data:application/javascript` script on `/featured/*` and
  recommended allowing it, attributing it to a tracking script. It is Astro
  ClientRouter's own EMPTY flush script (the URI ends at the comma), no
  analytics vendor is involved, and blocking it was measured to break nothing:
  served under the real policy, 23 module scripts still executed after a
  client-side navigation and the hub filters still bound and toggled.
  Allowing `data:` there is an XSS amplifier bought with a console warning.
  `scripts/headers-integrity.test.mjs` guards it, reading the POLICY LINE and
  not the file, because "script-src" also appears in a comment above it.
- **The article support rail STACKS below 1200px, it does not vanish.**
  `article.css` used to hide `.article-rail` outright, so a phone reader got
  no hub card, no editorial desk and no Support The HQ. Now only
  `.article-rail-left` (the TOC) is hidden, plus `.article-rail-more`, because
  the column already renders "Suggested Reading" at every width and the rail's
  copy would print it twice. The stacked gap is paid for ONCE: `row-gap` on
  the layout, and the first visible rail block drops its own margin (reach it
  as `.article-rail-more + *`, since `display: none` does not stop
  `:first-child` matching the hidden element).
- **A body image opens the lightbox, never a tab, and is not a link.**
  Substack wraps body images in a `target="_blank"` link to its CDN.
  `labelImageLinks()` replaces each one whose href is the image itself with a
  `<button data-lightbox-image>` that SubstackGallery.astro opens in the
  gallery's lightbox. A button rather than a same-tab link is the owner's
  call: any href left in place still sent readers to Substack on
  Cmd/Ctrl-click, a middle click or "Open link in new tab". An image the
  author linked to a real page stays a link.
- **ARTICLES/VIDEOS filters are scoped BY NAME**: `data-coverage="hub"` on the
  hub page, `data-coverage="event"` on event pages, each handler querying its
  own. Astro's ClientRouter keeps both modules alive across a navigation
  between the two, so a bare `[data-coverage]` on both reunites them and
  reproduces the original deep-link bug. The row renders only when both
  content kinds are actually on screen.
  LocalCmsApp creates *and* edits `event`/`featuredBrand` docs (the "New
  Featured" / "New event" buttons) — the old "no local flow to create one"
  gap is closed. Hubs still carry Sanity asset refs for `logo`/`heroImage`
  from the original export; new ones upload through the CMS instead.
  A `featuredBrand` owns everything /featured renders about it:
  `hubCategory` (which accordion row it sits in), `brandColor.hex` (its glow,
  row tint and button — the RGB triple is derived from this, never stored),
  `description` (the line under the logo), `backdrops` (optional stills for
  the cross-fading backdrop) and `youtubeSyncKeywords`. None of
  these are hardcoded in `src/pages/featured/index.astro` any more; adding a
  hub is a data edit. Adding a *category* is still a code change, by design —
  the four rows are a design decision, not editor content.
- **Hub backdrops:** `getHubBackdrop()` (`src/lib/local-content.ts`) returns the
  ONE image behind a hub — its `backdrops[0]` override if set, else its
  `heroImage`, else nothing. It is blurred past any detail and drifts slowly, so
  it is always requested SMALL (640px on /featured, 900px on a hub page).
  **Never source it from video thumbnails.** An earlier version cross-faded up
  to six stills gathered from videos tagged to the hub and then from its
  category; those thumbnails are the channel's own covers, which are frequently
  a photo of the presenter, so hubs ended up backed by the site owner's face. A
  hub is somebody else's brand.
  The wrapper clips and the plate overscans past it — a CSS blur goes weak at
  its own edges, and left flush that near-sharp band shows behind the row
  heading. For the same reason the top/bottom scrims must reach **alpha 1** and
  hold it: at 0.95 a strip of the drifting plate showed at the panel edge, and
  because the plate moves, it read as a leak that grew over time.
- **The /featured stage (right half of an open row):** built from the hub's
  **logo**, not its key art — `heroImage` is already the deck card AND the nav
  thumbnail, so reusing it a third time made a row one image at three sizes.
  The mark sits crisp and large over a blown-up, blurred copy of itself
  (`.backdrop-plate--mark`), on a brand-tinted `.stage-wash` that needs no asset
  at all. Where a hub has a `trailerUrl`, the trailer fades in over the mark,
  **plays once**, and dissolves back to it — never loops (looping is what
  flashed YouTube's title bar back), and never full-bleed (its play overlay and
  captions render dead centre, where no crop reaches them; inset, they land
  inside a smaller framed plate). At most one player exists on the page: a
  collapsed row's frame is *unloaded* to `about:blank`, not hidden. Desktop
  only, gated identically in JS and CSS. The stage is a **sibling** of the
  clipping backdrop wrapper — hard rule 3 forbids any clipping ancestor.
  `scripts/featured-containment.test.mjs` guards all of this.
- **BOTH heroes — event AND hub — have THREE mark slots and THREE logo
  fields.** `/featured/[slug].astro` is where the event hero was lifted from
  and it had all three of the same problems, so `heroLogo`, `stageLogo` and
  `stageShowMark` exist on `featuredBrand` too and mean exactly the same
  things. The hub stage's art comes through `getHubBackdrop()`, NOT straight
  off `heroImage`: that function is the one place that decides what a hub
  looks like (`backdrops[0]` first, key art second) and going around it is how
  the stage and the backdrop come to disagree about the same hub. Both heroes
  are guarded by `scripts/event-hero-lockup.test.mjs` — deliberately one file,
  because they drift apart the moment a fix lands in only one of them.
- **The event hero has THREE mark slots and THREE logo fields.** `.hero-logo`
  (small, top left) reads `heroLogo || logo`; `.hub-stage-mark` (large, in the
  frame the trailer plays in) reads `stageLogo || logo`; `.hub-stage-plate`
  (the blurred ghost feathering the right half) reads whatever is in front of
  it. All three used to read `logo` alone, so a hero read as the same event
  three times over, and worse on a series: PAX West, East, Aus and Unplugged
  all point `logo` at one shared PAX wordmark, so four events were visually
  identical. Each override touches ONE slot; `heroLogo` must never reach the
  stage, or the asset is back in two places.
- **The stage's idle state is KEY ART, not a mark.** The hero already states
  the identity at the top left and the tagline falls back to the event's own
  name directly under it, so a 520px mark in the frame was the same thing a
  third time on one screen. Measured on the Doomsday premiere: the logo asset
  appeared 3 times in the hero markup, now 1. `stageShowMark` (default OFF)
  puts a mark back for an event that genuinely wants one. The ghost follows
  whatever is in front of it — the mark in mark mode, the key art in art mode
  — because a logo-shaped glow around a frame with no logo in it is a leftover
  of a lockup that is not there, and it was one more appearance of the mark.
  **Art mode is a MODIFIER on `.hub-stage-mark`, never a second layer**: every
  state the stage has (`is-playing` → 0.28, `is-item` → 0, reduced-motion)
  is written against that one element, so a new layer would need all three
  rewritten and would silently miss one. The stage never clips (hard rule 3).
  **The placeholder is the picture, all of it, unblurred.** It shipped once
  blurred and overscanned, borrowing the treatment every other plate on this
  page uses, and that was wrong twice: still an effect applied to the art
  rather than the art, and the overscan zoomed it. Then it was `cover`, which
  was an exact fit on the 17 events whose art is 16:9 and cut the other two
  in half: L.A. Comic Con is 2.35:1 and SXSW is 2.70:1, and both set the
  event's NAME across the full width of the artwork, so cover removed the
  first and last letters of its own title. **Two copies of one file**: the
  front one `contain`s (the whole image, never cropped, whatever shape an
  editor uploads) and the back one `cover`s, blurred and darkened, visible
  only in the gutters the front one leaves. Same `src` and `srcset`, so it is
  one fetch painted twice, and on 16:9 art the fill is never visible at all.
  The fill is overscanned with `transform: scale()` on the IMAGE and the
  layer clips — scaling the clipping box is what leaked light on the deck
  page. **Losing the blur inverts the request-size convention**: a
  blurred plate is deliberately asked for small (640px on /featured, 900px on
  a hub page) because the blur destroys more than the upsample costs, but a
  crisp still needs a ladder built from the box — `STAGE_WIDTHS` tops out at
  1520 for 2x of the 760px stage, with real `sizes` so a phone does not fetch
  a viewport-wide image for a 343px box. D23 (768x432) and SDCC 2027
  (1024x576) are the only key art too small to fill it at 2x.
- **The hero's "Event Details" button goes to `#event-details`, on this
  page.** It was outbound, through two wrong destinations: `signUpLink` (an
  Axs ticket listing for The Game Awards, a newsletter form for PAX East),
  then `officialWebsite`, which fixed the destination without questioning the
  direction. The direction was the bug, reported as "a friend of mine clicked
  it and then they left the site". The page has a section headed DETAILS at
  that anchor carrying the dates, venue, Tickets/RSVP and the official site,
  and the button's label is the same words as that heading. The outbound
  links are REPOSITIONED, not deleted: `officialWebsite` is the Website row
  and `signUpLink` is Tickets/RSVP, both inside that section, which is the
  right place in the funnel (after the coverage, not in front of it). It
  matters most on a phone: `.article-rail-left`, the TOC that also links
  there, is hidden below 1200px, so the button is the only thing in a mobile
  hero saying anything exists below it. The CTA row is UNCONDITIONAL now,
  which is load-bearing rather than tidy: while it was gated on a URL a
  document might not have, four events rendered a different grid from the
  rest, and that is half of what moved the metadata row around.
- **The metadata row's vertical position must not depend on the event.** It
  used to move twice over: the copy column was `align-self: end`, so it sized
  to its own content with its BOTTOM pinned, and a taller logo pushed the tags
  up while `.has-cta` (which adds a grid row, shortening the 1fr row above it)
  moved the edge they were pinned to. Measured at 1440x900: 18px of drift
  across logo heights, 32px between an event with a CTA and one without. The
  column stretches now and `.hero-identity` takes `margin-top: auto`, so the
  eyebrow sits at the top of the grid and the lockup stays bottom-anchored.
  `scripts/event-hero-lockup.test.mjs` guards all three of these.
- **The hero grid is keyed on the STAGE, never the trailer.** The two-column
  areas live under `.has-stage`, which every event and hub hero carries
  because the stage always renders (no trailer means it rests on the key
  art). It was `.has-trailer`, so all seven events without a `trailerUrl`
  stacked into one column in production, LA Comic Con with its rail pane
  auto-selected into a screen-wide card. A trailer decides only the player
  (`data-trailer`, Play trailer, the rail's handover): a stage with no trailer
  selects nothing until the reader picks a tile. The wide-screen `1fr 1.2fr`
  ratio is scoped CSS under `.has-stage`, never a `2xl:` grid utility, which
  set columns with no areas. `scripts/e2e-event-hero-layout.test.mjs` renders
  every built event and hub page, with JS off and on, and asserts the layout.
- **Image fields accept two shapes.** The local CMS writes a bare ref string
  (`"image-<hash>-WxH-ext"`); the original frozen Sanity export wrote
  `{_type:'image', asset:{_ref}}`. `urlFor()` and the dimension parser both
  handle either, and the CMS reads through `refOf()` rather than a bare
  `typeof === 'string'` — which used to show D23 and SDCC 2027 as having no
  logo, whose only remedy was re-uploading an asset that was already there.
  The store itself is all strings now. The CMS's **Reuse** button opens a
  picker over every ref in `videos.json` (`collectAssetLibrary()` walks
  documents, not a fixed field list), so referencing an existing logo between
  pages never means uploading it twice.
- **Local CMS:** `/local-cms` (dev-only route, `src/components/admin/LocalCmsApp.tsx`)
  — master/detail editor over `src/data/videos.json`, backed by a dev-server-only
  Vite middleware (`localCmsMiddleware` in `astro.config.mjs`) at
  `/api/local-cms/videos` (GET reads the file, POST overwrites it). Never present
  in the production build — `configureServer` doesn't run for `astro build`.
- **Video IDs:** always `parseVideoId()` from `src/lib/platforms/youtube.ts` —
  never inline regex or URL parsing.
- **Live status:** `/api/live-status.json` (on-demand edge route,
  `prerender = false`) → `src/lib/live-status.ts` providers. The CDN cache is
  the YouTube quota gate (search.list = 100 units). See `scripts/live-status.md`.
- **THE HQ DISPATCH (the Kit newsletter) reads `/dispatch.xml`, not
  `/rss.xml`** (that one is the Google News feed; leave it alone). Runbook:
  `scripts/hq-dispatch.md`. Three rules that are easy to undo by accident:
  **newsletter images are never cropped** (`scripts/dispatch-image.mjs` fits
  the whole picture into 16:9 over a blurred copy of itself, and the email
  uses `object-fit: contain`, never `cover`); **they are never deleted**
  (`sync-dispatch-images.mjs` does not prune, because sent emails keep
  pointing at them); and **no Kit tag with its braces may appear inside an
  HTML comment in `email/hq-dispatch/template.html`** (Kit renders Liquid in
  comments too). The owner also chose: no X link in the newsletter, and a
  typed address instead of Kit's address tag.
- **Google Tag Manager is injected by Cloudflare, not by this repo.** The
  Google tag gateway adds GTM-PDDF3D6K to every production page and serves it
  first-party from `/nlsh`. The repo only pushes `{ event: 'page_view' }` on
  `astro:page-load` (Layout.astro), which every page-view tag in the container
  triggers on. Partytown used to load a second copy, and the two ran at once
  (TikTok "Duplicate Pixel ID"; the Partytown copy was served a stale
  container through `/api/proxy`, so a GA4 fix never took effect). Never add a
  gtm.js loader while the gateway is on, but DO keep the `gtm.js` start
  event push beside the page_view listener: the gateway injects only the
  loader, and without that push GA4 never loads (TikTok and Meta still fire,
  so it looks fine). Local dev loads no GTM at all.
  `scripts/gtm-single-loader.test.mjs` guards it.
  **GTM's YouTube trigger defines `window.onYouTubeIframeAPIReady` on every
  production page and then waits for a jsapi player to appear.** A loader that
  takes that callback as "the API is already coming" injects nothing, and the
  two wait on each other forever: that is how the homepage Featured shelf lost
  its player on production only (2026-10). The script tag is the evidence of a
  load in flight, never the callback. Load the API through
  `src/lib/youtube-iframe-api.ts`; `scripts/youtube-iframe-api.test.mjs`.

## Conventions

- **The global QA sweep (`npm run test:dist`, `scripts/e2e-global-qa-sweep.test.mjs`)
  runs over the BUILT site**, in CI straight after the build and again in
  the e2e job. It exists because a fix to one component kept missing its
  siblings, and a source test only sees the component in front of it. Ten
  rules, every page: (1) at most one `fetchpriority="high"` image, and its
  preload is the same request; (2) no unresized Sanity or Substack-S3
  original; (3) a srcset's largest file covers its `sizes` at 2x, evaluated
  per window width the way the browser does (blurred plates and committed
  article renditions capped at their original are exempt); (4) no YouTube
  frame or shipped script asks YouTube to start itself (`autoplay=1` or
  `autoplay: 1`), and every YouTube frame allows fullscreen, and no
  `src=""`; (5) exactly one `<h1>` (the print documents are exempt); (6)
  nothing focusable inside `aria-hidden` content unless `inert` or
  `tabindex="-1"` (closed modals and overlays carry `inert`, toggled with
  `aria-hidden`); (7) every `<img>` has an `alt`; (8) every
  `target="_blank"` link has `rel="noopener"`; (9) no em dash in visitor
  copy (article bodies are the author's own writing and are exempt); (10)
  every "Watch on YouTube" link starts with the YouTube mark
  (`.yt-mark`, the footer's `SOCIAL_ICONS.YouTube`, styled once in
  global-base.css). It
  runs in about a second. **Two rules were deliberately NOT adopted**, see
  the file's header: "aria-hidden + tabindex=-1 must also be inert" would
  break the homepage rail's visible, clickable loop clones, and "no `sizes`
  may top out near 635px" misreads `sizes` (CSS px, which the browser
  multiplies by density itself). When it fails, fix the COMPONENT, then
  look for its siblings: the failure lists every page a problem is on.
  Always size a `customHeroLogo` (`.height(320)`), use
  `getCardImageSources()` for external images, and measure `sizes` from the
  box, never copy the card grid's.

- **The homepage LCP budget** (`scripts/home-lcp-budget.test.mjs`). Measured
  on the 2026-09-24 PageSpeed reports (mobile 92, desktop 99), each rule is
  about what may download or run while the hero art (the LCP image) loads:
  `HERO_SIZES` describes the open PANEL, not `100vw` (it took 660 KiB of
  YouTube JPEG originals on desktop); the hero art is served from our own
  origin by `/img/yt/<id>/<w>.webp` (a Worker in front of wsrv.nl, edge-cached,
  falls back to YouTube's own WebP), so a phone needs no second connection for
  it; only Syne is preloaded (the Inter preload split Slow 4G bandwidth with
  the hero art); below-the-fold images Chrome's 1,250px lazy distance would
  still start early wait in `data-defer-*` until `load`
  (`src/lib/deferred-images.ts`); sections under `content-visibility: auto`
  never read layout at page load (CinematicGallery builds itself when near,
  which is why tests scroll to it and wait for `infinite-marquee[data-ready]`);
  and `is:inline` scripts ship minified by a build hook, so write comments in
  them freely. PageSpeed's mobile simulation and a real throttled phone
  disagree about two tempting changes, measured both ways: removing BOTH font
  preloads and externalising the inlined CSS each look better in one and worse
  in the other. Neither was done.
- **A card's image does what the card does.** A user test found readers
  tapping the art on heroes, cards and stage panes and getting nothing,
  because only the small title or button was live. Now every card and hero
  image runs its card's action (navigate, or play for a video). There are
  three ways to do it. A stretched `::after` on the card's one real link
  works when no transformed or positioned box sits between the link and the
  art: `animation-fill-mode: both` ending at `transform: none` still
  computes a matrix and traps it, as on the homepage hero. Where a stretch
  can't reach, use a duplicate overlay link with
  `aria-hidden="true" tabindex="-1"`, which keeps one tab stop. Stage panes
  use `src/lib/stage-item-tap.ts`, which forwards a tap to whatever Play or
  Read control the pane holds. A page's OWN hero backdrop stays inert (the
  owner's call). `scripts/e2e-tap-targets.test.mjs` taps each one on phone
  and desktop and asserts what happened, so add a check there for a new
  card type.
- `docs/` is **gitignored** — put operator docs in `scripts/*.md`.
- Offline test suites live in `scripts/*.test.mjs`, run by plain `node`
  (Node 22 native type-stripping; src/lib imports use explicit `.ts`
  extensions — `allowImportingTsExtensions` is on).
- WIP/utility routes are gated three ways: `noindex` prop on `<Layout>`,
  sitemap filter in `astro.config.mjs`, robots.txt.
  **THE SITEMAP FILTER IN `astro.config.mjs` IS THE SOURCE OF TRUTH, not this
  list.** An earlier version of this note named four routes and omitted two,
  and a review agent took that as the complete set and reported the two
  missing ones as indexable pages wrongly carrying `noindex`. They were
  correctly gated all along. Read the `filter:` array in the sitemap config
  before concluding anything about what is or is not meant to be indexed.
  Gated at the time of writing: `/events-new` (WIP, promotes to `/events`
  later), `/links` (bio-only, deliberately NOT robots-blocked so crawlers can
  read its noindex), `/admin` (Sanity Studio, header-gated via
  `public/_headers`), `/local-cms` (Local CMS, dev-only — shows a static
  "Restricted Access" message in prod), `/media-kit` and
  `/collaborations/press-kit` (standalone print/sales documents that do not
  use `<Layout>` at all, which is also why they carry no canonical — a
  noindexed page does not need one).
- The muted-grey text palette is a deliberate design trade-off; don't "fix" it
  without the owner. It does NOT, however, fail WCAG the way this note used to
  claim: an automated pass over six routes found zero failures at rest.
  `--color-white-muted` (#888888) on `--color-surface` (#111111) is 5.33:1 and
  `--color-accent-text` (#ef4444) is 5.02:1, both clearing AA. The one token
  that genuinely fails is `--color-accent` (#cc0000) at 3.21:1: it is a border
  and glow colour only, never a text or icon colour. Use `--color-accent-text`
  when red needs to be legible.
- **No em dashes in user-facing copy.** House style: split into two sentences,
  or use a comma/colon. Applies to anything a visitor reads — headings, body,
  empty states, alt text, meta descriptions. Code comments are exempt.
- `.sr-only` is global (`src/styles/global-base.css`). Card grids under an h1
  get a structural sr-only `<h2>`.
- Secrets: never committed; see `.env.example`. The sync script requires
  `--execute` to write (dry-run default).
