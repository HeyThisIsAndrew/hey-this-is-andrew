/**
 * Collection artwork by naming convention: `src/assets/rows/<slug>-key-art.*`
 * and `<slug>-logo.*` (see src/assets/rows/README.md). Drop the files in and
 * the /feed shelf gets its banner; leave them out and it renders its text
 * lockup. A missing file is never an error.
 *
 * Moved out of FeedGrid.astro so the homepage's Featured section, which
 * mirrors that shelf, reads the SAME artwork (the show's own logo rather than
 * a typeset name) without a second copy of the lookup.
 *
 * `eager` because there are at most a handful and callers need the metadata
 * (width/height) synchronously to render without layout shift.
 */
const ROW_ART = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/rows/*.{jpg,jpeg,png,webp,avif}',
  { eager: true },
);

export function rowArt(name?: string): ImageMetadata | null {
  if (!name) return null;
  const hit = Object.entries(ROW_ART).find(
    ([path]) => path.split('/').pop()?.replace(/\.[^.]+$/, '') === name,
  );
  return hit ? hit[1].default : null;
}
