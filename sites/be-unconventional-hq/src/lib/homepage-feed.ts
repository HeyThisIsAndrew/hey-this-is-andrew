/**
 * The homepage's content model — pure functions, no I/O.
 *
 * `src/data/homepage-feed.ts` binds these to the real stores (articles.json,
 * videos.json, the image manifest); this file only shapes and deals. It is
 * split that way so plain `node` can test it: a module that statically
 * imports JSON cannot be loaded there. See scripts/homepage-feed.test.mjs.
 *
 * ─── DEFENSIVE BY CONSTRUCTION ─────────────────────────────────────────────
 * The previous homepage attempt shipped a white screen, and one of the causes
 * was date math over an empty filtered array (`Math.max()` of nothing is
 * -Infinity, and `new Date(-Infinity)` is Invalid Date, which throws the moment
 * anything calls toISOString on it). Nothing here reduces over a list that may
 * be empty, every date goes through `toTime()` (which answers NaN-safe 0), and
 * every section builder returns an empty list or `null` rather than throwing.
 * The components render nothing for an empty section.
 *
 * ─── ONE POOL, DEALT ONCE ──────────────────────────────────────────────────
 * Every section takes from the same pool through `claim()`, so no story
 * appears twice on the page. The deal order is the editorial priority:
 * the featured world is pinned by an editor, so it claims first; the newest
 * story overall is next (it is the LATEST panel); then one per category for
 * the hero; then Intel; then the rail.
 */

import { getDisplayTagSlots } from './tags.ts';

export type HomeCategory = 'Film' | 'TV' | 'Games' | 'Events';
export const HOME_CATEGORIES: HomeCategory[] = ['Film', 'TV', 'Games', 'Events'];

/**
 * `sizes` for the hero accordion's art. index.astro's preload and the open
 * panel's <img> must both read THIS, or the browser runs two different
 * selections and downloads the art twice (#191, scripts/lcp-preload.test.mjs).
 *
 * It describes the OPEN PANEL, not the viewport. Stacked (phones, and short
 * landscape screens: the same two conditions home.css stacks on) the panel is
 * the full width. In the desktop row it is `--open-w` from home.css: the track
 * less four `--strip`s (clamp(128px, 11vw, 180px)) and four 6px gaps. It was
 * `100vw`, which on a 1350px desktop asked for 1350px of art for a 732px panel,
 * so every desktop visit took YouTube's 1280px JPEG original (119-253 KiB each)
 * instead of the ~30 KiB WebP rung, four times over once `sharpenAll()` ran:
 * 660 KiB in PageSpeed's desktop report. Keep this in step with home.css.
 */
export const HERO_SIZES =
  '(max-width: 767px) 100vw, (orientation: landscape) and (max-height: 520px) 100vw, calc(100vw - 4 * clamp(128px, 11vw, 180px) - 24px)';

/**
 * `sizes` for a CLOSED panel's art. A closed strip shows its art blurred
 * (home.css), so full resolution buys nothing, and at HERO_SIZES four closed
 * strips fetched ~1280px images alongside the LCP image and slowed it under
 * Lighthouse's throttling. 130px picks the smallest rung on any screen. The
 * script sets HERO_SIZES when a panel opens (and on desktop, once the page is
 * idle, so a click never opens onto a soft image).
 */
export const HERO_CLOSED_SIZES = '130px';

/**
 * ─── THE HERO ART IS SERVED FROM OUR OWN ORIGIN ─────────────────────────────
 *
 * The open panel's art is the homepage's LCP image. It used to come straight
 * from wsrv.nl, which meant a phone had to open a SECOND connection (DNS, TCP,
 * TLS: three round trips on Slow 4G) before the first byte of the one image
 * the page is judged on, and then download it on that connection in parallel
 * with everything else the document was pulling. PageSpeed's simulation
 * charged ~300ms of LCP to it.
 *
 * `/img/yt/<id>/<w>.webp` (src/pages/img/yt/[id]/[w].ts) is the SAME wsrv
 * rendition, fetched by our Worker and cached at Cloudflare's edge, so the
 * browser gets it on the connection it already has open for the page.
 *
 * Only the wsrv rungs are rewritten. The top rung stays YouTube's own
 * `maxresdefault.jpg`, and `src` stays `hqdefault.jpg`: Layout.astro's
 * thumbnail recovery finds the risky rendition in the srcset by that
 * i.ytimg.com URL (see youtubeSources() in card-images.ts), so a video with no
 * maxres thumbnail still falls back exactly as it did.
 *
 * ─── AND A STRIP-ONLY RUNG ──────────────────────────────────────────────────
 * A CLOSED panel shows its art blurred by 10px (home.css), at HERO_CLOSED_SIZES
 * (130px). It took the 400w rung at q=85: 11-20 KiB each in PageSpeed's mobile
 * report, three or four of them, all downloading beside the LCP image, for
 * pixels the blur then throws away. HERO_STRIP_WIDTH is a small, low-quality
 * rung (heroArtUpstream() asks wsrv for q=50) that only a slot that small
 * picks: an open panel is 412px+ wide, so it always takes 600w or more, and
 * `sharpen()` switches a panel to HERO_SIZES the moment it opens.
 */
export const HERO_STRIP_WIDTH = 240;
export const HERO_ART_WIDTHS = [HERO_STRIP_WIDTH, 400, 600, 800, 900, 1200] as const;
const WSRV_YT_RUNG = /^https:\/\/wsrv\.nl\/\?url=i\.ytimg\.com%2Fvi%2F([A-Za-z0-9_-]{11})%2Fmaxresdefault\.jpg&(?:amp;)?w=(\d+)&(?:amp;)?output=webp&(?:amp;)?q=85&(?:amp;)?we$/;

export function heroArtPath(videoId: string, width: number): string {
  return `/img/yt/${videoId}/${width}.webp`;
}

export function firstPartyHeroSrcset(srcset: string): string {
  if (!srcset) return srcset;
  let videoId = '';
  const rewritten = srcset
    .split(', ')
    .map((candidate) => {
      const [url, descriptor] = candidate.trim().split(/\s+/);
      const m = WSRV_YT_RUNG.exec(url ?? '');
      if (!m || !(HERO_ART_WIDTHS as readonly number[]).includes(Number(m[2]))) return candidate;
      videoId = m[1];
      return `${heroArtPath(m[1], Number(m[2]))} ${descriptor}`;
    })
    .join(', ');
  return videoId ? `${heroArtPath(videoId, HERO_STRIP_WIDTH)} ${HERO_STRIP_WIDTH}w, ${rewritten}` : rewritten;
}

export interface ImageSources {
  src: string;
  srcset: string;
}

export interface HomeStory {
  id: string;
  category: HomeCategory | null;
  /**
   * The piece's format (REVIEW, ANALYSIS, REACTION…), or ''. From
   * getDisplayTagSlots() (src/lib/tags.ts), the same pair the /feed hero
   * shows, so a story is labelled identically on both pages. Never "Video":
   * the play button already says that.
   */
  kicker: string;
  /** Whose it is: the studio, franchise or platform (SONY PICTURES, DC…), or ''. */
  brand: string;
  headline: string;
  deck: string;
  image: string;
  imageSrcset: string;
  url: string;
  /** True when `url` leaves the site. */
  external: boolean;
  /** ISO timestamp, or '' when the source had none that parses. */
  publishDate: string;
  /** "Sep 15, 2026", or ''. */
  displayDate: string;
  type: 'article' | 'video';
  /** "8 min read" for articles, '' otherwise. */
  readTime: string;
  /** "12:48" for videos, '' otherwise. */
  duration: string;
  /** YouTube id, videos only — drives the site's #video-modal. */
  videoId: string;
  /** Tags used for matching the featured world. Never rendered. */
  matchText: string;
  /** Opening paragraphs, articles only. Source of the pull quote. */
  paragraphs: string[];
  /** Out-of-N score for reviews that state one. */
  score: string;
}

/* ─── primitives ───────────────────────────────────────────────────────── */

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v)).trim();

/** Milliseconds, or 0 for anything that does not parse. Never NaN. */
export function toTime(value: unknown): number {
  const s = str(value);
  if (!s) return 0;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

export function formatDisplayDate(value: unknown, timeZone: string): string {
  const t = toTime(value);
  if (!t) return '';
  try {
    return new Date(t).toLocaleDateString('en-US', { timeZone, month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

/** "12:48" or "1:02:03". '' for missing, zero or nonsense. */
export function formatDuration(seconds: unknown): string {
  const n = Math.floor(Number(seconds));
  if (!Number.isFinite(n) || n <= 0) return '';
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = n % 60;
  const pad = (x: number) => String(x).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

const WORDS_PER_MINUTE = 230;

/** "8 min read" from an HTML body. '' when there is no body to count. */
export function readTimeFromHtml(html: unknown): string {
  const text = str(html).replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words === 0) return '';
  return `${Math.max(1, Math.round(words / WORDS_PER_MINUTE))} min read`;
}

/** Map the stores' category spellings onto the four the homepage shows. */
export function normalizeCategory(raw: unknown): HomeCategory | null {
  const s = str(raw).toLowerCase();
  if (s === 'film' || s === 'films' || s === 'movie' || s === 'movies') return 'Film';
  if (s === 'tv' || s === 'television' || s === 'series') return 'TV';
  if (s === 'games' || s === 'game' || s === 'gaming') return 'Games';
  if (s === 'events' || s === 'event') return 'Events';
  return null;
}

/** First sentence of a YouTube description, capped. Real copy, just shorter. */
/**
 * An article preview cut to a FIXED character budget, so every article in a
 * fixed-height slot (the homepage's mini Intel spread) takes the same room
 * and the slot never grows when a reader swaps articles. Paragraphs are
 * joined into one run, cut at the last whole word inside the budget, and
 * closed with an ellipsis only when something was actually cut.
 * Pure and DOM-free: the server render and the swap script both call it.
 */
export function clipPreview(paragraphs: unknown, max: number): string {
  const list = Array.isArray(paragraphs) ? paragraphs : [];
  const text = list
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ');
  if (!text || !(max > 0) || text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(' ');
  const head = (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : text.slice(0, max)).replace(/[\s,;:.!?\-]+$/, '');
  return `${head}…`;
}

export function firstSentence(text: unknown, max = 180): string {
  const s = str(text).split(/\n/)[0] ?? '';
  const m = s.match(/^.*?[.!?](?=\s|$)/);
  const sentence = (m ? m[0] : s).trim();
  if (sentence.length <= max) return sentence;
  const cut = sentence.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : max).replace(/[,;:\s]+$/, '') + '…';
}

/* ─── mappers ──────────────────────────────────────────────────────────── */

export interface RawArticle {
  guid?: unknown;
  slug?: unknown;
  title?: unknown;
  excerpt?: unknown;
  preview?: unknown;
  image?: unknown;
  category?: unknown;
  contentType?: unknown;
  isoDate?: unknown;
  tags?: unknown;
  bodyHtml?: unknown;
  score?: { value?: unknown; best?: unknown } | null;
}

export interface RawVideo {
  youtubeId?: unknown;
  title?: unknown;
  description?: unknown;
  thumbnail?: unknown;
  category?: unknown;
  publishedAt?: unknown;
  durationSeconds?: unknown;
  youtubeTags?: unknown;
  tags?: unknown;
  isShort?: unknown;
  isLive?: unknown;
}

export interface MapDeps {
  timeZone: string;
  articleHref: (a: RawArticle) => string;
  isExternalArticle: (a: RawArticle) => boolean;
  articleImage: (raw: string) => ImageSources;
  videoImage: (raw: string) => ImageSources;
}

const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);

export function mapArticle(a: RawArticle, deps: MapDeps): HomeStory | null {
  const headline = str(a?.title);
  const url = str(deps.articleHref(a));
  if (!headline || !url) return null;
  const rawImage = str(a.image);
  const img = rawImage ? deps.articleImage(rawImage) : { src: '', srcset: '' };
  const category = normalizeCategory(a.category);
  const score =
    a.score && Number(a.score.value) > 0 && Number(a.score.best) > 0
      ? `${Number(a.score.value)}/${Number(a.score.best)}`
      : '';
  const t = toTime(a.isoDate);
  const slots = getDisplayTagSlots(a);
  return {
    id: `article:${str(a.guid) || str(a.slug) || headline}`,
    category,
    kicker: slots.type || str(a.contentType) || category || 'Intel',
    brand: slots.brand,
    headline,
    deck: str(a.excerpt),
    image: str(img.src),
    imageSrcset: str(img.srcset),
    url,
    external: Boolean(deps.isExternalArticle(a)),
    publishDate: t ? new Date(t).toISOString() : '',
    displayDate: formatDisplayDate(a.isoDate, deps.timeZone),
    type: 'article',
    readTime: readTimeFromHtml(a.bodyHtml),
    duration: '',
    videoId: '',
    matchText: [headline, ...strList(a.tags)].join(' ').toLowerCase(),
    paragraphs: strList(a.preview),
    score,
  };
}

export function mapVideo(v: RawVideo, deps: MapDeps): HomeStory | null {
  const id = str(v?.youtubeId);
  const headline = str(v?.title);
  if (!id || !headline) return null;
  if (v.isShort === true || v.isLive === true) return null;
  const rawImage = str(v.thumbnail) || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  const img = deps.videoImage(rawImage);
  const t = toTime(v.publishedAt);
  const slots = getDisplayTagSlots(v);
  return {
    id: `video:${id}`,
    category: normalizeCategory(v.category),
    kicker: slots.type,
    brand: slots.brand,
    headline,
    deck: firstSentence(v.description),
    image: str(img.src),
    imageSrcset: str(img.srcset),
    url: `https://www.youtube.com/watch?v=${id}`,
    external: true,
    publishDate: t ? new Date(t).toISOString() : '',
    displayDate: formatDisplayDate(v.publishedAt, deps.timeZone),
    type: 'video',
    readTime: '',
    duration: formatDuration(v.durationSeconds),
    videoId: id,
    matchText: [headline, ...strList(v.youtubeTags), ...strList(v.tags)].join(' ').toLowerCase(),
    paragraphs: [],
    score: '',
  };
}

/* ─── the deal ─────────────────────────────────────────────────────────── */

export interface FeaturedWorldConfig {
  /** Display title, e.g. "Lanterns". */
  title: string;
  /** Lowercase term a story's title or tags must contain as a whole word. */
  match: string;
}

/**
 * How long a story counts as NEW on the hero: 24 hours from going live
 * (Andrew). It used to be a permanent tag on LATEST, which just repeated
 * the word next to it.
 */
export const NEW_FOR_MS = 24 * 60 * 60 * 1000;

/** When a story stops being NEW, in epoch ms, or null with no usable date.
 *  The page is static and served for days after a build, so this is
 *  rendered as data and the BROWSER decides (HeroAccordion's script). */
export function newUntil(publishDate: string): number | null {
  const t = Date.parse(publishDate);
  return Number.isFinite(t) ? t + NEW_FOR_MS : null;
}

export interface HeroPanel {
  key: 'film' | 'tv' | 'games' | 'events' | 'latest';
  label: string;
  story: HomeStory;
}

export interface FeaturedWorld {
  title: string;
  lead: HomeStory;
  items: HomeStory[];
  /** How many pieces of coverage the world has in total, lead included. */
  total: number;
}

export interface PullQuote {
  text: string;
  story: HomeStory;
}

export interface HomepageFeed {
  hero: HeroPanel[];
  intel: { lead: HomeStory | null; orbit: HomeStory[] };
  quote: PullQuote | null;
  featured: FeaturedWorld | null;
  rail: HomeStory[];
}

const newestFirst = (a: HomeStory, b: HomeStory) => toTime(b.publishDate) - toTime(a.publishDate);

function wordMatch(haystack: string, needle: string): boolean {
  const n = needle.trim().toLowerCase();
  if (!n) return false;
  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(haystack);
}

/**
 * A pull quote: one real sentence from an article's opening paragraphs.
 * Prefers a sentence that reads as a standalone line (60-190 chars) and skips
 * any carrying an em dash, per the house style for visitor-facing copy.
 */
export function pickPullQuote(stories: HomeStory[]): PullQuote | null {
  for (const story of stories) {
    if (!story || story.type !== 'article') continue;
    for (const para of story.paragraphs) {
      const sentences = para.match(/[^.!?]+[.!?]+(?=\s|$)/g) ?? [];
      for (const raw of sentences) {
        const text = raw.trim();
        if (text.length >= 60 && text.length <= 190 && !text.includes('—')) {
          return { text, story };
        }
      }
    }
  }
  return null;
}

export const HERO_LABELS: Record<HeroPanel['key'], string> = {
  film: 'Film',
  tv: 'TV',
  games: 'Games',
  events: 'Events',
  latest: 'Latest',
};

export function buildHomepageFeed(
  articles: HomeStory[],
  videos: HomeStory[],
  opts: {
    featured?: FeaturedWorldConfig | null;
    intelOrbit?: number;
    railLimit?: number;
    /** Story ids the category panels should show first (the production
        Featured Highlights mix, src/lib/featured-highlights.ts). */
    heroPicks?: string[];
  } = {},
): HomepageFeed {
  const intelOrbit = opts.intelOrbit ?? 3;
  const railLimit = opts.railLimit ?? 10;

  const safeArticles = (Array.isArray(articles) ? articles : []).filter(Boolean).sort(newestFirst);
  const safeVideos = (Array.isArray(videos) ? videos : []).filter(Boolean).sort(newestFirst);
  const all = [...safeArticles, ...safeVideos].sort(newestFirst);

  const used = new Set<string>();
  const claim = (s: HomeStory | undefined | null): HomeStory | null => {
    if (!s || used.has(s.id)) return null;
    used.add(s.id);
    return s;
  };
  const free = (s: HomeStory) => !used.has(s.id);

  /* 1. Hero, FIRST. Each category shows its `heroPicks` story when one of
        them is in that category (the production Featured Highlights mix,
        which Andrew prefers: a featured/recent video per category, the best
        performer and the newest article), otherwise its newest story with
        art, article or video. LATEST is then the newest story left. The hero
        runs before Featured, which used to claim every Lanterns story first.
        A category with nothing to show drops its panel rather than
        rendering an empty one. */
  const withArt = (s: HomeStory) => Boolean(s.image);
  const hero: HeroPanel[] = [];
  const catKey: Record<HomeCategory, HeroPanel['key']> = { Film: 'film', TV: 'tv', Games: 'games', Events: 'events' };
  const picked = new Set(Array.isArray(opts.heroPicks) ? opts.heroPicks : []);
  const inCat = (cat: HomeCategory) => (s: HomeStory) => free(s) && withArt(s) && s.category === cat;
  for (const cat of HOME_CATEGORIES) {
    const story = claim(all.find((s) => picked.has(s.id) && inCat(cat)(s)) ?? all.find(inCat(cat)));
    if (story) hero.push({ key: catKey[cat], label: HERO_LABELS[catKey[cat]], story });
  }
  const latest = claim(all.find((s) => free(s) && withArt(s)));
  if (latest) hero.push({ key: 'latest', label: HERO_LABELS.latest, story: latest });

  /* 2. Featured world, from what the hero left. The lead is the newest
        ARTICLE in the world with an image, else its newest story with art;
        videos fill the cards. No lead, no section. `total` still counts the
        whole world, hero-borrowed stories included. */
  let featured: FeaturedWorld | null = null;
  const cfg = opts.featured;
  if (cfg && cfg.match) {
    const inWorld = all.filter((s) => wordMatch(s.matchText, cfg.match));
    const avail = inWorld.filter(free);
    const lead = avail.find((s) => s.type === 'article' && s.image) ?? avail.find((s) => s.image);
    if (lead) {
      claim(lead);
      /* Cards: the other articles first (they are the rarer kind), then the
         newest videos, three in all. */
      const rest = inWorld.filter(free);
      const picked = [...rest.filter((s) => s.type === 'article'), ...rest.filter((s) => s.type === 'video')]
        .slice(0, 3)
        .map(claim)
        .filter((s): s is HomeStory => s !== null)
        .sort(newestFirst);
      featured = { title: cfg.title, lead, items: picked, total: inWorld.length };
    }
  }

  /* 3. Intel — the written side, articles only. */
  const intelPool = safeArticles.filter(free);
  const intelLead = claim(intelPool.find(withArt) ?? intelPool[0]);
  const orbit = safeArticles
    .filter(free)
    .slice(0, intelOrbit)
    .map(claim)
    .filter((s): s is HomeStory => s !== null);

  /* 4. The pull quote between Intel and Featured leads INTO the featured
        world when it can, and otherwise quotes the Intel lead. It does not
        claim: quoting a story shown elsewhere is the point of a pull quote. */
  const quote = pickPullQuote([featured?.lead, intelLead, ...safeArticles].filter(Boolean) as HomeStory[]);

  /* 5. The rail — long-form video, newest first. */
  const rail = safeVideos
    .filter(free)
    .slice(0, railLimit)
    .map(claim)
    .filter((s): s is HomeStory => s !== null);

  return { hero, intel: { lead: intelLead, orbit }, quote, featured, rail };
}
