/*
  EVERY AUDIBLE EMBED PAUSES WHEN THE TAB GOES AWAY.

  ─── THE BUG ──────────────────────────────────────────────────────────────
  A reader opened a video in a NEW TAB from the homepage featured shelf and
  the shelf went on playing behind them: two copies of one soundtrack, one of
  them on a page no longer on screen.

  Nothing on the site paused an embed when the document was hidden.
  FeaturedHighlights came closest and still did not: its `visibilitychange`
  listener calls `stopAutoPlay()`, which stops the CAROUSEL ROTATION TIMER and
  never touches the video. The /feed hero stage, the card lightbox, the hero
  trailer and the event/hub stages had nothing at all.

  ─── WHAT CANNOT CHANGE ───────────────────────────────────────────────────
  1. ONE module, mounted once from Layout.astro. Seven copies of a
     visibilitychange listener is how this drifts back apart.
  2. Muted-ness is asked of the PLAYER, never read off the URL. HeroTrailer
     ships `mute=1` and then unmutes with a jsapi command, and the event and
     hub stages do the same through their sound toggles, so a src-based check
     skips exactly the players a reader turned the sound on for.
  3. It resumes only what IT paused and only what was playing. A blanket
     resume restarts videos the reader paused on purpose; a blanket pause with
     no resume freezes the muted background loops several heroes are built on.
  4. The hot paths do not touch the DOM. A playing embed posts several
     `infoDelivery` messages a second, and this site has spent three rounds
     getting its LCP down.
  5. HeroTrailer.astro is NOT edited (hard rule 2). It is sent the same
     standard commands and its src is never reassigned.
*/
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
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

const MODULE = code(read('src/lib/embed-pause.ts'));
const LAYOUT = code(read('src/layouts/Layout.astro'));

console.log('The pause lives in one place:');

test('Layout mounts it, so every page gets it', () => {
  assert.match(LAYOUT, /import \{ initEmbedPause \} from '\.\.\/lib\/embed-pause'/);
  assert.match(LAYOUT, /initEmbedPause\(\)/);
  assert.match(
    LAYOUT,
    /addEventListener\('astro:page-load',\s*initEmbedPause\)/,
    'ClientRouter swaps the body, so a one-shot mount misses every later page',
  );
});

test('it is self-guarded, so the page-load binding cannot double-bind', () => {
  assert.match(
    MODULE,
    /__hqEmbedPauseBound/,
    'without a guard each navigation adds another visibilitychange listener',
  );
});

test('no component pauses a video from its own visibilitychange handler', () => {
  /*
    The failure this pins is a well-meaning second implementation: one
    component growing its own visibilitychange-plus-pauseVideo handler, which
    then fights this module over the same frame.

    Scoped to the HANDLER BODY, not the file. A first version of this check
    flagged FeaturedHighlights for merely containing both words, and it was
    wrong: that component pauses on an outbound-link click and on scrolling
    out of view, which are its own concerns and must stay. Its
    visibilitychange handler only stops the carousel rotation timer.

    That distinction is the whole bug, as it happens. The shelf's click
    handler already paused when its "Watch now" link was taken, and the
    reader still got duplicate audio, because a middle click fires auxclick
    and "Open link in new tab" from the context menu fires no click at all.
    Pausing per route is how you miss routes; pausing on `document.hidden`
    catches every one of them.
  */
  const offenders = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(astro|ts|tsx)$/.test(entry.name)) {
        const rel = path.relative(ROOT, full);
        if (rel === 'src/lib/embed-pause.ts') continue;
        const src = code(fs.readFileSync(full, 'utf8'));
        let at = src.indexOf('visibilitychange');
        while (at !== -1) {
          /* The handler body, generously bounded: long enough to hold a
             realistic listener, short enough not to reach the next one. */
          if (/pauseVideo/.test(src.slice(at, at + 600))) {
            offenders.push(rel);
            break;
          }
          at = src.indexOf('visibilitychange', at + 1);
        }
      }
    }
  };
  walk(path.join(ROOT, 'src'));
  assert.deepEqual(
    offenders,
    [],
    `these pause from their own visibilitychange handler: ${offenders.join(', ')}. The site has one.`,
  );
});

console.log('\nIt asks the player, it does not read the URL:');

test('muted-ness is never decided from the embed src', () => {
  assert.ok(
    !/src[\s\S]{0,80}?includes\(\s*['"`]mute=1/.test(MODULE) && !/mute=1/.test(MODULE),
    'HeroTrailer ships mute=1 and then unmutes by command: the URL lies about the sound',
  );
});

test('it tracks playerState reported by the player', () => {
  assert.match(MODULE, /playerState/, 'the state has to come from the player');
  assert.match(MODULE, /const PLAYING = 1/, "YouTube's PlayerState.PLAYING");
  assert.match(
    MODULE,
    /event:\s*'listening'/,
    'without the handshake the player never reports anything and nothing ever pauses',
  );
});

test('it resumes only what it paused', () => {
  assert.match(
    MODULE,
    /pausedByUs/,
    'a blanket playVideo on return restarts videos the reader paused on purpose',
  );
  assert.match(
    MODULE,
    /if \(entry\.playing\) \{?\s*entry\.pausedByUs = false/,
    'a reader pressing play themselves takes ownership of the state back',
  );
});

/*
  ─── LEAVING BY A LINK, AND SCROLLING AWAY ────────────────────────────────
  Reported as the homepage going on playing behind the reader: a video that
  was scrolled out of view kept its sound, and one left for YouTube by
  "Watch on YouTube" was resumed by this module when the reader came back.
  Both live HERE, and FeaturedHighlights no longer pauses or plays its own
  player on scroll (it only stops and starts its rotation timer).
*/
test('an external-link click pauses, and the video is not resumed on return', () => {
  assert.match(MODULE, /closest\?\.\('a\[target="_blank"\]'\)/, 'target=_blank links are the trigger');
  assert.match(MODULE, /entry\.leftForLink = 'pausing'/);
  assert.match(
    MODULE,
    /entry\.pausedByUs = entry\.leftForLink === 'none'/,
    'a tab-hide after leaving by a link must not mark the video for resume',
  );
});

test('a frame scrolled out of view is paused; only an autoplaying one resumes', () => {
  assert.match(MODULE, /new IntersectionObserver\(/);
  assert.match(MODULE, /viewObserver!?\.observe\(frame\)/, 'every tracked frame is observed from sweep()');
  assert.match(MODULE, /entry\.pausedByScroll = true/);
  assert.match(MODULE, /if \(isAmbient\(frame\)\) send\(frame, PLAY\)/, 'only a background embed resumes');
  /* Background is MARKED, since those players no longer carry autoplay=1. */
  assert.match(MODULE, /dataset\.embedAmbient === '1'/);
});

test('FeaturedHighlights leaves its video alone on scroll', () => {
  const fh = code(read('src/components/FeaturedHighlights.astro'));
  const io = fh.slice(fh.indexOf("if ('IntersectionObserver' in window)"));
  const block = io.slice(0, io.indexOf('observer.observe(section)'));
  assert.ok(block.length > 0, 'the rotation observer is still there');
  assert.ok(!/pauseVideo|playVideo/.test(block), 'pausing an embed belongs to embed-pause.ts (hard rule 12)');
  assert.match(block, /stopAutoPlay\(\)/);
  assert.match(block, /startAutoPlay\(\)/);
});

test('commands are posted to the embed origin, never "*"', () => {
  assert.ok(
    !/postMessage\([^)]*,\s*['"]\*['"]/.test(MODULE),
    'a wildcard target origin leaks the command to whatever is in the frame',
  );
  assert.match(MODULE, /postMessage\(JSON\.stringify\(payload\), origin\)/);
});

console.log('\nThe hot paths stay off the DOM:');

test('the message handler reads a cached frame list', () => {
  const handler = MODULE.slice(MODULE.indexOf("addEventListener('message'"));
  const body = handler.slice(0, handler.indexOf('visibilitychange'));
  assert.ok(
    !/playableFrames\(\)|querySelectorAll/.test(body),
    'a playing embed posts several messages a second: this would be a document query on each',
  );
  assert.match(body, /tracked\.find/);
});

test('sweeps are coalesced to one per frame', () => {
  assert.match(
    MODULE,
    /requestAnimationFrame\(\(\) => \{[\s\S]*?sweep\(\)/,
    'the observer watches the whole document, which this site mutates constantly',
  );
  assert.match(MODULE, /new MutationObserver\(queueSweep\)/, 'the observer must use the coalesced sweep');
});

test('the observer watches src, not only new nodes', () => {
  /*
    The lightbox and the hero stage render at about:blank and have their src
    ASSIGNED later. That is an attribute mutation and nothing else, so a
    childList-only observer never sees the two players this bug was reported
    through.
  */
  assert.match(MODULE, /attributeFilter:\s*\['src'\]/);
  assert.match(MODULE, /childList:\s*true/);
});

test('the module never reassigns a frame src', () => {
  assert.ok(
    !/\.src\s*=/.test(MODULE),
    'reassigning src restarts the video, and an empty one loads the site inside itself (hard rule 4)',
  );
});

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
