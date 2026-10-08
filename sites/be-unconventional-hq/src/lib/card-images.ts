/*
  Thumbnail sizing for content cards.

  A card's media box is never larger than ~360 CSS px (4-up desktop grid capped
  at 1536px) and is 42vw on phones, but the sources arrive at full size:
  YouTube hands us `maxresdefault.jpg` at 1280x720, and Substack hands us the
  original upload, commonly 2048x1152. Shipping those into a 164px-wide phone
  card is most of a megabyte of waste per screen.

  This module maps a raw thumbnail URL to a `src` plus a `srcset`, so the
  browser picks by viewport AND pixel density instead of us guessing one
  resolution for every device. Guessing one is what the first pass did, and it
  traded a visibly soft image on desktop retina for the mobile saving.

  Pure string work, no I/O — see scripts/card-images.test.mjs.
*/

export interface CardImageSources {
  /** Fallback for browsers ignoring srcset, and the `src` attribute. */
  src: string;
  /** `srcset` value, or '' when only one rendition is safe to offer. */
  srcset: string;
}

/*
  ─── YOUTUBE ───────────────────────────────────────────────────────────────

  Rendition sizes are fixed by YouTube:

    mqdefault    320x180   16:9
    hqdefault    480x360   4:3, letterboxed
    sddefault    640x480   4:3, letterboxed
    maxresdefault 1280x720 16:9

  The 4:3 ones carry baked-in black bars. That is survivable here — and only
  here — because `.content-card-img` is `object-fit: cover` inside a 16:9 box,
  so cropping 4:3 to 16:9 removes exactly the bars and nothing else. The
  descriptor is still the true width (cropping takes height, not width), so
  the `w` values below are honest.

  maxresdefault is NOT generated for every video — only uploads at 720p or
  better have one, and requesting a missing rendition yields YouTube's grey
  120x90 placeholder. So it is offered ONLY when the incoming URL already
  named it, which is proof it exists. Never synthesise it from a lower one.
*/
const YT_HOST = 'i.ytimg.com';
const YT_RENDITION = /\/(maxresdefault|sddefault|hqdefault|mqdefault|default)\.jpg/;

/** Intrinsic width of each rendition. The proxy ladder is capped against
 *  `maxresdefault` here so it cannot ask for pixels the source has not got. */
const YT_WIDTHS: Record<string, number> = {
  mqdefault: 320,
  hqdefault: 480,
  sddefault: 640,
  maxresdefault: 1280,
};

function youtubeSources(url: string): CardImageSources {
  const match = url.match(YT_RENDITION);
  if (!match) return { src: url, srcset: '' };

  const current = match[1];

  // Only maxresdefault proves a high-res rendition exists. Anything else is
  // left exactly as it came in: downgrading a small one saves nothing and
  // upgrading it risks the placeholder.
  if (current !== 'maxresdefault') return { src: url, srcset: '' };

  /*
    CAPPED AT THE SOURCE. `maxresdefault` is 1280x720 and no bigger, so the
    1600 and 2000 rungs in WSRV_WIDTHS asked the proxy to UPSAMPLE it.
    Measured against the real service: w=1600 returned a genuine 1600x900 at
    210 KB and w=2000 a 2000x1125 at 282 KB, both visibly softer than the
    source and the larger of them HEAVIER than the 258 KB original this
    rewrite exists to avoid. A wide screen picked that rung, so the change
    made desktop worse while making mobile better.

    Same rule as `cappedWidths()` in local-content.ts, and the same one
    `buildImageSet` documents: never ask a CDN for more pixels than the asset
    has. The cap is passed rather than applied to WSRV_WIDTHS itself, because
    that ladder also serves sources which really are larger than 1280.
  */
  /*
    ─── `src` STAYS hqdefault. THE RECOVERY DEPENDS ON IT. ───────────────────

    The client-side recovery in Layout.astro builds its candidate list from
    the `srcset` ALONE, and says why: "youtubeSources() already puts the
    guaranteed hqdefault in `src` and offers maxresdefault only in `srcset`,
    so the risky rendition is the one the browser PICKED". That invariant is
    the whole design -- `src` is the floor it falls back TO, which is why it
    has to be a rendition YouTube generates for every video.

    Putting a proxied maxresdefault in `src` broke it silently. An image that
    ends up with no srcset then has a risky `src`, an empty candidate list and
    nothing to recover to, so a missing rendition stays on screen as the grey
    placeholder. Measured: scripts/e2e-image-fallback.test.mjs goes 5/5 on
    main to 3/5 with that change, and the failure reads "11 placeholder(s) but
    only 10 marked".

    So the ladder is offered where it belongs and the floor is left alone. The
    browser still picks a proxied rendition for the LCP win; if that turns out
    to be the placeholder, the recovery drops the srcset and lands on the
    hqdefault that was in `src` the whole time.
  */
  /* The top rung is the original maxresdefault, not a proxied re-encode of it
     at the same width. Only one: a srcset with two candidates at the same
     `w` is a parse error and the browser drops the second, so appending the
     original after the proxy's 1280w rung made it dead weight. */
  const top = YT_WIDTHS.maxresdefault;
  const proxied = (genericExternalSources(url, top).srcset ?? '')
    .split(', ')
    .filter((c) => c && !c.endsWith(` ${top}w`))
    .join(', ');
  return {
    src: url.replace(YT_RENDITION, '/hqdefault.jpg'),
    srcset: proxied ? `${proxied}, ${url} ${top}w` : `${url} ${top}w`,
  };
}

/*
  ─── THE RENDITION THAT ALWAYS EXISTS ──────────────────────────────────────

  srcset has NO fallback semantics. Once the browser has picked a candidate,
  a dead candidate is a dead <img> — it does not retry a neighbour. So when
  the `maxresdefault` offered above turns out not to exist, the whole element
  fails and Layout.astro's fail-safe paints a branded panel over a video that
  has a perfectly good thumbnail one rendition down.

  Two different ways it turns out not to exist, and they need different
  detection (see Layout.astro):

    404          the plain missing case, fires an `error` event
    HTTP 200 +   YouTube answers some missing renditions with its grey 120x90
    placeholder  "no thumbnail" graphic instead, which fires `load`

  `hqdefault` is the recovery target for both: YouTube generates it for every
  video, live or not, and it is what `youtubeSources()` already puts in `src`.

  Exported so the client-side recovery cannot drift from the build-time
  rewrite — they must agree on which rendition is the safe one, and the
  string surgery is identical either way. Pure, so it is testable offline.
*/

/** Renditions that already ARE the safe one, or are below it. */
const YT_SAFE_RENDITIONS = new Set(['hqdefault', 'mqdefault', 'default']);

/**
 * The always-present rendition for a YouTube thumbnail URL, or `''` when
 * there is nothing safer to fall back to — not a YouTube URL, or already at
 * or below `hqdefault`. An empty return means "stop, this one is final".
 */
export function youtubeFallbackSrc(raw: unknown): string {
  let url = String(raw ?? '').trim();

  // If wrapped in wsrv.nl proxy, extract the original URL
  if (url.includes('wsrv.nl/?url=')) {
    try {
      const matchUrl = url.match(/url=([^&]+)/);
      if (matchUrl) {
        url = decodeURIComponent(matchUrl[1]);
        if (!url.startsWith('http')) url = `https://${url}`;
      }
    } catch (e) {
      // Ignore
    }
  }

  if (!url || !url.includes(YT_HOST)) return '';

  const match = url.match(YT_RENDITION);
  if (!match) return '';
  if (YT_SAFE_RENDITIONS.has(match[1])) return '';

  return url.replace(YT_RENDITION, '/hqdefault.jpg');
}

/*
  ─── SUBSTACK ──────────────────────────────────────────────────────────────

  Substack proxies through Cloudinary:

    https://substackcdn.com/image/fetch/<transforms>/<url-encoded original>

  where <transforms> is a comma-separated list such as
  `$s_!qfD6!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep`.

  The first pass rewrote this with `.replace(/w_\d+/, 'w_600')`, which assumed
  every URL already carries a width. Measured against src/data/articles.json:
  of 11 proxied URLs only 5 have a `w_`, and NONE have an `h_` — so the width
  rewrite missed 6 of 11 (those cards kept loading the full 2048x1152 upload)
  and the companion `.replace(/h_\d+/, 'h_338')` never once matched.

  Width therefore has to be INSERTED when absent, not just replaced. `c_limit`
  is inserted with it: it bounds the image by the given width and never scales
  up or crops, so an original narrower than the request is passed through
  untouched rather than upsampled. No height is set at all — the card box
  fixes the aspect and `object-fit: cover` does the cropping, so pinning a
  height only risks fighting the source's real ratio.
*/
const SUBSTACK_FETCH = 'substackcdn.com/image/fetch/';

/**
 * Is this a Substack CDN fetch URL, i.e. one substackSources() can rewrite?
 *
 * Exported for the article hero, which needs the substackcdn branch of
 * getCardImageSources() and must NOT be allowed to reach the
 * genericExternalSources() branch below. That branch routes through wsrv.nl,
 * and a cold third-party transcode on the LCP element is the exact thing that
 * was reverted once already — see the header of src/lib/article-images.ts.
 * Calling this first keeps the hero on Substack's own warm CDN or on the raw
 * URL, never on a proxy.
 */
export function isSubstackFetchUrl(raw: unknown): boolean {
  return String(raw ?? '').includes(SUBSTACK_FETCH);
}

/*
  A NOTE ON THE COMMAS, because they look like a bug and are not.

  Every candidate URL below contains commas, and ',' is the srcset candidate
  separator — so this looks unsafe, and the HTML spec's advice to
  percent-encode commas in srcset URLs invites "fixing" it with %2C. Do not.

  The srcset grammar collects a URL as a run of NON-WHITESPACE characters, so
  an embedded comma belongs to the URL and only ", " separates candidates. The
  spec's warning is about URLs that END in a comma; these end in `.jpeg`.
  Verified in Chromium against these exact URLs: with a sentinel `src` proving
  it was selection rather than fallback, the intended candidate was chosen and
  fetched with its commas intact.

  Percent-encoding them would be the actual regression — Cloudinary parses the
  transform segment by literal commas, so `%2C` would arrive as one unreadable
  transform rather than a list.
*/

/** Rendition widths offered to the browser, smallest first. */
/*
  Up to 2000 because the cards grew. A featured tile is 860px on a 4K display,
  which is ~1720 device pixels on a 2x screen, and a ladder stopping at 1200
  means the browser picks 1200 and upscales it 1.4x. Substack originals are
  commonly 2048 wide, so the top of this ladder costs nothing to offer and the
  browser only fetches it on a screen that can actually use it.
*/
/* 800 for the same reason WSRV_WIDTHS has one: the 600->900 gap is exactly
   where a phone lands. PageSpeed flagged a Substack card on the homepage at
   840x473 delivered for a displayed 678x356, worth 21.0 KiB, and 678 has no
   rung between 600 and 900 to take. */
const SUBSTACK_WIDTHS = [400, 600, 800, 900, 1200, 1600, 2000];

/** Width used for the plain `src` — covers a phone card at 2x. */
const SUBSTACK_SRC_WIDTH = 600;

function substackSources(url: string): CardImageSources {
  const index = url.indexOf(SUBSTACK_FETCH);
  if (index === -1) return { src: url, srcset: '' };

  const prefix = url.slice(0, index + SUBSTACK_FETCH.length);
  const rest = url.slice(index + SUBSTACK_FETCH.length);

  /*
    The encoded original is everything from the first '/' onward, and it is
    percent-encoded (`https%3A%2F%2F...`), so its own slashes cannot be
    confused for this separator. Splitting on the first '/' keeps the rewrite
    strictly inside the transform list — a naive whole-string regex could
    match digits inside the original's filename, e.g. `..._2048x1152.jpeg`.
  */
  const slash = rest.indexOf('/');
  if (slash === -1) return { src: url, srcset: '' };

  const transforms = rest.slice(0, slash).split(',').filter(Boolean);
  const original = rest.slice(slash);

  const withWidth = (width: number) => {
    const out: string[] = [];
    let sawWidth = false;

    for (const part of transforms) {
      if (/^w_\d+$/.test(part)) {
        out.push(`w_${width}`);
        sawWidth = true;
      } else if (part === 'c_limit') {
        // Re-added below in a known position; drop it here to avoid a dupe.
      } else if (part === 'q_auto:good' || part === 'q_auto') {
        out.push('q_auto:eco');
      } else {
        out.push(part);
      }
    }

    if (!sawWidth) out.push(`w_${width}`);
    out.push('c_limit');

    return `${prefix}${out.join(',')}${original}`;
  };

  return {
    src: withWidth(SUBSTACK_SRC_WIDTH),
    srcset: SUBSTACK_WIDTHS.map((w) => `${withWidth(w)} ${w}w`).join(', '),
  };
}

/** Rendition widths for generic external proxy, smallest first. */
/* Same reasoning as SUBSTACK_WIDTHS above: the cards are large enough now that
   a 1200px ceiling is an upscale on a 2x 4K display.

   ─── 800 EXISTS BECAUSE OF THE 600→900 GAP ON A PHONE ─────────────────────

   A phone lands between the two rungs and therefore always took the 900.
   PageSpeed Insights on the live homepage, emulating a Moto G Power
   (412 CSS px at DPR 1.75 = 721 device px), flagged three images for it:

     spotlight-art, banner variant   900x417 delivered for 721x405   17.9 KiB
     content-card-img               900x506 delivered for 647x364   16.0 KiB
     content-card-img               900x506 delivered for 647x364   14.6 KiB

   all with the same note: "This image file is larger than it needs to be ...
   Use responsive images to reduce the image download size." One rung at 800
   covers every one of them, and the common DPR-2 widths under it (360x2=720,
   390x2=780), without inventing a rung per device.

   ONE rung, not three. Every width here is a distinct wsrv.nl URL and
   therefore a distinct cold transcode the first time anyone asks for it — see
   the note at the top of src/lib/article-images.ts for what a cold proxy costs
   on a real phone. A finer ladder trades a warm-cache saving for a cold-cache
   penalty, so the ladder stays coarse and only closes the gap that measurement
   actually showed. */
const WSRV_WIDTHS = [400, 600, 800, 900, 1200, 1600, 2000, 2400, 3840];

/** The ladder a source can actually fill: every rung at or below its own width.
 *  Never empty — a source narrower than the smallest rung still gets that one,
 *  because one slightly-too-large request beats no srcset at all. */
function widthsFor(capWidth?: number): number[] {
  if (!capWidth) return WSRV_WIDTHS;
  const fit = WSRV_WIDTHS.filter((w) => w <= capWidth);
  if (capWidth && !fit.includes(capWidth)) fit.push(capWidth);
  return fit.length ? fit : [WSRV_WIDTHS[0]];
}
const WSRV_SRC_WIDTH = 600;

function genericExternalSources(url: string, capWidth?: number): CardImageSources {
  // Only process absolute external URLs
  if (!/^https?:\/\//i.test(url)) return { src: url, srcset: '' };
  
  // Exclude our own domain if we somehow pass an absolute local URL
  if (url.includes('beunconventionalhq.com')) return { src: url, srcset: '' };

  // Instagram blocks wsrv.nl proxy (returns 403). Route it through our own proxy instead.
  if (url.includes('.cdninstagram.com')) {
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
    return { src: proxyUrl, srcset: '' };
  }

  // Strip protocol for wsrv.nl
  const urlWithoutProto = url.replace(/^https?:\/\//i, '');
  
  // q=85 for high photographic quality (prepping for Instagram), output=webp for modern format
  /*
    ─── `&we` IS LOAD-BEARING, NOT A TUNING FLAG ─────────────────────────────

    "Without enlargement": never return more pixels than the source has.

    It is here for the FALLBACK, not for bytes. YouTube answers a missing
    rendition with its grey 120x90 "no thumbnail" body at HTTP 200, and the
    recovery in Layout.astro detects that by its decoded size -- see the note
    on YT_SAFE_RENDITIONS above. Ask the proxy for w=600 without `&we` and it
    faithfully upscales that 120x90 body to 600x450, so the check can never
    fire and a video with no maxresdefault shows a stretched grey blob for
    ever instead of dropping to hqdefault. Measured both ways against the live
    service: 600x450 without, 120x90 with. `scripts/e2e-image-fallback.test.mjs`
    is what catches it.

    It also makes upscaling impossible in general, which is the same guarantee
    the width cap in youtubeSources() asks for. Keep both: the cap stops us
    REQUESTING pixels that do not exist, and this stops the proxy inventing
    them if a cap is ever missed.
  */
  const withWidth = (w: number) =>
    `https://wsrv.nl/?url=${encodeURIComponent(urlWithoutProto)}&w=${w}&output=webp&q=85&we`;

  return {
    src: withWidth(WSRV_SRC_WIDTH),
    srcset: widthsFor(capWidth).map((w) => `${withWidth(w)} ${w}w`).join(', '),
  };
}

/**
 * Map a raw card thumbnail URL to the sources a card should request.
 * Unrecognised external hosts are routed through a high-quality proxy (wsrv.nl)
 * to generate a responsive srcset, saving massive payload weight on mobile.
 */
export function getCardImageSources(raw: unknown): CardImageSources {
  const url = String(raw ?? '').trim();
  if (!url) return { src: '', srcset: '' };

  if (url.includes(YT_HOST)) return youtubeSources(url);
  if (url.includes(SUBSTACK_FETCH)) return substackSources(url);

  // Fallback for AWS S3 direct links, Substack YouTube thumbnails, Instagram, etc.
  return genericExternalSources(url);
}

/*
  `sizes` for the standard card grid, mirroring home-cards.css:

    <=560px   single column, the card FULL WIDTH of it

              This said 42vw, from when the card turned into a horizontal row
              below 560 and its media took `flex: 0 0 42%`. The cinematic
              refactor replaced that layout — every card is a vertical slate at
              every width now — but the `sizes` kept describing the old one.
              Measured at 375: the media box is 336px, 89% of the viewport,
              against a promised 157px. The browser fetched a 158px rendition
              and upscaled it 2.02x, on a phone, where it is most visible.
    <=1100px  two columns with a 1.25rem gap
    >1100px   four columns, container capped at 1536px, 1.5rem gaps
              -> (1536 - 3*24) / 4 = 366px, so 360px is the steady state

  Exported rather than inlined so the card markup and this module cannot drift
  apart — a `sizes` that disagrees with the CSS makes the browser pick the
  wrong rendition, which is the failure mode srcset exists to avoid.
*/
/*
  ─── THIS ONE STRING SERVES TWO DIFFERENT BOXES ────────────────────────────

  `CARD_IMAGE_SIZES` describes the 4-up card grid AND the feed's browse rows,
  and they are not the same width:

                       1536    1920    2240    2600   (--page-max)
    4-up grid card      366     462     542     632   ((container - 3 gaps) / 4)
    feed row card       320     380     440     500   (--feed-card)

  A `sizes` may safely over-state a box — the browser fetches a slightly larger
  rendition and the image is sharp. Under-stating it is the bug: it picks a
  smaller source and the card is visibly soft. So each step is the LARGER of
  the two consumers, rounded up.

  The widest match wins, so these run LARGEST FIRST. Written the other way round
  a `(min-width: 1536px)` earlier in the list swallows every wider screen and
  the 4K steps never apply — a silent soft-image bug, not an error.
*/
export const CARD_IMAGE_SIZES =
  '(max-width: 560px) 90vw, (max-width: 1100px) 47vw, ' +
  '(min-width: 3400px) 635px, (min-width: 2560px) 545px, (min-width: 1920px) 465px, ' +
  '(min-width: 1536px) 370px, 23vw';

/*
  ─── THE HERO CARD IS NOT IN THE CARD GRID ─────────────────────────────────

  `variant="hero"` renders ONE card in the left half of FeaturedHighlights, not
  as a tile in a four-up grid, and it was being described by the grid's `sizes`
  above. The numbers are nearly a factor of two apart, so the browser was
  honouring `(min-width: 1536px) 360px` and fetching a 360px rendition for a
  box measured at 768px: a 2.1x upscale, and the reason the Featured section
  looked soft. On a 2x display it is a 4x upscale.

  It is the exact failure the note above warns about — a `sizes` that disagrees
  with the CSS makes the browser pick the wrong rendition — reached by reusing
  the right string in the wrong place rather than by writing a wrong one.

  Measured against .fh-left, which is half of `.container-page` (max-width
  1536, 2rem gutters) and stacks to full width below 768px:

    <768px    stacked, one column        -> 90vw

              `calc(100vw - 4rem)` was the arithmetic for a 2rem gutter each
              side, which is right at the root's desktop size and wrong on a
              phone, where the root is 16px and the gutter is smaller. Measured
              at 375: the box is 333px against a promised 311px, a 1.07x
              upscale. 90vw covers it at every phone width without needing to
              know what the gutter resolves to.
    >=1536px  container capped at 1536   -> (1536 - 64) / 2 = 736px
    >=1920px  the container steps up too  -> measured 838px at 1920 and 823px
              at 3840 (the section carries its own cap, so it stops growing).
              850 covers both without over-fetching.
    else      half the viewport          -> 50vw, less its share of the gutters
*/
export const HERO_CARD_IMAGE_SIZES =
  '(max-width: 767px) 90vw, (min-width: 1920px) 850px, (min-width: 1536px) 736px, calc(50vw - 3rem)';

/*
  ─── AND THE FEATURED SHELF IS NOT IN THE CARD GRID EITHER ─────────────────

  The tentpole row's cards are `min(90vw, 560px)` — 75% wider than the 320px
  browse cards, so that the shelf reads as the thing to look at. The `sizes`
  did not follow: `CARD_IMAGE_SIZES` promises the browser `360px` above 1536,
  so it fetched a 360px rendition for a 560px box. A 1.56x upscale, 3.1x on a
  2x display, and the cards looked soft at exactly the size meant to show them
  off.

  This is the SECOND time the same mistake has been made — see the hero note
  above, where a 360px rendition went into a 768px box. Both times the cause was
  reusing a correct string somewhere it does not describe. A `sizes` is a claim
  about the CSS; change one and the other is already wrong.

  Mirrors `.feed-row--prestige .feed-row-item` in FeedGrid.astro exactly. The
  breakpoint is 622px because that is where 90vw stops being the smaller of the
  two (560 / 0.9).
*/
export const FEATURED_CARD_IMAGE_SIZES =
  '(max-width: 622px) 90vw, ' +
  '(min-width: 3400px) 860px, (min-width: 2560px) 760px, (min-width: 1920px) 660px, 560px';
