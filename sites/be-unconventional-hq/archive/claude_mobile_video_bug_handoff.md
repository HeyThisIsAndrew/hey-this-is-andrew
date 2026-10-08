# Mobile Video Black Screen Analysis

This is a handoff report for Claude detailing the root causes of the persistent "Black Screen on Mobile" bug when attempting to play the YouTube hero trailer on iOS Safari.

> [!NOTE]
> **Route Migration Context:** To safely shadow-launch the new Events Hub, I have moved the new hub to `/events-new` and `/events-new/[slug]`, and restored the original `events.astro` page from `main` to the public `/events` route. All of your fixes should be applied to `src/pages/events-new/[slug].astro` and `src/pages/events-new.astro`.

## Bug Description
**Steps to reproduce:**
1. Load `/events-new/[slug]` on an iOS Safari device.
2. Scroll to the Hero Trailer and tap the custom "Play" poster.
3. The poster disappears, and the video area renders as a completely black box. The video does not play.

## Root Cause Analysis

I have identified two critical issues that are compounding to cause this bug.

### 1. The WebKit `overflow: hidden` Parent Bug (Rendering Failure)
Claude correctly noted previously that applying `border-radius` or `overflow: hidden` to a cross-origin iframe causes a known WebKit bug where the iframe renders as a black box. Claude removed these from `.hero-trailer`. 

**The Oversight:** The bug is triggered if **any ancestor element** has `overflow: hidden` combined with certain stacking contexts. In `src/pages/events-new/[slug].astro`, the very top-level parent wrapper `.event-hero` still has `overflow: hidden` applied to it (around line 323) to prevent the absolute background from spilling out. 
When the iframe is injected, it inherits this constraint and WebKit fails to render the iframe's content layer, resulting in a black box.

### 2. Asynchronous User Gesture Expiration (Playback Failure)
Even if the WebKit rendering bug is fixed, the video will likely fail to autoplay with sound due to iOS Safari's strict media policies. 

**The Problem:** The current logic injects the iframe dynamically upon a `click` event:
```javascript
poster.addEventListener('click', () => {
  iframe = document.createElement('iframe');
  iframe.src = base + '&autoplay=1&mute=0';
  wrapper.appendChild(iframe);
});
```
Injecting an iframe and setting its `src` triggers an asynchronous network request to load the YouTube player HTML. By the time the YouTube player loads, initializes, and attempts to execute the `autoplay=1&mute=0` instruction, the synchronous execution context of the user's physical tap has expired. 

iOS Safari requires unmuted media to begin playing *synchronously* within the call stack of a user interaction. Because the iframe load is asynchronous, Safari considers the autoplay an unauthorized script action and blocks it. When YouTube autoplay is blocked, the player stalls out (which can also appear as a black screen if the thumbnail hasn't painted).

## Recommended Solutions for Claude

1. **Fix the WebKit Bug:** Remove `overflow: hidden` from `.event-hero`. If the background spilling is an issue, apply `overflow: hidden` strictly to a dedicated background `<div>` (`.event-hero-bg`) that is a sibling to the content, rather than wrapping the content.
2. **Fix the User Gesture Bug:** To guarantee unmuted playback on iOS Safari, you cannot use a custom poster image for a dynamically injected YouTube iframe. 
   - **Option A:** Remove the custom poster entirely on mobile and render the native YouTube iframe in the HTML on page load. Allow the user to tap the native YouTube play button.
   - **Option B (Hack):** Keep the iframe in the HTML on page load so it's already initialized. Keep the custom poster overlay. On tap, send `postMessage('playVideo')` to the iframe. *Note: This only works reliably on iOS if the user has previously interacted with the page, and Apple occasionally patches out `postMessage` media bypasses.*

I have pushed the latest code to `claude/events-hub-ux-fixes-wd0ijm` which fixes the desktop sizing bug, so you have a clean slate to address the mobile logic.
