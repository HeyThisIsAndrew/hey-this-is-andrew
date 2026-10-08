/**
 * ─── A STAGE PANE IS ONE CONTROL, ART INCLUDED ─────────────────────────────
 *
 * The /feed hero, the category heroes, the hub page and both event templates
 * all show the rail item a reader picked as a pane on the stage: its still,
 * its kind, its title and ONE control, "Play" (a <button data-action=
 * "play-trailer">) or "Read" (an <a href>). Reported from a user test:
 * readers tapped the still, which is most of the pane, and nothing happened;
 * only the small button in its corner worked.
 *
 * A CSS stretch cannot reach the still. The control sits in
 * `.hub-stage-item-copy`, which is itself absolutely positioned (it is how the
 * copy is pinned to the pane's foot), so a stretched `::after` would cover the
 * copy block only. And the control is not one element: FeedSpotlightHero
 * REBUILDS it, button for a video and link for an article, every time the
 * rail changes. So the pane forwards a tap to whatever control it holds right
 * now, which is by construction the pane's one destination.
 *
 * Mouse and touch only: the control itself stays the keyboard and screen
 * reader path, one tab stop, its own name. A tap on the control, or on any
 * other link or button inside the pane, is left alone.
 *
 * Delegated from the document and bound once, like stage-watch-link.ts, so it
 * covers every stage, including ones that arrive with a client-side
 * navigation, from one place. Four components share the pane markup, and a
 * fix that lands in one of them is how the rest get missed (CLAUDE.md).
 */
export function initStageItemTap() {
  if ((window as any).__hqStageItemTapBound) return;
  (window as any).__hqStageItemTapBound = true;

  document.addEventListener('click', (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0) return;
    const target = event.target as Element | null;
    const pane = target?.closest?.('.hub-stage-item.active');
    if (!pane) return;
    if (target!.closest('a[href], button, [role="button"], input, select, textarea, label')) return;
    const action = pane.querySelector<HTMLElement>('.hub-stage-item-action');
    if (!action) return;
    action.click();
  });
}
