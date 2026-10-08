/**
 * Apply the reviewed Phase 1 editorial metadata to the local stores.
 *
 * DRY RUN BY DEFAULT. Pass --execute to write, matching the convention
 * scripts/sync-youtube.mjs sets (CLAUDE.md hard rule 5): a script that edits
 * committed content must make writing the deliberate choice.
 *
 *   node scripts/apply-editorial-data.mjs              # show the diff
 *   node scripts/apply-editorial-data.mjs --execute    # write it
 *
 * Reads scripts/phase1-editorial-data.json, which is a PROPOSAL until the owner
 * has been through scripts/phase1-editorial-data.md and corrected it. Editing
 * the JSON and re-running is the correction loop.
 *
 * ─── WHAT THIS TOUCHES ──────────────────────────────────────────────────────
 * EDITORIAL fields only, in the sense hard rule 5 means: `coverageType`,
 * `badge1`, `badge2`, `series`, `editorial.excerpt`, and `franchises` when
 * `applyFranchises` is on. Never a FACTUAL field (title, description, tags,
 * dates, view counts) and never a DERIVED one (topics, hubs, requiresReview),
 * because the sync owns those and a write here would be overwritten or, worse,
 * would look authoritative until the next run.
 *
 * `featured` is written ONLY where the approved file says `featured: true`. It
 * is never inferred, scored or derived from anything: no view count, no recency,
 * no coverage type. Curation is the owner's decision, and this script's whole
 * relationship to it is transcription.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COVERAGE_TYPES } from '../src/lib/tags.ts';

const here = dirname(fileURLToPath(import.meta.url));
const at = (...p) => join(here, '..', ...p);
const EXECUTE = process.argv.includes('--execute');

const proposal = JSON.parse(readFileSync(at('scripts', 'phase1-editorial-data.json'), 'utf8'));
const videoStore = JSON.parse(readFileSync(at('src', 'data', 'videos.json'), 'utf8'));
const articleStore = JSON.parse(readFileSync(at('src', 'data', 'articles.json'), 'utf8'));

if (!Array.isArray(videoStore)) {
  console.error('videos.json is not a flat array. Aborting rather than guessing at its shape.');
  process.exit(1);
}

const changes = [];
const problems = [];

/** Set `field` on `doc` when the proposal has a value and it differs. */
function stage(doc, field, value, label) {
  if (value === undefined || value === null || value === '') return;
  const current = field === 'editorial' ? doc.editorial?.excerpt : doc[field];
  const next = field === 'editorial' ? value.excerpt : value;
  /*
    An empty RESOLVED value is "this row says nothing about this field", not
    "clear it". The row's editorial is an object, so the guard above sees a
    truthy `{ excerpt: '' }` and lets it through; without this, five deliberately
    blank excerpts each reported a change from empty to empty. Clearing a value
    is `blankByDecision`, which is explicit.
  */
  if (next === undefined || next === null || next === '') return;
  if (current === next) return;
  changes.push({ id: doc._id, label, field: field === 'editorial' ? 'editorial.excerpt' : field, from: current || '(empty)', to: next });
  if (!EXECUTE) return;
  if (field === 'editorial') doc.editorial = { ...(doc.editorial || {}), excerpt: value.excerpt };
  else doc[field] = value;
}

for (const row of proposal.videos ?? []) {
  const doc = videoStore.find((d) => d._id === row._id);
  if (!doc) {
    problems.push(`no document with _id ${row._id} (${row.title})`);
    continue;
  }
  if (row.coverageType && !COVERAGE_TYPES.includes(row.coverageType)) {
    problems.push(`${row._id}: "${row.coverageType}" is not one of the ${COVERAGE_TYPES.length} coverage types`);
    continue;
  }
  const label = String(doc.title || row.title).slice(0, 44);
  stage(doc, 'coverageType', row.coverageType, label);
  stage(doc, 'badge1', row.badge1, label);
  stage(doc, 'badge2', row.badge2, label);
  stage(doc, 'series', row.series, label);
  stage(doc, 'editorial', row.editorial, label);

  /*
    An excerpt blanked ON PURPOSE. `stage()` skips empty values so a row that
    simply says nothing about a field leaves it alone, which is right for every
    field except this one: five videos have source descriptions one or two lines
    long, and the owner's decision was that no excerpt is better than an
    invented one. That decision has to be able to CLEAR a value, so it is
    handled here rather than by relaxing stage().
  */
  if (row.blankByDecision && doc.editorial?.excerpt) {
    changes.push({ id: doc._id, field: 'editorial.excerpt', label, from: doc.editorial.excerpt, to: '(deliberately empty)' });
    if (EXECUTE) {
      const { excerpt, ...rest } = doc.editorial;
      doc.editorial = Object.keys(rest).length > 0 ? rest : undefined;
    }
  }

  /* Curation. Transcribed, never inferred. */
  if (typeof row.featured === 'boolean' && Boolean(doc.featured) !== row.featured) {
    changes.push({ id: doc._id, field: 'featured', label, from: String(Boolean(doc.featured)), to: String(row.featured) });
    if (EXECUTE) doc.featured = row.featured;
  }
  if (proposal.applyFranchises && row.franchise) {
    const next = [row.franchise];
    if (JSON.stringify(doc.franchises ?? []) !== JSON.stringify(next)) {
      changes.push({ id: doc._id, label, field: 'franchises', from: JSON.stringify(doc.franchises ?? []), to: JSON.stringify(next) });
      if (EXECUTE) doc.franchises = next;
    }
  }
}

const articles = Array.isArray(articleStore) ? articleStore : null;
if (!articles) {
  problems.push('articles.json is not a flat array; article overrides skipped');
} else {
  for (const row of proposal.articles ?? []) {
    const doc = articles.find((a) => a.title === row.slug_or_title || a.slug === row.slug_or_title);
    if (!doc) {
      problems.push(`no article matching "${row.slug_or_title}"`);
      continue;
    }
    const label = String(doc.title).slice(0, 44);
    const next = row.editorial?.excerpt;
    if (next && doc.editorial?.excerpt !== next) {
      changes.push({ id: doc.slug || doc.guid, label, field: 'editorial.excerpt', from: doc.editorial?.excerpt || '(empty)', to: next });
      if (EXECUTE) doc.editorial = { ...(doc.editorial || {}), excerpt: next };
    }
  }
}

for (const change of changes) {
  console.log(`${change.label}\n  ${change.field}: ${String(change.from).slice(0, 60)}  ->  ${String(change.to).slice(0, 90)}`);
}

console.log(`\n${changes.length} field${changes.length === 1 ? '' : 's'} across ${new Set(changes.map((c) => c.id)).size} documents.`);

if (problems.length > 0) {
  console.log(`\n${problems.length} problem${problems.length === 1 ? '' : 's'}:`);
  for (const p of problems) console.log(`  ${p}`);
}

const unreviewed = (proposal.videos ?? []).filter((v) => v.needsYourWords);
if (unreviewed.length > 0) {
  console.log(`\n${unreviewed.length} excerpts are still flagged needsYourWords, meaning the source description`);
  console.log('was too thin to compress and the draft is inference. Blank them or rewrite them');
  console.log('before running with --execute:');
  for (const v of unreviewed) console.log(`  ${v.title}`);
}

const blanked = (proposal.videos ?? []).filter((v) => v.blankByDecision);
if (blanked.length > 0) {
  console.log(`\n${blanked.length} excerpts are intentionally blank. Their cards render title and`);
  console.log('metadata with no body text, which is the honest result for a source that says');
  console.log('too little to summarise:');
  for (const v of blanked) console.log(`  ${v.title}`);
}

const curated = (proposal.videos ?? []).filter((v) => v.featured === true);
console.log(`\n${curated.length} video${curated.length === 1 ? '' : 's'} marked featured, transcribed from the approved file:`);
for (const v of curated) console.log(`  ${v.title}`);

if (!EXECUTE) {
  console.log('\nDRY RUN. Nothing written. Re-run with --execute to apply.');
  process.exit(problems.length > 0 ? 1 : 0);
}

writeFileSync(at('src', 'data', 'videos.json'), `${JSON.stringify(videoStore, null, 2)}\n`);
if (articles) writeFileSync(at('src', 'data', 'articles.json'), `${JSON.stringify(articleStore, null, 2)}\n`);
console.log('\nWritten. Run `npm run build` and `npm test` next.');
