/*
  THE ONE RULE FOR A LOCAL CMS WRITE: NEVER BLANK THE STORE.

  Ported from BE Unconventional HQ (src/lib/local-cms-store.mjs), where every
  case below was reproduced against a running dev server before the guard
  existed: a POST of `null` turned a store into the four bytes `null`, and a
  POST of `[]` (valid JSON, the right type, and exactly what an editor holds
  when its fetch failed) wiped 211 documents. So a write is refused unless it
  is a non-empty array, and the store on disk is never what pays for a bad
  request: the error is loud, the file is left untouched.

  Deliberately NOT enforced: how much a write may remove. Deleting an item is
  a real edit.

  Added here (generic, not HQ's): the collection's `required` fields must be
  present and non-empty in every item, so a half-filled item never ships.
*/

/** @param {unknown} value */
function describe(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  if (typeof value === 'object') return 'an object';
  return `a ${typeof value}`;
}

const isEmpty = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/**
 * Required-field problems in a list of items, as readable strings.
 * @param {unknown[]} docs
 * @param {import('./config.mjs').Field[]} fields
 * @param {(item: any) => string} [labelOf]
 */
export function findMissingRequired(docs, fields = [], labelOf = () => '') {
  const problems = [];
  docs.forEach((doc, i) => {
    const name = `item ${i + 1}${labelOf(doc) ? ` ("${labelOf(doc)}")` : ''}`;
    if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
      problems.push(`${name} is ${describe(doc)}, not an object`);
      return;
    }
    for (const f of fields) {
      const v = /** @type {any} */ (doc)[f.key];
      if (f.type === 'group') {
        if (v !== undefined && v !== null) {
          for (const sub of f.fields ?? []) {
            if (sub.required && isEmpty(v[sub.key])) problems.push(`${name}: ${f.label ?? f.key} needs ${sub.label ?? sub.key}`);
          }
        } else if (f.required) problems.push(`${name}: ${f.label ?? f.key} is required`);
        continue;
      }
      if (f.required && isEmpty(v)) problems.push(`${name}: ${f.label ?? f.key} is required`);
    }
  });
  return problems;
}

/**
 * Decides whether a POSTed body may overwrite a store.
 * @param {string} raw            the request body, verbatim
 * @param {string} storeName      the file being written, for messages
 * @param {{ fields?: import('./config.mjs').Field[], itemLabel?: string }} [collection]
 * @returns {{ ok: true, parsed: unknown[] } | { ok: false, status: number, error: string }}
 */
export function validateStorePayload(raw, storeName, collection = {}) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, status: 400, error: `Invalid JSON, ${storeName} left untouched.` };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, status: 400, error: `Expected an array of items, got ${describe(parsed)}. ${storeName} left untouched.` };
  }
  if (parsed.length === 0) {
    return {
      ok: false,
      status: 400,
      error: `Refusing to write an empty array: that would blank ${storeName}. Left untouched.`,
    };
  }
  const labelKey = collection.itemLabel;
  const problems = findMissingRequired(parsed, collection.fields ?? [], (d) => (labelKey && d && typeof d === 'object' ? String(d[labelKey] ?? '') : ''));
  if (problems.length) {
    return { ok: false, status: 400, error: `${problems.join('; ')}. ${storeName} left untouched.` };
  }
  return { ok: true, parsed };
}

/*
  A STORE ON DISK IS PRETTY-PRINTED, WHATEVER THE CLIENT SENT (HQ: one save
  that wrote the client's minified body flattened 9,781 lines onto one, which
  broke review and line-based merging). Two spaces and a trailing newline.
*/
/** @param {unknown[]} docs */
export function serializeStore(docs) {
  return `${JSON.stringify(docs, null, 2)}\n`;
}
