# Live-Status Endpoint — Operator Guide (issue #20)

`GET /api/live-status.json` answers one question: **is the channel live right
now?** It powers the Takeover Billboard (homepage transforms when a stream
starts).

## Architecture

```
platform adapters (src/lib/platforms/youtube.ts, twitch.ts…)
    └── LiveStatusProvider seam        src/lib/live-status.ts
            └── checkLiveStatus()      parallel, error-isolated aggregation
                    └── endpoint       src/pages/api/live-status.json.ts (edge, on-demand)
                            └── frontend consumer (Takeover Billboard — not built yet)
```

- The site stays fully static; only this route runs per-request
  (`prerender = false`). Astro 5+ folded the old `output: 'hybrid'` into
  `static`, so **no global config change was needed** — the Cloudflare adapter
  emits a worker for just this route.
- Providers are error-isolated: one platform failing (quota, outage, bad key)
  can never mask another platform being live. Failures come back as data in
  `errors[]`.

## Response shape

```json
{
  "isLive": true,
  "streams": [
    {
      "platform": "youtube",
      "videoId": "abc123",
      "title": "SDCC Live Show",
      "url": "https://www.youtube.com/watch?v=abc123"
    }
  ],
  "errors": [],
  "checkedAt": "2026-07-17T18:00:00.000Z"
}
```

The endpoint never 500s for expected conditions. Before credentials are
configured it returns `isLive: false` with
`errors: [{ platform: "youtube", message: "not_configured" }]`.

## Deployment: Pages → Workers migration (REQUIRED — root cause of the /api 404)

Confirmed 2026-07-17 (epic #24): production returned 404 on
`/api/live-status.json` because the site deploys via a **Cloudflare Pages**
project, which serves only the static `dist/client` half of the build.
`@astrojs/cloudflare` v13 (required by Astro 6) targets **Cloudflare Workers**
— it emits `dist/server` (worker + generated `wrangler.json` with an assets
binding to `../client`), and Pages never looks at it. There is no Pages mode
on this adapter line, so the fix is a one-time project migration:

1. **Cloudflare dash → Workers & Pages → Create → Workers → Connect to Git**
   (Workers Builds) → select this repo, `main` branch.
2. Build command: `npm run build` · Deploy command: `npm run deploy`
   (which runs `npx wrangler deploy --config dist/server/wrangler.json`).
3. **Env vars**: add `YOUTUBE_API_KEY` (encrypt) on the new Worker
   (Settings → Variables and Secrets). `YOUTUBE_CHANNEL_ID` optional.
4. **If the first deploy errors on the SESSION KV binding** ("kv_namespaces
   requires an id"): Astro's session driver expects a KV namespace. Either
   create one (`Workers KV → Create namespace`, e.g.
   `beunconventionalhq-sessions`) and add a root `wrangler.jsonc` with
   `{ "name": "beunconventionalhq", "kv_namespaces": [{ "binding": "SESSION",
   "id": "<paste id>" }] }` — the build merges it into the generated config —
   or skip if the deploy succeeds without it (newer wrangler can provision).
5. **Custom domain**: remove `beunconventionalhq.com` (+ www) from the Pages
   project, then add them on the Worker (Settings → Domains & Routes).
6. **Keep the Pages project paused** (disable automatic deployments) as
   rollback for a week, then delete it.
7. Verify: `/api/live-status.json` returns JSON (`not_configured` before the
   key, real status after). `_headers`/`_redirects` in `dist/client` are
   honored by Workers static assets, so the security headers carry over.

GitHub Actions CI is unaffected; the "Cloudflare Pages" PR check is replaced
by a Workers Builds check.

## Credentials (required before it goes live)

Cloudflare Pages and Cloudflare Workers have **separate, independent env var
stores**, even when a Pages project and a Worker share the same custom
domain during a migration. A variable set on the Pages project is invisible
to `cloudflare:workers` `env.*` reads at Worker runtime — this is the exact
bug that shipped with a missing `PUBLIC_TURNSTILE_SITE_KEY` (confirmed 2026-07,
Lighthouse caught the resulting console error). Every variable below must be
set on the **Worker** (dashboard → Workers & Pages → this Worker →
Settings → Variables and Secrets), not the Pages project.

| Variable | Notes |
|---|---|
| `YOUTUBE_API_KEY` | Google Cloud → YouTube Data API v3 key. Same key the sync script uses. Encrypt. |
| `YOUTUBE_CHANNEL_ID` | Optional. Defaults to the HQ channel (`UCXqU6781pQgYXDExLvMw2Og`). |
| `PUBLIC_TURNSTILE_SITE_KEY` | **Not a Worker variable. Set it in `wrangler.jsonc` `vars` and rebuild.** See the note below this table before touching it. |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret key, read server-side by `api/contact.ts` and `api/subscribe.ts` to verify submissions. Encrypt. |
| `RESEND_API_KEY` | Used by `api/contact.ts` / `api/subscribe.ts` to send mail. Encrypt. |
| `WEBSUB_SECRET` | HMAC secret verifying `api/youtube-webhook.ts` push notifications. Encrypt. Must match the `hub.secret` used in `renew-websub.yml`. |
| `GITHUB_DISPATCH_TOKEN` | Read by `api/youtube-webhook.ts` to trigger `sync-youtube.yml` on a push notification. Encrypt. |
| `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` / `TWITCH_CHANNEL_LOGIN` | Only needed once the Twitch live provider (below) is activated. Encrypt the secret. |

### `PUBLIC_TURNSTILE_SITE_KEY` is the one exception in that table

Every other row above is a runtime value and belongs on the Worker. This one
does not, and setting it there does nothing. It cost a production outage to
learn, so it is written down here.

It is declared `context: 'client'` in the astro:env schema, and this site is
static output, so Astro inlines it at BUILD time into the prerendered HTML of
every page carrying the newsletter form. Its value comes from `vars` in
`wrangler.jsonc`. A Worker variable is a RUNTIME value: it cannot reach back
into HTML that was already built. `@astrojs/cloudflare` also copies those vars
into `dist/server/wrangler.json`, which is the config `npm run deploy` deploys
with, so a dashboard edit is overwritten by the next deploy regardless.

`TURNSTILE_SECRET_KEY` is the opposite and stays in the table: server-side,
read at runtime through `cloudflare:workers`, so the dashboard IS where it
lives. The two therefore rotate in different places, and rotating only one
leaves the browser holding a token from widget A while the server verifies it
against widget B's secret. siteverify answers `invalid-input-response` and
every submission fails, with no code defect to find. Rotate both in the same
sitting: the site key in `wrangler.jsonc` followed by a rebuild and redeploy,
the secret in the dashboard.

A `.env` value overrides the key baked into the HTML but NOT the copy in
`dist/server/wrangler.json`, which reproduces that same mismatch from a third
direction. Keep Turnstile keys out of `.env` for any build you intend to
deploy; they are for local dev only.

For local `astro dev`, put them in `.env` instead (see `.env.example`).

## Quota math and Edge Caching

Live detection uses `search.list` = **100 units/call** against the free
**10,000 units/day** — a hard ceiling of ~100 checks/day.

The CDN is the rate limiter, not application code. The policy is declared in
`astro.config.mjs` via Astro 7 `routeRules` plus the `cacheCloudflare()`
provider, which turns the rule into a `Cloudflare-CDN-Cache-Control` header
on the response:

- `s-maxage=900` → Cloudflare hits this endpoint at most ~96×/day
  (~9,600 units worst case, inside quota even with the daily sync running).
- `max-age=0` → browsers always revalidate against the edge; no stale tabs.
- `stale-while-revalidate=300` → visitors get instant answers while the edge
  refreshes in the background.

### How the rule becomes headers

`routeRules` entries are `{ maxAge, swr, tags }` and nothing else. The shape is
validated by a plain `z.object()`, which **strips unknown keys silently rather
than rejecting them**, so a rule written any other way parses "successfully" as
`{}` and disables itself. Written correctly, the rule above produces:

```
Cloudflare-CDN-Cache-Control: public, max-age=900, stale-while-revalidate=300
Cache-Tag: astro-path:/api/live-status.json,astro-version:<deploy id>
```

`maxAge` is the EDGE lifetime here, not the browser's: `Cloudflare-CDN-Cache-Control`
is CDN-targeted, so `max-age` on it does the job `s-maxage` does on a normal
`Cache-Control`. The handler still sends its own `Cache-Control: max-age=0,
s-maxage=900` for browsers and any non-Cloudflare intermediary.

The `astro-version:` tag comes from the `CF_VERSION_METADATA` binding in
`wrangler.jsonc`. Without that binding the tag is simply absent and stale
entries survive a deploy.

`scripts/route-cache.test.mjs` pins all of this, including the tag strings
quoted below, so the runbook cannot drift away from what the code emits.

### Cache purging (instant live transitions)

To make a live transition appear without waiting out the 15-minute window,
purge by tag. **The tag is `astro-path:` + the path, not the bare path** — the
prefix is what `pathTag()` in the provider emits, and a purge for the bare
path silently matches nothing:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/<YOUR_ZONE_ID>/purge_cache" \
     -H "Authorization: Bearer <YOUR_API_TOKEN>" \
     -H "Content-Type: application/json" \
     --data '{"tags":["astro-path:/api/live-status.json"]}'
```

This forces the edge to re-fetch on the next visitor: one `search.list` call,
not one per visitor.

Purge by tag is an Enterprise-plan feature on Cloudflare. On a lower plan use a
single-file purge instead, which needs no tag:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/<YOUR_ZONE_ID>/purge_cache" \
     -H "Authorization: Bearer <YOUR_API_TOKEN>" \
     -H "Content-Type: application/json" \
     --data '{"files":["https://beunconventionalhq.com/api/live-status.json"]}'
```

## Twitch (built — activate with credentials)

The Twitch adapter (`src/lib/platforms/twitch.ts`, app-token auth with lazy
caching) and provider are implemented and tested. The endpoint includes
Twitch in the live check **only when all three vars exist** — fully inert
otherwise:

| Variable | Where |
|---|---|
| `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` | dev.twitch.tv → register an application. Worker env (encrypt the secret). |
| `TWITCH_CHANNEL_LOGIN` | the channel's login name (the twitch.tv/<login> part) |

No quota economics like YouTube's — Helix limits are per-minute buckets; the
CDN cache stays the effective rate limiter. Simulcasts return both platforms
in `streams[]`; the billboard prefers the YouTube entry.

Adding any further platform stays the same recipe: adapter in
`src/lib/platforms/`, a `create<X>LiveProvider()` wrapper, one conditional
push in the endpoint.

## Tests

```
node scripts/live-status.test.mjs
```

Offline (stubbed fetch), covers: live/offline mapping, aggregation, error
isolation, quota-failure surfacing, simulcast.
