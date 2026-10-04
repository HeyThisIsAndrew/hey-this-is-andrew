// The local CMS write guard. The refusals are BE Unconventional HQ's, each
// one reproduced there against a running dev server before the guard existed
// (a POST of `null` and of `[]` both "succeeded" and blanked a store).
import assert from 'node:assert/strict';
import { validateStorePayload, serializeStore, findMissingRequired } from '../src/store.mjs';

let failed = 0;
const test = (name, fn) => {
  try { fn(); console.log(`  ok  ${name}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
};
console.log('local-cms store guard:');

test('broken JSON is refused', () => {
  const r = validateStorePayload('{"a": ', 'x.json');
  assert.equal(r.ok, false); assert.equal(r.status, 400); assert.match(r.error, /left untouched/);
});
for (const [body, what] of [['null', 'null'], ['{}', 'an object'], ['"hi"', 'a string'], ['7', 'a number']]) {
  test(`${body} is refused (not an array)`, () => {
    const r = validateStorePayload(body, 'x.json');
    assert.equal(r.ok, false); assert.match(r.error, new RegExp(what));
  });
}
test('an EMPTY array is refused (the store-wiping case)', () => {
  const r = validateStorePayload('[]', 'now.json');
  assert.equal(r.ok, false); assert.match(r.error, /empty array/); assert.match(r.error, /now\.json/);
});
test('a non-empty array is accepted', () => {
  const r = validateStorePayload('[{"label":"Building","value":"x"}]', 'now.json');
  assert.equal(r.ok, true); assert.equal(r.parsed.length, 1);
});
test('removing items is allowed (deleting is a real edit)', () => {
  assert.equal(validateStorePayload('[{"a":1}]', 'x.json').ok, true);
});

const fields = [
  { key: 'label', type: 'text', required: true },
  { key: 'value', type: 'text', required: true },
  { key: 'note', type: 'text' },
  { key: 'inquiry', type: 'group', fields: [{ key: 'email', type: 'email', required: true }, { key: 'label', type: 'text' }] },
];
test('a missing required field is refused, naming the item', () => {
  const r = validateStorePayload('[{"label":"Shooting","value":""}]', 'now.json', { fields, itemLabel: 'label' });
  assert.equal(r.ok, false); assert.match(r.error, /"Shooting"/); assert.match(r.error, /value is required/);
});
test('an optional field may be empty or absent', () => {
  assert.equal(validateStorePayload('[{"label":"a","value":"b"}]', 'x.json', { fields }).ok, true);
});
test('a present group needs its required subfields; an absent one is fine', () => {
  assert.equal(findMissingRequired([{ label: 'a', value: 'b', inquiry: { label: 'x' } }], fields).length, 1);
  assert.equal(findMissingRequired([{ label: 'a', value: 'b' }], fields).length, 0);
});
test('a non-object item is refused', () => {
  assert.equal(validateStorePayload('["just a string"]', 'x.json', { fields }).ok, false);
});
test('the store is written pretty-printed with a trailing newline', () => {
  assert.equal(serializeStore([{ a: 1 }]), '[\n  {\n    "a": 1\n  }\n]\n');
});

if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log('local-cms store: ok');
