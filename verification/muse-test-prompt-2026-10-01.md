# Test prompt for Muse (or any browser-testing agent): problems 6 to 9

Paste everything below the line. It assumes the branch
`claude/personal-site-visual-fixes` is live at the URL given. GitHub Pages
only publishes `main`, so either test after Andrew merges, or point `SITE`
at a preview of the branch.

---

You are testing a personal website in real browsers. Do not change any code.
Report what you see, with evidence.

**SITE:** https://heythisisandrew.github.io/hey-this-is-andrew/
**Reference site (for comparison only):** https://beunconventionalhq.com/

**Devices, in priority order:**
1. A real iPhone with a Dynamic Island (iPhone 15 or 16), Safari, iOS 26 if available, otherwise the newest iOS you have.
2. Desktop Chrome at a 1512x900 window.
3. Desktop Safari at 1512x900.
4. Android Chrome, any recent phone.

Say which device, OS and browser version produced each result. If a test needs
an iPhone and you only have an emulator, say so plainly: emulators do not
reproduce the status bar behaviour being tested.

## How to report

For every numbered test give: PASS or FAIL, the device, one screenshot or a
short screen recording, and for a FAIL the exact steps to reproduce and what
you expected. Put a summary table first, then the details. Do not report the
known items listed at the end as bugs.

## 1. Phone status bar (iPhone Safari, then Android Chrome)

The area behind the clock, Dynamic Island and battery must be solid black and
flow straight into the black nav bar, with no page content visible behind it.

1.1 Load the homepage. Screenshot at the very top.
1.2 Scroll slowly to the middle of the page. Screenshot.
1.3 Scroll to the bottom of the page. Screenshot.
1.4 At the top, pull down past the top (rubber band) and screenshot mid-pull. Is the area above the page black?
1.5 Tap "Menu". The menu must open below the nav, the status bar area must stay black, and you must be able to scroll the menu to its last link. Swipe up on the menu once you are at its end: it should close. Swipe up while it still has links below: it should scroll, not close.
1.6 Turn the phone to landscape on the homepage. The nav must be readable, with nothing under the notch or the side of the Dynamic Island, and the page content must not be cut off at either side.
1.7 Repeat 1.1 to 1.3 on /work/ and /cafe/.
1.8 Tap anywhere in the nav (for example the logo area, then come back). The nav must stay solid black afterwards, never see-through.

## 2. Video player (every device)

2.1 Open /work/. Tap the first card under "Videos". A player must open over the page and the video must start. On desktop it should start with no second click. On iPhone, at most one extra tap on YouTube's own play button is acceptable; say whether it was needed.
2.2 Does YouTube show a sign-in or "confirm you're not a bot" wall at any point? Report exactly what it said.
2.3 With the video playing, close the player (the X, and on desktop also Escape). The sound must stop immediately, and the page must be exactly where you left it.
2.4 Open the second and third video cards in turn. Each must play the right video, not the previous one.
2.5 On the phone, check the line under the video (title and "Watch on YouTube"): nothing may run off either edge of the screen.
2.6 "Watch on YouTube" must open that same video on YouTube in a new tab.
2.7 Repeat 2.1 and 2.3 from the video card in the homepage's "Latest" section.

## 3. "Meet the Creator" vs HQ "Inside the HQ" (desktop 1512, then phone)

Open the homepage's "Meet the Creator" section and the reference site's
"Inside the HQ" section side by side at the same window size.

3.1 Do they read as the same template: same headline size, same body text size and line spacing, same photo card size, same tagline size and weight, same space above and below? List any difference you can see, with screenshots.
3.2 The personal site must stay black, white and grey. Any red in this section is a FAIL. The tagline "BE HONEST. BUILD IN PUBLIC. HEY_THISISANDREW." must be white and as prominent as HQ's motto.
3.3 On a phone, nothing in the section may be clipped, overlap or run off the screen, including the "MEET THE CREATOR" heading and the tagline.
3.4 Check /about/ too: it uses the same section.

## 4. Cafe page

4.1 Open /cafe/ and go to the "9:16 Reel Note" section (or open /cafe/#reels). There must be no photo of a red-lit cocktail glass anywhere on the page, and no empty or broken image box.
4.2 The card must show "Project note", "Ascaso Espresso Extraction & Latte Art Workflow", the line starting "Native 9:16 vertical cinematography", and a "Shop Beverage Kit on Amazon" button. Nothing on the card may say or suggest it plays a video (no play icon, no "preview", no "watch").
4.3 The Amazon button must open Amazon in a new tab.

## 5. Nothing else broke (desktop and phone)

5.1 Desktop: hover each nav item; dropdowns open and their links work. Press Cmd+K (Ctrl+K on Windows): search opens; type "espresso" and open a result.
5.2 Desktop: press Tab once on a fresh page load. A "Skip to content" link must appear at the top left, fully on screen.
5.3 Homepage brand panels ("The Brands"): click each panel; on desktop open the fullscreen view and close it with the close button. The close button must be fully visible and clickable.
5.4 Homepage "Shot on the job" photos: tap a photo on the phone. It zooms in, neighbours stay visible, and closing is smooth.
5.5 Scroll down any long page and use the back-to-top button (bottom right). On iPhone it must sit clear of the home indicator bar.
5.6 Visit every page linked from /sitemap/ on the phone and on desktop. On each, report any of: sideways scrolling, text cut off at the edge, overlapping text, broken images, console errors (desktop), or an em dash in visible text.

## Known items, not bugs

- All Cafe "Storefront Link" buttons point to the same Amazon link; real links are pending.
- The press kit numbers and the favicon are pending.
- /events is deliberately hidden from menus.
- The "Shot on the job" photos zoom; they are photos, not videos, and do not play.
- The /preview/ pages are design concepts and are not linked from the menus.
