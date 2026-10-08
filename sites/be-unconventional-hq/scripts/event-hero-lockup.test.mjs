/*
  The event hero's lockup — the three mark slots, the metadata row's
  placement, and where "Event Details" actually goes.

  Offline. The two hero components are read as source, in the style of the
  other structural guards in this directory.

  ─── WHAT THIS FILE EXISTS TO STOP ─────────────────────────────────────────

  Three separate reports, all of them about the same corner of the page:

  1. "it just looks like I've got multiple of the same events". The hero
     renders a mark in THREE slots and all three read from `logo`, so PAX
     West, East, Aus and Unplugged — which share one PAX wordmark — were
     four visually identical heroes. `heroLogo` overrides the left slot.

  2. "metadata tag placement must never change". It changed twice over: with
     the logo's height, and with whether the event had a CTA at all.

  3. "Event Details link is going to the wrong link". It pointed at
     `signUpLink`, which is a ticket checkout, not the event's details.
*/
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const readSrc = (...parts) => readFileSync(join(here, '..', ...parts), 'utf8');

/* The comments below describe the very bugs the negative assertions hunt. */
const stripComments = (text) =>
  text
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed += 1;
  } catch (error) {
    console.log(`  ✗ ${name}\n    ${error.message}`);
    failed += 1;
  }
}

/*
  Both event layouts, because they are near-copies of each other and the whole
  reason they keep drifting is that a fix lands in one of them.
*/
const HERO_COMPONENTS = ['EventAnnouncement.astro', 'EventFeatured.astro'];
const heroSource = (rel) => stripComments(readSrc('src', 'components', rel));

console.log('\nthe event hero lockup');

test('the left mark can be overridden without touching the stage', () => {
  for (const rel of HERO_COMPONENTS) {
    const code = heroSource(rel);

    assert.match(code, /const overrideLogo = event\.customHeroLogo/,
      `${rel} must check for customHeroLogo override first.`);
    
    assert.match(code, /const sourceTaxonomyLogo = event\.heroLogo \|\| event\.logo \|\| relatedBrand\?\.logo;/,
      `${rel} must resolve taxonomy logo from heroLogo or logo.`);

    assert.match(code, /const resolvedLogoSrc = overrideLogo \|\| taxonomyLogo \|\| fallbackLogoSrc;/,
      `${rel} must implement the strict cascade (Override -> Taxonomy -> Default).`);

    assert.match(code, /class="hero-logo-wrap"[\s\S]{0,240}src=\{resolvedLogoSrc\}/,
      `${rel}: the small top-left mark must render the RESOLVED lockup logo.`);

    /*
      And the hero lockup's override reaches NOTHING else. `heroLogo` naming
      the stage would put the same asset back in two slots, which is the bug
      the field exists to undo.
    */
    const heroLogoUses = code.match(/event\.heroLogo/g) || [];
    assert.equal(heroLogoUses.length, 1,
      `${rel}: heroLogo must be read exactly once, by taxonomyLogo. It is the override for ` +
        'the top-left slot alone.');
  }
});

test('the stage has its own mark, and its own switch', () => {
  for (const rel of HERO_COMPONENTS) {
    const code = heroSource(rel);

    assert.match(code, /const stageMarkLogo = event\.stageLogo \|\| event\.logo;/,
      `${rel}: the stage's mark is stageLogo, falling back to logo — never the hero lockup's`);
    assert.match(code, /const stageShowsMark = event\.stageShowMark === true;/,
      `${rel}: the stage mark must be OFF unless a document turns it on. A default-on toggle ` +
        'reintroduces the repetition for every event that never touches the field.');
    assert.match(code, /const stageMarkUrl = stageShowsMark && stageMarkLogo/,
      `${rel}: the mark renders only when the switch is on`);
  }
});

test('the idle stage is key art, not a second copy of the logo', () => {
  /*
    ─── WHY THE DEFAULT CHANGED ────────────────────────────────────────────

    The hero states the event's identity at the top left, the tagline falls
    back to the event's own name directly under it, and the stage put the
    same mark on screen a third time at 520px. Reported against the Doomsday
    premiere: "there is repeating everywhere. It's too repetitive."
  */
  for (const rel of HERO_COMPONENTS) {
    const code = heroSource(rel);

    assert.match(code, /const stageArtUrl = !stageMarkUrl && event\.heroImage/,
      `${rel}: with no mark asked for, the stage fills with the event's key art`);

    /*
      ONE LAYER, NOT TWO. Every state the stage has is written against
      `.hub-stage-mark` — is-playing fades it to 0.28, is-item takes it to 0,
      reduced-motion drops its transition — so the art has to live in that
      same element or it is left behind by all three.
    */
    assert.match(code, /class:list=\{\['hub-stage-mark', \{ 'hub-stage-mark--art': !!stageArtUrl \}\]\}/,
      `${rel}: art mode must be a modifier on the existing idle layer, not a new layer`);
    assert.doesNotMatch(code, /class="hub-stage-art"/,
      `${rel}: a separate art layer would need every state rule written a second time`);

    assert.doesNotMatch(code, /\.hero-trailer\.hub-stage \{[^}]*overflow: hidden;/,
      `${rel}: HARD RULE 3 — the stage holds the iframe and must never clip`);
  }
});

test('the placeholder is the picture, not an effect on it', () => {
  /*
    ─── WHAT THIS REPLACED ─────────────────────────────────────────────────

    The first version of art mode blurred the key art and overscanned it past
    a clip, borrowing the treatment every OTHER plate on this page uses. Both
    halves of that were wrong here: it was still an effect applied to the
    event's art rather than the art, and the overscan zoomed in on it. Asked
    for plainly: "it should just be the full image that is used for the hero
    but in the location of the trailer at the trailer's size displayed until
    the trailer shows."
  */
  for (const rel of HERO_COMPONENTS) {
    const code = heroSource(rel);

    const artRule = code.match(/\.hub-stage-art-img \{[^}]*\}/);
    assert.ok(artRule, `${rel}: the stage art needs a rule of its own`);
    assert.match(artRule[0], /inset: 0;/,
      `${rel}: the art sits at the frame's edges. An overscan is the zoom that was reported.`);
    assert.doesNotMatch(artRule[0], /blur\(|filter:/,
      `${rel}: the placeholder itself must never be blurred`);

    const wrapRule = code.match(/\.hub-stage-mark--art \{[^}]*\}/);
    assert.ok(wrapRule, `${rel}: art mode needs its wrapper rule`);
    assert.match(wrapRule[0], /filter: none;/,
      `${rel}: the base rule's drop-shadow glow is shaped for a mark, not a full-bleed frame`);
  }
});

test('nothing is ever cropped out of the placeholder', () => {
  /*
    ─── WHAT `cover` DID ───────────────────────────────────────────────────

    The frame is 16/9 and 17 of the 19 events' key art is exactly 16:9, so
    cover was an exact fit almost everywhere — and the two exceptions were
    the entire problem. L.A. Comic Con's art is 2.35:1 and SXSW's is 2.70:1,
    so cover trimmed 24% and 34% off their sides. Both set the event's NAME
    across the full width of the artwork, so what came off was the first and
    last letters of its own title. Reported as "cut off", and it was.

    `contain` is the only fit that promises the whole image whatever shape it
    arrives in, which is the promise this frame has to make: it is fed an
    editor's upload, not a controlled asset.
  */
  for (const rel of HERO_COMPONENTS) {
    const code = heroSource(rel);

    const artRule = code.match(/\.hub-stage-art-img \{[^}]*\}/);
    assert.match(artRule[0], /object-fit: contain;/,
      `${rel}: cover crops, and the two cinemascope events lose their own name to it`);

    /*
      Contain alone leaves bars, and a bar in the frame a trailer is about to
      play in reads as a broken image. The fill is what makes contain
      shippable, so the two are asserted together.
    */
    const fillRule = code.match(/\.hub-stage-art-fill \{[^}]*\}/);
    assert.ok(fillRule, `${rel}: contain without a fill leaves letterbox bars`);
    assert.match(fillRule[0], /object-fit: cover;/,
      `${rel}: the fill is the copy that covers — it is what the gutters show`);
    assert.match(fillRule[0], /blur\(/,
      `${rel}: an unblurred fill is just the image twice at two sizes`);
    assert.match(fillRule[0], /transform: scale\(/,
      `${rel}: the fill must overscan, or its own weak blur edge lands in the gutter`);

    /* One file, one fetch, two paints. */
    const fills = code.match(/srcset=\{stageArtSrcset\}/g) || [];
    assert.equal(fills.length, 2,
      `${rel}: both copies must read the same srcset, or the fill is a second download`);

    /*
      The clip is what hides the overscanned fill. Safe on THIS element and
      only this one: it is a sibling of the iframe, never an ancestor.
    */
    const wrapRule = code.match(/\.hub-stage-mark--art \{[^}]*\}/);
    assert.match(wrapRule[0], /overflow: hidden;/,
      `${rel}: the overscanned fill needs its layer to clip`);
    assert.doesNotMatch(code, /\.hero-trailer\.hub-stage \{[^}]*overflow: hidden;/,
      `${rel}: HARD RULE 3 — the stage holds the iframe and must never clip`);
  }
});

test('losing the blur means the request has to match the box', () => {
  /*
    A blurred plate is deliberately requested SMALL — 640px on /featured,
    900px on a hub page — because the blur destroys more detail than the
    upsample costs. Crisp, that reasoning inverts: 900px into a 760px frame
    on a 2x screen is 0.6x density and visibly soft, which is exactly what
    "the image is not sized properly" would look like.
  */
  for (const rel of HERO_COMPONENTS) {
    const code = heroSource(rel);

    assert.match(code, /const STAGE_WIDTHS = \[600, 760, 1200, 1520\];/,
      `${rel}: the ladder must reach 2x of the widest stage (760 CSS px)`);
    assert.match(code, /srcset=\{stageArtSrcset\}/,
      `${rel}: the stage art needs a srcset now that nothing hides its resolution`);
    assert.match(code, /sizes=\{stageArtSizes\}/,
      `${rel}: and sizes, or the browser assumes 100vw and picks the largest every time`);
    assert.doesNotMatch(code, /stageArtSizes = '100vw'/,
      `${rel}: 100vw would have a phone fetch a viewport-wide image for a 343px box`);
  }
});

test('the hero backdrop is one image, centred, covering', () => {
  /*
    ─── WHAT THIS REPLACED ──────────────────────────────────────────────────

    This test used to assert that a blurred GHOST of the stage mark followed
    whatever was in front of it — crisp over a blown-up blurred copy of itself,
    the lockup /featured uses. That layer is gone.

    It was a second copy of the hero's own picture, masked into the right-hand
    side of the hero and feathered into the backdrop behind it. On a hand-picked
    asset it reads as depth. On the real set it does not: two copies at two
    scales put the same shapes on screen twice slightly out of register, worst
    on line-work key art like PAX Unplugged's, and `background-size: contain`
    left lit bare ground either side of itself on the 2.35:1 banners.

    So the assertions are inverted. The hero is ONE image, and these are the
    three things that keep it that way.
  */
  for (const rel of HERO_COMPONENTS) {
    const code = heroSource(rel);

    assert.doesNotMatch(code, /class="hub-stage-bg"/,
      `${rel}: the second backdrop layer must stay removed`);
    assert.doesNotMatch(code, /const stageGhostUrl/,
      `${rel}: and nothing should still be building a URL for it`);

    /*
      CENTRED, not biased high. Behind 9px of blur the subject is unreadable
      anyway, so a vertical bias only crops differently on every asset: the
      wide banners lost their bottom edge while the 16:9 stills lost nothing.
    */
    assert.match(code, /object-position: center;/,
      `${rel}: one position for every image, whatever its aspect`);
    assert.doesNotMatch(code, /object-position: center \d+%/,
      `${rel}: a vertical bias is what made the crop asset-dependent`);

    /*
      THE OVERSCAN IS GONE, and this asserts that rather than deleting the
      knowledge with it.

      It was a blur allowance: a CSS blur mixes in the transparent pixels
      outside its own element, so the outermost band is the least blurred part
      of it, and a layer reaching the edge of the box has to be pushed past the
      clip to hide that band. The plate no longer reaches the edge — it is
      contained, and blurred 2px rather than 9 — so there is nothing to hide
      and an overscan would only be a zoom.

      What must not come back with it: an absolutely positioned box with left,
      right AND width all non-auto drops its `right`, so `inset: -12%` shifted
      the old plate left and left 12% of the hero bare down the right-hand edge
      (measured at a 1009px hero: it ended at 928px).
    */
    const plate = code.slice(code.indexOf('.hero-backdrop-plate {'));
    const decl = plate.slice(0, plate.indexOf('\n  }'));
    assert.match(decl, /inset: 0;/, `${rel}: a contained plate has nothing to overscan past`);
    assert.doesNotMatch(decl, /--plate-overscan|--fill-overscan/,
      `${rel}: an overscan on a contained picture is a zoom, which is the bug this started as`);
  }
});

test('the hero states the event\'s name once', () => {
  /*
    ─── THE LAST OF THE REPETITION ─────────────────────────────────────────

    18 of the 19 seeded events carry no tagline, and the tagline fell back to
    `event.title`, so all but one page printed the event's own name in type
    directly under its own mark. D23 was the only clean one, and only because
    somebody had written it a real tagline.

    The fallback was not wrong to exist. The <h1> goes sr-only when a logo
    renders, so a stylised mark a visitor cannot parse — or one that fails to
    load — left nothing readable. That reason is now served where the problem
    is: the <h1> WRAPS the mark and the name is the image's alt, so a broken
    image paints the name in the mark's own place, and assistive technology
    reads it once instead of once per element.
  */
  for (const rel of HERO_COMPONENTS) {
    const code = heroSource(rel);

    assert.doesNotMatch(code, /\? event\.tagline\.trim\(\)\s*\n?\s*: event\.title;/,
      `${rel}: the tagline must not fall back to the title — that is the duplicate`);
    assert.match(code, /\? event\.tagline\.trim\(\)\s*\n?\s*: null;/,
      `${rel}: null, not an empty string. An empty <p> still takes its line-height.`);
    assert.match(code, /\{taglineText && <p class="hero-tagline">\{taglineText\}<\/p>\}/,
      `${rel}: the paragraph must not render at all when there is no tagline`);

    assert.match(code, /<h1 class="hero-title-lockup">[\s\S]{0,400}?alt=\{resolvedLabel\}/,
      `${rel}: the mark must BE the heading, and carry the name as its alt`);
    assert.doesNotMatch(code, /<h1 class="sr-only">\{event\.title\}<\/h1>/,
      `${rel}: the sr-only twin is gone; two elements naming the page is what was announced twice`);
    assert.doesNotMatch(code, /class="hero-logo-wrap" aria-hidden="true"/,
      `${rel}: the wrapper must not be hidden from assistive tech now that it holds the heading`);

    /*
      A heading element brings a browser-default 2em size and margin. The alt
      only paints when the image fails, and it has to land where the mark
      would have, not shove everything under it down the page.
    */
    assert.match(code, /\.hero-title-lockup \{[^}]*margin: 0;[^}]*\}/,
      `${rel}: the lockup heading must carry no margin of its own`);
    assert.match(code, /\.hero-title-lockup \{[^}]*font-size: inherit;[^}]*\}/,
      `${rel}: nor a heading's font size`);
  }
});

test('"Event Details" points at this page, not off it', () => {
  /*
    ─── TWO WRONG DESTINATIONS, THEN THE RIGHT DIRECTION ───────────────────

    It was `signUpLink` — an Axs ticket listing for The Game Awards, a
    newsletter form for PAX East — so it was moved to `officialWebsite`. That
    fixed the destination without questioning the direction, and the
    direction was the bug: "a friend of mine clicked it and then they left
    the site." It did exactly what it was built to do.

    The page has an #event-details section headed DETAILS, carrying the
    dates, the venue, Tickets/RSVP and the official website as a link. The
    button's label and that heading are the same words.
  */
  for (const rel of HERO_COMPONENTS) {
    const code = heroSource(rel);

    assert.match(code, /const heroCtaHref = '#event-details';/,
      `${rel}: the hero CTA must be an in-page anchor`);
    assert.match(code, /<section id="event-details"/,
      `${rel}: and the section it names has to exist in this same template, or it scrolls nowhere`);

    const cta = code.match(/<a href=\{heroCtaHref\}[^>]*>/);
    assert.ok(cta, `${rel}: could not find the "Event Details" anchor`);
    assert.doesNotMatch(cta[0], /target="_blank"/,
      `${rel}: an in-page scroll must not open a tab`);
    assert.doesNotMatch(cta[0], /rel="noopener/,
      `${rel}: rel=noopener on a fragment link is a leftover of the outbound version`);
    assert.doesNotMatch(cta[0], /data-event-toc/,
      `${rel}: that attribute opts an element into the rail's scroll-spy, and this is not the rail`);

    /*
      THE OUTBOUND LINK IS REPOSITIONED, NOT DELETED. It has to survive in
      the details section, or "point it at the page instead" quietly became
      "remove the way to reach the official site".
    */
    assert.match(code, /href=\{event\.officialWebsite\}[\s\S]{0,200}press-desk-link/,
      `${rel}: the official website must still be linked from the details section`);
    assert.match(code, /href=\{event\.signUpLink\}[\s\S]{0,200}Tickets \/ RSVP/,
      `${rel}: and Tickets / RSVP must still be there too`);
  }
});

test('the CTA row renders for every event, whatever its data says', () => {
  /*
    The row changes the grid's track sizing. While it was gated on a URL a
    document might not have, four events (Oscars, Anime Expo, Summer Game
    Fest, SDCC 2027) rendered a different grid from the rest, and that is
    half of what moved the metadata row around. An in-page target always
    exists, so the gate is gone rather than merely satisfied.
  */
  for (const rel of HERO_COMPONENTS) {
    const code = heroSource(rel);
    assert.match(code, /'has-cta': true/,
      `${rel}: the CTA row must not depend on document data any more`);
    assert.doesNotMatch(code, /\{heroCtaHref && \(/,
      `${rel}: nor may the button itself be conditional`);
  }
});

test('the metadata row does not move with the logo or the CTA', () => {
  for (const rel of HERO_COMPONENTS) {
    const code = heroSource(rel);

    /*
      `align-self: end` on the copy column is the bug itself. It sized the
      column to its own content and pinned its BOTTOM edge, so a taller logo
      pushed the eyebrow up and `.has-cta` (which shortens the 1fr row)
      moved the edge it was pinned to.
    */
    assert.doesNotMatch(code, /\.hero-grid-container\.has-stage \.hero-copy \{[^}]*align-self: end;/,
      `${rel}: the copy column must not be bottom-pinned — that is what moved the metadata row`);

    assert.match(code, /\.hero-grid-container\.has-stage \.hero-copy \{[^}]*align-self: stretch;/,
      `${rel}: the copy column must stretch so the eyebrow sits at the top of the grid, a ` +
        'position nothing inside the column can change');

    assert.match(code, /\.hero-grid-container\.has-stage \.hero-copy > \.hero-identity \{[^}]*margin-top: auto;/,
      `${rel}: the lockup must take the auto margin, so it stays bottom-anchored while the ` +
        'eyebrow stays put');
  }
});

test('every event can still be reached at its source', () => {
  /*
    Not about the hero button any more — that is an anchor now. This is about
    the Website row in the details section, which is where the outbound link
    moved to. An event with no officialWebsite renders that section with no
    way out to the event itself.
  */
  const docs = JSON.parse(readSrc('src', 'data', 'videos.json'));
  const events = docs.filter((d) => d._type === 'event');
  assert.ok(events.length > 0, 'the event store must not be empty');

  const linkless = events.filter((e) => !e.officialWebsite).map((e) => e.slug?.current);
  assert.deepEqual(linkless, [],
    `these events have no officialWebsite, so their details section cannot link out: ${linkless.join(', ')}`);
});

console.log('\nthe hub hero, same decisions');

/*
  ─── WHY THIS LIVES IN THE EVENT FILE ─────────────────────────────────────

  /featured/[slug].astro is where the event hero was lifted FROM, and it had
  all three of the same problems: one logo field feeding three mark slots, a
  520px mark on a page whose top left already carries one, and an sr-only <h1>
  beside an aria-hidden image. Reported the same way: "there's a lot of
  repetition over there as well."

  Asserting it beside the event rules is deliberate. The two heroes drift
  apart the moment a fix lands in one of them, and a separate file is how
  nobody notices.
*/
const hubHero = stripComments(readSrc('src', 'pages', 'featured', '[slug].astro'));

test('the hub hero has the same three logo fields', () => {
  assert.match(hubHero, /const heroLockupLogo = event\.heroLogo \|\| event\.logo;/,
    'the top-left mark must be overridable on a hub too');
  assert.match(hubHero, /const stageMarkLogo = event\.stageLogo \|\| event\.logo;/,
    "the stage's mark is stageLogo, never the hero lockup's");
  assert.match(hubHero, /const stageShowsMark = event\.stageShowMark === true;/,
    'and it is OFF unless a hub turns it on');

  const heroLogoUses = hubHero.match(/event\.heroLogo/g) || [];
  assert.equal(heroLogoUses.length, 1,
    'heroLogo must be read exactly once, by heroLockupLogo');
});

test('the hub stage idles on the hub art, through getHubBackdrop', () => {
  /*
    NOT straight off `heroImage`. getHubBackdrop() is the one place that
    decides what a hub looks like — its `backdrops[0]` override first, its key
    art second — and going around it is how the stage and the backdrop would
    come to disagree about the same hub.
  */
  assert.match(hubHero, /const stageArtUrl = !stageMarkUrl && heroBackdrop \? stageArtAt\(900\) : null;/,
    'with no mark asked for, the stage fills with the hub art');
  assert.match(hubHero, /urlFor\(heroBackdrop\.ref\)/,
    'the art must come through getHubBackdrop, not a second reading of heroImage');
  assert.doesNotMatch(hubHero, /stageArtAt = \(w: number\) =>\s*\n?\s*event\.heroImage/,
    'reading heroImage directly bypasses the backdrops[0] override');

  assert.match(hubHero, /class:list=\{\['hub-stage-mark', \{ 'hub-stage-mark--art': !!stageArtUrl \}\]\}/,
    'art mode is a modifier on the existing idle layer, not a second layer');
  /* The ghost that used to follow it is gone with the second backdrop layer.
     See 'the hero backdrop is one image, centred, covering' above. */
  assert.doesNotMatch(hubHero, /const stageGhostSource/,
    'the ghost layer must stay removed');
});

test('the hub placeholder is never cropped either', () => {
  const artRule = hubHero.match(/\.hub-stage-art-img \{[^}]*\}/);
  assert.ok(artRule, 'the hub stage art needs a rule of its own');
  assert.match(artRule[0], /object-fit: contain;/,
    'cover crops, and a hub\'s art is an editor upload whose shape cannot be assumed');
  assert.match(artRule[0], /inset: 0;/, 'no overscan: that is a zoom');

  const fillRule = hubHero.match(/\.hub-stage-art-fill \{[^}]*\}/);
  assert.ok(fillRule, 'contain without a fill leaves letterbox bars');
  assert.match(fillRule[0], /object-fit: cover;/, 'the fill is the copy that covers');
  assert.match(fillRule[0], /transform: scale\(/, 'and it overscans, so its weak blur edge is clipped away');

  const fills = hubHero.match(/srcset=\{stageArtSrcset\}/g) || [];
  assert.equal(fills.length, 2, 'both copies read one srcset, so it is one fetch painted twice');

  assert.doesNotMatch(hubHero, /\.hero-trailer\.hub-stage \{[^}]*overflow: hidden;/,
    'HARD RULE 3 — the stage holds the iframe and must never clip');
});

test('the hub mark is the heading', () => {
  assert.match(hubHero, /<h1 class="hero-title-lockup">[\s\S]{0,400}?alt=\{event\.title\}/,
    'the mark must BE the heading and carry the hub name as its alt');
  assert.doesNotMatch(hubHero, /<h1 class="sr-only">\{event\.title\}<\/h1>/,
    'the sr-only twin is what got the name announced twice');
  assert.match(hubHero, /\.hero-title-lockup \{[^}]*margin: 0;[^}]*\}/,
    'a heading element brings a default margin the alt would shove the column down with');
});

test('the event art is never cropped, and never doubled', () => {
  /*
    TWO WRONG ANSWERS BEFORE THIS ONE, and the test has to forbid both.

    `cover` is a crop. Measured at 3840x2160: the box is ~3840x665 against 16/9
    key art, so 33% of the picture's height was on screen. Reported as "way too
    zoomed in". It matters most on this art in particular — CLAUDE.md records
    that L.A. Comic Con is 2.35:1 and SXSW 2.70:1 and both set the event's NAME
    across the full width, so a crop removes the first and last letters of its
    own title.

    The fix for that was two copies of the file, one contained in front and one
    covering behind to fill the gutters. That put the same artwork on screen
    twice at two scales, which this project had ALREADY removed once and
    written down — "two copies at two scales put the same shapes on screen
    twice slightly out of register" — and it was reported again, correctly, as
    the hero looking duplicated.

    So: ONE image, contained, and the space beside it is the page's own dark,
    shaped by a horizontal vignette on the scrim. The vignette lives on an
    overlay rather than as a mask on the image because which edges the art
    leaves bare depends on the box: a wide hero leaves gutters at the sides, a
    phone leaves them top and bottom.
  */
  for (const rel of ['EventHero.astro', 'EventFeatured.astro', 'EventAnnouncement.astro']) {
    const hero = heroSource(rel);

    const plate = hero.match(/\.hero-backdrop-plate \{[^}]*\}/);
    assert.ok(plate, `${rel}: no backdrop plate`);
    assert.match(plate[0], /object-fit: contain;/, `${rel}: the art must not be cropped`);
    assert.doesNotMatch(plate[0], /--plate-overscan/,
      `${rel}: an overscan is a blur allowance for a layer that reaches the edge; a contained one does not`);

    assert.ok(!/hero-backdrop-fill/.test(hero),
      `${rel}: the second copy of the artwork is what read as a duplicate; it must stay gone`);

    const plates = hero.match(/class="event-hero-bg-animated hero-backdrop-plate"/g) || [];
    assert.equal(plates.length, 1, `${rel}: exactly one copy of the picture`);

    /*
      And the gutters must be filled by something. Without it the contained art
      ends on a hard edge against flat black, which is a letterboxed video.
    */
    assert.match(hero, /linear-gradient\(\s*to right,[\s\S]{0,400}?transparent 38%/,
      `${rel}: the horizontal vignette is what the removed second copy was doing`);
  }
});

test('the /events chips carry the accent that says what the event is', () => {
  /*
    `hero-meta-tag--type` was in the markup and its rule was not: lifting the
    hero into EventHero.astro took `.hero-meta-tag` and left both modifiers
    behind, so all three chips rendered identically and the red border that
    marks the event's KIND never appeared.
  */
  for (const rel of ['EventHero.astro', 'EventFeatured.astro', 'EventAnnouncement.astro']) {
    const hero = heroSource(rel);
    assert.match(hero, /\.hero-meta-tag--type \{[^}]*border-left: 2px solid rgba\(var\(--brand-rgb/,
      `${rel}: the type chip must carry the brand accent`);
    assert.match(hero, /\.hero-meta-tag--date \{[^}]*white-space: normal;/,
      `${rel}: the date is the widest chip and must wrap rather than overflow a 320px screen`);
  }
});

/*
  ─── AND THE THIRD HERO: THE ONE ON THE /events INDEX ──────────────────────

  /events used to render its featured event through `FeaturedEvent.astro`, a
  CARD. Beside the real hero it had no backdrop plate, no eyebrow chips and no
  logo lockup, it printed "UPCOMING" twice (the status pill renders a visible
  label AND an sr-only one), and its key art was blown up edge to edge under
  `object-fit: cover`. It is `EventHero.astro` now, and the card is deleted so
  there is no second implementation to drift.
*/
const indexHero = stripComments(readSrc('src', 'components', 'EventHero.astro'));
const eventsIndex = stripComments(readSrc('src', 'pages', 'events', 'index.astro'));

test('the /events hero is the hero, not a card', () => {
  assert.match(eventsIndex, /<EventHero event=\{featuredEvent\}/,
    'the index must render the hero component');
  assert.doesNotMatch(eventsIndex, /FeaturedEvent/,
    'the card is gone; a reference to it means a second hero came back');

  for (const marker of ['event-hero-bg-wrapper', 'hero-backdrop-plate', 'hub-stage-wash', 'hero-title-lockup']) {
    assert.ok(indexHero.includes(marker), `the index hero is missing ${marker}`);
  }
});

test('the /events hero says what, where and when — each of them once', () => {
  const eyebrow = indexHero.match(/<div class="hero-eyebrow">[\s\S]*?<\/div>/);
  assert.ok(eyebrow, 'no chip row');
  assert.match(eyebrow[0], /\{eventTypeLabel\}/, 'what it is');
  assert.match(eyebrow[0], /\{locationLabel\}/, 'where it is');
  assert.match(eyebrow[0], /datetime=\{event\.startDate\}/, 'when it is, as a real <time>');
  assert.doesNotMatch(indexHero, /esi-sr|sr-only/,
    'the sr-only status twin is what printed UPCOMING a second time');
});

test('the /events hero is flush, and its copy still lands on the page column', () => {
  const root = indexHero.match(/\.event-hero--index \{[^}]*\}/);
  assert.ok(root, 'no index modifier');
  assert.match(root[0], /margin-inline: calc\(50% - 50vw\);/, 'break out to the viewport');
  assert.match(root[0], /padding-inline: calc\(50vw - 50%\);/,
    'and put the SAME distance back, or the copy sits half a scrollbar off the column');

  assert.match(indexHero, /\.event-hero--index \.event-hero-content \{[^}]*align-self: stretch;/,
    'align-items: center on the overlay centres a shrink-wrapped copy block');
  assert.match(indexHero, /\.event-hero--index \.hero-tagline \{[^}]*-webkit-line-clamp: 2;/,
    'unclamped, the description set to nine lines and owned a whole phone screen');
});

test('the /events hero starts at the top, not 120px down it', () => {
  /*
    `.events-page` carries `padding-top: 120px` to clear the fixed navbar,
    which is right for a page that opens on text and wrong for one that opens
    on a hero: the hero ran edge to edge sideways and then began 120px down, so
    a band of page background sat between the translucent header and the
    artwork and the header had nothing to be translucent over.

    Opt-in, exactly as `.feed-page.has-spotlight-hero` is, and for the reason
    recorded beside that rule: removing the offset outright once took /intel
    and /category/* with it and left their filter buttons under the header at
    y=12px, reported as "the filter buttons are gone".

    The two halves are asserted together because either alone is silent — a
    class with no rule, or a rule no page claims.
  */
  const css = stripComments(readSrc('src', 'styles', 'modules', 'events.css'));
  assert.match(css, /\.events-page\.has-spotlight-hero \{[^}]*padding-top: 0;/,
    'the opt-out rule is missing');
  assert.doesNotMatch(css, /\.events-page\.has-spotlight-hero \{[^}]*padding-bottom/,
    'only the TOP offset is about the header; the page still needs its bottom');
  assert.match(eventsIndex, /<main class="events-page has-spotlight-hero/,
    'the index must claim the rule, or the band comes back');

  /*
    And the copy must still clear the header from the inside, since the artwork
    now runs underneath it. Measured at 1512x858: chips at 109px against a
    header ending at 67. At 390: 96 against 57.
  */
  assert.match(indexHero, /\.event-hero-overlay \{[^}]*padding-top: clamp\(/,
    'without this the chips land under the navbar the hero just slid beneath');

  const archive = stripComments(readSrc('src', 'pages', 'events', 'archive', '[...page].astro'));
  assert.match(archive, /<main class="events-page flex-1/,
    'the archive opens on a page title, so its 120px is still doing its job');
});

test('the /events hero defines the animation it asks for', () => {
  assert.match(indexHero, /animation: cinematic-hero-zoom/, 'the slow push is the house treatment');
  assert.match(indexHero, /@keyframes cinematic-hero-zoom \{/,
    'Astro scopes this <style>; naming another component\'s keyframes silently does nothing');
});

test('the /events hero holds no iframe, which is why it may clip', () => {
  assert.doesNotMatch(indexHero, /HeroTrailer|<iframe/,
    'HARD RULE 2/3 — the trailer stage stays on the detail page');
  assert.match(indexHero, /\.event-hero-bg-wrapper \{[^}]*overflow: hidden;/,
    'the backdrop wrapper is the one thing that clips');
});

console.log(failed === 0 ? `\n✅ ${passed} passed, 0 failed.` : `\n❌ ${passed} passed, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
