# Local CMS for the monorepo: audit and plan

Status: phase 1 built (`packages/local-cms`, wired into
`sites/hey-this-is-andrew` for Now and Brands). Phase 2 waits on the decisions
at the end of this file.

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
- Uploading to Sanity and `urlFor()`.
- HQ's filters, its media-kit preview link, its Tailwind look.

**What the package does instead:** collections are CONFIG. A site passes
`{ name, label, file, itemLabel, fields: [{ key, label, type, ... }] }` and
the editor renders forms from it. Field types: `text`, `textarea`, `url`,
`email`, `boolean`, `select`, `asset` (a path under the site's assets
folder, chosen from a list or uploaded) and `group` (an object of the same
fields). Nothing about any one site is written in the package.

Two deliberate differences from HQ's code:

1. **No React.** The personal site has no React integration, and the shell is
   small: an Astro page with one plain script renders the forms. Adding
   React and `@astrojs/react` to every site for a dev-only tool was not worth
   it. If a form ever needs something rich, the shell can mount a framework
   component per field later.
2. **Uploads land in the repo** (`src/assets/uploads/` by default), not in
   Sanity: the personal site has no Sanity project, and Astro optimises any
   image under `src/assets` at build time. Only image types (png, jpg, jpeg,
   webp) are accepted, the name is sanitised, an existing file is never
   overwritten.

The guard also gained one generic rule HQ does not have: a collection's
`required` fields must be present and non-empty in every item, or the write
is refused (a half-filled brand would otherwise ship).

## 3. Recommendation on Sanity

**Keep local files only, for now.** Reasons:

- The sites are static (GitHub Pages; Cloudflare Pages next). Content in the
  repo means every change is a commit: reviewable, revertable, and deployed
  by the same push as code. Nothing to keep in sync, no tokens in CI.
- One editor (Andrew), editing at a desk with the repo checked out. Sanity's
  strengths (many editors, editing from a phone, scheduled publishing, a
  hosted media library) are not needs yet.
- HQ itself only uses Sanity as an image host and Studio; its runtime data
  is already local JSON. Mirroring HQ's Sanity setup would add a project, a
  dataset, a write token and a second schema to keep in step, for no
  runtime gain.
- The package's shape does not block Sanity later: an `asset` field could
  upload to Sanity instead of the repo by swapping the upload target, and a
  collection could be pushed to a Sanity dataset by a script.

**Revisit when:** someone other than Andrew edits content, Andrew wants to
edit from his phone, or image volume makes the repo heavy (then: Sanity or
Cloudflare R2 as the image host, content still in JSON).

## 4. Phase 1 (built)

- `packages/local-cms`: the integration (`localCms(config)`), the middleware
  factory, the store guard and its tests, the upload endpoint, the editor
  shell. `pnpm test` runs the package's tests.
- `sites/hey-this-is-andrew/local-cms.config.mjs`: two collections.
  - **Now** (`src/data/now.json`): the five items. `src/data/now.ts` keeps
    its exports (`NOW_MONTH` is computed at build time, `NOW_ITEMS` reads the
    JSON), so no component changed.
  - **Brands** (`src/data/brands.json`): every panel field; images are paths
    under `src/assets` resolved by `import.meta.glob` in `src/data/brands.ts`,
    which keeps exporting `childBrands` in the same shape. The Sip the Magic
    teaser art stays in code (picked by a `teaserArt` name): raw SVG markup is
    not something to edit in a form, and it is rendered as HTML.
- Dev only: `pnpm dev`, open `/local-cms`, edit, Save (writes the JSON in
  the repo), commit, push, Pages deploys. A build contains no `/local-cms`
  page and no `/api/local-cms` code (checked in the built output).

## 5. Phase 2 (proposed, not built)

- **Goals, Gear, Projects** are Astro content collections today (Markdown /
  YAML under `src/content`). Two options: (a) move each to a JSON store the
  CMS edits, keeping the collection's schema as the field config; or (b)
  teach the package a Markdown-collection adapter (front matter as fields,
  body as a textarea). (b) keeps the files hand-editable and is the cleaner
  long-term shape; (a) is faster.
- The template (`templates/site-starter`) gets a sample `local-cms.config.mjs`
  so every new site starts with it.
- Optional: HQ adopts the package later (its forms become a config plus a
  few custom field types). Not proposed until the package has run here for a
  while.

## Decisions for Andrew before phase 2

1. Sanity: agree to stay on local JSON only (section 3)?
2. Goals, Gear, Projects: JSON stores (a) or a Markdown adapter (b)?
3. Uploads: commit uploaded images into `src/assets/uploads/` (default), or
   host them elsewhere (Cloudflare R2 once the site moves)?
4. Add the CMS to the site starter template?
