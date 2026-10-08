/goal

# Round 2 — /featured desktop review: pull latest, then fix how you evidenced round 1

## Read this part first

**Nobody is at the keyboard.** The person who set this task is not home and will
not be back before you finish. No question you ask will be answered and no
approval you wait for will arrive.

- **Never ask a question.** Choose the reading that lets you keep working,
  write it down under *Assumptions*, carry on.
- **Never stop early.** A blocked check is recorded and skipped. The pass it
  belongs to continues.
- **The run ends when the report is pushed**, not when you have opinions.

## First: you are reviewing a different page than you did last time

Your round 1 review was against `511ba70`. The branch is now at `b88418d` or
later. **Pull it before you look at anything.**

```
git fetch origin
git checkout claude/featured-hubs-accordion-mtiyzo
git pull
```

Preview: `https://claude-featured-hubs-accordion-mtiyzo-beunconventionalhq.heythisisandrewb.workers.dev/featured`
(confirm the deployed commit matches the branch head before you trust it; if it
does not, build and serve `dist/client` locally and say so in the report).

### What changed because of your round 1 findings

All three were real and all three are fixed. Verify each — do not assume.

1. **Keyboard access.** The headers are now a `<h2>` wrapping a `<button>`,
   with `aria-expanded` and `aria-controls`. All four rows should be reachable
   by Tab and openable with Enter and Space.
2. **Typographic inversion.** The open row's label is now larger and brighter
   than the closed rows, with a rule in the category's colour down its left
   edge. It was NOT returned to banner size — the closed rows came down
   instead. Judge whether that reads as "you are here" now.
3. **Chrome on loop.** The trailer no longer loops. It fades in over the
   stills, runs for 42 seconds, then dissolves back to them and unloads before
   it can reach the boundary that showed the chrome. `loop` and `playlist` are
   gone from the embed. **Watch a full 42 seconds and the hand-off after it.**

Also changed since you looked, and unrelated to your review:

- The deck's cross-fade was **broken** in the build you reviewed — a stray brace
  had orphaned the `transition`, so the stills were hard-cutting every 7
  seconds instead of dissolving over 2.2s. It is fixed. See finding 5 below.
- A 0.276 layout shift was fixed (rows were sized by flex ratio, so each row
  arriving re-divided the ones already painted). The gate went 80% → 98%.
- The display typeface is now self-hosted rather than a Google Fonts request.

## Second: a correction I owe you

In my PR comment I said your suggestion 1 — carry the background media into the
hub page — was already shipped and that your screenshots predated the deploy.
**That was wrong, and I withdraw it.** `dc-1440.png` plainly shows the category
plate and the blurred backdrop from that commit, so you reviewed the current
build and the hub hero *was* still mostly black. The gallery is there; it is
just so blurred and so heavily scrimmed that it reads as empty. Your finding
stands and the fault is mine.

Re-check the hub heroes this round and say whether they still read as a void.

## Third: what round 1 got wrong

The judgement was good. Every finding was real, and two of them I would not
have caught. The **evidence** was not good enough, and that is the part to fix.

1. **You cited files that do not exist.** The findings table points at
   `motion-test.webm` and `keyboard-test.mjs`. Neither is in the branch. The
   only video committed is `page@b3b213602146f480bef6c56fb25ca647.webm` — an
   auto-generated trace name. A finding whose evidence cannot be opened cannot
   be checked, which makes it an assertion rather than a finding.
2. **You never tested 2560×1440.** The brief named three viewports and asked a
   specific question about the balance at 2560, where the row gets very wide and
   very short. Every screenshot is 1440 or 1728. That question is still
   unanswered.
3. **A viewport label was wrong.** The top finding says "Deck, 1440px";
   `hub-deck-1440.png` is 1815px wide.
4. **You abandoned Pass 5 over one blocked check.** The keyboard blocker was
   real and worth reporting. But the brief said to record a blocker and
   continue, and the other adversarial checks did not depend on it: the slow
   resize from 1024 to 2560, the ten-minute idle, zoom at 150% and 200%, opening
   every row rapidly without waiting for animations, and deck → hub → back →
   deck twice. Five checks were skipped over one.
5. **You missed a broken animation you were explicitly asked to watch.** Pass 2
   said: watch a full cycle on Marvel, six stills, about 42 seconds — is the
   pace right, is 2.2s the right dissolve? In that build there was no dissolve
   at all. The stills were cutting. Either the cycle was not watched or it was
   watched and not reported; either way it is the clearest evidence that the
   motion pass did not really happen.
6. **You branched from `main`, not the branch under review.** The brief said to
   branch from it. The consequence is that your own "Done means" check —
   `git diff main --name-only` lists only `scripts/reviews/` — passed
   trivially rather than proving anything.

None of that changes the verdict. It changes whether the verdict can be
trusted by someone who was not there, which is the entire job of a review.

## Evidence rules for this round

Non-negotiable, and check them yourself before you finish:

- **Every filename in the report must exist in the branch you push.** After
  writing the report, extract every filename you referenced and confirm each
  one resolves. If it does not, either produce it or remove the claim.
- **Name files for what they show**, not for what the tool called them:
  `keyboard-tab-order-1440.png`, `trailer-handoff-2560.webm`.
- **Every finding states the viewport it was seen at, and the file must match
  it.** If the screenshot is 1815px wide, the finding does not say 1440.
- **Screenshot at all three viewports**: 1440×900, 1728×1117, 2560×1440.
- **A pass is complete when every check in it has been attempted.** One
  blocked check blocks that check, not its pass.

## The passes

Everything from the first brief still applies. Prioritise, in this order:

1. **Verify the three fixes** listed above. Each gets its own before/after note
   and its own evidence file.
2. **The five adversarial checks you skipped.** These are the highest-value
   thing you can do this round, because nobody has done them at all.
3. **2560×1440 across the whole page**, including the balance question.
4. **The backdrop cross-fade, now that it actually dissolves.** 7s hold, 2.2s
   dissolve, six stills. Watch a full cycle on Marvel and a full cycle on
   PlayStation (whose stills are borrowed from its category and blurred much
   harder — say whether that reads as deliberate or as a mistake).
5. **The hub heroes**, per the correction above.

## Boundaries

Unchanged. You may create ONE branch, `review/featured-desktop-round-2`, cut
**from `claude/featured-hubs-accordion-mtiyzo`**, and commit only
`scripts/reviews/round-2/**`. You may not modify any existing file, may not
commit to `main` or either feature branch, may not open a PR, and may not
merge, approve or request changes. Describe bugs; do not fix them.

## Delivering it

1. `git checkout -b review/featured-desktop-round-2` **from the branch under
   review**, not from `main`.
2. Commit the report and evidence. Run `git status` and confirm before
   committing.
3. `git push -u origin review/featured-desktop-round-2`.
4. Post one comment on PR #141 with the opinion and the suggestions. No PR.

## Done means

- [ ] The branch under review was pulled, and the report names the commit SHA
      it was tested against.
- [ ] The three fixes are each verified, with evidence.
- [ ] All five previously-skipped adversarial checks were attempted.
- [ ] All three viewports covered, 2560 included.
- [ ] **Every filename referenced in the report exists in the branch**, checked
      after writing it.
- [ ] Every finding's stated viewport matches its evidence file's real size.
- [ ] Branch cut from `claude/featured-hubs-accordion-mtiyzo`, and
      `git diff claude/featured-hubs-accordion-mtiyzo --name-only` lists only
      `scripts/reviews/round-2/`.
- [ ] Nothing merged, no PR opened, no existing file modified.

Verify that list yourself. Do not report success until every box is true.
