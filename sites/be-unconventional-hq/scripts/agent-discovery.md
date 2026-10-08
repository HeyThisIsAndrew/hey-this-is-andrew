# Agent discovery: what is live, and the one part that is not

Operator notes for epic #192. Everything below is deployed by a normal build
except the DNS section, which needs dashboard access nothing in this repo has.

## What ships from the repo

| Path | What it is | Notes |
|---|---|---|
| `/.well-known/agent-skills/index.json` | Agent Skills Discovery index | Digest-verified, see below |
| `/.well-known/agent-skills/beunconventionalhq-content/SKILL.md` | The one published skill | |
| `/.well-known/api-catalog` | RFC 9727 linkset | Needs `application/linkset+json`, set in `_headers` |
| `/.well-known/ai-catalog.json` | ARD manifest, specVersion 1.0 | |
| `/.well-known/mcp/server-card.json` | MCP server card (SEP-1649 path) | |
| `/.well-known/mcp.json` | The same card at the SEP-2127 path | |
| `/auth.md` | How to use the APIs | There is no auth; it says so |
| `/api/mcp` | The MCP server itself | Streamable HTTP, read-only |
| `Link:` headers | RFC 8288, on every route | Set in `public/_headers` |

## Editing SKILL.md

The skills index carries a SHA-256 of the skill file, and a client that
fetches the skill verifies it against that hash. **Change SKILL.md and the
digest must be regenerated**, or the skill fails verification and is silently
discarded.

```bash
node -e "const c=require('crypto'),f=require('fs');\
const p='public/.well-known/agent-skills/beunconventionalhq-content/SKILL.md';\
const i='public/.well-known/agent-skills/index.json';\
const j=JSON.parse(f.readFileSync(i,'utf8'));\
j.skills[0].digest='sha256:'+c.createHash('sha256').update(f.readFileSync(p)).digest('hex');\
f.writeFileSync(i,JSON.stringify(j,null,2)+'\n');console.log(j.skills[0].digest)"
```

`scripts/agent-discovery.test.mjs` fails if the digest is stale, so `npm test`
catches this. It is a test rather than a build step on purpose: silently
rewriting a published hash during a build would defeat the point of publishing
one.

## Two documents that were deleted rather than filled in

`/.well-known/openid-configuration` and `/.well-known/oauth-protected-resource`
used to exist and advertised `/oauth/authorize` and `/oauth/token`. Neither
endpoint has ever existed on this site.

They are gone rather than emptied. A **404 on a `.well-known` path is a clean
"this site does not do that"**, which is exactly right here. A file that
answers 200 and names endpoints that 404 is worse than nothing: an agent
commits to a flow, then discovers it is broken by failing at it.

Do not recreate them unless an OAuth server actually exists. The test suite
fails if they come back.

## Task 4, DNS-AID: NOT DONE, and it cannot be done from the repo

This is the only open item in #192. It needs Cloudflare dashboard access and
touches the zone, so it is yours to run.

**1. Enable DNSSEC** on `beunconventionalhq.com`.
Cloudflare dashboard → the zone → DNS → Settings → DNSSEC → Enable. Cloudflare
gives you a DS record; that record has to be added at your **registrar**, not
in Cloudflare, or the chain of trust does not complete. Propagation is
typically minutes but can take up to a day.

**2. Add the discovery records.** As #192 describes them:

```
_index._agents.beunconventionalhq.com.  IN HTTPS 1 beunconventionalhq.com. alpn="h2"
_a2a._agents.beunconventionalhq.com.    IN HTTPS 1 beunconventionalhq.com. alpn="h2"
```

ServiceMode (priority >= 1) rather than AliasMode, pointing at the host that
serves `/.well-known/`.

**3. Verify:**

```bash
dig +dnssec _index._agents.beunconventionalhq.com HTTPS
dig +short DS beunconventionalhq.com @1.1.1.1     # non-empty once the registrar has it
```

The `ad` flag in the dig response is what tells you the answer is
authenticated rather than merely present.

**One caveat before you spend time on it.** I could not reach the DNS-AID
specification from the build environment to check these record shapes against
it, so the syntax above is transcribed from the ticket rather than verified.
Confirm it against the spec before publishing, because a malformed SVCB record
is not a no-op: resolvers will serve it and agents will try to use it.

## Verifying the rest after a deploy

```bash
curl -sI https://beunconventionalhq.com/ | grep -i '^link:'
curl -s https://beunconventionalhq.com/.well-known/api-catalog | head
curl -sI https://beunconventionalhq.com/.well-known/api-catalog | grep -i content-type
curl -s -X POST https://beunconventionalhq.com/api/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | head -c 300
```

One thing the local suites cannot check: **CORS preflight**. `astro preview`
answers `OPTIONS` from its own middleware before the worker route runs, so the
route's handler is never exercised locally even though it is present in
`dist/server`. Check it against the real deploy:

```bash
curl -sI -X OPTIONS https://beunconventionalhq.com/api/mcp | grep -i access-control
```

Expect `Access-Control-Allow-Origin: *`. If it is missing, browser-based
agents cannot call the MCP endpoint cross-origin, though server-side ones are
unaffected because CORS is a browser rule.
