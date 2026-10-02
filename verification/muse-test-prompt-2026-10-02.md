# Test prompt for Muse, 2026-10-02 (everything live on main at b4bb26c)

Paste everything below the line.

---

You are testing a personal website in real browsers. Do not change any code. Report what you see, with evidence.

SITE: https://heythisisandrew.github.io/hey-this-is-andrew/
Reference site (for comparison only): https://beunconventionalhq.com/

DEVICES, in priority order:
1. A real iPhone with a Dynamic Island (iPhone 17 Pro Max if available) on iOS 27, Safari.
2. A real iPhone on iOS 26, Safari (any model with a Dynamic Island).
3. Desktop Chrome at a 1512x900 window, then desktop Safari.
4. Android Chrome.
Say which device, iOS/OS version and browser produced each result. If a test needs a real iPhone and you only have an emulator, say so plainly: emulators do not draw the Dynamic Island or Safari's status bar colour.

HOW TO REPORT
For every numbered test: PASS or FAIL, the device and OS version, a screenshot or short screen recording, and for a FAIL the exact steps and what you expected. Summary table first, then details. Do not report the known items at the end.

1. STATUS BAR / DYNAMIC ISLAND (most important; iOS 27 and iOS 26)
The area behind the clock, Dynamic Island and battery must be solid black, flowing straight into the black header, with no page content visible behind it. Do every step on BOTH the personal site and beunconventionalhq.com and say whether they behave the same.
1.1 Homepage, scrolled to the very top. Screenshot.
1.2 Scroll slowly to the middle of the page. Screenshot while still scrolling, then at rest.
1.3 Scroll to the very bottom. Screenshot.
1.4 Scroll back up quickly, and pull down past the top (rubber band). Screenshot mid-pull.
1.5 Repeat 1.1 to 1.3 on /work/, /cafe/ and /about/.
1.6 Open the menu (MENU), then close it; open search, then close it. The top must stay black throughout.
1.7 Turn the phone to landscape and back. Note what the top looks like in each.
1.8 If Safari's address bar is at the top (Settings > Apps > Safari > Tabs: "Single Tab" with the bar on top), repeat 1.1 and 1.2 that way too.

2. BRAND SECTION VS HQ'S HERO
2.1 Phone: scroll to "The brands" and compare with the hero at the top of beunconventionalhq.com. The open brand fills the width: image on top with a thin coloured bar on its left edge, a row of small boxed tags (brand name with an accent tick, then a category), a large uppercase headline, one line of small widely spaced grey text, and a round play/pause button top right on the image. List every difference from HQ.
2.2 Phone: the other brands are full-width rows of equal height, logo on the left, name centred. Tap a row: it becomes the open brand. Tap the open brand's image or headline: that brand's site opens in a new tab (Sip the Magic has no site yet and must not link).
2.3 Desktop 1512: vertical strips, the open one wide, as on HQ. Hover a closed strip: it widens slightly and lights up. Click it: it opens. Click the open brand's image: a full-screen zoom opens; Close or Escape returns.
2.4 Only the BE Unconventional HQ brand may use red.

3. PHONE MENU
3.1 MENU shows only Home, Build in Public, Production & Gear, The Cafe, About (plus search).
3.2 With it open, swipe up and down on it repeatedly, slow and fast. It must stay open every time. Record this.
3.3 It closes on CLOSE, a link, or a tap on the page outside it, and nothing else.

4. SIDE PANEL AND TAPS NEAR THE LEFT EDGE
4.1 Phone: a small dark tab of short horizontal lines sits on the left edge, mid-screen. It must be small (about a fingertip wide). Tap it: it opens into the page's sections with the current one highlighted. Tap a section: the page scrolls there and the panel closes. Reopen it and tap outside: it closes.
4.2 Phone: on the homepage "Shot on the job" photos, tap photos in the LEFT column, including near the panel's tab. The photo must open (zoom), not the side panel, unless you tapped the tab itself. Do the same on the brand rows' logos.
4.3 Desktop 1512: the lines sit on the left edge; hovering opens the list; clicking an entry scrolls there.
4.4 On /cafe/ and /build/ the panel lists that page's own sections.

5. PHOTOS, VIDEO, SEARCH
5.1 Phone and desktop: open a photo in "Shot on the job". It zooms with the neighbouring columns visible; closing is smooth.
5.2 /work/: tap the first video card. The video plays (at most one extra tap on YouTube's own play button on iPhone). Close it: the sound stops at once.
5.3 Open search, type "espresso": results are styled cards, and tapping one goes to the right place.

6. FOOTER
6.1 The footer's Explore area is one row of the five main links (it may wrap on a phone). Privacy and Sitemap sit in the bottom row and work.

7. NOTHING ELSE BROKE
7.1 Visit every page linked from /sitemap/ on a phone and on desktop. Report sideways scrolling, text cut off, overlapping text, broken images, content hidden under the header, console errors (desktop), or an em dash in visible text.
7.2 Use an in-page link (for example "See the brands" on the homepage, or a section in the side panel): the section's heading must land just below the header, not hidden under it.

KNOWN ITEMS, NOT BUGS
- The Cafe "Storefront Link" buttons share one Amazon link; real links are pending.
- The press kit numbers and the favicon are pending.
- /events is deliberately not in any menu.
- The portrait hero at the top of the homepage is deliberately unchanged.
- Sip the Magic has no site link yet.
- The site is dark mode only; there is no light mode yet.
