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

  Added here (generic, not HQ's): every item is checked against the
  collection's fields (required, types, unique slug ids), so a half-filled
  or mistyped item never ships.
*/

/** @param {unknown} value */
function describe(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  if (typeof value === 'object') return 'an object';
  return `a ${typeof value}`;
}

const isEmpty = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9][a-z0-9-]*$/;

/** Problems with one value against its field (type, then required). */
function checkValue(f, v, where, problems) {
  const name = f.label ?? f.key;
  if (isEmpty(v)) {
    if (f.required) problems.push(`${where}: ${name} is required`);
    return;
  }
  switch (f.type) {
    case 'number':
      if (typeof v !== 'number' || !Number.isFinite(v)) problems.push(`${where}: ${name} must be a number`);
      break;
    case 'date':
      if (typeof v !== 'string' || !DATE.test(v)) problems.push(`${where}: ${name} must be a date (YYYY-MM-DD)`);
      break;
    case 'boolean':
      if (typeof v !== 'boolean') problems.push(`${where}: ${name} must be true or false`);
      break;
    case 'list':
      if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) problems.push(`${where}: ${name} must be a list of text`);
      break;
    case 'group':
      if (typeof v !== 'object' || Array.isArray(v)) problems.push(`${where}: ${name} must be an object`);
      else for (const sub of f.fields ?? []) checkValue(sub, v[sub.key], `${where} > ${name}`, problems);
      break;
    case 'array':
      if (!Array.isArray(v)) problems.push(`${where}: ${name} must be a list`);
      else v.forEach((row, j) => {
        if (row === null || typeof row !== 'object' || Array.isArray(row)) problems.push(`${where} > ${name} ${j + 1} is not an object`);
        else for (const sub of f.fields ?? []) checkValue(sub, row[sub.key], `${where} > ${name} ${j + 1}`, problems);
      });
      break;
    case 'select':
      if (!(f.options ?? []).some((o) => o.value === v)) problems.push(`${where}: ${name} "${v}" is not one of its options`);
      break;
    default:
      if (typeof v !== 'string') problems.push(`${where}: ${name} must be text`);
  }
}

/**
 * Every problem in a list of items, as readable strings: required fields,
 * types, and (with `idField`) ids that are missing, not a slug, or repeated.
 * @param {unknown[]} docs
 * @param {import('./config.mjs').Field[]} fields
 * @param {(item: any) => string} [labelOf]
 * @param {string} [idField]
 */
export function findMissingRequired(docs, fields = [], labelOf = () => '', idField) {
  const problems = [];
  const ids = new Set();
  docs.forEach((doc, i) => {
    const name = `item ${i + 1}${labelOf(doc) ? ` ("${labelOf(doc)}")` : ''}`;
    if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
      problems.push(`${name} is ${describe(doc)}, not an object`);
      return;
    }
    for (const f of fields) checkValue(f, /** @type {any} */ (doc)[f.key], name, problems);
    if (idField) {
      const id = /** @type {any} */ (doc)[idField];
      if (typeof id === 'string' && id && !SLUG.test(id)) problems.push(`${name}: ${idField} "${id}" must be lowercase letters, digits and dashes`);
      if (typeof id === 'string' && ids.has(id)) problems.push(`${name}: ${idField} "${id}" is used twice`);
      ids.add(id);
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
  const problems = findMissingRequired(parsed, collection.fields ?? [], (d) => (labelKey && d && typeof d === 'object' ? String(d[labelKey] ?? '') : ''), collection.idField);
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
