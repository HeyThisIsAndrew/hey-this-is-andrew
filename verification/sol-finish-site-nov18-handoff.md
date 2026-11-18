# Handoff prompt for the personal site

Continue the November 18 personal site work in `HeyThisIsAndrew/hey-this-is-andrew`. Start by inspecting the commit from `fix/sol-finish-site-nov18` and the current remote `main`. The personal Astro site is in `sites/hey-this-is-andrew`. The separate BE Unconventional HQ project is outside scope. The stale HQ directory in the monorepo is reference material only.

The implementation is complete. The homepage has Hero, Brands, Work, What I Do, Gear, Explore, and Newsletter in that order. Work combines the photo elevator and selected projects. Goals live on Build, and Latest is its own archive. The CCC gold hover and typography fixes, homepage brand glows and compact Gear carousel, single-viewport Brands deck, cinematic Gear deck, and Instagram permalink fallbacks are in place. Explore uses the shared FlipCard and each card has been clicked through. Mobile Brands uses a compact version of the existing footer. Gear shows the selected category deck, with individual purchase links behind each item's OPEN button and collection links under Shop the lists. The gear data and original links are intact.

The selector-level audit recorded 207 passing checks at 1440×900 and 390×844. The production build completed with the existing empty-projects collection warning. The site type check, unit tests, and 24-page dist audit passed. Two targeted Playwright runs for the changed homepage and Gear behavior each reported 34 passes, with some test overlap. [Selector-level verification](sol-finish-site-nov18-verification.md)

## Remaining testing

Reproduce and triage the broader Playwright failures on the same browser and server against this branch and the previous baseline commit `7f8c5970969456d804a4205dc61e10d94bd561b4`. Some older assertions already expected removed selectors or historical layouts. Fix regressions caused by this work. Keep unrelated test changes focused and document failures you can reproduce on the baseline. The full local run had already produced failing snapshots for Build page navigation, the older button-group rules, historical CCC layouts and inquiry flow, and the personal site's HQ hub navigation. The full run was still in progress when this handoff was drafted. Use the project's Astro preview server for the baseline comparison so a generic static server does not influence API and redirect tests.

From `sites/hey-this-is-andrew` run:

```sh
pnpm build
pnpm check
pnpm test
ASTRO_BASE=/hey-this-is-andrew/ pnpm test:dist
```

From the repository root run `pnpm exec playwright test`. Build only the personal site for this task. Check both requested viewport sizes on the locally built output. Preserve the approved PNG wordmark, sharp image and card edges, the brand-specific color treatment, the 220×38 storefront buttons, and existing content and links. Keep the site free of prices, dollar signs, and em dashes in page copy. Use the CCC email only on `/ccc/`. Route other contact CTAs to Andrew's personal address.

## Instagram originals still needed

No matching MP4 files were found in the working tree or Git history. All twelve tiles link to Instagram without play badges. If Andrew provides the originals, place the matching files in `sites/hey-this-is-andrew/public/reels/<Instagram ID>.mp4` and verify in-place playback from a production build. The loader already checks that path and only enables playback if the file exists. Use only originals supplied by Andrew.

| Instagram ID | Permalink |
| --- | --- |
| 18197799478384045 | [DdkhcU4porf](https://www.instagram.com/reel/DdkhcU4porf/) |
| 18094736273575574 | [DaLPStlSEmy](https://www.instagram.com/reel/DaLPStlSEmy/) |
| 18005708471883440 | [DXcH_cmEn4Z](https://www.instagram.com/reel/DXcH_cmEn4Z/) |
| 17944458501178308 | [DXZiXYOErQ_](https://www.instagram.com/reel/DXZiXYOErQ_/) |
| 18579368056058304 | [DXZe-okklnE](https://www.instagram.com/reel/DXZe-okklnE/) |
| 18173668864396491 | [DXWyYGnkqft](https://www.instagram.com/reel/DXWyYGnkqft/) |
| 18192834205320811 | [DXWvgpTkuIy](https://www.instagram.com/reel/DXWvgpTkuIy/) |
| 18431392336186342 | [DXVUNbSCbVw](https://www.instagram.com/reel/DXVUNbSCbVw/) |
| 17857359231689696 | [DXVTG9uCfGF](https://www.instagram.com/reel/DXVTG9uCfGF/) |
| 17946492177152784 | [DXPvRpwklRF](https://www.instagram.com/reel/DXPvRpwklRF/) |
| 18388148038088794 | [DXPrgi3gTS_](https://www.instagram.com/reel/DXPrgi3gTS_/) |
| 17888062341220268 | [DHdzrLyp7V5](https://www.instagram.com/reel/DHdzrLyp7V5/) |
