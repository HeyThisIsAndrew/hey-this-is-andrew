# Antigravity Swarm — QA of PR #126

## What to pull

```bash
git fetch origin claude/article-images-buildtime
git checkout claude/article-images-buildtime
git log -1   # expect c30d984 or later
npm ci
```

Branch: **`claude/article-images-buildtime`** · PR: **#126** · Base: `main`

Compare against `origin/main` for every regression question.

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

## THE MOST IMPORTANT THING IN THIS DOCUMENT

**"It passes locally" has been wrong three times in a row on this branch.**

The e2e job failed three CI runs for three different reasons, and **every one
of them was invisible in a local sandbox**:

| Run | Result | Cause | Why local passed |
|---|---|---|---|
| 1 | 0/19 | Chrome would not launch: `--no-sandbox` was applied only when uid 0 | The dev container runs as root, so the flag was always on |
| 2 | 19/20 | The job blanked `PUBLIC_TURNSTILE_SITE_KEY`, which makes the widget omit itself — and `e2e-turnstile-lazy` tests that widget | No `.env` override locally |
| 3 | 19/20 | Turnstile `600010` — the production sitekey is domain-locked to `beunconventionalhq.com`, suites run on `localhost:4321` | The dev sandbox blocks `challenges.cloudflare.com`, so the check is never reached and the server fails open |

So: **when you report a pass, say what your environment could and could not
reach.** If `challenges.cloudflare.com`, `googletagmanager.com`,
`substackcdn.com`, `cdninstagram.com`, `i.ytimg.com` or `wsrv.nl` are blocked
for you, a green result on anything touching them is not evidence. State it
explicitly. A report that says "all tests pass" without that qualification is
the failure mode this table documents.

---

## What changed, and the claims to falsify

### A. Article images are now served from our own origin

10 raw Substack S3 uploads, **22.54 MB**, became committed WebP renditions in
`public/article-images/` totalling **262 KB** at the 720w default.

- **Claim:** `/intel/spider-man-brand-new-day-review` serves 10 images from
  `/article-images/…`, 6 from `substackcdn.com`, 1 from `wsrv.nl` (a
  "More From" card via `ContentCard`, which predates this PR).
- **Claim:** page integrity is unchanged — 20 `<img>`, 6 `<figure>`, 73
  paragraphs, 5 gallery slides, 9 TOC links, identical to `main`.
- **Claim:** an image with no manifest entry is returned **byte-identical**,
  so nothing can break; `substackcdn` URLs are deliberately skipped because
  they already carry `w_1456,c_limit,f_auto,q_auto:good`.

**Falsify, and weight this highest:** this exact surface **already shipped
broken once**. A previous pass routed these through `wsrv.nl`; on a real phone
the gallery images were blank and stayed blank while sliding, because
`SubstackGallery`'s lightbox reassigns `img.src` per slide against a cold
proxy. Open the gallery on a **throttled mobile connection** and slide through
every image. Time to first paint per slide. Then do it again on `main` and
compare. If this is not clearly better, say so loudly.

Also verify: delete an entry from `src/data/article-images.json`, rebuild, and
confirm that image falls back to its original URL rather than rendering an
empty `src`. **Revert the file afterwards.**

### B. The 19 e2e suites now run in CI

`scripts/e2e-run.mjs` replaced a `&&` chain. It discovers suites from disk,
waits for the preview port handover, reclaims the port from an orphan, retries
a suite once, and aborts the run if the port cannot be reclaimed.

- **Claim:** a real failure fails twice; a load flake does not.
- **Claim:** a suite that passes only on retry is **named** in the summary.
- **Claim:** `e2e-newsletter-subscribe` is the one that historically needs the
  retry.

**Falsify:** run `npm run test:e2e` **three times**. Report, for each run:
total pass count, wall time, and exactly which suites needed the retry. A suite
that needs the retry every single time is a real defect being masked — name it.
Then break one suite deliberately and confirm the runner reports it as failed
after two attempts rather than hiding it. **Revert.**

### C. Turnstile in CI uses Cloudflare's always-passes test key

`1x00000000000000000000AA` (public, documented, not a secret).

- **Claim:** this is the only value that satisfies both suites — it renders, so
  `e2e-turnstile-lazy` has a widget to watch, and it is valid on any domain, so
  `e2e-newsletter-subscribe` can get a token.
- **Claim:** production is untouched; the key is written to `.env` inside the
  CI job only, and `wrangler.jsonc` still carries the real key.

**Falsify:** confirm a production build (no `.env` override) still bakes
the site key from `wrangler.jsonc` into the pages. It was
`0x4AAAAAAD6D_U7FgRw-3m_G` when this was written and rotated to the Invisible
widget's key in #190, so read the current value out of `wrangler.jsonc` rather
than pinning it here. If this PR leaked a test key into
anything production serves, that is a **blocking** finding.

### D. A reporting-only desktop Lighthouse job

Builds **without** `PUBLIC_DISABLE_ANALYTICS`, so it measures what production
actually serves. `continue-on-error` — it never gates.

- **Claim:** a red X on `lighthouse-production-equivalent` is expected and is
  not a blocker.
- **Context:** production desktop is **88**, with FCP 0.5s, LCP 0.7s, TBT
  280ms, CLS 0.002, SI 1.1s. Only TBT is bad, and it is third-party analytics.

**The one number nobody has, and the most valuable thing you can produce:**
of that 280 ms TBT, **how much is GTM / gtag / the Cloudflare beacon /
Partytown, and how much is our own bundles?** Attribute it per script, in
milliseconds. Neither CI nor the dev sandbox can measure this — CI disables
analytics and the sandbox blocks `googletagmanager.com`.

Do **not** propose deferring analytics until first interaction. That decision
has been taken deliberately: it would recover most of the 12 points but stop
counting visitors who leave without interacting, and the owner is growing an
audience and needs that data. Propose it only if you can show, with a
measurement, that the tracking loss is smaller than assumed.

---

## Swarm assignments

**Agent 0 — REGRESSION HUNT vs `main`. Do this first and weight it highest.**
Anything that works on `main` and does not on this branch. Article pages,
`/intel`, `/feed`, `/links` and the homepage all have changed image paths.
Diff the built HTML of both branches page by page if that is what it takes.

**Agent 1 — The article gallery on a throttled phone.** See A. Highest-risk
recently-changed surface; it has shipped broken once already. If you have real
iOS Safari, this is where to spend it.

**Agent 2 — Real iOS Safari, and say plainly if you do not have it.** Every
iOS fix on this site is verified in Chromium only. Chromium hit-tests hidden
and fixed elements correctly and resets scroll on reload, so it **cannot**
reproduce several bugs this site has had: the landscape hero filling the
viewport after rotation and after a mid-page reload, the phantom overlay, the
splash scroll lock, the corner controls staying tappable. Report how many tabs
you had open — the tab strip changes the viewport.

**Agent 3 — The e2e harness.** See B. Three runs of the full suite, plus the
deliberate-break falsification.

**Agent 4 — Performance attribution.** See D. Milliseconds per script, not
adjectives. Lighthouse ×3, median, mobile and desktop, on `/`, `/feed`,
`/intel` and one article page.

**Agent 5 — The syncs.** `sync-youtube`, `sync-articles`, `sync-instagram`,
`sync-article-images`, `sync-media-kit`. Read the workflows and the scripts.
Under what conditions does each fail silently, blank its data file, or commit
nothing while reporting success? All of them have done at least one of those.
`sync-article-images` is new in this PR — attack its never-break contract
specifically: dry-run default, skip-not-fail on an unreachable image, merged
never truncated, quiet run writes nothing.

**Agent 6 — Instagram rail correctness.** Recompute independently from
`src/data/instagram.json`: 50 posts, 38 shared to feed, 3 reels-tab only
(hidden), 9 non-reels with no field (kept). Confirm none of the 3 hidden
permalinks appear in the built HTML, and that the homepage shows 10 unique
tiles.

**Agent 7 — Accessibility.** Keyboard traversal of the nav, the video modal,
the calendar and category modals, and the gallery lightbox. Focus visibility,
focus return on close, escape handling. The muted-grey text palette failing
WCAG contrast in places is a **known and deliberate** design trade-off — note
it once, do not file it repeatedly.

**Agent 8 — Tests that cannot fail.** This PR fixed **three** of them. Hunt for
more. For every test you believe guards something, reintroduce the defect it
guards, watch it go red, then revert. Report any that stayed green. Known
patterns in this repo: a guard matching its own comment prose rather than code;
a guard that passes vacuously because the data it inspects is empty; a guard
whose condition is already satisfied by the environment it runs in.

---

## Rules of evidence

- A defect needs: `file:line` (or a URL), reproduction steps, observed vs
  expected, and a measurement. "Looks fine" is not a finding. Neither is a
  defect without a reproduction.
- Mark every finding **introduced by this PR** or **pre-existing on main**.
- Run Lighthouse three times and report the median. One sample is noise.
- State what your sandbox blocked. See the table at the top — this has produced
  wrong conclusions in both directions.

## Environment notes — do NOT report these as defects

- `npm ci` first. Node 22.
- `npm run test:e2e` needs port 4321 free. Kill stray `workerd` /
  `astro preview` first (`pkill -f workerd`).
- The Substack article sync degrades to empty without network, **by design**.
- `docs/` is gitignored. Operator docs live in `scripts/*.md`.
- Cloudflare **Pages** previews serve only `dist/client` and 404 every
  `/api/*` route — production runs on **Workers**. Use the Workers preview URL
  for anything touching an API route.

## Required output

1. **VERDICT: GO or NO-GO on merging #126** — first line.
2. **Confidence** (high/medium/low) and what would raise it.
3. **Blocking defects** — full evidence, each marked introduced-by-this-PR or
   pre-existing.
4. **Non-blocking findings**, ranked.
5. **Tests that cannot fail** — any you falsified successfully.
6. **TBT attribution table** — ms per script. The one number nobody has.
7. **The gallery-on-a-phone result** — throttled, sliding through every image,
   this branch vs `main`. With times.
8. **Claims you could NOT verify**, and why. State plainly whether you tested
   real iOS Safari, and what hosts your sandbox blocked.
9. **Disagreements with Claude**, each with the measurement behind it.
10. **Numbers**: `npx astro check` (errors/warnings/hints), `npm test`,
    `npm run test:e2e` ×3, Lighthouse mobile ×3 and desktop ×3.

Be adversarial and specific. If you believe this is safe to merge, say GO and
say why you are confident.

---

## OPERATOR TO-DO — how to run this

**Model:** **Gemini 3.1 Pro**. This is an analysis job, not a code-writing job,
and the entire value is an independent second opinion. Do not run it on a
Claude agent — a second Claude checking the first Claude's work is worth much
less to you.
