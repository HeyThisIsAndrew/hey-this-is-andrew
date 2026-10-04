# Local CMS for the monorepo: audit and plan

Status: built. `packages/local-cms` edits every content store of
`sites/hey-this-is-andrew` (Now, Brands, Projects, Goals, Gear) and ships in
`templates/site-starter` (Panels, Posts), so every new site starts with it.
Andrew's decisions (2026-10-04) are in section 6.

## 1. How BE Unconventional HQ's local CMS works, end to end

Read from the BeUnconventionalHQ repo (unchanged). Five pieces:

| Piece | Where (HQ) | What it does |
| --- | --- | --- |
| Route | `src/dev-routes/local-cms.astro` | A page at `/local-cms`, injected by an integration in `astro.config.mjs` only when `command === 'dev'` (`injectRoute`), so it never exists in a build. It renders the editor inside HQ's Layout with `noindex`. Production also blocks the path in robots and the sitemap filter, belt and braces. |
| Editor | `src/components/admin/LocalCmsApp.tsx` (2,835 lines, React, `client:only`) | Loads both stores, keeps every document in React state, a master list with filters (All, Videos, Shorts, Live, Events, Featured, Topics, Articles, Outro) and one hand-written form per document type (`VideoForm`, `EventForm`, `BrandForm`, `TopicForm`, `ArticleForm`, `ArticleOutroForm`). Saving POSTs each whole store back. Image fields use an asset picker over every ref already in the store, plus an upload. |
| API | `localCmsMiddleware()` in `astro.config.mjs` | A Vite plugin whose `configureServer` adds `/api/local-cms/videos`, `/articles` (GET reads the JSON file, POST writes it) and `/upload`. `configureServer` never runs for `astro build`, so none of it ships. Writes are size-limited (50 MB), go through the store guard, and land atomically (write a temp file, rename). |
| Store guard | `src/lib/local-cms-store.mjs` | `validateStorePayload` refuses invalid JSON, anything that is not an array, and an EMPTY array (a failed fetch leaves an editor holding `[]`, and one POST of it once wiped 211 videos). `serializeStore` always pretty-prints (2 spaces, trailing newline), because the client sends minified JSON and one save once flattened 9,781 lines onto one. |
| Tests | `scripts/local-cms-store.test.mjs` | Every refusal above, reproduced from real incidents, plus the format rule. |

Images: `/upload` sends the file to **Sanity's asset store** (needs
`SANITY_WRITE_TOKEN`) and stores the bare asset id; `urlFor()` builds CDN
URLs from it. HQ also runs Sanity Studio at `/admin` (`sanity.config.ts`,
`schema/`), and the local document types mirror the Sanity types, but at
runtime the site reads only the local JSON (`src/data/videos.json`,
`articles.json`). Editing flow: `npm run dev`, edit at `/local-cms`, commit
the JSON, push, deploy.

## 2. Site-agnostic vs HQ-specific

**Site-agnostic (extracted into `packages/local-cms`):**

- Dev-only route injection (`command === 'dev'`), never in a build.
- The Vite middleware shape: GET reads a store, POST validates and writes it
  atomically, a size limit, a JSON error body.
- The store guard and the pretty-print rule, with their tests.
- The upload endpoint (the transport: size limit, base64 body, a safe file
  name), with the destination made a config choice.
- An editor shell: list of collections, list of items, a form per item,
  add / remove / reorder, save, a clear error when a write is refused.

**HQ-specific (stays in HQ, never in the package):**

- The document types and their fields: videos, shorts, live, events,
  featured brands, topics, articles, outros; `franchises`, `characters`,
  `coverageType`, `youtubeSyncKeywords`, `hubCategory`, `brandColor`,
  `excludeCoverage`, `pinnedCoverage` and the rest.
- The three field classes (factual / derived / editorial) and the YouTube
  sync's Sync Lock: rules about HQ's data, not about editing.
- Sanity Studio and the Sanity document schemas (the package borrows only
  the asset store, section 3).
- HQ's filters, its media-kit preview link, its Tailwind look.

**What the package does instead:** collections are CONFIG. A site passes
`{ name, label, file, itemLabel, fields: [{ key, label, type, ... }] }` and
the editor renders forms from it. Field types: `text`, `textarea`,
`markdown`, `url`, `email`, `number`, `date`, `boolean`, `select`, `list`,
`asset` (an image, see section 3), `group` (an object of fields) and `array`
(rows of fields). Nothing about any one site is written in the package.

Two deliberate differences from HQ's code:

1. **No React.** The personal site has no React integration, and the shell is
   small: an Astro page with one plain script renders the forms. Adding
   React and `@astrojs/react` to every site for a dev-only tool was not worth
   it. If a form ever needs something rich, the shell can mount a framework
   component per field later.
2. **The image host is a config choice** (`imageHost`), not hardcoded to
   Sanity: `repo` (uploads land in `src/assets/uploads/`, optimised by Astro
   at build) or `sanity` (HQ's system, section 3). Only image types (png,
   jpg, jpeg, webp) are accepted, the name is sanitised, an existing repo
   file is never overwritten.

The guard also gained one generic rule HQ does not have: a collection's
`required` fields must be present and non-empty in every item, or the write
is refused (a half-filled brand would otherwise ship).

## 3. Sanity: the image host, exactly as HQ uses it

HQ's runtime data is local JSON; Sanity is its image host (and Studio).
These sites take the same shape and stop there:

- **Content stays in the repo as JSON.** Every change is a commit:
  reviewable, revertable, deployed by the same push as code, no tokens in CI,
  no second schema to keep in step. No Studio: the local CMS is the editor.
- **Images can live on Sanity's free tier**, which is what keeps storage off
  any bill and binaries out of git. With `imageHost: { type: 'sanity',
  projectId, dataset }` the CMS uploads to Sanity's asset store
  (`SANITY_WRITE_TOKEN`, from `.env`, read only at upload time) and stores
  the bare asset id, `image-<hash>-WxH-ext`, exactly as HQ's store does. The
  id carries the size, so `resolveImage()` builds the CDN URL and the width
  and height with no API call, and the build stays offline.
- **Until a Sanity project id is set, `imageHost` is `repo`.** Both kinds of
  value resolve side by side, so switching is one config line and no
  migration: old repo paths keep working, new uploads go to Sanity.

To switch a site: create (or reuse) a Sanity project, add an API token with
Editor rights, put it in `.env` as `SANITY_WRITE_TOKEN`, set `imageHost` in
`local-cms.config.mjs`. `image.domains` already allows `cdn.sanity.io`.

## 4. What is built

- `packages/local-cms`: the integration (`localCms(config)`), the middleware
  factory, the store guard, the upload endpoint (repo or Sanity), the
  editor shell, `resolveImage()` and the Sanity helpers, with tests for each
  (`pnpm test` in the package; the site's `pnpm test` runs them too).
- `sites/hey-this-is-andrew/local-cms.config.mjs`, five collections:
  - **Now** (`src/data/now.json`). `NOW_MONTH` is the build month.
  - **Brands** (`src/data/brands.json`), read through `src/data/brands.ts`.
    The Sip the Magic teaser art stays in code (picked by a `teaserArt`
    name): raw SVG markup is not something to edit in a form.
  - **Projects, Goals, Gear** (`src/data/*.json`): moved from Markdown/YAML
    in `src/content` to JSON stores, loaded by Astro's `file()` loader so
    the zod schemas still validate them at build. A project's Markdown body
    is kept as a `markdown` field. The move changed no rendered text or id
    (every built page compared before and after).
- Images in every store resolve through `src/data/images.ts`.
- `templates/site-starter`: the same CMS with Panels and Posts, so a site
  made with `pnpm new-site` is editable from day one.
- Dev only: `pnpm dev`, open `/local-cms`, edit, Save (writes the JSON in
  the repo), commit, push, Pages deploys. A build contains no `/local-cms`
  page and no `/api/local-cms` code (`audit-dist.mjs` fails if it does).

## 5. Later, not planned

- HQ adopting the package (its forms become a config plus a few custom field
  types). Not proposed until the package has run here for a while; HQ is
  not touched from this repo.

## 6. Andrew's decisions (2026-10-04)

1. Sanity: content stays local JSON; use Sanity the way HQ does (image host)
   rather than iterating towards it. Built as `imageHost`, section 3.
2. Goals, Gear, Projects: whatever is better long term, edited in a CMS.
   Built as JSON stores (one editor, one file shape, schema-checked).
3. Uploads: repo for now; the end state is HQ's Sanity system, avoiding
   paid storage. Both are built; switching is one line.
4. The starter template ships the CMS. Built.
