/**
 * `sizes` for the Intel spread's FEATURE image (the large centre story).
 *
 * ONE constant, because three places need it and they had drifted: it was
 * written out in both ArticleThumb and IntelMagazine, and IntelLayout's LCP
 * preload carried an older copy without the big-screen steps. A preload whose
 * `imagesizes` disagrees with the <img>'s `sizes` makes the browser pick two
 * different files on a wide screen, so the preload became a second download
 * (the global QA sweep, rule 1, found it on /intel and every topic page).
 *
 * The numbers are the column's measured widths rounded up; they track
 * `--page-max` in modules/layout.css and the `.intel-magazine` proportions in
 * modules/intel.css, which all change at the same breakpoints.
 */
export const INTEL_FEATURE_SIZES =
  '(max-width: 900px) 92vw, ' +
  '(min-width: 3400px) 1180px, (min-width: 2560px) 1050px, (min-width: 1920px) 970px, 720px';
