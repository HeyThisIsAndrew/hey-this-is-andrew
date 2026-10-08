/**
 * Start a jsapi YouTube embed with ONE press: wait for the player to be ready,
 * then ask it to play, and keep asking until it does.
 *
 * ─── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * The homepage hero and the /feed hero both posted `listening` and then
 * `playVideo` on the iframe's `load` event. `load` means the embed DOCUMENT
 * has loaded; YouTube's player inside it boots a few hundred milliseconds
 * later and only then attaches its message listener (measured: `load` at
 * ~3800ms, `onReady` at ~4100ms). Both messages went to nobody, the player
 * idled at state 5 (cued) and showed its own big play button, and the reader
 * had to press play twice (Andrew; investigated with a message-channel trace).
 * The homepage Featured box never had the bug because the IFrame API waits
 * for `onReady` for it.
 *
 * So: offer the `listening` handshake until the player answers, send
 * `playVideo` when it reports ready, and re-send it until the player reports
 * PLAYING (state 1). Nothing here puts `autoplay=1` in a URL (CLAUDE.md hard
 * rule 11): the embed is still started by a command after a reader's press.
 *
 * ─── WHAT IT CANNOT DO ───────────────────────────────────────────────────────
 * iOS Safari only starts unmuted media inside the reader's own gesture, and a
 * command arriving by postMessage is not one. Where the browser refuses, the
 * player stays cued with its own play button showing, which is one more tap
 * and never a dead end. The retries stop at the first sign of playback, on an
 * `onError`, or after `giveUpMs`, whichever comes first.
 *
 * Pausing is not this module's job (hard rule 12, src/lib/embed-pause.ts).
 */

const PLAYER_ORIGIN = 'https://www.youtube-nocookie.com';
const PLAYING = 1;

export interface PlayWhenReadyOptions {
  /** Called exactly once: when the player first reports ready, or, if it
      never does, when this gives up. Callers reveal the frame here, so its
      blank document never flashes over the artwork AND a frame that never
      answers (an error page, a blocked network) is still shown, not left
      invisible over the art. */
  onReady?: () => void;
  /** Stop retrying after this long, whatever state the player is in. */
  giveUpMs?: number;
  /** Call onReady by this point even if the player has not answered, so a
      hidden frame is never kept off screen for the full giveUpMs. */
  revealAfterMs?: number;
  /** How often to re-offer the handshake before the player has answered. */
  handshakeEveryMs?: number;
  /** How often to re-send `playVideo` until the player reports playing. */
  retryEveryMs?: number;
}

/**
 * Call right after assigning the frame's `src` (before or after it is in the
 * document). Returns a function that cancels everything, for when the frame
 * is removed or replaced before it ever played.
 */
export function playWhenReady(frame: HTMLIFrameElement, options: PlayWhenReadyOptions = {}): () => void {
  const { onReady, giveUpMs = 8000, revealAfterMs = 3000, handshakeEveryMs = 250, retryEveryMs = 700 } = options;

  let finished = false;
  let ready = false;
  let handshakeTimer: ReturnType<typeof setInterval> | undefined;
  let retryTimer: ReturnType<typeof setInterval> | undefined;

  const send = (payload: Record<string, unknown>) => {
    frame.contentWindow?.postMessage(JSON.stringify(payload), PLAYER_ORIGIN);
  };
  const offerHandshake = () => send({ event: 'listening', id: 1, channel: 'widget' });
  const askToPlay = () => send({ event: 'command', func: 'playVideo', args: [], id: 1, channel: 'widget' });

  let revealed = false;
  const reveal = () => {
    if (revealed) return;
    revealed = true;
    onReady?.();
  };

  /* `show` is false only for the caller's cancel: a frame being taken down
     is not revealed on the way out. */
  function finish(show = true) {
    if (finished) return;
    finished = true;
    if (show) reveal();
    clearInterval(handshakeTimer);
    clearInterval(retryTimer);
    clearTimeout(giveUpTimer);
    clearTimeout(revealTimer);
    window.removeEventListener('message', onMessage);
    frame.removeEventListener('load', onLoad);
  }

  function onMessage(event: MessageEvent) {
    /* Only this frame's own player: any page can postMessage to any window. */
    if (event.origin !== PLAYER_ORIGIN || event.source !== frame.contentWindow) return;

    let payload: any;
    try {
      payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    } catch {
      return;
    }
    if (!payload || typeof payload !== 'object') return;

    if (!ready && (payload.event === 'onReady' || payload.event === 'initialDelivery')) {
      ready = true;
      clearInterval(handshakeTimer);
      reveal();
      askToPlay();
      retryTimer = setInterval(askToPlay, retryEveryMs);
    }

    const state =
      payload.event === 'onStateChange' ? payload.info : payload.info?.playerState;
    if (state === PLAYING || payload.event === 'onError') finish();
  }

  function onLoad() {
    if (finished || frame.src === 'about:blank') return;
    offerHandshake();
    clearInterval(handshakeTimer);
    handshakeTimer = setInterval(offerHandshake, handshakeEveryMs);
  }

  window.addEventListener('message', onMessage);
  frame.addEventListener('load', onLoad);
  const giveUpTimer = setTimeout(() => finish(), giveUpMs);
  const revealTimer = setTimeout(reveal, revealAfterMs);

  return () => finish(false);
}
