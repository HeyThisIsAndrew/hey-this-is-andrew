# Architecture: andrew-sites

Andrew's website builder. One repository holds the **building blocks** (`packages/`) and the **sites made from them** (`sites/`). A new site is a copy of the starter, given its own colours and content. It never gets its own copy of the blocks, so a fix to a block reaches every site at once.

## 1. The Workspace

- `packages/tokens/`: CSS tokens (`tokens.css`) defining the base (dark, monochrome) and themes.
- `packages/ui/`: The shared component library (Astro components, TS types, CSS).
- `packages/local-cms/`: A local JSON editor (running at `/local-cms` under `pnpm dev`) for managing content without a database.
- `sites/hey-this-is-andrew/`: The primary personal site.
- `templates/site-starter/`: The starting point for every new site.

## 2. Shared Packages & Components

All shared components live in `@andrew/ui/` and consume tokens from `@andrew/tokens/`.

| Component | Props | Description |
| --- | --- | --- |
| `BrandAccordion` | `panels: PanelData[]` | The expanding hero directory. |
| `ExpandSection` | `id: string, expandLabel?: string, collapseLabel?: string` | In-place accordion. Replaces page jumps by revealing content inline. |
| `FilterTabs` | `target: string, label: string, tabs: {key, label}[]` | Client-side filter bar. Hides elements based on `data-kind`. |
| `Footer` | `siteName: string, tagline: string, links: FooterLink[], socials: SocialLink[], copyright: string` | Standard site footer. |
| `Nav` | `siteName: string, links: NavItem[]` | Standard sticky header with mobile menu and dropdowns. |
| `NewTag` | `published: string, label: string, thresholdDays?: number` | Renders a tag (e.g. "NEW") if `published` date is within `thresholdDays` (default 1). |
| `PageNav` | `sections: {id, label}[]` | A sticky side-navigation (scrollspy) for long pages. |
| `PhotoElevator` | `photos: DisplayPhoto[]` | Infinite vertical scroll of reels/photos. Extracted from the personal site. |
| `QuoteBand` | `eyebrow: string, quote: string, attribution: string` | A full-width testimonial strip. |
| `SectionHeader` | `index: string, kicker: string, title: string, lede?: string, id?: string` | Standardised section header block. |
| `ViewAllLink` | `href: string, label: string` | Styled outbound link. Replaced by ExpandSection for inline expansion. |

## 3. The Navigation Model

To keep visitors engaged and reduce context switching, the navigation follows strict rules:

1. **In-place Expansion**: A homepage section never links to a standalone page for its full content. Instead, "Show all" uses the `<ExpandSection>` component to expand the remaining items inline.
2. **Top-level Header**: Leaving a page is strictly the header's job. Top-level links (like About, Gear) belong in the header.
3. **Data-driven Dropdowns**: Dropdowns only list anchor links (`#id`) present on the *current* page, in their exact DOM order. Dropdowns are generated dynamically from a page's `sections.ts` or `nav.ts` data to prevent drift.
4. **Where Am I?**: The current top-level page is clearly marked in the header (`aria-current="page"`). Long pages use `<PageNav>` scrollspy to highlight the active section.

## 4. How a Client Site is Made

1. **Scaffold**: Run `pnpm new-site <client-name>`. This copies `templates/site-starter` to `sites/<client-name>`, avoiding duplication of shared components.
2. **Theme**: Edit `sites/<client-name>/src/styles/theme.css` to override `--brand` or any specific tokens.
3. **Configure**: Edit `sites/<client-name>/src/data/site.ts` to set the site name, description, footer text, social links, and navigation items.

## 5. How Content is Edited

Every site uses `packages/local-cms/`. Content is strictly decoupled from layout.

1. **Run Dev Server**: Run `pnpm --filter <client-name> dev`.
2. **Open CMS**: Navigate to `http://localhost:3000/local-cms` (or `4321` depending on configuration).
3. **Edit**: Modify posts, brand panels, galleries, and any other JSON collections defined in `local-cms.config.mjs`.
4. **Save**: The CMS writes back to `src/data/*.json`. The changes are instantly previewable on the local site.
5. **Deploy**: Commit the changed JSON files and push. The CI pipeline builds the Astro site, treating the JSON files as a database.
