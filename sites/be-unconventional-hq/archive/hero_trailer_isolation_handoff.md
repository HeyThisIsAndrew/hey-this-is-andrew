# HeroTrailer — Isolation Handoff (for Antigravity)

**Branch:** `claude/hero-trailer-isolated` (forked from the current events-hub working state; nothing from `main` was reset).

## What changed
1. **New component `src/components/HeroTrailer.astro`** — the trailer is now fully encapsulated here.
2. **`src/pages/events-new/[slug].astro`** — inline trailer markup/CSS/JS removed; now renders `<HeroTrailer trailerId={trailerId} title={event.title} />`. The unused `trailerPoster` frontmatter was deleted.
3. **"Read less" bounce fixed** in the same page (disable transition → pin real height → double rAF → re-enable → animate to collapsed).

## Isolation guarantees (please preserve these)
- **No global CSS was touched.** `src/styles/modules/modal.css` and every global stylesheet are byte-for-byte unchanged. The site-wide video modal is unaffected.
- **No generic IDs.** There is no `#youtube-container`. The desktop iframe gets a per-instance id `ht-frame-<uid>`; everything else is class-based and Astro-scope-hashed.
- Only three files changed on this branch: `HeroTrailer.astro` (new), `events-new/[slug].astro`, and this doc.

## Architecture (why it's reliable)
Two physical DOM structures, toggled **purely by CSS media queries** — no JS breakpoint teardown, so no "dead UI" resize trap:
- **Mobile (≤899px):** a **native** YouTube iframe (`controls`, `playsinline`, no autoplay, no custom overlay). The user taps YouTube's own play button → reliable iOS playback, and the creator's custom YouTube thumbnail shows natively.
- **Desktop (≥900px):** custom poster (YouTube thumbnail) + muted autoplay + scoped sound toggle via the `postMessage` API.

JS attaches a `src` to **only the visible side** (and clears the hidden side), so exactly one embed loads at a time and a hidden player can never bleed audio.

## Do NOT
- Do **not** edit `modal.css` (or any global stylesheet) to fix a trailer bug — fix it inside `HeroTrailer.astro`.
- Do **not** reintroduce `overflow:hidden`/`border-radius` on the iframe's wrapper (iOS Safari black-box bug).
- Do **not** add generic IDs.

## Routes (unchanged by this work)
- `/events` → `src/pages/events.astro` (original public page — untouched).
- `/events-new` → `src/pages/events-new.astro` (hub landing: timeline + mini-calendar + spanning modal). **Do not add `events-new/index.astro` — it collides with this file.**
- `/events-new/[slug]` → cinematic detail page (uses `<HeroTrailer/>`).

## Component API
```astro
<HeroTrailer trailerId="dQw4w9WgXcQ" title="Event title" posterUrl?="https://…optional override" />
```
`posterUrl` defaults to `https://i.ytimg.com/vi/<id>/maxresdefault.jpg` (falls back to `hqdefault.jpg` on 404).

## Verify on device
- iOS `/events-new/[slug]`: native thumbnail + native play button; tap → plays with sound.
- Desktop: poster + muted autoplay + unmute button.
- Global video modal (content cards elsewhere on the site) still works normally.
