# Instagram sync — operator notes

`scripts/sync-instagram.mjs` pulls the latest 50 posts from the Instagram Graph
API (via the linked Facebook Page), downloads each post's cover into
`public/instagram/` as a resized `.webp`, and writes `src/data/instagram.json`.

Runs on a schedule: `.github/workflows/sync-instagram.yml`, `15 */6 * * *` —
four times a day, offset from the YouTube and article syncs so three jobs are
not racing for a runner. Uses the existing `META_ACCESS_TOKEN` secret; there is
no separate Instagram token.

**Dry-run by default.** Pass `--execute` to write anything.

```bash
npm run sync:instagram                  # preview, writes nothing
npm run sync:instagram -- --execute     # the real thing
```

## Controlling what appears in the homepage carousel

Two mechanisms, in order of how often you'll want them.

### 1. Automatic — reels that aren't on your feed

A reel published to the Reels tab without being shared to the profile feed is
hidden from the carousel automatically. Nothing to configure: the sync records
the Graph API's `is_shared_to_feed` and `src/lib/instagram-visibility.ts`
filters on it.

Each run prints what it found:

```
[instagram] Feed visibility: 44 shared to feed, 6 reels-tab only (will be
hidden from the carousel), 0 not reported by the API (kept — see getGalleryPosts).
```

Three deliberate behaviours worth knowing:

- **Unknown means visible.** A post whose `is_shared_to_feed` the API did not
  report is shown, not hidden. Every record synced before this field was
  requested is in that state, as is anything that isn't a reel.
- **The rail cannot be emptied by this rule.** If the filter would leave zero
  posts, the unfiltered feed is used instead. `CinematicGallery` renders
  nothing at all for an empty list, so that case would delete the whole section
  from the homepage rather than shorten it. A `!` warning is printed when this
  triggers.
- **A rejected field never fails the sync.** If the Graph API doesn't accept
  `is_shared_to_feed` for the account, the request is retried without it and
  the run continues exactly as before — it just doesn't filter that time.

### 2. Manual — a post you simply don't want in the rail

For a post that *is* on your feed but shouldn't be in the carousel, add its
shortcode to `src/data/instagram-excluded.json`:

```jsonc
{ "shortcodes": ["DcBzZENuTrU"] }
```

Get the shortcode from the post's link — it's the part after `/reel/` or `/p/`:

```
https://www.instagram.com/reel/DcBzZENuTrU/
                                ^^^^^^^^^^^
```

Pasting the whole URL also works. The sync never touches this file, so entries
survive every refresh. Manual exclusions are **not** subject to the floor above:
hiding everything by hand is an explicit decision and is obeyed.

## When a reel cover changes

**This is the one case the sync cannot detect on its own.**

Covers already downloaded are never refetched — at four runs a day that would
be 200 needless downloads daily. The shortcut assumes a post's media never
changes, which is true of a photo post and **false of a reel**: you can change
a reel's cover after publishing, and the sync will keep serving the old one
forever.

Comparing URLs can't catch it (Instagram re-signs them every fetch, so they
always differ) and comparing content would mean downloading, which is the cost
the shortcut exists to avoid. So it's an explicit flag:

```bash
npm run sync:instagram -- --execute --refresh-media
```

Refetches every cover. Use it after changing a cover on Instagram, then commit
`public/instagram/` along with `src/data/instagram.json`.

Symptom that you need it: a tile that looks wrong — blank, black, or showing
the old cover — while the post looks correct on Instagram. One real case: a
reel published with no cover stored as an 894-byte near-black frame, and
setting a cover on Instagram changed nothing on the site until this flag
existed.

## Things that are load-bearing

- **A zero-item API response never overwrites the stored feed.** Far more
  likely a bad token or a rate limit than a genuinely empty account.
- **A missing token warns and skips**, it does not throw — otherwise it takes
  the whole combined `npm run sync` down with it.
- **A quiet run writes nothing.** Instagram re-signs CDN URLs on every fetch,
  so `displayUrl` differs every run even when nothing changed; the comparison
  is made against a signature-normalised shape (`stableShape()`) so an
  unchanged feed doesn't trigger a commit and a Cloudflare rebuild four times a
  day for nothing.
- **Images that age out of the 50-post window are pruned** from
  `public/instagram/`, driven by the set just written — never a wildcard delete.

Guarded by `scripts/instagram-visibility.test.mjs`,
`scripts/instagram-local-media.test.mjs` and `scripts/sync-wiring.test.mjs`.
