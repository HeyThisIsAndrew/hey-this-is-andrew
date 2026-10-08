#!/usr/bin/env node
/*
  GIT MERGE DRIVER FOR THE SYNCED DATA FILES.

  src/data/{videos,articles,instagram,article-images}.json are produced by
  sync scripts that run in TWO places: the scheduled workflows that commit to
  main, and the operator running `npm run sync-articles` locally. Both sides
  therefore rewrite the same file from the same upstream source, and git sees
  a whole-file conflict on every merge even though the two versions almost
  always agree about everything a human cares about.

  This driver resolves that automatically WHEN IT IS SAFE, and refuses to
  when it is not.

  THE RULE IT ENFORCES IS CLAUDE.md HARD RULE 5. Documents have three field
  classes: FACTUAL (re-synced every run), DERIVED (recomputed), and EDITORIAL
  (seeded once, never overwritten). A conflict in FACTUAL data is noise — the
  newer sync wins and nothing is lost. A conflict in EDITORIAL data means two
  humans, or a human and a bad sync, disagree about something deliberate, and
  no automatic rule should pick a winner.

  So:
    - union both sides by document id; a doc on one side only is kept
    - a doc on both sides with identical editorial fields takes the newer
      side's facts
    - ANY editorial disagreement aborts the merge with a report, leaving the
      normal conflict markers for a human

  Invoked by git through .gitattributes. See scripts/data-merge-driver.md.

  Usage (git supplies these): merge-sync-json.mjs %O %A %B %P
    %O ancestor   %A ours (written back to)   %B theirs   %P real pathname
*/
import { readFileSync, writeFileSync } from 'node:fs';

const [, , _ancestor, oursPath, theirsPath, realPath = ''] = process.argv;

/**
  Editorial fields per CLAUDE.md hard rule 5. Never auto-resolved.

  Every name here is a field on a VIDEO document, because videos were the only
  thing in this store when the driver was written.
*/
const EDITORIAL = [
  'featured', 'notes', 'status', 'manualTaxonomyOverride',
  'hubs', 'topics', 'requiresReview', 'hidden', 'order',
];

/*
  ─── DOC TYPES THAT ARE EDITORIAL ALL THE WAY DOWN ─────────────────────────

  `event` and `featuredBrand` have NO synced facts. A video doc is mostly
  YouTube's: title, description, thumbnails and counts all come back from the
  API every run, and only the short list above belongs to a human. These two
  are the opposite — they came from the Sanity export and are edited in the
  local CMS, so every field on them is somebody's typing.

  The list above never grew to cover them, and the omission was not theoretical.
  Merging main into feat/events-overhaul-clean reverted, silently:

    sdcc-2026   eventType   "convention-expo" -> "convention"  (a RETIRED value)
    sdcc-2026   description  the rewritten copy -> the old one
    d23-2026    eventType   "convention-expo" -> "convention"
    d23-2026    description  the rewritten copy -> the old one
    d23-2026    tagline     "The Ultimate Disney Fan Event" -> dropped entirely

  main simply predates the taxonomy work, so its `_updatedAt` had nothing to
  do with whether its copy of these fields was better. The driver reported
  "No editorial field touched" and was, by its own list, telling the truth.
  `scripts/events.test.mjs` caught the retired value; nothing would have
  caught the descriptions.

  Enumerating thirty field names would fix today and rot tomorrow: the next
  field added to the CMS would arrive unprotected, exactly as these did. So
  the rule is by TYPE, and it holds for fields nobody has invented yet.
  `_`-prefixed keys are Sanity's own system metadata (`_id`, `_rev`,
  `_updatedAt`), which is bookkeeping rather than editorial.
*/
const FULLY_EDITORIAL_TYPES = new Set(['event', 'featuredBrand']);

/*
  The UNION of both sides' fields, not just one side's. A field present on one
  copy and absent from the other is exactly the d23 `tagline` case above, and
  reading the keys of a single side would have skipped it.
*/
const editorialFieldsFor = (o, t) => {
  const fully = FULLY_EDITORIAL_TYPES.has(o?._type) || FULLY_EDITORIAL_TYPES.has(t?._type);
  if (!fully) return EDITORIAL;
  const fields = new Set();
  for (const doc of [o, t]) {
    for (const k of Object.keys(doc ?? {})) if (!k.startsWith('_')) fields.add(k);
  }
  return [...fields];
};

/*
  Every id field these four files actually use. Verified against the real data
  rather than assumed — `instagram.json` keys on a bare `id` and had NO match
  against the first draft of this list, which would have made the driver abort
  on every Instagram merge instead of resolving it.
*/
const idOf = (d) =>
  d?._id ?? d?.videoId ?? d?.id ?? d?.slug?.current ?? d?.slug ?? d?.guid ?? d?.url ?? null;

/**
  A document's own freshness stamp.

  Compared PER DOCUMENT, not per side. Picking the fresher side wholesale
  looks right and is not: a run can be newer overall while holding a stale
  copy of one item the other side re-fetched. Tested — with side-level
  comparison a document whose newer facts lived on the older side silently
  kept its stale values.
*/
const stampOf = (d) =>
  d?._updatedAt || d?.publishedAt || d?.isoDate || d?.timestamp || d?.fetchedAt || '';

/*
  TWO SHAPES, BOTH REAL.

  videos/articles/instagram are ARRAYS of documents. article-images.json is an
  OBJECT keyed by source image URL. The first draft of this driver handled
  only arrays and silently declined on article-images, which is the file most
  likely to conflict — every article sync rewrites it.

  Both normalise to entries of [key, value], so one merge path serves both,
  and the shape is remembered so the file is written back the way it came.
*/
function read(path) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null; // unparseable: fall through to a real conflict
  }
  if (Array.isArray(parsed)) {
    return { shape: 'array', entries: parsed.map((d) => [idOf(d), d]) };
  }
  if (parsed && typeof parsed === 'object') {
    return { shape: 'object', entries: Object.entries(parsed) };
  }
  return null;
}

function fail(reason, detail = []) {
  console.error(`\n[merge-sync-json] NOT auto-resolving ${realPath || 'this file'}.`);
  console.error(`  ${reason}`);
  for (const line of detail.slice(0, 12)) console.error(`    ${line}`);
  if (detail.length > 12) console.error(`    ...and ${detail.length - 12} more`);
  console.error('  Resolve it by hand. scripts/data-merge-driver.md explains how.\n');
  process.exit(1); // git keeps the conflict
}

const ours = read(oursPath);
const theirs = read(theirsPath);

if (!ours || !theirs) {
  fail('one side is not valid JSON, so document-level merging cannot apply.');
}
if (ours.shape !== theirs.shape) {
  fail(`the two sides are different shapes (${ours.shape} vs ${theirs.shape}).`);
}

const O = new Map(ours.entries);
const T = new Map(theirs.entries);

if (O.has(null) || T.has(null)) {
  fail('a document has no id field, so the two sides cannot be aligned.');
}

// Editorial disagreement is the one thing that must never resolve silently.
const clashes = [];
for (const [id, o] of O) {
  const t = T.get(id);
  if (!t) continue;
  for (const f of editorialFieldsFor(o, t)) {
    if (JSON.stringify(o[f]) !== JSON.stringify(t[f])) {
      clashes.push(`${id}  ${f}:  ours=${JSON.stringify(o[f])}  theirs=${JSON.stringify(t[f])}`);
    }
  }
}
if (clashes.length) {
  fail(
    `${clashes.length} EDITORIAL field(s) disagree. These are values a human set, ` +
      'and hard rule 5 says a sync never overwrites them.',
    clashes,
  );
}

/*
  Safe to resolve. Keep every document from both sides, and for a document on
  both, take whichever copy stamps itself newer. Ties go to theirs, which is
  the incoming branch — the same way a normal `theirs` resolution would fall.

  Ordering follows theirs, then appends anything only ours has, so the file
  stays close to what the last sync would have written and the diff stays
  readable.
*/
const merged = [];
const mergedPairs = [];
const seen = new Set();
let fromOurs = 0;

for (const [id, t] of T) {
  const o = O.get(id);
  const pick = o !== undefined && stampOf(o) > stampOf(t) ? o : t;
  if (pick === o) fromOurs += 1;
  merged.push(pick);
  mergedPairs.push([id, pick]);
  seen.add(id);
}
let onlyOurs = 0;
for (const [id, o] of O) {
  if (seen.has(id)) continue;
  merged.push(o);
  mergedPairs.push([id, o]);
  onlyOurs += 1;
}
const onlyTheirs = [...T.keys()].filter((id) => !O.has(id)).length;

const out = ours.shape === 'array' ? merged : Object.fromEntries(mergedPairs);
writeFileSync(oursPath, `${JSON.stringify(out, null, 2)}\n`);
console.error(
  `[merge-sync-json] ${realPath || 'file'}: auto-resolved to ${merged.length} entries. ` +
    `${onlyOurs} only local, ${onlyTheirs} only incoming, ` +
    `${fromOurs} shared doc(s) kept local facts as the newer copy. ` +
    'No editorial field touched.',
);
process.exit(0);
