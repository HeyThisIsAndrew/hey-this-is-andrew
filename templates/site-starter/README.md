# site-starter

The smallest complete site built from the shared blocks: one layout, the
shared Nav and Footer, a brand accordion, one content collection (posts),
and a theme file. It builds and runs as-is.

Do not edit this folder to make a site. Copy it (`pnpm new-site my-site`
from the repository root) and edit the copy. The root README walks through
the five steps.

| file | what to change |
| --- | --- |
| `src/data/site.ts` | name, tagline, nav links, social links |
| `src/styles/theme.css` | colours (the `--brand` accent first) |
| `src/data/panels.ts` | the accordion's panels |
| `src/content/posts/*.md` | posts (add a file, it appears) |
| `src/assets/logo.svg`, `public/favicon.svg` | your logo and favicon |
| `deploy/github-pages.yml` | how the site goes live |
