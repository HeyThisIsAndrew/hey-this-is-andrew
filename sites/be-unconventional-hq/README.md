# BeUnconventionalHQ

BeUnconventionalHQ is a cinematic creator-driven editorial platform built with Astro 6.3.

The site combines long-form commentary, automated YouTube content ingestion, creator-focused publishing workflows, and future monetization infrastructure into a fast, static-first media platform designed for independent creators.

## Core Philosophy

BeUnconventionalHQ is designed around a **Hybrid Content Engine** architecture:

- **Static-First Performance:** Zero-latency delivery via build-time rendering.
- **Build-Time Ingestion:** Automated data fetching from Substack and YouTube during the build process.
- **Unified Editorial Taxonomy:** Centralized category normalization for cross-platform consistency.
- **Automation-Ready:** Decoupled data pipelines designed for future scale.
- **Minimal Backend:** Leverages Astro's server-side logic for ingestion without the overhead of a traditional CMS.

The project prioritizes visual identity, editorial credibility, and maintainability over unnecessary framework complexity.

---

# Current Platform Features

## Editorial Content System

- **Substack API Ingestion:** Automated fetching and sanitization of Substack articles via Substack's internal posts JSON endpoint.
- **Unified Article Rendering:** Custom pipeline for high-fidelity editorial presentation.
- **Category Normalization:** Automatically maps diverse external tags into the canonical HQ taxonomy.
- **Dynamic Editorial Feed:** A unified stream of content aggregated from multiple sources.

## Video Platform Integration

- **YouTube RSS Ingestion:** Real-time fetching of latest videos via channel-specific feeds.
- **Metadata Extraction:** Automated parsing of video IDs, dynamic thumbnails, and publication dates.
- **Unified Feed Integration:** Seamless blending of video content with editorial articles in the global feed.

## Taxonomy Engine

Centralized normalization layer (`src/data/constants.js`) supporting:

- **Film** (Normalized from "Movies")
- **Television** (Normalized from "TV")
- **Gaming**
- **Events**
- _Extensible for future platform-specific categories._

## UI / Design System

- **Cinematic Motion:** Custom scroll-driven animations and parallax hero systems.
- **Unified CTA System:** Standardized primary action components across all pages.
- **Responsive Layouts:** Mobile-first editorial grids with horizontal scroll stabilization.
- **Visual Continuity:** Consistent red-accent theme with animated hover states and glows.

## Press + Creator Infrastructure

- **Static Press Kit:** Dedicated destination for media assets and contact information.
- **Contact Routing:** Integrated routing for press, collaborations, and inquiries.
- **Monetization Readiness:** Architecture prepared for Amazon storefronts and referral ecosystems.

---

# Tech Stack

- **Framework:** Astro 6.3
- **Styling:** Vanilla CSS (Global & Themed)
- **Ingestion:** Build-time Fetch + JSON/RSS Parsing
- **Deployment:** Static-First (Optimized for GitHub Pages)
- **Tooling:** Custom Node.js dev server with mobile-testing QR generation

---

# Project Structure

```text
/
├── public/          # Static assets (logos, icons, banners)
├── docs/            # Platform protocols and engineering documentation
├── scripts/         # Custom development and testing utilities
├── src/
│   ├── components/  # Atomic and composite UI components
│   ├── data/        # Source of Truth for taxonomy, site config, and constants
│   ├── layouts/     # Base HTML structure and shared layouts
│   ├── pages/       # Site routes and data-ingestion templates
│   └── styles/      # Global base, theme-specific, and utility CSS
├── package.json     # Project dependencies and scripts
└── README.md        # This documentation
```

---

# Development Commands

| Command              | Action                                                        |
| :------------------- | :------------------------------------------------------------ |
| `npm install`        | Install all dependencies                                      |
| `npm run dev`        | Start custom dev server (includes QR code for mobile testing) |
| `npm run build`      | Generate production-ready static site in `./dist/`            |
| `npm run preview`    | Locally preview the generated production build                |
| `npm run deploy`     | Wrangler deploy of the built worker (Cloudflare Workers)      |

---

# Maintenance & Content Management

## Adding a QR Code to the Links Page

The Links page (`/links`) features an interactive profile image that opens a QR code modal. To replace the "Coming Soon" placeholder with a real QR code:

1.  **Generate your QR code:** Generate a high-quality SVG or PNG of your digital contact card or social link.
2.  **Add the asset:** Place your QR code image in the `/public/` directory (e.g., `/public/qr-contact.svg`).
3.  **Update the template:** Open `src/pages/links.astro`.
4.  **Replace the placeholder:** Locate the `<div class="qr-grid-box">` element (approx. line 150) and replace its internal contents (the scan line and dot-generator loop) with your new image:
    ```html
    <div class="qr-grid-box">
      <img
        src="/qr-contact.svg"
        alt="Scan to connect"
        style="width: 100%; height: 100%; object-fit: contain;"
      />
    </div>
    ```
5.  **Update the status:** Change the text in `<span class="qr-word-status">` from "COMING SOON" to "ACTIVE" or "SCAN ME".

---

# Architecture Overview

## Hybrid Content Engine

The platform uses a hybrid ingestion architecture that bridges the gap between static speed and dynamic content freshness.

### Automated Sources

- **YouTube:** Pulls latest content via `https://www.youtube.com/feeds/videos.xml`.
- **Substack:** Pulls latest articles via the `/api/v1/posts` JSON endpoint.

### Centralized Normalization

External platform data is transformed at the **Ingestion Boundary**. This ensures that even if Substack uses "Movies" and YouTube uses "Film," the HQ UI presents a single, unified "Film" taxonomy.

### Static Rendering

All external data is fetched and baked into static HTML during the build process, resulting in industry-leading SEO and performance metrics.

---

# Future Expansion Roadmap

## Planned Systems

- **Creator LinkHub:** Unified social and referral destination.
- **Sponsor Infrastructure:** Dedicated blocks for editorial partnerships.
- **Astro Content Collections:** Migrating static data to local Markdown/JSON for type-safety.
- **Lightweight CMS:** Git-based workflow for on-the-go editorial updates.
- **Expanded Ingestion:** Future support for TikTok, Instagram, and Letterboxd feeds.

## Long-Term Vision

BeUnconventionalHQ is evolving toward a "Creator-Owned Media Operating System"—a platform that empowers independent journalists to own their audience, content, and monetization without technical friction.

---

# Status

**Current Phase:** Hybrid Content Engine v1.5 (Stabilized)

**System State:**

- ✅ **Stable:** Core UI and motion systems verified.
- ✅ **Production-Capable:** Fully automated content pipelines.
- ✅ **Automation-Ready:** Ingestion boundary is hardened.
- 🚀 **Active Expansion:** Transitioning toward monetization and community tools.

---

## 🚀 Strict Tagging System (v2.0)

The HQ platform relies **strictly on tags** to route and categorize your YouTube videos and Substack articles. 
We **do not** scrape titles or descriptions for metadata—this prevents accidental routing errors from creative titles. 

To ensure your content appears where it belongs, include the correct **Tags** on YouTube or Substack.

### 1. Primary Category (Required)
Include exactly **one** of these in your tags to route the item to the correct page:
- `Film` (or `Movies`)
- `TV` (or `Television`)
- `Gaming` (or `Games`)
- `Event` (or `Events`)

### 2. Content Type (Consolidated)
Include **one** of these to define what kind of content this is (appears in the dynamic tags on the card):
- `Review` (For formal reviews and verdicts)
- `Analysis` (For deep dives, breakdowns, and essays)
- `Commentary` (For general commentary and discussions)
- `Reaction` (For first impressions and live reactions)

*(Other supported secondary types: `Trailer`, `Interview`, `Premiere`, `Podcast`)*

### 3. Brands & Studios
The system will automatically recognize these brands if included in the tags:
`Marvel`, `DC`, `Netflix`, `Apple TV+`, `Disney`, `PlayStation`, `Xbox`, `Nintendo`, `Star Wars`, `Warner Bros`, `HBO`, `Universal Pictures`, `20th Century`, `Lionsgate`, `A24`, `Paramount`.

### 4. Events
The system recognizes specific event tags to categorize coverage:
`SDCC`, `WonderCon`, `D23`, `E3`, `Gamescom`, `Summer Game Fest`, `The Game Awards`, `PAX`, `GDC`, `Convention`, `Premiere`.

---

**⚠️ Note on Precision:**
Tags are matched strictly against your explicit YouTube tags or Substack tags. The system ignores video titles entirely for metadata extraction.

## License

Private project. All rights reserved. © 2026 BE Unconventional HQ.
