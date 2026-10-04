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

Field types: `text`, `textarea`, `url`, `email`, `boolean`, `select`
(`options: [{ value, label }]`), `asset` (a path under `assetsDir`, picked or
uploaded) and `group` (an object of `fields`). `required` fields must be
filled in every item before a save is accepted.

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

`pnpm test` here runs the guard, config and API tests.
