# Problems 6 to 9, 2026-10-01 (branch claude/personal-site-visual-fixes)

Before = commit 0c55f79 (main at the time). After = this branch. Andrew's own
photos stand in for the Instagram sync, as in the earlier boards.

| File | What it shows |
| --- | --- |
| `06-meet-the-creator-1512.jpg` | HQ "Inside the HQ" next to "Meet the Creator", before and after, at 1512 |
| `06-meet-the-creator-390.jpg` | HQ, personal before, personal after, at 390 |
| `06-about-page-1512.jpg` | /about uses the same component, so it changes the same way |
| `07-08-cafe-card-1512.jpg`, `07-08-cafe-card-390.jpg` | Cafe card: the red cocktail photo and "Reel Preview" gone, a dark project note in their place |
| `08-work-player-1512.jpg`, `08-work-player-390.jpg` | Work page video player, opened by tapping the first video card |
| `09-status-bar-home-390.jpg`, `09-status-bar-work-390.jpg` | 390 with an iPhone's safe area emulated: top, mid-scroll, deep |
| `09-status-bar-menu-landscape.jpg` | After: the phone menu open, and landscape |

## Measured (HQ rendered locally from its repo, same fonts)

| | HQ | Personal before | Personal after |
| --- | --- | --- | --- |
| Section gap, 1512 / 390 | 121 / 64px | 84 / 64px | 121 / 64px |
| Section heading, 1512 / 390 | 23.7 / 18.4px | 12.6 / 16.8px | 23.7 / 17.2px (fits "Meet The Creator" on one line at 375) |
| Headline, 1512 / 390 | 39.3 / 29.3px | 38.4 / 32px | 39.3 / 29.3px |
| Body, 1512 | 15.9px / 27px, 780px column | 12.2px / 21.4px, 496px | 15.9px / 27px, 780px |
| Body, 390 | 16.8px / 28.6px | 16.3px / 28.6px | 16.8px / 28.6px |
| Tagline, 1512 / 390 | Syne 800, 19.2 / 16px | Inter 400 at body size | Syne 800, 19.2 / 16px, white |
| Photo card, 1512 / 390 | 320px square / 234px | 340px portrait / 300px | 320px square / 234px |

## Notes

- The video player could not reach YouTube from the build machine, so a
  stand-in embed answered YouTube's real start handshake. Before: the
  player sat cued (it relied on `autoplay=1`, which HQ found triggers
  YouTube's sign-in wall), and closing it set the frame to `""`, which loads
  the site inside the hidden frame. After: started by command once ready,
  closed to `about:blank`. Worth one tap on a real iPhone.
- The status bar emulation sets the same 59px safe area an iPhone 15/16
  reports; the island and clock are drawn on afterwards.
