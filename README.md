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

## Day to day (the personal site)

Everything below runs in Terminal, from this folder
(`cd ~/Documents/UpSkill_Projects/hey-this-is-andrew`). Paste one command
at a time, and never paste lines that start with `#`.

### Once per computer

1. Node.js 22 or newer. Check with `node -v`; install from
   <https://nodejs.org> if it is missing or older.
2. That's it. `./site` installs everything else the first time you run it.

### The commands

| command | what it does |
| --- | --- |
| `./site review` | the one to remember: gets the latest from GitHub, installs, downloads the photos and starts the site |
| `./site review <branch>` | same, for a branch someone pushed for you to look at (e.g. `./site review claude/personal-site-visual-fixes`) |
| `./site dev` | just starts the site (when everything is already installed) |
| `./site photos` | downloads the "Shot on the job" photos for your local copy |
| `./site clean` | removes the downloaded photos again (see "Before you commit") |
| `./site check` | runs the same checks GitHub runs before it publishes |

While the site is running:

- open <http://localhost:3000> on the Mac;
- on your iPhone (same Wi-Fi), open the **Network** address it prints,
  e.g. `http://192.168.50.104:3000`;
- edits you save show up in the browser straight away;
- **Ctrl+C** stops it ("Site stopped." means it closed normally).

### Before you commit or switch branches

Run `./site clean`. The photo download changes a few files that should
never be committed (the photos themselves, `instagram-feed.json`,
`instagram-media-todo.md`). `./site review` cleans up by itself first.
A `package-lock.json` only appears if someone ran `npm install` by
mistake; it is ignored by git, delete it whenever you see it.

### Publishing

The live site is <https://heythisisandrew.github.io/hey-this-is-andrew/>.
Anything that lands on `main` publishes itself in about two minutes; the
**Actions** tab on GitHub shows the progress (green tick = live). Branches
never publish, which is why `./site review <branch>` exists.

### If something goes wrong

| you see | do this |
| --- | --- |
| `zsh: permission denied: ./site` | `chmod +x site`, then try again |
| `command not found: pnpm` | use the `./site` commands, or put `corepack ` in front (`corepack pnpm install`). To make plain `pnpm` work everywhere, run `sudo corepack enable` once (it asks for your Mac password) |
| `corepack: command not found` | newer Node versions no longer include it: `npm install -g corepack`, then try again |
| `Stopped: git checkout ... did not finish` | you have unsaved edits; commit them, or run `git stash`, then try again |
| photos show "could not be loaded" | the photo links expire (the current set on 2026-10-05). Set the token first: `export CCC_INSTAGRAM_ACCESS_TOKEN=...` (your Capture Create Caffeinate token from Meta for Developers; GitHub never shows a saved secret again), then `./site photos`. Without it the live site is unaffected: GitHub has its own copy |
| anything else | copy the whole Terminal output and send it to Claude |

## Add a new site in five steps

**1. Copy the starter.** From this folder:

```sh
corepack pnpm new-site my-new-site
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

Preview any site locally first: `corepack pnpm --filter my-new-site dev`.

## pnpm commands (whole workspace)

These need pnpm: put `corepack ` in front if `pnpm` alone is not found.

| command | what it does |
| --- | --- |
| `pnpm install` | installs everything |
| `pnpm build` | builds every site and the starter (a quick "is anything broken?") |
| `pnpm test` | runs every site's checks |
| `pnpm new-site <name>` | makes a new site from the starter |
| `pnpm --filter <site> dev` | runs one site locally |

The `./site` commands above also exist as `pnpm review`, `pnpm dev`,
`pnpm photos`, `pnpm clean` and `pnpm check`; the only difference is that
pnpm prints an `ELIFECYCLE` line when you stop the site with Ctrl+C. It is
harmless, and `./site` does not print it.

## Renaming

Renaming the GitHub repository changes the personal site's address from
`heythisisandrew.github.io/hey-this-is-andrew/` to
`heythisisandrew.github.io/<new-name>/`. If you rename it, set
`ASTRO_BASE=/<new-name>/` in `.github/workflows/deploy.yml` (or move the site
to a custom domain) so its links keep working.

## Where things are explained

`ARCHITECTURE.md` covers how the pieces fit, what each shared block does, how
theming works, and why each block is shared or kept in its site.
