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

console.log('controls: ok');
