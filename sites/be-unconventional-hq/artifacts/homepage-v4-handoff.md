# Homepage v4 Handoff Report

## Overview
This report documents the architectural and visual changes made during the `feat/homepage-v4` redesign session. It aims to provide the Claude context with all the necessary details regarding layout mechanics, constraints, bug fixes, and optimization improvements implemented on the root branch.

## 1. Hero Carousel Adjustments (`HeroAccordion.astro`)
- **Responsive Width Adjustments**: We widened the container constraints for desktop screens. The `.acc-content` max-width was pushed from `48rem` to `68rem`, and `.acc-deck` to `70ch`, preventing premature wrapping of titles now that the hero scales up to full `100vw`.
- **Image Hover Effects**: Added a subtle scale effect (`transform: scale(1.03)`) when users hover over an actively expanded hero tile.
- **Button Hover States**: Updated `.acc-cta` nested buttons inside the active hero tile to trigger their global `var(--color-accent)` solid red fill and box-shadow hover state.
- **Inline Playback**: Re-introduced the `.acc-play-overlay` click target over `.acc-media` to allow users to trigger inline YouTube playback by clicking the clean tile artwork itself, removing the need for a visible play button icon.
- **Top Guard**: Re-mounted `<ReloadTopGuard />` inside `index.astro` which previously lived in the legacy `<Hero />` to satisfy splash scroll-lock unit tests.

## 2. Global Image & 4K Optimization Pipeline (`card-images.ts` & `homepage-feed.ts`)
We extensively reconfigured the image ladder to prevent severe artifacting on large (4K) desktop screens:
- **YouTube `maxresdefault` Bypassing**: YouTube physically caps image output at `1280x720`. Instead of needlessly routing the `1280w` source through the proxy (which would compress it at `q=75`), the `youtubeSources()` generator now dynamically natively injects the raw `maxresdefault` URL as the final `1280w` rung. 
- **Proxy Fidelity Floor Raised**: Increased the `wsrv.nl` base compression setting from `q=75` to `q=85` for all proxied assets across the site.
- **4K Ladder Expansion**: Extended the global `WSRV_WIDTHS` ladder configuration with `2400` and `3840` steps so editorial covers (from Substack/Sanity) can properly supply 4K imagery to ultra-wide displays.
- **Hero Image Sizing Hinting**: Set `HERO_SIZES` to `100vw` everywhere to explicitly demand the sharpest asset from the browser. Tested and verified that the `card-images.test.mjs` test suite accommodates the bypasses correctly.

## 3. Spotlights and Commercial Rotator
- **Spotlight Relocation**: Placed `<HomeSpotlightBar variant="banner" />` directly beneath the Hero carousel to seamlessly span across the remainder of the vertical viewport. 
- **Commercial Ad Banner Optimization**: Located directly under the Featured World block. Passed `height={96}` and `quality={70}` into the `<Image />` component instance fetching local brand icons. Without those tags, Astro's compiler ignored the images and shipped full-resolution, 400KB source files to the client for logos that display at just 48px height.

## 4. Featured World Cleanup
- Eradicated the small `Featured series • DC · 7 pieces` `.fw-eyebrow` paragraph entirely out of `FeaturedWorld.astro` and pruned its dead CSS classes. Reverted to relying strictly on the official Lanterns SVG logos.

## Unit Test Status
All unit tests (`npm run test`) pass reliably. End-to-end assertions surrounding video IDs, proxies, splash/scroll locks, and the taxonomy/indexing routines are green.
