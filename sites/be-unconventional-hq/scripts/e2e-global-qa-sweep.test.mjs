/**
 * THE GLOBAL QA SWEEP: site-wide rules, enforced on the BUILT site.
 *
 * Why this exists: this site is many layout components that solve the same
 * problems separately (seven YouTube players, three near-identical stage
 * templates, several card grids), and a fix applied to one of them was, again
 * and again, missing from the others: fullscreen on 2 of 7 players, the
 * sign-in-wall fix on 2 then 5, a 3840px original in three rails, four
 * "high priority" images on one page. Source tests check the component in
 * front of them; this checks what every page actually ships, so a rule holds
 * on pages nobody remembered to look at.
 *
 * It reads dist/client, so it is an e2e-* suite (scripts/e2e-harness.test.mjs:
 * nothing in `npm test` may read build output) and scripts/e2e-run.mjs picks
 * it up in the CI job that has already built. No browser, no server: every
 * page is parsed with node-html-parser, and the whole site takes seconds.
 * Run it alone after a build with `npm run test:dist`.
 *
 * WHAT IS DELIBERATELY NOT A RULE HERE, and why:
 *   - "No element may be aria-hidden with tabindex=-1 unless it is inert."
 *     That is not what axe's aria-hidden-focus checks, and enforcing it would
 *     break the homepage rail: its loop clones are VISIBLE cards that must
 *     stay clickable, so they cannot be inert. What axe (and assistive tech)
 *     actually needs is that nothing focusable is reachable INSIDE hidden
 *     content, and that is rule 6 below.
 *   - "No `sizes` may top out around 635px." `sizes` is CSS pixels; the
 *     browser multiplies by the screen's density itself, so a 635px slot on a
 *     3x phone asks for a 1905px file. What does make a Retina image soft is a
 *     srcset whose LARGEST file is too small for the slot `sizes` describes,
 *     and that is rule 3.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist', 'client');

if (!fs.existsSync(DIST)) {
  console.error('dist/client not found: run `npm run build` first.');
  process.exit(1);
}

const walk = (dir, ext) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full, ext) : e.name.endsWith(ext) ? [full] : [];
  });

const routeOf = (file) =>
  '/' + path.relative(DIST, file).replace(/index\.html$/, '').split(path.sep).join('/');

/*
  Standalone documents, exempt from the PAGE rules (one h1, landmarks). They
  are print/sales sheets that do not use <Layout> (CLAUDE.md "Conventions"),
  or the dev-only CMS, which production replaces with a notice.
*/
const STANDALONE = ['/media-kit/', '/collaborations/press-kit/', '/local-cms/'];
const isStandalone = (route) => STANDALONE.some((p) => route.startsWith(p));

/* ── helpers ──────────────────────────────────────────────────────────────── */

const RAW_SANITY = /^https:\/\/cdn\.sanity\.io\/images\/[^?]+$/;
const RAW_S3 = /substack-post-media\.s3\.amazonaws\.com/;
const RESIZED = /wsrv\.nl|substackcdn\.com\/image\/fetch/;
const YOUTUBE_EMBED = /youtube(?:-nocookie)?\.com\/embed\//;

/* srcset candidates are split by a comma AND whitespace: Substack's resize
   URLs contain bare commas ("$s_!x!,f_auto,q_auto:eco,w_600,c_limit/..."). */
const candidates = (srcset) =>
  (srcset || '')
    .split(/,\s+(?=https?:|\/)/)
    .map((part) => {
      const [url, desc] = part.trim().split(/\s+/);
      const w = desc && /^\d+w$/.test(desc) ? Number(desc.slice(0, -1)) : null;
      return { url, w };
    })
    .filter((c) => c.url);

/*
  The widest slot, in CSS px, that a `sizes` value asks for at any window
  from 320 to 2560px. Evaluated the way the browser does it: at each width,
  the FIRST entry whose media condition matches wins. That matters because
  Astro writes `(min-width: 200px) 200px, 100vw`, where the 100vw only ever
  applies below 200px, so reading entries in isolation reports a 2560px slot
  for a 200px logo. Conditions other than min/max-width (and `and` of them)
  are treated as not matching; calc() lengths are skipped.
*/
const WIDTHS = [];
for (let w = 320; w <= 2560; w += 10) WIDTHS.push(w);
function matches(condition, width) {
  if (!condition) return true;
  return condition.split(/\s+and\s+/i).every((part) => {
    const min = part.match(/min-width:\s*(\d+(?:\.\d+)?)px/);
    const max = part.match(/max-width:\s*(\d+(?:\.\d+)?)px/);
    if (min) return width >= Number(min[1]);
    if (max) return width <= Number(max[1]);
    return false;
  });
}
function widestSlot(sizes) {
  if (!sizes) return null;
  const entries = sizes.split(/,(?![^(]*\))/).map((raw) => {
    const entry = raw.trim();
    const len = entry.match(/(\d+(?:\.\d+)?)(px|vw)\s*$/);
    const cond = entry.match(/^\(([^]*)\)\s+[^()]+$/)?.[1] ?? (entry.startsWith('(') ? entry.slice(0, entry.lastIndexOf(')') + 1) : '');
    return { cond: cond.replace(/^\(|\)$/g, ''), len: len ? { value: Number(len[1]), unit: len[2] } : null };
  });
  let widest = 0;
  for (const width of WIDTHS) {
    const hit = entries.find((e) => matches(e.cond, width));
    if (!hit?.len) continue;
    const px = hit.len.unit === 'px' ? hit.len.value : (hit.len.value / 100) * width;
    widest = Math.max(widest, px);
  }
  return widest || null;
}

/* How wide the ORIGINAL is, where the URL says so; a srcset cannot exceed it. */
function intrinsicWidth(url) {
  const decoded = decodeURIComponent(url || '');
  const substack = decoded.match(/_(\d{3,5})x(\d{3,5})\.(?:jpe?g|png|webp|gif)/i);
  if (substack) return Number(substack[1]);
  const sanity = decoded.match(/-(\d{3,5})x(\d{3,5})\.(?:jpe?g|png|webp|gif)/i);
  if (sanity) return Number(sanity[1]);
  if (/i\.ytimg\.com/.test(decoded)) return 1280; // maxresdefault
  return null;
}

/* Deliberately small: blurred plates, whose blur destroys more detail than a
   bigger file would add (CLAUDE.md "Hub backdrops"), and the homepage hero's
   closed strips, which render blurred until opened. */
const BLURRED = /hero-backdrop-plate|event-hero-bg-animated|backdrop-plate|spotlight-art--fill|hub-stage-art-fill|hub-stage-plate/;

const FOCUSABLE = 'a[href], button, input, select, textarea, iframe, [tabindex], [contenteditable="true"]';

/* ── the sweep ────────────────────────────────────────────────────────────── */

const failures = [];
const fail = (rule, route, detail) => failures.push({ rule, route, detail });

const pages = walk(DIST, '.html');
for (const file of pages) {
  const route = routeOf(file);
  const html = fs.readFileSync(file, 'utf8');
  const doc = parse(html, { comment: false, blockTextElements: { script: true, style: true } });
  const imgs = doc.querySelectorAll('img');

  /* 1. ONE high-priority image. Counted by distinct image, not by attribute:
        the LCP image's own <link rel=preload> carries the same hint, and the
        /feed stage paints one file twice (a contained copy over a blurred
        fill), which is still one download. */
  const high = new Set(imgs.filter((i) => i.getAttribute('fetchpriority') === 'high').map((i) => i.getAttribute('src')));
  if (high.size > 1) {
    fail('1 one high-priority image', route, `${high.size} different images are fetchpriority="high": ${[...high].map((u) => String(u).slice(0, 60)).join(' | ')}`);
  }
  /* The preload must be the SAME request as the high-priority <img>, or it is
     a second download (the #191 bug, scripts/lcp-preload.test.mjs): compared
     by srcset when it has one, since `href` is only the fallback candidate. */
  const highImg = imgs.find((i) => i.getAttribute('fetchpriority') === 'high');
  for (const link of doc.querySelectorAll('link[rel="preload"][as="image"]')) {
    if (link.getAttribute('fetchpriority') !== 'high' || !highImg) continue;
    const same = link.getAttribute('imagesrcset')
      ? link.getAttribute('imagesrcset') === highImg.getAttribute('srcset') && link.getAttribute('imagesizes') === highImg.getAttribute('sizes')
      : link.getAttribute('href') === highImg.getAttribute('src');
    if (!same) fail('1 one high-priority image', route, `the image preload does not match the high-priority <img> (${String(highImg.getAttribute('class') || highImg.getAttribute('src')).slice(0, 50)}): a second download`);
  }

  for (const img of imgs) {
    const src = img.getAttribute('src') || '';
    const srcset = img.getAttribute('srcset') || '';
    const cls = img.getAttribute('class') || '';
    const all = [src, ...candidates(srcset).map((c) => c.url)];

    /* 2. No unresized ORIGINAL (Sanity with no query; Substack's S3 bucket). */
    for (const url of all) {
      if (RAW_SANITY.test(url)) fail('2 no unresized originals', route, `Sanity original ${url.slice(0, 100)}`);
      if (RAW_S3.test(url) && !RESIZED.test(url)) fail('2 no unresized originals', route, `Substack S3 original ${url.slice(0, 100)}`);
    }

    /* 3. The largest file covers the widest slot at 2x (Retina), unless the
          original itself is smaller, or the image is blurred on purpose. */
    const ws = candidates(srcset).map((c) => c.w).filter(Boolean);
    const slot = widestSlot(img.getAttribute('sizes'));
    if (ws.length && slot && !BLURRED.test(cls)) {
      const largest = Math.max(...ws);
      /* 2x the slot, capped at 2560: past that no screen this site targets
         shows the difference, and the originals rarely go further. */
      const need = Math.min(Math.round(slot * 2), 2560);
      /* A committed article rendition (scripts/sync-article-images.mjs) only
         omits rungs WIDER than its original, so a ladder that stops short of
         the sync's largest width (1440) stops at the original. */
      const localArticle = /^\/article-images\//.test(src) && largest < 1440 ? largest : null;
      const cap = intrinsicWidth(src) ?? intrinsicWidth(candidates(srcset)[0]?.url) ?? localArticle;
      if (largest < need * 0.75 && !(cap && largest >= cap * 0.9)) {
        fail('3 srcset covers sizes at 2x', route, `.${cls.split(/\s+/)[0] || 'img'}: sizes reaches ${Math.round(slot)}px (${need}px at 2x) but the largest file is ${largest}w${cap ? ` (original ${cap}w)` : ''}`);
      }
    }

    /* 7. Every image carries an alt (decorative ones an empty one). */
    if (!img.hasAttribute('alt')) fail('7 every image has alt', route, `${cls || 'img'} ${src.slice(0, 80)}`);
  }

  /* 4. YouTube frames: never start themselves; fullscreen always allowed. */
  for (const frame of doc.querySelectorAll('iframe')) {
    const src = frame.getAttribute('src') ?? '';
    const dataSrc = frame.getAttribute('data-src') ?? '';
    if (frame.hasAttribute('src') && src === '') fail('4 iframes', route, 'an iframe with src="" loads this page inside itself (hard rule 4)');
    const isYouTube = YOUTUBE_EMBED.test(src + dataSrc) || /youtube|video/i.test(frame.getAttribute('title') || '') || /hub-stage-iframe|hero-iframe|modal-iframe/.test((frame.getAttribute('class') || '') + (frame.getAttribute('id') || ''));
    if (!isYouTube) continue;
    if (/autoplay=1/.test(src + dataSrc)) fail('4 iframes', route, `autoplay=1 in ${(src || dataSrc).slice(0, 90)} (the sign-in wall, hard rule 11)`);
    if (!/\bfullscreen\b/.test(frame.getAttribute('allow') || '') || !frame.hasAttribute('allowfullscreen')) {
      fail('4 iframes', route, `a YouTube frame (${frame.getAttribute('id') || frame.getAttribute('class') || 'iframe'}) does not allow fullscreen`);
    }
  }

  if (!isStandalone(route)) {
    /* 5. Exactly one <h1>. */
    const h1s = doc.querySelectorAll('h1').length;
    if (h1s !== 1) fail('5 exactly one h1', route, `${h1s} <h1> elements`);
  }

  /* 6. Nothing focusable inside hidden content (axe aria-hidden-focus): a
        control a keyboard can land on while a screen reader is told it is not
        there. `inert` content is exempt (the browser removes it from focus);
        tabindex="-1" takes an element out of the tab order. */
  for (const hidden of doc.querySelectorAll('[aria-hidden="true"]')) {
    if (hidden.closest('[inert]')) continue;
    for (const el of [hidden, ...hidden.querySelectorAll(FOCUSABLE)]) {
      if (el === hidden && !el.matches(FOCUSABLE)) continue;
      if (el.hasAttribute('disabled') || el.getAttribute('tabindex') === '-1' || el.closest('[inert]')) continue;
      if (el.tagName === 'A' && !el.hasAttribute('href')) continue;
      fail('6 nothing focusable in hidden content', route, `<${el.tagName.toLowerCase()} ${(el.getAttribute('class') || '').split(/\s+/)[0]}> inside aria-hidden content`);
    }
  }

  /* 8. A link that opens a new tab cannot reach back into this one. */
  for (const a of doc.querySelectorAll('a[target="_blank"]')) {
    if (!/noopener/.test(a.getAttribute('rel') || '')) fail('8 new-tab links rel=noopener', route, (a.getAttribute('href') || '').slice(0, 80));
  }

  /* 10. Every "Watch on YouTube" link starts with the YouTube mark, the
         footer's own (SOCIAL_ICONS.YouTube). The six of them drifted into
         three different treatments before this rule existed. */
  for (const a of doc.querySelectorAll('a')) {
    if (!/watch on youtube/i.test(a.text)) continue;
    const first = a.querySelector('.yt-mark');
    if (!first || !first.querySelector('svg')) {
      fail('10 Watch on YouTube carries the YouTube mark', route, `.${(a.getAttribute('class') || 'a').split(/\s+/)[0]} has no .yt-mark`);
    } else if (a.childNodes.find((n) => n.nodeType === 1) !== first) {
      fail('10 Watch on YouTube carries the YouTube mark', route, `.${(a.getAttribute('class') || 'a').split(/\s+/)[0]}: the mark must come first`);
    }
  }

  /* 9. No em dash in anything a visitor reads (house style, CLAUDE.md):
        text nodes outside script/style, and alt / title / aria-label /
        meta description values. */
  const body = doc.querySelector('body');
  if (body) {
    /* Inline scripts and styles are code, not copy (their comments are
       exempt, CLAUDE.md), so they are removed before reading the text. */
    body.querySelectorAll('script, style, noscript, template').forEach((n) => n.remove());
    /* An article body is the author's own published writing, synced from
       Substack, not site copy: house style governs what the SITE says. */
    body.querySelectorAll('.article-body, .prose, [data-article-body]').forEach((n) => n.remove());
    const text = body.structuredText || '';
    if (text.includes('—')) {
      const at = text.indexOf('—');
      fail('9 no em dashes in copy', route, `"…${text.slice(Math.max(0, at - 40), at + 20).replace(/\s+/g, ' ')}…"`);
    }
  }
  for (const el of doc.querySelectorAll('[alt], [aria-label], meta[name="description"], meta[property="og:description"]')) {
    for (const attr of ['alt', 'aria-label', 'content']) {
      const value = el.getAttribute(attr);
      if (value && value.includes('—')) fail('9 no em dashes in copy', route, `${attr}="${value.slice(0, 80)}"`);
    }
  }
}

/* 4b. The players that build their URL in SCRIPT: no bundle may ask YouTube
       to start itself, as a query string or as an IFrame API player var. */
for (const file of walk(path.join(DIST, 'assets'), '.js')) {
  const js = fs.readFileSync(file, 'utf8');
  if (/autoplay=1/.test(js) || /autoplay\s*:\s*1\b/.test(js)) {
    fail('4 iframes', `/assets/${path.basename(file)}`, 'a script bundle builds a self-starting YouTube embed (autoplay)');
  }
}

/* ── report ───────────────────────────────────────────────────────────────── */

if (failures.length) {
  /* Grouped by rule, then by problem, so one component bug across 40 pages
     reads as one line with the pages it appears on. */
  const byRule = new Map();
  for (const f of failures) {
    const rule = byRule.get(f.rule) ?? new Map();
    rule.set(f.detail, [...(rule.get(f.detail) ?? []), f.route]);
    byRule.set(f.rule, rule);
  }
  console.error(`\n✗ Global QA sweep: ${failures.length} violation(s) across ${pages.length} built pages\n`);
  for (const [rule, problems] of [...byRule].sort()) {
    console.error(`  Rule ${rule}:`);
    for (const [detail, routes] of problems) {
      const unique = [...new Set(routes)];
      console.error(`    - ${detail}\n        on ${unique.length} page(s): ${unique.slice(0, 4).join(', ')}${unique.length > 4 ? ', …' : ''}`);
    }
  }
  process.exit(1);
}

console.log(`✓ Global QA sweep: ${pages.length} built pages pass all ten site-wide rules.`);
