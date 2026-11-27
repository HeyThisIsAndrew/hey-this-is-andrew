#!/usr/bin/env node
/**
 * contrast.mjs: WCAG 2.2 contrast for every text/background pair the theme
 * uses, in both colour schemes. Run with `npm run test:contrast`; it exits 1
 * if any pair is under its minimum (4.5:1 body text, 3:1 large text / UI).
 * Keep the values in step with src/styles/theme.css (and, for the glass
 * layers, the app's reelay/gui/theme.py THEMES["glass"]).
 */
const lum = (hex) => {
  const c = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const SCHEMES = {
  dark: {
    bgs: { page: '#000000', lift: '#0a0a0b', tile: '#111113', panel: '#141416', app: '#262624' },
    text: { ink: '#f5f5f7', ink2: '#a1a1a6', ink3: '#8e8e93', ink4: '#808085', amber: '#f5c56b', ok: '#5fe08a', bad: '#ff8a80', warn: '#ffb648', info: '#64b5ff' },
    large: { gradEnd: '#e8913a', silverEnd: '#9a9aa0' },
    buttons: [['#f5f5f7', '#000000'], ['#f0b44c', '#120c02']],
  },
  light: {
    bgs: { page: '#ffffff', lift: '#f5f5f7', tile: '#f5f5f7', panel: '#f7f7f8', app: '#ffffff' },
    text: { ink: '#1d1d1f', ink2: '#424245', ink3: '#6e6e73', ink4: '#6a6a6f', amber: '#8f4f00', ok: '#1a7f37', bad: '#c4291c', warn: '#8a5300', info: '#0a5fc2' },
    large: { gradEnd: '#b23a10', silverEnd: '#6e6e73' },
    buttons: [['#1d1d1f', '#ffffff'], ['#a3580a', '#ffffff']],
  },
};

let bad = 0;
for (const [name, s] of Object.entries(SCHEMES)) {
  for (const [bn, bg] of Object.entries(s.bgs)) {
    if (bn === 'app') continue;
    for (const [tn, fg] of Object.entries(s.text)) {
      const r = ratio(fg, bg);
      if (r < 4.5) { bad++; console.log(`✗ ${name} ${tn} on ${bn}: ${r.toFixed(2)}`); }
    }
    for (const [tn, fg] of Object.entries(s.large)) {
      const r = ratio(fg, bg);
      if (r < 3) { bad++; console.log(`✗ ${name} large ${tn} on ${bn}: ${r.toFixed(2)}`); }
    }
  }
  for (const [bg, fg] of s.buttons) {
    const r = ratio(fg, bg);
    if (r < 4.5) { bad++; console.log(`✗ ${name} button ${fg} on ${bg}: ${r.toFixed(2)}`); }
  }
}
// The app renderings: Spatial Glass, the same in both site schemes (theme.css,
// "The app: Spatial Glass"). Every translucent layer is checked as it looks,
// composited over each stop of the glass canvas. ink >= 7, ink-2 >= 4.5,
// muted >= 3; status and accent text >= 4.5; glyphs on buttons and badges >= 4.5.
{
  const hex = (h) => h.replace('#', '').match(/../g).map((x) => parseInt(x, 16));
  const toHex = (a) => '#' + a.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const over = (rgb, a, bg) => toHex(rgb.map((v, i) => v * a + hex(bg)[i] * (1 - a)));
  const CANVAS = ['#141c39', '#0f1526', '#0b0f17', '#131427'];
  const INK = { ink: ['#f2f6fc', 7], ink2: ['#aebcd4', 4.5], muted: ['#8e9fbc', 3] };
  const STATUS = { accent: '#4da3ff', ok: '#5ad670', bad: '#ff8078', warn: '#f2b84b', info: '#58a6ff' };
  const layers = {};
  for (const c of CANVAS) {
    const panelTop = over([32, 38, 51], 0.88, c);
    layers[`canvas ${c}`] = c;
    layers[`panel ${c}`] = panelTop;
    layers[`panel foot ${c}`] = over([19, 25, 38], 0.80, c);
    layers[`well ${c}`] = over([11, 15, 23], 0.42, c);
    layers[`sidebar ${c}`] = over([32, 38, 51], 0.66, c);
    layers[`nav pill ${c}`] = over([242, 246, 252], 0.17, over([32, 38, 51], 0.66, c));
    layers[`row in panel ${c}`] = over([242, 246, 252], 0.05, panelTop);
    layers[`field in panel ${c}`] = over([11, 15, 23], 0.42, panelTop);
  }
  // A hovered card's top stop (#353b47) lies under its thumbnail: text starts
  // below the picture, where the hovered fill is #293142 or darker.
  Object.assign(layers, { 'card top': '#282e3b', 'card mid': '#1c2436', 'card hover mid': '#293142', raised: '#1c2436', surface: '#131926', hover: '#253047', 'chip on': '#28384f', 'chip on foot': '#1b2c44', button: '#2d3546', 'caption card': '#272e40' });
  for (const [ln, bg] of Object.entries(layers)) {
    for (const [tn, [fg, min]] of Object.entries(INK)) {
      const r = ratio(fg, bg);
      if (r < min) { bad++; console.log(`✗ glass ${tn} on ${ln}: ${r.toFixed(2)} (needs ${min})`); }
    }
    if (ln.startsWith('nav pill')) continue;   // only ink sits on the nav pill
    for (const [tn, fg] of Object.entries(STATUS)) {
      const r = ratio(fg, bg);
      if (r < 4.5) { bad++; console.log(`✗ glass ${tn} on ${ln}: ${r.toFixed(2)}`); }
    }
  }
  // The checked segment is a gradient, #545b69 at the top -> #474e5e at the
  // foot (theme.py glass_tokens segment_on): ink is 6.29:1 on the top stop and
  // 7.69:1 on the foot. It carries only a control label, so 4.5:1 is its bar;
  // the top stop doesn't reach the 7:1 ink target (see APP_DESIGN_BRIEF.md).
  for (const [fg, bg, min, what] of [
    ['#f2f6fc', '#545b69', 4.5, 'ink on the checked segment (top)'],
    ['#f2f6fc', '#474e5e', 4.5, 'ink on the checked segment (foot)'],
    ['#aebcd4', '#2d3546', 4.5, 'ink-2 on an unchecked segment'],
    ['#5ad670', '#203b33', 4.5, 'Connected pill'],
    ['#f2b84b', '#3b362d', 4.5, 'Needs attention pill'],
    ['#aebcd4', '#1c2436', 4.5, 'Not connected / Posted by hand pill'],
    ['#4da3ff', '#1b2c44', 4.5, 'accent on accent-soft (Mine, on)'],
    ['#07111f', '#4da3ff', 3, 'on-accent play glyph'],
    ['#07111f', '#70b6ff', 4.5, 'on-accent on primary (top)'],
    ['#07111f', '#4da3ff', 4.5, 'on-accent on primary (bottom)'],
    ['#0b0f17', '#5ad670', 4.5, 'badge ink on ok'],
    ['#0b0f17', '#58a6ff', 4.5, 'badge ink on info'],
    ['#0b0f17', '#ff8078', 4.5, 'badge ink on bad'],
    ['#0b0f17', '#aebcd4', 4.5, 'badge ink on ready'],
  ]) {
    const r = ratio(fg, bg);
    if (r < min) { bad++; console.log(`✗ glass ${what}: ${r.toFixed(2)}`); }
  }
}
console.log(bad ? `${bad} pairs under WCAG 2.2 AA` : '✓ Every theme text pair meets WCAG 2.2 AA in light and dark, and every Spatial Glass layer meets its target.');
process.exit(bad ? 1 : 0);
