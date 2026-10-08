/**
 * Offline unit tests for src/lib/events.ts — the date-critical foundation.
 *
 * These guard the platform's most regression-prone invariants: calendar dates
 * are YYYY-MM-DD strings compared at equal precision, never round-tripped
 * through UTC (`new Date("YYYY-MM-DD")` shifts a day west of Greenwich).
 *
 * Run:  node scripts/events.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  parseEventDate,
  parseEventDateToLocal,
  formatEventDateRange,
  formatLocation,
  toYMD,
  getEventStatus,
  getEventTypeLabel,
  EVENT_TYPE_LABELS,
} from '../src/lib/events.ts';

let passed = 0;
const test = (name, fn) => {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err.message}`);
    process.exitCode = 1;
  }
};

console.log('events.ts');

// --- parseEventDate ---------------------------------------------------------
test('parseEventDate: splits a calendar date without Date/UTC involvement', () => {
  const p = parseEventDate('2026-07-22');
  assert.equal(p.year, 2026);
  assert.equal(p.month, 7);
  assert.equal(p.day, 22);
  assert.equal(p.monthShort, 'Jul');
});
test('parseEventDate: tolerates datetime strings by slicing the date part', () => {
  assert.equal(parseEventDate('2026-07-22T15:00:00Z').day, 22);
});
test('parseEventDate: null/undefined/garbage → null', () => {
  assert.equal(parseEventDate(null), null);
  assert.equal(parseEventDate(undefined), null);
  assert.equal(parseEventDate('not-a-date'), null);
});

// --- parseEventDateToLocal (the UTC-shift guard) -----------------------------
test('parseEventDateToLocal: local midnight, never the UTC-shifted prior day', () => {
  const d = parseEventDateToLocal('2026-07-22');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 6); // 0-indexed July
  assert.equal(d.getDate(), 22); // new Date('2026-07-22') would give 21 in TZs west of UTC
  assert.equal(d.getHours(), 0);
});

// --- formatEventDateRange ----------------------------------------------------
test('range: single day', () => {
  assert.equal(formatEventDateRange('2026-07-22'), 'Jul 22, 2026');
});
test('range: same month', () => {
  assert.equal(formatEventDateRange('2026-07-22', '2026-07-26', { year: false }), 'Jul 22–26');
});
test('range: cross-month, same year', () => {
  assert.equal(formatEventDateRange('2026-07-30', '2026-08-02'), 'Jul 30 – Aug 2, 2026');
});
test('range: cross-year always shows both years', () => {
  assert.equal(
    formatEventDateRange('2025-12-30', '2026-01-02', { year: false }),
    'Dec 30, 2025 – Jan 2, 2026',
  );
});
test('range: end === start collapses to a single day', () => {
  assert.equal(formatEventDateRange('2026-07-22', '2026-07-22'), 'Jul 22, 2026');
});
test('range: missing start → Date TBD', () => {
  assert.equal(formatEventDateRange(null), 'Date TBD');
});

// --- formatLocation ----------------------------------------------------------
test('location: city + region', () => {
  assert.equal(formatLocation({ city: 'San Diego', region: 'CA' }), 'San Diego, CA');
});
test('location: partials degrade without stray commas', () => {
  assert.equal(formatLocation({ city: 'San Diego' }), 'San Diego');
  assert.equal(formatLocation({ country: 'Japan' }), 'Japan');
  assert.equal(formatLocation(null), '');
});
test('location: legacy string passes through (no [object Object])', () => {
  assert.equal(formatLocation('San Diego, CA'), 'San Diego, CA');
});
test('location: includeVenue prefixes the venue', () => {
  assert.equal(
    formatLocation({ venue: 'Hall H', city: 'San Diego', region: 'CA' }, { includeVenue: true }),
    'Hall H, San Diego, CA',
  );
});

// --- toYMD --------------------------------------------------------------------
test('toYMD: ISO-ordered calendar day in the reference timezone', () => {
  // 07:00 UTC on Jul 23 is Jul 23 00:00 in Los Angeles (PDT, UTC-7).
  assert.equal(toYMD(new Date('2026-07-23T07:00:00Z')), '2026-07-23');
  // One second earlier is still Jul 22 in LA — the UTC date would say 23.
  assert.equal(toYMD(new Date('2026-07-23T06:59:59Z')), '2026-07-22');
});

// --- getEventStatus ------------------------------------------------------------
const SDCC = { startDate: '2026-07-23', endDate: '2026-07-26' };
const at = (iso) => new Date(iso); // noon UTC = same calendar day in LA
test('status: before start → upcoming', () => {
  assert.equal(getEventStatus(SDCC, at('2026-07-20T12:00:00Z')), 'upcoming');
});
test('status: first day → live', () => {
  assert.equal(getEventStatus(SDCC, at('2026-07-23T12:00:00Z')), 'live');
});
test('status: LAST day still reads live, not completed', () => {
  assert.equal(getEventStatus(SDCC, at('2026-07-26T12:00:00Z')), 'live');
});
test('status: day after end → completed', () => {
  assert.equal(getEventStatus(SDCC, at('2026-07-27T12:00:00Z')), 'completed');
});
test('status: single-day event (no endDate) is live only on that day', () => {
  const oneDay = { startDate: '2026-07-23' };
  assert.equal(getEventStatus(oneDay, at('2026-07-23T12:00:00Z')), 'live');
  assert.equal(getEventStatus(oneDay, at('2026-07-24T12:00:00Z')), 'completed');
});
test('status: editorial cancelled/postponed always win over dates', () => {
  assert.equal(getEventStatus({ ...SDCC, status: 'cancelled' }, at('2026-07-24T12:00:00Z')), 'cancelled');
  assert.equal(getEventStatus({ ...SDCC, status: 'postponed' }, at('2026-07-24T12:00:00Z')), 'postponed');
});
test('status: no startDate defaults to upcoming', () => {
  assert.equal(getEventStatus({}, at('2026-07-24T12:00:00Z')), 'upcoming');
});
test('status: datetime-precision storage still compares correctly', () => {
  // If dates ever arrive as full ISO timestamps, slice(0,10) keeps the
  // comparison at equal precision instead of misclassifying today as past.
  const e = { startDate: '2026-07-23T00:00:00Z', endDate: '2026-07-26T00:00:00Z' };
  assert.equal(getEventStatus(e, at('2026-07-26T12:00:00Z')), 'live');
});

/* ══════════════════════════════════════════════════════════════════════════
   EVENT TYPE: ONE LIST, THREE FILES

   `eventType` is offered by two dropdowns and rendered by one label map, and
   they are in three different files that nothing linked until this suite:

     schema/event.ts                        the Sanity Studio dropdown
     src/components/admin/LocalCmsApp.tsx   the local CMS dropdown
     src/lib/events.ts EVENT_TYPE_LABELS    what the hero tag renders

   The failure mode is not a crash. A value offered by a dropdown but missing
   from the label map renders through titleCaseToken(), which produces
   something plausible ("Award Show") for a value the design never approved —
   so the drift ships looking correct. These read the real files rather than
   restating the lists, because a test that restates them drifts too.
   ══════════════════════════════════════════════════════════════════════════ */

const schemaTypeValues = (() => {
  const src = fs.readFileSync(new URL('../schema/event.ts', import.meta.url), 'utf8');
  const field = src.split("name: 'eventType'")[1].split('layout:')[0];
  return [...field.matchAll(/value: '([^']+)'/g)].map((m) => m[1]);
})();

/* The whole <select>, from its `value=` attribute through its closing tag.
   Anchoring on the onChange handler instead would slice off the attribute
   these tests are partly about. */
const eventTypeSelect = (src) =>
  src.slice(src.indexOf('value={doc.eventType')).split('</select>')[0];

const cmsTypeValues = (() => {
  const src = fs.readFileSync(
    new URL('../src/components/admin/LocalCmsApp.tsx', import.meta.url),
    'utf8',
  );
  // The leading empty option is the deliberate "Not set" entry, not a value.
  return [...eventTypeSelect(src).matchAll(/<option value="([^"]*)"/g)]
    .map((m) => m[1])
    .filter(Boolean);
})();

test('event type: the Sanity schema and the local CMS offer the same values', () => {
  assert.ok(schemaTypeValues.length > 0, 'parsed no values out of schema/event.ts');
  assert.deepEqual([...cmsTypeValues].sort(), [...schemaTypeValues].sort());
});

test('event type: every offered value has a curated label', () => {
  for (const value of schemaTypeValues) {
    assert.ok(
      EVENT_TYPE_LABELS[value],
      `"${value}" is offered in a dropdown but has no EVENT_TYPE_LABELS entry, so it ` +
        `would render as "${getEventTypeLabel({ eventType: value })}" via the fallback`,
    );
  }
});

test('event type: no duplicate values in a dropdown', () => {
  assert.equal(new Set(schemaTypeValues).size, schemaTypeValues.length);
  assert.equal(new Set(cmsTypeValues).size, cmsTypeValues.length);
});

test('event type: the local CMS keeps its explicit "not set" option', () => {
  const src = fs.readFileSync(
    new URL('../src/components/admin/LocalCmsApp.tsx', import.meta.url),
    'utf8',
  );
  const select = eventTypeSelect(src);
  /*
    Both halves matter, and only together. The empty OPTION gives an unset
    field somewhere to render; the empty FALLBACK is what points at it. With a
    real value as the fallback instead (`|| 'convention'`), an unset field
    displayed as Convention and the editor could not correct it, because
    picking the value already shown fires no change event and writes nothing.
  */
  assert.match(select, /<option value=""/);
  assert.match(select, /value=\{doc\.eventType \|\| ''\}/);
});

test('event type: an unset type reads as the neutral "Event", never a lifecycle word', () => {
  assert.equal(getEventTypeLabel({}), 'Event');
  assert.equal(getEventTypeLabel({ eventType: '' }), 'Event');
  assert.equal(getEventTypeLabel(null), 'Event');
  assert.equal(getEventTypeLabel({ eventType: 'other' }), 'Event');
});

test('event type: retired values still resolve to their replacement label', () => {
  /*
    Copies of the store that predate the press-grade migration must not fall
    through to titleCaseToken() and quietly render the old wording.

    DERIVED, NOT HARDCODED. This asserted the literal 'Convention & Expo' and
    so failed the moment that label was shortened to 'Convention' — a pure
    wording change with nothing wrong about it. What actually has to hold is
    that a retired value renders whatever its REPLACEMENT renders, so that is
    what it reads now.

    Note `expo` and `award_show` are the two carrying the weight here.
    titleCaseToken('convention') is "Convention", which is the live label as
    well, so that one line would pass even with the alias deleted; the other
    two would not ("Expo", "Award Show").
  */
  assert.equal(
    getEventTypeLabel({ eventType: 'convention' }),
    EVENT_TYPE_LABELS['convention-expo'],
  );
  assert.equal(
    getEventTypeLabel({ eventType: 'expo' }),
    EVENT_TYPE_LABELS['convention-expo'],
  );
  assert.equal(
    getEventTypeLabel({ eventType: 'award_show' }),
    EVENT_TYPE_LABELS['industry-awards'],
  );
});

test('event type: retired values are NOT offered by any dropdown', () => {
  for (const retired of ['convention', 'expo', 'award_show']) {
    assert.ok(!schemaTypeValues.includes(retired), `${retired} still offered in the schema`);
    assert.ok(!cmsTypeValues.includes(retired), `${retired} still offered in the local CMS`);
  }
});

test('event type: a legacy category object or string still names the event', () => {
  assert.equal(getEventTypeLabel({ category: { title: 'Gaming' } }), 'Gaming');
  assert.equal(getEventTypeLabel({ category: 'press-day' }), 'Press Day');
});

test('event type: every event in the store holds a value a dropdown offers', () => {
  const store = JSON.parse(
    fs.readFileSync(new URL('../src/data/videos.json', import.meta.url), 'utf8'),
  );
  const offered = new Set([...schemaTypeValues, '']);
  for (const doc of store.filter((d) => d._type === 'event')) {
    const value = doc.eventType ?? '';
    assert.ok(
      offered.has(value),
      `${doc.slug?.current} holds eventType "${value}", which no dropdown offers — ` +
        'it was likely missed by a taxonomy migration',
    );
  }
});

test('the /events display lockup is gone, but the page still has an h1', () => {
  /*
    ─── SUNSETTING A HEADER IS NOT THE SAME AS DELETING A HEADING ───────────

    "Coverage / Upcoming / Events" was a full <PageTitle> stacked directly
    above the spotlight hero, which already carries the event's logo, status,
    countdown, date and city. Two title treatments before a single event was
    visible, and the header's own 2.5rem margin pushed the hero further down.

    But it was the ONLY <h1> on /events. Deleting the element outright leaves
    the route with no heading at all: an empty document outline for a screen
    reader, and a missing-h1 finding for the SEO audit that runs on every PR.
    So the heading survives as .sr-only and only the typography goes.
  */
  const page = fs.readFileSync(new URL('../src/pages/events/index.astro', import.meta.url), 'utf8');

  assert.doesNotMatch(page, /<PageTitle[\s\S]{0,80}SECTIONS\.events/,
    'the display lockup is back above the /events hero');
  assert.match(page, /<h1 class="sr-only">/,
    '/events must still name itself; sunsetting the lockup is a typographic change, not a structural one');
  /* Built from the same copy the lockup used, so the two cannot drift. */
  assert.match(page, /\{SECTIONS\.events\.primary\} \{SECTIONS\.events\.secondary\}/,
    'the heading text must come from SECTIONS.events, not a hardcoded string');
});

test('the upcoming list is scrolled by a rail, not by controls over the list', () => {
  /*
    The first version floated two buttons above the list's top-right corner,
    where they sat on the "UPCOMING EVENTS" heading and the first row.

    Docking them INSIDE the list is no better and is the obvious next idea: the
    right-hand edge of every row already carries its own arrow and the left
    carries the date badge. So the scroller reserves a gutter and the rail
    stands in it — the rows are narrower by exactly that strip and nothing
    overlaps anything. Measured at 1512x858: rail at x 930-974, rows ending at
    911, heading ending at y 62 against a rail starting at 112.

    The middle button is the year index. The arrows answer the wrong question
    on a list spanning years: nudging 400px at a time to reach 2027 is the
    paging this change removed.
  */
  const list = fs.readFileSync(
    new URL('../src/components/UpcomingEventsList.astro', import.meta.url), 'utf8');
  const code = list.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

  assert.match(code, /\.uel-scroller \{[^}]*--uel-rail-gutter:/,
    'the gutter the rail stands in must be a token the scroller reads');
  assert.match(code, /\.uel-scroller \{[^}]*grid-template-columns: minmax\(0, 1fr\) var\(--uel-rail-gutter\)/,
    'the rows must be narrowed by the gutter via grid columns, or the rail is back on top of them');
  /* The rail is first in the markup: unpinned, auto-placement drops the list
     into a second row under it (a 142px empty block, reported on desktop). */
  assert.match(code, /\.uel-viewport \{[^}]*grid-row: 1;/, 'the list must be pinned to row 1');
  assert.match(code, /\.uel-rail \{[^}]*grid-row: 1;/, 'the rail must be pinned to row 1');
  /* A rem gutter shrank to 4px beside an 11px scrollbar on a 14" MacBook Pro. */
  assert.match(code, /--uel-rail-gutter: 44px;/, 'the rail column is the rail\'s own px width, not a rem strip');
  assert.match(code, /\.uel-scroller \{[^}]*column-gap: max\(1rem, 16px\)/, 'a real gap between the scrollbar and the rail');
  assert.match(code, /@media \(max-width: 767px\) \{[\s\S]*?\.uel-scroller \{\s*display: block;/,
    'phones get one column, or the hidden rail still costs every row 60px');
  assert.match(code, /\.uel-rail \{[^}]*flex-direction: column/,
    'a vertical rail: up, index, down');

  const order = ['data-uel-up', 'data-uel-index', 'data-uel-down']
    .map((hook) => code.indexOf(hook));
  assert.ok(order.every((i) => i > -1), 'all three controls must exist');
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'top to bottom: up, index, down');

  /*
    The panel opens INWARD. The rail is in the column's right-hand gutter, so
    outward runs off the content column and, at md, under the sidebar.
  */
  assert.match(code, /\.uel-index-panel \{[^}]*right: calc\(100% \+/,
    'the year panel must open over the list, not off the edge of the column');

  /*
    And the jump must move the CONTAINER, not the page. scrollIntoView() walks
    every scrollable ancestor, so jumping to 2027 inside this box would also
    scroll the document to bring the box into view — the jump the rail exists
    to avoid. Verified in a browser: page scroll unchanged, container at 582.
  */
  assert.match(code, /viewport\.scrollTo\(\{/, 'the year jump must drive the container directly');
  assert.ok(!/group\.scrollIntoView/.test(code),
    'scrollIntoView here scrolls the page as well as the list');

  /* Nothing to drive below the breakpoint, where the list stops scrolling. */
  assert.match(code, /@media \(max-width: 767px\) \{[\s\S]*?\.uel-rail \{\s*display: none;/,
    'the rail must go where the nested scroll goes');
});

test('the upcoming list feathers at whichever edge has more behind it', () => {
  /*
    The same idiom as the feed rails (`--fade-start` / `--fade-end` in
    FeedGrid.astro), turned ninety degrees. PER EDGE, not both at once: a fade
    at the top while already scrolled to the top dims the first row for nothing
    and eats the top border of a row hovered there, which is the bug fixed
    immediately before this one.

    The custom properties default to 0px so the no-JS state is hard edges
    rather than two permanently dimmed rows.
  */
  const list = fs.readFileSync(
    new URL('../src/components/UpcomingEventsList.astro', import.meta.url), 'utf8');
  const code = list.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

  assert.match(code, /--fade-top: 0px;/, 'the fade must default to off');
  assert.match(code, /--fade-bottom: 0px;/, 'both of them');
  assert.match(code, /mask-image: linear-gradient\(\s*to bottom,[\s\S]*?var\(--fade-top\)[\s\S]*?var\(--fade-bottom\)/,
    'the mask must read both edges independently');
  assert.match(code, /setProperty\('--fade-top', atTop \? '0px'/,
    'no top fade while the list is already at the top');
  assert.match(code, /setProperty\('--fade-bottom', atEnd \? '0px'/,
    'and none at the bottom once there is nothing below');
  assert.match(code, /@media \(max-width: 767px\) \{[\s\S]*?mask-image: none;/,
    'nothing scrolls below the breakpoint, so a mask there only dims rows');
});

test('the calendar tile has depth against the page', () => {
  /*
    A translucent panel on a near-black page reads as a slightly lighter
    rectangle: the 1px border was all that separated it from the background,
    and beside the events list — which has its own hover lift and glow — it
    looked like part of the backdrop.
  */
  const cal = fs.readFileSync(
    new URL('../src/components/MiniCalendarSidebar.astro', import.meta.url), 'utf8');
  const rule = cal.match(/\.mini-calendar-wrapper \{[\s\S]*?\n  \}/);
  assert.ok(rule, 'the wrapper rule is gone');
  assert.match(rule[0], /box-shadow:\s*var\(--shadow-tile\)/,
    'the tile must sit on the page, and via the shared token rather than its own copy');

  /*
    THE VALUE MOVED, so the assertion follows it. This was a literal here
    until the same treatment was asked for on the Support The HQ rows, the
    What We Cover tiles and the Highlights tiles — four more consumers is the
    point at which it stops being a one-off and becomes a token. Checking only
    the `var()` above would stop checking what the shadow actually is.
  */
  const base = fs.readFileSync(
    new URL('../src/styles/global-base.css', import.meta.url), 'utf8');
  const token = base.match(/--shadow-tile:[\s\S]*?;/);
  assert.ok(token, '--shadow-tile is not defined');
  const shadows = token[0].match(/rgba\(0, 0, 0, [\d.]+\)/g) || [];
  assert.ok(shadows.length >= 2,
    'a cast shadow that broad has no detectable start; it needs a tight one under the edge too');

  /*
    And every surface that was asked for reads the token. A tile that keeps
    its own copy is how a shared treatment drifts apart one file at a time.
  */
  const consumers = [
    ['src/styles/modules/referrals.css', /\.referral-item \{[\s\S]*?box-shadow: var\(--shadow-tile\)/],
    ['src/styles/modules/home-cards.css', /\.cat \{[\s\S]*?box-shadow: var\(--shadow-tile\)/],
    ['src/components/FeaturedHighlights.astro', /\.fh-row \{[\s\S]*?box-shadow: var\(--shadow-tile\)/],
    ['src/components/FeaturedHighlights.astro', /\.fh-hero-card \{[\s\S]*?box-shadow: var\(--shadow-tile\)/],
  ];
  for (const [rel, re] of consumers) {
    const src = fs.readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
    assert.match(src, re, `${rel} must read --shadow-tile, not a copy of it`);
  }

  /*
    A hover that names only its glow REPLACES the depth, because box-shadow is
    one property — the tile would drop flat at the moment it is pointed at.
    Both hovers that add a brand glow must layer it on the token.
  */
  const cat = fs.readFileSync(
    new URL('../src/styles/modules/home-cards.css', import.meta.url), 'utf8');
  assert.match(cat, /\.cat:hover \{[\s\S]*?box-shadow: var\(--shadow-tile\), /,
    'the category tile must keep its depth while hovered');
});

test('sunsetting the /events header did not touch any other route', () => {
  /*
    The ask named /events specifically and guarded the homepage, /intel and
    /feed. Those three plus /events/archive and /collaborations each render
    their own <PageTitle as="h1">, and a find-and-replace across the repo
    would have taken all of them.
  */
  const KEEP = [
    ['../src/pages/events/archive/[...page].astro', /<PageTitle as="h1" \{\.\.\.SECTIONS\.eventArchive\}/],
    ['../src/pages/collaborations.astro', /<PageTitle as="h1" \{\.\.\.SECTIONS\.collaborations\}/],
    ['../src/pages/404.astro', /<PageTitle as="h1" \{\.\.\.SECTIONS\.notFound\}/],
    /* /intel and /feed both render through FeedLayout's header. */
    ['../src/layouts/FeedLayout.astro', /<PageTitle[\s\S]{0,120}as="h1"|as="h1"[\s\S]{0,120}\/>/],
  ];
  for (const [rel, re] of KEEP) {
    const src = fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
    assert.match(src, re, `${rel} lost its page title; only /events was meant to change`);
  }

  /* The homepage keeps its own <h1> too, by whatever route it builds it. */
  const home = fs.readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
  assert.match(home, /Hero|<h1/, 'the homepage must still open with a heading');
});

console.log(
  process.exitCode ? `FAILED (${passed} passed)` : `All ${passed} tests passed.`,
);
