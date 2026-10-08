# Logo assets: the spec

The `logo` field on an `event` or `featuredBrand` document. Every number
below is read off a real render site, not chosen — the table in
"Where a logo renders" is the derivation.

## The spec

| | |
|---|---|
| **Minimum width** | **760px** |
| **Minimum height** | **520px** |
| **Recommended** | 1200px on the long edge, both floors met |
| **Format** | PNG with alpha. SVG also fine (see below) |
| **Background** | Transparent. Never a colour fill, never a card |
| **Padding** | **None.** Crop hard to the ink, all four sides |
| **Colour** | Must read on near-black (#111 and darker artwork) |
| **Weight** | Under ~500KB. Sanity re-encodes on delivery |

There is no required aspect ratio. The layouts already carry marks from
0.73 (The Game Awards, portrait) to 2.99 (TwitchCon, a wide wordmark) and
handle both.

## The rule that actually matters: no padding

`object-fit: contain` fits the FILE's box, not the ink inside it. Any
transparent margin baked into the file becomes visible offset on the page
and shrinks the mark, and no CSS can recover from it.

This is what made the BlizzCon logo look wrong on the /events hero: the
file is 1920x1080 with the shield floating in the middle, so the `<img>`
sat flush-left at the card's padding edge while the shield appeared ~85px
inboard of the countdown beneath it. The element was aligned. The artwork
was not.

**The tell:** if the logo's dimensions match its own `heroImage`'s
dimensions, somebody has almost certainly uploaded key art into the logo
slot. Two documents match that pattern today.

## Where a logo renders, and what each site asks for

The floors above are the largest ask in each axis.

| Site | Requests from Sanity | Rendered at most |
|---|---|---|
| Hub stage mark (`/featured`, `/featured/[slug]`) | `height(520)` | 62% width, 78% height of the stage |
| Hub stage ghost (the blurred plate behind it) | `height(300)` | full-bleed, blurred past detail |
| `/events` spotlight hero (`.fe-logo`) | srcset `200 / 320 / 480 / 760` | 130px tall, 380px wide |
| Event page hero + hub hero (`.hero-logo`) | `height(320)` | 180px tall, 420px wide |
| `/featured` deck card + nav thumb | `height(120)` | small |
| Event card, list and archive (`.past-event-media`) | srcset `96 / 160 / 240` | 130px box (90px under 560px) |
| Related-hub rail card (`.rail-hub-logo`) | `height(120)` | 34px tall |

So: **760px** is the top srcset step on the spotlight hero, and **520px**
is the stage mark's request. Below either, Sanity upscales and the mark
goes soft on exactly the two surfaces where it is largest.

A wide wordmark meets the 520px height floor long before the width floor
bites; a portrait mark is the reverse. Meeting both is the whole rule.

## On SVG

Works, and scales perfectly. The caveat is that Sanity's image pipeline
does not transform SVG, so `.height(520)` and `.auto('format')` are
no-ops — the raw file is served and the CSS constrains it. That is fine,
and for a flat vector mark it is the better choice. One brand ships this
way today (`disney-plus`).

## Colour on dark

Every surface a logo lands on is dark: the hero sits over artwork with a
scrim, the cards are #111. A dark-on-transparent mark disappears.

Use the brand's white or light monochrome lockup where one exists. Full
colour is fine when it carries its own contrast — Marvel's red block, PAX
blue, the PlayStation blue all read cleanly. Avoid black wordmarks with no
outline.

## Current state

Generated from `src/data/videos.json`. Re-run the audit after a batch:

```
node -e '
const d=require("./src/data/videos.json");
const ref=(f)=>f?.asset?._ref||f?._ref||(typeof f==="string"?f:null);
const parse=(r)=>{const m=/image-[a-f0-9]+-(\d+)x(\d+)-(\w+)/.exec(r||"");return m?{w:+m[1],h:+m[2],ext:m[3]}:null;};
const MINW=760, MINH=520;
for (const t of ["event","featuredBrand"]) d.filter(x=>x._type===t).forEach(e=>{
  const L=parse(ref(e.logo)), H=parse(ref(e.heroImage));
  const s=e.slug?.current||e._id;
  if(!L) return console.log("MISSING       ", s);
  if(L.ext==="svg") return;
  if(H&&L.w===H.w&&L.h===H.h) return console.log("KEY ART?      ", s, `${L.w}x${L.h}`);
  if(L.w<MINW||L.h<MINH) console.log("TOO SMALL     ", s, `${L.w}x${L.h}`);
});'
```

### Replace: key art in the logo slot

- `blizzcon-2026` — 1920x1080, same as its heroImage
- `new-york-comic-con-nycc-2026` — 5000x2211, same as its heroImage

### Replace: too small, will upscale

- `l-a-comic-con-2026` — 300x133
- `the-game-awards-2026` — 354x484
- `avengers-doomsday-premiere` (Avengers: Doomsday) — 420x180
- `sdcc-2026` — 500x618
- `sdcc-2027` — 500x618
- `twitchcon-san-diego-2026` — 1140x381 (height only)
- `dc-comics` (brand) — 313x313

### Missing entirely

`game-developers-conference-gdc-2026`, `sxsw-2026`, `wondercon-2027`,
`summer-game-fest-2027`, `anime-expo-2027`, `oscars-2027`

These fall back to the BE Unconventional mark on cards, which is why the
archive shows our own logo against somebody else's event.

### Fine, leave alone

All four PAX events (2550x1909), `d23-2026` (8334x3743), and every brand
hub except `dc-comics` — the streaming and studio set is a consistent
1080x1080, which is the shape to copy.
