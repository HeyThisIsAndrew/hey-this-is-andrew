/*
  EVERY YouTube PLAYER ON THIS SITE NEEDS A DOOR, AND THERE ARE TWO OF THEM.

  ─── WHY THIS SUITE IS ONE FILE ───────────────────────────────────────────
  A reader reported being trapped by a YouTube sign-in wall on /feed. The fix
  landed on `#video-modal` in Layout.astro, the lightbox a CARD opens, and
  stopped there on the reasoning that FeedSpotlightHero's stage was "its own
  inline player" and therefore a separate concern.

  It was the same concern. /feed's hero plays in that stage, which is the
  player the reader was actually using, so the fix covered everything except
  the case that produced it. Nothing failed: the build passed, the tests
  passed, and the door had simply been fitted to the other room.

  So both players are asserted HERE, together, in the same tests, deliberately
  one file for the reason event-hero-lockup.test.mjs gives: they drift apart
  the moment a fix lands in only one of them. A third player added later
  belongs in this list too.

  ─── WHAT CANNOT CHANGE ───────────────────────────────────────────────────
  1. The "Watch on YouTube" link is rendered ALWAYS and its href is set from
     the video that is loaded. It must never be gated on detecting the
     failure: a detector that silently stops firing puts the reader back in
     the trap with no sign anything is wrong.
  2. The onError note is the ENHANCEMENT. It explains; it does not rescue.
  3. The postMessage listener checks the player's origin AND the frame's own
     contentWindow. Any page can postMessage to any window.
  4. Embeds stay on youtube-nocookie.com. Swapping to youtube.com to dodge
     this would trade the privacy posture away and still not play a video
     whose owner disallows embedding.
*/
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Source with comments stripped, so prose about a pattern never trips a check. */
const code = (s) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err.message}`);
    failed++;
  }
}

/*
  The two players, named the same way so a failure says which room lost its
  door rather than which file changed.
*/
const PLAYERS = [
  {
    label: 'the card lightbox (#video-modal, Layout.astro)',
    file: 'src/layouts/Layout.astro',
    frameId: 'modal-iframe',
    watchId: 'modal-watch-on-youtube',
    noteId: 'modal-embed-note',
  },
  {
    label: 'the /feed hero stage (#hero-iframe, FeedSpotlightHero.astro)',
    file: 'src/components/FeedSpotlightHero.astro',
    frameId: 'hero-iframe',
    watchId: 'hero-watch-on-youtube',
    noteId: 'hero-embed-note',
  },
  {
    label: 'the homepage hero accordion (.acc-video-iframe, HeroAccordion.astro)',
    file: 'src/components/home/HeroAccordion.astro',
    frameId: 'acc-video-iframe',
    watchId: 'hero-acc-watch-on-youtube',
    noteId: 'data-embed-note',
  },
  {
    label: 'the article video tile (<youtube-embed>, YouTubeEmbed.astro)',
    file: 'src/components/YouTubeEmbed.astro',
    frameId: 'yt-embed-frame',
    watchId: 'yt-embed-watch',
    noteId: 'yt-embed-note',
  },
];

console.log('Every YouTube player has a way out:');

for (const player of PLAYERS) {
  const SRC = code(read(player.file));

  test(`${player.label} renders a "Watch on YouTube" link`, () => {
    assert.ok(
      SRC.includes(player.watchId),
      `no #${player.watchId} in ${player.file}: this player has no escape hatch at all`,
    );
    assert.match(
      SRC,
      /Watch on YouTube/,
      'the link has to say where it goes',
    );
  });

  test(`${player.label} builds the watch href from the loaded video id`, () => {
    assert.match(
      SRC,
      /youtube\.com\/watch\?v=\$\{encodeURIComponent\(/,
      'a hardcoded or un-encoded watch URL points at the wrong video, or breaks on one',
    );
  });

  test(`${player.label} does not gate the link on the error being detected`, () => {
    /*
      The failure mode this pins: wrapping the link in the same branch that
      reveals the note. The note may be hidden by default; the LINK may not.
      Checked by asserting the note id and the watch id never appear on the
      same `hidden` assignment.
    */
    const hiddenAssignments = SRC.match(/[\w.]*\b\w*hidden\s*=\s*\w+/g) || [];
    for (const line of hiddenAssignments) {
      assert.ok(
        !line.includes(player.watchId),
        `${player.watchId} must never be toggled with .hidden: it is the fix, not the enhancement`,
      );
    }
  });

  test(`${player.label} opens the watch link in a new tab, safely`, () => {
    assert.match(SRC, /rel=(["'])noopener noreferrer\1|rel\s*=\s*'noopener noreferrer'/, 'rel="noopener noreferrer"');
  });

  test(`${player.label} listens for onError from the player's own origin`, () => {
    assert.match(
      SRC,
      /event\.origin\s*!==\s*'https:\/\/www\.youtube-nocookie\.com'/,
      'an unchecked origin lets any frame on the page raise the note',
    );
    assert.match(
      SRC,
      /event\.source\s*!==\s*\w+\.contentWindow/,
      'origin alone is not enough: the message has to come from THIS frame',
    );
    assert.match(SRC, /payload\.event\s*===\s*'onError'/);
  });

  test(`${player.label} sends the listening handshake`, () => {
    /* Inline, or through the shared starter (src/lib/youtube-start.ts),
       which is checked for the same two things below. */
    const H = /playWhenReady\(/.test(SRC) ? code(read('src/lib/youtube-start.ts')) : SRC;
    assert.match(
      H,
      /event:\s*'listening'/,
      "without the handshake the player never posts events and onError never arrives",
    );
    assert.match(
      H,
      /postMessage\([\s\S]{0,200}?(PLAYER_ORIGIN|'https:\/\/www\.youtube-nocookie\.com')/,
      'the handshake must be targeted at the player origin, never "*"',
    );
    if (H !== SRC) {
      assert.match(H, /const PLAYER_ORIGIN = 'https:\/\/www\.youtube-nocookie\.com'/);
    }
  });

  test(`${player.label} still embeds through youtube-nocookie.com`, () => {
    assert.match(
      SRC,
      /getYouTubeEmbedUrl/,
      'must use the shared helper for the embed URL',
    );
  });

  test(`${player.label} keeps enablejsapi=1 on the embed URL`, () => {
    assert.match(
      SRC,
      /getYouTubeEmbedUrl/,
      'must use the shared helper for the embed URL',
    );
  });
}

/*
  ─── THE TWO PLAYERS ASK YOUTUBE FOR THE SAME THING ────────────────────────

  A reader hit a YouTube SIGN-IN wall in the /feed hero stage, on a video that
  is not age restricted and that played fine for him in the card lightbox on
  the same machine in the same session. One site, one origin, one video, and
  one difference between the players: the stage carried `autoplay=1` and the
  lightbox did not. An embed that starts itself is what YouTube's bot check
  looks for, and that check is decided per viewer, so it reproduces for one
  reader and for nobody testing it.

  The stage starts its video through the jsapi now, so the visitor still gets
  one click and the URL no longer announces an unattended start. This pins it:
  if the wall ever returns, the embed URL is not what separates the two.
*/
/*
  ─── THE THREE STAGES THAT WERE MISSED A SECOND TIME ───────────────────────

  /featured/[slug], EventFeatured and EventAnnouncement each carry a trailer
  stage, and none of them got the escape hatch when the /feed hero and the card
  lightbox did. The first miss was "the modal is not the player he was using";
  this was the same mistake one layer out.

  They are asserted differently from the two above because they work
  differently: the link is one shared rule and one shared wiring, and the three
  files carry only the markup. So what is pinned here is that the markup is in
  all three, that the wiring is mounted once, and that neither the rule nor the
  behaviour has been copied into a file.
*/
console.log('\nThe event and hub stages have a way out too:');

const STAGE_FILES = [
  'src/pages/featured/[slug].astro',
];

/*
  EXCEPT THE EVENT STAGES, BY THE OWNER'S DECISION. An event page is the HQ's
  hub for somebody else's event, and a link out to that event's YouTube
  channel works against it (Andrew). The trade is known: a refused embed on
  an event stage has no door. Pinned so the link is not "restored" as a fix.
*/
for (const rel of ['src/components/EventFeatured.astro', 'src/components/EventAnnouncement.astro']) {
  test(`${rel} deliberately carries no stage escape link`, () => {
    assert.ok(!/class="hub-stage-watch"/.test(code(read(rel))), 'the owner removed this link from event heroes');
  });
}

for (const rel of STAGE_FILES) {
  test(`${rel} renders the stage escape link`, () => {
    const SRC = read(rel);
    assert.match(SRC, /class="[^"]*\bhub-stage-watch\b[^"]*"/, 'this stage has no way out of a refused embed');
    assert.match(SRC, /Watch on YouTube/);
    assert.match(SRC, /rel="noopener noreferrer"/);
  });

  /*
    It sat inside the stage, bottom left, where every rail pane puts its own
    Play / Read button, and the two overlapped on phones and desktop (Andrew,
    from an iPhone). It belongs in the action row beside Play trailer.
  */
  test(`${rel} puts the escape link in the action row, not over the stage`, () => {
    const SRC = code(read(rel));
    const row = SRC.slice(SRC.indexOf('<div class="hero-actions">'));
    const stageAt = SRC.indexOf('class="hero-trailer hub-stage"');
    const linkAt = SRC.search(/class="[^"]*\bhub-stage-watch\b/);
    assert.ok(row && /\bhub-stage-watch\b/.test(row.slice(0, row.indexOf('</div>'))), 'the link is not in .hero-actions');
    assert.ok(stageAt > linkAt, 'the link is rendered inside (after the opening of) the stage again');
  });

  test(`${rel} does not carry its own copy of the wiring or the rule`, () => {
    const SRC = code(read(rel));
    assert.ok(
      !/\.hub-stage-watch\s*\{/.test(SRC),
      'the rule is global in styles/modules/stage-watch.css: a scoped copy in each of three triplets is how they drift',
    );
    assert.ok(
      !/hub-stage-watch['"`]\)[\s\S]{0,120}?href\s*=/.test(SRC),
      'the href is set by src/lib/stage-watch-link.ts, once, for all three',
    );
  });
}

test('the stage escape link is wired once, from Layout', () => {
  const L = code(read('src/layouts/Layout.astro'));
  assert.match(L, /import \{ initStageWatchLink \} from '\.\.\/lib\/stage-watch-link'/);
  assert.match(L, /addEventListener\('astro:page-load',\s*initStageWatchLink\)/);
});

test('the wiring reads the id off the frame, not out of an event detail', () => {
  const M = code(read('src/lib/stage-watch-link.ts'));
  /*
    There are FOUR src assignments in each of the three files, and the two
    ambient ones have no id in scope at all: they hold a data-src. Threading an
    id through twelve dispatches is twelve chances to miss one.
  */
  assert.match(M, /parseVideoId\(frame\?\.src/, 'the frame always knows what it is playing');
  assert.ok(
    !/detail\?\.videoId/.test(M),
    'reading the detail misses the ambient trailer, which is what starts on its own',
  );
});

test('the link names the video on screen, and never the hub trailer', () => {
  const M = code(read('src/lib/stage-watch-link.ts'));
  /* A rail pane is up: its video (or nothing, for an article). The frame is
     unloaded then, so reading the frame alone would hide the link exactly
     when a video is being offered. */
  assert.match(M, /classList\.contains\('is-item'\)/);
  assert.match(M, /\[data-hub-play\]/);
  /* The owner's call: the trailer is its own thing, and Play trailer is its
     control. The link is for the hub's coverage. */
  assert.match(M, /stage\.dataset\.trailer/);
  /* Pane switches dispatch no hub:sourcechange, so the stage is watched. */
  assert.match(M, /new MutationObserver/);
});

test('the id is parsed by parseVideoId, never by hand', () => {
  const M = code(read('src/lib/stage-watch-link.ts'));
  assert.match(M, /import \{ parseVideoId \}/, 'CLAUDE.md: ids are never parsed with an inline regex');
  assert.ok(!/\/embed\\\//.test(M), 'no hand-rolled embed regex');
});

test('parseVideoId recognises the host this site actually embeds from', () => {
  const Y = read('src/lib/platforms/youtube.ts');
  assert.match(
    Y,
    /youtube\(\?:-nocookie\)\?\\\.com/,
    'every embed on this site is youtube-nocookie.com, which the parser used to miss entirely',
  );
  assert.match(
    Y,
    /\(\?:\^\|\\\/\\\/\|\\\.\)/,
    'the host must be anchored, or evil-youtube.com parses as YouTube',
  );
});

test('the homepage Featured box (FeaturedHighlights) has its way out: the card\'s own Watch now', () => {
  /* The lead card's "Watch now" (with the YouTube mark) is a real link to the
     video on YouTube. It cannot sit inside a role="button" (axe nested-
     interactive), so a hero video card is not one: its play mark is the
     <button>. A second link under the card duplicated it, and was removed. */
  const CARD = code(read('src/components/ContentCard.astro'));
  const FH = code(read('src/components/FeaturedHighlights.astro'));
  assert.match(CARD, /const isHeroPlayer = variant === 'hero' && isPlayable/);
  assert.match(CARD, /isHeroPlayer \? \{\} : \{ role: 'button'/, 'a hero video card must not be role=button');
  const link = CARD.match(/<a\s+class="watch-now-btn"[\s\S]*?>/)?.[0] ?? '';
  assert.match(link, /href=\{`https:\/\/www\.youtube\.com\/watch\?v=/, 'Watch now must link to the video on YouTube');
  assert.match(link, /target="_blank"/);
  assert.match(link, /rel="noopener noreferrer"/);
  assert.match(CARD, /<button type="button" class="play-button-wrapper play-button-wrapper--control"/, 'the play mark must be a real button');
  assert.ok(!/fh-watch-yt/.test(FH), 'the duplicate link under the card is back');
  assert.match(FH, /closest\?\.\('a\[href\]'\)\) return;/, 'the inline player must let the link navigate');
});

console.log('\nEvery player the site builds can go fullscreen:');

/*
  The fullscreen fix (a269f27d) landed on the /feed hero and the card modal
  only. The hub stage and both event stages kept `allow="autoplay;
  encrypted-media"` with no `allowfullscreen`, so YouTube's fullscreen button
  was dead on every /featured and /events hero (Andrew, on the DC hub). So
  this is asserted over EVERY iframe the site writes, not a list of players:
  a new player is covered the day it is added.
*/
const IFRAME_FILES = [
  'src/layouts/Layout.astro',
  'src/components/FeedSpotlightHero.astro',
  'src/components/home/HeroAccordion.astro',
  'src/components/EventFeatured.astro',
  'src/components/EventAnnouncement.astro',
  'src/pages/featured/[slug].astro',
  'src/components/YouTubeEmbed.astro',
];
for (const rel of IFRAME_FILES) {
  test(`${rel}: every iframe allows fullscreen`, () => {
    const SRC = code(read(rel));
    /* Google Tag Manager's <noscript> frame is not a player. */
    const tags = (SRC.match(/<iframe\b[\s\S]*?>/g) ?? []).filter((t) => !/googletagmanager/.test(t));
    for (const tag of tags) {
      assert.ok(/\ballowfullscreen\b/i.test(tag), `an <iframe> without allowfullscreen: ${tag.slice(0, 80)}`);
    }
    const built = SRC.split(/createElement\('iframe'\)/).length - 1;
    const granted = (SRC.match(/allowFullscreen\s*=\s*true|setAttribute\('allowfullscreen'/g) ?? []).length;
    assert.ok(granted >= built, `${built} iframe(s) built in script, ${granted} granted fullscreen`);
    assert.ok(tags.length + built > 0, 'no iframe found: update IFRAME_FILES');
  });
}

test('no other file writes an iframe the list above does not cover', () => {
  const walk = (dir) =>
    fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((d) =>
      d.isDirectory() ? walk(path.join(dir, d.name)) : /\.(astro|ts|tsx)$/.test(d.name) ? [path.join(dir, d.name)] : [],
    );
  const writers = walk('src').filter((rel) => /<iframe\b|createElement\('iframe'\)/.test(code(read(rel))));
  /* articles-transform READS Substack's iframes (a regex) and replaces them;
     it writes none. */
  const READERS = ['src/lib/articles-transform.ts'];
  const missing = writers
    .map((rel) => rel.split(path.sep).join('/'))
    .filter((rel) => !IFRAME_FILES.includes(rel) && !READERS.includes(rel));
  assert.deepEqual(missing, [], 'a new player: add it to IFRAME_FILES so its fullscreen is checked');
});

console.log('\nNeither player asks YouTube to start itself:');

/*
  The hub stage and both event stages were CLAUDE.md's "known remaining
  exposure": the ambient trailer carried autoplay=1 and a reader's press
  loaded autoplay=1&mute=0. They now start through playWhenReady() like the
  two heroes. Pinned per file, since the three are triplets and a fix that
  lands in one of them is how they drift.
*/
for (const rel of ['src/pages/featured/[slug].astro', 'src/components/EventFeatured.astro', 'src/components/EventAnnouncement.astro']) {
  test(`${rel}: no embed asks to start itself; playWhenReady starts it`, () => {
    const SRC = code(read(rel));
    const urls = SRC.match(/youtube-nocookie\.com\/embed\/[^`'"]*[`'"][^;]*/g) ?? [];
    assert.ok(urls.length >= 2, 'expected the trailer and the pressed-play embed URLs');
    for (const url of urls) assert.ok(!/autoplay=1/.test(url), `autoplay=1 is back: ${url.slice(0, 90)}`);
    assert.match(SRC, /import \{ playWhenReady \} from '[./]+lib\/youtube-start'/);
    const assigns = (SRC.match(/frame\.src = (?:finalSrc|mutedSrc|embedUrl\()/g) ?? []).length;
    const starts = (SRC.match(/startStage\(frame\)/g) ?? []).length;
    assert.equal(assigns, 4, 'the four places this stage loads a video');
    assert.equal(starts, assigns, 'every video this stage loads must be started by playWhenReady');
  });
}


const EMBED_URL = (src) => {
  const m = src.match(/youtube-nocookie\.com\/embed\/[^`'"]*/);
  assert.ok(m, 'no embed URL found');
  return m[0];
};

test('the /feed hero stage does not carry autoplay=1', () => {
  const url = EMBED_URL(code(read('src/lib/youtube-url.ts')));
  assert.ok(
    !/autoplay=1/.test(url),
    `autoplay=1 is back on the stage embed: ${url}. Start it with the jsapi playVideo command instead.`,
  );
});

test('the card lightbox does not carry autoplay=1 either', () => {
  const url = EMBED_URL(code(read('src/lib/youtube-url.ts')));
  assert.ok(!/autoplay=1/.test(url), `autoplay=1 on the lightbox embed: ${url}`);
});

test('the homepage hero player does not carry autoplay=1, or leave nocookie', () => {
  const SRC = code(read('src/components/home/HeroAccordion.astro'));
  assert.ok(!/autoplay=1/.test(SRC), 'autoplay=1 is back on the homepage hero embed');
  assert.ok(!/youtube\.com\/embed\//.test(SRC), 'the homepage hero embeds from youtube.com, not the nocookie helper');
  assert.match(SRC, /playWhenReady\(/, 'the hero starts through the shared jsapi starter (youtube-start.ts)');
});

test('the stage starts playback through the jsapi, so dropping autoplay costs no click', () => {
  const SRC = code(read('src/components/FeedSpotlightHero.astro'));
  assert.match(
    SRC,
    /playWhenReady\(/,
    'without this the stage needs a second click on YouTube\'s own play button',
  );
  assert.match(
    SRC,
    /allow="[^"]*\bautoplay\b[^"]*"/,
    'playVideo is refused without autoplay in the frame permissions policy',
  );
});

/*
  ─── THE DOUBLE PRESS ───────────────────────────────────────────────────────
  Both heroes posted `playVideo` on the iframe's `load` event, which fires
  when the embed document loads, a few hundred ms before YouTube's player
  inside it is listening (measured: load ~3800ms, onReady ~4100ms). The
  command was dropped, the player sat cued, and the reader pressed play
  twice. The shared starter waits for onReady; neither hero may go back to
  sending the command on `load`.
*/
test('the shared starter waits for the player to be ready before playVideo', () => {
  const S = code(read('src/lib/youtube-start.ts'));
  assert.match(S, /event\.origin !== PLAYER_ORIGIN/, 'messages must come from the player origin');
  assert.match(S, /event\.source !== frame\.contentWindow/, 'and from THIS frame');
  assert.match(S, /payload\.event === 'onReady'/, 'playVideo waits for onReady');
  assert.ok(!/autoplay=1/.test(S), 'the starter never uses autoplay=1');
});

for (const rel of ['src/components/home/HeroAccordion.astro', 'src/components/FeedSpotlightHero.astro']) {
  test(`${rel} does not send playVideo on the frame's load event`, () => {
    const SRC = code(read(rel));
    assert.ok(
      !/addEventListener\('load'[\s\S]{0,400}?playVideo/.test(SRC),
      'playVideo on `load` reaches the frame before the player listens: the double press',
    );
    assert.match(SRC, /import \{ playWhenReady \} from '(\.\.\/)+lib\/youtube-start'/);
  });
}

test('the stage keeps playsinline=1, which the PiP logic depends on', () => {
  const url = code(read('src/lib/youtube-url.ts'));
  assert.match(
    url,
    /playsinline=1/,
    'an iOS fullscreen takeover tears the stage out from under the PiP window that owns it',
  );
});

console.log('\nThe subscribe CTAs ask for the confirmation sheet:');

/*
  `?sub_confirmation=1` opens YouTube's one-click subscribe dialog over the
  channel. Without it the visitor lands on the channel page and has to find
  the button themselves, which is the whole cost of the CTA paid twice.

  ─── THE PARAMETER LIVES AT THE SOURCE, NOT AT THE CALL SITES ─────────────
  `site.socials.youtubeSubscribe` is the channel URL with the parameter on
  it. The ad rotator used to carry the assembled URL inline and the /feed
  hero pointed at the bare channel: two call sites, and the one that mattered
  most was the one that had forgotten it. So this suite checks the SOURCE has
  it and that no component spells the handle out again, which is what let the
  two drift in the first place.
*/
const SITE = read('src/data/site.js');

test('site.socials exposes a subscribe URL built from the channel URL', () => {
  assert.match(
    SITE,
    /youtubeSubscribe/,
    'the subscribe URL belongs in src/data/site.js so any future CTA can reach it',
  );
  assert.match(
    SITE,
    /\$\{this\.youtube\}\?sub_confirmation=1/,
    'derive it from the channel URL: a second literal is a second thing to rename',
  );
});

const CTA_FILES = [
  'src/components/CommercialRotator.astro',
  'src/components/FeedSpotlightHero.astro',
];

for (const rel of CTA_FILES) {
  test(`${rel} reaches for the shared subscribe URL`, () => {
    const SRC = code(read(rel));
    assert.match(
      SRC,
      /site\.socials\.youtubeSubscribe/,
      'this CTA asks the visitor to subscribe, so it wants the confirmation URL',
    );
  });

  test(`${rel} does not spell the channel handle out itself`, () => {
    const SRC = code(read(rel));
    const inline = SRC.match(/https:\/\/(?:www\.)?youtube\.com\/@[\w-]+/g) || [];
    assert.deepEqual(
      inline,
      [],
      `hardcoded channel URL: ${inline.join(' | ')}. Use site.socials instead.`,
    );
  });
}

console.log('\nThe hero action row:');

/*
  ─── ORDER IS FIXED: SUBSCRIBE, WATCH ON YOUTUBE, THEN THE REST ────────────

  The two YouTube actions are a pair and must not be split. The hub CTA used
  to be inserted straight after SUBSCRIBE, which put EXPLORE in the MIDDLE of
  them, so the watch button moved depending on whether the loaded item
  happened to have a hub. It is asserted in the MARKUP and in the swap
  handler, because the row is rebuilt at runtime and only pinning both keeps
  them agreeing.
*/
const HERO = read('src/components/FeedSpotlightHero.astro');

test('the markup renders SUBSCRIBE, then the watch link, then the hub CTA', () => {
  const subscribe = HERO.indexOf('feed-hero-youtube-btn');
  const watch = HERO.indexOf('hero-watch-on-youtube');
  const hub = HERO.indexOf('hero-featured-hub-btn');
  assert.ok(subscribe > -1 && watch > -1 && hub > -1, 'all three buttons must exist');
  assert.ok(subscribe < watch, 'SUBSCRIBE comes first');
  assert.ok(watch < hub, 'the watch link comes before the hub CTA, never after it');
});

test('the swap handler inserts the watch link directly after SUBSCRIBE', () => {
  const SRC = code(HERO);
  assert.match(
    SRC,
    /subscribeBtn\.after\(watchBtn\)/,
    'appending lands it after a hub button the same swap may have just inserted',
  );
});

test('the swap handler inserts the hub CTA after the watch link', () => {
  const SRC = code(HERO);
  assert.match(
    SRC,
    /querySelector\('\.feed-hero-watch-btn'\) \|\| subscribe/,
    'anchoring on SUBSCRIBE unconditionally puts EXPLORE between the two YouTube buttons',
  );
});

test('the watch link shares the subscribe button design by selector, not by copy', () => {
  const SRC = code(HERO);
  /*
    Both class names on ONE rule. A second block with the same declarations
    would drift the moment a padding or border changed in only one of them,
    which is how the site's two tag lists came to disagree.
  */
  assert.match(
    SRC,
    /\.feed-hero-youtube-btn,\s*\.feed-hero-watch-btn \{/,
    'the two buttons must share one rule',
  );
  assert.match(
    SRC,
    /\.feed-hero-youtube-btn:hover,\s*\.feed-hero-youtube-btn:focus-visible,\s*\.feed-hero-watch-btn:hover,\s*\.feed-hero-watch-btn:focus-visible/,
    'the hover and focus states are part of the design too',
  );
  assert.ok(
    !/\.feed-hero-watch-btn \{[^}]*text-decoration:\s*underline/.test(SRC),
    'the quiet underlined treatment is what this replaced',
  );
});

test('the shared rule pins a line box, so the glyphless button is not shorter', () => {
  const SRC = code(HERO);
  const rule = SRC.slice(SRC.indexOf('.feed-hero-youtube-btn,'));
  assert.match(
    rule.slice(0, 600),
    /line-height:\s*15px/,
    'SUBSCRIBE is as tall as its 15px glyph: measured 30px against 27px without this',
  );
});

console.log('\nHouse style:');

test('no em dash in the copy either player shows a visitor', () => {
  /* CLAUDE.md: split the sentence or use a comma. Comments are exempt. */
  const offenders = [];
  for (const rel of ['src/layouts/Layout.astro', 'src/components/FeedSpotlightHero.astro']) {
    const SRC = code(read(rel));
    const noteBlocks = SRC.match(/<p class="[\w-]*embed-note"[^>]*>([\s\S]*?)<\/p>/g) || [];
    for (const block of noteBlocks) {
      if (block.includes('—')) offenders.push(`${rel}: ${block.slice(0, 60)}`);
    }
  }
  assert.deepEqual(offenders, [], `em dash in visitor-facing copy: ${offenders.join(' | ')}`);
});

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
