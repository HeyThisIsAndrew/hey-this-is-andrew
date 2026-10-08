/goal

# Round 3 — /featured: pull latest on BOTH branches, then do the things I cannot

## Read this first

**Nobody is at the keyboard.** The owner is driving and will not answer
anything. Do not ask questions, do not wait for approval, do not stop early. A
blocked check is recorded and skipped; the pass it belongs to continues. The
run ends when your report is pushed, not when you have opinions.

**This round is a gap fill.** I have been building this page all day inside a
headless container that cannot reach `cdn.sanity.io`, `fonts.googleapis.com` or
YouTube, and that rasterises in software rather than on a GPU. That means there
are whole classes of question I am structurally unable to answer, and I have
already got two of them wrong today by trusting a local measurement of a page
that never actually rendered. **You appear to be able to see and measure things
I cannot. That is the point of this round.** The priority order below reflects
that: the things only you can do come first.

---

## Step 0 — get on the latest code, and prove it

Two branches carry an identical `/featured`. **Verify both.**

```
git fetch origin
git checkout claude/featured-hubs-accordion-mtiyzo && git pull
git checkout feature/featured-section-labels && git pull
```

At the time of writing:

| Branch | Head |
| --- | --- |
| `claude/featured-hubs-accordion-mtiyzo` (PR #141) | `ec80139` |
| `feature/featured-section-labels` | `a8f4450` |

**Prove they agree** before you test anything:

```
git diff origin/feature/featured-section-labels:src/pages/featured/index.astro \
         origin/claude/featured-hubs-accordion-mtiyzo:src/pages/featured/index.astro
git diff origin/feature/featured-section-labels:'src/pages/featured/[slug].astro' \
         origin/claude/featured-hubs-accordion-mtiyzo:'src/pages/featured/[slug].astro'
```

Both must be empty. **If either differs, stop testing and report it as your
first finding** — the branches drifting is a bug in its own right.

Then confirm the preview is serving what you just pulled. The commit SHA the
deploy is built from is in the Cloudflare comment on PR #141. If it lags,
`npm ci && npm run build` and serve `dist/client` locally instead. **State in
your report which SHA you tested and whether it was the preview or a local
build.** Round 1 tested a build three commits stale and it cost us a wrong
conclusion each way.

Preview: `https://claude-featured-hubs-accordion-mtiyzo-beunconventionalhq.heythisisandrewb.workers.dev/featured`

---

## PASS 1 — SMOOTHNESS. This is the most important thing in this document.

The owner's words: *"it was really slow, like it wasn't smooth"*, and *"I
definitely need this to be running at the same smoothness as the rest of my
site."* They were testing on a phone, on a build before the last few commits.

**This is a frame-rate problem, not a load problem.** The Lighthouse score is
99% and that number says nothing about whether the page feels smooth once it
has loaded. Do not report the Lighthouse score as evidence about smoothness.

### What I already know, so you do not repeat it

Profiled at 412×823 with a 4× CPU throttle, in software rasterisation:

| Interaction | p95 frame | worst frame | frames over 32ms |
| --- | --- | --- | --- |
| **Opening a category row** | **50ms** | **87ms** | **13 of ~50** |
| Switching hub via the rail | 22ms | 52ms | 6 |
| Idle backdrop cross-fade | 18ms | 42ms | 3 |
| Scrolling the page | 18ms | 25ms | 0 |

So: scrolling and idle are fine, **opening a row is the problem.** Ablation
showed no single cause — the blur and the flex-basis animation each cost some
and together are about half of it.

I then made two changes and measured seven runs before and after: **the median
did not move** (p95 50.7ms → 50.2ms); only the worst case improved (69.8ms →
53.6ms). Those changes were still worth making because they are strictly less
work — one blurred surface instead of six per hub, and closed rows no longer
laid out or painted — but they did not solve it.

### What I need from you

1. **Measure it on real hardware.** A real phone if you can drive one, or at
   minimum a GPU-backed browser rather than software rasterisation. My numbers
   may be meaningless: a `filter: blur()` costs something completely different
   on a phone GPU than in a software rasteriser, and it is plausible that the
   thing I optimised was not the real bottleneck at all.
2. **Record the row open.** A video or a DevTools performance trace of opening
   a category row on a phone. That artefact is the single most valuable thing
   you can produce this round.
3. **Name the actual bottleneck** from a real trace: layout, paint, composite,
   rasterisation, or script. I can only guess at the split.
4. **Compare against the rest of the site.** Open `/feed`, `/intel`, `/events`
   and scroll them, then do the same on `/featured`. The owner's bar is "as
   smooth as the rest of my site" — so measure the rest of the site and tell me
   the gap in numbers, not impressions.
5. **Say whether it is acceptable.** If the row open is still visibly janky on
   a real phone after these commits, say so plainly and say what you would cut
   to fix it. Candidates I can see, in the order I would sacrifice them:
   the 0.7s flex-basis animation (animating a layout property is inherently
   expensive — a snap or a cross-fade would not be), the ambient backlight
   blur, the deck's 3D offsets, the staged reveal delays.

**Do not fix any of it. Measure it, name it, and rank it.**

---

## PASS 2 — the things I have never actually seen

Every one of these is blocked in my environment. I have shipped all of it blind.

1. **Real artwork.** I have never seen a Sanity image render. Marvel and DC have
   real logos and hero images; the other thirteen have neither.
2. **The real typeface.** Montserrat is now self-hosted at
   `public/fonts/montserrat-500-latin.woff2`. Confirm it actually loads and that
   the row labels are set in it — it is `font-display: optional`, so if it
   misses its window the fallback is kept deliberately.
3. **The trailer.** I have never seen one play. It now runs **once for 42
   seconds and then dissolves into the stills**, rather than looping.
   - Watch a full 42 seconds and the hand-off at the end.
   - **Does any YouTube chrome appear at any point?** This is the owner's
     original complaint and the reason for the crop and the no-loop change. If
     it still surfaces, say so — the recommendation to cut the desktop video
     becomes the right call and I will do it.
4. **The backdrop cross-fade.** Six stills, 7s hold, 2.2s dissolve. In round 1
   this was silently broken and cutting instead of dissolving; you were asked to
   watch it and did not report it. Watch it now on Marvel (its own coverage,
   lightly blurred) and on PlayStation (borrowed category footage, blurred much
   harder). Does the heavy blur read as deliberate or as a mistake?
5. **iPhone / iOS Safari.** I have no device. This page carries four separate
   iOS-specific fixes from the project's documented rules — an unclipped iframe
   ancestor, no `drop-shadow` on an `<img>`, no empty iframe `src`, no
   transformed cross-origin iframe. Confirm on a real iPhone: does the trailer
   play, or is it a black box?

---

## PASS 3 — the five adversarial checks round 1 skipped

Round 1 declared this pass blocked because the keyboard was unreachable. That
blocker is fixed, and the other five checks never depended on it.

1. Resize slowly from 1024px to 2560px. Anything that overlaps, clips, escapes
   its row, or lands on the footer.
2. Open a row, scroll the hub rail, open a different row, come back.
3. Leave the page open ten minutes and come back. (The backdrop runs on a
   timer; the trailer stops itself after 42 seconds.)
4. Browser zoom at 150% and 200%.
5. Open every row in turn, fast, without waiting for animations. Then
   deck → hub page → back → deck, twice. This page uses view transitions and
   timers, and a timer surviving a navigation shows up here as a double-speed
   cross-fade.

Plus, now that it is fixed: **keyboard.** Tab through the whole page. All four
rows should be reachable as buttons, Enter and Space should open a closed one,
and the focus ring should be visible on both the row headers and the artwork.

---

## PASS 4 — verify what changed since round 1

Each of these was a round 1 finding or a bug I found afterwards. Verify each,
with its own evidence file. Do not re-report them as new.

| Change | What to check |
| --- | --- |
| Headers are `<h2>` + `<button>` | All four rows keyboard-reachable and operable |
| Typographic hierarchy inverted back | Open row now leads; does it read as "you are here"? |
| Trailer plays once, no loop | No chrome at any point in the 42s or the hand-off |
| Hub heroes lifted out of their scrims | I stacked two gradients to 99% black over a working gallery. Do they read as scenes now? |
| Rows sized by flex-basis | A 0.276 layout shift as the page streamed. Confirm CLS is near zero on a throttled load |
| Typeface self-hosted | No `fonts.googleapis.com` request from `/featured` |
| Trailer iframe has a dark background | Block YouTube at the network level and reload — the trailer area must go dark, not white |

---

## Questions I actually need answered

Answer each explicitly in the report. "Not tested" is an acceptable answer;
silence is not.

1. Is the row open acceptably smooth on a real phone? If not, what is the
   bottleneck and what would you cut?
2. How does `/featured` compare to `/feed` and `/intel` for smoothness, in
   numbers?
3. Does YouTube's chrome appear during the single 42-second play?
4. Does the trailer play on a real iPhone, or is it a black box?
5. With real artwork loaded, is the backdrop blur right — or is it now so soft
   that the hubs are indistinguishable from one another?
6. Do the thirteen hubs with no artwork look acceptable, or actively unfinished?
7. Is the bass thud on opening a row worth keeping?
8. Is there anything on this page you would still cut?

---

## Boundaries

Unchanged, and they matter.

- **You may create ONE branch**, `review/featured-round-3`, cut **from
  `claude/featured-hubs-accordion-mtiyzo`** — not from `main`. Round 1 branched
  from `main`, which made its own "I only touched the review directory" check
  pass without proving anything.
- Commit only under `scripts/reviews/round-3/`.
- **Do not modify any existing file.** Not one line, not an obvious typo.
- Do not commit to `main` or to either feature branch. Do not open a PR. Do not
  merge, approve, or request changes.
- Describe bugs. Do not fix them.

## Evidence rules

Round 1's judgement was good and its evidence was not. These are the fix.

- **Every filename in the report must exist in the branch you push.** Round 1
  cited `motion-test.webm` and `keyboard-test.mjs`; neither existed. After
  writing the report, extract every filename you referenced and confirm each
  one resolves. If it does not, produce it or drop the claim.
- **Name files for what they show**, not for what the tool called them. Round 1
  committed `page@b3b213602146f480bef6c56fb25ca647.webm`.
- **Every finding states its viewport, and the file must match.** Round 1
  labelled a finding "1440px" with a 1815px-wide screenshot.
- **Screenshot at 1440×900, 1728×1117 and 2560×1440.** Round 1 never tested
  2560 despite being asked a specific question about it.

## The report

`scripts/reviews/round-3/featured-round-3.md`, in this order:

1. **Tested against** — branch, SHA, preview or local, and the result of the
   two branch-diff checks from Step 0.
2. **Assumptions** — every call you made because nobody was there to ask.
3. **Coverage** — which passes completed; for any that did not, exactly what
   blocked it.
4. **Smoothness** — numbers, the trace, the named bottleneck, the comparison
   against the rest of the site, and your verdict. This section leads.
5. **Answers** — the eight questions above, each answered.
6. **Findings** — table: what, where (page + row + viewport), evidence file,
   severity (`breaks` / `looks wrong` / `taste`).
7. **Verification** — the round 1 fixes and the Pass 4 table.
8. **What you would cut.**

## Delivering it

1. `git checkout -b review/featured-round-3` from
   `claude/featured-hubs-accordion-mtiyzo`.
2. Commit the report and evidence. `git status` and confirm before committing.
3. `git push -u origin review/featured-round-3`.
4. Post one comment on PR #141 with the smoothness verdict and the eight
   answers. No PR.

## Done means

- [ ] Both branches pulled, and the two diff checks reported.
- [ ] The report names the SHA tested and whether it was preview or local.
- [ ] Smoothness measured on real hardware, with a trace or video committed.
- [ ] `/featured` compared against at least two other pages, in numbers.
- [ ] All eight questions answered explicitly.
- [ ] All five previously-skipped adversarial checks attempted.
- [ ] All three viewports covered, 2560 included.
- [ ] **Every filename referenced exists in the branch**, checked after writing.
- [ ] Every finding's viewport matches its evidence file's real dimensions.
- [ ] `git diff claude/featured-hubs-accordion-mtiyzo --name-only` lists only
      `scripts/reviews/round-3/`.
- [ ] Nothing merged, no PR opened, no existing file modified.

Verify that list yourself before finishing. Do not report success until every
box is true.
