/**
 * THE HQ DISPATCH email template (issue #266). Offline, no Kit account.
 *
 * ─── WHAT THIS IS GUARDING ──────────────────────────────────────────────────
 * An email template fails in ways nobody sees until a subscriber does, and
 * Kit's own preview catches almost none of them. What is asserted here:
 *
 *   1. KIT TAGS INSIDE HTML COMMENTS. Kit runs Liquid over the whole
 *      template, comments included. The first draft named every Kit tag in
 *      the header note with its braces, so the broadcast body was rendered
 *      INTO that comment, its own comments closed it early, and the rest of
 *      the note spilled onto the page as text. Found by rendering it.
 *   2. <meta charset> PAST BYTE 1024. The same header note once pushed the
 *      charset out of the first 1024 bytes, where a client sniffing the
 *      encoding stops looking, and "Gunn’s" came out "Gunnâ€™s".
 *   3. What Kit REQUIRES: message_content, unsubscribe_url as an href, and a
 *      physical address (typed, "Anaheim, CA 92805", the owner's call).
 *   4. House rules: no em dash, the brand red is #cc0000 and the ground is
 *      #0a0a0a (the issue corrected #9B0000 and #080808), no flexbox or grid,
 *      role="presentation" on every layout table, alt on every image.
 *   5. The Liquid itself, rendered by a real engine: featured first, one box
 *      per story, six at most, 16:9 image boxes, the Video CTA, the
 *      no-image and single-mode fallbacks.
 *   6. email/hq-dispatch/mockup.html is what the renderer produces today, so
 *      the mockup cannot drift from the files it demonstrates.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import sharp from 'sharp';
import { DISPATCH_HEADER_IMAGE } from '../src/lib/dispatch-feed.ts';
import {
  TEMPLATE_PATH,
  POST_TEMPLATE_PATH,
  MOCKUP_PATH,
  FIXTURE_POSTS,
  feedPost,
  renderPosts,
  renderEmail,
  renderMockup,
} from './hq-dispatch-render.mjs';

const template = readFileSync(TEMPLATE_PATH, 'utf8');
const postTemplate = readFileSync(POST_TEMPLATE_PATH, 'utf8');
const notes = readFileSync(new URL('./hq-dispatch.md', import.meta.url), 'utf8');

const count = (s, needle) => s.split(needle).length - 1;
/** Markup with HTML comments removed, for counting what actually renders.
 *  MSO conditional comments are kept: they are markup Outlook renders. */
const rendered = (s) => s.replace(/<!--(?!\[if|<!\[endif)[\s\S]*?-->/g, '');
const tags = (html, name) => html.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) ?? [];
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`, 'i'))?.[1];

test('Kit required tags are present exactly once, and the links are hrefs', () => {
  assert.equal(count(template, '{{ message_content }}'), 1);
  // Kit accepts a typed address in place of its tag. Typed, so it must be there.
  assert.equal(count(rendered(template), 'Anaheim, CA 92805'), 1);
  assert.equal(count(template, 'href="{{ unsubscribe_url }}"'), 1);
  assert.equal(count(template, '{{ unsubscribe_url }}'), 1, 'unsubscribe_url only as an href');
  assert.equal(count(template, 'href="{{ subscriber_preferences_url }}"'), 1);
  assert.equal(count(template, '{{ subscriber_preferences_url }}'), 1);
});

test('no Liquid inside an HTML comment in the template (Kit renders it there)', () => {
  const comments = template.match(/<!--[\s\S]*?-->/g) ?? [];
  const offenders = comments.filter((c) => /\{\{|\{%/.test(c));
  assert.deepEqual(offenders, []);
});

test('the only Liquid in the template is the three Kit tags', () => {
  const liquid = template.match(/\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}/g) ?? [];
  assert.deepEqual(
    [...new Set(liquid)].sort(),
    ['{{ message_content }}', '{{ subscriber_preferences_url }}', '{{ unsubscribe_url }}'],
  );
});

test('footer socials: YouTube, Instagram, TikTok, Bluesky, Letterboxd, Threads, and never X', () => {
  const hrefs = tags(template, 'a').map((t) => attr(t, 'href'));
  for (const url of [
    'https://www.youtube.com/@BeUnconventionalHQ',
    'https://www.instagram.com/beunconventionalhq',
    'https://www.tiktok.com/@beunconventionalhq',
    'https://bsky.app/profile/beunconventionalhq.com',
    'https://letterboxd.com/beunconhq/',
    'https://www.threads.com/@beunconventionalhq',
  ]) {
    assert.ok(hrefs.includes(url), `missing ${url}`);
  }
  // The owner doesn't promote X in the newsletter.
  assert.ok(!/x\.com|twitter/i.test(template));
});

test("links rest the way the site's do and turn red on hover", async () => {
  const html = await renderEmail(FIXTURE_POSTS);
  // Every text link carries one of the site's link states (image links excepted).
  const STATES = /\bdx-(navlink|footlink|inline|hl|cta|btn)\b/;
  const textLinks = (html.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? []).filter((a) => !/<img\b/i.test(a));
  const unstyled = textLinks.filter((a) => !STATES.test(attr(a.match(/<a\b[^>]*>/i)[0], 'class') ?? ''));
  assert.deepEqual(unstyled, []);
  // Resting states, from the site's CSS.
  assert.match(template, /class="dx-navlink"[^>]*color:#c6c6c6/, 'navbar rgba(245,245,245,0.8)');
  assert.match(template, /class="dx-footlink"[^>]*color:#888888/, 'footer --color-white-muted');
  assert.match(template, /class="dx-inline" style="color:#f0f0f0; text-decoration:underline; text-decoration-color:#cc0000/);
  // Hover: red, !important so it beats the inline resting colour.
  assert.match(template, /\.dx-navlink:hover \{ color: #ef4444 !important;/);
  assert.match(template, /\.dx-footlink:hover, \.dx-inline:hover, a\.dx-hl:hover \{ color: #ef4444 !important; \}/);
  // "Read the story" / "Watch now": the site card's .watch-now-btn, white at
  // rest, red on the link OR its box.
  assert.match(postTemplate, /class="dx-cta" style="[^"]*color:#f0f0f0;/);
  assert.match(template, /a\.dx-cta:hover, \.dx-card:hover a\.dx-cta \{ color: #ef4444 !important; \}/);
  // The filled button keeps WHITE text on hover. The generic red link hover
  // once reached it and put red text on the red fill.
  assert.match(template, /\.dx-btn-td:hover \{ background-color: #cc0000 !important;/);
  assert.match(template, /\.dx-content a\.dx-btn:hover, \.dx-btn-td:hover a\.dx-btn \{ color: #ffffff !important; \}/);
});

test('footer: the tagline in capitals, the site pointer on its own line beneath', () => {
  const tagline = template.indexOf('WHERE NERD CULTURE GETS CINEMATIC.');
  const pointer = template.indexOf("There's more every day at");
  assert.ok(tagline > 0 && pointer > tagline);
  assert.match(template.slice(tagline, pointer), /<\/p>\s*<p/);
});

test('charset and color-scheme metas are declared early', () => {
  assert.match(template.slice(0, 1024), /<meta charset="utf-8">/);
  assert.match(template, /<meta name="color-scheme" content="light dark">/);
  assert.match(template, /<meta name="supported-color-schemes" content="light dark">/);
  assert.match(template, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
});

test('header image: the committed 1200x400 file, shown 3:1 at 600x200, alt names the newsletter', async () => {
  assert.match(template, /<!-- BE DISPATCH HEADER IMAGE/);
  const header = tags(template, 'img').find((t) => t.includes(DISPATCH_HEADER_IMAGE));
  assert.ok(header, 'header <img> present');
  assert.equal(attr(header, 'src'), `https://beunconventionalhq.com${DISPATCH_HEADER_IMAGE}`);
  const file = new URL(`../public${DISPATCH_HEADER_IMAGE}`, import.meta.url);
  assert.ok(existsSync(file), 'header file is committed');
  const meta = await sharp(file.pathname).metadata();
  assert.deepEqual([meta.width, meta.height], [1200, 400]);
  assert.equal(attr(header, 'width'), '600');
  assert.equal(attr(header, 'height'), '200');
  assert.equal(attr(header, 'alt'), 'THE HQ DISPATCH');
  assert.match(header, /height:auto/);
  // The owner's intro, in the footer's spaced capitals.
  assert.match(template, /letter-spacing:0\.25em; text-transform:uppercase; color:#f0f0f0; text-align:center;">\s*COVERAGE FROM THE HQ\s*</);
});

test('house rules: brand colours, no em dash, no flex or grid layout', () => {
  for (const [name, src] of [['template', template], ['post template', postTemplate], ['notes', notes]]) {
    assert.ok(!/—|&mdash;|&#8212;|&#x2014;/i.test(src), `${name} contains an em dash`);
  }
  for (const src of [template, postTemplate]) {
    assert.ok(!/#9b0000|#080808/i.test(src), 'the corrected colours from the issue prompt');
    assert.ok(!/display:\s*(flex|grid)/i.test(src), 'no flexbox or grid');
  }
  assert.match(template, /bgcolor="#0a0a0a"/i);
  assert.match(template, /bgcolor="#cc0000"/i);
  // #cc0000 is 3.21:1 on #111111, so small TEXT uses the site's #ef4444.
  // Only the large "HQ" in the lockup (26px heavy, AA-large) may be #cc0000.
  const smallRedText = postTemplate.match(/font-size:1[0-8]px[^"]*color:#cc0000/gi) ?? [];
  assert.deepEqual(smallRedText, []);
});

test('every layout table in the shell and the rendered cards is role="presentation"', async () => {
  const html = await renderEmail(FIXTURE_POSTS);
  const bad = tags(html, 'table').filter((t) => attr(t, 'role') !== 'presentation');
  assert.deepEqual(bad, []);
});

test('every image has alt text', async () => {
  const html = await renderEmail(FIXTURE_POSTS);
  const bad = tags(html, 'img').filter((t) => attr(t, 'alt') === undefined);
  assert.deepEqual(bad, []);
});

test('digest: FEATURED first, then LATEST, one box per story, six at most', async () => {
  const eight = [...FIXTURE_POSTS, ...FIXTURE_POSTS.slice(0, 3)];
  const html = await renderPosts(eight);
  assert.equal(count(html, '>Featured</span>'), 1);
  assert.equal(count(html, '>Latest from the</span>'), 1);
  assert.ok(html.indexOf('>Featured<') < html.indexOf('>Latest from the<'));
  // One site-style box (dx-card) per story, capped at six.
  assert.equal(count(html, 'dx-card'), 6);
  assert.equal(count(html, `href="${FIXTURE_POSTS[0].url}"`) > 0, true);
});

test('images are never cut off: contain, never cover, anywhere in the email', async () => {
  const html = await renderEmail(FIXTURE_POSTS);
  assert.ok(!/object-fit:\s*cover/i.test(html), 'object-fit: cover crops');
  assert.match(template, /\.dx-169 \{[^}]*object-fit: contain/);
});

test('fixture art is the composed 16:9 images, committed', async () => {
  for (const post of FIXTURE_POSTS) {
    const src = post.content.match(/src="([^"]+)"/)[1];
    const file = new URL(src, new URL('../email/hq-dispatch/', import.meta.url));
    assert.ok(existsSync(file), `missing ${src}`);
    const meta = await sharp(file.pathname).metadata();
    assert.deepEqual([meta.width, meta.height], [1200, 675], src);
  }
});

test('LATEST: the thumbnail is centred vertically on the text', () => {
  const markup = rendered(postTemplate);
  assert.ok(!/vertical-align:\s*top/.test(markup));
  assert.equal(count(markup, 'vertical-align:middle'), 3);
  assert.equal(count(markup, 'valign="middle"'), 3);
});

test('images are 16:9 boxes: 550x309 featured, 192x108 thumbnails', async () => {
  const html = await renderPosts(FIXTURE_POSTS);
  const imgs = tags(html, 'img');
  assert.equal(imgs.length, FIXTURE_POSTS.length);
  for (const t of imgs) {
    const ratio = Number(attr(t, 'width')) / Number(attr(t, 'height'));
    assert.ok(Math.abs(ratio - 16 / 9) < 0.005, `not 16:9: ${attr(t, 'width')}x${attr(t, 'height')}`);
    assert.match(attr(t, 'class'), /dx-169/);
  }
  assert.equal(attr(imgs[0], 'width'), '550');
  assert.equal(attr(imgs[1], 'width'), '192');
  // The image is the one read out of content:encoded, not something else.
  assert.equal(attr(imgs[0], 'src'), FIXTURE_POSTS[0].content.match(/src="([^"]+)"/)[1]);
});

test('labels read "<type> | <section>", and Video turns the CTA into Watch now', async () => {
  const html = await renderPosts(FIXTURE_POSTS);
  assert.match(html, />Review \| TV</);
  assert.match(html, />Video \| Film</);
  assert.equal(count(html, 'Watch now'), 1);
  assert.equal(count(html, 'Read the story'), FIXTURE_POSTS.length - 1);
});

test('fallbacks: no image, no categories, single mode, a quote in the title', async () => {
  const bare = feedPost({ title: 'The "Quoted" One', url: 'https://example.com/a', summary: 'S.', image: null, categories: [] });
  const html = await renderPosts([bare, bare]);
  assert.equal(tags(html, 'img').length, 0, 'no image means no <img>, not a broken one');
  assert.equal(count(html, '>From the HQ<'), 2);
  assert.equal(count(html, 'dx-card'), 2);

  const single = await renderPosts(FIXTURE_POSTS.slice(0, 1));
  assert.equal(count(single, '>Featured</span>'), 1);
  assert.equal(count(single, 'Latest from the'), 0);

  const quoted = await renderPosts([{ ...FIXTURE_POSTS[0], title: 'A "Quoted" Title' }]);
  assert.match(quoted, /alt="A &quot;Quoted&quot; Title"/);
});

test('the committed mockup is what the renderer produces now', async () => {
  const committed = readFileSync(MOCKUP_PATH, 'utf8');
  assert.equal(committed, await renderMockup(), 'run: node scripts/hq-dispatch-render.mjs');
});
