// Guards the 2026-10-02 round (Andrew's addendum): no visible search key
// hint, a footer logo that goes home, the brand view on phones, and the
// button standard. Each of these is easy to undo without noticing.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const ui = new URL('../../../packages/ui/src/', import.meta.url);
const read = (u) => fs.readFileSync(u, 'utf8');
const nav = read(new URL('Nav.astro', ui));
const footer = read(new URL('Footer.astro', ui));
const bacc = read(new URL('BrandAccordion.astro', ui));
const cta = read(new URL('styles/cta.css', ui));
const base = read(new URL('styles/base.css', ui));
const tokens = read(new URL('../../tokens/tokens.css', ui));
const search = read(new URL('../src/components/SiteSearch.astro', import.meta.url));
const navData = read(new URL('../src/data/nav.ts', import.meta.url));
const layout = read(new URL('../src/layouts/BaseLayout.astro', import.meta.url));

// 1. Search: no visible shortcut hint anywhere, the shortcut still bound.
assert.doesNotMatch(nav, /search\.shortcut|nav-search-key|mobile-search-key/, 'no key hint badge in the nav');
const trigger = navData.slice(navData.indexOf('export const SEARCH_TRIGGER'));
for (const key of ['label', 'ariaLabel', 'title', 'mobileText', 'mobileAria']) {
  const v = trigger.match(new RegExp(`\\b${key}: '([^']*)'`))?.[1] ?? '';
  assert.doesNotMatch(v, /⌘|Press |Ctrl|\(.*K\)/, `no shortcut wording in SEARCH_TRIGGER.${key}`);
}
assert.doesNotMatch(search, /<kbd|>ESC</, 'no key badges in the search modal');
assert.match(search, /\(e\.metaKey \|\| e\.ctrlKey\) && e\.key\.toLowerCase\(\) === 'k'/, 'Cmd/Ctrl+K still opens search');
assert.match(nav, /aria-keyshortcuts=\{search\.keyShortcuts\}/, 'the shortcut is announced to assistive tech');

// 2. Footer logo: a link home, named, 170px wide on phones.
assert.match(footer, /<a class="footer-home" href=\{homeHref\} aria-label=\{homeLabel\}>/, 'the footer logo links home');
assert.match(footer, /homeLabel = `\$\{logo\.alt\}, home`/, 'its name is "<alt>, home"');
assert.match(footer, /\.footer-logo \{\s*width: 170px;/, 'the footer logo is 170px wide on phones');
assert.match(layout, /homeHref=\{homeUrl\}\s*tagline=/, 'the site passes homeHref to the footer');

// 3. Brand view: on at every width, any brand opens it, Back closes it.
assert.doesNotMatch(bacc, /fullscreen && !mobile\.matches|!fullscreen \|\| mobile\.matches/, 'the brand view is not desktop-only');
assert.match(bacc, /function viewBrand\(i: number\)/, 'a tap on any brand goes into its view');
assert.match(bacc, /history\.pushState\(\{ \.\.\.\(history\.state \?\? \{\}\), baccView: true \}/, 'the view takes a history entry (Back closes it)');
assert.match(bacc, /addEventListener\('touchmove', noScroll, \{ passive: false \}\)/, 'the page cannot pan behind the view (iOS)');
assert.match(bacc, /\.bacc-viewport\.is-zoomed\.is-fill::before \{[^}]*background: #000;/, 'the band behind the status bar is solid black');
assert.match(bacc, /overflow-anchor: none;/, 'the accordion is never a scroll anchor (the page jumped as the view opened)');
assert.doesNotMatch(bacc, /bacc-close-key|closeKey|\(Esc\)/, 'no Esc key hint on the brand view Close (Esc still closes)');
assert.match(bacc, /e\.key === 'Escape' && camera\.isZoomed/, 'Esc still closes the brand view');
assert.match(layout, /dataset\.viewPop\) return;/, "the layout's popstate leaves the scroll alone for the view's Back");

// 4. Button standard: one set of tokens, one focus ring.
for (const t of ['--ui-u', '--btn-h-md', '--btn-h-sm', '--btn-px-md', '--btn-px-sm', '--btn-fs-md', '--btn-fs-sm', '--btn-ls', '--btn-radius']) {
  assert.match(tokens, new RegExp(`${t}:`), `token ${t} is defined`);
}
assert.match(cta, /\.btn \{[^}]*min-height: var\(--btn-h-md\);[^}]*font-size: var\(--btn-fs-md\);[^}]*letter-spacing: var\(--btn-ls\);/, '.btn is the md size');
assert.match(cta, /\.btn--sm \{[^}]*min-height: var\(--btn-h-sm\);/, '.btn--sm is the sm size');
assert.doesNotMatch(cta, /padding: 1rem 2\.75rem/, 'no rem-sized button padding (it drifted with the root scale)');
assert.match(base, /:focus-visible \{\s*outline: 2px solid var\(--focus-ring\);/, 'one focus ring, in the focus-ring colour (not --key-ink, black here)');
const filterTabs = read(new URL('FilterTabs.astro', ui));
assert.match(filterTabs, /min-height: var\(--btn-h-sm\);/, 'filter tabs are the sm size');
assert.doesNotMatch(filterTabs, /padding: 0 1\.1rem/, 'filter tabs have the standard padding, not 0 vertical');
const global = read(new URL('../src/styles/global.css', import.meta.url));
assert.match(global, /\.back-to-top \{[^}]*width: var\(--btn-h-md\);[^}]*padding: 0;/, 'back-to-top is a square md control with no UA padding');

// 5. The one-pass fixes (Andrew, 2026-10-02, "shippable").
const pageNav = read(new URL('PageNav.astro', ui));
assert.match(pageNav, /window\.scrollTo\(\{ top: 0, behavior \}\)/, 'the side panel Top link scrolls to 0');
assert.match(pageNav, /list\.prepend\(li\)/, 'a page without a Top heading gets a Top entry (e.g. /work)');
assert.match(layout, /if \(e\.defaultPrevented\) return;/, "the layout's hash handler leaves a link a component already handled");
assert.doesNotMatch(nav, /nav-search-label/, 'the search trigger is the icon only, no SEARCH text');
assert.match(nav, /\.nav-search-btn \{[^}]*border: 0;[^}]*\}/, 'the search trigger has no border or box');
assert.match(nav, /aria-current=\{isCurrent\(l\.href\) \? 'page' : undefined\}/, 'a page link is current on its own page only');
assert.match(nav, /data-spy=/, 'the home scrollspy lights only a link whose own section is current');
assert.doesNotMatch(nav, /currentActiveId/, 'the old sticky scrollspy (About lit through What I do) is gone');
assert.match(navData, /label: 'Gear',[\s\S]*?spy: \['gear'\]/, 'Gear: one label, lit at the Gear section');
assert.doesNotMatch(navData, /Production & Gear|'The Kit'|Meet Andrew/, 'one name per destination in the nav');
assert.match(bacc, /--logo-zone:/, 'the collapsed name is centred above the logo zone (CCC overlap)');
assert.match(bacc, /'copy logo'/, 'brand view: one stack bottom left, the logo bottom right');
assert.match(bacc, /'chips chips'/, 'brand view: the chips upper left');
const elevator = read(new URL('../src/components/PhotographyPortfolio.astro', import.meta.url));
assert.match(elevator, /data-video-url=\{p\.video \? p\.permalink : undefined\}/, 'elevator reels carry their Instagram link');
assert.match(elevator, /Watch video on Instagram/, 'a zoomed reel has a play path');

// 6. Mobile portrait round (Andrew, 2026-10-04).
assert.doesNotMatch(bacc, /if \(fullscreen && e\.detail > 0\) viewBrand\(i\)/, 'a closed brand only opens on the first tap (two steps)');
assert.match(bacc, /choose\(i\); \/\/ step one: open it/, 'step one opens the brand');
assert.match(bacc, /viewBrand\(i\); \/\/ step two: into its view/, 'step two goes into the view');
const about = read(new URL('../src/components/AboutSection.astro', import.meta.url));
assert.doesNotMatch(about, /about-bar-link/, 'no About Andrew link in the Meet The Creator bar');
assert.match(about, /<p class="about-punchline">BUILDING IN PUBLIC\.<\/p>/, 'the punchline is one line');
assert.doesNotMatch(about.split('<style>')[0], /—/, 'no em dashes in the About copy');
const now = read(new URL('../src/data/now.ts', import.meta.url));
assert.match(now, /NOW_MONTH = new Date\(\)\.toLocaleDateString\('en-US'/, 'the Now month is the build month, never typed by hand');
const nowItems = JSON.parse(read(new URL('../src/data/now.json', import.meta.url)));
assert.ok(Array.isArray(nowItems) && nowItems.length === 5 && nowItems.every((n) => n.label && n.value), 'now.json holds the five Now items');

// 7. The local CMS (phase 1): dev only, Now and Brands as JSON stores.
const astroCfg = read(new URL('../astro.config.mjs', import.meta.url));
assert.match(astroCfg, /localCms\(localCmsConfig\)/, 'the site wires the local CMS integration');
const integ = read(new URL('../../../packages/local-cms/src/integration.mjs', import.meta.url));
assert.match(integ, /if \(command !== 'dev'\) return;/, 'the CMS integration does nothing outside astro dev');
const brandsJson = JSON.parse(read(new URL('../src/data/brands.json', import.meta.url)));
assert.ok(Array.isArray(brandsJson) && brandsJson.length >= 1 && brandsJson.every((b) => b.id && b.name && b.headline), 'brands.json holds the brand panels');
assert.ok(brandsJson.filter((b) => b.accent === 'be-red').every((b) => b.id === 'be'), 'red only on the BE Unconventional HQ panel');

// 8. The local CMS (final): every content store is JSON the CMS edits, and
// images resolve through one function whichever host holds them.
const contentCfg = read(new URL('../src/content.config.ts', import.meta.url));
for (const c of ['projects', 'goals', 'gear']) {
  assert.match(contentCfg, new RegExp(`file\\('src/data/${c}\\.json'\\)`), `${c} loads from src/data/${c}.json`);
  const docs = JSON.parse(read(new URL(`../src/data/${c}.json`, import.meta.url)));
  assert.ok(Array.isArray(docs) && docs.length >= 1 && docs.every((d) => /^[a-z0-9-]+$/.test(d.id)), `${c}.json holds entries with slug ids`);
  assert.match(read(new URL('../local-cms.config.mjs', import.meta.url)), new RegExp(`file: 'src/data/${c}\\.json'`), `the CMS edits ${c}.json`);
}
assert.ok(!fs.existsSync(new URL('../src/content', import.meta.url)), 'no Markdown content folder left beside the JSON stores');
const imagesTs = read(new URL('../src/data/images.ts', import.meta.url));
assert.match(imagesTs, /resolveImage\(/, 'images resolve through @andrew/local-cms resolveImage');
assert.match(astroCfg, /domains: \['cdn\.sanity\.io'\]/, 'Astro may optimise Sanity-hosted images');

console.log('controls: ok');
