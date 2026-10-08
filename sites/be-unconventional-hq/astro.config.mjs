// @ts-check
import { defineConfig, envField, fontProviders, svgoOptimizer } from 'astro/config';
import fs from 'node:fs';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';
import { cacheCloudflare } from '@astrojs/cloudflare/cache';
import react from '@astrojs/react';
import googlePreferredSource from '@puralex/astro-google-preferred-source';
import { createClient } from '@sanity/client';
import { validateStorePayload, serializeStore } from './src/lib/local-cms-store.mjs';
import { minifyInlineScripts } from './src/lib/minify-inline-scripts.mjs';

/**
 * Minify every page's `is:inline` scripts after the build. Why, and exactly
 * which scripts, is in src/lib/minify-inline-scripts.mjs. esbuild is Astro's
 * and Vite's own dependency, loaded here only when a build finishes.
 * @returns {import('astro').AstroIntegration}
 */
function minifyInlineScriptsIntegration() {
  return {
    name: 'minify-inline-scripts',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const { transformSync } = await import('esbuild');
        const root = dir instanceof URL ? dir.pathname : String(dir);
        /** @type {(d: string) => string[]} */
        const walk = (d) =>
          fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
            const p = path.join(d, e.name);
            return e.isDirectory() ? walk(p) : e.name.endsWith('.html') ? [p] : [];
          });
        let before = 0;
        let after = 0;
        let failed = 0;
        for (const file of walk(root)) {
          const html = fs.readFileSync(file, 'utf8');
          const result = minifyInlineScripts(html, (code) => transformSync(code, { minify: true, loader: 'js' }).code);
          before += result.before;
          after += result.after;
          failed += result.failed;
          if (result.html !== html) fs.writeFileSync(file, result.html);
        }
        logger.info(`inline scripts ${before} -> ${after} bytes${failed ? `, ${failed} left as written (did not parse)` : ''}`);
      },
    },
  };
}

const isProd = process.env.NODE_ENV === 'production';

// Same project the Studio and urlFor() already point at (src/lib/local-content.ts).
const SANITY_PROJECT_ID = '38nhxsib';
const SANITY_DATASET = 'production';

/*
  ─── THE STUDIO INTEGRATION IS DEV-ONLY, AND ITS ABSENCE MUST NOT BE FATAL ──

  @sanity/astro is a devDependency now (issue #151: it and `sanity` are ~170 MB
  that production never executes). Two things follow, and only the first one
  was handled when it moved.

  1. It must not be MOUNTED in production. `astro build` calls
     ensureProcessNodeEnv('production') before it loads this file, so `isProd`
     is true for every real build - verified: no /admin route and no Sanity
     chunk in dist. `astro dev` sets 'development', so the Studio is there
     when you want it.

  2. It must not be IMPORTED when it is not installed. That is the case
     `isProd` alone does not cover: a build whose environment already exports
     NODE_ENV as something other than "production" skips the guard and reaches
     a bare `await import()` of a package that `npm ci --omit=dev` never
     installed. The import throws and takes the whole build with it, for a
     dev-only tool that production does not want mounted anyway.

  So the failure is caught and LOUD, per the house rule the article and
  YouTube syncs already follow: say what broke, keep going. Skipping is always
  the correct outcome here - the only thing lost is /admin, which is a local
  tool - and the warning is there so a broken dev install reads as broken
  rather than as the Studio silently not existing.
*/
async function studioIntegration() {
  if (isProd) return [];
  try {
    const { default: sanity } = await import('@sanity/astro');
    return [sanity({
      projectId: SANITY_PROJECT_ID,
      dataset: SANITY_DATASET,
      // Fresh data locally; a production build never gets here.
      useCdn: false,
      apiVersion: '2024-03-01',
      studioBasePath: '/admin',
    })];
  } catch (err) {
    console.warn(
      '[studio] @sanity/astro could not be loaded, so /admin is not mounted. ' +
      'Everything else builds normally. If you wanted the Studio, run a full ' +
      '`npm install` (it is a devDependency).\n         ' +
      (err instanceof Error ? err.message : String(err))
    );
    return [];
  }
}

/**
 * /intel/<slug> → ISO date, for the sitemap's <lastmod>.
 *
 * Read straight off the durable snapshot rather than from src/lib/articles.ts,
 * because this file is plain Node: importing the .ts module (which statically
 * imports the JSON) is not something the config can do. The rule it applies is
 * the same one the route uses — see getPublishedArticles() in
 * src/lib/articles.ts and the RESERVED_SLUGS filter in
 * src/pages/intel/[slug].astro.
 *
 * `lastUpdated` is when we last saw the post change; `isoDate` is when it was
 * published. Prefer the former, fall back to the latter, and emit nothing at
 * all rather than a made-up date.
 */
function buildArticleLastmod() {
  const map = new Map();
  try {
    const raw = fs.readFileSync(path.resolve(process.cwd(), 'src/data/articles.json'), 'utf-8');
    
    let maxGlobal = 0;
    /** @type {Record<string, number>} */
    const maxByCategory = { Film: 0, TV: 0, Games: 0, Events: 0 };
    
    for (const record of JSON.parse(raw)) {
      if (!record || record.editorial?.hidden || !record.hasBody || !record.slug) continue;
      if (record.slug === 'topic' || record.slug === 'page') continue;
      const stamp = record.lastUpdated || record.isoDate;
      const date = stamp ? new Date(stamp) : null;
      if (!date || Number.isNaN(date.getTime())) continue;
      
      const time = date.getTime();
      map.set(`/intel/${record.slug}`, date.toISOString());
      
      if (time > maxGlobal) maxGlobal = time;
      if (record.category && maxByCategory[record.category] !== undefined) {
        if (time > maxByCategory[record.category]) {
          maxByCategory[record.category] = time;
        }
      }
    }
    
    /*
      ─── ARTICLE-ONLY SURFACES ────────────────────────────────────────────

      /intel and /feed/articles list articles and nothing else, so the newest
      article IS their modification date.
    */
    if (maxGlobal > 0) {
      const isoGlobal = new Date(maxGlobal).toISOString();
      map.set('/intel', isoGlobal);
      map.set('/feed/articles', isoGlobal);
    }

    /*
      ─── AND THE MIXED ONES ───────────────────────────────────────────────

      / and /feed show videos and shorts alongside articles, so dating them
      from the newest ARTICLE was a claim neither page can support: a
      six-hourly YouTube sync changes both, and on that day the sitemap said
      they had not changed since the last post.

      A lastmod that is wrong in the "nothing happened" direction is the worse
      of the two errors — it tells a crawler to skip a page that did change,
      which is the opposite of the reason lastmod was added. So these take the
      newest of EITHER source. videos.json carries `publishedAt` on video,
      short and live docs; hub docs (event, featuredBrand, topic) have no date
      and are skipped rather than guessed at.
    */
    let maxMedia = 0;
    try {
      const rawMedia = fs.readFileSync(path.resolve(process.cwd(), 'src/data/videos.json'), 'utf-8');
      for (const doc of JSON.parse(rawMedia)) {
        if (!doc || !['video', 'short', 'live'].includes(doc._type)) continue;
        const date = doc.publishedAt ? new Date(doc.publishedAt) : null;
        if (!date || Number.isNaN(date.getTime())) continue;
        if (date.getTime() > maxMedia) maxMedia = date.getTime();
      }
    } catch {
      // No media snapshot: fall back to the article date alone, which is
      // exactly what these pages carried before.
    }

    const maxMixed = Math.max(maxGlobal, maxMedia);
    if (maxMixed > 0) {
      const isoMixed = new Date(maxMixed).toISOString();
      map.set('/', isoMixed);
      map.set('/feed', isoMixed);
      map.set('/feed/videos', isoMixed);
    }
    
    for (const [cat, maxTime] of Object.entries(maxByCategory)) {
      if (maxTime > 0) {
        const isoCat = new Date(maxTime).toISOString();
        const slug = cat.toLowerCase();
        map.set(`/category/${slug}`, isoCat);
        map.set(`/intel/topic/${slug}`, isoCat);
      }
    }
    
  } catch {
    // A missing or malformed snapshot must not fail the build. The sitemap
    // simply ships without lastmod, which is exactly where it was before.
  }
  return map;
}

const ARTICLE_LASTMOD = buildArticleLastmod();

try {
  const rawVideos = fs.readFileSync(path.resolve(process.cwd(), 'src/data/videos.json'), 'utf-8');
  for (const record of JSON.parse(rawVideos)) {
    if (record && record._type === 'event' && record.slug?.current) {
      const stamp = record._updatedAt || record._createdAt || record.isoDate;
      if (stamp) {
        ARTICLE_LASTMOD.set(`/events/${record.slug.current}`, new Date(stamp).toISOString());
      }
    }
  }
} catch (err) {
  // Graceful degradation: sitemap just ships without event lastmods
}


/**
 * Article-section categories that currently have NOTHING in them.
 *
 * /intel/topic/<category> is generated for every canonical category, not only
 * the ones with articles, because IntelFilters always shows every category and
 * a filter button that 404s is worse than one leading to an honest empty
 * state. That is right for a reader and wrong for a crawler.
 *
 * /intel/topic/events had zero articles and sat in this sitemap anyway, so we
 * were advertising a destination with nothing at it. Search Console returned
 * "Soft 404: URL is not available to Google" on 2026-08-28. The page keeps
 * rendering (and now carries noindex, set by IntelLayout); it just stops being
 * advertised. Both lift automatically on that category's first article.
 *
 * Same eligibility rule as buildArticleLastmod above: a record needs a body
 * and a slug, and must not be hidden.
 */
function emptyArticleTopicPaths() {
  const withArticles = new Set();
  try {
    const raw = fs.readFileSync(path.resolve(process.cwd(), 'src/data/articles.json'), 'utf-8');
    for (const record of JSON.parse(raw)) {
      if (!record || record.editorial?.hidden || !record.hasBody || !record.slug) continue;
      if (record.category) withArticles.add(String(record.category).toLowerCase());
    }
  } catch {
    /* Unreadable snapshot: exclude nothing rather than silently dropping the
       whole section from the sitemap. Degrading toward "advertise it" is the
       safer direction of the two. */
    return [];
  }
  /* 'General' is the unmapped-post bucket and is never browsable, so it has no
     page to exclude. Mirrors the same filter in the route's getStaticPaths. */
  return CANONICAL_ARTICLE_CATEGORIES
    .filter((category) => category !== 'General')
    .map((category) => category.toLowerCase())
    .filter((slug) => !withArticles.has(slug))
    .map((slug) => `/intel/topic/${slug}`);
}

/* Duplicated from src/data/constants.js on purpose: this file is plain Node
   and cannot import the ESM module that statically imports JSON. Kept in sync
   by scripts/seo-routing.test.mjs, which fails if the two lists diverge. */
const CANONICAL_ARTICLE_CATEGORIES = ['Film', 'TV', 'Games', 'Events', 'General'];

const EMPTY_ARTICLE_TOPIC_PATHS = emptyArticleTopicPaths();

// Dev-only Local CMS backing store: GET/POST src/data/videos.json straight off
// disk. Only wired into the Vite DEV server (configureServer never runs for
// `astro build`), so this never ships to the production worker bundle.
function localCmsMiddleware() {
  return {
    name: 'local-cms-api',
    /** @param {import('vite').ViteDevServer} server */
    configureServer(server) {
      server.middlewares.use('/api/local-cms/videos', /** @param {import('http').IncomingMessage} req @param {import('http').ServerResponse} res @param {Function} next */ (req, res, next) => {
        const filePath = path.resolve(process.cwd(), 'src/data/videos.json');
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(fs.readFileSync(filePath, 'utf-8'));
          return;
        }
        if (req.method === 'POST') {
          /** @type {Buffer[]} */
          let chunks = [];
          let totalLength = 0;
          let tooLarge = false;
          req.on('data', /** @param {Buffer} chunk */ chunk => {
            if (tooLarge) return;
            chunks.push(chunk);
            totalLength += chunk.length;
            if (totalLength > 50 * 1024 * 1024) { // 50MB limit
              tooLarge = true;
              res.statusCode = 413;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: 'Payload Too Large' }));
              req.on('error', () => {}); // Catch unhandled destroy errors
              req.destroy();
            }
          });
          req.on('end', () => {
            if (tooLarge) return;
            const body = Buffer.concat(chunks).toString('utf-8');
            const check = validateStorePayload(body, 'videos.json');
            if (!check.ok) {
              res.statusCode = check.status;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: check.error }));
              return;
            }
            /*
              The VALIDATED, RE-SERIALISED documents, never the raw body. The
              CMS client sends minified JSON, and writing that verbatim
              flattened the whole store onto one line and disabled the
              per-document merge driver. See serializeStore().
            */
            const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
            fs.writeFileSync(tmpPath, serializeStore(check.parsed), 'utf-8');
            fs.renameSync(tmpPath, filePath);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true }));
          });
          return;
        }
        next();
      });

      // Uploads straight to Sanity's asset store (already the image host for
      // every existing event/featuredBrand doc - see urlFor() in
      // local-content.ts) instead of public/uploads/, which is gitignored by
      // design (dev-only tool, must never ship image files into the repo) and
      // therefore could never actually serve an uploaded image in production.
      // Returns the bare asset id ("image-<hash>-<W>x<H>-<ext>") - a plain
      // string, kept out of resolving it to a CDN URL here so urlFor() stays
      // the single place that happens, same as every other image on the site.
      
      server.middlewares.use('/api/local-cms/articles', /** @param {import('http').IncomingMessage} req @param {import('http').ServerResponse} res @param {Function} next */ (req, res, next) => {
        const filePath = path.resolve(process.cwd(), 'src/data/articles.json');
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          if (!fs.existsSync(filePath)) {
            res.end('[]');
            return;
          }
          res.end(fs.readFileSync(filePath, 'utf-8'));
          return;
        }
        if (req.method === 'POST') {
          /** @type {Buffer[]} */
          let chunks = [];
          let totalLength = 0;
          let tooLarge = false;
          req.on('data', /** @param {Buffer} chunk */ chunk => {
            if (tooLarge) return;
            chunks.push(chunk);
            totalLength += chunk.length;
            if (totalLength > 50 * 1024 * 1024) {
              tooLarge = true;
              res.statusCode = 413;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: 'Payload Too Large' }));
              req.on('error', () => {}); 
              req.destroy();
            }
          });
          req.on('end', () => {
            if (tooLarge) return;
            const body = Buffer.concat(chunks).toString('utf-8');
            const check = validateStorePayload(body, 'articles.json');
            if (!check.ok) {
              res.statusCode = check.status;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: check.error }));
              return;
            }
            /*
              serializeStore, NOT the raw body — the same rule as the videos
              handler above. This one was missed when that fix went in, and a
              single CMS save flattened articles.json from 415 lines to one.
              Every store write goes through one of these two handlers, so
              BOTH have to re-serialise or the format is only half enforced.
            */
            const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
            fs.writeFileSync(tmpPath, serializeStore(check.parsed), 'utf-8');
            fs.renameSync(tmpPath, filePath);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true }));
          });
          return;
        }
        next();
      });

      server.middlewares.use('/api/local-cms/upload', /** @param {import('http').IncomingMessage} req @param {import('http').ServerResponse} res @param {Function} next */ (req, res, next) => {
        if (req.method === 'POST') {
          /** @type {Buffer[]} */
          let chunks = [];
          let totalLength = 0;
          let tooLarge = false;
          req.on('data', /** @param {Buffer} chunk */ chunk => {
            if (tooLarge) return;
            chunks.push(chunk);
            totalLength += chunk.length;
            if (totalLength > 50 * 1024 * 1024) { // 50MB limit
              tooLarge = true;
              res.statusCode = 413;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: 'Payload Too Large' }));
              req.on('error', () => {}); // Catch unhandled destroy errors
              req.destroy();
            }
          });
          req.on('end', async () => {
            if (tooLarge) return;
            try {
              const body = Buffer.concat(chunks).toString('utf-8');
              const parsed = JSON.parse(body);
              if (!parsed.filename || !parsed.data) {
                throw new Error('Missing filename or data');
              }
              const base64Data = parsed.data.split(',')[1];
              if (!base64Data) throw new Error('Invalid base64');
              const buffer = Buffer.from(base64Data, 'base64');

              const token = process.env.SANITY_WRITE_TOKEN;
              if (!token) {
                throw new Error('SANITY_WRITE_TOKEN is not set in .env - required to upload images via the Local CMS. See .env.example.');
              }

              const client = createClient({
                projectId: SANITY_PROJECT_ID,
                dataset: SANITY_DATASET,
                token,
                apiVersion: '2024-03-01',
                useCdn: false,
              });
              const asset = await client.assets.upload('image', buffer, { filename: parsed.filename });

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ref: asset._id }));
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
            }
          });
          return;
        }
        next();
      });
    }
  };
}

export default defineConfig({
  cache: { provider: cacheCloudflare() },
  /*
    EDGE CACHE POLICY FOR THE QUOTA-GATED ROUTES (#196).

    `RouteRule` is `{ maxAge, swr, tags }` and nothing else. It is validated
    by a plain `z.object()`, which STRIPS unknown keys instead of rejecting
    them, so a rule written in any other shape parses "successfully" as `{}`
    and silently disables the policy it was meant to declare. An earlier
    version of this block used `{ headers: { 'Cache-Control': ... } }` and
    did exactly that: the provider received `{}` and emitted a bare
    `Cloudflare-CDN-Cache-Control: public` with no TTL at all.

    That is not a cosmetic slip on this particular route. `/api/live-status.json`
    calls YouTube `search.list` at 100 units against a 10,000/day quota, and
    the edge cache IS the rate limiter (see scripts/live-status.md). A rule
    that strips to `{}` removes the limiter.

    `maxAge` here is the EDGE lifetime: it is emitted on
    `Cloudflare-CDN-Cache-Control`, which is CDN-targeted, so it plays the
    role `s-maxage` plays on a normal `Cache-Control`. The route's own
    `Cache-Control` (set in the handler) still carries `max-age=0` for
    browsers, so visitors revalidate while the edge serves for 15 minutes.

    `scripts/route-cache.test.mjs` validates this against Astro's own shipped
    schema, so a future rule that strips to nothing fails the suite rather
    than shipping quiet.
  */
  routeRules: {
    '/api/live-status.json': { maxAge: 900, swr: 300 },
    /* NOT /img/yt/[id]/[w] (the hero art). A route rule would stamp the edge
       TTL on its 404s too, and a missing thumbnail must not be cached for a
       week, so that route sets its edge cache per response instead. */
  },

  site: 'https://beunconventionalhq.com',
  base: '/',
  // 'ignore' (default): dev accepts links with or without a trailing slash.
  // Production (Cloudflare Workers, not Pages) serves the canonical
  // no-trailing-slash form via assets.html_handling: "drop-trailing-slash"
  // in wrangler.jsonc, matching how every internal link in this codebase
  // is already written. Canonical <link> (Layout.astro) and the sitemap
  // (serialize below) are normalized to match — a mismatch here means a
  // canonical tag or sitemap entry points at a URL that immediately
  // redirects elsewhere.
  trailingSlash: 'ignore',
  redirects: {
    '/articles': '/feed/articles',
    '/videos': '/feed/videos',
    '/events-new': '/events',
    // The collaborations hub lived at /press-kit until it grew a second
    // one-sheet and stopped being just a press kit. Anything already shared
    // with a publicist or brand points at the old path.
    '/press-kit': '/collaborations',

    /*
      ─── THE CATEGORY ROUTE MOVE, FINISHED ──────────────────────────────────
      Commit 87c450d (2026-08-19) renamed src/pages/feed/[category]/ to
      src/pages/category/[category]/. It updated the internal links, which is
      why nothing looked broken. What it could not update is Google, which had
      already discovered /feed/film, /feed/tv and /feed/film/2 from the
      sitemap and still lists them as known URLs. Since the rename those have
      been 404s with no forwarding, so every bit of crawl equity they held was
      being thrown away.

      Only the paths Google actually knows about are listed. /feed/gaming and
      /feed/events are here too because they were generated by the same
      getStaticPaths and are the same one-line risk to cover; the paginated
      /category/film/2 is the only page-2 that ever existed.

      These do NOT collide with anything under /feed any more: the feed routes
      are single pages (src/pages/feed/index.astro and friends) and no longer
      generate numeric segments at all. They did not collide before either,
      since paginate() only ever emitted numeric ones.
      scripts/seo-routing.test.mjs pins that.
    */
    '/feed/film': '/category/film',
    '/feed/film/2': '/category/film/2',
    '/feed/tv': '/category/tv',
    // Retargeted past /category/gaming when that moved (below). A redirect
    // whose destination is itself a redirect costs a crawler an extra hop and
    // is the shape Search Console reports as a redirect chain.
    '/feed/gaming': '/category/games',
    '/feed/events': '/category/events',

    /*
      ─── THE FEED PAGINATION COLLAPSE ───────────────────────────────────────
      /feed and /feed/videos used to paginate. Their rows render the whole set,
      so a numbered page was a duplicate of the page before it, and once the
      numbered links came out of FeedGrid nothing linked to them — but the
      sitemap had already handed them to Google.

      Same reasoning as the category rename above: the pages are gone, and a
      URL Google knows must forward rather than 404, or the crawl equity it
      holds is simply discarded.

      This list is FROZEN, not a moving target. It is exactly what the last
      paginated build emitted (verified against dist/client/feed), and since
      neither route can generate a numeric segment any more, no new entry can
      ever be needed. /feed/articles is absent on purpose: it never had enough
      articles to reach a second page, so there is nothing Google could know.
    */
    '/feed/2': '/feed',
    '/feed/3': '/feed',
    '/feed/4': '/feed',
    '/feed/videos/2': '/feed/videos',
    '/feed/videos/3': '/feed/videos',

    /*
      ─── AND THE EVENTS PAGINATION COLLAPSE ─────────────────────────────────
      Same story, same remedy. /events paged its upcoming list 12 at a time;
      the list is a scroll container inside the page now
      (UpcomingEventsList.astro) and there is no second document to go to.

      One entry, because one numbered page is all that ever existed: verified
      against dist/client/events of the last paginated build, which contains
      `2` and nothing higher. 15 secondary events at a page size of 12 cannot
      reach a third.

      /events/archive is untouched and still paginates.
    */
    '/events/2': '/events',

    /*
      ─── THE GAMING → GAMES RENAME (#146) ───────────────────────────────────
      The content category was renamed from `Gaming` to `Games`, and the label
      is the URL slug, so two live paths moved. Both were generated from the
      category list, both were in the sitemap, and /category/gaming is one of
      the URLs Search Console already lists for this site (it learned it from
      the noindex stub described above, and never forgot it).

      The hub-category label of the same name did NOT move anything: that key
      is a document field, not a route segment. See HUB_CATEGORY_LABELS in
      src/lib/local-content.ts for why those are two different taxonomies.

      No /category/gaming/2 or /intel/topic/gaming/2 is listed because neither
      ever had enough items to paginate.
    */
    '/category/gaming': '/category/games',
    '/intel/topic/gaming': '/intel/topic/games',
  },
  // ClientRouter already swaps pages without a full reload; prefetching the
  // destination on hover/touch-start is what makes that swap feel instant
  // rather than merely fast. 'hover' rather than 'load' so we are not pulling
  // every linked page on a phone's data plan.
  prefetch: {
    prefetchAll: true,
    /*
      ─── 'tap', NOT 'hover' — A FINGER NEVER HOVERS ───────────────────────
      `hover` binds mouseenter and focus. Neither exists on a touch screen, so
      this setting meant DESKTOP got every destination pre-warmed and MOBILE
      got nothing: every phone navigation paid the full document fetch inside
      the transition, with the document being 264KB for an article and 619KB
      for /feed. That asymmetry is the clearest reason the two platforms felt
      so different, and it was in this line rather than in the animation.

      Measured directly on one link before the change: `mouseenter` fired 1
      prefetch request, `touchstart` fired 0.

      `tap` binds touchstart and mousedown, so it covers BOTH input methods —
      the phone gains the pre-warm, and the desktop keeps a (later, but still
      useful) one on mousedown.

      Not `viewport`, which prefetches every link as it scrolls into view: with
      `prefetchAll` on a feed of this length that is a lot of documents of this
      size pulled on a phone's data plan for links nobody touched.
    */
    defaultStrategy: 'tap',
  },

  // Astro Fonts API: Declares Syne and Inter with fallback metric overrides
  // to eliminate Cumulative Layout Shift (CLS) on font swap, serving existing
  // repository font files via fontProviders.local() for fully offline builds.
  fonts: [
    {
      name: 'Syne',
      cssVariable: '--font-display',
      provider: fontProviders.local(),
      weights: [600, 700, 800],
      options: {
        variants: [
          {
            src: ['./public/fonts/syne.woff2'],
          },
        ],
      },
    },
    {
      name: 'Inter',
      cssVariable: '--font-body',
      provider: fontProviders.local(),
      weights: [400, 500, 600],
      options: {
        variants: [
          {
            src: ['./public/fonts/inter.woff2'],
          },
        ],
      },
    },
  ],

  experimental: {
    // OFF, and the comment here used to describe the opposite.
    //
    // On it upgrades prefetch from fetch-only to the Speculation Rules API, so
    // a hovered link is prerendered and parsed in a hidden tab. Paired with
    // `prefetchAll: true` above, that is EVERY link on the page, and on mobile
    // the hover that triggers it is a touchstart. The hypothesis for the
    // reported 1-2s delay between tapping a control and the transition
    // starting is that Chrome holds the navigation until the speculative
    // prerender of a heavy page reaches a presentable state.
    //
    // NOT YET CONFIRMED ON A DEVICE. It is a plausible cause with a cheap
    // remedy: ClientRouter's own fetch still makes navigation fast, so turning
    // this off costs little even if the delay turns out to be something else.
    // Measure on real hardware before treating it as solved.
    clientPrerender: false,
    // Optimizes imported SVGs at build time using SVGO, eliminating redundant
    // metadata and whitespace without runtime client JS overhead.
    svgOptimizer: svgoOptimizer(),
  },

  image: {
    // Every <Image> gets a srcset and sizes by default. This is the structural
    // fix behind a real bug: the /links logo carried no width, so Astro used
    // the source's intrinsic 2000x2000 and shipped a 413KB render into a
    // 340px box. With a default layout an unsized image cannot silently go
    // out at source resolution again.
    layout: 'constrained',
    responsiveStyles: true,
  },

  // Typed, validated env access. Replaces reading import.meta.env directly,
  // where a missing variable is indistinguishable from an empty string and
  // surfaces as a runtime error in the browser instead of a build failure.
  // PUBLIC_TURNSTILE_SITE_KEY is optional on purpose: the subscribe widget is
  // designed to omit itself when there is no key, so builds without one (CI,
  // local, preview) must still succeed.
  env: {
    schema: {
      PUBLIC_TURNSTILE_SITE_KEY: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
      }),
      TURNSTILE_SECRET_KEY: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      RESEND_API_KEY: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      WEBSUB_SECRET: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
    },
  },

  build: {
    assets: 'assets',
    inlineStylesheets: 'always',
  },
  vite: {
    build: {
      minify: 'esbuild',
    },
    esbuild: {
      drop: ['console', 'debugger'],
    },
    plugins: [tailwindcss(), localCmsMiddleware()],
    ssr: {
      noExternal: ['react', 'react-dom']
    },
    optimizeDeps: {
      /*
        `@sanity/eventsource` is here because `@sanity/client` is excluded
        below. Excluding a dependency tells Vite to serve it and everything it
        imports unbundled, and eventsource ships two browser builds: an ESM
        `browser.mjs` reached through its `import` condition, and a CommonJS
        `browser.js` that is the plain `browser` default. Unbundled, the
        browser gets the CommonJS one and the Studio dies on

          does not provide an export named 'default'

        Naming it here opts that ONE package back into pre-bundling, which
        resolves through `import` and hands the browser real ESM. The parent
        stays excluded.
      */
      include: ['react', 'react-dom', 'react/jsx-runtime', '@sanity/eventsource'],
      exclude: ['@sanity/client']
    }
  },
  integrations: [
    react(),
    googlePreferredSource({ injectScript: false }),
    minifyInlineScriptsIntegration(),
    {
      name: 'dev-only-routes',
      hooks: {
        'astro:config:setup': ({ injectRoute, command }) => {
          if (command === 'dev') {
            injectRoute({
              pattern: '/local-cms',
              entrypoint: 'src/dev-routes/local-cms.astro'
            });
          }
        }
      }
    },
    sitemap({
      // WIP routes are excluded from the sitemap so Google doesn't treat them
      // as canonical destinations. Paired with a noindex meta on the pages
      // themselves and a robots.txt Disallow. Remove this filter (and both
      // gates) when /events-new is promoted to /events.
      // /links is a bio/entry utility route (noindex, no robots block — see
      // links.astro) and shouldn't be advertised as a canonical destination.
      // /admin is the embedded Sanity Studio (injected by studioBasePath) —
      // a CMS interface must never be advertised to search engines.
      // /local-cms is the dev-only Local CMS admin route — same reasoning.
      // /media-kit is a direct-share-only PDF route.
      // /collaborations/press-kit is the same: a direct-share one-sheet
      // reached from /collaborations (which stays in the sitemap) and
      // carrying its own noindex, so it must not be advertised as a separate
      // canonical destination. The '/press-kit' test matches both it and the
      // legacy /press-kit redirect stub, neither of which belongs here.
      filter: (page) => {
        const url = new URL(page);
        const path = url.pathname.replace(/\/$/, '');
        const excludedPaths = [
          '/links',
          '/admin',
          '/local-cms',
          '/media-kit',
          '/press-kit',
          '/collaborations/press-kit',
          '/articles',
          '/videos',
          '/events-new',
          // The legacy /feed/<category> paths now redirect to /category/<slug>
          // (see `redirects` above). A redirect must never be advertised as a
          // canonical destination, which is the whole reason the four entries
          // above this one are here.
          '/feed/film',
          '/feed/film/2',
          '/feed/tv',
          '/feed/gaming',
          '/feed/events',
          // The collapsed feed pagination (see `redirects` above). Same rule
          // as every entry around it: these now forward to /feed and
          // /feed/videos, and a redirect must never be advertised as a
          // canonical destination.
          '/feed/2',
          '/feed/3',
          '/feed/4',
          '/feed/videos/2',
          '/feed/videos/3',
          // The collapsed EVENTS pagination. /events shows its whole upcoming
          // list in a scroll container now, so /events/2 forwards to /events
          // and must not be advertised as a destination.
          '/events/2',
          // Renamed to /category/games and /intel/topic/games (#146). Same
          // rule: the sitemap advertises destinations, never sources.
          '/category/gaming',
          '/intel/topic/gaming',
          // Article-section pages with no articles at all. Computed, not
          // listed: the set changes as categories fill up. See
          // emptyArticleTopicPaths() above.
          ...EMPTY_ARTICLE_TOPIC_PATHS
        ];
        return !excludedPaths.includes(path);
      },
      // Strip trailing slashes to match assets.html_handling:
      // "drop-trailing-slash" — otherwise every sitemap entry sends
      // crawlers through an extra redirect hop before reaching the
      // canonical URL.
      //
      // Also stamps <lastmod> on article pages and hub pages. Until this existed the
      // sitemap carried NO lastmod on any of its 50 entries, which for a
      // news-shaped site is the single most useful signal it could have been
      // sending: it is how a crawler decides an already-known URL is worth
      // re-fetching, and how a newly added one is told it is new.
      //
      // Articles get their own lastmod; hub pages (/intel, /feed, etc.) get the 
      // max lastmod of their corresponding articles so Google crawls them when 
      // new content is published.
      serialize: (item) => {
        const url = new URL(item.url);
        if (url.pathname !== '/' && url.pathname.endsWith('/')) {
          url.pathname = url.pathname.slice(0, -1);
        }
        const lastmod = ARTICLE_LASTMOD.get(url.pathname);
        return lastmod ? { ...item, url: url.toString(), lastmod } : { ...item, url: url.toString() };
      },
    }),
    ...(await studioIntegration()),
  ],
  adapter: cloudflare({
    /*
      ─── BUILD-TIME IMAGE OPTIMISATION, NOT RUNTIME ─────────────────────────
      This is the fix for the ~938KB mobile image payload behind the 3.4s LCP.

      The adapter's DEFAULT is `'cloudflare'`, which defers resizing to a
      runtime `/_image` route backed by a Cloudflare Images binding. The build
      log announces it cheerfully — "Enabling image processing with Cloudflare
      Images ... with the 'IMAGES' Images binding" — but wrangler.jsonc
      declares no such binding, and Cloudflare Images is a paid add-on that was
      never provisioned. So every `/_image?href=…` request had nothing to
      serve it, and the browser fell back to the untouched originals in
      `/assets/`: logo.webp at 466KB and logo-mark.webp at 414KB. Two logos,
      880KB, on a page that displays them at 150px.

      `'compile'` runs the same sharp pipeline Astro uses locally, at BUILD
      time, and emits plain static files. No binding, no paid add-on, no
      runtime hop — and it also fixes local `astro preview`, where those
      `/_image` requests were returning 404 and rendering broken logos.

      Trade-off, stated plainly: builds do more work up front, and only images
      Astro can see at build time are optimised. Every `<Image>` on this site
      imports from `src/assets/`, so that covers all of them; remote thumbnails
      (YouTube, article covers) are plain `<img>` tags and were never in scope
      for this pipeline either way.
    */
    imageService: 'compile',
  }),
});
