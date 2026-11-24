# Cloudflare: every site, its own Worker

Each site under `sites/` that opts in deploys to its own Cloudflare Worker on
the `heythisisandrewb.workers.dev` subdomain:

| Site | Live URL |
| :--- | :--- |
| `hey-this-is-andrew` | https://hey-this-is-andrew.heythisisandrewb.workers.dev |
| `netta-henna-and-feathered-soul` | https://netta-henna-and-feathered-soul.heythisisandrewb.workers.dev |
| `reelay` | https://reelay.heythisisandrewb.workers.dev |

`pnpm cf list` prints the current list. BE Unconventional HQ is never deployed
from this repository (its copy here is out of date; see `AGENTS.md`), and the
script refuses it.

## How it works

- **Opt in:** a `"cloudflare": { "worker": "<name>", "routes": [...] }` block in
  the site's `package.json`, plus a `wrangler.jsonc` beside it with
  `"preview_urls": true`. `pnpm new-site` writes both, so a new site gets
  production deploys and branch/PR previews from its first push. `routes` are
  the pages a preview run reports on.
- **One script:** `scripts/cloudflare.mjs` (`pnpm cf`) builds a site with
  `SITE_URL` set to its Worker (or preview) address, `BASE_PATH=/`, and
  `PUBLIC_BUILD_SHA` (the commit; defaults to `git rev-parse HEAD`). Static
  sites upload `dist/` as Worker static assets; the personal site uses the
  Astro Cloudflare adapter (its contact form needs a server) and deploys
  `dist/client` with the `dist/server/wrangler.json` the adapter writes. The
  uploaded folder must resolve inside the site's own `dist/`, and OS junk
  (`.DS_Store`, `Thumbs.db`, `._*`) is stripped from it after every build.
- **Build stamp:** `@andrew/ui` `ChromeMeta` (every site's `<head>`) emits
  `<meta name="build-sha">` when `PUBLIC_BUILD_SHA` is set, and
  `<meta name="robots" content="noindex, nofollow">` when `PUBLIC_NOINDEX=1`.
  CI reads the stamp to know what production serves, the same way BE
  Unconventional HQ's `deploy.yml` does.
- **Only what changed builds** (`pnpm cf changed <base> <head>`):

  | Changed | Sites selected |
  | :--- | :--- |
  | `sites/<x>/**` | `<x>` |
  | `packages/<p>/**` | sites that depend on `@andrew/<p>`, directly or through another package (`packages/content-pipeline` selects only the personal site; `packages/ui` / `tokens` select all three) |
  | `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `scripts/cloudflare.mjs`, `scripts/pnpm-command.mjs`, `.github/workflows/cloudflare*.yml`, the root `wrangler` version | every site |
  | anything else (docs, templates, other workflows, tests) | none |

  Each CI job then installs only its site, that site's workspace packages and
  the root (for `wrangler`): `pnpm install --frozen-lockfile --filter
  "<site>..." --filter .`, with browser downloads off.
- **Custom domain later:** add `"siteUrl": "https://the-domain"` to the site's
  `cloudflare` block, push, then attach the domain to the Worker in the
  dashboard (Workers & Pages, the Worker, Settings, Domains & Routes).

GitHub Pages keeps publishing the personal site (with the Reelay and Netta
previews under it) from `.github/workflows/deploy.yml`, unchanged. All sites
read `SITE_URL` / `BASE_PATH`; the personal site still accepts the older
`ASTRO_SITE` / `ASTRO_BASE`.

## Production deploys (`.github/workflows/cloudflare.yml`)

Runs on every push to `main`, after each content-sync workflow succeeds
(`Sync Instagram Media`, and Substack syncs by name: add new sync workflows'
names to its `workflow_run` list; their `GITHUB_TOKEN` pushes do not trigger
`on: push`), and by hand (Actions > Deploy to Cloudflare > Run workflow: one
site or `all`, `force` to redeploy). For each selected site:

1. **Is production current?** It fetches
   `https://<worker>.heythisisandrewb.workers.dev/?deploy-check=<ts>` and reads
   the build stamp. Same commit as `main`, or an older commit with nothing the
   site builds from changed since: skip (unless `force`).
2. **Build and deploy** with `wrangler deploy`. Worker secrets go up with the
   new version (`--secrets-file`), never as a separate `secret put`.
3. **Prove it:** poll the workers.dev address (20 tries, 15 s apart) until it
   serves that exact commit, and **fail the job** if it never does. A custom
   domain is probed once for information only: 403 is bot protection (fine),
   404 means the domain is not on this Worker (a warning). The check uses
   workers.dev, not the domain, because a zone's bot protection answers
   GitHub's runners with 403 (HQ learned this on its first run).

Jobs time out after 20 minutes; one deploy per site runs at a time.

## Branch and PR previews (`.github/workflows/cloudflare-preview.yml`)

Every pull request into `main` previews the sites it affects; any branch can
be previewed by hand (Actions > Cloudflare previews > Run workflow > pick the
branch, then a site or `all`). Each site's preview lives at

`https://<branch>-<worker>.heythisisandrewb.workers.dev`

The branch becomes a DNS-safe alias (`pnpm cf preview-url <site> <branch>`):
lowercase letters, digits and hyphens, starting with a letter, and short
enough that `<alias>-<worker>` fits one 63-character DNS label (long names
are cut and given a 4-character hash). Keep site names to 40 characters
(`pnpm new-site` enforces it).

The run uses `wrangler versions upload --preview-alias`, **never**
`wrangler deploy`, so production is untouched. It then waits for the preview
to answer 200 (and fails with instructions if Preview URLs are off for the
Worker), writes a summary with a link and status for each of the site's
`routes`, and posts one comment per site on the PR, updated on every push.

Preview builds are noindex three ways: the robots meta (`PUBLIC_NOINDEX=1`),
`robots.txt` replaced with `User-agent: *` / `Disallow: /`, and an
`X-Robots-Tag: noindex, nofollow` header. Pull requests from forks get no
secrets and skip with a notice.

**A preview shares production's secrets and storage.** A contact-form test on
a preview sends a real email.

## While a preview is the newest version: no dashboard secret edits

A Worker's versions are a single list. After a preview upload, the preview
is the newest version, even though production still serves an older one.
Adding or changing a variable or secret **in the Cloudflare dashboard**
builds on the newest version and deploys it, so production starts serving
the unmerged branch (this happened to BE Unconventional HQ on 2026-11-05).
`wrangler secret put` refuses for the same reason when the newest version is
not the deployed one.

Safe ways to change a secret:

- **Best:** change the repository secret in GitHub, then run Deploy to
  Cloudflare for that site with `force`. The secret goes up with a fresh
  production build of `main`.
- `npx wrangler versions secret put <NAME> --name <worker>` saves it on a new
  version **without** deploying; the next production deploy carries it.
- The dashboard only right after a production deploy, when the newest version
  is `main`'s.

If production ever serves a branch by mistake, run Deploy to Cloudflare for
that site with `force`: it rebuilds `main` and puts it back.

## One-time setup

**1. Cloudflare token.** https://dash.cloudflare.com/profile/api-tokens

- Create Token, then Use template next to **Edit Cloudflare Workers**.
- Token name: anything (e.g. "Monorepo Edit Cloudflare Workers").
- Zone policy: pencil, Include, **All zones**. (workers.dev needs no zone;
  this lets custom domains work later.)
- Account policy: pencil, Include, **your account**.
- User policy: leave as is.
- Token expiration: No expiration (or 1 year, with a reminder to replace it).
- Client IP address filtering: leave empty (GitHub's machines change IPs).
- Continue to summary, Create Token, copy the token (shown once).

**2. Save it in GitHub.**
https://github.com/HeyThisIsAndrew/hey-this-is-andrew/settings/secrets/actions/new
Name `CLOUDFLARE_API_TOKEN`, paste, Add secret.

**3. Resend key.** https://resend.com/api-keys
Create API Key, any name, Permission **Sending access**, Domain **All domains**,
Add, copy the key. Then the same GitHub page as step 2: name `RESEND_API_KEY`,
paste, Add secret. (`RESEND_FROM_EMAIL` later, once a sending domain is
verified in Resend.)

**4. First deploy.**
https://github.com/HeyThisIsAndrew/hey-this-is-andrew/actions/workflows/cloudflare.yml
Run workflow, site `all`, Run workflow. Later pushes to `main` deploy on
their own.

Until `CLOUDFLARE_API_TOKEN` exists the workflow skips with a notice instead of
failing.

## Worker secrets

A site lists the secrets its Worker needs in its `cloudflare` block
(`"secrets": ["RESEND_API_KEY"]`). Each production deploy uploads any that
exist as repository secrets together with the new version
(`wrangler deploy --secrets-file`); ones that do not exist are left as they
are on Cloudflare. Previews inherit the Worker's secrets.

The personal site's contact form sends through Resend. `/api/contact` on the
live site shows `"configured": true` once `RESEND_API_KEY` is on the Worker.
Without a verified domain, Resend's default sender only delivers to the Resend
account's own address, so CCC inquiries to `capturecreatecaffeinate@gmail.com`
fall back to mailto.

## Deploying by hand

```bash
npx wrangler login
```

```bash
pnpm cf deploy <site>
```

`pnpm cf deploy all` deploys every Cloudflare site. A hand deploy is stamped
with your local `HEAD`; the next CI run deploys `main` over it if they differ.

| Command | What it does |
| :--- | :--- |
| `pnpm cf build <site>` | production build, no deploy |
| `pnpm cf build <site> --preview <branch>` | preview build (noindex), no upload |
| `pnpm cf preview <site\|all> <branch>` | build and upload a preview version |
| `pnpm cf preview-url <site> <branch>` | the preview address |
| `pnpm cf live-sha <site>` | the commit production serves |
| `pnpm cf needs-deploy <site> <sha>` | whether production is behind |
| `pnpm cf verify <site> <sha>` | wait until production serves `<sha>` |
| `pnpm cf preview-check <site> <branch>` | wait for a preview and report its routes |
| `pnpm cf changed <base> <head>` | the sites a range of commits affects |
| `pnpm cf info <site>` | the site's Worker, URLs and routes (JSON) |

The script's tests: `node --test scripts/cloudflare.test.mjs` (also part of
`pnpm check`).

## Personal site details

| File | Purpose |
| :--- | :--- |
| `sites/hey-this-is-andrew/wrangler.jsonc` | Worker name, compatibility date, `auto-trailing-slash` (the site's URLs end in `/`). |
| `sites/hey-this-is-andrew/astro.config.mjs` | Cloudflare adapter when `CF_WORKERS=1`; `site` from `ASTRO_SITE`; `/api/contact` server-rendered on Cloudflare, prerendered elsewhere; `sitemap.xml` copy; Cloudflare `robots.txt` names its own sitemap. |
| `sites/hey-this-is-andrew/src/pages/api/contact.ts` | Resend sender (`RESEND_API_KEY` via `astro:env/server`). CCC inquiries go to `capturecreatecaffeinate@gmail.com`, everything else to `heythisisandrewb@gmail.com`. No key: 503 and the form falls back to mailto. |
| `sites/hey-this-is-andrew/src/layouts/BaseLayout.astro` | Canonical, `og:image` and JSON-LD URLs use the build's own origin. |

The first deploy also creates a small KV namespace for the `SESSION` binding
the Astro adapter declares.
