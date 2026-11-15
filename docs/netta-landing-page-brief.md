# Netta Landing Page — Instagram Review and Design Spec

Prepared Nov 14, 2026, for Antigravity (Gemini 3.8 Flash, multi-agent build).
Owner: Andrew Baxter. Client: Netta, henna artist, Santa Barbara, CA.
Instagram: @nettahennaandfeatheredsoul.

This file has two parts. Part 1 is the Instagram review. Part 2 is the design spec for her landing page in Andrew's monorepo. Build the site from Part 2. Use Part 1 for the content and bio direction only.

---

## Part 1 — Instagram review: @nettahennaandfeatheredsoul

### Data basis

- 38 posts pulled Nov 14, 2026, covering Oct 28 to Nov 13, 2026.
- Profile facts come from a public page fetch the same day.
- Her account is private. That limits what can be seen from outside. Anything not in the pulled data is marked unverified below.
- Her being private is her choice for now. Nothing in this review asks her to change that before she is ready. The visibility-dependent fixes in this report wait until she flips it.

### Who she is

- Display name: Netta.
- Handle: @nettahennaandfeatheredsoul.
- Services: henna art, hair feathers, hair tinsel. Boho beauty, earthy luxury.
- Location: Santa Barbara, CA.
- Bio: "Netta Henna and Featherd Soul. Henna Art, Hair Feathers, Hair Tinsel. Boho Beauty, Earthy Luxury. Santa Barbara, CA. DM to Book."
- Bio typo: "Featherd" is missing an e. The handle spells it "feathered".
- Followers: 126. Not verified.
- Account type: personal, not business or creator.
- No link in bio is visible in the data.
- Following count, total post count, highlights, and pinned posts: unverified.

### Content, Oct 28 to Nov 13, 2026 (17 days, posted on 16 of 17 days)

- Format mix: 22 images, 9 carousels, 7 videos. Only 18 percent video.
- Cadence: burst posting, 7 posts on Oct 28 and 5 on Oct 30, then 1 to 3 a day, tapering to 1 a day by Nov 11 to 13.
- Topics: henna designs, hair feathers, hair tinsel, plus nails (one video mentions a fresh nail set). Three services plus nails in one feed.
- Likes: 448 total, average 11.8 per post, max 50, min 3. Average like rate is 9.4 percent of her 126 followers.
- Top post: Oct 30, 50 likes and 7 comments, a feather photo. That is 40 percent of her follower base.
- Comments: 25 total, average 0.7 per post. 30 of 38 posts (79 percent) have zero comments.
- Videos underperform stills: videos average 7.0 likes, images and carousels average 12.9.
- Hashtags: 37 of 38 posts have none. Only one post has any hashtags (5).
- Captions: average 10.8 words (65 characters). 3 posts have no caption at all. Zero posts contain a question mark. Zero posts contain any booking call to action (book, DM, appointment, price, link in bio).
- Mentions: "henna" appears in 6 captions, "feather" in 10, "tinsel" in 2. Her personal handle @yourlovelynetta appears in 5.
- Location: only 1 of 38 posts is tagged with a location (Santa Barbara).
- Two posts show LV-inspired henna designs. That is a brand and IP risk if she keeps posting designer logos.

### Strengths

- Posts nearly every day, with a consistent boho visual voice and real client work on display.
- Best post reached 40 percent of her followers, so the audience that sees her work does respond.
- Santa Barbara is in the bio, and all three services are named there.

### Color scheme and logo

- Color scheme: warm and earthy, terracotta, sage, and cream. It fits the henna and feather work and feels inviting. It is cohesive across the feed.
- Logo: the script reads clearly at small size. It gets lost on busy backgrounds, so give it more breathing room or a solid backing for legibility.
- The landing page palette in Part 2 follows this scheme, not the dark CCC palette.

### Weaknesses, ranked

1. Private account. The single biggest blocker. Non-followers cannot see any post, reels cannot be recommended to non-followers, and Explore distribution is dead. A business account seeking clients cannot grow while private. Her choice for now, so this fix waits on her.
2. Personal account, not creator or business. No insights, no contact buttons, no category label, no promotion tools.
3. No hashtags on 37 of 38 posts. Zero search and discovery.
4. No location tags on 37 of 38 posts. Invisible to local Santa Barbara search, which matters most for a local service business.
5. No booking funnel. Bio says "DM to Book" only. No link, no prices, no services list, no how-to-book content, and zero booking calls to action in captions.
6. Captions do not start conversations. Zero questions in 38 posts, average under 11 words, and 79 percent of posts get zero comments.
7. Video is underused and underperforming. Only 7 of 38 posts are video, and they average fewer likes than stills, which points to clips with no hook rather than edited reels.
8. Mixed niche. Henna plus feathers plus tinsel plus nails in one feed. Neither the algorithm nor a first-time visitor can tell what she is.
9. Burst then fade cadence. Seven posts on day one, one a day by week three.
10. Polish gaps. The "Featherd" bio typo, and LV-inspired posts that risk a takedown.

### Top 5 fixes (when she is ready)

1. Go public and switch to a creator account. Do this before anything else, or every other fix is invisible to non-followers.
2. Rewrite the bio and add a booking link: one line for who and where, one line for services, one tap to book. Fix the "Featherd" typo. The booking link is the landing page from Part 2.
3. Hashtags (5 to 10 targeted per post: Santa Barbara, henna artist, bridal henna, hair tinsel, boho) plus a location tag on every post.
4. Reels first, 3 to 4 a week: henna application timelapse, feather install, stain reveal, before and after. Hook in the first 2 seconds, trending audio, caption with a question.
5. Every caption ends with a question and a call to action, reply to every comment, and pin three posts: best henna work, services and prices, how to book.

### Content pillars for a henna artist

- Process reels (application timelapse, feather install).
- Stain results and before/after.
- Client transformations.
- Education (aftercare, how long henna lasts, tinsel care).
- Local Santa Barbara content (markets, events, bridal).

---

## Part 2 — Design spec: Netta landing page in the monorepo

### The monorepo (verified on Andrew's Mac, Nov 14, 2026)

- Repo root: `/Users/thisisandrew/Documents/UpSkill_Projects/hey-this-is-andrew`
- Package manager: pnpm workspaces. `pnpm-workspace.yaml` covers `packages/*`, `sites/*`, `templates/*`.
- `ARCHITECTURE.md` at the repo root is the authority on structure. Read it before building.
- Shared packages:
  - `packages/tokens/`: CSS tokens (`tokens.css`). Base is dark, monochrome. Themes override per site.
  - `packages/ui/`: shared component library (`@andrew/ui`), Astro components, TS types, CSS.
  - `packages/local-cms/`: local JSON editor for managing content without a database.
- Sites (each a full, separate site):
  - `sites/hey-this-is-andrew/`: the primary personal site.
  - `sites/be-unconventional-hq/`: an outdated reference copy. The live HQ publication has its own repository. Do not change or deploy HQ. Do not touch this folder.
  - `sites/reelay/`: Reelay, another consumer of the shared UI and tokens.
- `templates/site-starter/`: the starting point for every new site.

### How a new site is made (from ARCHITECTURE.md, section 4)

1. Scaffold: run `pnpm new-site <client-name>`. This copies `templates/site-starter` to `sites/<client-name>`.
2. Theme: edit `sites/<client-name>/src/styles/theme.css` to override `--brand` or any specific tokens.
3. Configure: edit `sites/<client-name>/src/data/site.ts` to set the site name, description, footer text, social links, and navigation items.

Netta's site is a fourth site in this structure: `sites/netta` (working name, confirm with her). It is a full separate site, not a route or page inside Andrew's personal site, and not attached to his website in any way.

### What to reuse from the shared packages

Shared components in `@andrew/ui` (props per ARCHITECTURE.md):

- `Nav`: standard sticky header with mobile menu and dropdowns.
- `Footer`: standard site footer.
- `SectionHeader`: standardised section header block (index, kicker, title, lede).
- `QuoteBand`: full-width testimonial strip.
- `PhotoElevator`: infinite vertical scroll of reels/photos.
- `ExpandSection`: in-place accordion that reveals content inline.
- `FilterTabs`: client-side filter bar.
- `PageNav`: sticky side-navigation (scrollspy) for long pages.
- `BrandAccordion`: the expanding hero directory.
- `NewTag`: renders a tag if a publish date is recent.
- `ViewAllLink`: styled outbound link.

Reuse these components by importing them. Do not copy them into the new site. A fix in the shared package should reach every site that consumes it.

### What to reuse from the Capture Create Caffeinate design

- The CCC brand page pattern (`sites/hey-this-is-andrew/src/pages/brands/capture-create-caffeinate.astro` in the personal site): hub hero with kicker, logo lockup, headline, deck, and two calls to action, then a hero media image, then an about section with SectionHeader and a 3-item offers list. Copy the pattern, not the content.
- The token system (`tokens.css`): CSS variables, so a per-site palette override is the supported way to re-theme.
- Typography from the tokens: Anton (display), Special Gothic Expanded One (section), Spectral (body serif), JetBrains Mono.
- Do NOT reuse the CCC dark cinematic palette or the red accent. Netta's brand is warm and earthy. See palette below.

### Design direction

- Palette (her brand, from her Instagram): warm neutrals, terracotta, sage, cream, gold. Light, airy, earthy luxury. Boho, not dark.
- Her script logo, with breathing room or a solid backing so it stays legible.
- Feather parallax: a soft feather layer that drifts and animates as the visitor scrolls. Lightweight, subtle, and respectful of reduced-motion preferences. This is Andrew's signature idea for her page and should be a visible, distinctive touch, not a heavy effect.
- Mobile first. Most of her traffic will come from Instagram on a phone.
- Real photos only. No AI-generated imagery anywhere on this site.
- Copy: plain, warm, human. No em dashes anywhere in the copy.

### Landing page requirements (from Andrew, Nov 14, 2026)

Super simple single landing page. Sections, in order:

1. Hero: her name and logo, one-line positioning (henna art, hair feathers, hair tinsel, Santa Barbara), feather parallax layer, primary call to action (Book) and secondary (View work).
2. About / intro: short paragraph, who she is, what she does, Santa Barbara.
3. Services and pricing: her three services with prices. Pricing content comes from Netta. Use the CCC 3-item offers pattern.
4. Gallery: her henna and feather work. Use PhotoElevator or a gallery built from shared components.
5. Booking / availability calendar: visitors select a date, see available dates, and book an appointment for her to work with them. See the booking section below.
6. Contact: a contact button that opens a contact modal (name, contact info, service, preferred date, message). The modal is the fallback path when a visitor does not book through the calendar.
7. Instagram link: prominent link to @nettahennaandfeatheredsoul.
8. Footer: shared Footer component with her site name, tagline, links, and socials.

### Booking and calendar (open decisions, do not guess)

- Requirement: a calendar that shows availability, lets a visitor select a date, and books that date for her to work with them.
- No booking backend exists in the monorepo today. Do not invent one, and do not fake availability.
- Preferred approach, lightest first: embed her existing scheduling tool if she has one (Calendly, Google Calendar appointment schedule, Square Appointments, or similar). If she has none, build an availability display plus the contact modal capturing the requested date, and mark the calendar as a phase 2 item pending her choice of tool.
- Antigravity must surface this as an explicit decision for Andrew and Netta before wiring anything: which booking tool, who confirms bookings, cancellation policy, and how far ahead the calendar shows.
- Until that decision is made, the calendar section ships as a clearly labelled placeholder, not as a fake working calendar.

### Content and assets needed from Netta before build

None of these exist in the repo today. All must come from her (or from Andrew, who is the contact):

- Logo file (high resolution, transparent background if possible).
- Brand colors (confirm terracotta, sage, cream, gold, or her exact values).
- Photos of her work. Her Instagram is private, so photos cannot be pulled from it. She must send the files directly.
- Services list and prices.
- Bio copy and any testimonials.
- Booking method and link (see above).
- Contact email or phone for the contact modal.
- Domain and hosting decision. Inside the monorepo it deploys on its own; the domain is undecided.

### Build instructions for the Antigravity multi-agent build

Suggested agent split:

1. Scaffold agent: run `pnpm new-site netta`, wire `packages/ui` and `packages/tokens`, set `site.ts` config, confirm the dev server builds.
2. Theme and design agent: `theme.css` palette override, feather parallax layer, hero and section composition from the CCC pattern, mobile-first styling.
3. Booking and contact agent: contact modal, calendar section (embed or placeholder per the decision above), Instagram link, footer.
4. Content and QA agent: placeholder content replaced with Netta's real copy and photos once supplied, build check, mobile viewport check, reduced-motion check, no em dashes in copy, no AI imagery, no changes to `sites/be-unconventional-hq`.

Verification before calling it done:

- `pnpm --filter netta build` passes.
- Page renders clean on mobile portrait, tablet, and desktop.
- Feather parallax is subtle and does not block content or hurt performance.
- Contact modal opens, closes, and submits (or clearly states its destination).
- Calendar either books through her real tool or is an honest placeholder.
- Nothing in `sites/be-unconventional-hq` was modified.
- No em dashes in any copy. No AI-generated images.

### Open questions

- Site folder name: `sites/netta`, or her full brand name? Confirm with Netta.
- Booking tool choice (see above).
- Domain and hosting.
- Does she want the Instagram fixes from Part 1 applied, and when does she go public? Her call, not ours.
- Prices, services, photos, logo, and copy (see assets list above).

### Sources

- Instagram data: `~/workspace/netta-posts.json` (38 posts, pulled Nov 14, 2026) and public profile fetch, Nov 14, 2026.
- Monorepo structure: read directly from Andrew's Mac, `/Users/thisisandrew/Documents/UpSkill_Projects/hey-this-is-andrew`, Nov 14, 2026, including `ARCHITECTURE.md` and `pnpm-workspace.yaml`.
- Landing page requirements: Andrew, voice call, Nov 14, 2026.
