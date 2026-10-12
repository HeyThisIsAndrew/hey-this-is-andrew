#!/usr/bin/env node
/**
 * contrast.mjs: WCAG 2.2 contrast for every text/background pair the theme
 * uses, in both colour schemes. Run with `npm run test:contrast`; it exits 1
 * if any pair is under its minimum (4.5:1 body text, 3:1 large text / UI).
 * Keep the values in step with src/styles/theme.css.
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
    app: { bg: '#262624', text: '#ecebe7', text2: '#a9a8a2', muted: '#929189' },
    buttons: [['#f5f5f7', '#000000'], ['#f0b44c', '#120c02']],
  },
  light: {
    bgs: { page: '#ffffff', lift: '#f5f5f7', tile: '#f5f5f7', panel: '#f7f7f8', app: '#ffffff' },
    text: { ink: '#1d1d1f', ink2: '#424245', ink3: '#6e6e73', ink4: '#6a6a6f', amber: '#8f4f00', ok: '#1a7f37', bad: '#c4291c', warn: '#8a5300', info: '#0a5fc2' },
    large: { gradEnd: '#b23a10', silverEnd: '#6e6e73' },
    app: { bg: '#ffffff', text: '#1f1e1d', text2: '#5f5e59', muted: '#75746e' },
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
  for (const [tn, fg] of Object.entries(s.app)) {
    if (tn === 'bg') continue;
    const r = ratio(fg, s.app.bg);
    if (r < 4.5) { bad++; console.log(`✗ ${name} app ${tn}: ${r.toFixed(2)}`); }
  }
  for (const [bg, fg] of s.buttons) {
    const r = ratio(fg, bg);
    if (r < 4.5) { bad++; console.log(`✗ ${name} button ${fg} on ${bg}: ${r.toFixed(2)}`); }
  }
}
console.log(bad ? `${bad} pairs under WCAG 2.2 AA` : '✓ Every theme text pair meets WCAG 2.2 AA in light and dark.');
process.exit(bad ? 1 : 0);
