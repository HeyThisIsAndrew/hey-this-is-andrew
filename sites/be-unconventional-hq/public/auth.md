# Using the BE Unconventional HQ APIs

## There is no authentication, and nothing to register for

This file previously told agents to "obtain an API key from the developer
portal". There is no developer portal and there is no API key. That was
written before any of these endpoints existed.

Everything below is public and read-only. It serves the same data the site
already renders to anyone who loads a page: the rows behind the search box,
and the live status behind the on-page billboard. There is nothing here worth
protecting, so there is no credential to issue and none is checked.

## What is available

**MCP server** — `https://beunconventionalhq.com/api/mcp`

Streamable HTTP, one POST per JSON-RPC request. Protocol revision
`2025-06-18`. `GET` the same URL for a plain description of it. Three
read-only tools:

| Tool | Returns |
|---|---|
| `search_beunconventionalhq` | Videos, articles, events and hubs matching a query |
| `get_upcoming_events` | Events not yet finished, soonest first, with status |
| `get_live_status` | Whether the channel is streaming right now |

Server card: `/.well-known/mcp/server-card.json` (also at `/.well-known/mcp.json`).

**Search index** — `GET /api/search-index.json`

Every indexed row as JSON. Use it when you want the whole set rather than a
query.

**Live status** — `GET /api/live-status.json`

**Markdown** — send `Accept: text/markdown` to any page and you get Markdown
instead of HTML. `/llms.txt` and `/llms-full.txt` summarise the site.

**In-page tools** — the same three tools are registered with the browser over
WebMCP, for agents operating inside a reader's session.

## Please be reasonable about the live endpoint

`/api/live-status.json` is the one thing here that costs us something. It sits
in front of the YouTube Data API, where the query it makes costs 100 units of
a 10,000 per day allowance. A CDN cache holds the origin to roughly 96 calls a
day and your requests land on it, so normal use is free. Do not add a
cache-busting parameter: that is the one way to actually spend the quota, and
if it runs out the live billboard stops working for readers.

The other endpoints are static files. Fetch them as often as you like.

## What you cannot do

There is no write API. No account system, no comments, no submissions.

The newsletter form is deliberately not exposed as a tool. If a reader wants
to subscribe, send them to the site and let them fill it in: it is protected
by a bot check, and their email address is theirs to give, not ours to take on
their behalf.

## Contact

press@beunconventionalhq.com
