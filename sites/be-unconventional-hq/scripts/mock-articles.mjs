/**
 * Mock article generator — for testing /intel before real content exists.
 *
 * Fills src/data/articles.json with realistic fake articles so the magazine,
 * pagination, category filters, article pages and image fallbacks can all be
 * exercised. Your real snapshot is backed up first and can be restored at any
 * time.
 *
 * ─── USAGE ────────────────────────────────────────────────────────────────
 *   npm run mock-articles              generate mock content (default 24)
 *   npm run mock-articles -- --count 40
 *   npm run mock-articles -- --restore put the real snapshot back
 *
 * ─── SAFETY ───────────────────────────────────────────────────────────────
 * 1. The real snapshot is copied to src/data/articles.real.json before the
 *    first overwrite, and --restore copies it back.
 * 2. Every generated record carries `isMock: true`.
 * 3. scripts/sync-articles.mjs DROPS any record with `isMock: true` before
 *    merging, so a real sync automatically clears mock content. That matters
 *    because the merge is otherwise never-delete by design — without this,
 *    mock posts would live in the snapshot forever.
 *
 * Do not deploy with mock content in place. `--restore` first.
 *
 * ─── VARIATIONS GENERATED ─────────────────────────────────────────────────
 * Deliberately uneven, because uniform test data hides bugs:
 *   • with cover image + rich body (headings, lists, quotes, figures)
 *   • with an embedded video reference in the body
 *   • video + multiple inline images
 *   • NO cover image  → exercises the branded logo/title fallback
 *   • very long headline → exercises clamping in rails and cards
 *   • very short body → exercises the truncation safety net (hasBody: false)
 *   • one per category, so every filter has content
 *   • one 'General' post, which has no filter button by design
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  sanitizeArticleHtml,
  mapContentType,
  extractScore,
  buildPreview,
} from '../src/lib/articles-transform.ts';

const SNAPSHOT = path.join(process.cwd(), 'src', 'data', 'articles.json');
const BACKUP = path.join(process.cwd(), 'src', 'data', 'articles.real.json');

const argv = process.argv.slice(2);
const wantsRestore = argv.includes('--restore');
const countArg = argv.indexOf('--count');
const COUNT = countArg !== -1 ? Number(argv[countArg + 1]) || 24 : 24;

// ── Restore ────────────────────────────────────────────────────────────────
if (wantsRestore) {
  if (!fs.existsSync(BACKUP)) {
    console.error('[mock] No backup at src/data/articles.real.json — nothing to restore.');
    process.exit(1);
  }
  fs.copyFileSync(BACKUP, SNAPSHOT);
  const restored = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
  console.log(`[mock] ✓ Restored ${restored.length} real record(s) from articles.real.json`);
  console.log('[mock]   Run `npm run build` to rebuild without mock content.');
  process.exit(0);
}

// ── Back the real snapshot up once ─────────────────────────────────────────
if (!fs.existsSync(BACKUP) && fs.existsSync(SNAPSHOT)) {
  fs.copyFileSync(SNAPSHOT, BACKUP);
  console.log('[mock] Backed up real snapshot -> src/data/articles.real.json');
}

// ── Content pools ──────────────────────────────────────────────────────────

const HEADLINES = [
  ['Mortal Kombat 2 Review: Flawless Victory Or Fatality?', 'Film', 'image'],
  ['The Boys Season 5 Episode 5: The Chaos Finally Clicks', 'TV', 'video'],
  ['Ghost of Yotei Is The Best Looking Game On PS5', 'Games', 'video-images'],
  ['SDCC 2026: Everything Marvel Announced In Hall H', 'Events', 'image'],
  ['Dune Part Three Is Shaping Up To Be The Boldest Chapter Yet', 'Film', 'no-image'],
  ['Fallout Season 2 Sticks The Landing', 'TV', 'image'],
  ['Nintendo Direct Broke Its Own Rules And It Absolutely Worked', 'Games', 'image'],
  ['D23 2026: The Full Lucasfilm Slate, Explained', 'Events', 'video'],
  ['Superman Legacy And The Real Cost Of A Cinematic Universe Reset', 'Film', 'long-title'],
  ['Why The Last Of Us Season 3 Is Playing It Far Too Safe', 'TV', 'no-image'],
  ['Silksong Was Worth Every Single Year Of The Wait', 'Games', 'image'],
  ['On Location: The Odyssey Premiere In Athens', 'Events', 'video-images'],
  ['The Batman Part II Trailer Breakdown, Frame By Frame', 'Film', 'image'],
  ['Severance Season 3 Is Quietly Rewriting Prestige TV', 'TV', 'image'],
  ['The Wolverine Game Is Insomniac At Full Power', 'Games', 'no-image'],
  ['Comic-Con Museum: A Walkthrough Of The New Wing', 'Events', 'image'],
  ['Avatar Fire And Ash Somehow Raises The Bar Again', 'Film', 'video'],
  ['Andor Season 2 And The Art Of The Slow Burn', 'TV', 'image'],
  ['Elden Ring Nightreign Changed How I Play Souls Games', 'Games', 'image'],
  ['NYCC 2026 Preview: What We Actually Expect To See', 'Events', 'short'],
  ['Sinners Is The Horror Debut Of The Decade', 'Film', 'image'],
  ['A Studio Tour That Reframed How We Cover This Industry', 'General', 'image'],
  ['Hollow Knight And The Quiet Confidence Of Great Design', 'Games', 'image'],
  ['The Odyssey Trailer Reaction: Nolan At His Most Ambitious', 'Film', 'video-images'],
  ['Star Wars Starfighter Kicks Off A New Era', 'Film', 'image'],
  ['Peacemaker Season 3 Is Somehow The Heart Of The DCU', 'TV', 'image'],
];

/** Deterministic placeholder cover, so runs are reproducible. */
const coverFor = (index) =>
  `https://picsum.photos/seed/buhq-intel-${index}/1456/816`;

/*
  Sentence pool.

  Deliberately LONG sentences. The magazine's centre feature on /intel renders
  the article's opening paragraphs at full length, so short filler sentences
  would leave that block half empty and hide the very layout problem this mock
  content exists to test. Each entry is roughly the length of a real sentence
  of criticism.
*/
const LOREM = [
  'The opening act does the heavy lifting here, and it earns every minute of the runtime it asks for, which is not something you can say about most releases arriving at this scale.',
  'What lands hardest is the restraint — the willingness to sit inside a scene long after a lesser production would have cut away to something louder and less interesting.',
  'There is a version of this that plays as fan service and nothing else, a feature-length nod to the people already in the room, and it is worth saying plainly that this is not that version.',
  'The craft on display is genuinely startling: the lighting alone carries more story than most scripts manage across an entire hour, and the sound mix is doing quiet, unglamorous work underneath all of it.',
  'It stumbles in the middle stretch, and the pacing never fully recovers from the detour it takes there, but the final twenty minutes re-earn almost all of the goodwill it spends.',
  'Watching it with an audience changes the experience completely, which is the highest compliment I know how to pay a release built for a room this size.',
  'The performances are pitched several degrees below where you expect them to be, and that choice pays off repeatedly in scenes that would otherwise tip straight into melodrama.',
  'Structurally it is far more confident than its marketing suggested, moving between timelines without ever stopping to explain itself, and trusting that you will keep up.',
  'There is a real argument that the third act asks too much of a single character, and I go back and forth on whether the ending earns the weight it puts on that decision.',
  'Technically it is the most ambitious thing the team has attempted, and the seams show in exactly two places, neither of which will register on a first viewing.',
  'The score deserves separate mention: it never announces an emotion before the frame has arrived at it, which is rarer and harder than it sounds.',
  'By the time the credits roll it has made a genuine case for itself as more than a franchise obligation, and that is the bar this kind of project almost never clears.',
];

/**
 * Build `n` paragraphs of two sentences each — roughly 350 characters, which
 * is about what a real paragraph of criticism runs to. Keeping mock paragraphs
 * the same size as real ones matters: buildPreview() fills the magazine lede
 * by whole paragraphs, so oversized mock paragraphs would overshoot the block
 * and make the layout look correct here but wrong in production.
 */
const paragraphs = (n, seed) =>
  Array.from(
    { length: n },
    (_, i) => `<p>${LOREM[(seed + i) % LOREM.length]} ${LOREM[(seed + i + 5) % LOREM.length]}</p>`,
  ).join('');

/** Body variants, so the article page is exercised against real shapes. */
function bodyFor(variant, index, title) {
  if (variant === 'short') {
    // Trips the truncation safety net -> hasBody:false -> no local page,
    // card keeps pointing at Substack. This variant is here on purpose.
    return '<p>A short teaser only.</p>';
  }

  const video = `
    <h2>Watch The Breakdown</h2>
    <p>The full video version of this piece is on the channel:</p>
    <figure>
      <img src="https://i.ytimg.com/vi/AbExGOtOLuM/maxresdefault.jpg" alt="Video thumbnail for ${title}">
      <figcaption>Watch the full breakdown on YouTube.</figcaption>
    </figure>`;

  const images = `
    <figure>
      <img src="${coverFor(index + 100)}" alt="Production still from ${title}">
      <figcaption>A second look at the production design.</figcaption>
    </figure>
    <figure>
      <img src="${coverFor(index + 200)}" alt="Behind the scenes on ${title}">
      <figcaption>Behind the scenes.</figcaption>
    </figure>`;

  const base = `
    <h1>${title}</h1>
    ${paragraphs(3, index)}
    <h2>What Works</h2>
    ${paragraphs(2, index + 1)}
    <ul><li>Direction that trusts the audience</li><li>A score that never overplays its hand</li><li>Editing with actual patience</li></ul>
    <blockquote>It is the rare blockbuster that remembers silence is a tool.</blockquote>
    <h2>What Doesn't</h2>
    ${paragraphs(2, index + 3)}
    <ol><li>The second act sags</li><li>One subplot goes nowhere</li></ol>
    <h3>The Verdict</h3>
    ${paragraphs(2, index + 4)}
    <p><strong>Score: ${(6 + (index % 4)) + (index % 2 ? '.5' : '')}/10</strong></p>
    <hr>
    <p>Read more coverage on <a href="https://beunconventionalhq.substack.com/">the Substack</a>.</p>`;

  if (variant === 'video') return base + video;
  if (variant === 'video-images') return base + video + images;
  return base + images;
}

// ── Build the records ──────────────────────────────────────────────────────

const now = new Date();
const records = [];

for (let i = 0; i < COUNT; i += 1) {
  const [rawTitle, category, variant] = HEADLINES[i % HEADLINES.length];
  // Keep titles unique once we wrap around the pool.
  const cycle = Math.floor(i / HEADLINES.length);
  const title = cycle === 0 ? rawTitle : `${rawTitle} (Part ${cycle + 1})`;

  const published = new Date(now.getTime() - i * 36 * 60 * 60 * 1000);
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  const bodyHtml = sanitizeArticleHtml(bodyFor(variant, i, title));
  // Mirrors looksTruncated() in articles-transform.ts.
  const hasBody = bodyHtml.replace(/<[^>]+>/g, ' ').trim().length >= 400;

  records.push({
    guid: `mock-${i}`,
    slug,
    title,
    link: `https://beunconventionalhq.substack.com/p/${slug}`,
    date: published.toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
    }),
    isoDate: published.toISOString(),
    /*
      The SHORT preview — one block, used in card grids and as the page's meta
      description. Mirrors buildExcerpt()'s 420-character budget.
    */
    excerpt: bodyHtml
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 420)
      .replace(/\s+\S*$/, '…'),
    /*
      The LONG preview — the opening paragraphs, for the magazine's centre
      feature. Built with the SAME function the real sync uses, so a bug in
      the lede shows up in mock content instead of waiting for live articles.
    */
    preview: buildPreview(bodyHtml),
    // 'no-image' and 'long-title' variants intentionally ship no cover, to
    // exercise the branded logo/title fallback.
    image: variant === 'no-image' || variant === 'long-title' ? '' : coverFor(i),
    category,
    /* Derived with the SAME functions the real sync uses, so mock records
       exercise the live taxonomy rather than a parallel guess. */
    contentType: mapContentType([category], title),
    score: extractScore(bodyHtml),
    tags: [category],
    bodyHtml,
    hasBody,
    firstSeen: now.toISOString(),
    lastUpdated: now.toISOString(),
    isMock: true,
  });
}

fs.writeFileSync(SNAPSHOT, `${JSON.stringify(records, null, 2)}\n`);

// ── Report ─────────────────────────────────────────────────────────────────
const byCategory = records.reduce((acc, r) => {
  acc[r.category] = (acc[r.category] ?? 0) + 1;
  return acc;
}, {});
const noImage = records.filter((r) => !r.image).length;
const noBody = records.filter((r) => !r.hasBody).length;

console.log(`[mock] ✓ Wrote ${records.length} mock article(s) to src/data/articles.json`);
console.log(`[mock]   categories: ${Object.entries(byCategory).map(([k, v]) => `${k}=${v}`).join(', ')}`);
console.log(`[mock]   ${noImage} without a cover image (branded fallback)`);
console.log(`[mock]   ${noBody} truncated (no local page — card links to Substack)`);
console.log(`[mock]   ${records.length - noBody} with a local article page at /intel/<slug>`);
console.log('[mock]');
console.log('[mock]   Next: npm run build');
console.log('[mock]   Undo: npm run mock-articles -- --restore');
