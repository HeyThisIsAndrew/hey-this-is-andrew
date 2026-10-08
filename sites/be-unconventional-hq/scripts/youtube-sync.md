# YouTube → Sanity Sync Pipeline

> ⚠️ **STALE as of the local-JSON pivot (epic #34).** Everything below
> describes the old pipeline: `scripts/sync-youtube.mjs` writing to Sanity
> via a write token, with review happening in the Sanity Studio. The current
> script writes straight to `src/data/videos.json` on disk — no Sanity
> writes, no `SANITY_WRITE_TOKEN`, no Studio review step, no chunked
> commits. Review happens in `/local-cms` (dev-only). For the accurate,
> verified-against-actual-code version of this pipeline, see
> `scripts/youtube-automation-test-plan.md` and hard rule 5 in `CLAUDE.md`.
> This file is kept for historical Google Cloud / API-key setup steps (§
> "Google Cloud Setup" below is still accurate) but should be rewritten or
> deleted rather than trusted as-is.

Operator and maintainer guide for the video ingestion pipeline (#21, Increment 2).

---

## Overview

### High-level architecture

```
YouTube Data API v3                     ← factual metadata source
        │
        ▼
src/lib/platforms/youtube.ts            ← isomorphic API client (Increment 1)
        │
        ▼
scripts/sync-youtube.mjs                ← ingestion/sync (this pipeline)
        │   createIfNotExists + patch(set: factual)
        ▼
Sanity  `video` documents               ← editorial source of truth
        │   GROQ
        ▼
Astro frontend                          ← queries by editorial fields (future)
```

YouTube supplies **facts** (title, duration, views, thumbnail, tags…). Sanity is
the **editorial source of truth** (franchises, characters, coverage type,
featured status, hub assignments…). The sync keeps facts fresh **without ever
touching editorial curation**.

### Data flow, per run

1. List every video on the channel's **uploads** playlist (paginated).
2. Fetch full details for those IDs in batches of 50 (`videos.list`).
3. For each video, upsert a Sanity `video` document with a deterministic
   `_id` of `youtube-<videoId>`:
   - `createIfNotExists` — first time only: seed `_id`, `_type`, `youtubeId`,
     `platform`, and the **editorial defaults** (`contentStatus: needs-review`,
     `featured: false`).
   - `patch(set: …)` — every run: overwrite the **factual** fields only.

### Fields synchronized from YouTube (overwritten every run)

| Field | Source |
|---|---|
| `youtubeId` | video id |
| `title` | `snippet.title` |
| `description` | `snippet.description` |
| `thumbnailUrl` | best of `snippet.thumbnails` |
| `durationSeconds` | `contentDetails.duration` (ISO-8601 → seconds) |
| `isShort` | derived via ping check (`youtube.com/shorts/ID` returns `200`) |
| `viewCount` | `statistics.viewCount` |
| `publishedAt` | `snippet.publishedAt` |
| `youtubeTags` | `snippet.tags` |
| `platform` | constant `"youtube"` |
| `lastSyncedAt` | sync run timestamp |

### Fields that are editorial-only (never overwritten)

`contentStatus`, `featured`, `franchises`, `characters`, `topics`,
`coverageType`, `series`, `relatedMedia`, `hubs`, `editorialNotes`.

The sync seeds `contentStatus` and `featured` **once at creation** and never
writes any of these again. In the Studio these live in the **Editorial**
fieldset; the synced fields live in the **YouTube (synced — do not edit)**
fieldset and are marked read-only.

---

## Sanity Setup

### Create a write token

1. Go to **https://sanity.io/manage** and open the **BE Unconventional HQ**
   project (id `38nhxsib`).
2. **API** tab → **Tokens** → **Add API token**.
3. Name it (e.g. `youtube-sync`), set permission to **Editor**, and **Create**.
4. Copy the token immediately — it is shown only once.

### Minimum permissions

**Editor** (read + write). Do **not** use **Admin** — the sync only needs to
create and patch `video` documents. (Viewer is insufficient; it cannot write.)

### Security best practices

- **Never commit the token.** It goes in `.env` (git-ignored), never in code.
- Use it only server-side / at build time. It must **never** carry a `PUBLIC_`
  prefix (that would embed it in the browser bundle).
- Rotate it if it is ever exposed (delete + recreate in the same Tokens screen).
- Prefer a dedicated token per use (one for sync) so you can revoke narrowly.

---

## Google Cloud Setup

### 1. Create a project (if you don't have one)

1. **https://console.cloud.google.com** → project dropdown → **New Project**.
2. Name it (e.g. `beunconventional-media`) → **Create**.

### 2. Enable the YouTube Data API v3

1. **APIs & Services → Library**.
2. Search **YouTube Data API v3** → **Enable**.

### 3. Create an API key

1. **APIs & Services → Credentials → Create Credentials → API key**.
2. Copy the key.
3. **Restrict it** (recommended): **Edit API key** →
   - **API restrictions** → restrict to **YouTube Data API v3**.
   - **Application restrictions** → for a build/server key you can leave "None"
     or restrict by IP if you run the sync from a fixed server.

### Quotas & rate limits

- Default free quota: **10,000 units/day**.
- Costs used by this pipeline:
  - `playlistItems.list` (uploads listing) — **1 unit** per page (50 videos/page).
  - `videos.list` (details) — **1 unit** per call (50 videos/call).
  - So a full sync of ~N videos costs roughly `2 × ceil(N / 50)` units — a few
    units for a typical channel. **Cheap.**
- ⚠️ Not used here, but note for #20: `search.list` (live detection) costs
  **100 units/call** — cache aggressively.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Purpose |
|---|---|---|
| `YOUTUBE_API_KEY` | ✅ | YouTube Data API v3 key. Reads channel uploads + video details. |
| `YOUTUBE_CHANNEL_ID` | ✅ | Channel to ingest. Defaults documented as `UCXqU6781pQgYXDExLvMw2Og`. |
| `SANITY_WRITE_TOKEN` | ✅ for `--execute` | Editor token that authorizes writes. Omit for a dry run. |
| `SANITY_PROJECT_ID` | optional | Defaults to `38nhxsib`. |
| `SANITY_DATASET` | optional | Defaults to `production`. |
| `SANITY_API_VERSION` | optional | Defaults to `2024-03-01`. |

All of these are **server/build-only secrets or config**. None uses a `PUBLIC_`
prefix, so none is exposed to the browser.

---

## Running the Sync

### Initial setup

```bash
cp .env.example .env
# then edit .env and set YOUTUBE_API_KEY, YOUTUBE_CHANNEL_ID, SANITY_WRITE_TOKEN
npm install   # if you haven't already
```

### First run — always dry-run first

```bash
# Reads YouTube, prints what WOULD be written. Writes nothing.
node scripts/sync-youtube.mjs
```

Review the list. When it looks right, write for real:

```bash
node scripts/sync-youtube.mjs --execute
```

After the first `--execute`, open the Studio (`/admin`) → **Video** documents.
Each is `Needs Review`. Curate the editorial fields and set `contentStatus` to
**Published** for the ones that should appear on the site.

### Running again after new videos are published

Just run it again — it's idempotent:

```bash
node scripts/sync-youtube.mjs --execute
```

New videos are created (as `Needs Review`); existing videos have their factual
fields refreshed (view counts, title changes) while **all your editorial
curation is preserved**.

### Expected console output

```
Fetching uploads for channel UCXqU6781pQgYXDExLvMw2Og…
Found 214 uploads. Fetching details…
Fetched details for 214 videos.

• dQw4w9WgXcQ  Superman Trailer Breakdown
• 9bZkp7q19f0  …
…
DRY RUN — 214 video(s) would be upserted (editorial fields preserved). Re-run with --execute to write.
```

With `--execute`, the trailing line becomes `…committed 100/214`, `…committed
200/214`, `✔ Synced 214 videos into Sanity (editorial fields untouched).`

### Error handling

- Missing `YOUTUBE_API_KEY` / `YOUTUBE_CHANNEL_ID` → prints `✖ … is required.`
  and exits non-zero.
- `--execute` without `SANITY_WRITE_TOKEN` → refuses to run.
- A failed API/Sanity call throws with the upstream reason; the process exits
  non-zero and **no partial dry-run output is mistaken for success**. In
  `--execute` mode, commits are chunked (100 videos each), so a mid-run failure
  leaves already-committed chunks in place; simply re-run to continue (idempotent).

### Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `quotaExceeded` | You hit the 10k/day cap. Wait for the daily reset or request more quota. |
| `API keys are not enabled` / 403 | YouTube Data API v3 not enabled, or key restricted too tightly. |
| `Insufficient permissions` on write | Token is Viewer, not Editor. Recreate as Editor. |
| 0 uploads found | Wrong `YOUTUBE_CHANNEL_ID` (must be the `UC…` channel id, not a handle). |
| Videos appear in Studio but not on the site | They're `Needs Review`. Set `contentStatus` to Published. |
| Edits I made got wiped | Should be impossible — the sync never patches editorial fields. If a *factual* field changed, that's expected. |

---

## Synchronization Behavior

- **Duplicate prevention.** Each video maps to a deterministic Sanity `_id`
  (`youtube-<videoId>`). Re-running upserts the same document — never a
  duplicate.
- **Updated every sync.** All factual fields (see the table above), including
  `viewCount`, `title`, `description`, and `lastSyncedAt`.
- **Intentionally preserved.** All editorial fields. The `patch.set` payload is
  built only from factual fields — it is structurally impossible for it to carry
  an editorial key (this is covered by an offline unit test).
- **Conflict handling.** There is no factual/editorial conflict by design: the
  two sets are disjoint. If YouTube changes a title, the factual `title`
  updates; your editorial `series`/`franchises` are independent and untouched.
  `contentStatus`/`featured` are seeded once and thereafter owned by editors.
- **Deleted or private YouTube videos.** They drop out of the uploads listing,
  so the sync simply stops updating them — it does **not** delete the Sanity
  document (that would destroy your editorial work and any inbound links). The
  document remains with its last-known facts. To hide such a video, set its
  `contentStatus` to `Archived`. Automatic reconciliation (flagging videos that
  vanished from YouTube) is a documented future extension (below).

---

## Maintainability

### Architecture & design decisions

- **Isomorphic client, injected key.** All YouTube access goes through
  `src/lib/platforms/youtube.ts`, which uses only `fetch`/`URL` and takes the
  API key as a parameter — so the exact same client powers this Node script and
  the future Cloudflare edge live-status endpoint (#20).
- **Pure planning, guarded I/O.** `mapVideoToSyncedFields` and `planVideoSync`
  are pure and exported; the network/Sanity runner only executes when the file
  is invoked directly. This is what makes the editorial-preservation guarantee
  unit-testable with zero credentials.
- **Deterministic `_id`.** Idempotency and duplicate-prevention come from the id
  scheme, not from query-then-decide logic.
- **`createIfNotExists` + `patch`.** Editorial defaults are seeded exactly once;
  factual fields are refreshed every run. The two-mutation transaction is the
  mechanism that enforces "facts fresh, editorial sacred."
- **Read-only synced fields in the Studio.** Editors see synced fields but can't
  hand-edit them (they'd be overwritten). `readOnly` affects only the UI; the
  token-authenticated sync writes them normally.

### Assumptions

- `isShort` uses a **ping check** to `youtube.com/shorts/ID`. YouTube returns `200 OK` for valid Shorts and `303 Redirect` for standard videos. We no longer use the old `< 60s` heuristic.
- The channel's full upload history fits comfortably under the daily quota
  (true for a typical creator channel).
- One channel. Multi-channel would be a small loop over channel ids.

### Extension points (future work, intentionally not built here)

- **Reconciliation pass** — diff Sanity `video` docs against the current uploads
  set and flag/`Archive` videos that disappeared from YouTube.
- **Scheduling** — run on a cron (the Ubuntu-server model) or a build hook
  instead of manually.
- **Incremental sync** — only fetch videos published since the last run (using
  `lastSyncedAt`) to shave quota on very large channels.
- **Custom thumbnails** — an editorial `customThumbnail` image that overrides
  the synced `thumbnailUrl` for on-site display.
- **Additional platforms** — Instagram/TikTok are analytics-only (not content
  sources); their adapters return the shared `ChannelStats` shape and feed the
  Media Kit, not this `video` pipeline. Keep video ingestion YouTube-specific.

### Consistency with the wider project

- Mirrors the existing `scripts/fetch-feeds.mjs` conventions (a Node ingestion
  script writing to a store) and the migration script's dry-run-first, pure-core
  pattern.
- Uses the same Sanity project/config as `astro.config.mjs`, overridable by env.
- Editorial-source-of-truth model matches how `event` and `featuredBrand`
  documents already work.

## After the sync: Discovery Row data (ticket #31)

Once videos are published (with topics) in Studio, regenerate the Shorts
shelf's data file:

```
node scripts/generate-shorts.mjs --check   # preview
node scripts/generate-shorts.mjs           # writes src/data/shorts.json
```

Commit the changed `shorts.json` — the Discovery Row components read it as-is.
The script only includes `contentStatus == "published"` Shorts, groups them by
editorial topics, and refuses to overwrite the file while Sanity has no
published Shorts yet.

Daily rotation: the shelf's 4-card pick is seeded by the calendar date at
build time. `.github/workflows/daily-rebuild.yml` pokes a Cloudflare deploy
hook nightly so it rotates without content pushes — inert until the
`CLOUDFLARE_DEPLOY_HOOK_URL` secret is configured (instructions in the
workflow header).

## Taxonomy-as-Code (epic #34 — supersedes manual topic/hub mapping)

YouTube tags are now the taxonomy source. The sync builds a keyword dictionary
FROM SANITY on every run and derives each video's topics + hubs from exact,
normalized matches. Everything else in the tag soup is ignored.

**The tier system (tag your uploads on YouTube):**

| Tier | Maps to | Keywords live on | Example tags |
|---|---|---|---|
| 1 — Category (mandatory) | `topic` docs | `topic.youtubeSyncKeywords` | `film`, `tv`, `gaming`, `events` |
| 2 — Brand hubs | `featuredBrand` docs | `featuredBrand.youtubeSyncKeywords` | `marvel`, `dc` |
| 3 — Event hubs | `event` docs | `event.youtubeSyncKeywords` | `san diego comic-con` |

Matching is case- and punctuation-insensitive ("San Diego Comic-Con" ≡
"san diego comic con"). The four Tier-1 topics (+ `Uncategorized`) are seeded
automatically with sensible default keywords — edit them in Studio anytime.

**One-time setup (owner):** open each Featured Brand and Event in Studio and
fill its "YouTube Sync Keywords" field. Until then, only Tier-1 category
matching happens (hub assignment stays empty and the sync warns about it).

**Field classes:**
- FACTUAL (title, stats, …): overwritten every run.
- DERIVED (topics, hubs, requiresReview): overwritten every run **unless**
  the video's `manualTaxonomyOverride` is on (the Sync Lock) — then the sync
  never touches its taxonomy again. Stats/metadata keep flowing either way.
- EDITORIAL (featured, notes, …): seeded once, never overwritten.

**Auto-publish:** a video that matches ≥1 Tier-1 keyword is created as
`published` — it appears on the site with zero CMS touches. Zero Tier-1
matches → `Uncategorized` + `requiresReview: true` + `needs-review` (never
dropped). Fixing the tags on YouTube re-files it on the next sync and
promotes it to published — but the sync never demotes, and never changes a
status a human has set (published/archived are final against automation).

## View metrics (epic #34, T6 — powers the Essential-5 shelf)

`node scripts/update-metrics.mjs` records each published video's current view
count into a bounded 14-day rolling window on a companion `videoMetrics`
document and computes 7-day view velocity (views gained over the trailing
week). The site's Essential-5 shelf orders by this velocity, queried
statically — the YouTube API is never hit at render time.

- `--dry-run` prints without writing.
- Idempotent by day: safe to run repeatedly; the same day overwrites, never
  duplicates. Velocity needs ≥2 days of history to be non-zero, so trends
  appear after the job has run a few days.
- v1 uses view-count deltas from data the sync already stores — **no Analytics
  OAuth needed**. (Engagement-ratio ranking via the Analytics API is a
  possible v2; the shelf's data source swaps without touching the frontend.)

**Recommended cadence:** run nightly, right after the sync, e.g.
`npm run sync -- --execute && npm run metrics`. This can be automated with a
scheduled GitHub Actions job once `YOUTUBE_API_KEY` + `SANITY_WRITE_TOKEN` are
added as Actions secrets (owner decision — a write token in CI); until then
run it locally or from any trusted scheduler.
