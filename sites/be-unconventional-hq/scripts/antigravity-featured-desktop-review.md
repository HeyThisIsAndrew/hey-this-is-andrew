/goal

# Desktop design review of /featured and the hub pages — READ-ONLY, UNATTENDED

## Read this part first

**Nobody is at the keyboard. The person who set this task is not home and will
not be back before you finish.** No question you ask will be answered, no
approval you wait for will arrive, and a run that stops to check something has
failed at the only thing it was asked to do.

So:

- **Never ask a question.** If something is ambiguous, choose the reading that
  lets you keep working, write the choice down under *Assumptions*, and carry
  on.
- **Never wait for approval.** Everything you are permitted to do is listed
  under *Boundaries* below. If it is on that list, do it. If it is not, do not
  do it and do not ask.
- **Never stop early.** Blocked on one of the five passes? Record what blocked
  you, mark that pass *incomplete*, and start the next one. A report covering
  four passes and honestly declaring the fifth blocked is a success. A run that
  halts on pass two is not.
- **Finish by writing the report.** The run is not over when you have opinions.
  It is over when the report is committed and pushed, per *Delivering it*.

## What this is

A design critique of the Featured Hubs page and the hub pages it leads to, on
**desktop only**. You are assessing, not building.

## Boundaries

**You may:**

- Browse the preview site, resize, zoom, screenshot, use devtools.
- Read anything in the repository.
- Create ONE new branch named `review/featured-desktop`, and commit to it only:
  - `scripts/reviews/featured-desktop-review.md` — your report
  - `scripts/reviews/shots/*.png` — your screenshots
- Push that branch.
- Post one comment on PR #141 with your summary, if you have GitHub access. If
  you do not, skip it — the branch is the real deliverable.

**You may not:**

- Change any file under `src/`, `.github/`, `public/`, `src/data/`, or
  `package.json`, or any existing file in `scripts/`. Not one line, not even an
  obvious typo.
- Commit to `main`, `claude/featured-hubs-accordion-mtiyzo`, or
  `feature/featured-section-labels`.
- Merge, close, approve, or request changes on any pull request.
- Open a pull request.
- Run any `npm run sync*` script, or anything that writes to `src/data/`.

If you find a bug you could fix in thirty seconds: **describe it, do not fix
it.** Another agent is doing the implementation and will pick it up from your
report.

## Scope

**Desktop only.** 1440x900, 1728x1117, 2560x1440. Ignore phones and tablets —
mobile was reworked separately and is out of scope. A finding that only
reproduces below 1024px wide is out of scope; drop it.

**Judge what is there, not what you would have built.** The 3D deck, the
accordion rows and the four fixed categories are settled decisions. Do not
propose replacing them with a grid, a carousel, tabs, or a scroll-jacked
full-screen pager. Improvements go *inside* this design.

**Point at everything.** Every finding needs a screenshot, a viewport size, and
the hub or row it happened on.

## Where

Preview: `https://claude-featured-hubs-accordion-mtiyzo-beunconventionalhq.heythisisandrewb.workers.dev/featured`

Branch under review: `claude/featured-hubs-accordion-mtiyzo` (PR #141). The
identical page is on `feature/featured-section-labels`; the two are kept in
sync, so either is fine to read.

Also in scope, and specifically wanted: the hub pages the tiles lead to —
`/featured/marvel-comics`, `/featured/dc-comics`, `/featured/netflix`,
`/featured/playstation`.

**If the preview URL does not load**, build and serve it yourself rather than
giving up: `npm ci && npm run build`, then serve `dist/client` on a local port.
Note in the report that you reviewed a local build.

## Already known — do not report these as discoveries

- **13 of the 15 hubs have no logo, no hero image and no tagged coverage.** They
  fall back to the Be Unconventional mark and a brand-tinted gradient, and their
  rail thumbnails render as text. Only Marvel and DC have real artwork. This is
  a content gap, not a bug. Comment on *how the design behaves* when artwork is
  missing; do not file "PlayStation has no image" as a finding.
- The typeface picker at the bottom right is dev-only and does not ship.
  Production is Montserrat Medium.
- Clicking a category header plays a low bass thud. Its future is undecided.
- `/featured` scores 94% on the Lighthouse performance gate (threshold 90).

## What changed recently, so you review the current state and not the last one

- The brand logo, the description and the way in have moved off the trailer and
  **onto the key art tile**, bottom-left, with an "Enter" chip in the opposite
  corner. The tile itself is the link.
- **The backdrop is now a cross-fading gallery of stills**, not a live video.
  On desktop a trailer still plays over the top of it, cropped to 132% of its
  box so YouTube's own chrome falls outside the frame. On phones the video does
  not load at all.
- The trailer no longer overhangs its row onto the footer.
- The hub rail no longer dims its first and last item.
- The typeface picker now works on desktop (it was scoped to a phone media
  query and did nothing above 768px).
- **The hub pages** got the same backdrop gallery, a category plate above the
  logo naming the row you came in through, the description reset as a small
  tracked-out billing line, and quieter filter tabs. Their brand colour also
  works for the first time — it was being emitted as `[object Object]`.

## The five passes

Run these as separate passes and keep their findings separate. Where two passes
disagree, report both and say so.

### 1. Composition
Open each of the four rows. For each: where does the eye land first, second,
third? Is that the intended order?
- The tile carries the logo, the line and the chip. Is that corner crowded, or
  is it the billing block it is meant to be?
- Does the trailer half feel purposeful, or like space that used to have
  something in it?
- Is the balance right at 2560px, where the row gets very wide and very short?
- The open row's category label is the *smallest* text on screen while the
  collapsed rows below it are large. Is that inversion working as "you are
  here, those are elsewhere", or does it read as a mistake?

### 2. Motion and timing
- Open and close each row several times. The reveal is staged: artwork, rail,
  mark, chip. Readable, or slow on a second viewing?
- The backdrop stills cross-fade every 7 seconds over 2.2 seconds. Watch a full
  cycle on Marvel (6 stills, so ~42s). Is the pace right? Is 2.2s the right
  dissolve? Does the loop become obvious?
- The trailer pushes in over 32 seconds. Watch a full cycle.
- The backlight tracks the pointer. Depth, or wobble?
- Anything that moves when it should be still, or lands after you have already
  looked at it.

### 3. The trailer, now that it sits over the stills
This is the pass I most want an outside opinion on.
- The iframe is cropped to 132% so YouTube's chrome sits outside the visible
  frame. **Does any of it still surface?** Leave a row open for a full five
  minutes and watch what the embed does when the video ends, and what it does
  on hover.
- Marvel's trailer has burnt-in titling ("DOOMSDAY IS COMING" and a countdown)
  baked into the video. The 132% crop pushes *toward* that titling. Is it worse
  than it was, better, or unchanged?
- Now that there is a still gallery underneath: **is the video earning its
  place on desktop at all?** Say yes or no and why. If no, say what is lost.

### 4. The cliff into a hub page
Click into `/featured/marvel-comics` from the deck, then `/featured/playstation`.
- Is the transition still a drop in production value? Describe it in specific
  terms — what does the hub page do differently from the page you just left?
- The category plate above the logo is meant to be the continuity cue. Does it
  read that way, or is it noise?
- Which two or three further changes would close most of the remaining gap
  without rebuilding the page? Rank them by value per unit of work.

### 5. Adversarial
- Resize slowly from 1024px to 2560px. Anything that overlaps, clips, escapes
  its row, or lands on the footer.
- Tab through with the keyboard only. Can you reach and enter every hub? Is the
  focus ring visible on the artwork?
- Open a row, scroll the hub rail, open a different row, come back.
- Leave the page open ten minutes and come back.
- Browser zoom at 150% and 200%.
- Open every row in turn, fast, without waiting for animations.
- Navigate deck → hub page → back → deck. Twice. (The page uses view
  transitions; timers that survive a navigation show up here as double-speed
  cross-fades.)

## The report

Write `scripts/reviews/featured-desktop-review.md` with these sections, in this
order:

1. **Assumptions** — every judgement call you made because nobody was there to
   ask. If there were none, say so.
2. **Coverage** — which of the five passes completed, and for any that did not,
   exactly what blocked it.
3. **Findings** — a table: what, where (hub + row + viewport), screenshot
   filename, severity (`breaks` / `looks wrong` / `taste`).
4. **The opinion** — half a page, plain language. Does this look like a finished
   product? If a stranger landed here, what would they think it was? Where does
   it fall short of that?
5. **Suggestions** — ranked, each with what it would cost and what it would buy.
   Name the single change you would make first.
6. **What you would cut** — at least one thing. This page has accreted parts and
   I want an outside view on which are not earning their place.

No code, no diffs, no patches. Prose and screenshots.

Be direct. "It looks good" is not useful; if something works, say what makes it
work, so it survives when the rest changes.

## Delivering it

1. `git checkout -b review/featured-desktop` from the branch under review.
2. Commit the report and the screenshots. Nothing else — run `git status` and
   confirm before you commit.
3. `git push -u origin review/featured-desktop`, retrying a few times on network
   failure.
4. If you have GitHub access, post one comment on PR #141 with sections 4 and 5
   (the opinion and the suggestions) and a link to the branch. Do not open a PR.

## Done means

- [ ] All five passes attempted, and any that could not complete are named with
      the reason.
- [ ] Report exists at `scripts/reviews/featured-desktop-review.md` with all six
      sections.
- [ ] Every finding has a screenshot committed beside it.
- [ ] Branch `review/featured-desktop` pushed.
- [ ] `git diff main --name-only` on your branch lists ONLY files under
      `scripts/reviews/`.
- [ ] Nothing merged, no PR opened, no existing file modified.

Verify that checklist yourself before you finish. If an item fails, fix it and
check again. Do not report success until every box is true.
