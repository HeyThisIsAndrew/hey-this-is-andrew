# Architectural Decision Record: Declined Astro Features

This document records three plausible, well-formed architectural proposals that were evaluated and rejected. Without this record, they are highly likely to be proposed again by AI agents, as each sounds obviously correct until verified against this specific codebase.

## Incremental Static Builds

**Verdict**: Declined.

**The Evidence**:
- **Flag Name**: The correct Astro 7 flag is `experimental.incrementalBuild`. There is no `incrementalStaticBuilds` key. Re-verified against the installed Astro 7.3.1: `experimental.incrementalBuild` is the only `incremental*` key in the config schema (`node_modules/astro/dist/types/public/config.d.ts`).
- **Time Savings vs. Pipeline Cost**: Measurement #151 verified that `astro build` takes only 8.2s of a 106s CI pipeline. Prerendering all 68 routes costs only **2.60s**. The pipeline bottleneck is outside of Astro's static generation. (Re-checked: the build now emits 75 pages, and full prerender still completes in ~3.7s. Route growth since #151 has not moved the bottleneck.)
- **The Dependency Hash Trap**: The incremental cache skips a page only when its `cacheKey` and dependency hash match. The hash walks the route's transitive module graph and hashes every module. Only modules tagged `kind: "content-data"` (virtual modules from the Content Layer) are skipped. Our `src/data/videos.json` (451 KB at the time of #151, ~493 KB today and still growing with every sync) is statically imported and rewritten by the YouTube sync every 6 hours. Because it is an ordinary module, every sync changes the dependency hash of every route touching it, instantly invalidating the cache.
- **Silent Failures**: The cache silently disables itself when `build.concurrency > 1` (emitting only a log warning), and the manifest is invalidated wholesale by any lockfile change, ensuring every dependency bump forces a cold build. (`astro.config.mjs` sets no `build.concurrency` today, so this is a trap waiting for whoever turns concurrency on, not a current failure.)

**Revisit Condition**:
This becomes arguable only if the route count grows by roughly an order of magnitude **and** Ticket #201 (Move the JSON store behind a Content Layer loader) has successfully landed, which would tag our data as `kind: "content-data"`.

## LQIP (Low-Quality Image Placeholders)

**Verdict**: Declined.

**The Evidence**:
- **Mobile LCP**: The mobile Largest Contentful Paint (LCP) element is a remote Sanity image that is loaded *outside* of `astro:assets`.
- **Pre-existing Fix**: Epic #191 already owns the correct fix for origin optimization.
- **Regression Risk**: Swapping `image.service` to support LQIP risks reopening the severe regression that `imageService: 'compile'` was specifically adopted to fix (which resulted in a 938 KB mobile payload and 3.4s LCP). Still in force: `astro.config.mjs` passes `imageService: 'compile'` to the Cloudflare adapter.

**Revisit Condition**:
This becomes arguable only if the LCP element ever moves back into the `astro:assets` pipeline.

## Sanity Content Loader

**Verdict**: Declined.

**The Evidence**:
- **Breaks Offline Guarantee**: It introduces a build-time GROQ network call, which reverses Epic #34's strict offline-build guarantee.
- **Substack Constraint**: Our articles come from Substack's `/api/v1/posts` API. A Sanity loader could not replace that sync pipeline regardless.

**Revisit Condition**:
None. Our architecture relies on offline JSON stores populated via isolated CRON syncs.


## The General Lesson on Attribution

Five of the six proposals in the originating review that suggested these features were falsely attributed to the "What's New in Astro, August 2026" blog post. That post did not mention any of them as core features (it covers Astro 7.2, the new Project Steward, the Astro Playground, Astro Together Germany, the Community Support repo, and partner news). 

**Rule**: Attribution is checkable, and must always be checked before suggesting architectural overhauls based on perceived documentation updates.

## Cross-reference review — 2026-09-09

Every claim above was re-checked against the tree, not just re-read. Verdicts
are unchanged; three figures had drifted and are now annotated inline rather
than silently overwritten, so the original measurement and today's reading can
both be seen:

| Claim | Then | Now |
| --- | --- | --- |
| Astro version behind the flag-name check | 7.2.9 | 7.3.1, same flag name |
| Prerendered routes | 68 | 75 (`/events/archive` is the newest) |
| `src/data/videos.json` | 451 KB | ~493 KB |
| `build.concurrency` | not stated | still unset |

The dependency-hash argument is the load-bearing one, and it has gotten
*stronger*, not weaker: the JSON store is 9% larger and is still an ordinary
statically imported module, so every sync still invalidates every route that
touches it. The revisit condition (Ticket #201, the Content Layer loader) has
not landed.
