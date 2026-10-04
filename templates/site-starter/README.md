# site-starter

The smallest complete site built from the shared blocks: one layout, the
shared Nav and Footer, a brand accordion, one content collection (posts),
a theme file and the local CMS. It builds and runs as-is.

Do not edit this folder to make a site. Copy it (`pnpm new-site my-site`
from the repository root) and edit the copy. The root README walks through
the five steps.

| file | what to change |
| --- | --- |
| `src/data/site.ts` | name, tagline, nav links, social links |
| `src/styles/theme.css` | colours (the `--brand` accent first) |
| `/local-cms` (under `pnpm dev`) | the accordion's panels and the posts (`src/data/panels.json`, `posts.json`) |
| `local-cms.config.mjs` | what the CMS edits; `imageHost` for Sanity images |
| `src/assets/logo.svg`, `public/favicon.svg` | your logo and favicon |
| `deploy/github-pages.yml` | how the site goes live |
