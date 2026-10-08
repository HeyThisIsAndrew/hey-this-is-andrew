# Row artwork

Key art for a tentpole shelf on `/feed`. Drop a file in here and the banner
appears above that row; leave it out and the shelf renders its text lockup
exactly as before. There is no half state.

Files are matched by BASENAME, without the extension, from `RowDef.bannerArt`
and `RowDef.bannerLogo` in `src/components/FeedGrid.astro`. `.jpg`, `.jpeg`,
`.png`, `.webp` and `.avif` all resolve. They go through Astro's image
pipeline, so they are hashed, converted to WebP and served with a real srcset —
do NOT put them in `public/`, which skips all of that and ships a broken `<img>`
for a filename that does not exist yet.

Currently expected:

| basename            | what it is                    |
| ------------------- | ----------------------------- |
| `lanterns-key-art`  | the strip behind the lockup   |
| `lanterns-logo`     | the series' own logo          |

## Key art

**2560 x 1440 (16:9).** 2560 is 1x on the widest desktop this site sees and 2x
at 1280; the srcset ladder is built down from there, so one file covers every
width. Smaller art still works and is upscaled on wide displays.

The strip is full-bleed and `clamp(200px, 22vw, 380px)` tall, so it is always a
CENTRED CROP of the 16:9 frame — about the middle third at desktop width, less
on a phone.

- Keep the subject in the **middle third vertically**. The top and bottom go.
- Keep the **left ~35% quiet**: the eyebrow and the logo sit there, over a
  scrim. Detail behind them is wasted and fights the type.
- No title treatment. The logo is rendered separately on top of this, and the
  row heading names the hub again below it. Artwork that also sets the title
  puts the same words on screen three times, which is the repetition
  `CLAUDE.md` records on the event hero.

## Series logo

**Transparent PNG, at least 1200px wide.** It renders at up to 124px tall and
460px wide, so 1200 covers 2x with room to spare.

Where a logo is supplied it stands in for the publisher badge, the divider AND
the row title — a studio logo usually already carries the publisher's mark, and
drawing that mark again beside it is the same repetition. The row still has an
`<h2>`; it is just screen-reader-only.

Trim the transparent padding. The marks already in `videos.json` are mostly
letterboxed squares (DC is 313x313, HBO Max 1080x1080) and the height cap has to
clear that baked-in padding before the mark itself reads, which is why the row
marks are larger than they strictly need to be.
