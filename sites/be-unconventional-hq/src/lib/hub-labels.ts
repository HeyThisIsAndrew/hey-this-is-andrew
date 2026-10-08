/**
 * Hub taxonomy labels: what a /featured row is called, and what ONE hub in it
 * is called.
 *
 * ─── WHY THIS IS ITS OWN FILE ──────────────────────────────────────────────
 * These were in local-content.ts, which statically imports videos.json. That
 * is fine under Astro and Vite and fails under plain `node`, which is what
 * runs the offline suites in scripts/ — so the labels could not be tested at
 * all. They are pure data about pure data; nothing here reads the store.
 *
 * local-content.ts re-exports both, so every existing import still works.
 */

/**
 * The four rows on /featured, and what each is called.
 *
 * Shared rather than declared twice, because a hub page now shows the row it
 * was reached from — and a label that disagrees with the row you just clicked
 * is worse than no label. Adding a hub is a data change; adding a CATEGORY is
 * a design decision, which is why this stays in code.
 */
export const HUB_CATEGORY_LABELS: Record<string, string> = {
  /*
    THE KEY STAYS `universes`. ONLY THE LABEL CHANGES.

    "The Multiverse" was inaccurate for half of what it labelled: the row is
    DC, Marvel, Star Wars and Harry Potter, and two of those are not
    multiverses in any sense. "Franchises" is true of all four and is the
    term the trade press uses.

    Renaming the KEY would mean rewriting `hubCategory` on every brand in
    videos.json for nothing a reader can see, so it stays. The keys are
    internal — they are a field on the document, never a route segment — so
    nothing about this rename touches a URL.
  */
  universes: 'Franchises',
  streaming: 'Streamers',
  studios: 'Studios',

  /*
    `gaming` follows the same rule for the same reason: the key is a document
    field, so it stays, and only the label moved to "Games".

    Do not read that as "the Games rename touched nothing." It is the HUB
    taxonomy that costs nothing here. The site-wide CONTENT category of the
    same name is a different taxonomy that happens to share the word, and it
    IS a route segment: /category/gaming had to be 301'd to /category/games,
    and /intel/topic/gaming with it. Both redirects are in astro.config.mjs.
    See issue #146.
  */
  gaming: 'Games',
};

/**
 * What ONE hub is called, in the singular, for the "Official <X> Hub" card
 * that event and article pages show when a piece is associated with a brand.
 *
 * ─── WHY THIS IS NOT DERIVED FROM HUB_CATEGORY_LABELS ──────────────────────
 * The row labels above are plural and this needs the singular, so the obvious
 * move is to chop an "s" off. That is right three times out of four and
 * wrong on the fourth, which is exactly the kind of thing that ships:
 *
 *     Franchises -> Franchise   OK
 *     Streamers  -> Streamer    OK
 *     Studios    -> Studio      OK
 *     Games      -> Game        "Official Game Hub" for PlayStation
 *
 * So the singular forms are written out. `gaming` reads "Gaming" rather than
 * "Game" because its hubs are platforms, not titles.
 *
 * The heading was hardcoded as "Official Franchise Hub" on both event
 * templates, which called Netflix a franchise on every event it backed.
 */
export const HUB_KIND_LABELS: Record<string, string> = {
  universes: 'Franchise',
  streaming: 'Streamer',
  studios: 'Studio',
  gaming: 'Games',
};

/**
 * The heading for a hub card: "Official Streamer Hub", "Official Studio Hub".
 *
 * An unrecognised or missing `hubCategory` falls back to a plain "Official
 * Hub" rather than guessing. A hub whose category was never set is a data
 * gap, and naming it wrongly hides the gap behind something that reads fine.
 */
export function getHubKindHeading(brand: any): string {
  const kind = HUB_KIND_LABELS[brand?.hubCategory as string];
  return kind ? `Official ${kind} Hub` : 'Official Hub';
}
