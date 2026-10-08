# Antigravity Swarm — PRODUCTION QA of `beunconventionalhq.com`

Target: **live production**, not a branch. Everything below has shipped. Your
job is to find what is broken for a real visitor right now.

---

## READ THIS BEFORE ANYTHING ELSE — TWO ABSOLUTE RULES

**RULE 1 — YOU DO NOT WRITE CODE. AT ALL.**

Read-and-report only. Not "mostly", not "unless you are confident". On a
previous pass you were given this same instruction and you created a branch,
committed fixes and pushed. One of those commits set `.nav-container` and
`.safe-area-blackout` from `pointer-events: none` back to `auto` — a leaked
mutation from your own falsification command whose `git restore` did not take.
That one line would have shipped the site's worst bug back to production: a
hidden full-screen overlay swallowing every tap on every phone. It was caught
by hand, and your report said the phantom-overlay suite passed.

**No branches, no commits, no pushes, no edits.** If you want to test a
hypothesis by changing a file: change it, measure it, revert it, and confirm
with `git status` before doing anything else. Report the finding as prose and a
measurement. Someone else applies the fix.

**RULE 2 — YOU NEVER TOUCH THE DESIGN.**

The visual design is finished and correct. You are hunting BUGS — things that
do not work — not things you would have styled differently. You have already
once re-added borders and a lift to the two Instagram rail labels, which the
owner had deliberately decided are TEXT, not tiles. That was reverted.

If you think a visual change fixes a functional bug: say so and stop. Describe
the bug, the measurement, the proposed change. Do not make it.

A report that breaks either rule is worth less than no report.

---

## What shipped recently — the claims to falsify

Four merges, most recent first. Each carries a specific claim. Attack them.

**1. Instagram carousel now shows only feed-facing posts.**
- Reels published to the Reels tab without being shared to the profile feed
  are hidden, via the Graph API's `is_shared_to_feed`.
- Claim: exactly 3 of 50 stored posts are hidden; 47 render; the homepage
  shows 10 unique tiles.
- Claim: a post the API said nothing about is NEVER hidden — all 9
  albums/images legitimately lack the field, since it is reels-only.
- Claim: if the filter would leave zero posts, the unfiltered feed is used
  instead, so the rail cannot vanish.
- **Falsify:** recompute from `src/data/instagram.json` yourself. Paste your
  counts. Confirm none of the 3 hidden permalinks appear in the built HTML.

**2. Article-page images are served from Substack, NOT a proxy — deliberately.**
- An earlier pass routed the article hero and all body images through
  `wsrv.nl`. Reported from a real phone: the Spider-Man gallery images were
  blank and stayed blank while sliding. It was reverted.
- Claim: `wsrv.nl` requests on `/intel/spider-man-brand-new-day-review` went
  from 11 to 1 (the remaining one is a "More From" card via `ContentCard`,
  which predates all of this).
- Claim: no article page is in the Lighthouse gate, so the proxying bought
  nothing measurable.
- **Falsify:** count `wsrv.nl` requests on that page in production. Open the
  gallery lightbox and slide through every image, on a THROTTLED mobile
  connection. Time to first paint per slide. This is the exact thing that was
  broken; prove it is not.

**3. `/intel` went from 75% to 98% by serving renditions instead of originals.**
- The feature image was a 1.2 MB raw S3 upload rendering into a 720×405 box.
- **Falsify:** run Lighthouse on `/intel` in production, mobile, three times.
  Report the median and the LCP element.

**4. The 19 e2e suites now run in CI behind `scripts/e2e-run.mjs`.**
- Claim: chained with `&&` they are flaky under load — a full run died on
  `e2e-scroll-lock` with `TimeoutError: 8000ms` while every suite passed in
  isolation. The runner waits for the port handover and retries once.
- **Falsify:** run `npm run test:e2e` three times. Report which suites, if any,
  needed the retry each time. A suite that ALWAYS needs the retry is a real
  defect being masked — name it.

---

## The open question you are best placed to answer

**Production desktop Lighthouse is 88. CI says 96–100. Both are correct.**

CI builds with `PUBLIC_DISABLE_ANALYTICS=true`, so it has never measured GTM,
gtag or the Cloudflare beacon. Production serves all three.

Owner's report from production desktop:

```
Performance 88 | FCP 0.5s | LCP 0.7s | TBT 280ms | CLS 0.002 | SI 1.1s
```

Every metric is excellent except TBT, which is 30% of the desktop score.

The decision already taken, deliberately: **analytics stays loading
immediately.** Deferring it until first interaction would recover most of the
12 points but would stop counting visitors who leave without interacting, and
the owner is growing an audience and needs that data. Do not propose deferring
analytics again unless you can show the tracking loss is smaller than assumed —
with a measurement, not an assertion.

**What is genuinely useful from you:**

- Of the 280 ms TBT, how much is third-party (GTM/gtag/beacon/Partytown) and
  how much is our own bundles? Attribute it with real numbers per script.
- The "forced reflow" diagnostic names several `/_astro/*.js` files. Which of
  our own code forces layout, at what cost in ms, and is it avoidable without
  a UI change?
- "Improve image delivery — 37.94 KiB" and "LCP request discovery" on the
  homepage: what exactly, and what would each buy?
- Does Partytown actually help here, or is it adding overhead on desktop while
  moving work off the main thread? Measure with and without.

---

## Swarm assignments

**Agent 0 — REGRESSION HUNT (do this first, weight it highest).**
Compare production against the previous deploy. Anything that worked before
and does not now. The Instagram rail, article pages and `/intel` all changed;
start there but do not stop there.

**Agent 1 — Real iOS Safari, and say plainly if you do not have it.**
Every iOS fix on this site is verified in Chromium only. Chromium hit-tests
hidden and fixed elements correctly and resets scroll on reload, so it CANNOT
reproduce several bugs this site has had. Specifically: the landscape hero
filling the viewport after rotation and after a mid-page reload; the phantom
overlay; the splash scroll lock; the corner controls remaining tappable.
Report how many tabs you had open — the tab strip changes the viewport.

**Agent 2 — The article gallery on a throttled phone.** See claim 2. This is
the highest-risk recently-changed surface and it has already shipped broken
once.

**Agent 3 — Instagram rail correctness.** See claim 1. Recompute independently.

**Agent 4 — Performance attribution.** See "the open question". Numbers per
script, not adjectives.

**Agent 5 — Accessibility.** Keyboard traversal of the nav, the video modal,
the calendar and category modals, and the gallery lightbox. Focus visibility,
focus return on close, escape handling. The muted-grey text palette failing
WCAG contrast in places is a KNOWN and deliberate design trade-off — note it
once, do not file it repeatedly.

**Agent 6 — Links, metadata and SEO.** Every internal link resolves. Canonical
URLs, OG/Twitter cards, sitemap, robots. `/links`, `/admin` and `/local-cms`
are deliberately noindex — confirm they are, and confirm nothing else is by
accident.

**Agent 7 — The syncs.** `sync-youtube`, `sync-articles`, `sync-instagram`,
`sync-media-kit`. Read the workflows and the scripts. Under what conditions
does each fail silently, blank its data file, or commit nothing while
reporting success? All four have done at least one of those before.

---

## Rules of evidence

- A defect needs: `file:line` (or a URL), reproduction steps, observed vs
  expected, and a measurement. "Looks fine" is not a finding. Neither is a
  defect without a reproduction.
- Mark every finding **introduced recently** or **pre-existing**.
- If you claim a test passes, prove it can fail: reintroduce the defect it
  guards, watch it go red, revert. Several tests on this repo have passed while
  proving nothing, and each one was found this way.
- Run Lighthouse three times and report the median. One sample is noise.
- If your sandbox blocked something, say so explicitly rather than reporting a
  blocked host as a site defect.

## Environment notes — do NOT report these as defects

- `npm ci` first. Node 22.
- **External hosts may be blocked in your sandbox**: `cdninstagram.com`,
  `i.ytimg.com`, `wsrv.nl`, `substackcdn.com`, `googletagmanager.com`,
  `qrserver.com`. Broken images and `ERR_TUNNEL_CONNECTION_FAILED` from those
  are environmental. Say so if it stopped you verifying something — this has
  produced wrong conclusions twice, in both directions.
- The Substack article sync degrades to empty without network, **by design**.
- `npm run test:e2e` needs port 4321 free. Kill stray `workerd` /
  `astro preview` first.
- The newsletter e2e suite talks to the network and can fail spuriously.
- `docs/` is gitignored. Operator docs live in `scripts/*.md`.

## Required output

1. **VERDICT** — is production healthy? First line.
2. **Confidence** (high/medium/low), and what would raise it.
3. **Blocking defects** — full evidence, each marked recent or pre-existing.
4. **Non-blocking findings**, ranked.
5. **Tests that cannot fail** — any you falsified successfully.
6. **TBT attribution** — the table of ms per script. This is the one number
   nobody has.
7. **Claims you could NOT verify**, and why. State plainly whether you tested
   real iOS Safari.
8. **Disagreements with Claude**, each with the measurement behind it.
9. **Numbers**: `astro check` (errors/warnings/hints), `npm test`,
   `npm run test:e2e` ×3, Lighthouse mobile ×3 and desktop ×3 on `/`, `/feed`,
   `/intel` and one article page.

---

## OPERATOR TO-DO — how to run this

**Model:** **Gemini 3.1 Pro**. This is an analysis job, not a code-writing job,
and the entire value is an independent second opinion. Do not run it on a
Claude agent — a second Claude checking the first Claude's work is worth much
less to you.

Point it at production (`https://beunconventionalhq.com`) with the repository
checked out at `main` for source reading.
