# THE HQ DISPATCH: the weekly newsletter

Issue #266. Sent from Kit (formerly ConvertKit), fed by `/dispatch.xml`.

## How it fits together

```
src/data/articles.json ─┐
src/data/videos.json  ──┼─> selectDispatchEntries() ──> /dispatch.xml ──> Kit RSS (weekly digest)
                        │   (src/lib/dispatch-feed.ts)        │                  │
                        │                                     │   post-template.liquid.html
                        └─> sync-dispatch-images.mjs          │   renders the story boxes
                            composes each story's art ────────┘                  │
                            into public/dispatch/images/                         v
                                                              template.html (the email shell)
```

## Files

| File | What it is |
| --- | --- |
| `email/hq-dispatch/template.html` | The email shell. Paste into Kit > Send > Email Templates > New > **HTML**. |
| `email/hq-dispatch/post-template.liquid.html` | The FEATURED and LATEST FROM THE HQ story boxes. Paste into the RSS broadcast's **Post** content block > Post Template (HTML). |
| `email/hq-dispatch/mockup.html` | Both rendered with five real stories. Open in a browser to review. **Generated**: `node scripts/hq-dispatch-render.mjs`. |
| `src/pages/dispatch.xml.ts` | The feed Kit reads: `https://beunconventionalhq.com/dispatch.xml` |
| `src/lib/dispatch-feed.ts` | What the feed lists and what each item carries |
| `scripts/sync-dispatch-images.mjs` | Builds each listed story's image. `npm run sync:dispatch-images -- --execute`. Runs in CI after every article and YouTube sync. |
| `scripts/dispatch-image.mjs` | The image composer (the "never cut off" rule lives here) |
| `scripts/build-dispatch-art.mjs` | Renders the header and the fallback art. `npm run build:dispatch-art`, only when the design changes. |
| `public/dispatch/` | `header-1200x400.png`, `fallback-1200x675.jpg`, and `images/` (one JPEG per story) |
| `src/data/dispatch-images.json` | Source image URL to composed file |
| `scripts/hq-dispatch-email.test.mjs`, `scripts/dispatch-feed.test.mjs` | Offline guards, both in `npm test` |

## Design language

It's the site's, translated into email-safe HTML. No Astro or Tailwind markup
is copied; the values are.

| Site token | Value | In the email |
| --- | --- | --- |
| `--color-black` | `#0a0a0a` | Page ground |
| `--color-surface` | `#111111` | Every story box (the About page's `.stat-card`) |
| hairline `rgba(255,255,255,0.05)` | `#1d1d1d` | Box borders and rules, flattened because Outlook ignores rgba |
| `--color-accent` | `#cc0000` | **The brand red.** Every fill, rule, border and glow, the button outlines and the big "HQ". |
| `--color-accent-text` | `#ef4444` | Red **small text** only (kickers, labels) and every hover. `#cc0000` is 3.21:1 on `#111111` and fails WCAG AA at label size; the site makes the same split in `theme-red.css`. |
| `--color-white` | `#f0f0f0` | Headlines |

- **Story boxes**: `#111111` with a 1px hairline, red border on hover where hover exists.
- **FEATURED** opens on its image at the full width of the box, always (a story with no art gets the fallback, below).
- **LATEST** rows put a 16:9 thumbnail beside the text, **centred vertically** on it; they stack on a phone.
- **Button**: the site's `.cta-button-primary`, a `#cc0000` outline around white uppercase type, filling red on hover. 48px tall, full width on a phone.
- **Section headings**: the `PageTitle` lockup (red spaced kicker, heavy uppercase title, a red "HQ" tucked under it).
- **Brand glow**: `radial-gradient`s of `rgba(204,0,0,…)` over a solid `bgcolor`, so Outlook desktop shows plain dark.
- **Header image**: the logo and a Syne "THE HQ / DISPATCH" lockup, rendered by headless Chrome, because the email itself can't load web fonts. Elsewhere the email uses the system font at weight 800 to 900.

### Links

Every link rests the way its counterpart on the site rests, and **turns red
on hover** (owner's call). Hover works where the client supports it (Apple
Mail, Outlook.com, Gmail on the web); phones have no hover.

| Link | At rest (as on the site) | Hover |
| --- | --- | --- |
| Section links, top bar | Navbar: `#c6c6c6` (`rgba(245,245,245,0.8)` flattened) | `#ef4444` with a red line under it, like the navbar |
| Footer socials, preferences, unsubscribe | Site footer: `#888888` | `#ef4444` (the site's footer goes white; the email goes red) |
| A link inside text | Article link: white on a `#cc0000` underline | `#ef4444` |
| Story headlines | White | `#ef4444` |
| "Read the story ›" | Red | `#ff1a1a` (`--color-accent-hover`, like the navbar's `.cta`) |

### Footer

"BE YOURSELF. BE PASSIONATE. BE UNCONVENTIONAL.", then "WHERE NERD CULTURE
GETS CINEMATIC." in capitals, then "There's more every day at
beunconventionalhq.com." on its own line. Socials in two rows of three:
YouTube, Instagram, TikTok / Bluesky, Letterboxd, Threads. **No X**: the
owner doesn't promote it in the newsletter, and the test fails if it comes
back. Address: **Anaheim, CA 92805**, typed into the template.

## Images are never cut off

The owner's rule, and the reason for most of the machinery above.

The email's image boxes are 16:9. Story art isn't always 16:9 (L.A. Comic
Con's is 1.9:1, some Substack art is square). So each image is **composed
ahead of time** into a 1200x675 JPEG with the **whole picture fitted inside**,
and the space around it filled with a blurred, darkened copy of the same
picture: the treatment the event stage already uses on the site. A 16:9
source fills the frame exactly.

The one thing ever trimmed is YouTube's baked-in black bars on its 4:3
renditions (`hqdefault` and the like), and only those, only on
`i.ytimg.com` URLs. Every video in the store today has a 16:9
`maxresdefault`.

In the email, the image rule is `object-fit: contain`, never `cover`, so
even a wrongly shaped image would letterbox rather than crop. The tests
check both: the composer keeps all four edges of a wide and a tall test
image, and no `object-fit: cover` exists anywhere in the email.

**A story with no built image gets the fallback art** (`fallback-1200x675.jpg`,
the logo on the brand ground), never no image and never the raw original.
That keeps the FEATURED box opening on a full-width picture every time.

**Images are never deleted.** A sent email points at its images for as long
as it sits in an inbox, so `sync-dispatch-images.mjs` never prunes, unlike
the article-image sync. About 75 KB a story.

## Setting it up in Kit

1. **Template.** Kit > Send > Email Templates > New > HTML. Paste `template.html`. Save.
2. **RSS feed.** Kit > Automate > RSS > add `https://beunconventionalhq.com/dispatch.xml`. Choose **digest** mode, weekly, on the day and time you want.
3. **Broadcast body.** In the RSS broadcast, pick the HQ Dispatch template. Keep the **Post** content block (Kit won't enable the feed without it). Open its Post Template tab, switch to HTML, paste `post-template.liquid.html`.
4. **Preview text** goes in the broadcast's preview text setting.

The site must be deployed (with this change) before Kit reads the feed: the
header, fallback and story images are served from the site.

## Liquid and RSS notes

### Kit tags in `template.html`

| Tag | Notes |
| --- | --- |
| `{{ message_content }}` | Required. The Post Template's output lands here. |
| `{{ unsubscribe_url }}` | Required (or `unsubscribe_link`). Only ever as an `href`. |
| `{{ subscriber_preferences_url }}` | Optional; kept so readers can change what they get instead of leaving. |
| physical address | Required, as `{{ address }}` **or typed**. It's typed: "Anaheim, CA 92805". |

**Never write a Kit tag, braces and all, inside an HTML comment in
`template.html`.** Kit runs Liquid over the whole file, comments included.
The first draft named the tags in its header note, the broadcast was rendered
into the comment, and the page broke. The test fails if one comes back.

### Kit variables in `post-template.liquid.html`

| Variable | From the feed | Used for |
| --- | --- | --- |
| `posts` | new items since the last send | The loop, `limit: 6`: one FEATURED, up to five LATEST |
| `post.title` | `<title>` | Headline and image alt text |
| `post.url` | `<link>` | Image, headline and button links |
| `post.summary` | `<description>` | Summary |
| `post.categories` | `<category>` x2 | Label "TYPE \| SECTION"; `Video` makes the button **Watch now** |
| `post.content` | `<content:encoded>` | **The image**: the first `<img src="…">` |

**Kit has no image variable** (its RSS fields are title, author, date,
categories, url, summary and content). So the feed puts the image first in
`content:encoded` and the Post Template splits on the first `src="`.

### What `/dispatch.xml` provides

`/rss.xml` is left alone: it's the Google News feed. `/dispatch.xml` lists
the **20 newest** stories, articles and long-form videos together (no shorts,
no live streams). Kit makes the first new one FEATURED, so the newest story
leads. Each item:

| Element | Value |
| --- | --- |
| `<title>` | The story title |
| `<link>` | Article: `https://beunconventionalhq.com/intel/<slug>` (no trailing slash). Video: its YouTube watch URL; the site has no per-video page. |
| `<description>` | The editorial summary (`editorialPreview()`, the same text the site's cards use) |
| `<pubDate>` | Publish time |
| `<category>` | Content type (`Review`, `Analysis`… or `Video`), then section (`Film`, `TV`, `Games`, `Events`; omitted when "General") |
| `<content:encoded>` | `<img src="https://beunconventionalhq.com/dispatch/images/<id>.jpg" width="1200" height="675" alt="">` then the summary |

## Assets

All hosted on the site; nothing to host by hand.

| Asset | Where |
| --- | --- |
| Header, 1200x400 | `public/dispatch/header-1200x400.png`, referenced absolutely from `template.html`. To use other art, replace that URL with any absolute https URL to a 1200x400 image. |
| Fallback art, 1200x675 | `public/dispatch/fallback-1200x675.jpg` |
| Story images, 1200x675 | `public/dispatch/images/`, built by the sync |
| Address | Typed in the template: Anaheim, CA 92805 |

**On the address:** US anti-spam law (CAN-SPAM) asks for a valid physical
postal address: a street address, a PO box, or a registered private mailbox.
City and ZIP alone may not count. If Kit or a mailbox provider objects, a PO
box in Anaheim is the usual fix, typed on that same line.

## Testing checklist

Send test broadcasts from Kit to real inboxes. Litmus or Email on Acid covers
more clients faster.

**Kit itself**
- [ ] Kit accepts the template on save (the address is typed, so Kit's own address check should pass on the text).
- [ ] **The Post Template keeps the tables.** View the source of a test email. If Kit strips `<table>` or the `class` attributes, the boxes break. The one thing that can't be tested offline.
- [ ] The feed validates in Kit and the first digest lists this week's stories, newest as FEATURED.
- [ ] `limit: 6`, `forloop`, `contains`, `split` and `truncatewords` render (standard Liquid; confirm Kit's build has them).
- [ ] A title with `&` or a curly apostrophe shows once, not as `&amp;` or `â€™`.
- [ ] Unsubscribe and Update preferences work on a test subscriber.

**Gmail (web, iOS, Android)**
- [ ] Not clipped ("[Message clipped]"). Gmail clips at 102 KB; five stories are about 50 KB before Kit's tracking. Re-measure before raising `limit: 6`.
- [ ] iOS dark mode: headlines and button text stay white.
- [ ] Web: links turn red on hover.
- [ ] A non-Google address in the Gmail app (it ignores `<style>`): layout holds, nothing scrolls sideways.

**Apple Mail (macOS, iPhone, iPad)**
- [ ] Light and dark appearance look the same.
- [ ] Red glow top right of the masthead.
- [ ] macOS hover: links red, box border red, button fills red.

**Outlook**
- [ ] Outlook desktop (classic): 600px column centred, boxes drawn, outline button intact, thumbnails centred vertically. Gradients are expected to be missing.
- [ ] New Outlook / Outlook.com dark mode: colours not re-mapped to grey.

**Phones, 320 to 430px**
- [ ] No horizontal scrolling at 320, 375, 390 and 430.
- [ ] Every image whole and 16:9: FEATURED full width, LATEST thumbnails full width above their text. Header 3:1.
- [ ] 44px tap targets.

**Images off**
- [ ] The header's alt text reads "THE HQ DISPATCH". Boxes keep their shape; headlines still link.

**Verified offline before handoff** (`npm test`, plus a build)
- Kit's required tags, no Liquid inside HTML comments, charset in the first 1024 bytes, the typed address.
- `role="presentation"` on every table, alt on every image, no em dashes, no flex or grid, no X.
- Every text link has a site resting state and a red hover.
- The Liquid rendered by liquidjs: FEATURED first, six boxes at most, 16:9 images, the Video button, the fallbacks, thumbnails centred vertically.
- The composer keeps all four edges of a wide and a tall image and trims only YouTube's letterbox bars; every committed story image is 1200x675.
- `/dispatch.xml` built: 20 items, each with its composed image first in `content:encoded`.
- In a browser at 320 and 375px, with and without `<style>`: no sideways scroll, every image 16:9, header 3:1.
