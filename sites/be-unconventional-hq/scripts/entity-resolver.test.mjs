/**
 * resolveEntity() — the one lookup that turns a feed item into its hub.
 *
 * These assertions are written against the REAL store, not fixtures, because
 * the bug this replaced was a data-shape bug rather than a logic bug: both
 * components searched `featuredBrand` documents only, and every convention in
 * `videos.json` is an `event`. A fixture would have hidden that by construction.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveEntity } from '../src/lib/entity-resolver.ts';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const docs = JSON.parse(fs.readFileSync(path.join(repoRoot, 'src/data/videos.json'), 'utf8'));
const rawArticles = JSON.parse(fs.readFileSync(path.join(repoRoot, 'src/data/articles.json'), 'utf8'));
const articles = Array.isArray(rawArticles)
  ? rawArticles
  : rawArticles.articles || rawArticles.items || [];

const brands = docs.filter((d) => d._type === 'featuredBrand');
const events = docs.filter((d) => d._type === 'event');
const deps = { brands, events };

const videoTitled = (fragment) =>
  docs.find((d) => d._type === 'video' && (d.title || '').toLowerCase().includes(fragment));

test('a convention resolves to its EVENT, not to nothing', () => {
  const lacc = articles.find((a) => /comic con/i.test(a.title || ''));
  assert.ok(lacc, 'the L.A. Comic Con article should exist in the store');

  const hit = resolveEntity({ ...lacc, contentType: 'article' }, deps);
  assert.ok(hit, 'L.A. Comic Con resolved to nothing — events are being ignored again');
  assert.equal(hit.type, 'event');
  assert.equal(hit.slug, 'la-comic-con-2026');
  assert.equal(hit.url, '/events/la-comic-con-2026');
});

test('an event URL points at /events, a brand URL at /featured', () => {
  const re = videoTitled('resident evil');
  assert.ok(re, 'a Resident Evil video should exist');
  const hit = resolveEntity({ ...re, contentType: 'video' }, deps);
  assert.equal(hit.type, 'brand');
  assert.equal(hit.slug, 'sony-pictures');
  assert.equal(hit.url, '/featured/sony-pictures');
});

/*
  The regression this guards is subtle and was caught by measurement, not by
  reading: a Lanterns review carries hubs ["hbo-max", "dc-comics",
  "warner-bros"], so resolving by array order alone would have repainted every
  Lanterns hero with the HBO Max mark. The item's own display tag says DC.
*/
test('among several hubs, the item’s own headline tag decides', () => {
  const lanterns = videoTitled('lanterns episode');
  assert.ok(lanterns, 'a Lanterns video should exist');
  assert.ok(
    (lanterns.hubs || []).length > 1,
    'this test is meaningless unless the item really has competing hubs',
  );

  const hit = resolveEntity({ ...lanterns, contentType: 'video' }, deps);
  assert.equal(hit.slug, 'dc-comics', 'Lanterns should resolve to DC, not to the first hub listed');
});

test('an explicit relatedBrandSlug outranks everything else', () => {
  const lanterns = videoTitled('lanterns episode');
  const hit = resolveEntity(
    { ...lanterns, contentType: 'video', relatedBrandSlug: 'netflix' },
    deps,
  );
  assert.equal(hit.slug, 'netflix');
});

test('an item that matches nothing resolves to null rather than a wrong hub', () => {
  const hit = resolveEntity(
    { title: 'Untagged thing', contentType: 'video', hubs: [], tags: [], youtubeTags: [] },
    deps,
  );
  assert.equal(hit, null);
});

test('every resolved hub carries a usable destination and title', () => {
  const sample = docs.filter((d) => d._type === 'video').slice(0, 25);
  for (const doc of sample) {
    const hit = resolveEntity({ ...doc, contentType: 'video' }, deps);
    if (!hit) continue;
    assert.match(hit.url, /^\/(featured|events)\/[a-z0-9-]+$/, `bad url for ${doc.title}`);
    assert.ok(hit.title, `resolved hub for ${doc.title} has no title`);
    assert.match(hit.color, /^#/, `resolved hub for ${doc.title} has no colour`);
  }
});

/*
  urlFor is injected. If it ever throws on a malformed asset ref, a card must
  still render — the mark is decoration, the card is the content.
*/
test('a broken asset reference degrades instead of taking the card down', () => {
  const re = videoTitled('resident evil');
  const hit = resolveEntity({ ...re, contentType: 'video' }, {
    ...deps,
    urlFor: () => {
      throw new Error('bad ref');
    },
  });
  assert.ok(hit, 'resolution should survive a throwing urlFor');
  assert.equal(hit.logo, null);
});
