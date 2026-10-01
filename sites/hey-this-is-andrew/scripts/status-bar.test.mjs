// Guards the phone status bar (the Dynamic Island area). It must stay black,
// the way BE Unconventional HQ does it, and it has regressed before.
//
// HQ's mechanism (its src/layouts/Layout.astro and styles/modules/navbar.css,
// responsive-mobile.css): the header is `position: fixed` at the top of the
// screen with a black background, on HQ's exact viewport tag (no
// viewport-fit=cover). iOS Safari 26 colours the status bar from a fixed
// header touching the top; it does not read theme-color, and it does not
// count a `sticky` header. A previous version made the header sticky and
// painted the strip itself under viewport-fit=cover: the page showed through
// on an iPhone 17 Pro Max.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const ui = new URL('../../../packages/ui/src/', import.meta.url);
const nav = fs.readFileSync(new URL('Nav.astro', ui), 'utf8');
const meta = fs.readFileSync(new URL('ChromeMeta.astro', ui), 'utf8');
const layout = fs.readFileSync(new URL('../src/layouts/BaseLayout.astro', import.meta.url), 'utf8');

const rule = (src, selector) => {
  const m = src.match(new RegExp(`\\n\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`));
  return m ? m[1] : '';
};

// 1. The header is fixed at the top, at every width.
const bar = rule(nav, '.site-nav');
assert.match(bar, /position:\s*fixed/, '.site-nav must be position: fixed (HQ #navbar), never sticky');
assert.match(bar, /top:\s*0/, '.site-nav must sit at top: 0');
assert.doesNotMatch(nav, /\.site-nav\s*\{[^}]*position:\s*sticky/, 'no sticky .site-nav rule');

// 2. A spacer holds its place, sized by the inline height script.
assert.match(nav, /class="site-nav-spacer"/, 'the fixed header needs its spacer');
assert.match(nav, /<script is:inline>[\s\S]*--nav-bar-h/, 'the bar height must be published inline, right after the header');

// 3. On phones the header is solid black with no blur.
const phone = nav.match(/@media \(max-width: 860px\), \(orientation: landscape\) and \(max-height: 500px\) \{([\s\S]*?)\n  \}/);
assert.ok(phone, 'the phone header rule must exist');
assert.match(phone[1], /background:\s*var\(--chrome, #000\)/, 'phone header background is the chrome colour');
assert.match(phone[1], /backdrop-filter:\s*none/, 'no blur on the phone header');

// 4. HQ's exact viewport tag, theme-color black, used by the layout.
assert.doesNotMatch(meta.replace(/\/\*[\s\S]*?\*\//g, ''), /viewport-fit=cover/, 'HQ has no viewport-fit=cover');
assert.match(meta, /color = '#000000'/, 'theme-color must default to black');
assert.match(layout, /<ChromeMeta/, 'the layout must use ChromeMeta');

console.log('status-bar: ok');
