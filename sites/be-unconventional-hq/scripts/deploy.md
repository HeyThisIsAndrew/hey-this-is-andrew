# Deploying to production

**Production deploys from GitHub Actions: `.github/workflows/deploy.yml`.**
It builds `main`, deploys it to the Cloudflare Worker `beunconventionalhq`
with wrangler, then fetches the Worker until the page's
`<meta name="build-sha">` matches the commit it deployed, and **fails** (so
GitHub emails the owner) if it never does.

The check reads the Worker's workers.dev address
(https://beunconventionalhq.heythisisandrewb.workers.dev), not the domain.
The domain is behind Cloudflare's bot protection, which returns 403 to every
request from a GitHub runner: the first run deployed correctly and then
failed all 20 checks on that alone. It is the same Worker and the same
version. The domain is still probed once afterwards, as information only
(403 = bot protection, fine; 404 on `/api/live-status.json` = the domain is
not on this Worker, which is a real problem and logs a warning). Do not
"fix" the check by pointing it back at the domain, or by loosening bot
protection for it.

It runs on every push to `main`, after every content-sync workflow, daily at
07:05 UTC (the Shorts shelf rotates by build date), and by hand from
Actions → Deploy production → Run workflow (tick `force` to redeploy an
unchanged `main`).

## Why not Cloudflare Workers Builds any more

On 2026-09-24 the Workers Builds queue stuck: the build for the homepage merge
(`fc28cd02`) and the content push after it sat `queued` with no runner
(`initializing_on` / `running_on` null), production stayed on a pre-merge
version, and nothing reported it. A laptop `npm run deploy` fixed it. The
workflow is that deploy, automated, plus the verification that was missing.

## One-time setup (owner)

1. **Cloudflare API token.** Cloudflare → My Profile → API Tokens → Create
   Token → template **"Edit Cloudflare Workers"** → scope it to this account
   → create, copy it.
2. **GitHub secret.** Repo → Settings → Secrets and variables → Actions →
   New repository secret → name `CLOUDFLARE_API_TOKEN`, paste the token.
   (The account ID is in the workflow; it is not a secret.)
3. **Run it once.** Actions → Deploy production → Run workflow (tick
   `force`). It should end with "Production serves <sha>".
4. **Turn off Workers Builds' production deploys** for the Worker
   (Workers & Pages → beunconventionalhq → Settings → Builds → disconnect the
   repo, or disable builds for the production branch). Two deployers racing
   each other can put an OLDER commit live after a newer one, which is worse
   than either alone. Preview builds for PR branches can stay if wanted.
5. **Turn off the old Pages project's automatic deployments** (Workers &
   Pages → the Pages project → Settings). The domain is on the Worker; Pages
   only adds a duplicate "Cloudflare Pages" check to every PR. Keep the
   project as a fallback, disabled.

Until step 2 is done the workflow logs a notice and exits green, so it is safe
to have merged before the setup.

## Deploying by hand (fallback)

From a clone on `main`: `npm ci && npm run build && npm run deploy`
(wrangler logs in through the browser the first time; if asked for an
account, prefix `CLOUDFLARE_ACCOUNT_ID=b10b7bc3e6a0fd361ba0956c8aa7d307`).
A hand deploy has no build stamp; the next workflow run notices production
is not on a stamped `main` commit and deploys it properly.

## Checking what is live

View the source of https://beunconventionalhq.com/ and find
`<meta name="build-sha" content="...">`: that is the commit being served.
`/api/live-status.json` answering JSON (not 404) confirms the domain is on
the Worker, not the retired Pages project.
