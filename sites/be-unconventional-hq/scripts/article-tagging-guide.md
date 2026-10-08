# Article tagging guide

How to tag a Substack post so it lands in the right place on beunconventionalhq.com.

(`docs/` is gitignored in this repo — operator docs live in `scripts/*.md`.)

---

## The short version

**Put one of these four words in the post's Substack tags: `Film`, `TV`, `Games`, `Events`.**

(`Gaming` still works. It was the category name until #146 and is kept as a
keyword alias, so nothing you have already published needs retagging.)

That's it. Everything else here is fallback behaviour for when you forget.

---

## Why tagging matters

The sync reads your Substack tags and maps each post to one of the site's
canonical categories. That category decides:

- which badge the card shows in the Feed and on `/intel`
- which `/intel/topic/<category>` page the post appears on
- whether the post surfaces on a category-filtered Feed view

An untagged post still publishes — it just lands in **General**, which has no
topic page of its own.

---

## The canonical categories

These are fixed. They come from `CATEGORIES` in `src/data/constants.js` and are
shared with the video taxonomy, so they are not editor-managed.

| Category | Use it for |
|---|---|
| **Film** | Movie reviews, trailers, box office, cinema |
| **TV** | Series, seasons, episodes, streaming shows |
| **Games** | Games, consoles, gaming culture |
| **Events** | Conventions, premieres, on-location coverage |
| **General** | Fallback only — never tag this deliberately |

> **⚠️ It is `Film`, not `Movies`.**
> The site's film category has always been labelled `Film`. `Movies` is accepted
> as an alias when tagging, but the badge will read **Film**. If you are ever
> adding a new category, match `src/data/constants.js` exactly or it will not
> map.

---

## How the mapping actually reads your tags

Three passes, in order. The first one that matches wins.

**1. Exact tag match (best — always aim for this).**
A tag matching a canonical category name. Case and punctuation are ignored, so
`Film`, `film` and `FILM` are identical.

**2. Keyword tag match.**
If no tag names a category outright, these tags map across:

| Tag you might use | Maps to |
|---|---|
| `movie`, `movies`, `cinema`, `boxoffice` | Film |
| `television`, `series`, `season`, `episode`, `streaming`, `show` | TV |
| `gaming`, `game`, `games`, `videogame`, `playstation`, `xbox`, `nintendo`, `steam` | Games |
| `event`, `convention`, `con`, `comiccon`, `comic-con`, `sdcc`, `d23`, `premiere`, `expo` | Events |

**3. Title/description keyword scan (weakest — a safety net, not a strategy).**
With no usable tag, the same keywords are scanned in the post's title and
description. This is genuinely unreliable, which is the whole reason tagging is
the documented workflow.

Anything still unmatched becomes **General**.

### Words that deliberately carry no signal

`review` and `trailer` are **not** category keywords. TV shows and games get
reviewed and trailered too, so treating them as film-specific pulled unrelated
posts into Film. A post titled "Our review of the new season" maps to **TV** via
`season`, not Film via `review`.

---

## Event coverage

For a post tied to a specific event, tag **both** the category and the event:

```
Events, SDCC, Comic-Con
```

The `Events` tag drives the category. The event-specific tags are what let the
post be matched to an event hub page later — the hub matching reads the same
tag list (see `youtubeSyncKeywords` on event docs in `src/data/videos.json`).

Use the same event keywords you already use on the matching YouTube videos, so
a hub picks up both the video and the written coverage.

---

## Multiple tags

Tag freely — extra tags are preserved on the record and are used for hub
matching and Feed filtering. Only the **category** resolution stops at the first
match, and it checks in the order Film → TV → Games → Events.

So if a post is genuinely both, put the one you want as its badge first in the
list *and* make it an exact category name, since exact matches are resolved
before keyword matches regardless of ordering.

---

## Cover images

Every post is expected to have one; Substack's post image is picked up
automatically. If a post genuinely has no image, the site falls back to the
BUHQ logo rather than pulling the first inline image or shipping a text-only
card.

---

## Running the sync

```bash
npm run sync-articles              # dry run — prints the plan, writes nothing
npm run sync-articles -- --execute # writes src/data/articles.json
```

Dry-run by default, same as the YouTube sync. Read the plan, then re-run with
`--execute`.

### What the output tells you

- `N new, M updated, T total after merge` — the merge result.
- `⚠ skipped item …` — a post too malformed to import (no title, or no
  guid/link). The rest still import; the build does not fail.
- `⚠ N record(s) have no full body` — see below.

### Records with no full body

A post whose feed item arrives without a usable body **does not get a page on
this site**. Its card stays in the Feed and keeps pointing at Substack.

This is a safety net against Substack truncating a feed item, not a paywall
feature. It exists so a truncated post never becomes a thin, broken-looking
local page that competes with the Substack original in search results.

If a post you expect to be hosted locally shows up in that warning list, check
whether it is a paid post being truncated in the feed.

---

## Things the sync will never do

- **Delete a record.** The posts API returns only a page of recent posts
  (`limit=50`). Anything that ages out of it stays in
  `src/data/articles.json` forever, because deleting it would 404 a live URL.
  Removal is a deliberate human edit.
- **Blank an existing body.** If the endpoint stops returning content for a post
  already archived with a body, the stored body is kept.
- **Overwrite `firstSeen`.** Re-syncing never rewrites when a post first
  appeared.
- **Break the build on a failed fetch.** A Substack outage logs loudly and
  leaves the snapshot untouched.

---

## Editorial overrides

Any record in `src/data/articles.json` may carry an optional `editorial` block,
which survives every future sync:

```json
"editorial": {
  "title": "A better headline for the site",
  "excerpt": "A hand-written standfirst.",
  "image": "https://…",
  "category": "Games",
  "featured": true,
  "hidden": false,
  "sortWeight": 10
}
```

`hidden: true` removes a post from the site without deleting the record.
`sortWeight` floats a post above others regardless of date. A missing
`editorial` block is the normal case.
