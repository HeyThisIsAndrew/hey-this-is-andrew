# @andrew/local-cms

A dev-only CMS for the sites in this repo. A site lists its collections (a
JSON file each, and its fields) in a config; while `astro dev` runs, `/local-cms`
renders a form per item from that config and saves the JSON file in the repo.
A build never contains any of it. Publishing is: edit, Save, commit, push.

Adapted from BE Unconventional HQ's local CMS (its write guard and tests are
ported as they were); the audit and the plan are in `docs/local-cms-plan.md`.

## Use it in a site

```js
// astro.config.mjs
import { localCms } from '@andrew/local-cms';
import localCmsConfig from './local-cms.config.mjs';
export default defineConfig({ integrations: [localCms(localCmsConfig)] });
```

```js
// local-cms.config.mjs
export default {
  title: 'My site · Local CMS',
  assetsDir: 'src/assets',          // where `asset` fields pick images from
  uploadDir: 'src/assets/uploads',  // where uploads are saved (committed)
  collections: [
    {
      name: 'now',                  // lowercase, the API name
      label: 'Now',
      file: 'src/data/now.json',    // an array of items
      itemLabel: 'label',           // the field that titles each item
      fields: [
        { key: 'label', type: 'text', required: true },
        { key: 'value', type: 'text', required: true },
      ],
    },
  ],
};
```

Field types:

| type | value | notes |
| --- | --- | --- |
| `text`, `textarea`, `url`, `email` | string | |
| `markdown` | string | a monospace editor; the site decides how (and whether) to render it |
| `number` | number | |
| `date` | `YYYY-MM-DD` string | never a `Date` (time zones shift it a day) |
| `boolean` | true / false | |
| `select` | one of `options: [{ value, label }]` | |
| `list` | array of strings | one per line in the form |
| `asset` | an image | a path under `assetsDir`, or a Sanity asset id when `imageHost` is Sanity |
| `group` | object of `fields` | |
| `array` | array of objects of `fields` | rows can be added, removed and reordered |

`required` fields must be filled in every item (and every array row) before a
save is accepted. `idField: 'id'` on a collection makes that field a unique
lowercase slug, which is what Astro's `file()` loader needs as the entry id.

### Images: in the repo or on Sanity

`imageHost: { type: 'repo' }` (the default) saves uploads into `uploadDir`,
committed, optimised by Astro at build. `imageHost: { type: 'sanity',
projectId, dataset }` is BE Unconventional HQ's system: uploads go to
Sanity's asset store (free tier) with the write token from
`SANITY_WRITE_TOKEN` (or `tokenEnv`), only the asset id
(`image-<hash>-WxH-ext`) is stored in the JSON, and pages load it from
Sanity's CDN. The token is read from the environment at upload time and is
never in the config, the JSON or the build. Both kinds of value can sit in
one store, so switching hosts needs no migration.

A site resolves any image value with `resolveImage()`:

```ts
import { resolveImage } from '@andrew/local-cms/images';
const IMAGES = import.meta.glob('../assets/**/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' });
resolveImage(value, { images: IMAGES, prefix: '../assets/', sanity, where: 'brands.json be.logo' });
// -> ImageMetadata (a repo file) or { src, width, height, remote: true } (Sanity)
```

Add `image: { domains: ['cdn.sanity.io'] }` to the Astro config so `<Image>`
can optimise the Sanity ones. A missing file or a Sanity id without a
project fails the build, naming the field.

The site then imports the JSON from its own code (e.g. `src/data/now.ts`
imports `now.json` and keeps exporting what components already used).

## The rules it enforces

- Dev only: the route and the API are added in `astro dev` and nowhere else.
- A write is refused (and the file left untouched) when it is not JSON, not
  an array, an EMPTY array (the store-wiping case HQ hit), or missing a
  required field.
- Files are always written pretty-printed (2 spaces, trailing newline) and
  atomically (temp file, then rename).
- Only the files named in the config can be written; no path leaves the
  site. Uploads take png, jpg, jpeg and webp only, under a sanitised name,
  and never overwrite a file.

`pnpm test` here runs the guard, config, API and image tests.
