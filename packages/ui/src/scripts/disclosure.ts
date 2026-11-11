/** One transition lifecycle for shared disclosures. Interrupted motion settles only its latest state. */
const updates = new WeakMap<HTMLElement, number>();

export async function setDisclosureOpen(element: HTMLElement, open: boolean): Promise<boolean> {
  const update = (updates.get(element) ?? 0) + 1;
  updates.set(element, update);
  if (open && element.hidden) {
    element.hidden = false;
    // Establish the closed frame before starting a transition from display:none.
    void element.offsetHeight;
  }
  element.inert = !open;
  element.dataset.open = String(open);
  // Reading computed geometry starts the CSS transition before collecting it.
  void element.offsetHeight;
  await Promise.allSettled(element.getAnimations().map((animation) => animation.finished));
  if (updates.get(element) !== update) return false;
  if (!open && element.hasAttribute('data-hide-closed')) element.hidden = true;
  element.dispatchEvent(new CustomEvent('disclosure:settled', { bubbles: true, detail: { open } }));
  return true;
}
