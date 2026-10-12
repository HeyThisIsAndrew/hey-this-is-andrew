# Reelay Studio — Comprehensive Design Review & ChatGPT Audit Brief

> **Document Purpose:** This dossier provides a complete, ground-truth architectural and visual design report of the **Reelay Studio** website (`sites/reelay`). It is structured specifically for review by **ChatGPT (or any expert design auditor)** to critique the UX, visual hierarchy, responsive scaling, and pro-app positioning, and to advise on how to elevate the experience even closer to the standard of **Apple.com**, **Linear.app**, and **Raycast.com**.

---

## 1. Executive Context & Brand Identity

* **Product:** Reelay (Reelay Studio) — Native Desktop Content Operations Application.
* **Target Platforms:** macOS (Apple Silicon M1–M4 native & Intel 64-bit) and Windows 10/11 (64-bit).
* **Core Value Proposition:** *"Publish Everywhere. Never Lose Control."* A local-first desktop powerhouse for video creators publishing across YouTube Shorts, TikTok, Instagram Reels, Threads, and Facebook.
* **Core Architectural Difference:** Unlike web-based SaaS tools (e.g., Buffer, Hootsuite, Later) that charge monthly recurring cloud database fees and store credentials on multi-tenant servers, **Reelay is 100% local-first**:
  * Raw video files live on the user's NVMe hard drive.
  * Metadata and column state live in an embedded local **SQLite** database (`~/Library/Application Support/reelay/app.db`).
  * OAuth API tokens are encrypted by the OS hardware **Keychain** (macOS) or **Credential Manager DPAPI** (Windows).
  * Direct HTTPS platform publishing from the creator's machine with zero intermediate proxy servers.
  * AI companion integration via the **Model Context Protocol (MCP)** with **zero AI token markup** (bring your own LLM keys) and durable `ScopedPipeline` approval requests.
* **Aesthetic Direction:** **Apple Pro Hardware & Software Launch.** High-contrast, sculptural typography in **Syne 800**, deep obsidian canvas (`#090a0d`), precision hairline borders (`rgba(255, 255, 255, 0.08)`), and a single restrained accent of **Studio Amber** (`#e5a93c` / `#f3c267`) inspired by cinema camera tally lights and reference grading monitors. **Zero rainbow clashing colors.**

---

## 2. Complete Site Map & Route Architecture (11 Routes)

```
sites/reelay/src/pages/
├── index.astro                     (The Apple-Grade Landing Page)
├── features/
│   ├── index.astro                 (Comprehensive Feature Catalog & Overview)
│   ├── library.astro               (Pillar 01: In-App Player, Proxies, Whisper Search)
│   ├── pipeline.astro              (Pillar 02: Kanban Board & Prepare-to-Publish Handoff)
│   └── automations.astro           (Pillar 03: Deterministic When/If/Then Rules Engine)
├── ai.astro                        (Pillar 04: MCP Protocol & ScopedPipeline Security)
├── pricing.astro                   (Fair Local-First Pricing: Community vs. Pro Studio)
├── support.astro                   (Reviewer Portal, RFC 8252 Verification, FAQ)
├── privacy.astro                   (Strict Google Limited Use & OS Keychain Disclosure)
├── terms.astro                     (Desktop Software License & Creator Ownership)
└── data-deletion.astro             (Official Meta/Facebook User Data Deletion Callback)
```

### Compliance Priority Note
Routes `/privacy`, `/terms`, and `/data-deletion` were engineered specifically to pass manual App Review verification from **Google Cloud (YouTube Data API v3 scopes `youtube.upload`, `youtube.readonly`)** and the **Meta Developer Platform (Instagram Graph API, Facebook Pages API)**. They contain un-bypassable legal language affirming RFC 8252 loopback authorization, local Keychain storage, zero cloud telemetry, and local SQLite data wiping upon account disconnection.

---

## 3. Landing Page Structure & Component Breakdown

The landing page (`/`) was completely refactored from a generic "card box SaaS" layout into an Apple-style hardware/software product launch page:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Hero.astro                                                         │
│    Monumental Headline: "Publish Everywhere. Never Lose Control."      │
│    Subtitle + Primary macOS (.DMG) & Windows (.EXE) CTAs + Value Props │
├────────────────────────────────────────────────────────────────────────┤
│ 2. AppleMetricsStrip.astro                                            │
│    4-Column Apple Pro Benchmark Banner:                                │
│    [4K 60 FPS Playback]  [0 ms Cloud Latency]                          │
│    [100% Sovereignty]    [$0 Cloud Fees]                              │
├────────────────────────────────────────────────────────────────────────┤
│ 3. StudioMockup.astro                                                 │
│    Hardware Sequoia/Windows 11 Window Frame with Traffic Lights:       │
│    - Mode Tabs (Studio Player, Kanban Pipeline, Automations, MCP)     │
│    - 9:16 vs. 16:9 Aspect Ratio Toggles & VP9/AV1 Proxy Codec Pill     │
│    - Waveform Monitor, Scrub Timeline, Audio Speed (0.5x–2.0x)         │
│    - Live Whisper Transcript Stream (SQLite FTS5 Indexed)              │
│    - Multi-Platform Coverage Indicators (YouTube, IG, TikTok, Threads) │
│    - App Statusbar (app.db 1.4GB • Keychain Encrypted • 127.0.0.1 MCP)│
├────────────────────────────────────────────────────────────────────────┤
│ 4. ProFeatureAccordion.astro (The 5-Drawer Vertical Feature Canvas)    │
│    Drawer 01: Media Library & 60 FPS Video Player (Open on Server)     │
│    Drawer 02: Cross-Platform Kanban Pipeline (Live Board Sim)          │
│    Drawer 03: Safe Automations & Rules Engine (When/If/Then Builder)   │
│    Drawer 04: AI Companion Ecosystem (MCP Gate & Approval Modal)      │
│    Drawer 05: Local Sovereignty ("Your Computer is the Cloud")         │
├────────────────────────────────────────────────────────────────────────┤
│ 5. SiliconSpecs.astro                                                 │
│    Hardware Optimization Matrix:                                      │
│    [Apple Silicon M-Series (Metal)]  [Windows Workstation (DirectX 12)] │
│    [Local NVMe & SQLite Engine]                                       │
├────────────────────────────────────────────────────────────────────────┤
│ 6. DownloadSection.astro                                              │
│    Native Desktop Installer Hub:                                      │
│    - macOS Apple Silicon (M1–M4) [Recommended]                        │
│    - macOS Intel 64-bit Architecture                                  │
│    - Windows 10/11 (64-bit)                                           │
│    - Signed Binaries, Apple Notarized Seal & Release Notes Link       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Visual Design System & CSS Token Specifications

The site strictly extends the monorepo's shared design packages (`@andrew/tokens` and `@andrew/ui`):

### Color Tokens (`theme.css`)
```css
:root {
  /* Studio Amber Accent (Recording Tally / Monitor Calibration) */
  --brand: #e5a93c;
  --brand-light: #f3c267;
  --brand-dim: rgba(229, 169, 60, 0.12);
  --brand-glow: 0 0 25px rgba(229, 169, 60, 0.3);

  /* Deep Obsidian Chrome & Dark Surfaces */
  --page-bg: #090a0d;
  --color-black: #090a0d;
  --color-surface: #121318;
  --color-surface-2: #181920;
  --color-surface-elevated: #1f202a;
  
  /* Precision Hairlines (No Heavy Borders) */
  --hairline: rgba(255, 255, 255, 0.08);
  --hairline-strong: rgba(255, 255, 255, 0.16);

  /* High-Contrast Neutral Typography */
  --text-primary: #f5f5f5;
  --text-secondary: #c2c5ce;
  --text-muted: #8e929e;
  --text-dim: #60636d;

  /* Geometry: Sharp, Tactile, Industrial */
  --container-max: 1320px;
  --radius: 6px;
  --radius-lg: 8px;
  --btn-radius: 4px;
}
```

### Typography Hierarchy
* **Display / H1 Headlines:** `Syne` (Weights: 700 & 800, tight tracking `-0.02em` to `-0.03em`). `clamp(3rem, 7vw, 5.5rem)`.
* **Section Headlines / Drawer Titles:** `Syne` 800 (`clamp(1.2rem, 2.5vw, 1.65rem)`).
* **Body & Explanatory Prose:** `Inter` (neutral, high legibility, line-height 1.6 to 1.65).
* **Monospace & Metadata:** `JetBrains Mono` (`0.7rem – 0.85rem`, uppercase, letter-spacing `0.12em`). Used for version tags, code snippets, timestamps, file paths, and technical indices (`01`, `02`, `03`).

### Button & Interaction Standard
* **Primary Action:** Solid Studio White (`#f5f5f5`) with `#090a0d` dark ink and subtle white specular glow on hover.
* **Secondary Action:** Dark elevated surface (`#181920`) with hairline border and `#ffffff` text on hover.
* **Touch Targets:** Minimum 48px to 56px height across all interactive elements for mobile accessibility.

---

## 5. Multi-Platform & Device Scaling Matrix

| Viewport Tier | Resolution Range | Implemented Responsive Treatment |
| :--- | :--- | :--- |
| **Mobile Portrait** | `320px – 480px` | Single-column vertical accordion drawers. Headline scales down gracefully via `clamp()`. App window toolbar tabs scroll horizontally with `-webkit-overflow-scrolling: touch`. Window version badges hide to prevent crowding. Touch targets are 48px+ minimum. |
| **Mobile Landscape / Phablet** | `481px – 768px` | Spec metrics grid scales to 2 columns. Accordion headers collapse spec badges to maintain 1-line title legibility. |
| **Tablet / Laptop** | `769px – 1024px` | Split-screen drawer canvas adjusts fluidly. Video player canvas maintains 9:16 vertical ratio without overflow. |
| **Standard Desktop** | `1025px – 1440px` | Full side-by-side split drawer: editorial narrative on left (1.1fr), live UI simulation on right (1fr). Studio window frame renders with subtle inset shadows and specular highlights. |
| **Ultrawide & 4K** | `1441px – 2560px+` | `--container-max: 1320px` prevents content stretching across wide screens while providing edge-to-edge cinematic breathing room. |

---

## 6. Target Review Questions for ChatGPT

Please review this site specification and provide actionable, high-impact critiques across the following 5 dimensions:

### Question 1: Visual Gravitas & Micro-Interactions (The "Apple" Bar)
* Does the current visual system (Deep Obsidian `#090a0d` + Studio Amber `#e5a93c` + `Syne` 800) successfully convey the gravitas of a tier-1 desktop pro app like Apple Final Cut Pro, DaVinci Resolve, or Linear?
* What specific CSS micro-interactions, subtle cursor states, or specular edge glints could be added to elevate the tactile "hardware" feel without introducing performance lag or visual noise?

### Question 2: The Vertical Feature Accordion Experience
* The landing page now uses an interactive 5-drawer vertical accordion (`ProFeatureAccordion.astro`) where Drawer 01 starts open on the server.
* How can this accordion be made even more engaging? Should it feature synchronized preview switching, animated scrub head loops, or automated timer rotations (like Apple's featured stories)?
* Is there any risk of visitors missing the lower drawers, and what visual cues (e.g., active progress tracks, keyboard navigation hints) would maximize exploration?

### Question 3: Technical Grounding vs. Creator Appeal
* Reelay balances two audiences: **creative video creators** (who care about speed, organization, and multi-platform publishing) and **technical/platform reviewers** (who scrutinize RFC 8252 loopback ports, SQLite FTS5 indices, and Keychain storage).
* Does the landing page strike the right balance between creative empowerment and technical rigor? Are there areas where the copy is either too technical or not technical enough?

### Question 4: Conversion Architecture & Download CTAs
* The app is distributed as native desktop binaries (Apple Silicon DMG, Intel DMG, Windows EXE).
* Does the current download hero and download section build sufficient trust (e.g., Apple Notarization, SHA-256 checksums, Gatekeeper clearance)?
* What additional social proof, performance benchmarks, or download reassurance patterns should be incorporated?

### Question 5: Blind Spots & Next-Level Enhancements
* What are the most glaring blind spots in this design compared to world-class pro software websites (e.g., Raycast.com, Linear.app, Apple.com, Zed.dev)?
* If you could redesign or add three specific components to make this site truly unforgettable, what would they be?

---

## 7. Build & Audit Verification Status

The site is fully implemented and passes all automated checks:
* **Framework:** Astro 5 Static Site Generation (SSG).
* **Build Time:** 264ms (`11 page(s) built in 264ms`).
* **Route Audit:** `node scripts/audit-dist.mjs` passes 100% (verifies all 11 routes, Google Limited Use policy disclosures, YouTube scopes, Keychain storage disclosures, and Meta user data deletion instructions).
* **Clean Codebase:** Zero unused CSS variables, zero clashing colors, zero duplicate DOM IDs, and valid W3C semantic markup.
