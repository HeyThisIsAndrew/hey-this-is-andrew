# Hey This Is Andrew — personal landing page

Astro 7 starter scaffold for Andrew's build-in-public landing page.
Dark cinematic theme: near-black canvas, red accent (#E23A3F) pulled from Andrew's reference.

## Run it

```sh
npm install
npm run dev     # local dev server
npm run build   # production build to dist/
npm run preview # preview the production build
```

## Structure

```
src/
  content/            # everything Andrew updates lives here (markdown)
    config.ts         # collection schemas (projects, goals, gear)
    projects/*.md     # recent work + process notes
    goals/*.md        # milestone groups for the progress checklist
    gear/*.md         # equipment inventory by category
  components/         # one .astro file per page section
  data/brands.ts      # the three brand cards (name, tagline, link)
  layouts/            # BaseLayout: head, fonts, nav, footer, <slot />
  styles/             # tokens.css (palette/type) + global.css
  pages/index.astro   # assembles the sections top to bottom
public/
  brand-logos/        # drop brand logo SVGs here (see README inside)
  hero-media/         # drop hero still/clip here (see README inside)
```

## The build-in-public workflow

Updating the checklist, gear list, or projects never touches components.
Edit a markdown file in `src/content/`, commit, redeploy. That is the
transparent process the page is selling, so the architecture models it.

## Still placeholder

- Brand logos: `public/brand-logos/` (wordmark fallback renders until then)
- Hero background media: `public/hero-media/`
- Project entries: the two in `src/content/projects/` are samples, replace
  with real shoots
- Favicon: add `public/favicon.svg`
- Fonts load from Google Fonts; self-host later if preferred
