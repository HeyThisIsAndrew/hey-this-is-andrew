# Visual fixes, 2026-10-01 (branch claude/personal-site-visual-fixes)

Before/after at 1512x900 desktop and 390x844 phone, real fonts. The photo
grids use Andrew's own photos (committed by him on 2026-09-26, commit
6356390) standing in for the CI-synced Instagram set, which this build
machine cannot download. Filmstrips are 10x slow motion; each frame is
labelled by its time in the normal-speed motion (0 to 900 ms).

| file | fix |
| --- | --- |
| 1-hero.png | 1. Hero portrait at full strength (no wash, no filter) |
| 2-logo.png | 2. Andrew's logo file in the nav and the hero |
| 3a-brands-default.png | 3. 16:9 open panel, restrained copy, no stray dot under THE BRANDS; phone shows the whole headline |
| 3b-brands-zoom.png | 3. Brand view: art whole, copy in a band below; mid-change and zooming-in states |
| 3c..3f-film-*.png | 3. Panel change (desktop, phone), zoom in, zoom out: copy crossfades with the motion |
| 4a-home-elevator.png | 4. Homepage: About, then the photo elevator; phone with a photo open |
| 4b..4e-film-photo-*-390-*.png | 4. Phone open and close, before and after: whole photo, neighbours visible, no warp |
| 5-work-gallery.png | 5. /work gallery: no cropped slivers, no dark unloaded tiles |
