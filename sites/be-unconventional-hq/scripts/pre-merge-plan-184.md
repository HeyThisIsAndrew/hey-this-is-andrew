# Pre-merge plan for PR #184

Two lanes: what antigravity runs, and the short list only you can decide.
Everything here is what the automated gates do **not** cover.

## Why this exists

The four gates are green, and they were green while the Local CMS could blank
`src/data/articles.json` with a four-byte POST. Green CI meant "nothing I test
is broken", not "nothing is broken". This plan covers the gap.

Standing rule, same as `scripts/antigravity-test-plan.md`: **never write a
result you did not watch a command print.**

---

## Lane A: antigravity

Needs a dev server, a browser and clicking. Report each item PASS/FAIL with the
evidence, and say plainly which ones you skipped.

### A1. Local CMS articles editor, through the UI (highest priority)

This is #157, the PR's headline feature, and until now nothing had exercised it
end to end. The endpoint is covered by `scripts/local-cms-store.test.mjs`; the
**React form is not**.

Back the store up first: `cp src/data/articles.json /tmp/articles.backup.json`.

```bash
npm run dev     # then open http://localhost:4321/local-cms
```

1. Open an article. All seven editorial fields render with current values:
   Title, Excerpt, Image, Category, Featured, Hidden, SortWeight.
2. Change **each field one at a time**, save, and reload the page. The value
   persists. Do not batch: a field that silently fails to bind is invisible in a
   batch save.
3. Set `Hidden` on one article. Check it disappears from `/intel` and `/feed`
   and does **not** 404 anywhere it is still linked.
4. Set `Featured`. Check it surfaces where featured articles surface.
5. Set `SortWeight` on two articles and confirm the order changes as intended.
6. Confirm `git diff src/data/articles.json` shows **only** the fields you
   edited. Any other key changing is a bug: the form is round-tripping and
   dropping or reshaping data.
7. Restore: `cp /tmp/articles.backup.json src/data/articles.json`.

### A2. The write guard, from the browser rather than curl

I verified the endpoint with curl. What is untested is the **editor's own
failure path**: what the React app posts when its fetch failed.

1. With the CMS open, stop the dev server, then click Save.
2. Restart it, hard-reload the CMS with the network tab throttled to offline,
   then click Save.
3. In both cases: `src/data/articles.json` must be unchanged, and the UI must
   say something a person can act on. A silent failure is a bug even though the
   file survived.

### A3. The Studio at /admin

`sanity` and `@sanity/astro` moved to devDependencies. Nobody has opened the
Studio since.

1. `npm run dev`, open `/admin`. The Studio loads and authenticates.
2. Open an `event` and a `featuredBrand`. Images resolve.
3. Confirm no `[studio]` warning in the dev server output.

### A4. The search palette with a REAL upcoming event

Both events in the data (D23, San Diego Comic Con) are in the past, so the
event path in the default view has never actually rendered. It is verified by
simulation and by guard test only.

Add a temporary `event` document to `src/data/videos.json` with an `endDate` a
few weeks out, then:

1. Open the palette. The event appears **at the top**.
2. Count the rows: **ten**. Count the hubs: **four**, from four different
   categories. This is the regression that shipped: two hubs used to fall off.
3. Add a second future event further out. The **nearer** one must sort above it.
4. Remove the temporary documents and confirm `git status` is clean.

### A5. Video structured data, against Google rather than a regex

My check proves the JSON-LD parses and carries a description. It does not prove
Google accepts it.

1. Run `npm run build`, then `npm run preview`.
2. Paste the rendered HTML of `/` into the
   [Rich Results Test](https://search.google.com/test/rich-results).
3. Report **every** warning, not just errors. `VideoObject` warnings about
   missing recommended fields are worth knowing even if they do not block.

---

## Lane B: you

Judgement calls and things needing your accounts.

- **B1. The HQ logo (#179).** The Q is rotated 45 degrees. No test can tell you
  whether it looks right. Check it at mobile portrait, mobile landscape and
  desktop, against the previous version.
- **B2. Back up `src/data/` before anyone uses the CMS in anger.** The guard
  stops a blank write; it does not stop a bad *edit*. These files are the
  content store and the editorial fields in them are not reproducible by a
  sync. A commit before an editing session is enough.
- **B3. Decide the merge shape.** `feat/local-cms-articles` now carries the
  audit branch and its own history. If you want a clean single PR, that is a
  squash; if you want the remediation legible, it is a merge. Your call, and it
  changes what #184 looks like in the log.
- **B4. `max-image-preview:large`.** It is in the HTML. Whether it does anything
  is a Search Console observation over weeks, not a test. Worth a note to check
  in a month.

---

## What is already covered, and does not need retesting

Do not spend time re-running these; they are gated and green.

| Area | Covered by |
| --- | --- |
| Type safety | `npx astro check`, 0/0/0 |
| CMS write guard, all payload shapes | `scripts/local-cms-store.test.mjs`, 11 assertions |
| Palette default view shape, event order, clear button | `scripts/command-palette.test.mjs`, 26 assertions |
| `npm test` staying offline and non-short-circuiting | `scripts/e2e-harness.test.mjs`, 2 guards |
| Search relevance | `scripts/e2e-search-relevance.test.mjs`, 23 assertions |
| Studio absent from production build | `find dist -path '*admin*'`, and the devDependency fallback |
| Browser behaviour across 23 suites | `npm run test:e2e` |
| Performance and a11y budgets | `lighthouse-production-equivalent` in CI |
