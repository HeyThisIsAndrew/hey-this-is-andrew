/*
  ─── THE ONE RULE FOR A LOCAL CMS WRITE: NEVER BLANK THE STORE ──────────────

  `/api/local-cms/videos` and `/api/local-cms/articles` both POST a whole file
  and overwrite it. Their only guard was `JSON.parse(body)` inside a try/catch,
  which checks SYNTAX and nothing else - so every one of these was accepted and
  written verbatim:

      null      -> src/data/articles.json becomes the four bytes `null`
      []        -> src/data/videos.json loses all 211 documents
      {}        -> the store becomes an object the loaders cannot read
      "hi", 7   -> likewise

  All four were reproduced against a running dev server, not reasoned about.
  `[]` is the one that matters: it is valid JSON, it is the right TYPE, and it
  is exactly what a React editor holds when a fetch failed and its state
  initialised to an empty list. One POST and the store is gone.

  And gone is not recoverable by re-running the syncs. videos.json carries
  three classes of field (CLAUDE.md hard rule 5) and the EDITORIAL ones -
  featured, notes, hubCategory, brandColor, youtubeSyncKeywords - are seeded
  once and never overwritten by a sync, by design. A wipe takes them for good.

  So the contract this enforces is the same one the article sync already
  states: loud, non-fatal failure, and the store on disk is never the thing
  that pays for a bad request.

  Deliberately NOT enforced: how much a write may remove. Deleting an article
  is a thing an editor legitimately does, and a rule that guesses at intent
  would block real edits to catch a case the empty check already covers.
*/

/** @param {unknown} value */
function describe(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  if (typeof value === 'object') return 'an object';
  return `a ${typeof value}`;
}

/**
 * Decides whether a POSTed body may overwrite a local content store.
 *
 * @param {string} raw           the request body, verbatim
 * @param {string} storeName     the file being written, for the error message
 * @returns {{ ok: true, parsed: unknown[] } | { ok: false, status: number, error: string }}
 */
export function validateStorePayload(raw, storeName) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, status: 400, error: `Invalid JSON, ${storeName} left untouched.` };
  }

  if (!Array.isArray(parsed)) {
    return {
      ok: false,
      status: 400,
      error: `Expected an array of documents, got ${describe(parsed)}. ${storeName} left untouched.`,
    };
  }

  if (parsed.length === 0) {
    return {
      ok: false,
      status: 400,
      error:
        `Refusing to write an empty array: that would blank ${storeName}, and the ` +
        'editorial fields in it are seeded once and never restored by a sync. ' +
        'Left untouched.',
    };
  }

  return { ok: true, parsed };
}

/*
  ─── A STORE ON DISK IS PRETTY-PRINTED, WHATEVER THE CLIENT SENT ────────────

  The middleware used to write the POST body VERBATIM. LocalCmsApp serialises
  its state with a plain `JSON.stringify(docs)`, so one "Save to videos.json"
  collapsed all 9,781 lines of the store onto a single line. Nothing broke at
  runtime — the loaders parse either form — and that is exactly why it went
  unnoticed until it reached a commit reading "9,782 deletions, 49 insertions".

  Two things depend on the file staying line-per-field, and both fail silently
  when it does not:

  1. THE MERGE DRIVER. `scripts/setup-git.mjs` registers a sync-json driver so
     videos.json merges per DOCUMENT instead of conflicting wholesale
     (CLAUDE.md, Data flow). Line-based git tooling cannot do anything useful
     with a one-line file, so every concurrent edit becomes a whole-file
     conflict that a human then has to resolve by hand — against 500 KB on one
     line.
  2. REVIEW. A store change is editorial content, and "1 file changed, 1
     insertion, 1 deletion" tells a reviewer nothing about what an editor
     actually changed.

  Serialising here rather than trusting the client also means the format is
  enforced at the only point every write passes through, so a future client —
  or a curl by hand — cannot reintroduce it.

  Two spaces and a trailing newline is what the file has always been, and what
  every sync script writes.
*/

/**
 * Serialise validated store documents in the repository's canonical format.
 *
 * @param {unknown[]} docs  the parsed documents from validateStorePayload
 * @returns {string}        pretty-printed JSON, newline-terminated
 */
export function serializeStore(docs) {
  return `${JSON.stringify(docs, null, 2)}\n`;
}
