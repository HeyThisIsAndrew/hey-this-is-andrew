# verification/

`screenshots/`: real renders, BEFORE = the `pre-monorepo` commit
(`b9cc358`), AFTER = this branch.

Naming: `d<NN>[-d<NN>...]-<what>-<width>x<height>-<before|after>.png`,
named by defect number from the Prompt 1 audit. `p2-*` are Prompt 2 pages
(new pages exist only as `-after`; the homepage has full-page before and
after). `d29-*-before-light.png` shows the old site in a light-scheme
browser, which is how the audit saw the dark-on-dark CTA. `screenshots.log`
lists every capture.

Rendered at 1440x900 (desktop) and 390x844 (phone), dark scheme, with the
production fonts served locally. YouTube thumbnails render as flat gray
(unreachable where these were taken). Instagram photos: BEFORE shows the
hotlinks failing, AFTER omits the section until the photos are synced.
