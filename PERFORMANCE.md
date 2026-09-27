# Performance & Accessibility Log

This document tracks the performance, accessibility, and quality metrics for the "Hey This Is Andrew" build. 
All scores must meet the non-negotiable targets before a milestone is considered done.

## Non-Negotiable Targets (Mobile throttled: Moto G4, slow 4G)
*   **Lighthouse Performance:** 90+
*   **Lighthouse Accessibility:** 95+ (Target 100)
*   **Lighthouse Best Practices:** 95+ (Target 100)
*   **Lighthouse SEO:** 95+ (Target 100)
*   **Core Web Vitals:** LCP < 2.5s, INP < 200ms, CLS < 0.1
*   **Budgets:** Initial weight < 1MB, JS < 150KB, Fonts < 100KB

---

## Milestone 1: Core Architecture & Hero Carousel
**Status:** In Progress / Remediating

### Budget Check
*   **Expected JS:** < 10KB (Vanilla JS Carousel only)
*   **Expected Webfonts:** ~60-80KB (Google Fonts Montserrat + Spectral)
*   **Expected Weight:** < 500KB (Images heavily compressed, 1st slide eager, rest lazy)

### Accessibility & Performance Fixes Applied
*   **Images:** `fetchpriority="high"` on Slide 1. `loading="lazy"` on slides 2-4. Logo images forced to `object-fit: contain` to prevent aspect-ratio squeezing.
*   **Carousel A11y:** Added explicit Pause/Play toggle. Auto-pauses on `:hover` and `:focus-within`. Added visually hidden `aria-live` region for slide announcements. Visually hidden text classes (`.vh`) patched to standard `sr-only` spec to prevent mystery text leaks.
*   **Reduced Motion:** Disabled Ken Burns scaling, crossfade transitions clamped, and autoplay disabled if `prefers-reduced-motion` is true. Accordion transitions also disabled.
*   **Skip Link:** Added "Skip to content" as the first DOM node. Focus styles enforced globally.
*   **Layout:** Enforced `overflow-x: clip` globally to prevent horizontal scroll bleeding from absolute/fixed textures.
*   **Textures:** Film grain effect dramatically reduced to 3% opacity and changed to `position: fixed` to respect layout bounds.

---

## Milestone 1B: Brand Inheritance Accordion
**Status:** Completed

### Directives Satisfied
*   **BE Unconventional HQ Spec:** Accordion strictly maps BE design tokens (`--blood: #9b0000`, `Special Gothic Expanded One`, `Archivo`) scoped directly inside its DOM context. Accordion expands to `flex-grow: 8` with a 450ms custom bezier transition. Left-edge blood border and bottom progress bar added exactly to spec.
*   **Capture Create Caffeinate Spec:** CCC scope leverages `Montserrat` and the parent cinematic black fallback. Verbatim copy integration complete.
*   **Performance:** Replaced old Carousel/Hero + BrandCards entirely with one single, unified Accordion hero. Intersection Observer added to only begin auto-rotation when the hero scrolls into view (plus 3s beat). Manual interaction kills the timer completely to save battery/perf.

---

## Milestone 2: GSAP Portfolio Marquee & Lightbox
**Status:** Up Next

### Budget Check
*   **Expected JS:** +~30KB (GSAP core + ScrollTrigger scoped imports)
*   **Risk Mitigation:** Marquee uses `content-visibility: auto` to prevent render thrashing. Scroll-linked animations will only mutate `transform` and `opacity` to maintain 60fps and protect INP. Lightbox uses native `<dialog>` semantics.
