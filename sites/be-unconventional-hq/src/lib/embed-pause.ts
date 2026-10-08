/**
 * ─── NOTHING ON THIS SITE USED TO PAUSE WHEN THE TAB WENT AWAY ─────────────
 *
 * Reported as duplicate audio: a reader opened a video in a NEW TAB from the
 * homepage featured shelf, and the shelf's player went on playing behind
 * them. Two copies of the same soundtrack, one of which they had no visible
 * control over, because the page playing it was no longer on screen.
 *
 * It was not one component's bug. Every audible player on the site had it:
 *
 *   - `#hero-iframe`      the /feed hero stage
 *   - `#modal-iframe`     the card lightbox
 *   - FeaturedHighlights  the homepage shelf (IFrame API)
 *   - EventFeatured / EventAnnouncement / featured[slug]  once unmuted
 *
 * FeaturedHighlights was the closest to handling it and still did not: its
 * `visibilitychange` listener calls `stopAutoPlay()`, which stops the
 * CAROUSEL ROTATION TIMER. The video underneath it was never touched.
 *
 * So this is one module, mounted once from Layout.astro, rather than the same
 * listener copied into seven components that would then drift. A player added
 * later is covered by having `enablejsapi=1` on its embed URL, which every
 * player here already does.
 *
 * ─── WHY IT ASKS THE PLAYER RATHER THAN READING THE URL ────────────────────
 *
 * The obvious shortcut is to check the iframe's `src` for `mute=1` and skip
 * the muted background loops. It is wrong: the event and hub stages ship
 * `mute=1` in their URL and then unmute with a jsapi `unMute` command through
 * their sound toggles, leaving the src saying "muted" over a player that is
 * audible. A src-based check would
 * skip exactly the players a reader has deliberately turned the sound on for.
 *
 * `enablejsapi=1` plus the `listening` handshake makes the player post its own
 * state back, so this tracks what is ACTUALLY playing and pauses that.
 *
 * ─── WHY IT RESUMES ────────────────────────────────────────────────────────
 *
 * Only what it paused, and only what was playing when the tab was hidden. A
 * blanket `playVideo` on return would start videos the reader had paused on
 * purpose, and a blanket pause with no resume would silently freeze the muted
 * background loops that several heroes are built on. Tracking the state is
 * what lets it leave both alone.
 *
 * ─── TWO MORE WAYS A VIDEO GOES ON PLAYING BEHIND THE READER ───────────────
 *
 * 1. LEAVING BY AN EXTERNAL LINK. A `target="_blank"` link ("Watch on
 *    YouTube", Instagram, a partner) opens a tab and the page is hidden, so
 *    the rule above paused the video, and then RESUMED it on return: the
 *    reader who went to watch it on YouTube came back to it playing here. A
 *    click on such a link now pauses what is playing and marks it as not
 *    ours to resume (see `leftForLink`).
 * 2. SCROLLING AWAY. A video scrolled out of the viewport kept playing,
 *    audible and uncontrollable. Each frame is observed; leaving the
 *    viewport pauses it. Coming back resumes only an AUTOPLAYING embed (a
 *    background loop, whose `src` carries `autoplay=1`); a video the reader
 *    started stays paused for them to press play again. That test reads
 *    `autoplay`, never `mute` (see above): it asks whether the embed starts
 *    itself, not whether it is audible.
 *
 * Pausing belongs here and nowhere else (CLAUDE.md hard rule 12):
 * FeaturedHighlights used to pause and resume its own player on scroll.
 */

/** The two origins a YouTube embed can be served from on this site. */
const YT_ORIGINS = ['https://www.youtube-nocookie.com', 'https://www.youtube.com'];

/** YouTube's PlayerState.PLAYING. */
const PLAYING = 1;

type FrameState = {
  /** Last state the player reported. */
  playing: boolean;
  /** True only while THIS module is the reason it is paused (tab hidden). */
  pausedByUs: boolean;
  /** Paused because it left the viewport. */
  pausedByScroll: boolean;
  /**
   * The reader left by an external link while this played, so it must not be
   * resumed for them. 'pausing' until the player reports it stopped, then
   * 'paused' until the reader presses play again ('none'). The first step
   * exists because the pause is asynchronous: a PLAYING report already in
   * flight can land after the click and before the tab is hidden, and must
   * not turn the tab-hide pause back into a resumable one.
   */
  leftForLink: 'none' | 'pausing' | 'paused';
};

const frames = new WeakMap<HTMLIFrameElement, FrameState>();

/**
 * The frames the last sweep found, kept so the hot paths never touch the DOM.
 *
 * This is not a micro-optimisation. A playing YouTube embed posts several
 * `infoDelivery` messages a SECOND, and the message handler has to identify
 * which frame each one came from; doing that with a fresh
 * `querySelectorAll('iframe')` each time puts a document-wide query on a
 * timer nobody controls, on pages this site has spent three rounds trying to
 * get the LCP down on.
 */
let tracked: HTMLIFrameElement[] = [];

/** The embed's own origin, or null when the frame is not a YouTube embed. */
function originOf(frame: HTMLIFrameElement): string | null {
  const src = frame.src || '';
  return YT_ORIGINS.find((origin) => src.startsWith(origin)) ?? null;
}

/** Every YouTube embed on the page that can be talked to. */
function playableFrames(): HTMLIFrameElement[] {
  return Array.from(document.querySelectorAll('iframe')).filter(
    (frame) => originOf(frame) !== null && (frame.src || '').includes('enablejsapi=1'),
  );
}

function send(frame: HTMLIFrameElement, payload: Record<string, unknown>) {
  const origin = originOf(frame);
  if (!origin) return;
  try {
    frame.contentWindow?.postMessage(JSON.stringify(payload), origin);
  } catch {
    /* A frame mid-navigation refuses the post. The next sweep catches it. */
  }
}

/**
 * Open the reporting channel. Until this is sent the player stays silent, so
 * without it there is no state to act on and the pause never fires.
 */
function listen(frame: HTMLIFrameElement) {
  send(frame, { event: 'listening', id: 1, channel: 'widget' });
}

/**
 * Attach to a frame once. `load` does not bubble, so this cannot be delegated
 * from the document and has to be bound per element; the WeakMap entry doubles
 * as the "already bound" mark so a re-sweep is free.
 */
function track(frame: HTMLIFrameElement) {
  if (frames.has(frame)) return;
  frames.set(frame, { playing: false, pausedByUs: false, pausedByScroll: false, leftForLink: 'none' });
  /* Not `{ once: true }`: several of these frames are re-sourced when a hero
     swaps item or a toggle rebuilds the URL, and each new document needs its
     own handshake. */
  frame.addEventListener('load', () => listen(frame));
  /* Already loaded by the time this runs, which is the common case on a
     client-side navigation into a page whose player is mid-play. */
  listen(frame);
}

/** Watches every tracked frame's visibility (created in initEmbedPause). */
let viewObserver: IntersectionObserver | null = null;

function sweep() {
  tracked = playableFrames();
  tracked.forEach(track);
  /* observe() is idempotent per element, so re-sweeps cost nothing. */
  if (viewObserver) tracked.forEach((frame) => viewObserver!.observe(frame));
}

const PAUSE = { event: 'command', func: 'pauseVideo', args: [], id: 1, channel: 'widget' };
const PLAY = { event: 'command', func: 'playVideo', args: [], id: 1, channel: 'widget' };

/**
 * Coalesce sweeps to one per frame.
 *
 * The observer below watches the whole document, and this site mutates it
 * constantly: the feed hero rebuilds its stage on every card swap, the
 * carousels move slides, the reveal-on-scroll pass toggles classes. Sweeping
 * per mutation record would run a document-wide query hundreds of times
 * during one interaction. One per animation frame is enough: a frame that
 * appears mid-frame is picked up at the end of it, long before anything can
 * hide the tab.
 */
let sweepQueued = false;
function queueSweep() {
  if (sweepQueued) return;
  sweepQueued = true;
  requestAnimationFrame(() => {
    sweepQueued = false;
    sweep();
  });
}

export function initEmbedPause() {
  if ((window as any).__hqEmbedPauseBound) {
    /* The listeners below live on `window` and `document`, both of which
       outlive a ClientRouter navigation, so only the sweep is repeated. */
    sweep();
    return;
  }
  (window as any).__hqEmbedPauseBound = true;

  /* The players report their own state here. */
  window.addEventListener('message', (event: MessageEvent) => {
    if (!YT_ORIGINS.includes(event.origin)) return;

    let payload: any;
    try {
      payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    } catch {
      return; // Not JSON, so not a player event.
    }
    const state = payload?.info?.playerState;
    if (typeof state !== 'number') return;

    /* Match the message to its frame by contentWindow. Origin alone is not
       enough: a page can carry several embeds from the same origin. Read from
       the cached list, never the DOM: see the note on `tracked`. */
    const frame = tracked.find((f) => f.contentWindow === event.source);
    if (!frame) return;

    const entry = frames.get(frame);
    if (!entry) return;
    entry.playing = state === PLAYING;
    /* The external-link pause has taken; the next PLAYING after it is the
       reader pressing play again, which hands the video back to them. */
    if (entry.leftForLink === 'pausing' && !entry.playing) entry.leftForLink = 'paused';
    else if (entry.leftForLink === 'paused' && entry.playing) entry.leftForLink = 'none';
    /* A reader who presses play themselves owns the state again, so a later
       return to the tab must not treat it as ours to resume. */
    if (entry.playing) {
      entry.pausedByUs = false;
      entry.pausedByScroll = false;
    }
  });

  document.addEventListener('visibilitychange', () => {
    sweep();

    if (document.hidden) {
      for (const frame of tracked) {
        const entry = frames.get(frame);
        if (!entry || !entry.playing) continue;
        send(frame, PAUSE);
        entry.playing = false;
        /* Not ours to resume if the reader left by an external link. */
        entry.pausedByUs = entry.leftForLink === 'none';
      }
      return;
    }

    for (const frame of tracked) {
      const entry = frames.get(frame);
      if (!entry || !entry.pausedByUs) continue;
      send(frame, PLAY);
      entry.pausedByUs = false;
    }
  });

  /*
    ─── AN EXTERNAL LINK PAUSES, AND THE VIDEO STAYS PAUSED ─────────────────
    Capture phase, so it runs before anything that might stop the click.
    Pauses what is playing and hands it back to the reader: when they return
    from YouTube (or Instagram, or a partner) the video is where they left
    it, not playing on its own.
  */
  document.addEventListener(
    'click',
    (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.('a[target="_blank"]');
      if (!link) return;
      for (const frame of tracked) {
        const entry = frames.get(frame);
        if (!entry || !entry.playing) continue;
        send(frame, PAUSE);
        entry.playing = false;
        entry.pausedByUs = false;
        entry.leftForLink = 'pausing';
      }
    },
    true,
  );

  /*
    ─── SCROLLED OUT OF VIEW, PAUSED ─────────────────────────────────────────
    A playing frame that leaves the viewport is paused. On its way back, a
    BACKGROUND embed resumes; anything the reader started stays paused until
    they press play. Background means `data-embed-ambient="1"` on the frame,
    set by whoever starts it on the reader's behalf (the homepage Featured
    preview, a hub/event stage's trailer). It used to mean `autoplay=1` in the
    src, and no player carries that any more: an embed that starts itself is
    what YouTube's bot check looks for (hard rule 11), and the global QA sweep
    fails the build if any shipped script so much as contains the string.
    Never reads `mute` (the rule above).
  */
  const isAmbient = (frame: HTMLIFrameElement) => frame.dataset.embedAmbient === '1';

  viewObserver = new IntersectionObserver((records) => {
    for (const record of records) {
      const frame = record.target as HTMLIFrameElement;
      /* A removed frame (the homepage hero drops its player on every panel
         switch) is let go, not observed for the rest of the session. */
      if (!frame.isConnected) {
        viewObserver?.unobserve(frame);
        continue;
      }
      const entry = frames.get(frame);
      if (!entry || originOf(frame) === null) continue;

      if (!record.isIntersecting) {
        if (!entry.playing) continue;
        send(frame, PAUSE);
        entry.playing = false;
        entry.pausedByScroll = true;
        continue;
      }

      if (!entry.pausedByScroll) continue;
      entry.pausedByScroll = false;
      if (isAmbient(frame)) send(frame, PLAY);
    }
  });

  /*
    ─── WATCH `src`, NOT JUST NEW NODES ───────────────────────────────────────

    Frames arrive after first paint in two different ways, and only one of them
    is a new node. The shelf's player is BUILT by the IFrame API, which is a
    childList mutation. But the lightbox and the feed hero stage are rendered
    at `about:blank` and later have their `src` ASSIGNED, which is an attribute
    mutation and nothing else: no node is added, so a childList observer never
    fires and those two players stay untracked.

    That gap is not harmless. `visibilitychange` sweeps before it acts, so the
    frame would be found at that moment, but found with a fresh state record
    saying it is not playing, and the pause would be skipped on exactly the two
    players the duplicate-audio report came through.

    An `about:blank` frame is excluded by playableFrames() until the assignment
    happens, so this watches for that assignment directly.
  */
  new MutationObserver(queueSweep).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src'],
  });

  sweep();
}
