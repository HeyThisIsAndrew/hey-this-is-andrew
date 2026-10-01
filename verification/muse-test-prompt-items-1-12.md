# Test prompt for Muse: items 1 to 12

Paste everything below the line. It tests the live site, so run it after
Andrew merges `claude/personal-site-visual-fixes` and the deploy finishes.

---

You are testing a personal website in real browsers. Do not change any code. Report what you see, with evidence.

SITE: https://heythisisandrew.github.io/hey-this-is-andrew/
Reference site (for comparison only): https://beunconventionalhq.com/

DEVICES, in priority order:
1. A real iPhone (iPhone 17 Pro Max if available), Safari.
2. Desktop Chrome at a 1512x900 window.
3. Desktop Safari at 1512x900.
4. Android Chrome.
Say which device, OS and browser version produced each result. If you only have an emulator for an iPhone test, say so.

HOW TO REPORT
For every numbered test: PASS or FAIL, the device, a screenshot or short screen recording, and for a FAIL the exact steps and what you expected. Summary table first, then details. Do not report the known items at the end.

1. BRAND SECTION VS HQ'S HERO (phone first, then 1512 desktop)
Open the personal site homepage and scroll to "The brands". Open beunconventionalhq.com and look at the hero at the top. They should be the same component with different content.
1.1 Phone: the open brand fills the full screen width with its image on top, a thin coloured bar on its left edge, then a row of small boxed tags (the brand name with a short accent tick on its left, then a category), then a large uppercase headline, then one line of small, widely spaced grey text. Compare each against HQ. List every difference you see.
1.2 Phone: a round play/pause button sits in the top right corner of the image, like HQ's.
1.3 Phone: below the open brand, the other brands are full-width rows of equal height, edge to edge: a small logo on the left and the brand name centred. Compare with HQ's TV / GAMES / EVENTS / LATEST rows.
1.4 Phone: tap a row. It becomes the open brand at the top. Tap the open brand's image or headline: it opens that brand's site in a new tab (Sip the Magic has no site yet and should not link).
1.5 Desktop 1512: the brands are side-by-side vertical strips with the open one wide, as on HQ: tags top left, headline, text and an outlined button bottom left, logo bottom right. Hover a closed strip: it widens a little, its art sharpens, and it lights up (HQ's focus state). Click a closed strip: it opens. Click the open brand's image: a full-screen "camera zoom" view of it opens; Close or Escape returns.
1.6 Only the BE Unconventional HQ brand may use red. Capture Create Caffeinate and Sip the Magic must be black, white and grey.
1.7 Phone landscape: the open brand on the left, the other brands stacked on the right, nothing overlapping.

2. LOGO
2.1 The nav logo and the big logo in the homepage hero are the stacked HEY_ / _THISISANDREW wordmark (underscore wrapping the line break), crisp, at phone and desktop sizes.

3. PHONE MENU (iPhone Safari is the important one)
3.1 Tap MENU. It shows only five links: Home, Build in Public, Production & Gear, The Cafe, About (plus search). No long list of sub-links.
3.2 With the menu open, swipe up and down on it several times, slowly and quickly. It must stay open every time. Record this.
3.3 It closes when you tap CLOSE, tap a link, or tap the page outside the menu. Nothing else may close it.

4. SIDE PANEL
4.1 Phone: on the homepage, a slim dark tab of short horizontal lines sits on the left edge, middle of the screen. Tap it: it opens into a list of the page's sections with the current one highlighted. Tap a section: the page scrolls there and the panel closes. Open it again and tap outside: it closes.
4.2 Desktop 1512: the same lines sit on the left edge at rest. Hover them: the list opens with names. Click one: it scrolls there.
4.3 Check two other pages (for example /cafe/ and /build/): the panel lists that page's sections, and the highlighted one follows you as you scroll.
4.4 The panel must never cover the menu, the search, or a video that is playing.

5. FOOTER
5.1 The footer's Explore area is one row of the five top-level links (it may wrap on a phone). No long list of links.
5.2 Privacy and Sitemap links sit in the bottom row and work.

6. SEARCH
6.1 Open search (the magnifier, or Cmd/Ctrl+K on desktop) and type "espresso". Results show as styled cards (a small category tag, a title, a description), not plain underlined text. Tap a result: it goes to the right place.

7. NOTHING ELSE BROKE
7.1 Visit every page linked from /sitemap/ on a phone and on desktop. Report sideways scrolling, text cut off at the edge, overlapping text, broken images, console errors (desktop), or an em dash in visible text.
7.2 Phone status bar: the area behind the clock and Dynamic Island stays solid black at the top, middle and bottom of a long page.

KNOWN ITEMS, NOT BUGS
- The Cafe "Storefront Link" buttons all point to one Amazon link; real links are pending.
- The press kit numbers and the favicon are pending.
- /events is deliberately not in any menu.
- The "Shot on the job" photos zoom; they do not play.
- The portrait hero at the top of the homepage is deliberately unchanged in this round.
- Sip the Magic has no site link yet.
