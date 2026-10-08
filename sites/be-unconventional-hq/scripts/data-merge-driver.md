# The synced-data merge driver

## The problem it removes

`src/data/{videos,articles,instagram,article-images}.json` are rewritten
wholesale by sync scripts that run in **two** places:

- the scheduled workflows, which commit to `main`
- the operator, running `npm run sync-articles` / `npm run sync:youtube`
  locally on a branch

Both rewrite the same file from the same upstream source, so git sees a
whole-file conflict on essentially every merge, even when the two versions
agree about everything anyone cares about. It had to be resolved by hand each
time, and hand-resolving a 200-document JSON file is exactly where editorial
work gets dropped.

## What the driver does

`scripts/merge-sync-json.mjs` merges these files **per document** instead of
per line:

1. Union both sides by id (`_id`, `videoId`, `slug`, `guid`, or `url`).
   A document only one side has is kept.
2. For a document on both sides, keep whichever copy stamps itself newer
   (`_updatedAt` / `publishedAt` / `isoDate`). **Per document, not per side** —
   a run can be newer overall while holding a stale copy of one item the
   other side re-fetched.
3. If **any** EDITORIAL field disagrees, refuse. Print what disagrees and
   leave the normal conflict markers.

Editorial fields, per CLAUDE.md hard rule 5:

```
featured  notes  status  manualTaxonomyOverride
hubs  topics  requiresReview  hidden  order
```

That third rule is the point of the whole thing. Factual drift is noise and
should never cost anyone a minute. An editorial disagreement means a human
and a sync disagree about something deliberate, and no automatic rule should
pick a winner.

## Setup — once per clone

`.gitattributes` can *name* a merge driver but cannot *define* one. Git
refuses to execute a program a repository supplies, because cloning a repo
would otherwise be code execution. So each clone registers it locally:

```sh
npm run setup:git
```

`postinstall` runs it too, so a fresh `npm install` is enough. It is
idempotent and no-ops outside a git work tree (CI checkouts, Docker builds).

Verify:

```sh
git config --get merge.sync-json.driver
# node scripts/merge-sync-json.mjs %O %A %B %P
```

**If that prints nothing, the driver is not running** and you will get
whole-file conflicts exactly as before. That is the first thing to check.

## When it refuses

You get output like:

```
[merge-sync-json] NOT auto-resolving src/data/videos.json.
  1 EDITORIAL field(s) disagree. These are values a human set, and hard rule 5
  says a sync never overwrites them.
    dQw4w9WgXcQ  featured:  ours=false  theirs=true
```

That is working as intended. Decide which side is right — usually the human
edit, not the sync — then:

```sh
git checkout --ours src/data/videos.json     # keep this branch's copy
# or
git checkout --theirs src/data/videos.json   # take the incoming copy
git add src/data/videos.json
```

Note the trap: in a **merge**, `--ours` is your branch. In a **rebase** the
meanings invert — `--ours` is the base you are replaying onto and `--theirs`
is your own commit. Check `git status` for which operation you are in.

## Limits, stated

- Only these four files, only when both sides parse as a JSON array. Anything
  else falls through to a normal conflict.
- A document with no recognisable id aborts the merge rather than guessing.
- It compares timestamps as strings. That is correct for ISO-8601, which is
  what every one of these files uses, and wrong for any other format.
- It does not validate schema. A sync that writes garbage produces merged
  garbage. The sync scripts' own guards are what prevent that.
