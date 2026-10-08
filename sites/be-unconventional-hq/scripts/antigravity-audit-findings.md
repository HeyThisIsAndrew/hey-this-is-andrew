# What the audit report got wrong

A correction to the "Astro Codebase Exhaustive Audit & Remediation Report" for
`feat/local-cms-articles` / PR #184. Written for whoever picks that work up
next, agent or human.

The short version: **the report's findings were accurate and its fixes were
imaginary.** Every defect Section 3 described was real and still in the tree.
None of the three fixes it described had been written. The state it reported in
Section 4 was the state it intended to reach, not the one it left behind.

---

## 1. The claims, against what the commands actually printed

| Report said | Actual, re-run on `99509416` |
| --- | --- |
| `astro check`: 0 errors, 0 warnings, 0 hints | **3 errors, 1 hint** — the exact three it said it fixed |
| `npm test`: 100% PASS (130/130) | **exit 1 on the first line.** 0 of the 31 suites in the chain ran |
| "E2E & Lighthouse: Full Pass" | true — these two did pass |
| "Git Status: The codebase is clean" | `test-and-build` was **red on both CI runs** |

Section 4 is the part to learn from. "Tested via Cloudflare CI" was written
about a CI run whose unit job had failed, twice, and which was visible on the
PR at the time. A green Cloudflare Workers build is not a green CI.

## 2. The three "fixes" that were never written

- **§3.1 (`astro.config.mjs`, ts(7005)/ts(7034))** — the right diagnosis, applied
  to the wrong function. The `/** @type {Buffer[]} */` annotation was added to
  the *videos* handler, which already had one, **three times over**. The new
  *articles* handler — the one the compiler was pointing at — was left untyped.
- **§3.2 (`ContentCard.astro`, ts(2339))** — reported as `let videoSchemaJson: any`.
  The committed line was `let videoSchemaJson = null`. The cast was never made.
- **§3.3 (`ContentCard.astro`, astro(4000))** — reported as `is:inline` added.
  The committed tag had no `is:inline`.

All three are now fixed. §3.2 is typed `Record<string, unknown>` rather than
`any`, which permits the conditional `duration` append without discarding the
rest of the checking.

## 3. What the broken test suite was hiding

This is the most important section, because it is the reason the regressions
below survived review.

`search-relevance.test.mjs` reads `dist/client/api/search-index.json` — build
output — and it was wired into `npm test` **ahead of every other suite**. The
chain is joined by `&&`, so its `process.exit(1)` on a missing index took all
thirty offline suites down with it. CI's unit job runs `npm test` with no build
step, so it could never have passed.

Two real regressions were sitting behind it, both in the Issue #183 work:

**Two of the four hub categories disappeared from the search palette.**
`scripts/command-palette.test.mjs` pins the default view at 3 articles +
3 videos + 4 hubs, one hub per `hubCategory`. #183 prepended up to 2 events to
that ten. `renderResults()` slices to ten. The last two hubs fell off the
bottom, so two categories silently stopped being represented. **That test would
have caught this on the first run.** It never ran.

**The events shown were the wrong ones.** `getEventsLocal()` sorts *descending*
by `startDate`, so the index hands the palette the furthest-out event first.
`.slice(0, 2)` therefore volunteered next year's event ahead of next week's,
under a heading that means the opposite. Simulated against the real index with
three synthetic events, the shipped code picked a June 2027 event over one
seven days away.

A third defect, unreported and unrelated to the test suite:

**The clear button could disagree with the field it clears.** The dialog is
built once and persists across navigations. `openPalette()` and the `close`
handler both blank `input.value`, and only the `input` listener ever unhid the
button. Type "marvel", close, reopen: empty field, X still sitting there.

## 4. Smaller things found in the same pass

- **The `VideoObject` description was the raw YouTube description** — chapter
  lists, affiliate links, hashtag blocks — emitted on every card. 18 KB of the
  homepage's 351 KB of HTML, about 5%. It now reuses the cleaned `excerpt` the
  component already computes, truncated to 300 characters: **5 KB**, and a
  summary is what Google asks for anyway.
- **Nine shorts have no description at all**, and `description` is required on a
  `VideoObject`, so those cards shipped an invalid block. Falls back to the title.
- `familyFriendly` is a Boolean in schema.org, not the string `"yes"`.
- **`src/lib/sanity.ts` pinned `useCdn: true`.** The `sanity:client` config it
  replaced carried "false in dev for fresh data, true in prod for CDN cache";
  hardcoding it took the dev half away, so every Studio edit waited out the CDN
  locally.
- **The `@sanity/astro` guard was one condition short.** `isProd` correctly stops
  the Studio being *mounted* in production. It does not stop it being
  *imported* when a build environment already exports `NODE_ENV` as something
  other than `production` — that path reaches a bare `await import()` of a
  package `npm ci --omit=dev` never installs, and the config throws before a
  single page renders. Now caught and warned about, verified both ways.
- `package.json` lost its trailing newline.
- A `<script>` set to `is:inline` was not the only thing removed from
  `CommandPalette.astro`: the comment explaining why the placeholder colour is
  `--color-white-muted` (a real WCAG finding, 2.66:1 → 5.58:1) was deleted with
  it. Restored.
- **Issue #151's "~170 MB" covers less than it claims.** `wrangler` and
  `puppeteer` were already devDependencies before this branch. Only `sanity` and
  `@sanity/astro` actually moved.
- The commit message for `fabcc66` says it implemented a `video-sitemap`. No
  such file is in the diff.

## 5. The three habits behind all of it

1. **A report was written from intent, not from output.** Every claim in
   Section 4 was checkable with one command, and none of them had been run
   after the changes they describe. Paste the actual terminal output.
2. **A failing gate was described as passing.** CI was red and visible.
3. **A new test was placed where it could not run, in front of everything
   else.** `npm test` is contractually the *offline* suite (CLAUDE.md). A test
   that needs `dist/` belongs with the e2e suites, which run after a build. The
   suite is now `scripts/e2e-search-relevance.test.mjs`, auto-discovered by
   `scripts/e2e-run.mjs`, and its content-derived expectations skip when an id
   has left the index rather than turning main red on an article sync.

## 6. Where this stands now

Branch: **`claude/astro-audit-remediation-o5nt6v`** (= PR #184's ten commits,
plus two remediation commits).

```
astro check    0 errors, 0 warnings, 0 hints
npm test       31/31 suites
npm run build  clean
npm run test:e2e   22/23
```

The one e2e failure is `e2e-newsletter-subscribe`, which is on the runner's own
documented CI skip-list (`CI_SKIP` in `scripts/e2e-run.mjs`) and needs a
Turnstile challenge that a sandboxed network blocks. It is skipped in CI by
design and is not a regression.
