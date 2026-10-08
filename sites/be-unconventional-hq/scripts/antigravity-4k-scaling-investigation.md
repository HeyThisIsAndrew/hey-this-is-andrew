# Investigation: 4K scaling on the homepage

**Branch:** `worker/feed-redesign` (= `prototype/feed-redesign`).
**This is an INVESTIGATION request. Measure and report before changing values.**

## Why you and not me

I do not have a 4K display. Everything I have tuned was measured against an
emulated 3840x2160 viewport inside a browser pane, which gets CSS pixels right
and tells me nothing about apparent physical size. The owner has now rejected
two rounds of my numbers as "way too big" and "still too big", and he is right
that I am guessing. You appear to be on the real hardware. Please measure there.

I also fixed the containers I happened to trip over rather than auditing all of
them, which is why the category tiles grew and the Intel cards did not. That
audit is the larger half of this task.

## The goal, in the owner's words

> "reduce the font sizes for our labels and the hero text, but maintain the 4K
> scaling and improve the scaling size of all tiles on the home page ... I want
> a middle ground between what exists in production and what you have changed"

Two separate problems, and they should not be solved with one lever:

1. **Type is too big.** Reduce it.
2. **Tiles are too small.** They are not shrinking; most of them never grew.

Do not fix 2 by making 1 worse. The last round bumped the root font and let the
tiles sit still, which made the mismatch worse rather than better.

## THE HARD CONSTRAINT

**Nothing below a 1920px window may move by a single pixel.** The 14" MacBook
rendering at 1512px is the reference the owner has signed off on, twice.

`--page-max` is 1536px at its base step, so anything driven by that token is
already safe. Verify it rather than trusting it: at 1512 the current values are
root `12.8px`, `.word-unconventional` `57.6px`, `.word-hq` `38.4px`,
`.word-be` `23.04px`, `.hero-subtitle` `12.16px`, `.container` 1497px,
category tile 341px wide. Any of those changing is a regression.

## The system that already exists, and is being bypassed

This is the important finding. The site ALREADY has a 4K scaling system in
`src/styles/modules/layout.css`:

```
:root            --page-max: 1536px  --feed-card: 320px  --feed-card-featured: 560px
min-width 1920   --page-max: 1920px  --feed-card: 380px  --feed-card-featured: 660px
min-width 2560   --page-max: 2240px  --feed-card: 440px  --feed-card-featured: 760px
min-width 3400   --page-max: 2600px  --feed-card: 500px  --feed-card-featured: 860px
```

These step correctly. The problem is that a scatter of hardcoded pixel caps
overrides them, so on a big screen a container stops growing while the tokens
say it should not. **The fix is almost certainly "route the caps through the
tokens", not "invent new numbers".**

Known offenders, confirmed:

| Where | What | Status |
|---|---|---|
| `Section.astro` | defaulted `maxWidth` to `'1536px'`, written as an INLINE style (beats every stylesheet) | fixed, now `var(--page-max, 1536px)` |
| `Categories.astro` | inline `max-width: 1536px` on `.cat-grid` | fixed, removed |
| `index.astro` | passed `maxWidth="1536px"` on three `<Section>`s | fixed, removed |
| `home-cards.css:247` | `.cat-grid, .latest-grid, .home-video-grid` capped at 1536px | fixed, now the token |
| **`latest.css:7`** | **`.latest-section { max-width: 1536px }`** | **NOT fixed — this is almost certainly why the Intel cards did not grow** |
| `contact.css:4`, `about.css:36/100/182`, `footer.css:25/250`, `newsletter.css:17` | hardcoded caps | not investigated |

There are ~54 hardcoded pixel `max-width` declarations in `src/styles`. Please
audit them rather than sampling.

## What I changed that you may want to move

In `hero.css`, the production clamps are the base and the raise is scoped to
4K, so it only moves the CEILING (below 4K the vw term still wins):

```css
@media (min-width: 3400px) {
  .word-be            { clamp(1rem,   calc(0.5rem + 1.25vw), 2.1rem); }
  .word-unconventional{ clamp(2rem,   calc(1rem + 4vw),      6.5rem); }
  .word-hq            { clamp(1.5rem, calc(0.75rem + 2.5vw), 4.3rem); }
  .hero-subtitle      { clamp(0.7rem, 0.62rem + 0.5vw,       1.15rem); }
}
/* plus the same block under :root[data-screen-4k] at min-width 1600 */
```

Root font is `115%` at `min-width: 3400px`, and `115%` for
`:root[data-screen-4k]` above a 1600px window.

Reference points for `.word-unconventional` at 3840: production ~79px (called
too small), my first attempt 176.8px (way too big), current 119.6px (still too
big). **The answer is likely between 79 and 119.** Please land it with a
measurement rather than another guess.

Note `data-screen-4k` is set inline in `Layout.astro` from `screen.width`,
because a 1920px window on a 4K panel is indistinguishable from a 1080p monitor
to any media query. Half-4K must keep working.

## What to measure, on the real monitor

For **3840x2160 fullscreen** and **1920x2160 (half)**, and 1512 as the control:

1. Root font size, and `.word-unconventional` / `.word-hq` / `.word-be` /
   `.hero-subtitle` computed px.
2. For every homepage section in order — hero, spotlight panel, What We Cover,
   spotlight banner, Featured Highlights, The Latest in The Intel, Instagram
   strip, Subscribe — report: the section's rendered width, its computed
   `max-width`, WHICH RULE SET IT (devtools "Computed" pane names the file and
   line), and the rendered width of one tile inside it.
3. Flag every section whose width is materially below `--page-max`. Those are
   the ones that never grew.
4. A screenshot of the whole homepage at 100% zoom on the real panel.

## What to come back with

- The table from step 2, with the file:line responsible for each cap.
- A proposed value for each of the four hero sizes, with the reasoning, aimed at
  the middle the owner asked for.
- A proposed approach for the tiles: **prefer routing the offending caps through
  `--page-max` / `--feed-card` over inventing new fixed numbers.** If a section
  genuinely should stay narrower than the page (a text column, for instance),
  say so and say why.
- Confirmation that the 1512 control values above are untouched by whatever you
  propose.

Please do not push value changes before the owner has seen the numbers. Two
rounds of unmeasured tuning have already been rejected, and a third would cost
more trust than it saves time.

## Working agreement

We are both writing to this checkout. Before you start, check `git status` and
leave alone anything you did not author; I will do the same. Your
`HomeSpotlightBar.astro` routing change and your `navbar.css` edit are both
still uncommitted in the tree as I write this. Use a preview port other than
4399, and prefer `npx astro preview stop` over `pkill`: two servers on one port
produce a server that answers 500 to everything while reporting healthy.
