/**
 * Section tags line up with the header logo (Andrew, 2026-11-19): every
 * element marked [data-align-logo] (SectionHeader's chip, the gear
 * spotlight's tags) gets its left edge moved onto the left edge of the nav
 * wordmark. The two sit on different measures (the nav row's own inset vs
 * the page's .container, which stops at --maxw), so CSS alone cannot match
 * them at every width; this measures both and closes the gap.
 *
 * Only a small correction is applied (at most MAX_SHIFT px). A tag that
 * starts far from the page edge is inside a column or a card, where lining
 * it up with the logo would pull it out of its box, so it is left alone.
 */
const MAX_SHIFT = 96;

function align(): void {
  const logo = document.querySelector<HTMLElement>('.site-nav .wordmark');
  if (!logo) return;
  const target = logo.getBoundingClientRect().left;
  document.querySelectorAll<HTMLElement>('[data-align-logo]').forEach((el) => {
    el.style.marginLeft = '';
    if (el.getClientRects().length === 0) return; // not rendered
    const shift = Math.round(target - el.getBoundingClientRect().left);
    if (shift !== 0 && Math.abs(shift) <= MAX_SHIFT) el.style.marginLeft = `${shift}px`;
  });
}

let frame = 0;
const schedule = () => {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(align);
};

export function initAlignToLogo(): void {
  schedule();
  document.fonts?.ready.then(schedule).catch(() => {});
  const w = window as typeof window & { __alignToLogo?: boolean };
  if (w.__alignToLogo) return;
  w.__alignToLogo = true;
  window.addEventListener('resize', schedule, { passive: true });
  document.addEventListener('astro:page-load', schedule);
  // A view that reveals hidden tags (the gear page's Show all) asks again.
  window.addEventListener('andrew:align-to-logo', schedule);
}
