/**
 * ─── ONE WIRING FOR THE EVENT AND HUB STAGES' ESCAPE LINK ──────────────────
 *
 * `/featured/[slug]`, EventFeatured and EventAnnouncement each carry a stage
 * that plays a trailer, and each was missed when the escape hatch was added to
 * the /feed hero and the card lightbox. The reader trapped by a YouTube
 * sign-in wall could have been on any of them.
 *
 * The three files are already near-identical triplets. CLAUDE.md records what
 * that costs over and over: two tag lists that drifted, two hero lockups that
 * had to be guarded in one test file, a fix that landed in one of two players
 * and looked finished. So the behaviour lives HERE, once, and those three
 * files carry only the markup plus the video id they already had in hand.
 *
 * ─── HOW IT KNOWS WHAT IS PLAYING ──────────────────────────────────────────
 *
 * Those stages already dispatch `hub:sourcechange` on themselves every time
 * they assign the frame a src. This listens for that and reads the id back off
 * THE FRAME, rather than off the event's detail.
 *
 * That is the whole reason it covers everything. There are FOUR such
 * assignments in each of the three files, not the two an obvious reading
 * finds: the ambient trailer that starts itself, its muted retry when the
 * browser refuses sound, the pressed-play path, and ITS muted retry. Threading
 * an id through the detail of all twelve is twelve chances to miss one, and
 * the ambient pair does not even have an id in scope. It holds a `data-src`.
 * The frame always knows what it is playing.
 *
 * `parseVideoId()` does the reading, per the codebase rule that ids are never
 * parsed by hand. It did not recognise a `youtube-nocookie.com/embed/` URL
 * until this landed, which is every embed the site actually serves.
 *
 * Delegated from the document and bound once, so it covers stages that arrive
 * with a client-side navigation without re-binding per page.
 */
import { parseVideoId } from './platforms/youtube.ts';

/*
 * ─── WHICH VIDEO, AND WHERE THE LINK LIVES (2026-09) ──────────────────────
 *
 * The link used to be stage chrome, bottom left, which is where every rail
 * pane puts its own Play / Read button: the two overlapped on every screen.
 * It now sits in the hero's action row beside Play trailer, OUTSIDE the stage,
 * so it is found through the hero both share, not inside the stage.
 *
 * It names the video the stage is SHOWING, which is one of two things:
 *   - a rail pane is up (`is-item`): that pane's video, or nothing for an
 *     article pane. Nothing is loaded in the frame then (show() unloads it),
 *     so the pane is the only thing on screen to name;
 *   - otherwise: whatever the frame is playing, read off the frame.
 * And never the hub's own trailer (`data-trailer` on the stage). The owner's
 * call: the trailer is its own thing, with Play trailer as its control.
 *
 * Panes switch without any `hub:sourcechange` (picking a rail card changes
 * classes and unloads the frame), so each stage is also watched for class
 * changes beneath it. Cheap: the stage's classes change on a click or at a
 * state change, not per frame.
 */

/** The escape link for a given stage, if its hero has one. */
function linkFor(stage: Element): HTMLAnchorElement | null {
  const hero = stage.closest('.hero-grid-container') ?? stage.parentElement;
  return hero?.querySelector<HTMLAnchorElement>('.hub-stage-watch') ?? null;
}

/** The id of the video the stage is showing, or null (nothing, an article, or the trailer). */
function shownVideoId(stage: HTMLElement): string | null {
  let videoId: string | null;
  if (stage.classList.contains('is-item')) {
    const pane = stage.querySelector<HTMLElement>('.hub-stage-item.active');
    videoId = parseVideoId(pane?.querySelector<HTMLElement>('[data-hub-play]')?.dataset.hubPlay ?? null);
  } else {
    /*
      The frame is the source of truth. `about:blank` and a src the parser
      does not recognise both yield null: there is nothing to point it at.
    */
    const frame = stage.querySelector<HTMLIFrameElement>('.hub-stage-iframe');
    videoId = parseVideoId(frame?.src ?? null);
  }
  const trailer = parseVideoId(stage.dataset.trailer ?? null);
  return videoId && videoId !== trailer ? videoId : null;
}

function sync(stage: HTMLElement) {
  const link = linkFor(stage);
  if (!link) return;
  const videoId = shownVideoId(stage);
  if (!videoId) {
    link.hidden = true;
    return;
  }
  /*
    encodeURIComponent, not the raw id: these come from `data-hub-play`,
    which is filled from content, and a watch URL is a link this page hands
    a visitor.
  */
  link.href = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  link.hidden = false;
}

const watched = new WeakSet<Element>();

/** Watch each stage on the page for pane switches. Run on every page load. */
function observeStages() {
  document.querySelectorAll<HTMLElement>('.hub-stage').forEach((stage) => {
    if (watched.has(stage) || !linkFor(stage)) return;
    watched.add(stage);
    new MutationObserver(() => sync(stage)).observe(stage, {
      attributes: true,
      attributeFilter: ['class'],
      subtree: true,
    });
    sync(stage);
  });
}

export function initStageWatchLink() {
  observeStages();
  if ((window as any).__hqStageWatchBound) return;
  (window as any).__hqStageWatchBound = true;

  /*
    `hub:sourcechange` is dispatched on the stage element and does not bubble
    in the callers, so this listens in the CAPTURE phase at the document,
    which sees it on the way down regardless.
  */
  document.addEventListener(
    'hub:sourcechange',
    (event: Event) => {
      const stage = event.target;
      if (stage instanceof HTMLElement) sync(stage);
    },
    true,
  );
}
