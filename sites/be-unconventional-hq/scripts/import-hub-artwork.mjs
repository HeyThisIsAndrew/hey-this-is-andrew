#!/usr/bin/env node
/*
  IMPORT A FOLDER OF HUB ARTWORK IN ONE GO.

  Point it at a folder of CATEGORY / BRAND directories and it uploads every
  image to Sanity (the asset host every existing hub already uses) and writes
  the refs into src/data/videos.json. It is the Local CMS's per-hub, per-image
  flow done in one pass, and unlike that flow it can be re-run.

    node scripts/import-hub-artwork.mjs "~/Downloads/Featured Brands"
    node scripts/import-hub-artwork.mjs "~/Downloads/Featured Brands" --execute

  Dry-run by default, like scripts/sync-youtube.mjs. It prints the brand to hub
  match, the role it gives each file and everything it is unsure about, and
  touches nothing until --execute. Needs SANITY_WRITE_TOKEN in .env, same as
  the CMS's own uploader.

  It only FILLS the artwork fields. It never deletes a hub, never edits copy,
  colour or keywords, and never overwrites artwork a hub already has unless
  you pass --replace.

  WHICH FILE PLAYS WHICH PART is decided by scripts/hub-artwork-map.json where
  that names a brand, and by shape where it does not. The map exists because a
  real folder of brand assets is mostly LOGOS: variants, lockups, symbols, in
  every aspect ratio there is. Guessing "wide means key art" puts a 7:1
  wordmark in a 16:9 hero. So the choices are written down where they can be
  read and corrected, instead of being re-derived from filenames every run.

  MISC folders are ignored anywhere in the tree.
*/
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { config } from 'dotenv';
import { createClient } from '@sanity/client';

/* The project id comes from the module the site itself reads images through,
   never a copy. A wrong one is not a visible failure: the token authenticates
   fine and every upload is refused with "Session does not match project host".
   Node 22 strips the types; the .ts extension is this repo's convention for
   src/lib imports from scripts (see scripts/sync-youtube.mjs). */
import { SANITY_PROJECT } from '../src/lib/sanity-project.ts';

/*
  Plain `node` does not read .env. The Local CMS's uploader gets
  SANITY_WRITE_TOKEN for free because Vite loads it for the dev server, which
  is exactly why this script failed with "not set" against a .env that had it.
  Same call scripts/sync-youtube.mjs makes, and not `--env-file`: that is a
  hard error when the file is absent, which CI is (scripts/sync-wiring.test.mjs
  guards it).
*/
config();

const DATA = path.resolve(process.cwd(), 'src/data/videos.json');
const MAP_FILE = path.resolve(process.cwd(), 'scripts/hub-artwork-map.json');

/* Sanity takes these. The rest of what lands in a brand folder — .eps, .psd,
   .pdf, .rtf, .mp4 — is source material, not something the site can serve. */
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']);
const IGNORE_DIR = /^(misc|__macosx)$/i;

/* Under these the art shows its own pixels on a 3x phone, which is the whole
   reason the hubs looked unfinished. Vectors are exempt: they have no pixels. */
const MIN_LOGO = 512;
const MIN_HERO_W = 1920;

const args = process.argv.slice(2);
const execute = args.includes('--execute');
const replace = args.includes('--replace');
const root = args.find((a) => !a.startsWith('--'));

if (!root) {
  console.error('Usage: node scripts/import-hub-artwork.mjs "<folder>" [--execute] [--replace]');
  process.exit(1);
}
const dir = path.resolve(root.replace(/^~(?=$|\/)/, os.homedir()));
if (!fs.existsSync(dir)) {
  console.error(`No such folder: ${dir}`);
  process.exit(1);
}

/* ── Reading a size without an image library ─────────────────────────────── */
function rasterSize(b) {
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) {
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  }
  if (b.length > 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = b.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return { w: (b.readUIntLE(24, 3) & 0xffffff) + 1, h: (b.readUIntLE(27, 3) & 0xffffff) + 1 };
    if (chunk === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const bits = b.readUInt32LE(21);
      return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length - 9) {
      if (b[i] !== 0xff) { i += 1; continue; }
      const marker = b[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      }
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}

/* SVG carries its size as text: width/height attributes, or the viewBox. */
function svgSize(text) {
  const attr = (name) => {
    const m = text.match(new RegExp(`\\b${name}\\s*=\\s*["']([\\d.]+)`, 'i'));
    return m ? Math.round(parseFloat(m[1])) : null;
  };
  const w = attr('width');
  const h = attr('height');
  if (w && h) return { w, h, vector: true };
  const box = text.match(/viewBox\s*=\s*["']\s*[-\d.]+[,\s]+[-\d.]+[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (box) return { w: Math.round(parseFloat(box[1])), h: Math.round(parseFloat(box[2])), vector: true };
  return { w: null, h: null, vector: true };
}

function imageSize(file) {
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.alloc(65536);
  const read = fs.readSync(fd, buf, 0, 65536, 0);
  fs.closeSync(fd);
  const b = buf.subarray(0, read);
  if (path.extname(file).toLowerCase() === '.svg') return svgSize(b.toString('utf-8'));
  return rasterSize(b);
}

/* ── Walking the tree ─────────────────────────────────────────────────────
   Files are gathered from a brand folder AND its subfolders, because assets
   arrive that way (Apple TV/Apple_TV_Logo/…, A24/A24/…). MISC is skipped at
   any depth. Paths come back relative to the brand folder, so the map can
   name a nested file the same way a person would read it out. */
function collect(base, rel = '') {
  const here = path.join(base, rel);
  const out = [];
  for (const e of fs.readdirSync(here, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const childRel = rel ? path.join(rel, e.name) : e.name;
    if (e.isDirectory()) {
      if (IGNORE_DIR.test(e.name)) continue;
      out.push(...collect(base, childRel));
    } else if (IMAGE_EXT.has(path.extname(e.name).toLowerCase())) {
      out.push(childRel);
    }
  }
  return out;
}

/* ── Matching a brand folder to a hub ─────────────────────────────────────
   CATEGORY-AWARE, and it has to be. "Disney+" under Streamer and "Disney"
   under Studios are two different hubs, and a name-only match sends both to
   whichever one it finds first. The folder's category is the tie-break. */
const CATEGORY_DIRS = {
  gaming: 'gaming',
  streamer: 'streaming',
  streamers: 'streaming',
  streaming: 'streaming',
  studios: 'studios',
  studio: 'studios',
  'the multiverse': 'universes',
  multiverse: 'universes',
  universes: 'universes',
};

/* Folder names a person would plausibly use that no rule below would catch. */
const ALIASES = {
  wbdiscovery: 'warner-bros',
  warnerbrosdiscovery: 'warner-bros',
  wb: 'warner-bros',
  max: 'hbo-max',
  hbo: 'hbo-max',
  ps: 'playstation',
};

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

const docs = JSON.parse(fs.readFileSync(DATA, 'utf-8'));
const hubs = docs.filter((d) => d._type === 'featuredBrand' && d.slug?.current);

let MAP = {};
try {
  MAP = JSON.parse(fs.readFileSync(MAP_FILE, 'utf-8'));
} catch {
  /* Optional. Without it every brand falls back to shape. */
}

function findHub(brandFolder, category) {
  const n = norm(brandFolder);
  const bySlug = (slug) => hubs.find((h) => h.slug.current === slug) ?? null;
  if (ALIASES[n]) return bySlug(ALIASES[n]);

  /* Inside the folder's own category first, so Disney+ and Disney separate. */
  const pools = category ? [hubs.filter((h) => h.hubCategory === category), hubs] : [hubs];
  for (const pool of pools) {
    const exact =
      pool.find((h) => norm(h.slug.current) === n) || pool.find((h) => norm(h.title) === n);
    if (exact) return exact;
  }
  for (const pool of pools) {
    if (n.length < 3) break;
    const near = pool.filter(
      (h) => norm(h.slug.current).startsWith(n) || n.startsWith(norm(h.slug.current)),
    );
    /* A prefix only counts when it is unambiguous. Putting the wrong brand's
       art on a hub is worse than reporting it and letting a person say which. */
    if (near.length === 1) return near[0];
  }
  return null;
}

/* Fallback when the map is silent: shape, with the filename overriding it. */
function roleOf(rel, size) {
  const n = path.basename(rel).toLowerCase();
  if (/backdrop|plate/.test(n)) return 'backdrop';
  if (/logo|mark|wordmark|icon|symbol/.test(n)) return 'logo';
  if (/hero|key ?art|keyart|banner|cover|still|background/.test(n)) return 'heroImage';
  if (!size?.w) return 'logo';
  return size.w / size.h >= 1.4 && size.w >= MIN_HERO_W ? 'heroImage' : 'logo';
}

/* ── Build the plan ───────────────────────────────────────────────────────── */
const plan = [];
const unmatched = [];
const warnings = [];
const notes = [];

const topLevel = fs
  .readdirSync(dir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !IGNORE_DIR.test(e.name))
  .map((e) => e.name)
  .sort();

/* Category folders are optional: a flat folder of brands still works. */
const brandDirs = [];
for (const top of topLevel) {
  const category = CATEGORY_DIRS[top.toLowerCase()] ?? null;
  const children = fs
    .readdirSync(path.join(dir, top), { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !IGNORE_DIR.test(e.name));
  if (category) for (const c of children) brandDirs.push({ rel: `${top}/${c.name}`, brand: c.name, category });
  else brandDirs.push({ rel: top, brand: top, category: null });
}

for (const { rel, brand, category } of brandDirs) {
  const hub = findHub(brand, category);
  if (!hub) { unmatched.push(rel); continue; }

  const files = collect(path.join(dir, rel));
  if (!files.length) { warnings.push(`${rel}: no usable images`); continue; }

  const sizes = new Map(files.map((f) => [f, imageSize(path.join(dir, rel, f))]));
  const picks = {};
  const entry = MAP[rel] ?? MAP[brand];

  if (entry) {
    if (entry._note) notes.push(`${rel}: ${entry._note}`);
    for (const role of ['logo', 'heroImage', 'backdrop']) {
      const named = entry[role];
      if (!named) continue;
      const hit = files.find((f) => f === named || path.basename(f) === named);
      if (!hit) { warnings.push(`${rel}: the map names "${named}" for ${role}, which is not there`); continue; }
      picks[role] = { rel: hit, size: sizes.get(hit) };
    }
  } else {
    for (const f of files) {
      const role = roleOf(f, sizes.get(f));
      if (picks[role]) continue; // first wins; the map is how you say otherwise
      picks[role] = { rel: f, size: sizes.get(f) };
    }
  }

  for (const [role, pick] of Object.entries(picks)) {
    const s = pick.size ?? {};
    if (s.vector) {
      warnings.push(`${rel}: ${role} is an SVG. Sanity serves those unprocessed, and a dark-only mark will vanish on this site. Check it.`);
    } else if (role === 'logo' && s.w && Math.max(s.w, s.h) < MIN_LOGO) {
      warnings.push(`${rel}: logo is ${s.w}x${s.h}, under the ${MIN_LOGO}px minimum`);
    } else if (role !== 'logo' && s.w && s.w < MIN_HERO_W) {
      warnings.push(`${rel}: ${role} is ${s.w}x${s.h}, under ${MIN_HERO_W}px wide`);
    }
  }
  if (!picks.heroImage && !hub.heroImage) notes.push(`${rel}: no key art. The hub falls back to a tinted wordmark.`);

  plan.push({ rel, hub, picks });
}

const dim = (s) => (s?.w ? `${s.w}x${s.h}${s.vector ? ' svg' : ''}` : '?');

console.log(`\n${execute ? 'IMPORTING' : 'DRY RUN'} from ${dir}`);
console.log(`${brandDirs.length} brand folder(s), ${hubs.length} hubs in videos.json\n`);

for (const { rel, hub, picks } of plan) {
  const already = [hub.logo && 'logo', hub.heroImage && 'hero'].filter(Boolean);
  const held = already.length && !replace ? `   (has ${already.join(' + ')} already, keeping)` : '';
  console.log(`  ${rel}  ->  ${hub.slug.current}${held}`);
  for (const role of ['logo', 'heroImage', 'backdrop']) {
    if (picks[role]) console.log(`      ${role.padEnd(10)} ${picks[role].rel}  ${dim(picks[role].size)}`);
  }
}

if (unmatched.length) {
  console.log('\n  NOT MATCHED to any hub (nothing done with these):');
  for (const f of unmatched) console.log(`      ${f}`);
  console.log(`  Hubs are: ${hubs.map((h) => h.slug.current).join(', ')}`);
}
if (notes.length) {
  console.log('\n  NOTES:');
  for (const n of notes) console.log(`      ${n}`);
}
if (warnings.length) {
  console.log('\n  WARNINGS:');
  for (const w of warnings) console.log(`      ${w}`);
}

if (!execute) {
  console.log('\nDry run. Nothing uploaded, videos.json untouched.');
  console.log('--execute to import. --replace to overwrite artwork a hub already has.');
  console.log('To change a choice, edit scripts/hub-artwork-map.json and run again.\n');
  process.exit(0);
}

const token = process.env.SANITY_WRITE_TOKEN;
if (!token) {
  console.error('\nSANITY_WRITE_TOKEN is not set.');
  console.error('It is read from .env in the repo root, or from the environment.');
  console.error('See .env.example for the name. Nothing was uploaded.');
  process.exit(1);
}
const client = createClient({
  projectId: SANITY_PROJECT.projectId,
  dataset: SANITY_PROJECT.dataset,
  token,
  apiVersion: '2024-03-01',
  useCdn: false,
});

let uploaded = 0;
let failed = 0;

for (const { rel, hub, picks } of plan) {
  for (const [role, pick] of Object.entries(picks)) {
    const has = role === 'backdrop' ? (hub.backdrops ?? []).length > 0 : !!hub[role];
    if (has && !replace) continue;
    const file = path.join(dir, rel, pick.rel);
    try {
      const asset = await client.assets.upload('image', fs.createReadStream(file), {
        filename: path.basename(pick.rel),
      });
      /* Shapes match the hubs that already work: logo as a full image object,
         heroImage and backdrops as bare refs. urlFor() reads both. */
      if (role === 'logo') hub.logo = { _type: 'image', asset: { _ref: asset._id, _type: 'reference' } };
      else if (role === 'heroImage') hub.heroImage = asset._id;
      else hub.backdrops = [asset._id];
      uploaded += 1;
      console.log(`  ok  ${hub.slug.current} ${role}  ${asset._id}`);
    } catch (err) {
      failed += 1;
      console.error(`  FAILED  ${rel} ${role}: ${err instanceof Error ? err.message : err}`);
    }
  }
}

/* Write through a temp file so an interrupted run cannot leave a half-written
   videos.json behind — the same move the Local CMS middleware makes. */
if (uploaded) {
  const tmp = `${DATA}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(docs, null, 2)}\n`, 'utf-8');
  fs.renameSync(tmp, DATA);
}

console.log(`\n${failed ? '!' : 'Done.'} ${uploaded} image(s) imported, ${failed} failed.`);
console.log(uploaded ? 'src/data/videos.json updated. Review with `git diff`, then commit.\n' : 'Nothing to write.\n');
process.exit(failed ? 1 : 0);
