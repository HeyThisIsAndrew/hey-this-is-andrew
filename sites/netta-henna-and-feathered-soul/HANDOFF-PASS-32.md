# Netta Pass 32: handoff prompt (for ChatGPT 6.1 Sol)

Copy everything below the line into ChatGPT 6.1 Sol as a fresh message.

---

You are finishing "Netta Change Pass 32" on the Netta Henna and Feathered Soul landing page. Claude Opus did most of it and ran out of its usage limit. Your job: verify Claude's work, finish the open steps, prove everything with screenshots and numbers, then merge to `main`. Protect what already works. Work in small steps, build and screenshot after each, and revert any step that makes the finished look worse.

## Where things are

- Repo: `HeyThisIsAndrew/hey-this-is-andrew`. Site: `sites/netta-henna-and-feathered-soul` (Astro 7, pnpm workspace, Node 22+).
- Work branch: `claude/quirky-einstein-z5fxms`, based on `main` at `60486c7`. `60486c7` is the Pass 31 revert; it is identical to Pass 30 (`bdd0160`). `main` has NOT been updated yet.
- Each finished step on the branch is its own commit, so any one can be reverted alone.
- Build: `BASE_PATH=/ SITE_URL=http://localhost:4400 pnpm --filter netta-henna-and-feathered-soul build`, run from the repo root.
- GitHub Pages preview: built by `.github/workflows/deploy.yml` on every push to `main`, at `/hey-this-is-andrew/netta/`. A push to `main` also redeploys the personal site and Reelay. It does NOT deploy BE Unconventional HQ. Never touch `sites/be-unconventional-hq/` (see `AGENTS.md`).
- Do NOT edit `packages/ui/src/Nav.astro` (shared).

## Hard guardrails (from Andrew)

1. Do not change prices, services, durations, contact details, booking or copy. The only copy changes allowed are already done, in Step 10.
   - Prices: Henna Small $20 to $45, Medium $50 to $75, Large $100+, glitter free. Feathers 1/$10, 2/$18, 3/$25, 5/$35, 10/$60, install $10. Tinsel 5/$10, 10/$12, 15/$15, 20/$20, 30/$30, install $10.
2. Never link to nettahennaandfeatheredsoul.com. Nobody owns that domain.
3. Instagram is @nettahennaandfeatheredsoul.
4. No em dashes in copy. Do not invent copy, titles, taglines, stories or fonts.
5. All henna art is original SVG in gold #a8821d / #c59b27 and teal #0e7c7b / #1a999d. No PNGs ripped from her flyer, no Vecteezy.
6. Keep the mobile nav brand "Netta Henna and Feathered Soul", centred.
7. No Services dropdown. Do not undo Pass 25.

## What Claude did (all committed on the branch)

**Step 0. Revert verified.** `git diff bdd0160 60486c7` is empty for the whole repo.

**Step 1. Henna draw-in without the slowdown. Core job, done.**
- The 44 borders used to be 44 inline copies of one 766-node SVG.
- Now the art is built once (`src/lib/henna-art.ts`), rendered once in a hidden sprite (`src/components/HennaSprite.astro`), and every border shows it with `<use>` (`src/components/HennaBorderDraw.astro`).
- Draw-in lives in `src/styles/henna.css`:
  - Paths have `pathLength="1"`. `stroke-dashoffset` is an inherited SVG property, so it transitions once per motif group (Pass 30's y stagger, 2s, `cubic-bezier(0.25,1,0.5,1)`).
  - Dots stay circles. Their fade is one group transition. Their 0.5 to 1 scale-in is a same-colour stroke on a half-radius circle, whose stroke-width (inherited, one group per radius) grows from 0 to r with `cubic-bezier(0.34,1.56,0.64,1)` after 1s.
  - Defaults are the finished art. The class `henna-anim`, added by the head script in `BaseLayout.astro` unless the visitor prefers reduced motion, makes the art start undrawn. Any ancestor with `.is-drawn` starts the draw.
- `HennaBorderDraw` props:
  - `variant="open"`: no straight rails (used by the footer bar).
  - `tiles={n}`: stacks the 1800-unit strip vertically for tall box edges.
- Hero and nav logos are WebP via `getImage` (781 KB PNG down to 35 KB, 89 KB and 8 KB).
- Measurements (Lighthouse 12, local gzip server):

  | Metric | Pass 30 | Pass 32 |
  |---|---|---|
  | Mobile first contentful paint | 4.8 s | 1.8 s |
  | Mobile largest contentful paint | 10.8 s | 3.9 s |
  | Mobile time to interactive | 12.3 s | 4.0 s |
  | Mobile total blocking time | 5,250 ms | 60 ms |
  | Mobile score | 32 | 87 |
  | Desktop largest contentful paint | 2.0 s | 1.0 s |
  | Desktop score | 75 | 98 |
  | DOM elements | 35,380 | 2,516 |
  | HTML size | 5.2 MB | 0.3 MB |
  | Page weight | 1,994 KiB | 720 KiB |
  | Price List draw-in, frames in 3.5 s at 4x CPU | 9 | 43 to 50 |

- The finished stills pixel-diff against Pass 30 at 0 to 0.07%, and the remaining differences are text anti-aliasing.
- Rejected approaches (do not retry them):
  - Animating one registered `@property --ht` per border with per-path `calc()`: about 200 ms long tasks.
  - Per-path and per-dot transitions inside `<use>`: no better than Pass 30.
  - `will-change` or compositor layers: no help.
- The real costs were the number of animating elements, especially the per-dot transforms.

**Step 2. Nav font, done.**
- In `theme.css`, `.site-nav .nav-link` is Cormorant Garamond, 0.75rem, 700, 0.2em, uppercase. The ≤1099px rule mirrors the shared Nav (0.68rem, 0.14em).
- The underline is a 1px gold `linear-gradient(90deg, var(--gold-border), transparent)`, shown only on `:hover` and `:focus-visible`, drawing on in 0.4s. There's no underline for the active section.
- Verified at 1440 and 1919, light and dark.

**Step 3. Footer mandala bar.**
- It uses `variant="open"` and `pathLength`, so it always finishes.
- At 1440 the finished footer matched Pass 30 at 0 px difference in light.
- Still to do: the formal before, during and after crops at 390, 820 and 1919.

**Step 4. Price List dividers, done.**
- `.section-ornament.henna-rich-divider` now spans the frame with `margin: 2rem calc(16px - 2.5rem)`, or `1.5rem 0` on phones. The old later rule `.section-ornament { margin: 2.5rem 0 }` had been killing `margin: auto`.
- Measured, both dividers:

  | Width | Frame centre | Diamond centre | Each wing | Side gaps |
  |---|---|---|---|---|
  | 390 | 195 | 195 | 136 | 18 |
  | 820 | 410 | 410 | 330 | 16 |
  | 1440 | 720 | 720 | 517 | 16 |
  | 1919 | 959.5 | 959.5 | 517 | 16 |

**Step 5. Box side henna full height, done.**
- The vertical edges now have `width: 100%; height: 100%`, plus `tiles={7}` on the outer Price List frame and `tiles={2}` on the category boxes and the Booking card.
- Before: at 390 every box was cut at 420px, and the outer frame at 660px at all widths. Now every box at 390, 820, 1440 and 1919 is covered top to bottom, at the original art scale.

**Step 6. Footer domain, done.**
- It is an `<a href="#" data-back-to-top aria-label="Back to top of page">`. The script smooth-scrolls to the top, or jumps instantly with reduced motion.
- No copy icon, no "Copied" pill, no clipboard, no focus box. The hover still shows teal text and the gold henna underline.
- Clicked: scroll went from 6,118 to 0 at 1440 and from 10,866 to 0 at 390, light and dark.

**Step 7. Feathers.**
- Byte-identical to Pass 30, intentionally left alone.
- Counted from the SVG source: 73 to 84 barb paths per side, but only 52 to 55 distinct barb lines per side (start points at least 2 units apart). That is short of the "over 60" criterion.
- Andrew's own rule says a good feather left alone beats a messed-up one. Report it as restored, criterion not met. Do not add layers.

**Step 10, with Andrew's correction.**
- The "What She Does" heading is removed (0 matches in `src` and `dist`). The section now uses `aria-label="Services"`.
- The hero logo is a plain `div.hero-logo-static`: no link, no aria label, default cursor, no hover zoom. Clicking it leaves the scroll at 0, light and dark.
- The hero descriptor line now reads "Henna Tattoo Artist ◆ Feather and Tinsel Hair Artist", her exact words, stacked one per line at ≤640px.
- The service and gallery descriptions and the "Bohemian Beauty ◆ Body Art ◆ Hair Adornments" kicker are UNCHANGED. They are an open item: Netta supplies her own wording.
- Updated November 17, 2026: the nav wordmark returns to `#overview`, with the accessible label "Netta Henna and Feathered Soul, back to top". The hero emblem remains noninteractive.

## What is left for you

1. **Step 8, hero henna frame. Done and committed by Claude.** Files: `src/lib/henna-hero.ts` and `src/components/HennaHeroFrame.astro`. Verified at 390 and 1440 (light and dark) and at 1919 (light): no overlap with the nav, titles or buttons, no horizontal scroll, and a draw-in sequence at 0.6s, 1.5s and 4.5s. The halo softens to 30% below the logo, and the titles have a page-colour glow. Still to do: the formal 820 shots and the per-viewport frame size report. If Andrew dislikes it, revert the Step 8 commit on its own.
2. **Step 3:** the formal footer before, during and after crops, plus the same check for the Price List, Booking and side borders.
3. **Step 9:** optional small improvements, one at a time, with before and after screenshots, listed separately for Andrew to approve. Ideas:
   - Gallery JPGs to WebP via `astro:assets`.
   - Trim the Google Fonts request (JetBrains Mono and Great Vibes may be unused; check before removing).
4. **Final check:**
   - Build passes.
   - Screenshots at 390, 820, 1440 and 1919, light and dark.
   - Pixel-diff the finished stills against Pass 30 and list every difference.
   - Lighthouse before and after on the same setup (numbers above).
   - Claude fast-forwarded `main` to the branch after its final checks. If anything below fails, fix it forward on `main`.
   - Do not push a partial pass as a pass. Report each step as Pass, Fail or NOT VERIFIED, with the viewport measured.
5. **Open items to report to Andrew:**
   - Netta's own wording for the kicker and the picture descriptions.
   - Whether the nav wordmark should stop jumping to the Price List.
   - Netta's SMS number (`BOOKING_SMS_NUMBER` in `src/data/site.ts` is still empty, so the booking form shows "not set yet").
   - The Formspree endpoint, whose owner is unknown.
   - The Cloudflare Pages setup: use Node 22, not 20. See the site README.

Useful local tools: Chromium and Playwright are preinstalled (`require('playwright')`). Serve `dist` with gzip to mimic GitHub Pages. Lighthouse 12 runs with `CHROME_PATH=/opt/pw-browsers/chromium`.
