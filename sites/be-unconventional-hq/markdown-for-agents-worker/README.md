# Markdown for Agents Worker

A free Cloudflare Worker that converts your site's HTML to Markdown when an AI agent requests it with `Accept: text/markdown`. This satisfies the Agent Readiness "Content Accessibility" check without needing a Pro plan.

## How it works

1. A request comes in to your site
2. If the request has `Accept: text/markdown` in the headers, the Worker fetches the HTML from your origin, converts it to Markdown, and returns it
3. For all normal browser requests, it passes through unchanged

## Deploy

```bash
# Install wrangler if you haven't
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy
wrangler deploy
```

## Verify it works

```bash
curl -H "Accept: text/markdown" https://beunconventionalhq.com/
```

You should get Markdown back instead of HTML.

## Cost

Free. Workers on the Free plan include 100,000 requests/day.
