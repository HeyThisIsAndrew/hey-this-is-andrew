# andrew-sites

Andrew's website builder. One repository holds the **building blocks**
(`packages/`) and the **sites made from them** (`sites/`). A new site is a
copy of the starter, given its own colours and content. It never gets its
own copy of the blocks, so a fix to a block reaches every site at once.

```
packages/ui/              shared building blocks (accordion, nav, footer, ...)
packages/tokens/          shared design values (colours, fonts, spacing)
sites/hey-this-is-andrew/ the personal site (live on GitHub Pages)
templates/site-starter/   the starting point for every new site
```

(The repository is still named `hey-this-is-andrew` on GitHub. Renaming it
to `andrew-sites` is your call; see "Renaming" below.)

## Before you start (once per computer)

1. Install Node.js 22 or newer: <https://nodejs.org>
2. Turn on pnpm (it ships with Node): `corepack enable`
3. In this folder, run `pnpm install`

To work on the personal site: `pnpm dev`, then open <http://localhost:3000>.

## Add a new site in five steps

**1. Copy the starter.** From this folder:

```sh
pnpm new-site my-new-site
```

This creates `sites/my-new-site/` and installs it. Use lowercase letters,
numbers and dashes in the name.

**2. Set the brand colours.** Open `sites/my-new-site/src/styles/theme.css`
and change `--brand` to the site's accent colour. Everything else (fonts,
spacing, the dark background) comes from the shared tokens; change a value
here only if this site needs it different. Replace
`src/assets/logo.svg` and `public/favicon.svg` with the site's own.

**3. Add the content.** Posts are Markdown files in
`sites/my-new-site/src/content/posts/`. Copy `hello-world.md`, change the
title, date, summary and text, and it appears on the home page. No code.

**4. Add the brand data.** Open `sites/my-new-site/src/data/site.ts` (name,
tagline, menu links, social links) and `src/data/panels.ts` (the accordion's
brand panels: headline, one-line description, button text and link, image).
The menu and the footer both read `site.ts`, so they always match.

**5. Deploy.** `sites/my-new-site/deploy/github-pages.yml` explains the two
options: make it this repository's GitHub Pages site, or point a host such
as Cloudflare Pages or Netlify at the `sites/my-new-site` folder (build
command `pnpm install && pnpm run build`, output folder `dist`). GitHub
Pages publishes one site per repository, and the personal site uses it now.

Preview any site locally first: `pnpm --filter my-new-site dev`.

## Everyday commands

| command | what it does |
| --- | --- |
| `pnpm dev` | runs the personal site locally |
| `pnpm build` | builds every site and the starter (a quick "is anything broken?") |
| `pnpm test` | runs every site's checks |
| `pnpm new-site <name>` | makes a new site from the starter |
| `pnpm --filter hey-this-is-andrew run sync:instagram` | downloads new "Shot on the Job" photos |

## Renaming

Renaming the GitHub repository changes the personal site's address from
`heythisisandrew.github.io/hey-this-is-andrew/` to
`heythisisandrew.github.io/<new-name>/`. If you rename it, set
`ASTRO_BASE=/<new-name>/` in `.github/workflows/deploy.yml` (or move the site
to a custom domain) so its links keep working.

## Where things are explained

`ARCHITECTURE.md` covers how the pieces fit, what each shared block does, how
theming works, and why each block is shared or kept in its site.
