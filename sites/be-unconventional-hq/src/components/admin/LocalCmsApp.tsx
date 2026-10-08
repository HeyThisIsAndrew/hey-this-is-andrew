import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { urlFor } from '../../lib/local-content.ts';
import { COVERAGE_TYPES } from '../../lib/tags.ts';

type DocType = 'video' | 'short' | 'live' | 'event' | 'featuredBrand' | 'topic' | 'article' | 'articleOutro';

type LocationInfo = { venue?: string; city?: string; region?: string; country?: string };

type Doc = {
  _id: string;
  _type: DocType;
  title: string;

  // article
  guid?: string;
  editorial?: {
    title?: string;
    excerpt?: string;
    image?: string;
    category?: string;
    featured?: boolean;
    hidden?: boolean;
  forceSpotlightHero?: boolean;
    sortWeight?: number;
  };

  // video / short / live
  youtubeId?: string;
  description?: string;
  thumbnailUrl?: string;
  badge1?: string;
  badge2?: string;
  badge3?: string;
  /* The /feed hero's editorial overrides. Only the newest video ever renders
     them, but they are seeded on every video doc so an editor can set them
     before the item reaches the top of the feed. */
  customHeroLogo?: string;
  customHeroBrandLabel?: string;
  durationSeconds?: number;
  isShort?: boolean;
  isLive?: boolean;
  isEvent?: boolean;
  viewCount?: number;
  publishedAt?: string;
  youtubeTags?: string[];
  platform?: string;
  lastSyncedAt?: string;
  contentStatus?: 'published' | 'needs-review' | 'archived';
  manualTypeOverride?: string;
  featured?: boolean;
  franchises?: string[];
  characters?: string[];
  coverageType?: string;
  series?: string;
  featuredSeries?: boolean;
  seriesAccent?: string;
  editorialNotes?: string;
  /** Ordering override. Changes where the item sits in a row, not its date. */
  sortDate?: string;
  topics?: string[];
  hubs?: string[];
  requiresReview?: boolean;
  manualTaxonomyOverride?: boolean;
  relatedMedia?: { title: string; mediaType: string }[];

  // event / featuredBrand
  slug?: { _type: 'slug'; current: string } | string;
  status?: string;
  eventType?: string;
  /* The hero's one-line bio. Distinct from `description`, which is the
     About copy in the page body. */
  tagline?: string;
  startDate?: string;
  endDate?: string;
  location?: LocationInfo;
  organizer?: string;
  officialWebsite?: string;
  relatedBrandSlug?: string;
  signUpLink?: string;
  trailerUrl?: string;
  logo?: any;
  heroImage?: any;
  backdrops?: any[];
  youtubeSyncKeywords?: string[];
  heroLogo?: string;
  stageLogo?: string;
  stageShowMark?: boolean;
  excludeCoverage?: string[];
  pinnedCoverage?: string[];
  brandColor?: { hex?: string };
  /** Which accordion row this hub appears in on /featured. */
  hubCategory?: string;
  hidden?: boolean;
  forceSpotlightHero?: boolean;
  spotlightBadge?: 'countdown' | 'dot' | 'none';
  /* Recurring series — see the long note in schema/event.ts. A template is a
     reusable profile (PAX West) that never renders; an edition points back at
     one by slug. */
  isRecurringTemplate?: boolean;
  seriesTemplateSlug?: string;
  editionLabel?: string;
  recurrenceCadence?: string;
  recurrenceMonth?: string;
  socialLinks?: { platform: string; url: string }[];
  metrics?: {
    snapshots: { date: string; viewCount: number }[];
    viewVelocity7d: number;
    lastComputedAt: string;
  };
  videoAssets?: { title: string; url: string }[];
  gallery?: { url: string; alt: string }[];
  sponsors?: { name: string; logo: string; url: string }[];
  pressAssets?: { label: string; url: string }[];
  videoIds?: string[];
  articleUrls?: string[];

  // topic
  isTier1Category?: boolean;
  emptyStateMessage?: string;
};

const CONTENT_TABS = [
  { id: 'factual', label: 'Factual (Read-Only)' },
  { id: 'status', label: 'Status & Curation' },
  { id: 'overrides', label: 'Systems Overrides' },
  { id: 'taxonomy', label: 'Core Taxonomy' },
  { id: 'editorial', label: 'Editorial' },
];

const TYPE_META: Record<string, { label: string; badge: string }> = {
  video: { label: 'Video', badge: 'bg-blue-500/20 text-blue-300' },
  short: { label: 'Short', badge: 'bg-purple-500/20 text-purple-300' },
  live: { label: 'Live', badge: 'bg-red-500/20 text-red-300' },
  event: { label: 'Event', badge: 'bg-amber-500/20 text-amber-300' },
  featuredBrand: { label: 'Featured', badge: 'bg-emerald-500/20 text-emerald-300' },
  topic: { label: 'Topic', badge: 'bg-indigo-500/20 text-indigo-300' },
  article: { label: 'Article', badge: 'bg-teal-500/20 text-teal-300' },
};

// Helper for parsing sanity image references or plain strings
const getImageUrl = (image: any) => {
  if (!image) return null;
  
  // Extract the reference string whether it's a bare string or wrapped in an object
  const ref = typeof image === 'string' ? image : (image.asset && image.asset._ref);
  
  if (ref && typeof ref === 'string' && ref.startsWith('image-')) {
    const parts = ref.split('-');
    if (parts.length >= 4) {
      const ext = parts.pop();
      const dim = parts.pop();
      const hash = parts.slice(1).join('-');
      return `https://cdn.sanity.io/images/38nhxsib/production/${hash}-${dim}.${ext}`;
    }
  }
  
  // If it's a string but doesn't look like a Sanity ref (e.g. a normal URL or /uploads/ path)
  if (typeof image === 'string') return image;

  return null;
};

const FILTERS = ['All', 'Videos', 'Shorts', 'Live', 'Events', 'Featured', 'Topics', 'Articles', 'Outro'] as const;
type Filter = (typeof FILTERS)[number] | 'GlobalStatus';

const FILTER_LABELS: Record<Filter, string> = {
  All: 'All Content',
  Videos: 'Videos',
  Shorts: 'Shorts',
  Live: 'Live',
  Events: 'Events',
  Featured: 'Featured Brands',
  Topics: 'Topics',
  Articles: 'Articles',
  Outro: 'Article Outro',
  GlobalStatus: 'Global Status',
};

// Grouped by what these actually are in our local schema - video/short/live
// are YouTube-sourced content; event/featuredBrand are hand-curated hub
// pages. Topics are taxonomy nodes.
const FILTER_GROUPS: { label: string; filters: Filter[] }[] = [
  { label: 'Content', filters: ['All', 'Videos', 'Shorts', 'Live', 'Articles'] },
  { label: 'Hubs & Pages', filters: ['Events', 'Featured'] },
  { label: 'Taxonomy', filters: ['Topics'] },
  /* The standard closing section under every article. One document, not a
     list — it is site furniture, so there is nothing to create or delete. */
  { label: 'Site Copy', filters: ['Outro'] },
];

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || `untitled-${Date.now()}`
  );
}

function videoDocId(youtubeId: string): string {
  return `youtube-${youtubeId}`;
}

/* Value/label pairs for the recurring-series "usual month" picker. Values are
   zero-padded so they sort and compare as the same strings the date fields
   use. */
const MONTH_OPTIONS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

function makeBlankDoc(type: DocType): Doc {
  const now = new Date().toISOString();
  if (type === 'event') {
    return {
      _id: `local-${crypto.randomUUID()}`,
      _type: 'event',
      title: 'New Event',
      slug: { _type: 'slug', current: slugify(`new-event-${Date.now()}`) },
      status: 'scheduled',
      /* Empty, not a guess. 'convention' was seeded here and it is now a
         retired value, so every new event would have been born holding one.
         The dropdown offers "Not set" and the hero renders "Event" for it, so
         an unclassified event is a state the UI already handles. */
      eventType: '',
      tagline: '',
      isRecurringTemplate: false,
      seriesTemplateSlug: '',
      editionLabel: '',
      startDate: '',
      endDate: '',
      location: { venue: '', city: '', region: '', country: '' },
      description: '',
      organizer: '',
      officialWebsite: '',
      signUpLink: '',
      trailerUrl: '',
      logo: '',
      heroImage: '',
      youtubeSyncKeywords: [],
      videoAssets: [],
      gallery: [],
      sponsors: [],
      pressAssets: [],
    };
  }
  if (type === 'featuredBrand') {
    return {
      _id: `local-${crypto.randomUUID()}`,
      _type: 'featuredBrand',
      title: 'New Brand',
      slug: { _type: 'slug', current: slugify(`new-brand-${Date.now()}`) },
      trailerUrl: '',
      logo: '',
      heroImage: '',
      youtubeSyncKeywords: [],
      // Defaults so a brand-new hub renders in a real row with a real glow
      // instead of dropping into a nameless "other" section.
      hubCategory: 'streaming',
      brandColor: { hex: '#CC0000' },
      description: '',
    };
  }
  if (type === 'topic') {
    return {
      _id: `topic-${crypto.randomUUID()}`,
      _type: 'topic',
      title: 'New Topic',
      slug: { _type: 'slug', current: slugify(`new-topic-${Date.now()}`) },
      isTier1Category: false,
      youtubeSyncKeywords: [],
      emptyStateMessage: '',
    };
  }
  return {
    _id: `local-pending-${crypto.randomUUID()}`,
    _type: type,
    youtubeId: '',
    title: `New ${TYPE_META[type].label}`,
    description: '',
    thumbnailUrl: '',
    durationSeconds: 0,
    isShort: type === 'short',
    isLive: type === 'live',
    isEvent: false,
    viewCount: 0,
    publishedAt: now,
    youtubeTags: [],
    platform: 'youtube',
    lastSyncedAt: now,
    contentStatus: 'needs-review',
    manualTypeOverride: type,
    featured: false,
    franchises: [],
    characters: [],
    coverageType: '',
    series: '',
    editorialNotes: '',
    sortDate: '',
    /* Seeded empty for the same reason every other editorial field here is:
       the sync rebuilds a doc from a named list, so a field that is absent is
       erased rather than left alone. */
    customHeroLogo: '',
    customHeroBrandLabel: '',
    topics: [],
    hubs: [],
    requiresReview: true,
    // Hand-authored, not sync-derived - lock taxonomy so a later sync run
    // can't quietly overwrite what was typed in here.
    manualTaxonomyOverride: true,
    videoIds: [],
    articleUrls: [],
  };
}

const inputClass =
  'block w-full rounded-md border-0 py-2 px-3 bg-[#151515] text-white text-sm ring-1 ring-inset ring-white/10 placeholder:text-gray-600 focus:ring-2 focus:outline-none focus:ring-red-500';
const textareaClass = `${inputClass} resize-y min-h-[140px] leading-relaxed`;
const labelClass = 'block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2';
const sectionClass = 'space-y-6';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

/**
 * Every image already in the store, so a mark that exists can be REUSED
 * instead of uploaded again.
 *
 * ─── WHY THIS EXISTS ──────────────────────────────────────────────────────
 * Asked for directly: "I need the ability to reference existing logos and
 * images between cms pages like a dropdown so I don't have to keep uploading
 * new assets." Before this, the only way to put the PAX wordmark on a fourth
 * PAX edition was to upload the same file a fourth time, which is four copies
 * on the CDN and four chances for them to drift apart.
 *
 * Walks the whole document set rather than a fixed list of fields, because
 * images live in several shapes here: a bare ref string on `logo`, an array
 * on `backdrops`, an object with `asset._ref` on older frozen-export docs.
 * Anything that looks like an asset ref counts, wherever it is.
 */
/*
  ─── THE LIBRARY REMEMBERS ────────────────────────────────────────────────

  `collectAssetLibrary` below answers "which assets are IN USE right now", and
  for a while that was also the picker's whole contents. It made the picker
  unusable for the one job it exists for.

  Swapping two images between fields is: open Reuse on field A, pick B's
  image. The instant that lands, A's old image is referenced by nothing, so it
  vanishes from the picker — before you can open field B and put it there.
  Reported as "the one that got replaced would be missing if it wasn't visible
  anywhere".

  So the picker is fed a REMEMBERED set that only ever grows. Every ref the
  store has ever shown this browser stays offerable, whether or not a document
  currently points at it, and an asset leaves only when somebody deliberately
  forgets it. Nothing here reads or writes `videos.json`: forgetting an asset
  removes it from this list, never from the store or from any document.

  localStorage, so it survives a reload of a dev-only page. A browser that
  refuses it (private window, blocked site data) degrades to the old
  in-use-only behaviour rather than throwing, which is why every access is
  wrapped.
*/
const ASSET_MEMORY_KEY = 'bu-local-cms-known-assets';
const ASSET_REF = /^image-[0-9a-f]{20,}-\d+x\d+-[a-z]+$/i;

function readRememberedAssets(): string[] {
  try {
    const raw = localStorage.getItem(ASSET_MEMORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((r) => typeof r === 'string' && ASSET_REF.test(r)) : [];
  } catch {
    return [];
  }
}

function writeRememberedAssets(refs: string[]) {
  try {
    localStorage.setItem(ASSET_MEMORY_KEY, JSON.stringify(refs));
  } catch {
    /* Private window or blocked site data. The session still works. */
  }
}

export type AssetEntry = { ref: string; usedBy: string[] };

/**
 * The picker's contents: everything remembered, each labelled with the
 * documents that currently point at it. An entry with an empty `usedBy` is
 * not an error — it is an asset waiting to be placed, which is exactly what
 * the middle of a swap looks like.
 */
function buildAssetLibrary(docs: any[], remembered: string[]): AssetEntry[] {
  const inUse = new Map(collectAssetLibrary(docs).map((a) => [a.ref, a.usedBy]));
  const refs = Array.from(new Set([...remembered, ...inUse.keys()]));
  return refs
    .map((ref) => ({ ref, usedBy: inUse.get(ref) ?? [] }))
    /* In use first, then alphabetically, so the list is stable across edits. */
    .sort((a, b) => {
      if (!a.usedBy.length !== !b.usedBy.length) return a.usedBy.length ? -1 : 1;
      return (a.usedBy[0] ?? a.ref).localeCompare(b.usedBy[0] ?? b.ref);
    });
}

function collectAssetLibrary(docs: any[]): { ref: string; usedBy: string[] }[] {
  const REF = /^image-[0-9a-f]{20,}-\d+x\d+-[a-z]+$/i;
  const found = new Map<string, Set<string>>();

  const walk = (value: any, label: string) => {
    if (!value) return;
    if (typeof value === 'string') {
      if (REF.test(value)) {
        if (!found.has(value)) found.set(value, new Set());
        found.get(value)!.add(label);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const v of value) walk(v, label);
      return;
    }
    if (typeof value === 'object') {
      for (const v of Object.values(value)) walk(v, label);
    }
  };

  for (const doc of docs ?? []) {
    const label = doc?.title || doc?.slug?.current || doc?._id || 'untitled';
    walk(doc, label);
  }

  return [...found.entries()]
    .map(([ref, usedBy]) => ({ ref, usedBy: [...usedBy].sort() }))
    .sort((a, b) => a.usedBy[0].localeCompare(b.usedBy[0]));
}

/*
  ONE FIELD, TWO SHAPES.

  The local CMS writes a bare ref string. The original frozen Sanity export
  wrote `{_type:'image', asset:{_ref}}`, and a handful of documents still
  carried that shape — D23 and SDCC 2027 among them. Reading the field with a
  bare `typeof === 'string'` showed those as having NO logo, so the editor's
  only move was to upload a duplicate of an asset that was already there.

  `urlFor()` and the dimension parser both accept either shape, so nothing was
  broken on the site; this was a CMS-only blind spot. Saving through the form
  normalises the field to a string, which is why the store is all strings now.
*/
function refOf(value: any): string {
  if (typeof value === 'string') return value;
  const ref = value?.asset?._ref ?? value?._ref;
  return typeof ref === 'string' ? ref : '';
}

/** "image-<hash>-3000x1022-png" -> "3000x1022". Shown so a wordmark and a
 *  square mark are told apart at a glance in the picker. */
function refDimensions(ref: string): string {
  const m = /-(\d+)x(\d+)-/.exec(ref || '');
  return m ? `${m[1]}x${m[2]}` : '';
}

function AssetPicker({
  library,
  onPick,
  onClose,
  onForget,
}: {
  library: AssetEntry[];
  onPick: (ref: string) => void;
  onClose: () => void;
  onForget?: (ref: string) => void;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  /*
    Matches the documents an asset is on, its dimensions, AND its ref. It used
    to match `usedBy` alone, which meant an asset nothing currently points at
    could not be found by typing anything at all — and after the library
    started remembering unused assets, those are precisely the ones somebody
    is hunting for mid-swap.
  */
  const shown = q
    ? library.filter(
        (a) =>
          a.usedBy.some((u) => u.toLowerCase().includes(q)) ||
          refDimensions(a.ref).includes(q) ||
          a.ref.toLowerCase().includes(q),
      )
    : library;

  return (
    /*
      z-index 300, set inline rather than as `z-50`.

      The navbar is `z-index: 100` and `.safe-area-blackout` is 110
      (styles/modules/navbar.css, responsive-mobile.css), and this page renders
      inside the site's own <Layout>. At Tailwind's z-50 the navbar painted
      over the top of this panel, which put the site header on top of the
      Close button. 300 is the value styles/modules/modal.css already uses,
      with the comment "High z-index to be above navbar" - same problem, same
      answer, so the two agree rather than leapfrogging each other.

      Inline, because this exact page has a recorded history of Tailwind's JIT
      not emitting rules for classes used here (see the note in
      dev-routes/local-cms.astro). A z-index that silently fails to generate
      reintroduces the bug invisibly.
    */
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/80 p-4"
      style={{ zIndex: 300 }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[80vh] flex flex-col rounded-lg border border-white/10 bg-[#111214]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* The header is OUTSIDE the scroll area, so Close stays reachable
            however far down the grid somebody has scrolled. */}
        <div className="flex-none flex items-center justify-between gap-3 border-b border-white/10 p-5 pb-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-300">
              Use an image already in the store
            </h3>
            <p className="mt-1 text-[11px] text-gray-500">
              Everything this browser has seen, in use or not. Picking one here only fills the
              field; nothing is written to videos.json until you save.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-none rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-gray-300 hover:border-white/20 hover:bg-white/10 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 pt-4">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by document, size or ref..."
            className={`${inputClass} mb-4`}
          />
          {shown.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing matches that.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {shown.map((asset) => {
                const unused = asset.usedBy.length === 0;
                return (
                  <div key={asset.ref} className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        onPick(asset.ref);
                        onClose();
                      }}
                      className="w-full text-left rounded-md border border-white/10 bg-black/40 p-2 hover:border-red-500/60 hover:bg-white/5 transition-colors"
                    >
                      <img
                        src={urlFor(asset.ref).width(320).url()}
                        alt=""
                        className="h-20 w-full object-contain rounded bg-black/50"
                        loading="lazy"
                      />
                      <p
                        className={`mt-2 text-[11px] leading-tight line-clamp-2 ${
                          unused ? 'text-gray-500 italic' : 'text-gray-300'
                        }`}
                      >
                        {unused ? 'Not on any document yet' : asset.usedBy.join(', ')}
                      </p>
                      <p className="text-[10px] text-gray-500">{refDimensions(asset.ref)}</p>
                    </button>
                    {/*
                      Forgetting is DELIBERATE and it is not a delete. It drops
                      the asset from this browser's picker list and touches
                      neither videos.json nor the uploaded file, so an asset a
                      document still points at keeps rendering. Offered only on
                      unused entries, so the swap workflow cannot lose the
                      image it is halfway through moving.
                    */}
                    {unused && onForget && (
                      <button
                        type="button"
                        title="Remove from this list. Does not delete the image."
                        onClick={() => onForget(asset.ref)}
                        className="absolute top-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-gray-400 hover:bg-black hover:text-white transition-colors"
                      >
                        Forget
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ImageUploadField({
  label,
  value,
  onChange,
  hint,
  library = [],
  onForgetAsset,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  library?: AssetEntry[];
  onForgetAsset?: (ref: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [picking, setPicking] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Base64 data URL, not FormData - the dev-server middleware
      // (astro.config.mjs) reads a JSON {filename, data} body.
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const res = await fetch('/api/local-cms/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, data: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      // Bare Sanity asset ref ("image-<hash>-<W>x<H>-<ext>"), not a resolved
      // URL - urlFor() (used below for the preview, and by every page that
      // renders this field) knows how to turn it into a real cdn.sanity.io
      // URL with CLS dimensions, same as a real frozen-export asset reference.
      onChange(data.ref);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to upload image');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const btn =
    'flex-none flex items-center justify-center px-3 py-2 text-xs font-bold rounded-lg border transition-colors';

  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} className={`${inputClass} flex-1`} placeholder="https://... or Upload / Reuse" />
        {library.length > 0 && (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className={`${btn} text-gray-300 border-white/10 bg-white/5 hover:text-white hover:border-white/20 hover:bg-white/10`}
          >
            Reuse
          </button>
        )}
        <label className={`${btn} ${uploading ? 'text-gray-500 border-white/5 bg-white/5 cursor-wait' : 'text-gray-300 border-white/10 bg-white/5 hover:text-white hover:border-white/20 hover:bg-white/10 cursor-pointer'}`}>
          {uploading ? 'Uploading...' : 'Upload'}
          <input type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      </div>
      {hint && <p className="text-xs text-gray-500 mt-1.5">{hint}</p>}
      {value && typeof value === 'string' && (
        <div className="mt-2 flex items-center gap-3">
          <img src={urlFor(value).width(400).url()} alt="Preview" className="h-20 object-contain rounded-md bg-black/50 border border-white/10 p-1" />
          <span className="text-[11px] text-gray-500">{refDimensions(value)}</span>
        </div>
      )}
      {picking && (
        <AssetPicker library={library} onPick={onChange} onClose={() => setPicking(false)} onForget={onForgetAsset} />
      )}
    </Field>
  );
}

/*
  The still images that cross-fade behind a hub on /featured.

  A hub with videos tagged to it already gets a backdrop for free — their
  thumbnails, newest first (getHubBackdrops in src/lib/local-content.ts). This
  field is the override: anything set here wins outright, because a person
  chose it. It is also the ONLY source for a hub that has no coverage yet,
  which today is thirteen of the fifteen.

  Four to six reads best. Fewer and the loop is obvious; more and the later
  frames are never reached before someone moves on.
*/
function BackdropsField({ value, onChange }: { value?: any[]; onChange: (v: any[]) => void }) {
  const items = (value || []).filter((v) => typeof v === 'string') as string[];

  const setAt = (i: number, v: string) => {
    const next = [...items];
    if (v) next[i] = v;
    else next.splice(i, 1);
    onChange(next);
  };

  const move = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <Field label={`Backdrop Image Override (${items.length})`}>
      <p className="text-xs text-gray-600 mb-3">
        Optional. Only the FIRST image is used — it sits behind this hub on /featured
        and on its own page, heavily blurred with a slow drift. Leave empty and the
        hub's Hero Image is used instead; set one here only when the hero art does not
        work blurred.
      </p>
      <div className="space-y-3">
        {items.map((ref, i) => (
          <div key={`${ref}-${i}`} className="flex items-start gap-2">
            <img
              src={urlFor(ref).width(200).url()}
              alt=""
              className="h-14 w-24 flex-none rounded-md border border-white/10 bg-black/50 object-cover"
            />
            <input
              type="text"
              value={ref}
              onChange={(e) => setAt(i, e.target.value)}
              className={`${inputClass} flex-1 font-mono text-xs`}
            />
            <div className="flex flex-none gap-1">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                className="rounded border border-white/10 px-2 py-1 text-xs text-gray-400 hover:text-white disabled:opacity-30">↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1}
                className="rounded border border-white/10 px-2 py-1 text-xs text-gray-400 hover:text-white disabled:opacity-30">↓</button>
              <button type="button" onClick={() => setAt(i, '')}
                className="rounded border border-white/10 px-2 py-1 text-xs text-gray-400 hover:text-red-400">✕</button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3">
        <ImageUploadField
          label="Add a still"
          value=""
          onChange={(v) => { if (v) onChange([...items, v]); }}
        />
      </div>
    </Field>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="group flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3.5 cursor-pointer hover:bg-white/[0.04] transition-all duration-300 shadow-sm">
      <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">{label}</span>
      <span className="relative inline-flex h-5 w-9 flex-shrink-0 items-center">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="absolute inset-0 rounded-full bg-white/10 peer-checked:bg-gradient-to-r peer-checked:from-red-600 peer-checked:to-rose-500 transition-all duration-300 peer-checked:shadow-[0_0_12px_rgba(220,38,38,0.5)]" />
        <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white shadow-md transition-all duration-300 peer-checked:translate-x-4" />
      </span>
    </label>
  );
}

export default function LocalCmsApp() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('status');
  const [activeFilter, setActiveFilter] = useState<Filter | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  /*
    Seeded from localStorage so a reload does not lose an asset mid-swap, then
    unioned with whatever the loaded store references. Only ever grows here;
    the single place it shrinks is `forgetAsset`, which a person has to click.
  */
  const [rememberedAssets, setRememberedAssets] = useState<string[]>(() => readRememberedAssets());

  useEffect(() => {
    const live = collectAssetLibrary(docs).map((a) => a.ref);
    if (!live.length) return;
    setRememberedAssets((prev) => {
      const next = Array.from(new Set([...prev, ...live]));
      /* Length is a sufficient guard because this branch only ever ADDS.
         Returning `prev` unchanged is what stops the effect re-triggering
         itself through the state it just set. */
      if (next.length === prev.length) return prev;
      writeRememberedAssets(next);
      return next;
    });
  }, [docs]);

  const forgetAsset = useCallback((ref: string) => {
    setRememberedAssets((prev) => {
      const next = prev.filter((r) => r !== ref);
      writeRememberedAssets(next);
      return next;
    });
  }, []);

  const assetLibrary = useMemo(
    () => buildAssetLibrary(docs, rememberedAssets),
    [docs, rememberedAssets],
  );

  useEffect(() => {
    Promise.all([
      fetch('/api/local-cms/videos').then(res => res.json()),
      fetch('/api/local-cms/articles').then(res => res.json())
    ])
      .then(([videoData, articleData]) => {
        const vDocs = Array.isArray(videoData) ? videoData : [];
        const aDocs = Array.isArray(articleData) ? articleData.map((a) => ({
          ...a,
          _id: a.guid,
          _type: 'article'
        })) : [];
        setDocs([...vDocs, ...aDocs]);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setMessage({ text: 'Failed to load videos.json', type: 'error' });
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const vDocs = docs.filter(d => d._type !== 'article');
      const aDocs = docs.filter(d => d._type === 'article').map(d => {
        const { _id, _type, ...rest } = d;
        return rest;
      });

      const resV = await fetch('/api/local-cms/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vDocs),
      });
      const resA = await fetch('/api/local-cms/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aDocs),
      });

      if (!resV.ok || !resA.ok) throw new Error('Failed to save');
      setMessage({ text: 'Saved data successfully', type: 'success' });
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to save videos.json', type: 'error' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const updateDoc = (id: string, field: keyof Doc, value: any) => {
    if (field === 'youtubeId' && typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        const newId = videoDocId(trimmed);
        const collision = docs.find((d) => d._id === newId && d._id !== id);
        if (collision) {
          alert(
            `"${collision.title}" already uses YouTube ID ${trimmed}. Pick a different ID, or find and edit that existing document instead - two docs can't share the same ID.`,
          );
          return;
        }
        setDocs((prev) => prev.map((d) => (d._id === id ? { ...d, youtubeId: value, _id: newId } : d)));
        setSelectedId(newId);
        return;
      }
      // Cleared to empty: regenerate _id so it doesn't keep squatting on the
      // old youtube-<id> slot (a phantom lock - another doc could never use
      // that YouTube ID again while this stale reference existed).
      const freshId = `local-pending-${crypto.randomUUID()}`;
      setDocs((prev) => prev.map((d) => (d._id === id ? { ...d, youtubeId: value, _id: freshId } : d)));
      setSelectedId(freshId);
      return;
    }
    setDocs((prev) => prev.map((d) => (d._id === id ? { ...d, [field]: value } : d)));
  };

  const updateSlug = (id: string, value: string) => {
    const doc = docs.find((d) => d._id === id);
    if (!doc) return;
    const newSlug = slugify(value);
    // Same-type collision would break static route generation (two docs
    // mapping to the same /events/<slug> or /featured/<slug> path).
    const collision = docs.find((d) => d._id !== id && d._type === doc._type && (typeof d.slug === "string" ? d.slug : d.slug?.current) === newSlug);
    if (collision) {
      alert(`"${collision.title}" already uses the slug "${newSlug}". Pick a different one - two ${TYPE_META[doc._type].label} docs can't share a route.`);
      return;
    }
    setDocs((prev) => prev.map((d) => (d._id === id ? { ...d, slug: { _type: 'slug', current: newSlug } } : d)));
  };

  const updateLocation = (id: string, field: keyof LocationInfo, value: string) => {
    setDocs((prev) =>
      prev.map((d) => (d._id === id ? { ...d, location: { ...(d.location || {}), [field]: value } } : d)),
    );
  };

  const createDoc = (type: DocType) => {
    const blank = makeBlankDoc(type);
    setDocs((prev) => [blank, ...prev]);
    setSelectedId(blank._id);
    setActiveTab('status');
    setActiveFilter(
      type === 'event'
        ? 'Events'
        : type === 'featuredBrand'
          ? 'Featured'
          : type === 'short'
            ? 'Shorts'
            : type === 'live'
              ? 'Live'
              : 'Videos',
    );
    setSearch('');
  };

  /*
    ─── DUPLICATE AS NEW EDITION ─────────────────────────────────────────

    The mechanism behind the recurring-series model: stamp a new event out of
    an existing one (usually a series template) instead of rebuilding the
    profile from a blank document every year.

    WHAT CARRIES OVER is everything that describes the SERIES — artwork,
    brand colour, layout, venue, organizer, official site, related hub and
    the YouTube sync keywords, which are the field most often forgotten when
    an edition is rebuilt by hand and the reason a new edition would silently
    stop collecting coverage.

    WHAT IS CLEARED is everything that describes one OCCURRENCE: the dates,
    the ticket link (last year's sales page is worse than none), the edition
    label, the spotlight overrides, and the template flag itself — a copy of
    a template is an edition, never a second template. The copy also starts
    HIDDEN, so a half-filled edition with no dates cannot reach the live site
    between being created and being finished.
  */
  const duplicateAsEdition = (source: Doc) => {
    const sourceSlug = typeof source.slug === 'string' ? source.slug : source.slug?.current || '';
    const {
      _id: _ignoredId,
      startDate: _ignoredStart,
      endDate: _ignoredEnd,
      signUpLink: _ignoredSignUp,
      editionLabel: _ignoredEdition,
      isRecurringTemplate: _ignoredTemplate,
      forceSpotlightHero: _ignoredHero,
      spotlightBadge: _ignoredBadge,
      metrics: _ignoredMetrics,
      ...shared
    } = source;

    const stamp = Date.now();
    const edition: Doc = {
      ...shared,
      _id: `local-${crypto.randomUUID()}`,
      _type: 'event',
      title: `${source.title} (new edition)`,
      slug: { _type: 'slug', current: slugify(`${source.title}-${stamp}`) },
      startDate: '',
      endDate: '',
      signUpLink: '',
      editionLabel: '',
      isRecurringTemplate: false,
      /* Point the copy at its series: at the template it came from, or at the
         same template a sibling edition already belongs to. */
      seriesTemplateSlug: source.isRecurringTemplate ? sourceSlug : source.seriesTemplateSlug || '',
      hidden: true,
    };

    setDocs((prev) => [edition, ...prev]);
    setSelectedId(edition._id);
    setActiveTab('status');
    setActiveFilter('Events');
    setSearch('');
  };

  const deleteDoc = (id: string) => {
    const doc = docs.find((d) => d._id === id);
    if (!doc) return;
    // Tier-1 topics and Uncategorized are load-bearing: sync-youtube.mjs's
    // taxonomy dictionary is rebuilt from whatever topic docs exist here
    // once they're seeded, and 'uncategorized' is the hardcoded fallback
    // every unmatched video lands in. Deleting one of these doesn't crash
    // anything, but silently degrades tagging accuracy for every future
    // sync (e.g. delete "Film" and every "film"/"movie" keyword match
    // quietly falls through to Uncategorized instead) - worth blocking
    // outright rather than a confirm() a user can click through.
    if (doc._type === 'topic' && (doc.isTier1Category || doc._id === 'topic-uncategorized')) {
      alert(`"${doc.title}" is a fixed Tier-1 category that sync-youtube.mjs's taxonomy depends on. Deleting it won't crash anything, but future syncs will silently mis-tag videos that would have matched it. Edit its keywords instead of deleting it.`);
      return;
    }
    if (!confirm(`Delete "${doc.title}"? This can't be undone until you Save, but it's gone from this session either way.`)) return;
    setDocs((prev) => prev.filter((d) => d._id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const filterCounts = useMemo(() => {
    let counts = { All: 0, Videos: 0, Shorts: 0, Live: 0, Events: 0, Featured: 0, Topics: 0, Articles: 0, Outro: 0 };
    docs.forEach((d) => {
      const type = d.manualTypeOverride || d._type;
      if (['video', 'short', 'live'].includes(type as string)) counts.All++;
      if (type === 'video') counts.Videos++;
      if (type === 'short') counts.Shorts++;
      if (type === 'live') counts.Live++;
      if (type === 'event' || d.manualTypeOverride === 'event') counts.Events++;
      if (type === 'featuredBrand' || d.featured === true) counts.Featured++;
      if (type === 'topic') counts.Topics++;
      if (type === 'article') counts.Articles++;
      if (type === 'articleOutro') counts.Outro++;
    });
    return counts;
  }, [docs]);

  const filteredDocs = useMemo(() => {
    let list = docs.filter(
      (d) => d.title?.toLowerCase().includes(search.toLowerCase()) || d.youtubeId?.includes(search) || d.guid?.includes(search),
    );
    if (activeFilter && activeFilter !== 'GlobalStatus') {
      list = list.filter((d) => {
        const type = d.manualTypeOverride || d._type;
        if (activeFilter === 'All') return ['video', 'short', 'live'].includes(type as string);
        if (activeFilter === 'Videos') return type === 'video';
        if (activeFilter === 'Shorts') return type === 'short';
        if (activeFilter === 'Live') return type === 'live';
        if (activeFilter === 'Events') return type === 'event' || d.manualTypeOverride === 'event';
        if (activeFilter === 'Featured') return type === 'featuredBrand' || d.featured === true;
        if (activeFilter === 'Topics') return type === 'topic';
        if (activeFilter === 'Articles') return type === 'article';
        if (activeFilter === 'Outro') return type === 'articleOutro';
        return true;
      });
    }
    if (statusFilter) {
      list = list.filter((d) => {
        if (d._type === 'topic' || d._type === 'article' || d._type === 'articleOutro') return false;
        const status = d.contentStatus || d.status;
        if (statusFilter === 'published') return status === 'published' || status === 'live' || status === 'completed';
        if (statusFilter === 'needs-review') return status === 'needs-review';
        return status !== 'published' && status !== 'live' && status !== 'completed' && status !== 'needs-review';
      });
    }
    return list;
  }, [docs, search, activeFilter, statusFilter]);

  const statusCounts = useMemo(() => {
    let published = 0;
    let needsReview = 0;
    let other = 0;

    docs.forEach((doc) => {
      if (doc._type === 'topic' || doc._type === 'article' || doc._type === 'articleOutro') return;
      
      const status = doc.contentStatus || doc.status;
      if (status === 'published' || status === 'live' || status === 'completed') published++;
      else if (status === 'needs-review') needsReview++;
      else other++; // Drafts, scheduled, missing statuses
    });

    return { published, needsReview, other };
  }, [docs]);

  if (loading) {
    return <div className="text-gray-400 text-sm p-6">Loading videos.json payload…</div>;
  }

  const selected = docs.find((d) => d._id === selectedId) || null;

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto text-[13px] text-gray-200">
      {/* Save bar - own row, always full width */}
      <div className="w-full flex flex-wrap gap-4 justify-between items-center bg-black/40 backdrop-blur-2xl border border-white/10 rounded-2xl z-20 shadow-2xl" style={{ padding: '1.5rem' }}>
        <div className="flex flex-col gap-4 flex-1">
          <div className="text-xl text-white font-black tracking-widest uppercase flex flex-wrap items-center gap-4">
            MANAGING <span className="font-mono text-white bg-white/10 px-4 py-1.5 rounded-lg border border-white/20 text-2xl leading-none">{docs.length}</span> DOCUMENTS LOCALLY
          </div>
          <div className="flex flex-wrap items-stretch gap-3 text-xs font-bold uppercase tracking-widest w-full">
            {statusCounts.published > 0 && (
              <button
                onClick={() => {
                  setStatusFilter(statusFilter === 'published' ? null : 'published');
                  setActiveFilter('GlobalStatus');
                }}
                className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg border transition-all duration-200 text-center ${statusFilter === 'published' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 ring-2 ring-emerald-500/30' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/15'}`}
              >
                {statusCounts.published} Published
              </button>
            )}
            {statusCounts.needsReview > 0 && (
              <button
                onClick={() => {
                  setStatusFilter(statusFilter === 'needs-review' ? null : 'needs-review');
                  setActiveFilter('GlobalStatus');
                }}
                className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg border transition-all duration-200 text-center ${statusFilter === 'needs-review' ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 ring-2 ring-amber-500/30' : 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/15'}`}
              >
                {statusCounts.needsReview} Needs Review
              </button>
            )}
            {statusCounts.other > 0 && (
              <button
                onClick={() => {
                  setStatusFilter(statusFilter === 'other' ? null : 'other');
                  setActiveFilter('GlobalStatus');
                }}
                className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg border transition-all duration-200 text-center ${statusFilter === 'other' ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 ring-2 ring-rose-500/30' : 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/15'}`}
              >
                {statusCounts.other} Drafts / Other
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-5">
          {message && (
            <span className={`text-sm font-medium animate-pulse ${message.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {message.text}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-shrink-0 relative group bg-gradient-to-br from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white rounded-xl text-base font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(220,38,38,0.3)] hover:shadow-[0_0_25px_rgba(220,38,38,0.5)] transform hover:-translate-y-0.5"
            style={{ padding: '1rem 2rem' }}
          >
            <span className="relative z-10">{saving ? 'Saving to disk…' : 'Save to videos.json'}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 items-start w-full">
      {/* Structure pane */}
      <div className={`${activeFilter || selectedId ? 'hidden lg:flex' : 'flex'} w-full lg:w-64 flex-shrink-0 flex-col bg-[#111214] rounded-lg border border-white/10 lg:h-[75vh] overflow-y-auto`} style={{ paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
        <div className="flex flex-col">
          {FILTER_GROUPS.map((group, index) => (
            <div key={group.label} className={index > 0 ? "mt-4" : ""} style={{ paddingBottom: '1.5rem' }}>
              <div className="px-6 pb-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                {group.label}
              </div>
              <div className="flex flex-col">
                {group.filters.map((filter) => (
                  <button
                    key={filter}
                    onClick={() => { setActiveFilter(filter); setSelectedId(null); }}
                    className={`w-full text-left px-4 py-4 transition-all duration-200 border-l-2 border-b border-white/10 group ${
                      activeFilter === filter && !selectedId ? 'bg-white/[0.06] border-l-red-500' : 'hover:bg-white/[0.03] border-l-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between min-h-[54px] w-full">
                      <span className={`text-sm font-black uppercase tracking-widest ${activeFilter === filter && !selectedId ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>
                        {FILTER_LABELS[filter]}
                      </span>
                      <span className="text-xs font-bold text-gray-600 bg-white/5 px-2 py-1 rounded-full">{filterCounts[filter as keyof typeof filterCounts]}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto" style={{ paddingTop: '1.5rem' }}>
          <div className="px-6 pb-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            Create
          </div>
          <div className="flex flex-col">
            {(['video', 'short', 'live', 'event', 'featuredBrand'] as DocType[]).map((type) => (
              <button
                key={type}
                onClick={() => createDoc(type)}
                className="group w-full text-left px-4 py-4 transition-all duration-200 border-l-2 border-l-transparent border-b border-white/10 text-gray-300 hover:bg-white/[0.03] hover:text-white"
              >
                <div className="flex items-center gap-3 min-h-[54px] w-full">
                  <div className="flex items-center justify-center w-6 h-6 rounded-md bg-white/5 text-red-400 font-bold group-hover:bg-red-500 group-hover:text-white transition-colors flex-shrink-0">+</div>
                  <span className="font-black uppercase tracking-widest text-sm text-white">New {type === 'featuredBrand' ? 'Featured' : type}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`${!activeFilter && !selectedId ? 'hidden' : 'flex'} flex-col lg:flex-row gap-3 items-start w-full lg:flex-1 min-w-0`}>
        {/* Document list pane */}
        <div className={`${!activeFilter ? 'hidden' : (selectedId ? 'hidden lg:flex' : 'flex')} w-full lg:w-80 flex-shrink-0 bg-[#111214] rounded-lg border border-white/10 flex-col lg:h-[75vh] max-h-[50vh] lg:max-h-none overflow-hidden relative`}>
          <div className="border-b border-white/10 bg-[#151515] z-10 relative flex items-center gap-3 p-3">
            <button 
              onClick={() => setActiveFilter(null)}
              className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-400 hover:text-white transition-colors flex-shrink-0"
              title="Back to structure"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="relative flex-1">
              <svg className="absolute top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" style={{ left: '0.75rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              <input
                type="text"
                placeholder="Search by title or ID…"
                className="w-full bg-white/5 border border-white/10 rounded-xl pr-3 py-2.5 text-white text-sm focus:ring-2 focus:ring-red-500/50 focus:bg-white/10 focus:border-red-500/50 transition-all duration-300 outline-none placeholder:text-gray-600"
                style={{ paddingLeft: '2.5rem' }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <ul className="overflow-y-auto flex-1 min-h-0 custom-scrollbar z-0 relative">
            {filteredDocs.length === 0 && (
              <li className="p-8 flex flex-col items-center justify-center text-gray-500 text-sm gap-3">
                <svg className="w-8 h-8 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
                No documents match.
              </li>
            )}
            {filteredDocs.map((doc) => {
              const meta = TYPE_META[doc._type] ?? TYPE_META.video;
              return (
                <li
                  key={doc._id}
                  className={`px-4 py-4 cursor-pointer transition-all duration-200 border-l-2 border-b border-white/10 ${
                    selectedId === doc._id ? 'bg-white/[0.06] border-l-red-500' : 'hover:bg-white/[0.03] border-l-transparent'
                  }`}
                  onClick={() => setSelectedId(doc._id)}
                >
                  <div 
                    className={`flex items-center ${meta.label === 'Topic' ? 'min-h-[54px]' : 'gap-3.5'}`}
                    style={meta.label === 'Topic' ? { paddingLeft: '1.5rem' } : undefined}
                  >
                    {meta.label !== 'Topic' && (
                      <div className="relative group flex-shrink-0">
                        {doc.youtubeId || getImageUrl(doc.heroImage) || getImageUrl(doc.logo) ? (
                          <img
                            src={doc.youtubeId ? `https://i.ytimg.com/vi/${doc.youtubeId}/mqdefault.jpg` : (getImageUrl(doc.heroImage) || getImageUrl(doc.logo) || undefined)}
                            alt=""
                            className="w-24 aspect-video object-cover rounded-md bg-gray-900 shadow-md group-hover:shadow-lg transition-shadow"
                          />
                        ) : (
                          <div className="w-24 aspect-video rounded-md bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center text-[10px] text-gray-400 font-bold uppercase text-center leading-tight shadow-inner ring-1 ring-inset ring-white/5">
                            {meta.label}
                          </div>
                        )}
                        <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-md pointer-events-none" />
                      </div>
                    )}
                    <div className="min-w-0 space-y-1.5 flex-1">
                      <p className={`text-white truncate leading-tight group-hover:text-red-100 transition-colors ${
                        meta.label === 'Topic' ? 'text-sm font-black uppercase tracking-widest' : 'text-sm font-semibold'
                      }`}>{doc.title || '(untitled)'}</p>
                      <div className="flex items-center gap-2">
                        {meta.label !== 'Topic' && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${meta.badge}`}>{meta.label}</span>
                        )}
                        {doc.contentStatus && (
                          <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${doc.contentStatus === 'published' ? 'text-emerald-400' : 'text-amber-400'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${doc.contentStatus === 'published' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`}></span>
                            {doc.contentStatus}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Document pane */}
        <div className={`${!selectedId ? 'hidden lg:flex' : 'flex'} flex-col @container w-full lg:flex-1 min-w-0 bg-[#111214] rounded-lg border border-white/10 lg:h-[75vh] relative`}>
          {!selected ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-600 p-6">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mb-3 opacity-50"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="9" y1="21" x2="9" y2="9"></line>
              </svg>
              <p className="text-sm">Select a document, or create a new one from the left.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 p-4 border-b border-white/10">
                <button 
                  onClick={() => setSelectedId(null)}
                  className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-400 hover:text-white transition-colors flex-shrink-0"
                  title="Back to list"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${TYPE_META[selected._type]?.badge}`}>
                      {TYPE_META[selected._type]?.label ?? selected._type}
                    </span>
                    <span className="text-[11px] text-gray-500 font-mono truncate bg-black/30 px-2 py-0.5 rounded-md">{selected._id}</span>
                  </div>
                  <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 truncate tracking-tight">{selected.title}</h2>
                  {selected.youtubeId && (
                    <a
                      href={`https://youtube.com/watch?v=${selected.youtubeId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-red-400 text-xs font-semibold hover:text-red-300 mt-2 hover:underline transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                      View on YouTube
                    </a>
                  )}
                </div>
                {!(selected._type === 'topic' && ['film', 'tv', 'gaming', 'events', 'uncategorized'].includes((typeof selected.slug === "string" ? selected.slug : selected.slug?.current) || '')) ? (
                  <button
                    onClick={() => deleteDoc(selected._id)}
                    className="flex-shrink-0 text-xs font-bold text-rose-500 hover:text-white border border-rose-500/30 hover:border-rose-500 hover:bg-rose-600 rounded-lg px-3 py-2 transition-all duration-300 shadow-sm hover:shadow-[0_0_15px_rgba(225,29,72,0.4)]"
                  >
                    Delete
                  </button>
                ) : (
                  <button
                    disabled
                    title="Core taxonomy nodes cannot be deleted."
                    className="flex-shrink-0 text-xs font-bold text-gray-500 border border-white/5 bg-white/5 rounded-lg px-3 py-2 cursor-not-allowed opacity-50"
                  >
                    Delete (Locked)
                  </button>
                )}
              </div>


              <div className="flex-1 p-5 sm:p-6">
                {(selected._type === 'video' || selected._type === 'short' || selected._type === 'live') && (
                  <VideoForm doc={selected} activeTab={activeTab} setActiveTab={setActiveTab} updateDoc={updateDoc} assetLibrary={assetLibrary} onForgetAsset={forgetAsset} />
                )}
                {selected._type === 'event' && (
                  <EventForm doc={selected} allDocs={docs} assetLibrary={assetLibrary} onForgetAsset={forgetAsset} updateDoc={updateDoc} updateSlug={updateSlug} updateLocation={updateLocation} duplicateAsEdition={duplicateAsEdition} />
                )}
                {selected._type === 'featuredBrand' && (
                  <BrandForm assetLibrary={assetLibrary} onForgetAsset={forgetAsset} doc={selected} updateDoc={updateDoc} updateSlug={updateSlug} />
                )}
                {selected._type === 'article' && (
                  <ArticleForm doc={selected} updateDoc={updateDoc} />
                )}
                {selected._type === 'topic' && (
                  <TopicForm doc={selected} updateDoc={updateDoc} updateSlug={updateSlug} />
                )}

                {selected._type === 'articleOutro' && (
                  <ArticleOutroForm doc={selected} updateDoc={updateDoc} />
                )}
              </div>
            </>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

/**
 * The article outro — the standard closing section under every article.
 *
 * ─── PROSE AND LINKS ARE SEPARATE FIELDS ────────────────────────────────────
 * The copy carries `{brand}`, `{substack}` and `{youtube}` tokens, and each one
 * has its own label and href below. An editor can rewrite every sentence
 * without touching markup, and the component never renders HTML it did not
 * author — nothing here reaches the page through `set:html`.
 *
 * Leaving a field blank falls back to the built-in copy rather than rendering a
 * gap (see ARTICLE_OUTRO_DEFAULTS in src/lib/local-content.ts). This section is
 * on every article, so a blank one is worse than a stale one.
 */
function ArticleOutroForm({ doc, updateDoc }: { doc: Doc; updateDoc: (id: string, field: keyof Doc, value: any) => void }) {
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    updateDoc(doc._id, key as keyof Doc, e.target.value);

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/50 leading-relaxed">
        Rendered under every article. Use <code className="text-red-300">{'{brand}'}</code>,{' '}
        <code className="text-red-300">{'{substack}'}</code> and{' '}
        <code className="text-red-300">{'{youtube}'}</code> in the prose to place the links.
        A blank field falls back to the built-in copy.
      </p>

      <Field label="Heading">
        <input className={inputClass} value={(doc as any).heading || ''} onChange={set('heading')} />
      </Field>

      <Field label="Intro (the quoted paragraph)">
        <textarea className={`${inputClass} min-h-[120px]`} value={(doc as any).intro || ''} onChange={set('intro')} />
      </Field>

      <Field label="Call to action paragraph">
        <textarea className={`${inputClass} min-h-[120px]`} value={(doc as any).cta || ''} onChange={set('cta')} />
      </Field>

      <Field label="Sign-off (one line)">
        <input className={inputClass} value={(doc as any).signOff || ''} onChange={set('signOff')} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Brand link label">
          <input className={inputClass} value={(doc as any).brandLabel || ''} onChange={set('brandLabel')} />
        </Field>
        <Field label="Brand link URL">
          <input className={inputClass} value={(doc as any).brandHref || ''} onChange={set('brandHref')} />
        </Field>
        <Field label="Substack link label">
          <input className={inputClass} value={(doc as any).substackLabel || ''} onChange={set('substackLabel')} />
        </Field>
        <Field label="Substack link URL">
          <input className={inputClass} value={(doc as any).substackHref || ''} onChange={set('substackHref')} />
        </Field>
        <Field label="YouTube link label">
          <input className={inputClass} value={(doc as any).youtubeLabel || ''} onChange={set('youtubeLabel')} />
        </Field>
        <Field label="YouTube link URL">
          <input className={inputClass} value={(doc as any).youtubeHref || ''} onChange={set('youtubeHref')} />
        </Field>
      </div>
    </div>
  );
}

function TagsInput({ label, value, onChange }: { label: string; value?: string[]; onChange: (v: string[]) => void }) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = inputValue.trim().replace(/,$/, '');
      if (newTag && !(value || []).includes(newTag)) {
        onChange([...(value || []), newTag]);
      }
      setInputValue('');
    } else if (e.key === 'Backspace' && inputValue === '' && (value?.length || 0) > 0) {
      e.preventDefault();
      onChange((value || []).slice(0, -1));
    }
  };

  const removeTag = (indexToRemove: number) => {
    onChange((value || []).filter((_, i) => i !== indexToRemove));
  };

  return (
    <Field label={label}>
      <div className={`${inputClass} flex flex-wrap gap-2 items-center p-2 min-h-[46px]`}>
        {(value || []).map((tag, index) => (
          <span key={index} className="flex items-center gap-1.5 max-w-full min-w-0 bg-red-500/20 text-red-200 px-2.5 py-1 rounded-md text-xs font-medium border border-red-500/30 shadow-sm">
            <span className="break-words min-w-0">{tag}</span>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); removeTag(index); }}
              className="flex-shrink-0 text-red-400 hover:text-white transition-colors focus:outline-none bg-black/20 rounded-full w-4 h-4 flex items-center justify-center ml-0.5"
            >
              &times;
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            const newTag = inputValue.trim().replace(/,$/, '');
            if (newTag && !(value || []).includes(newTag)) {
              onChange([...(value || []), newTag]);
            }
            setInputValue('');
          }}
          className="flex-1 bg-transparent outline-none min-w-[120px] text-sm text-gray-200 placeholder:text-gray-600"
          placeholder={(value || []).length === 0 ? "Type and press enter..." : ""}
        />
      </div>
    </Field>
  );
}

function RelatedMediaArray({ value, onChange }: { value?: { title: string; mediaType: string }[]; onChange: (v: { title: string; mediaType: string }[]) => void }) {
  const items = value || [];
  return (
    <Field label="Related Media">
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input type="text" value={item.title || ''} onChange={(e) => {
              const newItems = [...items];
              newItems[i] = { ...newItems[i], title: e.target.value };
              onChange(newItems);
            }} className={inputClass} placeholder="Title" />
            <select value={item.mediaType || 'article'} onChange={(e) => {
              const newItems = [...items];
              newItems[i] = { ...newItems[i], mediaType: e.target.value };
              onChange(newItems);
            }} className={inputClass}>
              <option value="article">Article</option>
              <option value="video">Video</option>
              <option value="podcast">Podcast</option>
            </select>
            <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="px-3 py-2 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50">X</button>
          </div>
        ))}
        <button type="button" onClick={() => onChange([...items, { title: '', mediaType: 'article' }])} className="text-sm text-gray-400 hover:text-white">+ Add Media</button>
      </div>
    </Field>
  );
}

function VideoAssetsArray({ value, onChange }: { value?: { title: string; url: string }[]; onChange: (v: { title: string; url: string }[]) => void }) {
  const items = value || [];
  return (
    <Field label="Video Assets">
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input type="text" value={item.title || ''} onChange={(e) => {
              const newItems = [...items];
              newItems[i] = { ...newItems[i], title: e.target.value };
              onChange(newItems);
            }} className={`${inputClass} flex-1`} placeholder="Title" />
            <input type="text" value={item.url || ''} onChange={(e) => {
              const newItems = [...items];
              newItems[i] = { ...newItems[i], url: e.target.value };
              onChange(newItems);
            }} className={`${inputClass} flex-[2]`} placeholder="YouTube URL" />
            <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="px-3 py-2 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50">X</button>
          </div>
        ))}
        <button type="button" onClick={() => onChange([...items, { title: '', url: '' }])} className="text-sm text-gray-400 hover:text-white border border-white/10 rounded px-3 py-1">+ Add Video Asset</button>
      </div>
    </Field>
  );
}

function GalleryArray({ value, onChange }: { value?: { url: string; alt: string }[]; onChange: (v: { url: string; alt: string }[]) => void }) {
  const items = value || [];
  return (
    <Field label="Image Gallery">
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input type="text" value={item.url || ''} onChange={(e) => {
              const newItems = [...items];
              newItems[i] = { ...newItems[i], url: e.target.value };
              onChange(newItems);
            }} className={`${inputClass} flex-1`} placeholder="Image URL" />
            <input type="text" value={item.alt || ''} onChange={(e) => {
              const newItems = [...items];
              newItems[i] = { ...newItems[i], alt: e.target.value };
              onChange(newItems);
            }} className={`${inputClass} flex-1`} placeholder="Alt Text" />
            <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="px-3 py-2 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50">X</button>
          </div>
        ))}
        <button type="button" onClick={() => onChange([...items, { url: '', alt: '' }])} className="text-sm text-gray-400 hover:text-white border border-white/10 rounded px-3 py-1">+ Add Image</button>
      </div>
    </Field>
  );
}

function SponsorsArray({ value, onChange }: { value?: { name: string; logo: string; url: string }[]; onChange: (v: { name: string; logo: string; url: string }[]) => void }) {
  const items = value || [];
  return (
    <Field label="Sponsor Logos">
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input type="text" value={item.name || ''} onChange={(e) => {
              const newItems = [...items];
              newItems[i] = { ...newItems[i], name: e.target.value };
              onChange(newItems);
            }} className={`${inputClass} flex-1`} placeholder="Name" />
            <input type="text" value={item.logo || ''} onChange={(e) => {
              const newItems = [...items];
              newItems[i] = { ...newItems[i], logo: e.target.value };
              onChange(newItems);
            }} className={`${inputClass} flex-1`} placeholder="Logo URL" />
            <input type="text" value={item.url || ''} onChange={(e) => {
              const newItems = [...items];
              newItems[i] = { ...newItems[i], url: e.target.value };
              onChange(newItems);
            }} className={`${inputClass} flex-1`} placeholder="Website URL" />
            <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="px-3 py-2 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50">X</button>
          </div>
        ))}
        <button type="button" onClick={() => onChange([...items, { name: '', logo: '', url: '' }])} className="text-sm text-gray-400 hover:text-white border border-white/10 rounded px-3 py-1">+ Add Sponsor</button>
      </div>
    </Field>
  );
}

function PressAssetsArray({ value, onChange }: { value?: { label: string; url: string }[]; onChange: (v: { label: string; url: string }[]) => void }) {
  const items = value || [];
  return (
    <Field label="Press Assets">
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input type="text" value={item.label || ''} onChange={(e) => {
              const newItems = [...items];
              newItems[i] = { ...newItems[i], label: e.target.value };
              onChange(newItems);
            }} className={`${inputClass} flex-1`} placeholder="Label (e.g. One-sheet)" />
            <input type="text" value={item.url || ''} onChange={(e) => {
              const newItems = [...items];
              newItems[i] = { ...newItems[i], url: e.target.value };
              onChange(newItems);
            }} className={`${inputClass} flex-[2]`} placeholder="File URL" />
            <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="px-3 py-2 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50">X</button>
          </div>
        ))}
        <button type="button" onClick={() => onChange([...items, { label: '', url: '' }])} className="text-sm text-gray-400 hover:text-white border border-white/10 rounded px-3 py-1">+ Add Press Asset</button>

      </div>
    </Field>
  );
}

function SocialLinksArray({ value, onChange }: { value?: { platform: string; url: string }[]; onChange: (v: { platform: string; url: string }[]) => void }) {
  const items = value || [];
  return (
    <Field label="Social Links">
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input type="text" value={item.platform || ''} onChange={(e) => {
              const newItems = [...items];
              newItems[i] = { ...newItems[i], platform: e.target.value };
              onChange(newItems);
            }} className={inputClass} placeholder="Platform" />
            <input type="text" value={item.url || ''} onChange={(e) => {
              const newItems = [...items];
              newItems[i] = { ...newItems[i], url: e.target.value };
              onChange(newItems);
            }} className={inputClass} placeholder="URL" />
            <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="px-3 py-2 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50">X</button>
          </div>
        ))}
        <button type="button" onClick={() => onChange([...items, { platform: '', url: '' }])} className="text-sm text-gray-400 hover:text-white">+ Add Link</button>
      </div>
    </Field>
  );
}

function VideoForm({
  doc,
  activeTab,
  setActiveTab,
  updateDoc,
  assetLibrary = [],
  onForgetAsset,
}: {
  doc: Doc;
  activeTab: string;
  setActiveTab: (t: string) => void;
  updateDoc: (id: string, field: keyof Doc, value: any) => void;
  /* Threaded in so the hero override can upload and REUSE marks through the
     same picker every other image field uses. Without it the only way to set
     one would be to upload a duplicate of an asset already in the store,
     which is the exact problem the picker was built to end. */
  assetLibrary?: AssetEntry[];
  onForgetAsset?: (ref: string) => void;
}) {
  const update = (field: keyof Doc, value: any) => updateDoc(doc._id, field, value);
  return (
    <div className={sectionClass}>
      <div className="grid grid-cols-1 @lg:grid-cols-2 gap-4">
        <Field label="Title">
          <input type="text" value={doc.title || ''} onChange={(e) => update('title', e.target.value)} className={inputClass} />
        </Field>
        <Field label="YouTube ID">
          <input
            type="text"
            value={doc.youtubeId || ''}
            onChange={(e) => update('youtubeId', e.target.value)}
            className={inputClass}
            placeholder="dQw4w9WgXcQ"
          />
          {!doc.youtubeId && (
            <p className="text-xs text-yellow-500 mt-1.5">
              Required for this doc to render anywhere on the site (thumbnail, playback, ID).
            </p>
          )}
        </Field>
        <div className="@lg:col-span-full">
          {/*
            ─── THE FEED HERO OVERRIDE ────────────────────────────────────

            /feed leads with the newest video, and its hero shows that item's
            HUB mark: the brand or event it belongs to. When nothing resolves
            it falls back to the BE Unconventional crown, which is right for
            our own coverage and wrong when the piece is about somebody else's
            title and they have no hub here.

            That was the Coyote vs. Acme case: the distributor is Ketchup
            Entertainment, which has no brand document, so the hero announced
            the HQ over a film we were reviewing for them. Standing up a whole
            hub for a distributor we have covered once is a much larger change
            than the hero needs, and this is the smaller one.

            Only the newest video renders it, so setting it on an older doc
            does nothing visible today and everything the day it leads.
          */}
          <p className="text-sm font-bold text-white mb-2">Feed Hero Override</p>
          <p className="text-xs text-gray-500 mb-3">
            Only used while this is the newest video, and only on /feed. Leave both empty
            and the hero uses the item's hub, then the BE Unconventional mark.
          </p>
          <div className="grid grid-cols-1 @sm:grid-cols-2 gap-4 mb-6">
            <ImageUploadField
              label="Hero Logo (optional)"
              value={refOf(doc.customHeroLogo)}
              onChange={(v) => update('customHeroLogo', v)}
              library={assetLibrary}
              onForgetAsset={onForgetAsset}
              hint="Replaces the mark on the /feed hero. Use it when the piece is about a brand with no hub on this site. Upload a version that reads on a dark background: the hero sits on #111, so a black wordmark disappears."
            />
            <Field label="Hero Brand Label (optional)">
              <input
                type="text"
                value={doc.customHeroBrandLabel || ''}
                onChange={(e) => update('customHeroBrandLabel', e.target.value)}
                className={inputClass}
                placeholder="e.g. Ketchup Entertainment"
              />
              <p className="text-xs text-gray-500 mt-1.5">
                The logo's alt text. Set it whenever you set a logo above, or a screen
                reader is told the wrong company. Ignored while the logo is empty.
              </p>
            </Field>
          </div>
          <p className="text-sm font-bold text-white mb-2">Visual Badge Overrides</p>
          <div className="grid grid-cols-1 @sm:grid-cols-3 gap-4">
            <Field label="Badge 1 (Brand)">
              <input
                type="text"
                value={doc.badge1 || ''}
                onChange={(e) => update('badge1', e.target.value)}
                className={inputClass}
                placeholder="e.g. SONY PICTURES"
              />
            </Field>
            <Field label="Badge 2 (Format)">
              <input
                type="text"
                value={doc.badge2 || ''}
                onChange={(e) => update('badge2', e.target.value)}
                className={inputClass}
                placeholder="e.g. REVIEW"
              />
            </Field>
            <Field label="Badge 3 (Event)">
              <input
                type="text"
                value={doc.badge3 || ''}
                onChange={(e) => update('badge3', e.target.value)}
                className={inputClass}
                placeholder="e.g. SDCC"
              />
            </Field>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Leave blank to let the system auto-guess from tags. Fill in to explicitly force a badge.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-2">
        {CONTENT_TABS.map((tab) => (
          <button
            key={tab.id}
            className={`flex-none px-4 py-2 text-sm font-bold tracking-wide rounded-lg whitespace-nowrap transition-colors ${
              activeTab === tab.id ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/5 text-gray-400 border border-white/5 hover:text-gray-200 hover:bg-white/10'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="pt-1 min-h-[280px]">
        {activeTab === 'factual' && (
          <div className="space-y-4">
            <Field label="Content Status (Read Only)">
              <div className="text-sm font-medium bg-white/5 border border-white/10 rounded px-3 py-2 text-gray-300">
                {doc.contentStatus || 'PUBLISHED'}
              </div>
            </Field>
            {doc.metrics && (
              <div className="space-y-2 mt-4 pt-4 border-t border-white/10">
                <h4 className="text-sm font-medium text-gray-300">Video Metrics</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 border border-white/10 rounded p-3">
                    <div className="text-xs text-gray-400 mb-1">Velocity (7d)</div>
                    <div className="text-lg font-bold text-white">+{doc.metrics.viewVelocity7d} views</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded p-3">
                    <div className="text-xs text-gray-400 mb-1">Last Computed</div>
                    <div className="text-sm text-gray-200">{new Date(doc.metrics.lastComputedAt).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 text-xs font-mono pt-4">
              <div className="bg-white/5 p-3 rounded border border-white/5">
                <span className="text-gray-500 block mb-1">Duration:</span>
                {doc.durationSeconds ? `${Math.floor(doc.durationSeconds / 60)}m ${doc.durationSeconds % 60}s` : 'Unknown'}
              </div>
              <div className="bg-white/5 p-3 rounded border border-white/5">
                <span className="text-gray-500 block mb-1">Views:</span>
                {doc.viewCount?.toLocaleString() || 'Unknown'}
              </div>
              <div className="bg-white/5 p-3 rounded border border-white/5">
                <span className="text-gray-500 block mb-1">Published:</span>
                {doc.publishedAt ? new Date(doc.publishedAt).toLocaleString() : 'Unknown'}
              </div>
              <div className="bg-white/5 p-3 rounded border border-white/5">
                <span className="text-gray-500 block mb-1">Last Synced:</span>
                {doc.lastSyncedAt ? new Date(doc.lastSyncedAt).toLocaleString() : 'Never'}
              </div>
            </div>
            
            <div className="bg-white/5 p-3 rounded border border-white/5 text-xs font-mono">
              <span className="text-gray-500 block mb-2">Thumbnail URL:</span>
              <a href={doc.thumbnailUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline break-all">
                {doc.thumbnailUrl || 'None'}
              </a>
            </div>

            <div className="bg-white/5 p-3 rounded border border-white/5 text-xs font-mono">
              <span className="text-gray-500 block mb-2">Raw YouTube Tags:</span>
              <div className="flex flex-wrap gap-1">
                {doc.youtubeTags?.map((tag, i) => (
                  <span key={i} className="bg-black/50 px-2 py-0.5 rounded text-gray-400">{tag}</span>
                )) || 'None'}
              </div>
            </div>
            
            <p className="text-xs text-gray-500">
              Factual fields are automatically synced from YouTube and cannot be manually edited here.
            </p>
          </div>
        )}

        {activeTab === 'status' && (
          <div className="space-y-6">
            <Field label="Status">
              <select value={doc.contentStatus} onChange={(e) => update('contentStatus', e.target.value)} className={inputClass}>
                <option value="published">Published</option>
                <option value="needs-review">Needs Review</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
            <div className="grid grid-cols-1 @sm:grid-cols-2 gap-3">
              <Toggle label="Featured" checked={doc.featured || false} onChange={(v) => update('featured', v)} />
              <Toggle label="Requires Review" checked={doc.requiresReview || false} onChange={(v) => update('requiresReview', v)} />
            </div>
            <Field label="Description">
              <textarea value={doc.description || ''} onChange={(e) => update('description', e.target.value)} className={textareaClass} placeholder="What the video is about..." />
            </Field>
          </div>
        )}

        {activeTab === 'overrides' && (
          <div className="space-y-6">
            <Field label="Manual Type Override">
              <select value={doc.manualTypeOverride || ''} onChange={(e) => update('manualTypeOverride', e.target.value)} className={inputClass}>
                <option value="">(None - Auto Detect)</option>
                <option value="video">Standard Video</option>
                <option value="short">YouTube Short</option>
                <option value="live">Live Stream VOD</option>
                <option value="event">Event</option>
              </select>
            </Field>
            <div>
              <Toggle
                label="Manual Taxonomy Override (Sync Lock)"
                checked={doc.manualTaxonomyOverride || false}
                onChange={(v) => update('manualTaxonomyOverride', v)}
              />
              {!doc.manualTaxonomyOverride && (
                <p className="text-xs text-yellow-500 mt-2">Lock required to edit Taxonomy tags.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'taxonomy' && (
          <div className={`grid grid-cols-1 @lg:grid-cols-2 gap-5 ${!doc.manualTaxonomyOverride ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="@lg:col-span-full">
              <Field label="Series">
                <input type="text" value={doc.series || ''} onChange={(e) => update('series', e.target.value)} className={inputClass} />
                <p className="mt-1 text-xs text-neutral-500">
                  Groups a run of coverage, e.g. "Lanterns". Items sharing this name can get their own Feed section.
                </p>
              </Field>
            </div>
            {/*
              ─── A DEDICATED FEED SECTION FOR THIS SHOW ──────────────────────

              Two decisions that belong to the SERIES, not to this item, which
              is why they sit beside Series rather than beside Featured.
              `featured` means "this piece deserves elevated placement"; these
              mean "this piece's series gets its own shelf" and "that shelf is
              themed like this". Coupling them would mean unflagging one video
              to demote it silently killed an entire section.

              Flag items from several different series and each gets its own
              section, most recently updated first. Flag none and the Feed uses
              the most recently updated series with a real run behind it.
            */}
            <div className="@lg:col-span-full">
              <Toggle
                label="Featured Series"
                checked={doc.featuredSeries || false}
                onChange={(v) => update('featuredSeries', v)}
              />
              <p className="mt-1 text-xs text-neutral-500">
                Gives THIS ITEM'S SERIES its own section on the Feed. Not the same as Featured.
              </p>
            </div>
            <div className="@lg:col-span-full">
              <Field label="Series Accent Colour">
                <input
                  type="text"
                  value={doc.seriesAccent || ''}
                  onChange={(e) => update('seriesAccent', e.target.value)}
                  placeholder="#10B981"
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-neutral-500">
                  Hex. Themes the section for the show rather than its studio. Empty uses the hub's brand colour.
                </p>
              </Field>
            </div>
            <div className="@lg:col-span-full">
              <TagsInput label="Franchises" value={doc.franchises} onChange={(v) => update('franchises', v)} />
            </div>
            <div className="@lg:col-span-full">
              <TagsInput label="Characters" value={doc.characters} onChange={(v) => update('characters', v)} />
            </div>
            <TagsInput label="Topics (slugs)" value={doc.topics} onChange={(v) => update('topics', v)} />
            <TagsInput label="Hubs (slugs)" value={doc.hubs} onChange={(v) => update('hubs', v)} />
          </div>
        )}

        {activeTab === 'editorial' && (
          <div className="grid grid-cols-1 gap-5">
            {/*
              ─── WHAT THIS PIECE IS ─────────────────────────────────────────

              The options come from COVERAGE_TYPES in src/lib/tags.ts, which is
              the SAME list the renderer validates against. They were typed out
              here once, and four of the eight values in that list disagreed
              with it: "trailer", "breakdown" and "other" named nothing the
              site could render, so choosing one set a field the metadata line
              then ignored and fell back to guessing from raw YouTube tags.

              The list is ordered by editorial priority, highest first. That
              order is what the Feed uses to decide what leads the publication,
              so it is deliberately not alphabetical.
            */}
            <Field label="Coverage Type">
              <select value={doc.coverageType || ''} onChange={(e) => update('coverageType', e.target.value)} className={inputClass}>
                <option value="">(None)</option>
                {COVERAGE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.charAt(0) + type.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-neutral-500">
                What the piece IS. Drives the metadata line and how the Feed ranks it.
              </p>
            </Field>

            {/*
              ─── THE SITE'S OWN WORDS FOR THIS VIDEO ────────────────────────

              Without this the card and the spotlight hero fall back to the
              YouTube description, which is written for a different audience and
              carries subscribe CTAs, gear lists and affiliate links. Articles
              have had this field since the Substack sync; videos had no
              equivalent, and that was the one genuinely missing piece of the
              editorial layer.

              Optional. Left empty, the card shows its title and metadata and no
              body text, which is honest. It is never overwritten by a sync.
            */}
            <Field label="Editorial Excerpt (Standfirst)">
              <textarea
                value={doc.editorial?.excerpt || ''}
                onChange={(e) => {
                  /* An empty excerpt is stored as an ABSENT key, not an empty
                     string: `editorialPreview()` falls through on absent and
                     would return '' for a stored empty one, which are the same
                     result today but diverge the moment anything treats the
                     field as "has the editor been here". */
                  const next: NonNullable<Doc['editorial']> = { ...(doc.editorial || {}) };
                  if (e.target.value) next.excerpt = e.target.value;
                  else delete next.excerpt;
                  update('editorial', Object.keys(next).length > 0 ? next : undefined);
                }}
                rows={3}
                className={textareaClass}
                placeholder="One or two sentences, in the publication's voice..."
              />
              <p className="mt-1 text-xs text-neutral-500">
                Shown on cards and in the hero. Replaces the YouTube description entirely.
              </p>
            </Field>

            {/*
              ─── ORDER, NOT DATE ────────────────────────────────────────────

              Publish order and episode order are different things. The Lanterns
              episode 2 review went out the day AFTER the episode 3 review, so
              every row it appears in read 5, 4, 2, 3.

              This changes where the item sits in a row and nothing else. The
              date on the card, in the metadata and in the feeds is still the
              real publish date, because that is when it actually went out.

              Left empty, the item orders by its publish date as before.
            */}
            <Field label="Order as if published on">
              <input
                type="date"
                value={(doc.sortDate || '').slice(0, 10)}
                onChange={(e) => update('sortDate', e.target.value)}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-neutral-500">
                Ordering only. Leave empty to use the publish date
                {doc.publishedAt ? ` (${String(doc.publishedAt).slice(0, 10)})` : ''}.
              </p>
            </Field>

            <Field label="Editorial Notes">
              <textarea value={doc.editorialNotes || ''} onChange={(e) => update('editorialNotes', e.target.value)} className={textareaClass} placeholder="Internal context..." />
            </Field>

            <RelatedMediaArray 
              value={doc.relatedMedia} 
              onChange={(v) => update('relatedMedia', v)} 
            />
            
            <TagsInput label="Legacy Video IDs" value={doc.videoIds} onChange={(v) => update('videoIds', v)} />
            <TagsInput label="Legacy Article URLs" value={doc.articleUrls} onChange={(v) => update('articleUrls', v)} />
          </div>
        )}
      </div>
    </div>
  );
}

function EventForm({
  allDocs,
  doc,
  assetLibrary,
  onForgetAsset,
  updateDoc,
  updateSlug,
  updateLocation,
  duplicateAsEdition,
}: {
  allDocs: Doc[];
  doc: Doc;
  /* Built ONCE at the top of the app, not derived here. Two forms deriving it
     separately is how one of them would have kept the old in-use-only
     behaviour after the other was fixed. */
  assetLibrary: AssetEntry[];
  onForgetAsset: (ref: string) => void;
  updateDoc: (id: string, field: keyof Doc, value: any) => void;
  updateSlug: (id: string, value: string) => void;
  updateLocation: (id: string, field: keyof LocationInfo, value: string) => void;
  duplicateAsEdition: (doc: Doc) => void;
}) {
  const update = (field: keyof Doc, value: any) => updateDoc(doc._id, field, value);
  const brandHubs = allDocs.filter((d: any) => d._type === 'featuredBrand').sort((a: any, b: any) => a.title.localeCompare(b.title));
  /* Only templates may be picked as a parent series, and a document can never
     be its own parent. */
  const seriesTemplates = allDocs
    .filter((d: any) => d._type === 'event' && d.isRecurringTemplate === true && d._id !== doc._id)
    .sort((a: any, b: any) => String(a.title).localeCompare(String(b.title)));
  return (
    <div className={sectionClass}>
      <div className="grid grid-cols-1 @lg:grid-cols-2 gap-5">
        <Field label="Title">
          <input type="text" value={doc.title || ''} onChange={(e) => update('title', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Slug">
          <input
            type="text"
            value={(typeof doc.slug === "string" ? doc.slug : doc.slug?.current) || ''}
            onChange={(e) => updateSlug(doc._id, e.target.value)}
            className={`${inputClass} font-mono`}
          />
          <p className="text-xs text-gray-600 mt-1.5">/events/{(typeof doc.slug === "string" ? doc.slug : doc.slug?.current) || '…'}</p>
        </Field>
        {/*
          ─── STATUS IS AN OVERRIDE, NOT A STATE MACHINE ──────────────────

          This offered Upcoming / Live / Completed / TBD, and NONE of them do
          anything: getEventStatus() derives those three from the dates and
          only reads `status` to honour the two EDITORIAL states. So an editor
          could set "Completed" on a future event, save it, and watch the site
          keep calling it upcoming, with no way to tell why.

          It was also lying about what was stored. Every event in the store
          holds `status: "scheduled"`, which was not one of the options above,
          so React found no match and rendered the first one — all nineteen
          events showed "Upcoming" in this dropdown while the file said
          something else entirely. The list matches schema/event.ts now, which
          is the same three values the store already uses.
        */}
        <Field label="Status Override">
          <select value={doc.status || 'scheduled'} onChange={(e) => update('status', e.target.value)} className={inputClass}>
            <option value="scheduled">Scheduled (auto by date)</option>
            <option value="cancelled">Cancelled</option>
            <option value="postponed">Postponed</option>
          </select>
          <p className="text-xs text-gray-600 mt-1.5">
            Upcoming, Live and Completed are worked out from the dates on every build.
            Only change this to Cancelled or Postponed, which are the two things the
            dates cannot tell us.
          </p>
        </Field>
        <Field label="Franchise / Brand Hub">
          <select value={doc.relatedBrandSlug || ''} onChange={(e) => update('relatedBrandSlug', e.target.value)} className={inputClass}>
            <option value="">None</option>
            {brandHubs.map(b => (
              <option key={b._id} value={typeof b.slug === 'string' ? b.slug : b.slug?.current}>{b.title}</option>
            ))}
          </select>
        </Field>
        {/*
          ─── A DROPDOWN MUST NEVER SHOW A VALUE THAT IS NOT STORED ───────

          This read `value={doc.eventType || 'convention'}` with no option for
          "unset", so an event with NO eventType key rendered as "Convention".
          Thirteen of nineteen events were in that state: the CMS said
          Convention, the JSON had no field at all, and the hero tag on
          /events/[slug] — which reads the store — fell back to the generic
          "EVENT". Worse, the trap was self-sealing: the editor could not fix
          it by picking Convention, because the dropdown already showed
          Convention, so no change event ever fired and nothing was written.

          The empty option is the fix. An unset field now says it is unset,
          and picking any value writes it.
        */}
        <Field label="Event Type">
          <select value={doc.eventType || ''} onChange={(e) => update('eventType', e.target.value)} className={inputClass}>
            <option value="">Not set (shows as “Event”)</option>
            <option value="convention-expo">Convention</option>
            <option value="premiere">Premiere</option>
            <option value="screening">Screening</option>
            <option value="showcase">Showcase</option>
            <option value="festival">Festival</option>
            <option value="industry-awards">Industry Awards</option>
            <option value="brand-activation">Brand Activation</option>
            <option value="other">Other</option>
          </select>
          <p className="text-xs text-gray-600 mt-1.5">
            Drives the first metadata tag in the event hero. Leave unset and the tag
            reads “Event”.
          </p>
        </Field>
        <Field label="Start Date">
          <input type="date" value={doc.startDate || ''} onChange={(e) => update('startDate', e.target.value)} className={inputClass} />
        </Field>
        <Field label="End Date">
          <input type="date" value={doc.endDate || ''} onChange={(e) => update('endDate', e.target.value)} className={inputClass} />
        </Field>
      </div>

      <div className="border-t border-white/10 pt-5">
        <div className={labelClass}>Location</div>
        <div className="grid grid-cols-1 @lg:grid-cols-2 gap-3">
          <input type="text" value={doc.location?.venue || ''} onChange={(e) => updateLocation(doc._id, 'venue', e.target.value)} className={inputClass} placeholder="Venue" />
          <input type="text" value={doc.location?.city || ''} onChange={(e) => updateLocation(doc._id, 'city', e.target.value)} className={inputClass} placeholder="City" />
          <input type="text" value={doc.location?.region || ''} onChange={(e) => updateLocation(doc._id, 'region', e.target.value)} className={inputClass} placeholder="Region / State" />
          <input type="text" value={doc.location?.country || ''} onChange={(e) => updateLocation(doc._id, 'country', e.target.value)} className={inputClass} placeholder="Country" />
        </div>
      </div>

      {/*
        TWO PIECES OF PROSE, AND THEY ARE NOT INTERCHANGEABLE. The tagline is
        the ONE LINE under the logo in the hero; the About copy is the
        paragraph in the page body. They used to be the same field, so the
        hero clamped the About paragraph to five lines and cut it off
        mid-word, with the full version sitting a screen below.
      */}
      <Field label="Short Description (Bio)">
        <input
          type="text"
          value={doc.tagline || ''}
          onChange={(e) => update('tagline', e.target.value)}
          className={inputClass}
          maxLength={120}
          placeholder={`Defaults to “${doc.title || 'the event name'}”`}
        />
        <p className="text-xs text-gray-600 mt-1.5">
          One short line under the logo in the hero. A handful of words. Leave it empty
          and the event name is used. Nothing here is ever truncated, so keep it short
          by choice rather than by limit.
        </p>
      </Field>

      <Field label="About (Full Description)">
        <textarea value={doc.description || ''} onChange={(e) => update('description', e.target.value)} className={textareaClass} placeholder="What this event is about. Shown in the About section of the page body." />
        <p className="text-xs text-gray-600 mt-1.5">
          The ABOUT section in the body of the page. Write as much as it needs. This is
          no longer shown in the hero, so it is never cut off.
        </p>
      </Field>

      <div className="grid grid-cols-1 @lg:grid-cols-2 gap-5">
        <Field label="Organizer">
          <input type="text" value={doc.organizer || ''} onChange={(e) => update('organizer', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Trailer URL">
          <input type="text" value={doc.trailerUrl || ''} onChange={(e) => update('trailerUrl', e.target.value)} className={inputClass} placeholder="https://youtu.be/…" />
        </Field>
        <Field label="Official Website">
          <input type="text" value={doc.officialWebsite || ''} onChange={(e) => update('officialWebsite', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Sign-up Link">
          <input type="text" value={doc.signUpLink || ''} onChange={(e) => update('signUpLink', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Brand Color (Hex)">
          <input type="text" value={doc.brandColor?.hex || ''} onChange={(e) => update('brandColor', { hex: e.target.value })} className={inputClass} placeholder="#FF0000" />
        </Field>
        <ImageUploadField
          label="Logo"
          value={refOf(doc.logo)}
          onChange={(v) => update('logo', v)}
          library={assetLibrary}
          onForgetAsset={onForgetAsset}
          hint="The brand mark, and the fallback for both overrides below. Shared across editions is fine: all four PAX events use one PAX wordmark here."
        />
        <ImageUploadField
          label="Hero Logo (optional)"
          value={refOf(doc.heroLogo)}
          onChange={(v) => update('heroLogo', v)}
          library={assetLibrary}
          onForgetAsset={onForgetAsset}
          hint="Only the small mark at the TOP LEFT of the hero. Leave empty and it uses the Logo above. Set it when the brand mark is not specific enough: PAX West and PAX East share a logo, so without this their heroes look like the same event."
        />
        <ImageUploadField
          label="Stage Logo (optional)"
          value={refOf(doc.stageLogo)}
          onChange={(v) => update('stageLogo', v)}
          library={assetLibrary}
          onForgetAsset={onForgetAsset}
          hint="The third mark. Only the LARGE one on the stage, and only while the switch below is on. Leave empty and it uses the Logo above."
        />
        <Field label="Stage">
          <Toggle
            label="Show a logo on the stage"
            checked={doc.stageShowMark === true}
            onChange={(v) => update('stageShowMark', v)}
          />
          <p className="mt-1 text-[11px] leading-snug text-neutral-500">
            Off, the frame where the trailer plays holds the key art, blurred. On, it holds a
            mark. The hero already shows one at the top left and the tagline repeats the name
            under it, so a mark here is the same identity three times down one screen. Turn it
            on where the stage logo is genuinely a different thing.
          </p>
        </Field>
        <ImageUploadField
          label="Hero Image"
          value={refOf(doc.heroImage)}
          onChange={(v) => update('heroImage', v)}
          library={assetLibrary}
          onForgetAsset={onForgetAsset}
          hint="Key art behind the whole hero, and the social share card."
        />
      </div>

      <div className="mt-5">
        <SocialLinksArray 
          value={doc.socialLinks} 
          onChange={(v) => update('socialLinks', v)} 
        />
      </div>

      {/*
        ONE tag list, not two.

        This was split into "YouTube Sync Keywords" and "Coverage Tags"
        because the sync reads one of them and only the site reads the other,
        so widening the sync list has consequences the site list does not.
        That distinction was real and it was still the wrong shape: in
        practice a YouTube video and a Substack post about SDCC 2026 get
        tagged the same words, so the split only ever meant typing the same
        list twice and watching the two drift.

        The existing values were merged into this one field, and every reader
        (the site matcher, the YouTube sync's hub dictionary, search, the
        Instagram topic filter) now sees the same list.
      */}
      <div className="mt-5">
        <TagsInput label="Tags" value={doc.youtubeSyncKeywords} onChange={(v) => update('youtubeSyncKeywords', v)} />
        <p className="text-xs text-gray-400 mt-1.5">One list, used everywhere: it matches YouTube videos during the sync AND articles and videos on the site. Spacing and punctuation do not matter ("SDCC 2026", "SDCC2026" and "sdcc-2026" are one tag). The YEAR does: "SDCC 2026" never matches "SDCC 2027", which is what keeps each edition's coverage its own. Tag broadly enough to catch your posts, narrowly enough that the sync does not pull in someone else's event.</p>
      </div>

      <div className="mt-5">
        <TagsInput label="Pin To This Hub" value={doc.pinnedCoverage} onChange={(v) => update('pinnedCoverage', v)} />
        <p className="text-xs text-gray-400 mt-1.5">Article slugs, guids, YouTube ids or document _ids this hub owns whatever the tags say. A pin beats tag matching outright: it adds the item here AND makes that article&rsquo;s page show this hub on its card. Reach for it when the tags point somewhere defensible but wrong, like a GTA piece that mentions Netflix in passing.</p>
      </div>

      <div className="mt-5">
        <TagsInput label="Exclude From Coverage" value={doc.excludeCoverage} onChange={(v) => update('excludeCoverage', v)} />
        <p className="text-xs text-gray-400 mt-1.5">Article slugs, guids, YouTube ids or document _ids to drop from this hub whatever the tags say. Use it for a retrospective: a post about SDCC written in 2027 could be about either edition, and only you know which. Exclude beats Pin.</p>
      </div>

      <div className="mt-10 pt-10 border-t border-white/10 space-y-8">
        <h3 className={labelClass}>Additional Media & Assets</h3>
        <VideoAssetsArray value={doc.videoAssets} onChange={(v) => update('videoAssets', v)} />
        <GalleryArray value={doc.gallery} onChange={(v) => update('gallery', v)} />
        <SponsorsArray value={doc.sponsors} onChange={(v) => update('sponsors', v)} />
        <PressAssetsArray value={doc.pressAssets} onChange={(v) => update('pressAssets', v)} />
      </div>

      {/*
        ─── RECURRING SERIES ─────────────────────────────────────────────

        The local half of the template model documented in schema/event.ts.
        A template is a reusable profile — PAX West's logo, key art, brand
        colour, venue, organizer and sync keywords — with no dates of its
        own; getEventsLocal() filters templates out, so one never renders a
        page, a calendar row or an archive card.

        "Duplicate as new edition" is the point of the whole feature: it
        stamps a fresh event from this document, carrying every shared field
        across and clearing only what genuinely changes each time (dates,
        ticket link, edition label). Editions link back by SLUG rather than
        by _id, matching relatedBrandSlug — the local store has no reference
        resolution, and a slug survives a re-export from Sanity.
      */}
      <div className="mt-10 pt-10 border-t border-white/10">
        <h3 className={labelClass}>Recurring Series</h3>

        <Field label="Series Template">
          <Toggle
            label="This is a recurring series template"
            checked={doc.isRecurringTemplate || false}
            onChange={(v) => update('isRecurringTemplate', v)}
          />
          <p className="text-xs text-gray-600 mt-1.5">
            Turn on for a reusable profile such as “PAX West” or “SDCC”. A template never
            appears on the site. It exists so each new edition can be duplicated from it
            with its artwork, venue and sync keywords intact instead of being rebuilt.
          </p>
        </Field>

        {doc.isRecurringTemplate ? (
          <div className="grid grid-cols-1 @lg:grid-cols-2 gap-3 mt-5">
            <Field label="Cadence">
              <select
                value={doc.recurrenceCadence || ''}
                onChange={(e) => update('recurrenceCadence', e.target.value)}
                className={inputClass}
              >
                <option value="">Not set</option>
                <option value="annual">Annual</option>
                <option value="biannual">Twice a year</option>
                <option value="quarterly">Quarterly</option>
                <option value="irregular">Irregular</option>
              </select>
            </Field>
            <Field label="Usual Month">
              <select
                value={doc.recurrenceMonth || ''}
                onChange={(e) => update('recurrenceMonth', e.target.value)}
                className={inputClass}
              >
                <option value="">Not set</option>
                {MONTH_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </Field>
          </div>
        ) : (
          <div className="grid grid-cols-1 @lg:grid-cols-2 gap-3 mt-5">
            <Field label="Part of Series">
              <select
                value={doc.seriesTemplateSlug || ''}
                onChange={(e) => update('seriesTemplateSlug', e.target.value)}
                className={inputClass}
              >
                <option value="">Standalone event</option>
                {seriesTemplates.map((t: any) => (
                  <option key={t._id} value={typeof t.slug === 'string' ? t.slug : t.slug?.current}>
                    {t.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Edition">
              <input
                type="text"
                value={doc.editionLabel || ''}
                onChange={(e) => update('editionLabel', e.target.value)}
                className={inputClass}
                placeholder="2026"
              />
            </Field>
          </div>
        )}

        <div className="mt-5">
          <button
            type="button"
            onClick={() => duplicateAsEdition(doc)}
            className="px-4 py-2 text-xs font-bold uppercase tracking-widest border border-white/20 text-white hover:border-red-500 hover:text-red-400 transition-colors"
          >
            Duplicate as new edition
          </button>
          <p className="text-xs text-gray-600 mt-1.5">
            Creates a new event carrying this one’s artwork, brand colour, location,
            organizer, links and sync keywords. Dates, the ticket link and the edition
            label are cleared, because those are the only things that actually change
            between editions.
          </p>
        </div>
      </div>

      <div className="mt-10 pt-10 border-t border-white/10">
        <Field label="Hero Override">
          <Toggle
            label="Force as Spotlight Hero"
            checked={doc.forceSpotlightHero || false}
            onChange={(v) => update('forceSpotlightHero', v)}
          />
          <p className="text-xs text-gray-600 mt-1.5">
            If checked, this event will be forced into the Spotlight Hero spot at the top of the /events page. It will remain the hero until it expires (passes its end date), at which point the site will automatically fall back to the next upcoming event.
          </p>
        </Field>

        <Field label="Hero Badge">
          <select 
            value={doc.spotlightBadge || 'dot'} 
            onChange={(e) => update('spotlightBadge', e.target.value)} 
            className={inputClass}
          >
            <option value="dot">Upcoming Dot (Default)</option>
            <option value="countdown">Countdown Timer</option>
            <option value="none">None</option>
          </select>
          <p className="text-xs text-gray-600 mt-1.5">
            Choose what badge appears over the hero image when this event is featured. Use Countdown for highly anticipated upcoming events. If the event is currently happening or past, the countdown won't make sense, so use Dot or None.
          </p>
        </Field>

        <Field label="Visibility">
          <Toggle
            label="Hide from the live site"
            checked={doc.hidden || false}
            onChange={(v) => update('hidden', v)}
          />
          <p className="text-xs text-gray-600 mt-1.5">
            Hidden events are removed from /events and stop generating their own
            page in a production build. They still appear in <code>npm run dev</code>,
            so an unfinished event stays in front of you while you finish it.
          </p>
        </Field>
      </div>
    </div>
  );
}

/*
  Mirrors `categoryLabels` in src/pages/featured/index.astro. Kept as a fixed
  list rather than a free-text box because these four rows are a design
  decision — a typo here would strand a hub in a row that never renders.
*/
const HUB_CATEGORIES = [
  { value: 'universes', label: 'Franchises' },
  { value: 'streaming', label: 'Streamers' },
  { value: 'studios', label: 'Studios' },
  { value: 'gaming', label: 'Games' },
  { value: 'other', label: 'Uncategorised' },
];

function BrandForm({
  doc,
  assetLibrary,
  onForgetAsset,
  updateDoc,
  updateSlug,
}: {
  doc: Doc;
  assetLibrary: AssetEntry[];
  onForgetAsset: (ref: string) => void;
  updateDoc: (id: string, field: keyof Doc, value: any) => void;
  updateSlug: (id: string, value: string) => void;
}) {
  const update = (field: keyof Doc, value: any) => updateDoc(doc._id, field, value);
  return (
    <div className={sectionClass}>
      <div className="grid grid-cols-1 @lg:grid-cols-2 gap-5">
        <Field label="Title">
          <input type="text" value={doc.title || ''} onChange={(e) => update('title', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Slug">
          <input
            type="text"
            value={(typeof doc.slug === "string" ? doc.slug : doc.slug?.current) || ''}
            onChange={(e) => updateSlug(doc._id, e.target.value)}
            className={`${inputClass} font-mono`}
          />
          <p className="text-xs text-gray-600 mt-1.5">/featured/{(typeof doc.slug === "string" ? doc.slug : doc.slug?.current) || '…'}</p>
        </Field>
        <Field label="Trailer URL">
          <input type="text" value={doc.trailerUrl || ''} onChange={(e) => update('trailerUrl', e.target.value)} className={inputClass} placeholder="https://youtube.com/watch?v=…" />
        </Field>
        <ImageUploadField
          label="Logo"
          value={refOf(doc.logo)}
          onChange={(v) => update('logo', v)}
          library={assetLibrary}
          onForgetAsset={onForgetAsset}
          hint="The brand mark, and the fallback for both overrides below."
        />
        <ImageUploadField
          label="Hero Logo (optional)"
          value={refOf(doc.heroLogo)}
          onChange={(v) => update('heroLogo', v)}
          library={assetLibrary}
          onForgetAsset={onForgetAsset}
          hint="Only the small mark at the TOP LEFT of the hub page. Leave empty and it uses the Logo above."
        />
        <ImageUploadField
          label="Stage Logo (optional)"
          value={refOf(doc.stageLogo)}
          onChange={(v) => update('stageLogo', v)}
          library={assetLibrary}
          onForgetAsset={onForgetAsset}
          hint="The third mark. Only the LARGE one in the trailer frame, and only while the switch below is on. Leave empty and it uses the Logo above."
        />
        <Field label="Stage">
          <Toggle
            label="Show a logo on the stage"
            checked={doc.stageShowMark === true}
            onChange={(v) => update('stageShowMark', v)}
          />
          <p className="mt-1 text-[11px] leading-snug text-neutral-500">
            Off, the frame where the trailer plays holds this hub's art, from Backdrops if set and
            Hero Image otherwise. On, it holds a mark. The hero already shows one at the top left,
            so a mark here states the same identity twice on one screen. Turn it on where the stage
            logo is genuinely a different thing.
          </p>
        </Field>
        <ImageUploadField
          label="Hero Image"
          value={refOf(doc.heroImage)}
          onChange={(v) => update('heroImage', v)}
          library={assetLibrary}
          onForgetAsset={onForgetAsset}
          hint="Key art behind the whole hub page, the /featured deck card, and the nav thumbnail."
        />
      </div>

      <div className="grid grid-cols-1 @lg:grid-cols-2 gap-5 mt-5">
        <Field label="Hub Category">
          <select
            value={doc.hubCategory || 'other'}
            onChange={(e) => update('hubCategory', e.target.value)}
            className={inputClass}
          >
            {HUB_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <p className="text-xs text-gray-600 mt-1.5">Which row this hub appears in on /featured.</p>
        
        </Field>

        <Field label="Visibility">
          <Toggle
            label="Hide from the live site"
            checked={doc.hidden || false}
            onChange={(v) => update('hidden', v)}
          />
          <p className="text-xs text-gray-600 mt-1.5">
            Hidden hubs are removed from /featured and stop generating their own
            page in a production build. They still appear in <code>npm run dev</code>,
            so an unfinished hub stays in front of you while you finish it. Use
            this for hubs that have no artwork yet.
          </p></Field>

        <Field label="Brand Colour">
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={doc.brandColor?.hex || '#CC0000'}
              onChange={(e) => update('brandColor', { hex: e.target.value.toUpperCase() })}
              className="h-[46px] w-14 shrink-0 cursor-pointer rounded-md border border-white/10 bg-transparent p-1"
            />
            <input
              type="text"
              value={doc.brandColor?.hex || ''}
              onChange={(e) => update('brandColor', { hex: e.target.value.toUpperCase() })}
              placeholder="#CC0000"
              className={`${inputClass} font-mono`}
            />
          </div>
          <p className="text-xs text-gray-600 mt-1.5">Drives this hub's glow, row tint, and button.</p>
        </Field>
      </div>

      <div className="mt-5">
        <Field label="Description">
          <textarea
            value={doc.description || ''}
            onChange={(e) => update('description', e.target.value)}
            className={textareaClass}
            placeholder="One line, shown under the logo on /featured. Set in caps, so keep it short."
          />
        </Field>
      </div>

      <div className="mt-5">
        <BackdropsField value={doc.backdrops} onChange={(v) => update('backdrops', v)} />
      </div>

      {/*
        ONE tag list, not two.

        This was split into "YouTube Sync Keywords" and "Coverage Tags"
        because the sync reads one of them and only the site reads the other,
        so widening the sync list has consequences the site list does not.
        That distinction was real and it was still the wrong shape: in
        practice a YouTube video and a Substack post about SDCC 2026 get
        tagged the same words, so the split only ever meant typing the same
        list twice and watching the two drift.

        The existing values were merged into this one field, and every reader
        (the site matcher, the YouTube sync's hub dictionary, search, the
        Instagram topic filter) now sees the same list.
      */}
      <div className="mt-5">
        <TagsInput label="Tags" value={doc.youtubeSyncKeywords} onChange={(v) => update('youtubeSyncKeywords', v)} />
        <p className="text-xs text-gray-400 mt-1.5">One list, used everywhere: it matches YouTube videos during the sync AND articles and videos on the site. Spacing and punctuation do not matter ("SDCC 2026", "SDCC2026" and "sdcc-2026" are one tag). The YEAR does: "SDCC 2026" never matches "SDCC 2027", which is what keeps each edition's coverage its own. Tag broadly enough to catch your posts, narrowly enough that the sync does not pull in someone else's event.</p>
      </div>

      <div className="mt-5">
        <TagsInput label="Pin To This Hub" value={doc.pinnedCoverage} onChange={(v) => update('pinnedCoverage', v)} />
        <p className="text-xs text-gray-400 mt-1.5">Article slugs, guids, YouTube ids or document _ids this hub owns whatever the tags say. A pin beats tag matching outright: it adds the item here AND makes that article&rsquo;s page show this hub on its card. Reach for it when the tags point somewhere defensible but wrong, like a GTA piece that mentions Netflix in passing.</p>
      </div>

      <div className="mt-5">
        <TagsInput label="Exclude From Coverage" value={doc.excludeCoverage} onChange={(v) => update('excludeCoverage', v)} />
        <p className="text-xs text-gray-400 mt-1.5">Article slugs, guids, YouTube ids or document _ids to drop from this hub whatever the tags say. Use it for a retrospective: a post about SDCC written in 2027 could be about either edition, and only you know which. Exclude beats Pin.</p>
      </div>
    </div>
  );
}

function TopicForm({
  doc,
  updateDoc,
  updateSlug,
}: {
  doc: Doc;
  updateDoc: (id: string, field: keyof Doc, value: any) => void;
  updateSlug: (id: string, value: string) => void;
}) {
  const update = (field: keyof Doc, value: any) => updateDoc(doc._id, field, value);
  const isProtectedSlug = ['film', 'tv', 'gaming', 'events', 'uncategorized'].includes((typeof doc.slug === "string" ? doc.slug : doc.slug?.current) || '');

  return (
    <div className={sectionClass}>
      <div className="grid grid-cols-1 @lg:grid-cols-2 gap-5">
        <Field label="Title">
          <input type="text" value={doc.title || ''} onChange={(e) => update('title', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Slug">
          <input
            type="text"
            value={(typeof doc.slug === "string" ? doc.slug : doc.slug?.current) || ''}
            onChange={(e) => updateSlug(doc._id, e.target.value)}
            disabled={isProtectedSlug}
            className={`${inputClass} font-mono ${isProtectedSlug ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
          {isProtectedSlug && <p className="text-xs text-amber-500 mt-1.5">Core slug cannot be modified.</p>}
        </Field>
      </div>

      <div className="my-5">
        <Toggle
          label="Tier-1 Site Category"
          checked={doc.isTier1Category || false}
          onChange={(v) => update('isTier1Category', v)}
        />
        <p className="text-xs text-gray-400 mt-1.5">The top-level site categories. Videos must match at least one Tier-1 keyword.</p>
      </div>

      <TagsInput label="YouTube Sync Keywords" value={doc.youtubeSyncKeywords} onChange={(v) => update('youtubeSyncKeywords', v)} />
      
      <div className="mt-5">
        <Field label="Empty-State Message">
          <textarea value={doc.emptyStateMessage || ''} onChange={(e) => update('emptyStateMessage', e.target.value)} className={textareaClass} placeholder="First-person message shown when this category has no content yet..." />
        </Field>
      </div>
    </div>
  );
}

function ArticleForm({
  doc,
  updateDoc,
}: {
  doc: Doc;
  updateDoc: (id: string, field: keyof Doc, value: any) => void;
}) {
  const update = (field: keyof Doc, value: any) => updateDoc(doc._id, field, value);
  const updateEditorial = (field: keyof NonNullable<Doc['editorial']>, value: any) => {
    const next = { ...(doc.editorial || {}), [field]: value };
    // Clean up empty strings
    if (value === '') delete next[field];
    update('editorial', Object.keys(next).length > 0 ? next : undefined);
  };

  return (
    <div className={sectionClass}>
      <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <h4 className="text-blue-400 font-bold mb-2">Editorial Overrides</h4>
        <p className="text-sm text-blue-200/70">
          The base article syncs from Substack hourly. Anything you set here overrides Substack and will never be overwritten by the sync.
        </p>
      </div>
      
      <div className="grid grid-cols-1 @lg:grid-cols-2 gap-5 mb-5">
        <Field label="Override Title">
          <input type="text" value={doc.editorial?.title || ''} onChange={(e) => updateEditorial('title', e.target.value)} placeholder={doc.title} className={inputClass} />
        </Field>
        <Field label="Override Category">
          <select value={doc.editorial?.category || ''} onChange={(e) => updateEditorial('category', e.target.value)} className={inputClass}>
            <option value="">(Use Substack tags)</option>
            <option value="Film">Film</option>
            <option value="TV">TV</option>
            <option value="Games">Games</option>
            <option value="Events">Events</option>
          </select>
        </Field>
      </div>

      <div className="mb-5">
        <Field label="Override Excerpt (Standfirst)">
          <textarea value={doc.editorial?.excerpt || ''} onChange={(e) => updateEditorial('excerpt', e.target.value)} rows={3} className={inputClass} placeholder="A hand-written standfirst..." />
        </Field>
      </div>

      <div className="grid grid-cols-1 @lg:grid-cols-2 gap-5 mb-5">
        <Field label="Sort Weight (Higher = Top)">
          <input type="number" value={doc.editorial?.sortWeight || 0} onChange={(e) => updateEditorial('sortWeight', parseInt(e.target.value) || 0)} className={inputClass} />
        </Field>
        <Field label="Override Image URL">
          <input type="text" value={doc.editorial?.image || ''} onChange={(e) => updateEditorial('image', e.target.value)} className={inputClass} placeholder="https://..." />
        </Field>
      </div>

      <div className="flex gap-6 mt-6 pt-6 border-t border-white/10">
        <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-white group">
          <input type="checkbox" checked={doc.editorial?.featured || false} onChange={(e) => updateEditorial('featured', e.target.checked)} className="rounded border-gray-600 bg-gray-700 text-red-500 focus:ring-red-500 focus:ring-offset-gray-900" />
          <span className="group-hover:text-red-400 transition-colors">Featured</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-400 group">
          <input type="checkbox" checked={doc.editorial?.hidden || false} onChange={(e) => updateEditorial('hidden', e.target.checked)} className="rounded border-gray-600 bg-gray-700 text-gray-500 focus:ring-gray-500 focus:ring-offset-gray-900" />
          <span className="group-hover:text-gray-300 transition-colors">Hide entirely</span>
        </label>
      </div>
    </div>
  );
}
